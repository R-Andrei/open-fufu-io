import { fork, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ControllerWorkerPool,
  ControllerWorkerRequest,
  ControllerWorkerResponse,
} from "./ProductionControllerHost";

export interface ControllerProcessWorkerPoolOptions {
  readonly size: number;
}

type WorkerRequestEnvelope = Readonly<{
  requestId: number;
  request: ControllerWorkerRequest;
}>;

type WorkerResponseEnvelope = Readonly<{
  requestId: number;
  response: ControllerWorkerResponse;
}>;

type QueuedInvocation = Readonly<{
  request: ControllerWorkerRequest;
  resolve: (response: ControllerWorkerResponse) => void;
}>;

type PendingInvocation = Readonly<{
  requestId: number;
  resolve: (response: ControllerWorkerResponse) => void;
  watchdog: NodeJS.Timeout;
}>;

type WorkerSlot = {
  child: ChildProcess;
  pending?: PendingInvocation;
  failed: boolean;
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

function isWorkerResponseEnvelope(value: unknown): value is WorkerResponseEnvelope {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!Number.isInteger(record.requestId)) return false;
  if (record.response === null || typeof record.response !== "object") return false;
  return typeof (record.response as Record<string, unknown>).ok === "boolean";
}

export class ControllerProcessWorkerPool implements ControllerWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: QueuedInvocation[] = [];
  private nextRequestId = 1;
  private closing = false;

  constructor(options: ControllerProcessWorkerPoolOptions) {
    if (!Number.isInteger(options.size) || options.size <= 0) {
      throw new RangeError("controller worker pool size must be a positive integer");
    }

    for (let index = 0; index < options.size; index += 1) {
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

  invoke(request: ControllerWorkerRequest): Promise<ControllerWorkerResponse> {
    if (this.closing) return Promise.resolve(controllerWorkerFault);

    return new Promise((resolve) => {
      this.queue.push(Object.freeze({ request, resolve }));
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
        resolve: queued.resolve,
        watchdog,
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
    pending.resolve(message.response);
    this.pump();
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
