import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  CONTROLLER_QUERY_LIMITS,
  InProcessTestControllerHost,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import type { MatchState } from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { TickEngine } from "../src/simulation/TickEngine";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
} from "../src/server/controller-runtime/ProductionControllerHost";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function pressureScenario() {
  const match = new MatchRuntime(
    createMicroSimulationSpec({
      seed: "operation-ref-runtime",
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta", "gamma"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
        { id: "gamma", rules: emptyRules() },
      ],
    }),
    { controllerReferenceNamespace: "operation-ref-runtime" },
  );
  match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
  match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 20 });
  match.acceptAction({ type: "GRANT_POPULATION", factionId: "gamma", amount: 20 });
  match.tick();

  const receipts = match.runControllerRound(
    new InProcessTestControllerHost({
      alpha() {
        return {
          directives: {
            set: [
              {
                kind: "LAND_OPERATION",
                key: "pressure-a",
                operation: "ATTACK",
                population: 1,
                targetFactionId: "beta",
                source: { kind: "CELLS", ids: [0] },
                target: { kind: "CELLS", ids: [1] },
              },
              {
                kind: "LAND_OPERATION",
                key: "pressure-b",
                operation: "ATTACK",
                population: 1,
                targetFactionId: "beta",
                source: { kind: "CELLS", ids: [0] },
                target: { kind: "CELLS", ids: [1] },
              },
            ],
          },
        };
      },
    }),
  );
  expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
    true,
  );

  const before = match.snapshot();
  const pendingInputs = match
    .acceptedInputs()
    .filter((input) => input.tick === before.tick + 1);
  const engine = new TickEngine();
  const materialized = engine.applyAcceptedInputs(before, pendingInputs);
  const operationIds = materialized.operations.map((operation) => operation.id).sort();
  expect(operationIds).toHaveLength(2);
  return Object.freeze({ match, before, pendingInputs, engine, materialized, operationIds });
}

type OperationReadSurface = Readonly<{
  get(ref: string): Readonly<Record<string, unknown>> | undefined;
  own(): readonly Readonly<Record<string, unknown>>[];
  incoming(): readonly Readonly<Record<string, unknown>>[];
}>;

function operationsOf(session: ReturnType<typeof createControllerQuerySession>): OperationReadSurface {
  return (session as unknown as { readonly operations: OperationReadSurface }).operations;
}

async function waitForWorkerReplacement(
  pool: ControllerProcessWorkerPool,
  priorPid: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (pool.workerProcessIds()[0] !== priorPid) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for controller worker replacement");
}

