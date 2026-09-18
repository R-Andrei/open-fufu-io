import { fork, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CellId,
  CellSelector,
  SegmentId,
  StructureFindFilter,
  StructureType,
  StructureLocator,
  TerrainType,
  UnitFindFilter,
  UnitLocator,
} from "../../core/controller/ControllerApi";
import type {
  ControllerPublicFactionSource,
  ControllerPublicOperationSource,
  ControllerPublicSpatialSource,
  ControllerQuerySession,
} from "../../simulation/ControllerQueryProjection";
import type {
  ControllerWorkerPool,
  ControllerWorkerRequest,
  ControllerWorkerResponse,
} from "./ProductionControllerHost";

const DEFAULT_WORKER_POOL_SIZE = 4;
const DEFAULT_MAX_WORKER_AGE_MS = 60 * 60 * 1_000;
const DEFAULT_MAX_WORKER_RSS_BYTES = 512 * 1024 * 1024;
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
const PUBLIC_TERRAIN_CODE = new Map<TerrainType, number>(
  PUBLIC_TERRAIN_ORDER.map((terrain, index) => [terrain, index]),
);

export interface ControllerProcessWorkerPoolOptions {
  readonly size?: number;
  readonly maxWorkerAgeMs?: number;
  readonly maxWorkerRssBytes?: number;
  readonly nowMs?: () => number;
}

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

type EncodedOwnershipSnapshot = Readonly<{
  snapshot: WorkerOwnershipSnapshot;
  ownerCodeByFactionId: ReadonlyMap<string, number>;
  cellCountByFactionId: ReadonlyMap<string, number>;
}>;

type CachedOwnershipSnapshot = Readonly<{
  cacheKey: number;
  snapshot: WorkerOwnershipSnapshot;
  ownerCodeByFactionId: ReadonlyMap<string, number>;
  cellCountByFactionId: ReadonlyMap<string, number>;
}>;

type WorkerPublicFactionEntry = Readonly<{
  ref: string;
  displayName: string;
  status: ControllerPublicFactionSource["entries"][number]["status"];
  relation: ControllerPublicFactionSource["entries"][number]["relation"];
  territoryCells: number;
  isMinorFaction: boolean;
  origin?: NonNullable<ControllerPublicFactionSource["entries"][number]["origin"]>;
  score?: number;
  ownerCode?: number;
  teamId?: string;
}>;

type WorkerPublicFactionSnapshot = Readonly<{
  requesterOwnerCode?: number;
  entries: readonly WorkerPublicFactionEntry[];
}>;

type WorkerPublicOperationSnapshot = ControllerPublicOperationSource;

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
  result: Readonly<{ ok: true; value?: unknown }> | Readonly<{ ok: false }>;
}>;

type WorkerResponseEnvelope = Readonly<{
  requestId: number;
  response: ControllerWorkerResponse;
  rssBytes: number;
}>;

type QueuedInvocation = Readonly<{
  request: ControllerWorkerRequest;
  querySession?: ControllerQuerySession;
  resolve: (response: ControllerWorkerResponse) => void;
}>;

type QueryResultState = {
  nextQueryId: number;
  readonly buffered: Map<number, WorkerQueryResultEnvelope["result"]>;
};

type PendingInvocation = Readonly<{
  requestId: number;
  querySession?: ControllerQuerySession;
  resolve: (response: ControllerWorkerResponse) => void;
  watchdog: NodeJS.Timeout;
  seenQueryIds: Set<number>;
  queryResults: QueryResultState;
}>;

type WorkerSlot = {
  child: ChildProcess;
  pending?: PendingInvocation;
  failed: boolean;
  catastrophicMemoryLimit: boolean;
  startedAtMs: number;
  publicSpatialCacheKey?: number;
  publicOwnershipCacheKey?: number;
};

function resolveWorkerEntrypoint(): string {
  const moduleUrl = new URL("./ControllerWorkerProcess.ts", import.meta.url);
  if (moduleUrl.protocol === "file:") return fileURLToPath(moduleUrl);
  return resolve(
    process.cwd(),
    "src/server/controller-runtime/ControllerWorkerProcess.ts",
  );
}

