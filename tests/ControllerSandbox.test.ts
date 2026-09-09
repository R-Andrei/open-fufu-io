import type { LawfulControllerObservation } from "../src/simulation/ControllerRuntime";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
} from "../src/server/controller-runtime/ProductionControllerHost";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";

function ordinaryObservation(): LawfulControllerObservation {
  return Object.freeze({
    tick: 7,
    decisionNumber: 3,
    me: Object.freeze({
      id: "alpha",
      status: "ACTIVE" as const,
      population: Object.freeze({
        total: 10,
        available: 8,
        committedOffense: 2,
        committedCounterResponse: 0,
        aboardTransports: 0,
        neutralSettlementHalfResidual: 0,
      }),
    }),
    factions: Object.freeze([
      Object.freeze({ id: "alpha", status: "ACTIVE" as const }),
      Object.freeze({ id: "beta", status: "ACTIVE" as const }),
    ]),
    cells: Object.freeze([]),
  });
}

function artifact(
  moduleSource: string,
  entrypoints: ControllerRuntimeArtifact["entrypoints"] = Object.freeze({
    decide: "decide",
  }),
): ControllerRuntimeArtifact {
  return Object.freeze({ moduleSource, entrypoints });
}

function healthyHost(
  pool: ControllerProcessWorkerPool,
  log = "healthy",
): ProductionControllerHost {
  return new ProductionControllerHost(pool, {
    alpha: artifact(`
      export function decide() {
        return { commands: [], log: ${JSON.stringify(log)} };
      }
    `),
  });
}

async function waitFor(
  predicate: () => boolean,
  attempts = 100,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition did not become true");
}

async function withPool(
  run: (pool: ControllerProcessWorkerPool) => Promise<void>,
): Promise<void> {
  const pool = new ControllerProcessWorkerPool({ size: 1 });
  try {
    await run(pool);
  } finally {
    await pool.close();
  }
}

