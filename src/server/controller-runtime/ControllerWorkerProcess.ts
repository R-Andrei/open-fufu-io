import { randomUUID } from "node:crypto";
import { writeSync } from "node:fs";

import ivm from "isolated-vm";

import type { CellId, CellSelector, SegmentId, TerrainType } from "../../core/controller/ControllerApi";
import {
  validateProductionControllerOutput,
  type ControllerWorkerRequest,
  type ControllerWorkerResponse,
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
      operation: "CELLS_DISTANCE";
      args: readonly [CellId, CellId];
    }>
  | Readonly<{ operation: "SEGMENTS_GET"; args: readonly [SegmentId] }>
  | Readonly<{ operation: "SEGMENTS_LIST"; args: readonly [] }>;

type WorkerStaticSpatialSnapshot = Readonly<{
  cacheKey: number;
  width: number;
  height: number;
  cellCount: number;
  terrainCodes: Uint8Array;
  segmentIds: Uint16Array;
  segmentCount: number;
}>;

type WorkerOwnershipSnapshot = Readonly<{
  factionIds: readonly string[];
  ownerCodes: Uint32Array;
}>;

type WorkerPublicSpatialUpdate = Readonly<{
  cacheKey: number;
  ownershipCacheKey: number;
  static?: WorkerStaticSpatialSnapshot;
  ownership?: WorkerOwnershipSnapshot;
}>;

