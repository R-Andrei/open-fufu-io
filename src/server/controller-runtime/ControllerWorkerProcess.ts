import {
  randomUUID } from "node:crypto";
import { writeSync } from "node:fs";

import ivm from "isolated-vm";

import type {
  CellId,
  CellSelector,
  FactionFindFilter,
  FactionReadView,
  SegmentId,
  StructureFindFilter,
  StructureType,
  StructureLocator,
  TerrainType,
  PurchasableUnitType,
  UnitFindFilter,
  UnitLocator,
} from "../../core/controller/ControllerApi";
import {
  PRODUCTION_CONTROLLER_LIMITS,
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
  | Readonly<{ operation: "SEGMENTS_LIST"; args: readonly [] }>
  | Readonly<{ operation: "UNITS_GET"; args: readonly [UnitLocator] }>
  | Readonly<{ operation: "UNITS_FIND"; args: readonly [UnitFindFilter?] }>
  | Readonly<{ operation: "UNITS_COUNT"; args: readonly [UnitFindFilter?] }>
  | Readonly<{
      operation: "UNITS_CHECK_BUILD";
      args: readonly [PurchasableUnitType, StructureLocator, CellId];
    }>
  | Readonly<{ operation: "STRUCTURES_GET"; args: readonly [StructureLocator] }>
  | Readonly<{
      operation: "STRUCTURES_FIND";
      args: readonly [StructureFindFilter?];
    }>
  | Readonly<{
      operation: "STRUCTURES_COUNT";
      args: readonly [StructureFindFilter?];
    }>
  | Readonly<{
      operation: "STRUCTURES_CHECK_BUILD";
      args: readonly [StructureType, CellId];
    }>
  | Readonly<{
      operation: "STRUCTURES_CHECK_UPGRADE";
      args: readonly [StructureLocator];
    }>;

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

type WorkerPublicFactionEntry = Readonly<{
  ref: string;
  displayName: string;
  status: FactionReadView["status"];
  relation: FactionReadView["relation"];
  territoryCells: number;
  isMinorFaction: boolean;
  origin?: NonNullable<FactionReadView["origin"]>;
  score?: number;
  ownerCode?: number;
  teamId?: string;
}>;

type WorkerPublicFactionSnapshot = Readonly<{
  requesterOwnerCode?: number;
  entries: readonly WorkerPublicFactionEntry[];
}>;

type WorkerPublicOperationSnapshot = Readonly<{
  entries: readonly Readonly<{ direction: "OWN" | "INCOMING"; view: Readonly<Record<string, unknown>> }>[];
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
  publicFactions?: WorkerPublicFactionSnapshot;
  publicOperations?: WorkerPublicOperationSnapshot;
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
    const __openFufuPromiseResolve = Promise.resolve.bind(Promise);
    const __openFufuPromiseThen = Function.prototype.call.bind(Promise.prototype.then);
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
      setDelete: __openFufuSetDelete,
      promiseResolve: __openFufuPromiseResolve,
      promiseThen: __openFufuPromiseThen
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

    if (typeof Atomics === "object" && Atomics !== null) {
      for (const name of ["wait", "waitAsync"]) {
        __openFufuDefineProperty(Atomics, name, {
          value: undefined,
          writable: false,
          configurable: false,
          enumerable: false
        });
      }
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

  let nextActionOrdinal = 1;
  const stagedActions = [];
  const stageAction = (kind, payload = {}) => {
    const actionRef = "action_" + nextActionOrdinal;
    nextActionOrdinal += 1;
    const action = deepFreeze({
      kind,
      actionRef,
      ...materialize(payload)
    });
    stagedActions.push(action);
    return actionRef;
  };

  let queryCount = 0;
  const consumeQuery = () => {
    if (queryCount >= $5) throw new Error("controller query budget exhausted");
    queryCount += 1;
  };

  let hostQuerySequence = 0;
  let hostQuerySettlement = primordials.promiseResolve();
  const hostQuery = (operation, args) => {
    consumeQuery();
    hostQuerySequence += 1;
    const bridgeResult = $1.apply(
      undefined,
      [{ sequence: hostQuerySequence, operation, args }],
      {
        arguments: { copy: true },
        result: { promise: true, copy: true }
      }
    );
    const orderedResult = primordials.promiseThen(
      hostQuerySettlement,
      () => bridgeResult
    );
    const frozenResult = primordials.promiseThen(
      orderedResult,
      (value) => deepFreeze(value)
    );
    hostQuerySettlement = primordials.promiseThen(
      frozenResult,
      () => undefined,
      () => undefined
    );
    return frozenResult;
  };

  const hostCheck = (operation, args) => {
    consumeQuery();
    hostQuerySequence += 1;
    const value = $7.applySyncPromise(
      undefined,
      [{ sequence: hostQuerySequence, operation, args }],
      {
        arguments: { copy: true }
      }
    );
    return deepFreeze(value);
  };

  const localRead = (operation, args) => {
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
  const localSpatial = (operation, args) => localRead(operation, args);
  const localFaction = (operation, args) => {
    consumeQuery();
    return localRead(operation, args);
  };
  const localOperation = (operation, args) => {
    consumeQuery();
    return localRead(operation, args);
  };

  const hasLocalSpatial = $3 === true;
  const hasEntityReads = $4 === true;
  const hasOperationReads = $6 === true;
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
    },
    ...(hasOperationReads
      ? {
          operations: {
            get: (ref) => localOperation("OPERATIONS_GET", [ref]),
            own: () => localOperation("OPERATIONS_OWN", []),
            incoming: () => localOperation("OPERATIONS_INCOMING", [])
          }
        }
      : {}),
    ...(hasEntityReads
      ? {
          factions: {
            get: (ref) => localFaction("FACTIONS_GET", [ref]),
            find: (filter) =>
              filter === undefined
                ? localFaction("FACTIONS_FIND", [])
                : localFaction("FACTIONS_FIND", [filter]),
            proximity: (ref) => localFaction("FACTIONS_PROXIMITY", [ref])
          },
          units: {
            get: (locator) => hostQuery("UNITS_GET", [locator]),
            find: (filter) =>
              filter === undefined
                ? hostQuery("UNITS_FIND", [])
                : hostQuery("UNITS_FIND", [filter]),
            count: (filter) =>
              filter === undefined
                ? hostQuery("UNITS_COUNT", [])
                : hostQuery("UNITS_COUNT", [filter]),
            build: (unit, producer, destination) =>
              stageAction("BUILD_UNIT", { unit, producer, destination }),
            move: (unit, destination) =>
              stageAction("MOVE_UNIT", { unit, destination }),
            checkBuild: (unit, producer, destination) =>
              hostCheck("UNITS_CHECK_BUILD", [unit, producer, destination])
          },
          structures: {
            get: (locator) => hostQuery("STRUCTURES_GET", [locator]),
            find: (filter) =>
              filter === undefined
                ? hostQuery("STRUCTURES_FIND", [])
                : hostQuery("STRUCTURES_FIND", [filter]),
            count: (filter) =>
              filter === undefined
                ? hostQuery("STRUCTURES_COUNT", [])
                : hostQuery("STRUCTURES_COUNT", [filter]),
            build: (structure, cellId) =>
              stageAction("BUILD_STRUCTURE", { structure, cellId }),
            upgrade: (structure) =>
              stageAction("UPGRADE_STRUCTURE", { structure }),
            checkBuild: (structure, cellId) =>
              hostCheck("STRUCTURES_CHECK_BUILD", [structure, cellId]),
            checkUpgrade: (structure) =>
              hostCheck("STRUCTURES_CHECK_UPGRADE", [structure])
          }
        }
      : {}),
    transports: {
      embark: (sourceCellId, targetCellId, population) =>
        stageAction("EMBARK_TRANSPORT", { sourceCellId, targetCellId, population }),
      recall: (unit) => stageAction("RETURN_TRANSPORT", { unit })
    },
    weapons: {
      launch: (launcher, weapon, targetCellId, targetFaction) =>
        stageAction("LAUNCH_WEAPON", {
          launcher,
          weapon,
          targetCellId,
          ...(targetFaction === undefined ? {} : { targetFaction })
        })
    },
    territory: {
      relinquish: (cells) => stageAction("RELINQUISH", { cells })
    },
    team: {
      signal: (channel, payload) =>
        stageAction("TEAM_SIGNAL", { channel, payload })
    },
    capitulate: () => stageAction("CAPITULATE")
  });

  return (async () => {
    let output;
    try {
      output = await $0(input);
    } catch {
      return { status: "RUNTIME_ERROR", queries: queryCount };
    }

    if (output === undefined) {
      return {
        status: "OK",
        queries: queryCount,
        stagedActions: materialize(stagedActions)
      };
    }
    try {
      return {
        status: "OK",
        queries: queryCount,
        stagedActions: materialize(stagedActions),
        output: materialize(output)
      };
    } catch {
      return { status: "INVALID_OUTPUT", queries: queryCount };
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

function isEntityFilterArgument(
  value: unknown,
): value is UnitFindFilter | StructureFindFilter {
  return isPlainRecord(value);
}

function isUnitLocatorArgument(value: unknown): value is UnitLocator {
  return (
    isPlainRecord(value) &&
    ((typeof value.ref === "string" &&
      !Object.prototype.hasOwnProperty.call(value, "cellId")) ||
      (typeof value.cellId === "number" &&
        !Object.prototype.hasOwnProperty.call(value, "ref")))
  );
}

function isStructureLocatorArgument(value: unknown): value is StructureLocator {
  return isUnitLocatorArgument(value) as boolean;
}

function isOptionalEntityFilterArgs(args: readonly unknown[]): boolean {
  return (
    args.length === 0 || (args.length === 1 && isEntityFilterArgument(args[0]))
  );
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
    case "UNITS_GET":
      return args.length === 1 && isUnitLocatorArgument(args[0]);
    case "UNITS_FIND":
    case "UNITS_COUNT":
    case "STRUCTURES_FIND":
    case "STRUCTURES_COUNT":
      return isOptionalEntityFilterArgs(args);
    case "STRUCTURES_GET":
    case "STRUCTURES_CHECK_UPGRADE":
      return args.length === 1 && isStructureLocatorArgument(args[0]);
    case "STRUCTURES_CHECK_BUILD":
      return (
        args.length === 2 &&
        typeof args[0] === "string" &&
        typeof args[1] === "number"
      );
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
  queryId: number,
  query: ControllerWorkerQueryRequest,
): Promise<unknown> {
  if (process.send === undefined || activeRequestId !== requestId) {
    return Promise.reject(new Error("controller query channel unavailable"));
  }

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

function validatePublicOrigin(
  value: unknown,
): NonNullable<FactionReadView["origin"]> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value)) {
    throw new Error("controller public faction Origin is invalid");
  }
  const allowed = new Set([
    "id",
    "displayName",
    "version",
    "positiveTraitIds",
    "negativeTraitIds",
  ]);
  if (
    Object.keys(value).some((key) => !allowed.has(key)) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.displayName !== "string" ||
    value.displayName.length === 0 ||
    typeof value.version !== "string" ||
    value.version.length === 0 ||
    !Array.isArray(value.positiveTraitIds) ||
    value.positiveTraitIds.some((traitId) => typeof traitId !== "string") ||
    !Array.isArray(value.negativeTraitIds) ||
    value.negativeTraitIds.some((traitId) => typeof traitId !== "string")
  ) {
    throw new Error("controller public faction Origin is invalid");
  }
  return Object.freeze({
    id: value.id,
    displayName: value.displayName,
    version: value.version,
    positiveTraitIds: Object.freeze([...value.positiveTraitIds]),
    negativeTraitIds: Object.freeze([...value.negativeTraitIds]),
  });
}

function validatePublicFactionSnapshot(
  value: WorkerPublicFactionSnapshot | undefined,
): WorkerPublicFactionSnapshot | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value) || !Array.isArray(value.entries)) {
    throw new Error("controller public faction snapshot is invalid");
  }
  if (
    value.requesterOwnerCode !== undefined &&
    (!Number.isSafeInteger(value.requesterOwnerCode) || value.requesterOwnerCode <= 0)
  ) {
    throw new Error("controller public faction requester code is invalid");
  }

  const refs = new Set<string>();
  const entries = value.entries.map((entry) => {
    if (!isPlainRecord(entry)) {
      throw new Error("controller public faction entry is invalid");
    }
    const allowed = new Set([
      "ref",
      "displayName",
      "status",
      "relation",
      "territoryCells",
      "isMinorFaction",
      "origin",
      "score",
      "ownerCode",
      "teamId",
    ]);
    if (Object.keys(entry).some((key) => !allowed.has(key))) {
      throw new Error("controller public faction entry exposes unsupported identity data");
    }
    if (
      typeof entry.ref !== "string" ||
      entry.ref.length === 0 ||
      refs.has(entry.ref) ||
      typeof entry.displayName !== "string" ||
      typeof entry.status !== "string" ||
      (entry.relation !== "SELF" &&
        entry.relation !== "ALLY" &&
        entry.relation !== "ENEMY") ||
      !Number.isSafeInteger(entry.territoryCells) ||
      entry.territoryCells < 0 ||
      typeof entry.isMinorFaction !== "boolean" ||
      (entry.score !== undefined &&
        (typeof entry.score !== "number" || !Number.isFinite(entry.score))) ||
      (entry.ownerCode !== undefined &&
        (!Number.isSafeInteger(entry.ownerCode) || entry.ownerCode <= 0)) ||
      (entry.teamId !== undefined && typeof entry.teamId !== "string")
    ) {
      throw new Error("controller public faction entry is invalid");
    }
    const origin = validatePublicOrigin(entry.origin);
    refs.add(entry.ref);
    return Object.freeze({
      ref: entry.ref,
      displayName: entry.displayName as string,
      status: entry.status as FactionReadView["status"],
      relation: entry.relation,
      territoryCells: entry.territoryCells as number,
      isMinorFaction: entry.isMinorFaction as boolean,
      ...(origin === undefined ? {} : { origin }),
      ...(entry.score === undefined ? {} : { score: entry.score as number }),
      ...(entry.ownerCode === undefined
        ? {}
        : { ownerCode: entry.ownerCode as number }),
      ...(entry.teamId === undefined ? {} : { teamId: entry.teamId as string }),
    });
  });

  return Object.freeze({
    ...(value.requesterOwnerCode === undefined
      ? {}
      : { requesterOwnerCode: value.requesterOwnerCode }),
    entries: Object.freeze(entries),
  });
}

