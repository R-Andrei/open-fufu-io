import { fork, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CellId, CellSelector, SegmentId } from "../../core/controller/ControllerApi";
import type { ControllerQuerySession } from "../../simulation/ControllerQueryProjection";
import type {
  ControllerWorkerPool,
  ControllerWorkerRequest,
  ControllerWorkerResponse,
} from "./ProductionControllerHost";

const DEFAULT_WORKER_POOL_SIZE = 4;
const DEFAULT_MAX_WORKER_AGE_MS = 60 * 60 * 1_000;
const DEFAULT_MAX_WORKER_RSS_BYTES = 512 * 1024 * 1024;

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

type QueuedInvocation = Readonly<{
  request: ControllerWorkerRequest;
  querySession?: ControllerQuerySession;
  resolve: (response: ControllerWorkerResponse) => void;
}>;

type PendingInvocation = Readonly<{
  requestId: number;
  querySession?: ControllerQuerySession;
  resolve: (response: ControllerWorkerResponse) => void;
  watchdog: NodeJS.Timeout;
  seenQueryIds: Set<number>;
}>;

type WorkerSlot = {
  child: ChildProcess;
  pending?: PendingInvocation;
  failed: boolean;
  startedAtMs: number;
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

function isWorkerQueryEnvelope(value: unknown): value is WorkerQueryEnvelope {
  if (!isPlainRecord(value)) return false;
  return (
    Number.isInteger(value.requestId) &&
    Number.isInteger(value.queryId) &&
    (value.queryId as number) > 0 &&
    isControllerWorkerQueryRequest(value.query)
  );
}

function isWorkerResponseEnvelope(value: unknown): value is WorkerResponseEnvelope {
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
    case "CELLS_CONNECTED_COMPONENTS":
      return session.cells.connectedComponents(query.args[0]);
    case "CELLS_DISTANCE":
      return session.cells.distance(query.args[0], query.args[1]);
    case "SEGMENTS_GET":
      return session.segments.get(query.args[0]);
    case "SEGMENTS_LIST":
      return session.segments.list();
  }
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
  private nextRequestId = 1;
  private closing = false;

  constructor(options: ControllerProcessWorkerPoolOptions = {}) {
    const size = options.size ?? DEFAULT_WORKER_POOL_SIZE;
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError("controller worker pool size must be a positive integer");
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
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
      });
    });

    await Promise.all(exits);
  }

  private spawnWorker(index: number): WorkerSlot {
    const child = fork(workerEntrypoint, [], {
      execPath: process.execPath,
      execArgv: ["--no-node-snapshot", "--import", "tsx"],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      serialization: "advanced",
    });

    const slot: WorkerSlot = {
      child,
      failed: false,
      startedAtMs: this.nowMs(),
    };

    child.on("message", (message) => this.handleMessage(slot, message));
    child.once("error", () => this.markWorkerFailed(slot));
    child.once("disconnect", () => this.markWorkerFailed(slot));
    child.once("exit", () => this.handleExit(index, slot));

    return slot;
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
        queued.request.moduleEvaluationTimeoutMs + queued.request.timeoutMs + 1_000;
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
      });

      const envelope: WorkerRequestEnvelope = Object.freeze({
        requestId,
        request: queued.request,
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
      response = Object.freeze({
        ...response,
        usage: Object.freeze({
          queries: usage.queries,
          materializedCells: usage.materializedCells,
        }),
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
      this.sendQueryResult(slot, message.requestId, message.queryId, { ok: false });
      return;
    }

    void resolveControllerWorkerQuery(session, message.query).then(
      (value) => {
        this.sendQueryResult(slot, message.requestId, message.queryId, {
          ok: true,
          value,
        });
      },
      () => {
        this.sendQueryResult(slot, message.requestId, message.queryId, {
          ok: false,
        });
      },
    );
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
    this.failPending(slot);
    if (slot.child.exitCode === null && slot.child.signalCode === null) {
      slot.child.kill("SIGKILL");
    }
  }

  private failPending(slot: WorkerSlot): void {
    const pending = slot.pending;
    if (pending === undefined) return;
    slot.pending = undefined;
    clearTimeout(pending.watchdog);
    pending.resolve(controllerWorkerFault);
  }

  private handleExit(index: number, slot: WorkerSlot): void {
    this.failPending(slot);
    if (this.closing) return;
    if (this.slots[index] !== slot) return;

    this.slots[index] = this.spawnWorker(index);
    this.pump();
  }
}