const workerEntrypoint = resolveWorkerEntrypoint();

const controllerWorkerFault = Object.freeze({
  ok: false as const,
  fault: "WORKER_DIED" as const,
});

const controllerMemoryLimitFault = Object.freeze({
  ok: false as const,
  fault: "MEMORY_LIMIT" as const,
});

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

function isWorkerQueryEnvelope(value: unknown): value is WorkerQueryEnvelope {
  if (!isPlainRecord(value)) return false;
  return (
    Number.isInteger(value.requestId) &&
    Number.isInteger(value.queryId) &&
    (value.queryId as number) > 0 &&
    isControllerWorkerQueryRequest(value.query)
  );
}

function isWorkerResponseEnvelope(
  value: unknown,
): value is WorkerResponseEnvelope {
  if (!isPlainRecord(value)) return false;
  if (!Number.isInteger(value.requestId)) return false;
  if (!isPlainRecord(value.response)) return false;
  if (typeof value.response.ok !== "boolean") return false;
  return (
    typeof value.rssBytes === "number" &&
    Number.isFinite(value.rssBytes) &&
    value.rssBytes >= 0
  );
}

async function resolveControllerWorkerQuery(
  session: ControllerQuerySession,
  query: ControllerWorkerQueryRequest,
): Promise<unknown> {
  switch (query.operation) {
    case "CELLS_GET":
      return session.cells.get(query.args[0]);
    case "CELLS_QUERY":
      return session.cells.query(query.args[0], query.args[1]);
    case "CELLS_COUNT":
      return session.cells.count(query.args[0]);
    case "CELLS_NEIGHBORS":
      return session.cells.neighbors(query.args[0]);
    case "CELLS_BOUNDARY":
      return session.cells.boundary(query.args[0], query.args[1]);
    case "CELLS_DISTANCE":
      return session.cells.distance(query.args[0], query.args[1]);
    case "SEGMENTS_GET":
      return session.segments.get(query.args[0]);
    case "SEGMENTS_LIST":
      return session.segments.list();
    case "UNITS_GET":
      return session.units.get(query.args[0]);
    case "UNITS_FIND":
      return session.units.find(query.args[0]);
    case "UNITS_COUNT":
      return session.units.count(query.args[0]);
    case "STRUCTURES_GET":
      return session.structures.get(query.args[0]);
    case "STRUCTURES_FIND":
      return session.structures.find(query.args[0]);
    case "STRUCTURES_COUNT":
      return session.structures.count(query.args[0]);
    case "STRUCTURES_CHECK_BUILD":
      return session.structures.checkBuild(query.args[0], query.args[1]);
    case "STRUCTURES_CHECK_UPGRADE":
      return session.structures.checkUpgrade(query.args[0]);
  }
}

function encodeStaticSpatial(
  source: ControllerPublicSpatialSource,
  cacheKey: number,
): WorkerStaticSpatialSnapshot {
  const { map } = source;
  const terrainCodes = new Uint8Array(map.cellCount);
  const segmentIds = new Uint16Array(map.cellCount);
  segmentIds.fill(NO_SEGMENT_ID);
  const segments = map.segments;
  const segmentCount = segments?.segmentCount ?? 0;
  if (segmentCount >= NO_SEGMENT_ID) {
    throw new Error(
      "controller public Segment count exceeds Uint16 cache capacity",
    );
  }

  for (let cellId = 0; cellId < map.cellCount; cellId += 1) {
    const terrain = map.terrainAt(cellId);
    terrainCodes[cellId] =
      terrain === "TEST"
        ? NO_PUBLIC_TERRAIN
        : (PUBLIC_TERRAIN_CODE.get(terrain) ?? NO_PUBLIC_TERRAIN);
    if (segments !== undefined)
      segmentIds[cellId] = segments.segmentIdOf(cellId);
  }

  return Object.freeze({
    cacheKey,
    width: map.width,
    height: map.height,
    cellCount: map.cellCount,
    terrainCodes,
    segmentIds,
    segmentCount,
  });
}