type WorkerRequestEnvelope = Readonly<{
  requestId: number;
  request: ControllerWorkerRequest;
  publicSpatial?: WorkerPublicSpatialUpdate;
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

type WorkerPublicSpatialCache = Readonly<{
  cacheKey: number;
  ownershipCacheKey: number;
  width: number;
  height: number;
  cellCount: number;
  terrainCodes: Uint8Array;
  segmentIds: Uint16Array;
  segmentCount: number;
  segmentOffsets: Uint32Array;
  segmentCells: Uint32Array;
  factionIds: readonly string[];
  ownerCodes: Uint32Array;
}>;

const CATASTROPHIC_FAULT_FD = 4;
const NO_SEGMENT_ID = 0xffff;
const NO_PUBLIC_TERRAIN = 0xff;
const PUBLIC_TERRAIN_ORDER = Object.freeze([
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
  "SHALLOW_WATER",
  "DEEP_WATER",
  "IMPASSABLE",
] as const satisfies readonly TerrainType[]);

const hardenGlobalSource = `
  "use strict";

  (() => {
    const __openFufuSetHas = Function.prototype.call.bind(Set.prototype.has);
    const __openFufuSetAdd = Function.prototype.call.bind(Set.prototype.add);
    const __openFufuSetDelete = Function.prototype.call.bind(Set.prototype.delete);
    const __openFufuHasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
    const __openFufuDefineProperty = Object.defineProperty;
    const __openFufuGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    const __openFufuReflectConstruct = Reflect.construct;
    const __openFufuNumberIsFinite = Number.isFinite;
    let __openFufuAllocatorFaulted = false;

    const __openFufuIsAllocatorFailure = (error) =>
      error !== null &&
      typeof error === "object" &&
      error.message === "Array buffer allocation failed";

    const __openFufuWrapAllocatorConstructor = (name) => {
      const NativeConstructor = globalThis[name];
      if (typeof NativeConstructor !== "function") return;

      const WrappedConstructor = new Proxy(NativeConstructor, {
        construct(target, args, newTarget) {
          try {
            return __openFufuReflectConstruct(target, args, newTarget);
          } catch (error) {
            if (
              newTarget === WrappedConstructor &&
              args.length === 1 &&
              typeof args[0] === "number" &&
              __openFufuNumberIsFinite(args[0]) &&
              args[0] >= 0 &&
              __openFufuIsAllocatorFailure(error)
            ) {
              __openFufuAllocatorFaulted = true;
            }
            throw error;
          }
        }
      });

      __openFufuDefineProperty(globalThis, name, {
        value: WrappedConstructor,
        writable: false,
        configurable: false,
        enumerable: false
      });

      const prototype = NativeConstructor.prototype;
      if (prototype !== undefined && prototype !== null) {
        const constructorDescriptor = __openFufuGetOwnPropertyDescriptor(
          prototype,
          "constructor"
        );
        if (
          constructorDescriptor !== undefined &&
          constructorDescriptor.configurable
        ) {
          __openFufuDefineProperty(prototype, "constructor", {
            ...constructorDescriptor,
            value: WrappedConstructor
          });
        }
      }
    };

    for (const name of [
      "ArrayBuffer",
      "SharedArrayBuffer",
      "Int8Array",
      "Uint8Array",
      "Uint8ClampedArray",
      "Int16Array",
      "Uint16Array",
      "Int32Array",
      "Uint32Array",
      "Float16Array",
      "Float32Array",
      "Float64Array",
      "BigInt64Array",
      "BigUint64Array"
    ]) {
      __openFufuWrapAllocatorConstructor(name);
    }

    const __openFufuPrimordials = Object.freeze({
      freeze: Object.freeze,
      keys: Object.keys,
      is: Object.is,
      isArray: Array.isArray,
      numberIsFinite: __openFufuNumberIsFinite,
      reflectOwnKeys: Reflect.ownKeys,
      hasOwn: __openFufuHasOwn,
      SetCtor: Set,
      setHas: __openFufuSetHas,
      setAdd: __openFufuSetAdd,
      setDelete: __openFufuSetDelete
    });

    __openFufuDefineProperty(globalThis, "__openFufuPrimordials", {
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
      __openFufuDefineProperty(globalThis, name, {
        value: undefined,
        writable: false,
        configurable: false,
        enumerable: false
      });
    }

    if (typeof Intl === "object" && Intl !== null) {
      __openFufuDefineProperty(Intl, "DateTimeFormat", {
        value: undefined,
        writable: false,
        configurable: false,
        enumerable: false
      });
    }

    __openFufuDefineProperty(Math, "random", {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: false
    });

    return () => __openFufuAllocatorFaulted;
  })();
`;

const invokeEntrypointSource = `
  "use strict";
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

  const localSpatial = (operation, args) => {
    const value = $2.applySync(
      undefined,
      [{ operation, args }],
      {
        arguments: { copy: true },
        result: { copy: true }
      }
    );
    return deepFreeze(value);
  };

  const hasLocalSpatial = $3 === true;
  const input = deepFreeze({
    ...globalThis.__openFufuInput,
    ...(hasLocalSpatial
      ? {
          map: {
            width: localSpatial("MAP_WIDTH", []),
            height: localSpatial("MAP_HEIGHT", []),
            cellCount: localSpatial("MAP_CELL_COUNT", []),
            isValidCellId: (id) => localSpatial("MAP_IS_VALID_CELL_ID", [id]),
            cellIdAt: (x, y) => localSpatial("MAP_CELL_ID_AT", [x, y]),
            positionOf: (id) => localSpatial("MAP_POSITION_OF", [id]),
            terrainAt: (id) => localSpatial("MAP_TERRAIN_AT", [id]),
            segmentIdOf: (id) => localSpatial("MAP_SEGMENT_ID_OF", [id]),
            cardinalNeighbors: (id) => localSpatial("MAP_CARDINAL_NEIGHBORS", [id])
          }
        }
      : {}),
    cells: {
      ...(hasLocalSpatial
        ? { owner: (id) => localSpatial("CELL_OWNER", [id]) }
        : {}),
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
      distance: (a, b) => hostQuery("CELLS_DISTANCE", [a, b])
    },
    segments: {
      get: (id) => hostQuery("SEGMENTS_GET", [id]),
      list: () => hostQuery("SEGMENTS_LIST", []),
      cells: (id) => deepFreeze({ kind: "SEGMENT", segmentId: id }),
      ...(hasLocalSpatial
        ? { cellIds: (id) => localSpatial("SEGMENT_CELL_IDS", [id]) }
        : {})
    }
  });

  return (async () => {
    let output;
    try {
      output = await $0(input);
    } catch {
      return { status: "RUNTIME_ERROR" };
    }

    if (output === undefined) return { status: "OK" };
    try {
      return { status: "OK", output: materialize(output) };
    } catch {
      return { status: "INVALID_OUTPUT" };
    }
  })();
`;

class ModuleInitializationTimeoutError extends Error {
  constructor() {
    super("controller module initialization timed out");
    this.name = "ModuleInitializationTimeoutError";
  }
}

let activeRequestId: number | undefined;
let nextQueryId = 1;
const pendingQueries = new Map<number, PendingQuery>();
let publicSpatialCache: WorkerPublicSpatialCache | undefined;

function workerFault(
  fault: Extract<ControllerWorkerResponse, { ok: false }>["fault"],
): ControllerWorkerResponse {
  return Object.freeze({ ok: false as const, fault });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timed out/i.test(error.message);
}

function isMemoryLimitMessage(message: string): boolean {
  return /memory limit|out[- ]of[- ]memory/i.test(message);
}

function isMemoryLimitError(error: unknown): boolean {
  return error instanceof Error && isMemoryLimitMessage(error.message);
}

async function hasAllocatorMemoryFault(
  probe: ivm.Reference<() => boolean>,
): Promise<boolean> {
  return (
    (await probe.apply(undefined, [], {
      result: { copy: true },
    })) === true
  );
}

function reportCatastrophicMemoryLimit(): void {
  try {
    writeSync(CATASTROPHIC_FAULT_FD, "1");
  } catch {
    // The worker still aborts; the parent will fall back to WORKER_DIED.
  }
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
  return Number.isInteger(value.requestId) && isPlainRecord(value.request);
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

function buildSegmentIndex(
  membership: Uint16Array,
  segmentCount: number,
): Readonly<{ offsets: Uint32Array; cells: Uint32Array }> {
  const offsets = new Uint32Array(segmentCount + 1);
  for (let cellId = 0; cellId < membership.length; cellId += 1) {
    const segmentId = membership[cellId]!;
    if (segmentId === NO_SEGMENT_ID) continue;
    if (segmentId >= segmentCount) {
      throw new Error("controller public Segment membership is invalid");
    }
    offsets[segmentId + 1] += 1;
  }
  for (let segmentId = 0; segmentId < segmentCount; segmentId += 1) {
    offsets[segmentId + 1] += offsets[segmentId]!;
  }
  const cursor = offsets.slice(0, segmentCount);
  const cells = new Uint32Array(offsets[segmentCount]!);
  for (let cellId = 0; cellId < membership.length; cellId += 1) {
    const segmentId = membership[cellId]!;
    if (segmentId === NO_SEGMENT_ID) continue;
    cells[cursor[segmentId]!] = cellId;
    cursor[segmentId] += 1;
  }
  return Object.freeze({ offsets, cells });
}

function installPublicSpatialUpdate(
  update: WorkerPublicSpatialUpdate | undefined,
): number | undefined {
  if (update === undefined) return undefined;
  if (!Number.isSafeInteger(update.cacheKey) || update.cacheKey <= 0) {
    throw new Error("controller public spatial cache key is invalid");
  }
  if (
    !Number.isSafeInteger(update.ownershipCacheKey) ||
    update.ownershipCacheKey <= 0
  ) {
    throw new Error("controller public ownership cache key is invalid");
  }

  if (update.static !== undefined) {
    const incoming = update.static;
    if (
      incoming.cacheKey !== update.cacheKey ||
      !Number.isSafeInteger(incoming.width) ||
      incoming.width <= 0 ||
      !Number.isSafeInteger(incoming.height) ||
      incoming.height <= 0 ||
      !Number.isSafeInteger(incoming.cellCount) ||
      incoming.cellCount !== incoming.width * incoming.height ||
      !(incoming.terrainCodes instanceof Uint8Array) ||
      incoming.terrainCodes.length !== incoming.cellCount ||
      !(incoming.segmentIds instanceof Uint16Array) ||
      incoming.segmentIds.length !== incoming.cellCount ||
      !Number.isSafeInteger(incoming.segmentCount) ||
      incoming.segmentCount < 0 ||
      incoming.segmentCount >= NO_SEGMENT_ID
    ) {
      throw new Error("controller public static spatial snapshot is invalid");
    }
    for (let cellId = 0; cellId < incoming.cellCount; cellId += 1) {
      const terrainCode = incoming.terrainCodes[cellId]!;
      if (
        terrainCode !== NO_PUBLIC_TERRAIN &&
        terrainCode >= PUBLIC_TERRAIN_ORDER.length
      ) {
        throw new Error("controller public terrain cache contains invalid code");
      }
      const segmentId = incoming.segmentIds[cellId]!;
      if (segmentId !== NO_SEGMENT_ID && segmentId >= incoming.segmentCount) {
        throw new Error("controller public Segment cache contains invalid membership");
      }
    }
    const segmentIndex = buildSegmentIndex(
      incoming.segmentIds,
      incoming.segmentCount,
    );
    publicSpatialCache = Object.freeze({
      cacheKey: update.cacheKey,
      ownershipCacheKey: 0,
      width: incoming.width,
      height: incoming.height,
      cellCount: incoming.cellCount,
      terrainCodes: incoming.terrainCodes,
      segmentIds: incoming.segmentIds,
      segmentCount: incoming.segmentCount,
      segmentOffsets: segmentIndex.offsets,
      segmentCells: segmentIndex.cells,
      factionIds: Object.freeze([]),
      ownerCodes: new Uint32Array(incoming.cellCount),
    });
  }

  const cache = publicSpatialCache;
  if (cache === undefined || cache.cacheKey !== update.cacheKey) {
    throw new Error("controller public spatial cache is unavailable for this request");
  }

  if (update.ownership !== undefined) {
    const ownership = update.ownership;
    if (
      !Array.isArray(ownership.factionIds) ||
      ownership.factionIds.some((id) => typeof id !== "string") ||
      !(ownership.ownerCodes instanceof Uint32Array) ||
      ownership.ownerCodes.length !== cache.cellCount
    ) {
      throw new Error("controller public ownership snapshot is invalid");
    }
    for (let cellId = 0; cellId < ownership.ownerCodes.length; cellId += 1) {
      if (ownership.ownerCodes[cellId]! > ownership.factionIds.length) {
        throw new Error("controller public ownership code is invalid");
      }
    }

    publicSpatialCache = Object.freeze({
      ...cache,
      ownershipCacheKey: update.ownershipCacheKey,
      factionIds: Object.freeze([...ownership.factionIds]),
      ownerCodes: ownership.ownerCodes,
    });
  } else if (cache.ownershipCacheKey !== update.ownershipCacheKey) {
    throw new Error("controller public ownership cache is unavailable for this request");
  }

  return update.cacheKey;
}

function activePublicSpatial(cacheKey: number | undefined): WorkerPublicSpatialCache {
  const cache = publicSpatialCache;
  if (
    cacheKey === undefined ||
    cache === undefined ||
    cache.cacheKey !== cacheKey
  ) {
    throw new Error("controller public spatial cache is not active for this invocation");
  }
  return cache;
}

function validCellId(cache: WorkerPublicSpatialCache, value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < cache.cellCount
  );
}

function resolvePublicSpatial(
  cacheKey: number | undefined,
  value: unknown,
): unknown {
  if (!isPlainRecord(value) || !Array.isArray(value.args)) {
    throw new Error("invalid controller local spatial request");
  }
  const cache = activePublicSpatial(cacheKey);
  const args = value.args;

  switch (value.operation) {
    case "MAP_WIDTH":
      if (args.length !== 0) break;
      return cache.width;
    case "MAP_HEIGHT":
      if (args.length !== 0) break;
      return cache.height;
    case "MAP_CELL_COUNT":
      if (args.length !== 0) break;
      return cache.cellCount;
    case "MAP_IS_VALID_CELL_ID":
      if (args.length !== 1) break;
      return validCellId(cache, args[0]);
    case "MAP_CELL_ID_AT": {
      if (args.length !== 2) break;
      const [x, y] = args;
      if (
        !Number.isSafeInteger(x) ||
        !Number.isSafeInteger(y) ||
        (x as number) < 0 ||
        (x as number) >= cache.width ||
        (y as number) < 0 ||
        (y as number) >= cache.height
      ) {
        return undefined;
      }
      return (y as number) * cache.width + (x as number);
    }
    case "MAP_POSITION_OF": {
      if (args.length !== 1 || !validCellId(cache, args[0])) return undefined;
      const cellId = args[0];
      return { x: cellId % cache.width, y: Math.floor(cellId / cache.width) };
    }
    case "MAP_TERRAIN_AT": {
      if (args.length !== 1 || !validCellId(cache, args[0])) return undefined;
      const code = cache.terrainCodes[args[0]]!;
      return code === NO_PUBLIC_TERRAIN ? undefined : PUBLIC_TERRAIN_ORDER[code];
    }
    case "MAP_SEGMENT_ID_OF": {
      if (args.length !== 1 || !validCellId(cache, args[0])) return undefined;
      const segmentId = cache.segmentIds[args[0]]!;
      return segmentId === NO_SEGMENT_ID ? undefined : segmentId;
    }
    case "MAP_CARDINAL_NEIGHBORS": {
      if (args.length !== 1 || !validCellId(cache, args[0])) return undefined;
      const cellId = args[0];
      const x = cellId % cache.width;
      const y = Math.floor(cellId / cache.width);
      const neighbors: number[] = [];
      if (x > 0) neighbors.push(cellId - 1);
      if (x + 1 < cache.width) neighbors.push(cellId + 1);
      if (y > 0) neighbors.push(cellId - cache.width);
      if (y + 1 < cache.height) neighbors.push(cellId + cache.width);
      neighbors.sort((left, right) => left - right);
      return neighbors;
    }
    case "CELL_OWNER": {
      if (args.length !== 1 || !validCellId(cache, args[0])) return undefined;
      const code = cache.ownerCodes[args[0]]!;
      return code === 0 ? null : cache.factionIds[code - 1];
    }
    case "SEGMENT_CELL_IDS": {
      if (
        args.length !== 1 ||
        !Number.isSafeInteger(args[0]) ||
        (args[0] as number) < 0 ||
        (args[0] as number) >= cache.segmentCount
      ) {
        return undefined;
      }
      const segmentId = args[0] as number;
      return Array.from(
        cache.segmentCells.subarray(
          cache.segmentOffsets[segmentId]!,
          cache.segmentOffsets[segmentId + 1]!,
        ),
      );
    }
  }
  throw new Error("invalid controller local spatial request");
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
    exportName: `__openFufuModuleCompletion_${token.replace(/-/g, "_")}`,
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
  requestId: number,
  request: ControllerWorkerRequest,
  spatialCacheKey?: number,
): Promise<ControllerWorkerResponse> {
  let isolate: ivm.Isolate | undefined;
  let queryReference: ivm.Reference | undefined;
  let spatialReference: ivm.Reference | undefined;

  try {
    isolate = new ivm.Isolate({
      memoryLimit: request.isolateMemoryMb,
      onCatastrophicError: (message) => {
        if (isMemoryLimitMessage(message)) {
          reportCatastrophicMemoryLimit();
        }
        process.abort();
      },
    });
    const context = await isolate.createContext();

    const hardenScript = await isolate.compileScript(hardenGlobalSource);
    const hardenResult = await hardenScript.run(context, {
      timeout: request.moduleEvaluationTimeoutMs,
      reference: true,
    });
    if (
      !(hardenResult instanceof ivm.Reference) ||
      hardenResult.typeof !== "function"
    ) {
      return workerFault("RUNTIME_ERROR");
    }
    const allocatorFaultProbe = hardenResult as ivm.Reference<() => boolean>;

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
      if (await hasAllocatorMemoryFault(allocatorFaultProbe)) {
        return workerFault("MEMORY_LIMIT");
      }
      return workerFault("RUNTIME_ERROR");
    }

    if (await hasAllocatorMemoryFault(allocatorFaultProbe)) {
      return workerFault("MEMORY_LIMIT");
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
    spatialReference = new ivm.Reference((query: unknown) =>
      resolvePublicSpatial(spatialCacheKey, query),
    );

    let invocationResult: unknown;
    try {
      invocationResult = await context.evalClosure(
        invokeEntrypointSource,
        [
          entrypoint.derefInto(),
          queryReference,
          spatialReference,
          spatialCacheKey !== undefined,
        ],
        {
          timeout: request.timeoutMs,
          result: { promise: true, copy: true },
        },
      );
    } catch (error) {
      if (isTimeoutError(error)) return workerFault("TIMEOUT");
      if (isMemoryLimitError(error)) return workerFault("MEMORY_LIMIT");
      if (await hasAllocatorMemoryFault(allocatorFaultProbe)) {
        return workerFault("MEMORY_LIMIT");
      }
      return workerFault("INVALID_OUTPUT");
    }

    if (await hasAllocatorMemoryFault(allocatorFaultProbe)) {
      return workerFault("MEMORY_LIMIT");
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
    spatialReference?.release();
    queryReference?.release();
    if (isolate !== undefined && !isolate.isDisposed) {
      isolate.dispose();
    }
  }
}

async function handleInvocation(message: WorkerRequestEnvelope): Promise<void> {
  if (process.send === undefined) return;

  let spatialCacheKey: number | undefined;
  let response: ControllerWorkerResponse;
  try {
    spatialCacheKey = installPublicSpatialUpdate(message.publicSpatial);
    response = await executeRequest(
      message.requestId,
      message.request,
      spatialCacheKey,
    );
  } catch {
    response = workerFault("RUNTIME_ERROR");
  }
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