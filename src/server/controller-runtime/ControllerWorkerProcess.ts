import ivm from "isolated-vm";

import type { CellId, CellSelector, SegmentId } from "../../core/controller/ControllerApi";
import type {
  ControllerWorkerRequest,
  ControllerWorkerResponse,
} from "./ProductionControllerHost";

type ControllerWorkerQueryRequest =
  | Readonly<{ operation: "CELLS_GET"; args: readonly [CellId] }>
  | Readonly<{
      operation: "CELLS_QUERY";
      args: readonly [CellSelector, number?];
    }>
  | Readonly<{ operation: "CELLS_COUNT"; args: readonly [CellSelector] }>
  | Readonly<{ operation: "CELLS_NEIGHBORS"; args: readonly [CellId] }>
  | Readonly<{
      operation: "CELLS_BOUNDARY";
      args: readonly [CellSelector, number?];
    }>
  | Readonly<{
      operation: "CELLS_CONNECTED_COMPONENTS";
      args: readonly [CellSelector];
    }>
  | Readonly<{
      operation: "CELLS_DISTANCE";
      args: readonly [CellId, CellId];
    }>
  | Readonly<{ operation: "SEGMENTS_GET"; args: readonly [SegmentId] }>
  | Readonly<{ operation: "SEGMENTS_LIST"; args: readonly [] }>;

type WorkerRequestEnvelope = Readonly<{
  requestId: number;
  request: ControllerWorkerRequest;
}>;

type WorkerQueryEnvelope = Readonly<{
  requestId: number;
  queryId: number;
  query: ControllerWorkerQueryRequest;
}>;

type WorkerQueryResultEnvelope = Readonly<{
  requestId: number;
  queryId: number;
  result:
    | Readonly<{ ok: true; value?: unknown }>
    | Readonly<{ ok: false }>;
}>;

type WorkerResponseEnvelope = Readonly<{
  requestId: number;
  response: ControllerWorkerResponse;
  rssBytes: number;
}>;

