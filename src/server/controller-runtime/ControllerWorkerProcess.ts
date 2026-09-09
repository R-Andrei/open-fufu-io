import { randomUUID } from "node:crypto";

import ivm from "isolated-vm";

import {
  validateProductionControllerOutput,
  type ControllerWorkerRequest,
  type ControllerWorkerResponse,
} from "./ProductionControllerHost";

type WorkerRequestEnvelope = Readonly<{
  requestId: number;
  request: ControllerWorkerRequest;
}>;

type WorkerResponseEnvelope = Readonly<{
  requestId: number;
  response: ControllerWorkerResponse;
  rssBytes: number;
}>;

const hardenGlobalSource = `
  "use strict";

  const __openFufuSetHas = Function.prototype.call.bind(Set.prototype.has);
  const __openFufuSetAdd = Function.prototype.call.bind(Set.prototype.add);
  const __openFufuSetDelete = Function.prototype.call.bind(Set.prototype.delete);
  const __openFufuHasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  const __openFufuPrimordials = Object.freeze({
    freeze: Object.freeze,
    keys: Object.keys,
    is: Object.is,
    isArray: Array.isArray,
    numberIsFinite: Number.isFinite,
    reflectOwnKeys: Reflect.ownKeys,
    hasOwn: __openFufuHasOwn,
    SetCtor: Set,
    setHas: __openFufuSetHas,
    setAdd: __openFufuSetAdd,
    setDelete: __openFufuSetDelete
  });

  Object.defineProperty(globalThis, "__openFufuPrimordials", {
    value: __openFufuPrimordials,
    writable: false,
    configurable: false,
    enumerable: false
  });

  for (const name of [
    "process",
    "require",
    "Buffer",
    "fetch",
    "WebSocket",
    "Date",
    "performance",
    "crypto",
    "WeakRef",
    "FinalizationRegistry"
  ]) {
    Object.defineProperty(globalThis, name, {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: false
    });
  }

  if (typeof Intl === "object" && Intl !== null) {
    Object.defineProperty(Intl, "DateTimeFormat", {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: false
    });
  }

  Object.defineProperty(Math, "random", {
    value: undefined,
    writable: false,
    configurable: false,
    enumerable: false
  });
`;

const invokeEntrypointSource = `
  const primordials = globalThis.__openFufuPrimordials;

  const deepFreeze = (value, seen = new primordials.SetCtor()) => {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      return value;
    }
    if (primordials.setHas(seen, value)) return value;
    primordials.setAdd(seen, value);
    for (const key of primordials.reflectOwnKeys(value)) {
      deepFreeze(value[key], seen);
    }
    return primordials.freeze(value);
  };

  const materialize = (value, ancestors = new primordials.SetCtor()) => {
    if (value === null) return null;
    if (typeof value === "boolean" || typeof value === "string") return value;
    if (typeof value === "number") {
      if (!primordials.numberIsFinite(value)) throw new TypeError("non-finite result number");
      return primordials.is(value, -0) ? 0 : value;
    }
    if (typeof value !== "object") throw new TypeError("non-data result value");
    if (primordials.setHas(ancestors, value)) throw new TypeError("cyclic result value");
    primordials.setAdd(ancestors, value);

    try {
      if (primordials.isArray(value)) {
        const copy = [];
        for (let index = 0; index < value.length; index += 1) {
          if (!primordials.hasOwn(value, index)) {
            throw new TypeError("sparse result array");
          }
          copy.push(materialize(value[index], ancestors));
        }
        return copy;
      }

      const copy = {};
      for (const key of primordials.keys(value)) {
        copy[key] = materialize(value[key], ancestors);
      }
      return copy;
    } finally {
      primordials.setDelete(ancestors, value);
    }
  };

  const input = deepFreeze(globalThis.__openFufuInput);
  let output;
  try {
    output = $0(input);
  } catch {
    return { status: "RUNTIME_ERROR" };
  }

  if (output === undefined) return { status: "OK" };
  try {
    return { status: "OK", output: materialize(output) };
  } catch {
    return { status: "INVALID_OUTPUT" };
  }
`;

class ModuleInitializationTimeoutError extends Error {
  constructor() {
    super("controller module initialization timed out");
    this.name = "ModuleInitializationTimeoutError";
  }
}

function workerFault(
  fault: Extract<ControllerWorkerResponse, { ok: false }>["fault"],
): ControllerWorkerResponse {
  return Object.freeze({ ok: false as const, fault });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out/i.test(error.message);
}

function isMemoryLimitError(error: unknown): boolean {
  return error instanceof Error && /memory limit|out of memory/i.test(error.message);
}

function isWorkerRequestEnvelope(value: unknown): value is WorkerRequestEnvelope {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.requestId) &&
    record.request !== null &&
    typeof record.request === "object"
  );
}

function createModuleInitializationDeadline(timeoutMs: number): bigint {
  return process.hrtime.bigint() + BigInt(timeoutMs) * 1_000_000n;
}

function remainingModuleInitializationMs(deadline: bigint): number {
  const remainingNs = deadline - process.hrtime.bigint();
  if (remainingNs <= 0n) {
    throw new ModuleInitializationTimeoutError();
  }
  return Math.max(1, Math.ceil(Number(remainingNs) / 1_000_000));
}

async function withinModuleInitializationDeadline<T>(
  deadline: bigint,
  operation: (remainingMs: number) => Promise<T>,
): Promise<T> {
  const remainingMs = remainingModuleInitializationMs(deadline);

  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ModuleInitializationTimeoutError()),
      remainingMs,
    );

    operation(remainingMs).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function createModuleCompletionProbe(): Readonly<{
  exportName: string;
  token: string;
}> {
  const token = randomUUID();
  return Object.freeze({
    exportName: `__openFufuModuleCompletion_${token.replaceAll("-", "_")}`,
    token,
  });
}