describe("production controller sandbox process", () => {
  it("executes a self-contained controller module in a dedicated worker process", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide(context) {
            return {
              commands: [],
              log: String(context.tick) + ":" + String(context.me.id),
            };
          }
        `),
      });

      const result = await host.invoke("alpha", ordinaryObservation());

      expect(result).toEqual({
        ok: true,
        output: { commands: [], log: "7:alpha" },
      });
      expect(pool.workerProcessIds()).toHaveLength(1);
      expect(pool.workerProcessIds()[0]).not.toBe(process.pid);
    });
  });

  it("exposes no Node, network, real-time, or uncontrolled-entropy capabilities to guest code", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            return {
              commands: [],
              log: JSON.stringify({
                process: typeof globalThis.process,
                require: typeof globalThis.require,
                Buffer: typeof globalThis.Buffer,
                fetch: typeof globalThis.fetch,
                WebSocket: typeof globalThis.WebSocket,
                Date: typeof globalThis.Date,
                performance: typeof globalThis.performance,
                crypto: typeof globalThis.crypto,
                random: typeof Math.random,
              }),
            };
          }
        `),
      });

      const result = await host.invoke("alpha", ordinaryObservation());
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected successful sandbox probe");
      expect(JSON.parse(result.output?.log ?? "{}")).toEqual({
        process: "undefined",
        require: "undefined",
        Buffer: "undefined",
        fetch: "undefined",
        WebSocket: "undefined",
        Date: "undefined",
        performance: "undefined",
        crypto: "undefined",
        random: "undefined",
      });
    });
  });

  it("copies and freezes callback state while trusting only explicit controller memory across isolates", async () => {
    await withPool(async (pool) => {
      const observation = ordinaryObservation();
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          let moduleGlobal = 0;
          export function decide(context) {
            moduleGlobal += 1;
            let mutationBlocked = false;
            try {
              context.me.status = "CAPITULATED";
            } catch {
              mutationBlocked = true;
            }
            const prior = context.memory.count ?? 0;
            return {
              commands: [],
              memory: { count: prior + 1 },
              log: [moduleGlobal, prior, mutationBlocked, context.me.status].join(":"),
            };
          }
        `),
      });

      const first = await host.invoke("alpha", observation);
      const second = await host.invoke("alpha", observation);

      expect(first).toEqual({
        ok: true,
        output: {
          commands: [],
          memory: { count: 1 },
          log: "1:0:true:ACTIVE",
        },
      });
      expect(second).toEqual({
        ok: true,
        output: {
          commands: [],
          memory: { count: 2 },
          log: "1:1:true:ACTIVE",
        },
      });
      expect(observation.me.status).toBe("ACTIVE");
    });
  });

  it("contains callback and module-evaluation timeouts and leaves the worker pool usable", async () => {
    await withPool(async (pool) => {
      const callbackTimeout = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            while (true) {}
          }
        `),
      });
      expect(await callbackTimeout.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "TIMEOUT" },
      });

      const moduleTimeout = new ProductionControllerHost(pool, {
        alpha: artifact(`
          while (true) {}
          export function decide() { return { commands: [] }; }
        `),
      });
      expect(await moduleTimeout.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "TIMEOUT" },
      });

      const healthy = healthyHost(pool);
      expect(await healthy.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "healthy" },
      });
    });
  });

  it("counts compilation inside the single module-initialization timeout budget", async () => {
    await withPool(async (pool) => {
      const response = await pool.invoke(
        Object.freeze({
          factionId: "alpha",
          artifact: artifact(
            `/*${"x".repeat(8 * 1024 * 1024)}*/\n` +
              "export function decide() { return { commands: [] }; }",
          ),
          hook: "DECIDE" as const,
          entrypoint: "decide",
          context: ordinaryObservation(),
          memoryJson: "{}",
          timeoutMs: 20,
          moduleEvaluationTimeoutMs: 5,
          isolateMemoryMb: 128,
        }),
      );

      expect(response).toEqual({ ok: false, fault: "TIMEOUT" });
      expect(await healthyHost(pool, "after-compile-timeout").invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "after-compile-timeout" },
      });
    });
  });

  it("counts top-level-await settlement inside the module-initialization timeout budget", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          await new Promise(() => {});
          export function decide() { return { commands: [] }; }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "TIMEOUT" },
      });
      expect(await healthyHost(pool, "after-tla-timeout").invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "after-tla-timeout" },
      });
    });
  });

  it("allows top-level await that settles inside the module-initialization timeout budget", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          await Promise.resolve();
          export function decide() {
            return { commands: [], log: "tla-settled" };
          }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "tla-settled" },
      });
    });
  });

  it("bounds getter-backed result materialization inside the callback timeout", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            return {
              commands: [],
              get log() {
                while (true) {}
              },
            };
          }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "TIMEOUT" },
      });
      expect(await healthyHost(pool, "after-getter-timeout").invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "after-getter-timeout" },
      });
    });
  });

  it("rejects an oversized decision inside the worker before parent IPC", async () => {
    await withPool(async (pool) => {
      const response = await pool.invoke(
        Object.freeze({
          factionId: "alpha",
          artifact: artifact(`
            export function decide() {
              const largeName = "x".repeat(2048);
              return {
                commands: [],
                debug: Array.from({ length: 256 }, (_, index) => ({
                  kind: "METRIC",
                  name: largeName + String(index),
                  value: index,
                })),
              };
            }
          `),
          hook: "DECIDE" as const,
          entrypoint: "decide",
          context: ordinaryObservation(),
          memoryJson: "{}",
          timeoutMs: 20,
          moduleEvaluationTimeoutMs: 100,
          isolateMemoryMb: 32,
        }),
      );

      expect(response).toEqual({ ok: false, fault: "INVALID_OUTPUT" });
      expect(await healthyHost(pool, "after-oversized-output").invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "after-oversized-output" },
      });
    });
  });

  it("rejects module imports and malformed non-data output without exposing host references", async () => {
    await withPool(async (pool) => {
      const importing = new ProductionControllerHost(pool, {
        alpha: artifact(`
          import fs from "node:fs";
          export function decide() { return { commands: [], log: String(fs) }; }
        `),
      });
      expect(await importing.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "SANDBOX_VIOLATION" },
      });

      const malformed = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() { return () => "not copied data"; }
        `),
      });
      expect(await malformed.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "RUNTIME_ERROR" },
      });
    });
  });

  it("runs supported Strategic Spawn hooks through the same isolated process boundary", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(
          `
            export function decide() { return { commands: [] }; }
            export function chooseInfluence(context) {
              return { centers: [11], memory: { spawn: context.phase } };
            }
            export function reconsiderInfluence(context) {
              return { centers: [12], memory: { spawn: context.phase } };
            }
            export function chooseOrigins(context) {
              return { origins: [13], memory: { spawn: context.phase } };
            }
          `,
          Object.freeze({
            decide: "decide",
            chooseInfluence: "chooseInfluence",
            reconsiderInfluence: "reconsiderInfluence",
            chooseOrigins: "chooseOrigins",
          }),
        ),
      });

      expect(
        await host.chooseInfluence(
          "alpha",
          { phase: "INFLUENCE" } as never,
        ),
      ).toEqual({
        ok: true,
        output: { centers: [11], memory: { spawn: "INFLUENCE" } },
      });
      expect(
        await host.reconsiderInfluence(
          "alpha",
          { phase: "RECONSIDER" } as never,
        ),
      ).toEqual({
        ok: true,
        output: { centers: [12], memory: { spawn: "RECONSIDER" } },
      });
      expect(
        await host.chooseOrigins(
          "alpha",
          { phase: "ORIGINS" } as never,
        ),
      ).toEqual({
        ok: true,
        output: { origins: [13], memory: { spawn: "ORIGINS" } },
      });
    });
  });

  it("uses the canonical four-worker deployment baseline when no override is supplied", async () => {
    const pool = new ControllerProcessWorkerPool();
    try {
      expect(pool.workerProcessIds()).toHaveLength(4);
    } finally {
      await pool.close();
    }
  });

  it("normalizes worker death, replaces the failed process, and resumes service", async () => {
    await withPool(async (pool) => {
      const originalPid = pool.workerProcessIds()[0];
      if (originalPid === undefined) throw new Error("expected worker pid");

      const stuck = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            while (true) {}
          }
        `),
      });
      const pending = stuck.invoke("alpha", ordinaryObservation());
      await new Promise((resolve) => setTimeout(resolve, 10));
      process.kill(originalPid, "SIGKILL");

      expect(await pending).toEqual({
        ok: false,
        fault: { code: "RUNTIME_ERROR" },
      });
      await waitFor(() => pool.workerProcessIds()[0] !== originalPid);

      expect(await healthyHost(pool, "replacement").invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "replacement" },
      });
    });
  });

  it("recycles an aged worker only after the worker becomes idle", async () => {
    let nowMs = 0;
    const pool = new ControllerProcessWorkerPool({
      size: 1,
      maxWorkerAgeMs: 100,
      nowMs: () => nowMs,
    });
    try {
      const originalPid = pool.workerProcessIds()[0];
      if (originalPid === undefined) throw new Error("expected worker pid");
      const host = healthyHost(pool, "aged");

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "aged" },
      });
      expect(pool.workerProcessIds()[0]).toBe(originalPid);

      nowMs = 100;
      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "aged" },
      });
      await waitFor(() => pool.workerProcessIds()[0] !== originalPid);
    } finally {
      await pool.close();
    }
  });

  it("recycles an idle worker after reported RSS exceeds the configured ceiling", async () => {
    const pool = new ControllerProcessWorkerPool({
      size: 1,
      maxWorkerRssBytes: 1,
    });
    try {
      const originalPid = pool.workerProcessIds()[0];
      if (originalPid === undefined) throw new Error("expected worker pid");

      expect(await healthyHost(pool, "rss").invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "rss" },
      });
      await waitFor(() => pool.workerProcessIds()[0] !== originalPid);
    } finally {
      await pool.close();
    }
  });
});
