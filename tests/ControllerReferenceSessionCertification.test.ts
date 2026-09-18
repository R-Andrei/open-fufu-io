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
          type: "CITY",
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
              memory: { refs },
              log: JSON.stringify({ phase: "stored", refs }),
            };
          }

          const stored = context.memory.refs;
          const faction = context.factions.get(stored.faction);
          const unit = await context.units.get({ ref: stored.unit });
          const structure = await context.structures.get({ ref: stored.structure });
          return {
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

  it("proves exact entity find limits and deterministic visible ordering", async () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const width = 129;
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-entity-find-certification-boundaries",
        width,
        height: 1,
        terrain: Array.from({ length: width }, () => "PLAINS"),
        initialOwners: Array.from({ length: width }, () => "alpha"),
        factions: [{ id: "alpha", rules }],
      }),
    );
    let units = {
      mobileUnits: base.mobileUnits,
      nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
    };
    for (let cellId = 0; cellId < width; cellId += 1) {
      units = createMobileUnit(base.map, ["alpha"], units, {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId,
      });
    }
    const state = createProspectiveMatchState(base, units);
    const references = new ControllerReferenceSession(
      "controller-entity-find-certification-boundaries",
      state,
    );
    const fresh = () =>
      createControllerQuerySession(state, "alpha", CONTROLLER_QUERY_LIMITS, references);

    const below = await fresh().units.find({ limit: 127 });
    expect(below.items).toHaveLength(127);
    expect(below.items[0]?.cellId).toBe(0);
    expect(below.items[126]?.cellId).toBe(126);
    expect(below.truncated).toBe(true);

    const exact = await fresh().units.find({ limit: 128 });
    expect(exact.items).toHaveLength(128);
    expect(exact.items[127]?.cellId).toBe(127);
    expect(exact.truncated).toBe(true);

    const omitted = await fresh().units.find();
    expect(omitted.items).toHaveLength(128);
    expect(omitted.truncated).toBe(true);

    for (const invalid of [
      0,
      -1,
      129,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      await expect(fresh().units.find({ limit: invalid })).rejects.toThrow(
        "safe integer from 1 to 128",
      );
    }
  });

  it("composes faction, type-array, and Euclidean location filters with deterministic order", async () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const width = 30;
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-entity-filter-certification",
        width,
        height: 1,
        terrain: Array.from({ length: width }, () => "PLAINS"),
        initialOwners: Array.from({ length: width }, () => "alpha"),
        factions: [{ id: "alpha", rules }],
        initialStructureGrants: [
          {
            structureId: "filter-fort",
            ownerId: "alpha",
            type: "FORT",
            cellId: 10,
            level: 1,
          },
          {
            structureId: "filter-city",
            ownerId: "alpha",
            type: "CITY",
            cellId: 20,
            level: 1,
          },
        ],
      }),
    );
    let units = createMobileUnit(base.map, ["alpha"], base, {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    units = createMobileUnit(base.map, ["alpha"], units, {
      ownerId: "alpha",
      type: "HEAVY_ARTILLERY",
      movementClass: "HEAVY_ARTILLERY",
      cellId: 1,
    });
    units = createMobileUnit(base.map, ["alpha"], units, {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 2,
    });
    const state = createProspectiveMatchState(base, {
      mobileUnits: units.mobileUnits,
      nextMobileUnitOrdinal: units.nextMobileUnitOrdinal,
    });
    const references = new ControllerReferenceSession(
      "controller-entity-filter-certification",
      state,
    );
    const selfRef = references.issueFaction("alpha");
    if (selfRef === undefined) throw new Error("expected self faction ref");
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );

    const foundUnits = await session.units.find({
      faction: selfRef,
      types: ["HEAVY_ARTILLERY", "TANK"],
      location: { cellId: 1, radius: 1 },
      limit: 3,
    });
    expect(foundUnits.items.map((unit) => unit.cellId)).toEqual([0, 1, 2]);
    expect(foundUnits.truncated).toBe(false);

    const foundStructures = await session.structures.find({
      faction: selfRef,
      types: ["CITY", "FORT"],
      location: { cellId: 15, radius: 5 },
      limit: 2,
    });
    expect(foundStructures.items.map((structure) => structure.cellId)).toEqual([
      10,
      20,
    ]);
    expect(foundStructures.truncated).toBe(false);

    expect(
      await session.structures.find({
        types: "FORT",
        location: { cellId: 20 },
      }),
    ).toEqual({ items: [], truncated: false });
  });

  it("orders faction discovery by stable ref and proximity by Euclidean distance then ref", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-faction-proximity-certification",
        width: 3,
        height: 3,
        terrain: Array.from({ length: 9 }, () => "PLAINS"),
        initialOwners: [
          "delta",
          "beta",
          null,
          "gamma",
          "alpha",
          null,
          null,
          null,
          null,
        ],
        factions: [
          { id: "gamma", rules },
          { id: "alpha", rules },
          { id: "delta", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const references = new ControllerReferenceSession(
      "controller-faction-proximity-certification",
      state,
    );
    const betaRef = references.issueFaction("beta");
    const deltaRef = references.issueFaction("delta");
    const gammaRef = references.issueFaction("gamma");
    if (betaRef === undefined || deltaRef === undefined || gammaRef === undefined) {
      throw new Error("expected enemy faction refs");
    }
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );

    expect(session.factions.find({ relation: "ENEMY" }).map((view) => view.ref)).toEqual(
      [betaRef, deltaRef, gammaRef].sort(),
    );
    const tiedNear = [betaRef, gammaRef].sort();
    expect(
      session.factions
        .find({ relation: "ENEMY", orderBy: "PROXIMITY" })
        .map((view) => view.ref),
    ).toEqual([...tiedNear, deltaRef]);
    expect(session.factions.proximity(betaRef)).toBe(1);
    expect(session.factions.proximity(gammaRef)).toBe(1);
    expect(session.factions.proximity(deltaRef)).toBeCloseTo(Math.SQRT2);
  });

  it("proves the shared entity materialization boundary at 511, 512, and blocked 513 while faction reads stay free", async () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const width = 514;
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "controller-entity-materialization-certification",
        width,
        height: 1,
        terrain: Array.from({ length: width }, () => "PLAINS"),
        initialOwners: Array.from({ length: width }, () => "alpha"),
        factions: [{ id: "alpha", rules }],
        initialStructureGrants: [
          {
            structureId: "materialization-fort",
            ownerId: "alpha",
            type: "FORT",
            cellId: width - 1,
            level: 1,
          },
        ],
      }),
    );
    let units = {
      mobileUnits: base.mobileUnits,
      nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
    };
    for (let cellId = 0; cellId < 513; cellId += 1) {
      units = createMobileUnit(base.map, ["alpha"], units, {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId,
      });
    }
    const state = createProspectiveMatchState(base, units);
    const references = new ControllerReferenceSession(
      "controller-entity-materialization-certification",
      state,
    );
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );

    expect(await session.units.count()).toBe(513);
    expect(session.usage().materializedEntityViews).toBe(0);

    for (let page = 0; page < 3; page += 1) {
      expect((await session.units.find({ limit: 128 })).items).toHaveLength(128);
    }
    expect((await session.units.find({ limit: 127 })).items).toHaveLength(127);
    expect(session.usage().materializedEntityViews).toBe(511);

    expect(await session.units.get({ cellId: 0 })).toBeDefined();
    expect(session.usage().materializedEntityViews).toBe(512);

    expect(session.factions.find()).toHaveLength(1);
    expect(session.usage().materializedEntityViews).toBe(512);

    await expect(session.structures.get({ cellId: width - 1 })).rejects.toThrow(
      "materialization budget exhausted",
    );
    expect(session.usage().materializedEntityViews).toBe(512);
  });

  it("enforces the production worker shared read ceiling at 128, rejects 129, and remains reusable", async () => {
    const state = collidingStructureState("worker-query-budget-fort");
    const references = new ControllerReferenceSession(
      "worker-query-budget-certification",
      state,
    );
    const freshSession = () =>
      createControllerQuerySession(
        state,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        references,
      );
    const artifact = Object.freeze({
      moduleSource: `
        export async function decide(context) {
          for (let index = 0; index < 127; index += 1) {
            context.factions.find();
          }
          const count = await context.units.count();
          let blocked = false;
          try {
            await context.structures.count();
          } catch {
            blocked = true;
          }
          return {
            log: JSON.stringify({ count, blocked }),
          };
        }
      `,
      entrypoints: Object.freeze({ decide: "decide" }),
    }) satisfies ControllerRuntimeArtifact;
    const request = Object.freeze({
      factionId: "alpha",
      artifact,
      hook: "DECIDE" as const,
      entrypoint: "decide",
      context: Object.freeze({ tick: 1 }),
      memoryJson: "{}",
      timeoutMs: 20_000,
      moduleEvaluationTimeoutMs: 100,
      isolateMemoryMb: 32,
    });

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const response = await pool.invoke(request, freshSession());
      expect(response.ok).toBe(true);
      if (!response.ok) throw new Error("expected worker query-budget probe success");
      expect(JSON.parse(response.output?.log ?? "{}")).toEqual({
        count: 0,
        blocked: true,
      });
      expect(response.usage).toEqual({ queries: 128, materializedCells: 0 });
      expect(
        (
          response.usage as typeof response.usage & {
            readonly materializedEntityViews: number;
          }
        ).materializedEntityViews,
      ).toBe(0);

      const healthyArtifact = Object.freeze({
        moduleSource:
          'export function decide() { return { log: "reused" }; }',
        entrypoints: Object.freeze({ decide: "decide" }),
      }) satisfies ControllerRuntimeArtifact;
      const healthy = await pool.invoke(
        Object.freeze({ ...request, artifact: healthyArtifact }),
        freshSession(),
      );
      expect(healthy).toEqual({
        ok: true,
        output: { log: "reused" },
        usage: { queries: 0, materializedCells: 0 },
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
  });
});