function validatePublicOperationSnapshot(value: WorkerPublicOperationSnapshot | undefined): WorkerPublicOperationSnapshot | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value) || !Array.isArray(value.entries)) {
    throw new Error("controller public operation snapshot is invalid");
  }
  return Object.freeze({
    entries: Object.freeze(value.entries.map((entry) => {
      if (!isPlainRecord(entry) || (entry.direction !== "OWN" && entry.direction !== "INCOMING") || !isPlainRecord(entry.view) || typeof entry.view.ref !== "string") {
        throw new Error("controller public operation entry is invalid");
      }
      return Object.freeze({ direction: entry.direction, view: Object.freeze({ ...entry.view }) });
    })),
  });
}

function resolvePublicOperationRead(operations: WorkerPublicOperationSnapshot, value: unknown): unknown {
  if (!isPlainRecord(value) || !Array.isArray(value.args)) throw new Error("invalid controller local operation request");
  const args = value.args;
  switch (value.operation) {
    case "OPERATIONS_GET":
      if (args.length !== 1 || typeof args[0] !== "string") break;
      return operations.entries.find((entry) => entry.view.ref === args[0])?.view;
    case "OPERATIONS_OWN":
      if (args.length !== 0) break;
      return operations.entries.filter((entry) => entry.direction === "OWN").map((entry) => entry.view);
    case "OPERATIONS_INCOMING":
      if (args.length !== 0) break;
      return operations.entries.filter((entry) => entry.direction === "INCOMING").map((entry) => entry.view);
  }
  throw new Error("invalid controller local operation request");
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

function materializeFactionView(entry: WorkerPublicFactionEntry): FactionReadView {
  return Object.freeze({
    ref: entry.ref as FactionReadView["ref"],
    displayName: entry.displayName,
    status: entry.status,
    relation: entry.relation,
    territoryCells: entry.territoryCells,
    isMinorFaction: entry.isMinorFaction,
    ...(entry.origin === undefined ? {} : { origin: entry.origin }),
    ...(entry.score === undefined ? {} : { score: entry.score }),
    ...(entry.teamId === undefined ? {} : { teamId: entry.teamId }),
  });
}

function factionProximity(
  cache: WorkerPublicSpatialCache,
  factions: WorkerPublicFactionSnapshot,
  target: WorkerPublicFactionEntry,
): number | undefined {
  const requesterOwnerCode = factions.requesterOwnerCode;
  const targetOwnerCode = target.ownerCode;
  if (requesterOwnerCode === undefined || targetOwnerCode === undefined) {
    return undefined;
  }

  const requesterCells: number[] = [];
  const targetCells: number[] = [];
  for (let cellId = 0; cellId < cache.ownerCodes.length; cellId += 1) {
    const ownerCode = cache.ownerCodes[cellId]!;
    if (ownerCode === requesterOwnerCode) requesterCells.push(cellId);
    if (ownerCode === targetOwnerCode) targetCells.push(cellId);
  }
  if (requesterCells.length === 0 || targetCells.length === 0) return undefined;

  let minimum = Number.POSITIVE_INFINITY;
  for (const requesterCell of requesterCells) {
    const requesterX = requesterCell % cache.width;
    const requesterY = Math.floor(requesterCell / cache.width);
    for (const targetCell of targetCells) {
      const targetX = targetCell % cache.width;
      const targetY = Math.floor(targetCell / cache.width);
      minimum = Math.min(
        minimum,
        Math.hypot(requesterX - targetX, requesterY - targetY),
      );
    }
  }
  return minimum;
}

function resolvePublicFactionRead(
  cacheKey: number | undefined,
  factions: WorkerPublicFactionSnapshot,
  value: unknown,
): unknown {
  if (!isPlainRecord(value) || !Array.isArray(value.args)) {
    throw new Error("invalid controller local faction request");
  }
  const args = value.args;

  switch (value.operation) {
    case "FACTIONS_GET": {
      if (args.length !== 1 || typeof args[0] !== "string") break;
      const entry = factions.entries.find((candidate) => candidate.ref === args[0]);
      return entry === undefined ? undefined : materializeFactionView(entry);
    }
    case "FACTIONS_FIND": {
      if (args.length > 1 || (args.length === 1 && !isPlainRecord(args[0]))) break;
      const filter = args[0] as FactionFindFilter | undefined;
      const entries = factions.entries.filter(
        (entry) =>
          (filter?.relation === undefined || entry.relation === filter.relation) &&
          (filter?.status === undefined || entry.status === filter.status),
      );
      const cache = activePublicSpatial(cacheKey);
      entries.sort((left, right) => {
        if (filter?.orderBy === "PROXIMITY") {
          const leftDistance =
            factionProximity(cache, factions, left) ?? Number.POSITIVE_INFINITY;
          const rightDistance =
            factionProximity(cache, factions, right) ?? Number.POSITIVE_INFINITY;
          if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        }
        return left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0;
      });
      return entries.map(materializeFactionView);
    }
    case "FACTIONS_PROXIMITY": {
      if (args.length !== 1 || typeof args[0] !== "string") break;
      const target = factions.entries.find((candidate) => candidate.ref === args[0]);
      if (target === undefined) return undefined;
      return factionProximity(activePublicSpatial(cacheKey), factions, target);
    }
  }
  throw new Error("invalid controller local faction request");
}

function resolveLocalRead(
  cacheKey: number | undefined,
  factions: WorkerPublicFactionSnapshot | undefined,
  operations: WorkerPublicOperationSnapshot | undefined,
  value: unknown,
): unknown {
  if (isPlainRecord(value) && typeof value.operation === "string") {
    if (value.operation.startsWith("OPERATIONS_")) {
      if (operations === undefined) throw new Error("controller public operation snapshot is unavailable");
      return resolvePublicOperationRead(operations, value);
    }
    if (value.operation.startsWith("FACTIONS_")) {
      if (factions === undefined) {
        throw new Error("controller public faction snapshot is unavailable");
      }
      return resolvePublicFactionRead(cacheKey, factions, value);
    }
  }
  return resolvePublicSpatial(cacheKey, value);
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
  spatialCacheKey: number | undefined,
  publicFactions: WorkerPublicFactionSnapshot | undefined,
  publicOperations: WorkerPublicOperationSnapshot | undefined,
): Promise<ControllerWorkerResponse> {
  let isolate: ivm.Isolate | undefined;
  let queryReference: ivm.Reference | undefined;
  let syncQueryReference: ivm.Reference | undefined;
  let localReference: ivm.Reference | undefined;

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
      if (!isPlainRecord(query)) {
        return Promise.reject(new Error("invalid controller query"));
      }
      const sequence = query.sequence;
      if (
        !isControllerWorkerQueryRequest(query) ||
        !Number.isInteger(sequence) ||
        (sequence as number) <= 0
      ) {
        return Promise.reject(new Error("invalid controller query"));
      }
      return requestHostQuery(requestId, sequence as number, query);
    });
    syncQueryReference = new ivm.Reference(async (query: unknown) => {
      if (!isPlainRecord(query)) {
        throw new Error("invalid controller query");
      }
      const sequence = query.sequence;
      if (
        !isControllerWorkerQueryRequest(query) ||
        !Number.isInteger(sequence) ||
        (sequence as number) <= 0
      ) {
        throw new Error("invalid controller query");
      }
      const value = await requestHostQuery(requestId, sequence as number, query);
      return new ivm.ExternalCopy(value).copyInto({ release: true });
    });
    localReference = new ivm.Reference((query: unknown) =>
      resolveLocalRead(spatialCacheKey, publicFactions, publicOperations, query),
    );

    let invocationResult: unknown;
    try {
      invocationResult = await context.evalClosure(
        invokeEntrypointSource,
        [
          entrypoint.derefInto(),
          queryReference,
          localReference,
          spatialCacheKey !== undefined,
          publicFactions !== undefined,
          PRODUCTION_CONTROLLER_LIMITS.queriesPerDecision,
          publicOperations !== undefined,
          syncQueryReference,
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
    const queryCount = invocationRecord.queries;
    if (
      !Number.isSafeInteger(queryCount) ||
      (queryCount as number) < 0 ||
      (queryCount as number) > PRODUCTION_CONTROLLER_LIMITS.queriesPerDecision
    ) {
      return workerFault("RUNTIME_ERROR");
    }
    if (invocationRecord.status === "RUNTIME_ERROR") {
      return workerFault("RUNTIME_ERROR");
    }
    if (invocationRecord.status === "INVALID_OUTPUT") {
      return workerFault("INVALID_OUTPUT");
    }
    if (invocationRecord.status !== "OK") {
      return workerFault("RUNTIME_ERROR");
    }

    const stagedActions = invocationRecord.stagedActions;
    if (!Array.isArray(stagedActions)) {
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
      ...(stagedActions.length === 0
        ? {}
        : { stagedActions: Object.freeze(stagedActions) }),
      usage: Object.freeze({
        queries: queryCount as number,
        materializedCells: 0,
      }),
    });
  } catch (error) {
    if (isTimeoutError(error)) return workerFault("TIMEOUT");
    if (isMemoryLimitError(error)) return workerFault("MEMORY_LIMIT");
    return workerFault("RUNTIME_ERROR");
  } finally {
    localReference?.release();
    syncQueryReference?.release();
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
    const publicFactions = validatePublicFactionSnapshot(message.publicFactions);
    const publicOperations = validatePublicOperationSnapshot(message.publicOperations);
    response = await executeRequest(
      message.requestId,
      message.request,
      spatialCacheKey,
      publicFactions,
      publicOperations,
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
  pendingQueries.clear();

  void handleInvocation(message).finally(() => {
    pendingQueries.clear();
    activeRequestId = undefined;
    busy = false;
  });
});