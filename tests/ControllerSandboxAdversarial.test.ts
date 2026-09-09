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

function artifact(moduleSource: string): ControllerRuntimeArtifact {
  return Object.freeze({
    moduleSource,
    entrypoints: Object.freeze({ decide: "decide" }),
  });
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

describe("production controller sandbox adversarial capabilities", () => {
  it("cannot recover system wall-clock time through Intl.DateTimeFormat", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            let wallClockReadable = false;
            try {
              const formatted = new Intl.DateTimeFormat("en-US", {
                timeZone: "UTC",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }).format();
              wallClockReadable = typeof formatted === "string" && formatted.length > 0;
            } catch {}
            return { commands: [], log: String(wallClockReadable) };
          }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "false" },
      });
    });
  });

  it("does not expose GC-derived nondeterminism through WeakRef or FinalizationRegistry", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            return {
              commands: [],
              log: typeof globalThis.WeakRef + ":" + typeof globalThis.FinalizationRegistry,
            };
          }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "undefined:undefined" },
      });
    });
  });

  it("keeps callback input immutable when guest code monkeypatches freeze primordials", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          Object.freeze = (value) => value;
          Reflect.ownKeys = () => [];

          export function decide(context) {
            let mutationBlocked = false;
            try {
              context.me.status = "CAPITULATED";
            } catch {
              mutationBlocked = true;
            }
            return {
              commands: [],
              log: String(mutationBlocked) + ":" + String(context.me.status),
            };
          }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "true:ACTIVE" },
      });
    });
  });

  it("keeps trusted result materialization correct when guest code monkeypatches Object.keys", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          Object.keys = () => [];

          export function decide() {
            return { commands: [], log: "preserved" };
          }
        `),
      });

      expect(await host.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "preserved" },
      });
    });
  });
});