function instrumentModuleSource(
  moduleSource: string,
  completion: Readonly<{ exportName: string; token: string }>,
): string {
  return `${moduleSource}\nexport var ${completion.exportName} = ${JSON.stringify(completion.token)};\n`;
}

async function evaluateModuleWithinInitializationDeadline(
  module: ivm.Module,
  deadline: bigint,
  completion: Readonly<{ exportName: string; token: string }>,
): Promise<void> {
  await withinModuleInitializationDeadline(deadline, async (remainingMs) => {
    await module.evaluate({ timeout: remainingMs });

    while (true) {
      const value = await module.namespace.get(completion.exportName, {
        copy: true,
      });
      if (value === completion.token) return;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  });
}

async function executeRequest(
  request: ControllerWorkerRequest,
): Promise<ControllerWorkerResponse> {
  let isolate: ivm.Isolate | undefined;

  try {
    isolate = new ivm.Isolate({
      memoryLimit: request.isolateMemoryMb,
      onCatastrophicError: () => process.abort(),
    });
    const context = await isolate.createContext();

    const hardenScript = await isolate.compileScript(hardenGlobalSource);
    await hardenScript.run(context, {
      timeout: request.moduleEvaluationTimeoutMs,
    });

    const completion = createModuleCompletionProbe();
    const moduleInitializationDeadline = createModuleInitializationDeadline(
      request.moduleEvaluationTimeoutMs,
    );

    const module = await withinModuleInitializationDeadline(
      moduleInitializationDeadline,
      () =>
        isolate!.compileModule(
          instrumentModuleSource(request.artifact.moduleSource, completion),
          {
            filename: `open-fufu-controller:${request.factionId}`,
          },
        ),
    );

    if (module.dependencySpecifiers.length !== 0) {
      return workerFault("SANDBOX_VIOLATION");
    }

    await withinModuleInitializationDeadline(
      moduleInitializationDeadline,
      () =>
        module.instantiate(context, () => {
          throw new Error("controller module imports are forbidden");
        }),
    );

    try {
      await evaluateModuleWithinInitializationDeadline(
        module,
        moduleInitializationDeadline,
        completion,
      );
    } catch (error) {
      if (isTimeoutError(error)) return workerFault("TIMEOUT");
      if (isMemoryLimitError(error)) return workerFault("MEMORY_LIMIT");
      return workerFault("RUNTIME_ERROR");
    }

    const entrypoint = await module.namespace.get(request.entrypoint, {
      reference: true,
    });
    if (!(entrypoint instanceof ivm.Reference) || entrypoint.typeof !== "function") {
      return workerFault("INVALID_OUTPUT");
    }

    let memory: unknown;
    try {
      memory = JSON.parse(request.memoryJson);
    } catch {
      return workerFault("RUNTIME_ERROR");
    }

    const callbackContext = Object.assign({}, request.context, { memory });
    try {
      await context.global.set("__openFufuInput", callbackContext, {
        copy: true,
      });
    } catch {
      return workerFault("RUNTIME_ERROR");
    }

    let invocationResult: unknown;
    try {
      invocationResult = await context.evalClosure(
        invokeEntrypointSource,
        [entrypoint.derefInto()],
        {
          timeout: request.timeoutMs,
          result: { copy: true },
        },
      );
    } catch (error) {
      if (isTimeoutError(error)) return workerFault("TIMEOUT");
      if (isMemoryLimitError(error)) return workerFault("MEMORY_LIMIT");
      return workerFault("INVALID_OUTPUT");
    }

    if (
      invocationResult === null ||
      typeof invocationResult !== "object" ||
      Array.isArray(invocationResult)
    ) {
      return workerFault("RUNTIME_ERROR");
    }

    const invocationRecord = invocationResult as Record<string, unknown>;
    if (invocationRecord.status === "RUNTIME_ERROR") {
      return workerFault("RUNTIME_ERROR");
    }
    if (invocationRecord.status === "INVALID_OUTPUT") {
      return workerFault("INVALID_OUTPUT");
    }
    if (invocationRecord.status !== "OK") {
      return workerFault("RUNTIME_ERROR");
    }

    const validated = validateProductionControllerOutput(
      request.hook,
      invocationRecord.output,
    );
    if (!validated.ok) {
      return workerFault(validated.fault);
    }

    return Object.freeze({
      ok: true as const,
      output: validated.output,
      usage: Object.freeze({
        queries: 0,
        materializedCells: 0,
      }),
    });
  } catch (error) {
    if (isTimeoutError(error)) return workerFault("TIMEOUT");
    if (isMemoryLimitError(error)) return workerFault("MEMORY_LIMIT");
    return workerFault("RUNTIME_ERROR");
  } finally {
    isolate?.dispose();
  }
}

async function handleMessage(message: unknown): Promise<void> {
  if (!isWorkerRequestEnvelope(message) || process.send === undefined) return;

  const response = await executeRequest(message.request);
  const envelope: WorkerResponseEnvelope = Object.freeze({
    requestId: message.requestId,
    response,
    rssBytes: process.memoryUsage().rss,
  });

  process.send(envelope);
}

let busy = false;
process.on("message", (message: unknown) => {
  if (busy) {
    process.abort();
  }
  busy = true;
  void handleMessage(message).finally(() => {
    busy = false;
  });
});