describe("OperationRef manifestation and lawful read vertical", () => {
  it("creates two beta-only OPERATION reveals on the first positive-pressure tick and none prospectively", () => {
    const scenario = pressureScenario();

    expect(scenario.materialized.directReveals).toEqual([]);
    expect(scenario.materialized.ownership).toEqual(["alpha", "beta", "gamma"]);

    const advanced = scenario.engine.advance(scenario.before, scenario.pendingInputs);
    expect(advanced.tick).toBe(scenario.before.tick + 1);
    expect(advanced.ownership).toEqual(["alpha", "beta", "gamma"]);
    expect(
      advanced.directReveals.map((entry) => ({
        viewerFactionId: entry.viewerFactionId,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        expiryExclusiveTick: entry.expiryExclusiveTick,
      })),
    ).toEqual(
      scenario.operationIds.map((operationId) => ({
        viewerFactionId: "beta",
        sourceKind: "OPERATION",
        sourceId: operationId,
        expiryExclusiveTick: advanced.tick + 150,
      })),
    );
    expect(advanced.directReveals.some((entry) => entry.viewerFactionId === "gamma")).toBe(
      false,
    );
  });

  it("projects self and manifested foreign operations through stable viewer-scoped refs without raw OperationIds", async () => {
    const scenario = pressureScenario();
    const advanced = scenario.engine.advance(scenario.before, scenario.pendingInputs);
    const references = new ControllerReferenceSession("operation-ref-read", advanced);

    const alpha = createControllerQuerySession(
      advanced,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const beta = createControllerQuerySession(
      advanced,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const gamma = createControllerQuerySession(
      advanced,
      "gamma",
      CONTROLLER_QUERY_LIMITS,
      references,
    );

    const alphaOwn = operationsOf(alpha).own();
    const betaIncoming = operationsOf(beta).incoming();
    const gammaIncoming = operationsOf(gamma).incoming();

    expect(alphaOwn).toHaveLength(2);
    expect(betaIncoming).toHaveLength(2);
    expect(gammaIncoming).toEqual([]);
    expect(alphaOwn.map((view) => view.ref)).toEqual([...alphaOwn.map((view) => view.ref)].sort());
    expect(betaIncoming.map((view) => view.ref)).toEqual(
      [...betaIncoming.map((view) => view.ref)].sort(),
    );

    for (const view of [...alphaOwn, ...betaIncoming]) {
      expect(view).toHaveProperty("ref");
      expect(view).not.toHaveProperty("id");
      expect(scenario.operationIds).not.toContain(view.ref);
    }

    const betaRef = betaIncoming[0]!.ref as string;
    expect(operationsOf(beta).get(betaRef)).toEqual(betaIncoming[0]);
    expect(operationsOf(beta).get(alphaOwn[0]!.ref as string)).toBeUndefined();
    expect(operationsOf(beta).get("fabricated-operation-ref")).toBeUndefined();

    const otherMatchReferences = new ControllerReferenceSession(
      "operation-ref-read-other-match",
      advanced,
    );
    const otherMatchBeta = createControllerQuerySession(
      advanced,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      otherMatchReferences,
    );
    const foreignMatchRef = operationsOf(otherMatchBeta).incoming()[0]!.ref as string;
    expect(operationsOf(beta).get(foreignMatchRef)).toBeUndefined();

    const refreshed = Object.freeze({
      ...advanced,
      tick: advanced.tick + 1,
      directReveals: Object.freeze(
        advanced.directReveals.map((entry) =>
          Object.freeze({ ...entry, expiryExclusiveTick: entry.expiryExclusiveTick + 25 }),
        ),
      ),
    }) as MatchState;
    references.reconcile(refreshed);
    const refreshedBeta = createControllerQuerySession(
      refreshed,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    expect(operationsOf(refreshedBeta).incoming()[0]!.ref).toBe(betaRef);

    const expiryTick = Math.max(
      ...refreshed.directReveals.map((entry) => entry.expiryExclusiveTick),
    );
    const expired = Object.freeze({ ...refreshed, tick: expiryTick }) as MatchState;
    references.reconcile(expired);
    const expiredBeta = createControllerQuerySession(
      expired,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    expect(operationsOf(expiredBeta).incoming()).toEqual([]);
    expect(operationsOf(expiredBeta).get(betaRef)).toBeUndefined();

    const ended = Object.freeze({ ...expired, operations: Object.freeze([]) }) as MatchState;
    references.reconcile(ended);
    const endedBeta = createControllerQuerySession(
      ended,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    expect(operationsOf(endedBeta).incoming()).toEqual([]);
    expect(operationsOf(endedBeta).get(betaRef)).toBeUndefined();
  });

  it("shares the existing 128 trusted-read ceiling without consuming the Unit/Structure materialization budget", async () => {
    const scenario = pressureScenario();
    const advanced = scenario.engine.advance(scenario.before, scenario.pendingInputs);
    const references = new ControllerReferenceSession("operation-ref-budget", advanced);
    const session = createControllerQuerySession(
      advanced,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const operations = operationsOf(session);

    await session.units.count();
    for (let index = 0; index < 127; index += 1) {
      expect(operations.incoming()).toHaveLength(2);
    }
    expect(session.usage()).toMatchObject({
      queries: 128,
      materializedEntityViews: 0,
    });
    expect(() => operations.incoming()).toThrow();
  });

  it("keeps OperationRefs usable through ControllerMemory across real production worker replacement", async () => {
    const scenario = pressureScenario();
    const advanced = scenario.engine.advance(scenario.before, scenario.pendingInputs);
    const references = new ControllerReferenceSession("operation-ref-worker", advanced);
    const querySession = () =>
      createControllerQuerySession(
        advanced,
        "beta",
        CONTROLLER_QUERY_LIMITS,
        references,
      );

    const artifact = Object.freeze({
      moduleSource: `
        export function decide(context) {
          if (context.memory.operationRef === undefined) {
            const incoming = context.operations.incoming();
            if (incoming.length !== 2) throw new Error("expected two manifested operations");
            if (incoming.some((view) => Object.prototype.hasOwnProperty.call(view, "id"))) {
              throw new Error("raw operation id crossed worker boundary");
            }
            return {
              commands: [],
              memory: { operationRef: incoming[0].ref },
              log: JSON.stringify({ phase: "stored", refs: incoming.map((view) => view.ref) }),
            };
          }
          const view = context.operations.get(context.memory.operationRef);
          return {
            commands: [],
            memory: context.memory,
            log: JSON.stringify({
              phase: "resolved",
              stored: context.memory.operationRef,
              resolved: view?.ref,
              hasId: view === undefined ? false : Object.prototype.hasOwnProperty.call(view, "id"),
            }),
          };
        }
      `,
      entrypoints: Object.freeze({ decide: "decide" }),
    }) satisfies ControllerRuntimeArtifact;

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    const host = new ProductionControllerHost(pool, { beta: artifact });
    const observation = Object.freeze({}) as unknown as Parameters<
      ProductionControllerHost["invoke"]
    >[1];
    try {
      const first = await host.invoke("beta", observation, querySession());
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error("expected first OperationRef worker invocation");
      const stored = JSON.parse(first.output?.log ?? "{}");
      expect(stored.phase).toBe("stored");
      expect(stored.refs).toHaveLength(2);
      for (const ref of stored.refs as string[]) {
        expect(scenario.operationIds).not.toContain(ref);
      }

      const priorPid = pool.workerProcessIds()[0];
      if (priorPid === undefined) throw new Error("expected worker pid");
      process.kill(priorPid, "SIGKILL");
      await waitForWorkerReplacement(pool, priorPid);

      const second = await host.invoke("beta", observation, querySession());
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error("expected replacement-worker OperationRef invocation");
      const resolved = JSON.parse(second.output?.log ?? "{}");
      expect(resolved).toEqual({
        phase: "resolved",
        stored: stored.refs[0],
        resolved: stored.refs[0],
        hasId: false,
      });
    } finally {
      await pool.close();
    }
  }, 20_000);
});
