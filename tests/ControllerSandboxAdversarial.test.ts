import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { LawfulControllerObservation } from "../src/simulation/ControllerRuntime";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
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
  });
}

function authoritativeQuerySession() {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  const runtime = new MatchRuntime(
    createMicroSimulationSpec({
      seed: "controller-sandbox-concurrent-query-order",
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
    {
      controllerReferenceNamespace: "controller-sandbox-concurrent-query-order",
    },
  );
  return createControllerQuerySession(runtime.snapshot(), "alpha", {
    queriesPerDecision: 128,
    materializedCellsPerDecision: 25_000,
  });
}

function outOfOrderCompletionQuerySession() {
  const base = authoritativeQuerySession();
  return Object.freeze({
    ...base,
    cells: Object.freeze({
      ...base.cells,
      async count(selector: Parameters<typeof base.cells.count>[0]) {
        const value = await base.cells.count(selector);
        if (selector.kind === "CELLS" && selector.ids[0] === 0) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        return value;
      },
    }),
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

  it("does not expose Atomics timeout primitives as a guest real-time source", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            return {
              commands: [],
              log: typeof globalThis.Atomics?.wait + ":" + typeof globalThis.Atomics?.waitAsync,
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

  it("does not expose Temporal as an alternate guest wall-clock source", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            return {
              commands: [],
              log: typeof globalThis.Temporal + ":" + typeof globalThis.Temporal?.Now?.instant,
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

  it("keeps concurrent authoritative-query completion order repeatable", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export async function decide(context) {
            const completionOrder = [];
            const first = context.cells
              .count({ kind: "CELLS", ids: [0] })
              .then(() => completionOrder.push("first"));
            const second = context.cells
              .count({ kind: "CELLS", ids: [1] })
              .then(() => completionOrder.push("second"));
            await Promise.all([first, second]);
            return { commands: [], log: completionOrder.join(",") };
          }
        `),
      });

      const observedOrders = new Set<string>();
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const session = authoritativeQuerySession();
        const result = await host.invoke(
          "alpha",
          ordinaryObservation(),
          session,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected successful concurrent query probe");
        observedOrders.add(result.output?.log ?? "");
        expect(session.usage()).toEqual({ queries: 2, materializedCells: 0 });
      }

      expect([...observedOrders]).toEqual(["first,second"]);
    });
  });

  it("preserves source-order settlement when the second authoritative query finishes first", async () => {
    await withPool(async (pool) => {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export async function decide(context) {
            const completionOrder = [];
            const first = context.cells
              .count({ kind: "CELLS", ids: [0] })
              .then(() => completionOrder.push("first"));
            const second = context.cells
              .count({ kind: "CELLS", ids: [1] })
              .then(() => completionOrder.push("second"));
            await Promise.all([first, second]);
            return { commands: [], log: completionOrder.join(",") };
          }
        `),
      });
      const session = outOfOrderCompletionQuerySession();

      expect(
        await host.invoke("alpha", ordinaryObservation(), session),
      ).toEqual({
        ok: true,
        output: { commands: [], log: "first,second" },
      });
      expect(session.usage()).toEqual({ queries: 2, materializedCells: 0 });
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

  it("cannot swallow a genuine isolate ArrayBuffer allocator refusal", async () => {
    await withPool(async (pool) => {
      const response = await pool.invoke(
        Object.freeze({
          factionId: "alpha",
          artifact: artifact(`
            export function decide() {
              try {
                new Uint8Array(256 * 1024 * 1024);
              } catch {}
              return { commands: [] };
            }
          `),
          hook: "DECIDE" as const,
          entrypoint: "decide",
          context: ordinaryObservation(),
          memoryJson: "{}",
          timeoutMs: 2_000,
          moduleEvaluationTimeoutMs: 100,
          isolateMemoryMb: 32,
        }),
      );

      expect(response).toEqual({ ok: false, fault: "MEMORY_LIMIT" });

      const healthy = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide() {
            return { commands: [], log: "after-caught-memory-limit" };
          }
        `),
      });
      expect(await healthy.invoke("alpha", ordinaryObservation())).toEqual({
        ok: true,
        output: { commands: [], log: "after-caught-memory-limit" },
      });
    });
  });

  it("does not let a guest-spoofed allocator RangeError become a memory-limit fault", async () => {
    await withPool(async (pool) => {
      const response = await pool.invoke(
        Object.freeze({
          factionId: "alpha",
          artifact: artifact(`
            export function decide() {
              throw new RangeError("Array buffer allocation failed");
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

      expect(response).toEqual({ ok: false, fault: "RUNTIME_ERROR" });
    });
  });
});