function encodeOwnership(
  source: ControllerPublicSpatialSource,
): EncodedOwnershipSnapshot {
  const factionIds: string[] = [];
  const codeByFactionId = new Map<string, number>();
  const cellCountByFactionId = new Map<string, number>();
  const ownerCodes = new Uint32Array(source.ownership.length);

  for (let cellId = 0; cellId < source.ownership.length; cellId += 1) {
    const ownerId = source.ownership[cellId];
    if (ownerId === null) continue;
    let code = codeByFactionId.get(ownerId);
    if (code === undefined) {
      factionIds.push(ownerId);
      code = factionIds.length;
      codeByFactionId.set(ownerId, code);
    }
    ownerCodes[cellId] = code;
    cellCountByFactionId.set(
      ownerId,
      (cellCountByFactionId.get(ownerId) ?? 0) + 1,
    );
  }

  return Object.freeze({
    snapshot: Object.freeze({
      factionIds: Object.freeze(factionIds),
      ownerCodes,
    }),
    ownerCodeByFactionId: codeByFactionId,
    cellCountByFactionId,
  });
}

function projectPublicOwnership(
  ownership: CachedOwnershipSnapshot,
  factions: ControllerPublicFactionSource | undefined,
): WorkerOwnershipSnapshot {
  if (factions === undefined) {
    throw new Error("controller public ownership requires FactionRef metadata");
  }

  const factionRefs = new Array<string>(ownership.ownerCodeByFactionId.size);
  for (const entry of factions.entries) {
    const ownerCode = ownership.ownerCodeByFactionId.get(entry.authoritativeId);
    if (ownerCode === undefined) continue;
    const index = ownerCode - 1;
    if (factionRefs[index] !== undefined) {
      throw new Error("controller public ownership has duplicate faction metadata");
    }
    factionRefs[index] = entry.ref;
  }

  if (factionRefs.some((ref) => typeof ref !== "string" || ref.length === 0)) {
    throw new Error("controller public ownership is missing FactionRef metadata");
  }

  return Object.freeze({
    factionIds: Object.freeze(factionRefs),
    ownerCodes: ownership.snapshot.ownerCodes,
  });
}

function requirePositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
  return value;
}

