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
        fault: { code: "RUNTIME_ERROR" },
      });

      const moduleTimeout = new ProductionControllerHost(pool, {
        alpha: artifact(`
          while (true) {}
          export function decide() { return { commands: [] }; }
        `),
      });
      expect(await moduleTimeout.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "RUNTIME_ERROR" },
      });

      const healthy = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() { return { commands: [], log: "healthy" }; }
        `),
      });
      expect(await healthy.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "healthy" },
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
        fault: { code: "RUNTIME_ERROR" },
      });

      const malformed = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() { return () => "not copied data"; }
        `),
      });
      expect(await malformed.invoke("alpha", ordinaryObservation())).toEqual({
        ok: false,
        fault: { code: "INVALID_OUTPUT" },
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
});
