import ivm from "isolated-vm";

import type {
  ControllerWorkerRequest,
  ControllerWorkerResponse,
} from "./ProductionControllerHost";

type WorkerRequestEnvelope = Readonly<{
  requestId: number;
  request: ControllerWorkerRequest;
}>;

type WorkerResponseEnvelope = Readonly<{
  requestId: number;
  response: ControllerWorkerResponse;
}>;

const hardenGlobalSource = `
  "use strict";
  for (const name of [
    "process",
    "require",
    "Buffer",
    "fetch",
    "WebSocket",
    "Date",
    "performance",
    "crypto"
  ]) {
    Object.defineProperty(globalThis, name, {
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
  const deepFreeze = (value, seen = new Set()) => {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) {
      return value;
    }
    if (seen.has(value)) return value;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(value[key], seen);
    }
    return Object.freeze(value);
  };

  const input = deepFreeze(globalThis.__openFufuInput);
  let output;
  try {
    output = $0(input);
  } catch {
    return "RUNTIME_ERROR";
  }

  try {
    Object.defineProperty(globalThis, "__openFufuResult", {
      value: output,
      writable: false,
      configurable: true,
      enumerable: false
    });
  } catch {
    return "RUNTIME_ERROR";
  }
  return "OK";
`;

function workerFault(
  fault: Extract<ControllerWorkerResponse, { ok: false }>['fault'],
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
  return Number.isInteger(record.requestId) && record.request !== null && typeof record.request === "object";
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

    const module = await isolate.compileModule(request.artifact.moduleSource, {
      filename: `open-fufu-controller:${request.factionId}`,
    });

    if (module.dependencySpecifiers.length !== 0) {
      return workerFault("SANDBOX_VIOLATION");
    }

    await module.instantiate(context, () => {
      throw new Error("controller module imports are forbidden");
    });

    try {
      await module.evaluate({
        timeout: request.moduleEvaluationTimeoutMs,
      });
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

    let invocationStatus: unknown;
    try {
      invocationStatus = await context.evalClosure(
        invokeEntrypointSource,
        [entrypoint.derefInto()],
        { timeout: request.timeoutMs },
      );
    } catch (error) {
      if (isTimeoutError(error)) return workerFault("TIMEOUT");
      if (isMemoryLimitError(error)) return workerFault("MEMORY_LIMIT");
      return workerFault("RUNTIME_ERROR");
    }

    if (invocationStatus !== "OK") {
      return workerFault("RUNTIME_ERROR");
    }

    let output: unknown;
    try {
      output = await context.global.get("__openFufuResult", { copy: true });
    } catch {
      return workerFault("INVALID_OUTPUT");
    }

    return Object.freeze({
      ok: true as const,
      output,
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