export class ControllerProcessWorkerPool implements ControllerWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: QueuedInvocation[] = [];
  private readonly maxWorkerAgeMs: number;
  private readonly maxWorkerRssBytes: number;
  private readonly nowMs: () => number;
  private readonly staticSpatialCache = new WeakMap<
    object,
    WorkerStaticSpatialSnapshot
  >();
  private readonly staticSpatialKeys = new WeakMap<object, number>();
  private readonly ownershipCache = new WeakMap<
    object,
    CachedOwnershipSnapshot
  >();
  private nextStaticSpatialKey = 1;
  private nextOwnershipCacheKey = 1;
  private nextRequestId = 1;
  private closing = false;

  constructor(options: ControllerProcessWorkerPoolOptions = {}) {
    const size = options.size ?? DEFAULT_WORKER_POOL_SIZE;
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(
        "controller worker pool size must be a positive integer",
      );
    }

    this.maxWorkerAgeMs = requirePositiveFinite(
      options.maxWorkerAgeMs ?? DEFAULT_MAX_WORKER_AGE_MS,
      "controller worker max age",
    );
    this.maxWorkerRssBytes = requirePositiveFinite(
      options.maxWorkerRssBytes ?? DEFAULT_MAX_WORKER_RSS_BYTES,
      "controller worker max RSS",
    );
    this.nowMs = options.nowMs ?? Date.now;

    for (let index = 0; index < size; index += 1) {
      this.slots.push(this.spawnWorker(index));
    }
  }

  workerProcessIds(): readonly number[] {
    return Object.freeze(
      this.slots
        .map((slot) => slot.child.pid)
        .filter((pid): pid is number => typeof pid === "number"),
    );
  }

  invoke(
    request: ControllerWorkerRequest,
    querySession?: ControllerQuerySession,
  ): Promise<ControllerWorkerResponse> {
    if (this.closing) return Promise.resolve(controllerWorkerFault);

    return new Promise((resolve) => {
      this.queue.push(Object.freeze({ request, querySession, resolve }));
      this.pump();
    });
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;

    while (this.queue.length > 0) {
      this.queue.shift()?.resolve(controllerWorkerFault);
    }

    const exits = this.slots.map((slot) => {
      this.failPending(slot);
      const child = slot.child;
      if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        child.once("close", () => resolve());
        child.kill("SIGTERM");
      });
    });

    await Promise.all(exits);
  }

  private spawnWorker(index: number): WorkerSlot {
    const child = fork(workerEntrypoint, [], {
      execPath: process.execPath,
      execArgv: ["--no-node-snapshot", "--import", "tsx"],
      stdio: ["ignore", "ignore", "ignore", "ipc", "pipe"],
      serialization: "advanced",
    });

    const slot: WorkerSlot = {
      child,
      failed: false,
      catastrophicMemoryLimit: false,
      startedAtMs: this.nowMs(),
    };

    child.stdio[4]?.on("data", () => {
      slot.catastrophicMemoryLimit = true;
    });
    child.on("message", (message) => this.handleMessage(slot, message));
    child.once("error", () => this.markWorkerFailed(slot));
    child.once("disconnect", () => this.markWorkerFailed(slot));
    child.once("close", () => this.handleClose(index, slot));

    return slot;
  }

  private staticSpatialFor(
    source: ControllerPublicSpatialSource,
  ): WorkerStaticSpatialSnapshot {
    const mapKey = source.map as object;
    let cacheKey = this.staticSpatialKeys.get(mapKey);
    if (cacheKey === undefined) {
      cacheKey = this.nextStaticSpatialKey;
      this.nextStaticSpatialKey += 1;
      this.staticSpatialKeys.set(mapKey, cacheKey);
    }
    let cached = this.staticSpatialCache.get(mapKey);
    if (cached === undefined) {
      cached = encodeStaticSpatial(source, cacheKey);
      this.staticSpatialCache.set(mapKey, cached);
    }
    return cached;
  }

  private ownershipFor(
    source: ControllerPublicSpatialSource,
  ): CachedOwnershipSnapshot {
    const ownershipKey = source.ownership as object;
    let cached = this.ownershipCache.get(ownershipKey);
    if (cached === undefined) {
      const encoded = encodeOwnership(source);
      cached = Object.freeze({
        cacheKey: this.nextOwnershipCacheKey,
        ...encoded,
      });
      this.nextOwnershipCacheKey += 1;
      this.ownershipCache.set(ownershipKey, cached);
    }
    return cached;
  }

  private publicFactionSnapshot(
    source: ControllerPublicFactionSource,
    spatial: ControllerPublicSpatialSource,
  ): WorkerPublicFactionSnapshot {
    const ownership = this.ownershipFor(spatial);
    const requesterOwnerCode = ownership.ownerCodeByFactionId.get(
      source.requesterFactionId,
    );
    return Object.freeze({
      ...(requesterOwnerCode === undefined ? {} : { requesterOwnerCode }),
      entries: Object.freeze(
        source.entries.map((entry) => {
          const ownerCode = ownership.ownerCodeByFactionId.get(
            entry.authoritativeId,
          );
          const origin =
            entry.origin === undefined
              ? undefined
              : Object.freeze({
                  id: entry.origin.id,
                  displayName: entry.origin.displayName,
                  version: entry.origin.version,
                  positiveTraitIds: Object.freeze([...entry.origin.positiveTraitIds]),
                  negativeTraitIds: Object.freeze([...entry.origin.negativeTraitIds]),
                });
          return Object.freeze({
            ref: entry.ref,
            displayName: entry.displayName,
            status: entry.status,
            relation: entry.relation,
            territoryCells:
              ownership.cellCountByFactionId.get(entry.authoritativeId) ?? 0,
            isMinorFaction: entry.isMinorFaction,
            ...(origin === undefined ? {} : { origin }),
            ...(entry.score === undefined ? {} : { score: entry.score }),
            ...(ownerCode === undefined ? {} : { ownerCode }),
            ...(entry.teamId === undefined ? {} : { teamId: entry.teamId }),
          });
        }),
      ),
    });
  }

  private publicSpatialUpdate(
    slot: WorkerSlot,
    source: ControllerPublicSpatialSource | undefined,
    factions: ControllerPublicFactionSource | undefined,
  ): WorkerPublicSpatialUpdate | undefined {
    if (source === undefined) return undefined;
    const staticSpatial = this.staticSpatialFor(source);
    const ownership = this.ownershipFor(source);
    const needsStatic = slot.publicSpatialCacheKey !== staticSpatial.cacheKey;
    const needsOwnership =
      needsStatic || slot.publicOwnershipCacheKey !== ownership.cacheKey;
    slot.publicSpatialCacheKey = staticSpatial.cacheKey;
    slot.publicOwnershipCacheKey = ownership.cacheKey;
    return Object.freeze({
      cacheKey: staticSpatial.cacheKey,
      ownershipCacheKey: ownership.cacheKey,
      ...(needsStatic ? { static: staticSpatial } : {}),
      ...(needsOwnership
        ? { ownership: projectPublicOwnership(ownership, factions) }
        : {}),
    });
  }

  private pump(): void {
    if (this.closing) return;

    for (const slot of this.slots) {
      if (this.queue.length === 0) return;
      if (slot.failed || slot.pending !== undefined) continue;

      if (this.workerAgeMs(slot) >= this.maxWorkerAgeMs) {
        this.retireIdleWorker(slot);
        continue;
      }

      const queued = this.queue.shift();
      if (queued === undefined) return;

      const requestId = this.nextRequestId;
      this.nextRequestId += 1;

      const watchdogMs =
        queued.request.moduleEvaluationTimeoutMs +
        queued.request.timeoutMs +
        1_000;
      const watchdog = setTimeout(() => {
        this.markWorkerFailed(slot);
      }, watchdogMs);
      watchdog.unref();

      slot.pending = Object.freeze({
        requestId,
        querySession: queued.querySession,
        resolve: queued.resolve,
        watchdog,
        seenQueryIds: new Set<number>(),
        queryResults: {
          nextQueryId: 1,
          buffered: new Map<number, WorkerQueryResultEnvelope["result"]>(),
        },
      });

      let publicSpatial: WorkerPublicSpatialUpdate | undefined;
      let publicFactions: WorkerPublicFactionSnapshot | undefined;
      let publicOperations: WorkerPublicOperationSnapshot | undefined;
      try {
        publicSpatial = this.publicSpatialUpdate(
          slot,
          queued.querySession?.publicSpatial,
          queued.querySession?.publicFactions,
        );
        publicFactions =
          queued.querySession?.publicFactions === undefined
            ? undefined
            : this.publicFactionSnapshot(
                queued.querySession.publicFactions,
                queued.querySession.publicSpatial,
              );
        publicOperations = queued.querySession?.publicOperations;
      } catch {
        this.markWorkerFailed(slot);
        continue;
      }

      const envelope: WorkerRequestEnvelope = Object.freeze({
        requestId,
        request: queued.request,
        ...(publicSpatial === undefined ? {} : { publicSpatial }),
        ...(publicFactions === undefined ? {} : { publicFactions }),
        ...(publicOperations === undefined ? {} : { publicOperations }),
      });

      try {
        slot.child.send(envelope, (error) => {
          if (error !== null) this.markWorkerFailed(slot);
        });
      } catch {
        this.markWorkerFailed(slot);
      }
    }
  }

  private handleMessage(slot: WorkerSlot, message: unknown): void {
    if (slot.failed || slot.pending === undefined) return;

    if (isWorkerQueryEnvelope(message)) {
      this.handleQueryMessage(slot, message);
      return;
    }

    if (!isWorkerResponseEnvelope(message)) {
      this.markWorkerFailed(slot);
      return;
    }
    if (message.requestId !== slot.pending.requestId) {
      this.markWorkerFailed(slot);
      return;
    }

    const pending = slot.pending;
    slot.pending = undefined;
    clearTimeout(pending.watchdog);

    let response = message.response;
    if (response.ok && pending.querySession !== undefined) {
      const usage = pending.querySession.usage();
      const combinedUsage = {
        queries: response.usage.queries,
        materializedCells: usage.materializedCells,
      };
      Object.defineProperty(combinedUsage, "materializedEntityViews", {
        value: usage.materializedEntityViews,
        enumerable: false,
        configurable: false,
        writable: false,
      });
      response = Object.freeze({
        ...response,
        usage: Object.freeze(combinedUsage),
      });
    }
    pending.resolve(response);

    if (
      this.workerAgeMs(slot) >= this.maxWorkerAgeMs ||
      message.rssBytes > this.maxWorkerRssBytes
    ) {
      this.retireIdleWorker(slot);
      return;
    }

    this.pump();
  }

  private handleQueryMessage(
    slot: WorkerSlot,
    message: WorkerQueryEnvelope,
  ): void {
    const pending = slot.pending;
    if (
      pending === undefined ||
      message.requestId !== pending.requestId ||
      pending.seenQueryIds.has(message.queryId)
    ) {
      this.markWorkerFailed(slot);
      return;
    }
    pending.seenQueryIds.add(message.queryId);

    const session = pending.querySession;
    if (session === undefined) {
      this.queueQueryResult(slot, message.requestId, message.queryId, {
        ok: false,
      });
      return;
    }

    void resolveControllerWorkerQuery(session, message.query).then(
      (value) => {
        this.queueQueryResult(slot, message.requestId, message.queryId, {
          ok: true,
          value,
        });
      },
      () => {
        this.queueQueryResult(slot, message.requestId, message.queryId, {
          ok: false,
        });
      },
    );
  }

  private queueQueryResult(
    slot: WorkerSlot,
    requestId: number,
    queryId: number,
    result: WorkerQueryResultEnvelope["result"],
  ): void {
    const pending = slot.pending;
    if (
      slot.failed ||
      pending === undefined ||
      pending.requestId !== requestId
    ) {
      return;
    }

    pending.queryResults.buffered.set(queryId, Object.freeze(result));
    while (
      pending.queryResults.buffered.has(pending.queryResults.nextQueryId)
    ) {
      const nextQueryId = pending.queryResults.nextQueryId;
      const nextResult = pending.queryResults.buffered.get(nextQueryId);
      if (nextResult === undefined) return;
      pending.queryResults.buffered.delete(nextQueryId);
      pending.queryResults.nextQueryId += 1;
      this.sendQueryResult(slot, requestId, nextQueryId, nextResult);
    }
  }

  private sendQueryResult(
    slot: WorkerSlot,
    requestId: number,
    queryId: number,
    result: WorkerQueryResultEnvelope["result"],
  ): void {
    if (
      slot.failed ||
      slot.pending === undefined ||
      slot.pending.requestId !== requestId
    ) {
      return;
    }

    const envelope: WorkerQueryResultEnvelope = Object.freeze({
      requestId,
      queryId,
      result: Object.freeze(result),
    });
    try {
      slot.child.send(envelope, (error) => {
        if (error !== null) this.markWorkerFailed(slot);
      });
    } catch {
      this.markWorkerFailed(slot);
    }
  }

  private workerAgeMs(slot: WorkerSlot): number {
    return Math.max(0, this.nowMs() - slot.startedAtMs);
  }

  private retireIdleWorker(slot: WorkerSlot): void {
    if (slot.failed || slot.pending !== undefined) return;
    slot.failed = true;
    if (slot.child.exitCode === null && slot.child.signalCode === null) {
      slot.child.kill("SIGTERM");
    }
  }

  private markWorkerFailed(slot: WorkerSlot): void {
    if (slot.failed) return;
    slot.failed = true;
    if (slot.child.exitCode === null && slot.child.signalCode === null) {
      slot.child.kill("SIGKILL");
    }
  }

  private failPending(
    slot: WorkerSlot,
    response: ControllerWorkerResponse = controllerWorkerFault,
  ): void {
    const pending = slot.pending;
    if (pending === undefined) return;
    slot.pending = undefined;
    clearTimeout(pending.watchdog);
    pending.resolve(response);
  }

  private handleClose(index: number, slot: WorkerSlot): void {
    this.failPending(
      slot,
      slot.catastrophicMemoryLimit
        ? controllerMemoryLimitFault
        : controllerWorkerFault,
    );
    if (this.closing) return;
    if (this.slots[index] !== slot) return;

    this.slots[index] = this.spawnWorker(index);
    this.pump();
  }
}
