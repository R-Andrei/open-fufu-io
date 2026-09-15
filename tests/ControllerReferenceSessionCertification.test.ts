import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createControllerQuerySession,
} from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  CONTROLLER_QUERY_LIMITS,
} from "../src/simulation/ControllerRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
} from "../src/server/controller-runtime/ProductionControllerHost";

function collidingStructureState(structureId: string) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "controller-reference-value-collision",
      width: 1,
      height: 1,
      terrain: ["PLAINS"],
      initialOwners: ["alpha"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
      initialStructureGrants: [
        {
          structureId,
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          level: 1,
        },
      ],
    }),
  );
}

function operationBaseState(): MatchState {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "controller-reference-kind-replacement",
      width: 2,
      height: 1,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
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

describe("controller reference session certification", () => {
  it("never exposes the underlying authoritative identity as the public ref value", () => {
    const authoritativeId = "ofr1:collision-match:0:s:0";
    const session = new ControllerReferenceSession(
      "collision-match",
      collidingStructureState(authoritativeId),
    );

    const ref = session.issue("alpha", "STRUCTURE", authoritativeId);
    expect(ref).toBeDefined();
    expect(ref).not.toBe(authoritativeId);
    expect(session.resolve("alpha", "STRUCTURE", ref!)).toBe(authoritativeId);
  });

  it("issues stable match-global FactionRefs without exposing FactionId or making them viewer scoped", () => {
    const state = collidingStructureState("faction-ref-structure");
    const first = new ControllerReferenceSession("faction-match-a", state);
    const second = new ControllerReferenceSession("faction-match-b", state);
    const firstApi = first as unknown as {
      issueFaction(factionId: string): string | undefined;
      resolveFaction(ref: string): string | undefined;
    };
    const secondApi = second as unknown as {
      issueFaction(factionId: string): string | undefined;
      resolveFaction(ref: string): string | undefined;
    };

    const alpha = firstApi.issueFaction("alpha");
    const alphaAgain = firstApi.issueFaction("alpha");
    const beta = firstApi.issueFaction("beta");
    const otherMatchAlpha = secondApi.issueFaction("alpha");

    expect(alpha).toBeDefined();
    expect(alphaAgain).toBe(alpha);
    expect(alpha).not.toBe("alpha");
    expect(beta).toBeDefined();
    expect(beta).not.toBe(alpha);
    expect(otherMatchAlpha).toBeDefined();
    expect(otherMatchAlpha).not.toBe(alpha);
    expect(firstApi.resolveFaction(alpha!)).toBe("alpha");
    expect(firstApi.resolveFaction("fabricated-faction-ref")).toBeUndefined();
    expect(secondApi.resolveFaction(alpha!)).toBeUndefined();
    expect(firstApi.issueFaction("does-not-exist")).toBeUndefined();
  });

  it("replaces a simple-domain incarnation when explicit lifecycle transitions reuse the same authoritative ID", () => {
    const authoritativeId = "reused-structure-id";
    const state = collidingStructureState(authoritativeId);
    const session = new ControllerReferenceSession("lifecycle-transition-match", state);
    const firstRef = session.issue("alpha", "STRUCTURE", authoritativeId);
    expect(firstRef).toBeDefined();

    session.applyEntityLifecycleTransition("STRUCTURE", authoritativeId, "END");
    session.applyEntityLifecycleTransition("STRUCTURE", authoritativeId, "START");
    session.reconcile(state);

    const replacementRef = session.issue("alpha", "STRUCTURE", authoritativeId);
    expect(replacementRef).toBeDefined();
    expect(replacementRef).not.toBe(firstRef);
    expect(session.resolve("alpha", "STRUCTURE", firstRef!)).toBeUndefined();
  });

  it("requires every MatchRuntime to receive an explicit live-match reference namespace", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const spec = createMicroSimulationSpec({
      seed: "controller-reference-runtime-ownership",
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });

    expect(() => new MatchRuntime(spec)).toThrow(
      "controller reference namespace is required",
    );
  });

  it("keeps memory-stored public refs resolvable across production worker replacement", async () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-reference-worker-recycle",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "beta"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
        initialStructureGrants: [
          {
            structureId: "alpha-fort",
            ownerId: "alpha",
            type: "FORT",
            cellId: 1,
            level: 1,
          },
        ],
      }),
      { controllerReferenceNamespace: "controller-reference-worker-recycle" },
    );
    const base = match.snapshot();
    const created = createMobileUnit(
      base.map,
      base.factions.map((faction) => faction.id),
      base,
      {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId: 0,
      },
    );
    const state = createProspectiveMatchState(base, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    });
    const references = match.controllerReferenceSession();
    references.reconcile(state);
    const querySession = () =>
      createControllerQuerySession(
        state,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        references,
      );

    const artifact = Object.freeze({
      moduleSource: `
        export async function decide(context) {
          if (context.memory.refs === undefined) {
            const faction = context.factions
              .find()
              .find((candidate) => candidate.relation === "SELF");
            const units = await context.units.find({ types: "TANK", limit: 1 });
            const structures = await context.structures.find({
              types: "FORT",
              limit: 1,
            });
            if (
              faction === undefined ||
              units.items.length !== 1 ||
              structures.items.length !== 1
            ) {
              throw new Error("expected initial public refs");
            }
            const refs = {
              faction: faction.ref,
              unit: units.items[0].ref,
              structure: structures.items[0].ref,
            };
            return {
              commands: [],
              memory: { refs },
              log: JSON.stringify({ phase: "stored", refs }),
            };
          }

          const stored = context.memory.refs;
          const faction = context.factions.get(stored.faction);
          const unit = await context.units.get({ ref: stored.unit });
          const structure = await context.structures.get({ ref: stored.structure });
          return {
            commands: [],
            memory: context.memory,
            log: JSON.stringify({
              phase: "resolved",
              stored,
              resolved: {
                faction: faction?.ref,
                unit: unit?.ref,
                structure: structure?.ref,
              },
            }),
          };
        }
      `,
      entrypoints: Object.freeze({ decide: "decide" }),
    }) satisfies ControllerRuntimeArtifact;

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    const host = new ProductionControllerHost(pool, { alpha: artifact });
    const observation = Object.freeze({}) as unknown as Parameters<
      ProductionControllerHost["invoke"]
    >[1];
    try {
      const first = await host.invoke("alpha", observation, querySession());
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error("expected first production controller decision");
      const stored = JSON.parse(first.output?.log ?? "{}");
      expect(stored.phase).toBe("stored");
      expect(stored.refs.faction).not.toBe("alpha");
      expect(stored.refs.unit).not.toBe(created.unit.id);
      expect(stored.refs.structure).not.toBe("alpha-fort");

      const priorPid = pool.workerProcessIds()[0];
      if (priorPid === undefined) throw new Error("expected worker pid");
      process.kill(priorPid, "SIGKILL");
      await waitForWorkerReplacement(pool, priorPid);

      const second = await host.invoke("alpha", observation, querySession());
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error("expected replacement-worker decision");
      const resolved = JSON.parse(second.output?.log ?? "{}");
      expect(resolved).toEqual({
        phase: "resolved",
        stored: stored.refs,
        resolved: stored.refs,
      });
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("ends an operation incarnation when the same key is replaced by another directive kind", () => {
    const base = operationBaseState();
    const incomingId = 'land:["beta","attack"]';
    const landId = 'land:["alpha","north"]';
    const counterId = 'counter:["alpha","north"]';
    const incoming = Object.freeze({
      id: incomingId,
      controllerKey: "attack",
      kind: "ATTACK" as const,
      ownerId: "beta",
      targetFactionId: "alpha",
      committedPopulation: 1,
      source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([1]) }),
      target: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
    });
    const initial = createProspectiveMatchState(base, {
      operations: Object.freeze([
        Object.freeze({
          id: landId,
          controllerKey: "north",
          kind: "NEUTRAL_EXPANSION" as const,
          ownerId: "alpha",
          committedPopulation: 1,
          source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
          target: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([1]) }),
        }),
        incoming,
      ]),
    });
    const session = new ControllerReferenceSession("kind-match", initial);
    const firstRef = session.issue("alpha", "OPERATION", landId);
    expect(firstRef).toBeDefined();

    session.applyDirectiveChanges("alpha", {
      set: [
        {
          kind: "COUNTER_RESPONSE",
          key: "north",
          incomingOperationId: incomingId,
          population: 1,
        },
      ],
    });
    const replaced = createProspectiveMatchState(initial, {
      operations: Object.freeze([
        Object.freeze({
          id: counterId,
          controllerKey: "north",
          kind: "COUNTER_RESPONSE" as const,
          ownerId: "alpha",
          incomingOperationId: incomingId,
          committedPopulation: 1,
        }),
        incoming,
      ]),
    });
    session.reconcile(replaced);

    const replacementRef = session.issue("alpha", "OPERATION", counterId);
    expect(replacementRef).toBeDefined();
    expect(replacementRef).not.toBe(firstRef);
    expect(session.resolve("alpha", "OPERATION", firstRef!)).toBeUndefined();
  });
});