type PendingQuery = Readonly<{
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
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
  "use strict";
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

  const hostQuery = async (operation, args) => {
    const value = await $1.apply(
      undefined,
      [{ operation, args }],
      {
        arguments: { copy: true },
        result: { promise: true, copy: true }
      }
    );
    return deepFreeze(value);
  };

  const input = deepFreeze({
    ...globalThis.__openFufuInput,
    cells: {
      get: (id) => hostQuery("CELLS_GET", [id]),
      query: (selector, limit) =>
        limit === undefined
          ? hostQuery("CELLS_QUERY", [selector])
          : hostQuery("CELLS_QUERY", [selector, limit]),
      count: (selector) => hostQuery("CELLS_COUNT", [selector]),
      neighbors: (id) => hostQuery("CELLS_NEIGHBORS", [id]),
      boundary: (selector, limit) =>
        limit === undefined
          ? hostQuery("CELLS_BOUNDARY", [selector])
          : hostQuery("CELLS_BOUNDARY", [selector, limit]),
      connectedComponents: (selector) =>
        hostQuery("CELLS_CONNECTED_COMPONENTS", [selector]),
      distance: (a, b) => hostQuery("CELLS_DISTANCE", [a, b])
    },
    segments: {
      get: (id) => hostQuery("SEGMENTS_GET", [id]),
      list: () => hostQuery("SEGMENTS_LIST", []),
      cells: (id) => deepFreeze({ kind: "SEGMENT", segmentId: id })
    }
  });

  return (async () => {
    let output;
    try {
      output = await $0(input);
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
  })();
`;

let activeRequestId: number | undefined;
let nextQueryId = 1;
const pendingQueries = new Map<number, PendingQuery>();

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSelectorArgument(value: unknown): value is CellSelector {
  return isPlainRecord(value) && typeof value.kind === "string";
}

function isControllerWorkerQueryRequest(
  value: unknown,
): value is ControllerWorkerQueryRequest {
  if (!isPlainRecord(value) || !Array.isArray(value.args)) return false;
  const args = value.args;

  switch (value.operation) {
    case "CELLS_GET":
    case "CELLS_NEIGHBORS":
    case "SEGMENTS_GET":
      return args.length === 1 && typeof args[0] === "number";
    case "CELLS_QUERY":
    case "CELLS_BOUNDARY":
      return (
        (args.length === 1 || args.length === 2) &&
        isSelectorArgument(args[0]) &&
        (args.length === 1 || typeof args[1] === "number")
      );
    case "CELLS_COUNT":
    case "CELLS_CONNECTED_COMPONENTS":
      return args.length === 1 && isSelectorArgument(args[0]);
    case "CELLS_DISTANCE":
      return (
        args.length === 2 &&
        typeof args[0] === "number" &&
        typeof args[1] === "number"
      );
    case "SEGMENTS_LIST":
      return args.length === 0;
    default:
      return false;
  }
}

function isWorkerRequestEnvelope(value: unknown): value is WorkerRequestEnvelope {
  if (!isPlainRecord(value)) return false;
  return (
    Number.isInteger(value.requestId) &&
    isPlainRecord(value.request)
  );
}

function isWorkerQueryResultEnvelope(
  value: unknown,
): value is WorkerQueryResultEnvelope {
  if (!isPlainRecord(value) || !isPlainRecord(value.result)) return false;
  return (
    Number.isInteger(value.requestId) &&
    Number.isInteger(value.queryId) &&
    (value.queryId as number) > 0 &&
    typeof value.result.ok === "boolean"
  );
}

function requestHostQuery(
  requestId: number,
  query: ControllerWorkerQueryRequest,
): Promise<unknown> {
  if (process.send === undefined || activeRequestId !== requestId) {
    return Promise.reject(new Error("controller query channel unavailable"));
  }

  const queryId = nextQueryId;
  nextQueryId += 1;
  const envelope: WorkerQueryEnvelope = Object.freeze({
    requestId,
    queryId,
    query,
  });

  return new Promise((resolve, reject) => {
    pendingQueries.set(queryId, Object.freeze({ resolve, reject }));
    try {
      process.send?.(envelope, (error) => {
        if (error === null) return;
        const pending = pendingQueries.get(queryId);
        if (pending === undefined) return;
        pendingQueries.delete(queryId);
        pending.reject(new Error("controller query channel failed"));
      });
    } catch {
      pendingQueries.delete(queryId);
      reject(new Error("controller query channel failed"));
    }
  });
}

function settleQueryResult(message: WorkerQueryResultEnvelope): void {
  if (activeRequestId !== message.requestId) return;
  const pending = pendingQueries.get(message.queryId);
  if (pending === undefined) return;
  pendingQueries.delete(message.queryId);
  if (message.result.ok) {
    pending.resolve(message.result.value);
  } else {
    pending.reject(new Error("controller query failed"));
  }
}

async function executeRequest(
  requestId: number,
  request: ControllerWorkerRequest,
): Promise<ControllerWorkerResponse> {
  let isolate: ivm.Isolate | undefined;
  let queryReference: ivm.Reference | undefined;

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

    queryReference = new ivm.Reference((query: unknown) => {
      if (!isControllerWorkerQueryRequest(query)) {
        return Promise.reject(new Error("invalid controller query"));
      }
      return requestHostQuery(requestId, query);
    });

    let invocationStatus: unknown;
    try {
      invocationStatus = await context.evalClosure(
        invokeEntrypointSource,
        [entrypoint.derefInto(), queryReference],
        {
          timeout: request.timeoutMs,
          result: { promise: true, copy: true },
        },
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
    queryReference?.release();
    isolate?.dispose();
  }
}

async function handleInvocation(message: WorkerRequestEnvelope): Promise<void> {
  if (process.send === undefined) return;

  const response = await executeRequest(message.requestId, message.request);
  const envelope: WorkerResponseEnvelope = Object.freeze({
    requestId: message.requestId,
    response,
    rssBytes: process.memoryUsage().rss,
  });

  process.send(envelope);
}

let busy = false;
process.on("message", (message: unknown) => {
  if (isWorkerQueryResultEnvelope(message)) {
    settleQueryResult(message);
    return;
  }

  if (!isWorkerRequestEnvelope(message)) return;
  if (busy) {
    process.abort();
  }

  busy = true;
  activeRequestId = message.requestId;
  nextQueryId = 1;
  pendingQueries.clear();

  void handleInvocation(message).finally(() => {
    pendingQueries.clear();
    activeRequestId = undefined;
    busy = false;
  });
});
