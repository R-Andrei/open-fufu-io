import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import {
  effectiveStructureConstructionTicks,
  effectiveStructureRechargeTicks,
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructureState,
  resolvePersistentStructureLifecycleTick,
  tryBeginStructureUpgrade,
  tryMaterializeStructureBuild,
  type PersistentStructureState,
} from "../src/simulation/Structures";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function originRules(ids: readonly ("N06" | "N07" | "N17")[]) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(ids));
}

function echoRules(key: string, magnitudeBp: number) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [
      echoRuleContribution(key, "BENEFICIAL", magnitudeBp, `test:${key}:${magnitudeBp}`),
    ],
  });
}

function stateForTerrain(
  terrain: readonly ("PLAINS" | "TUNDRA" | "SHALLOW_WATER" | "DEEP_WATER")[],
) {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "structure-lifecycle-red",
      width: terrain.length,
      height: 1,
      terrain,
      initialOwners: terrain.map((cell) =>
        cell === "PLAINS" || cell === "TUNDRA" ? "alpha" : null,
      ),
      factions: [{ id: "alpha", rules }],
    }),
  );
}

function stateWithFactions(options: {
  readonly terrain: readonly ("PLAINS" | "DEEP_WATER")[];
  readonly owners: readonly (string | null)[];
  readonly factions: readonly {
    readonly id: string;
    readonly rules: ReturnType<typeof emptyRules>;
  }[];
}) {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "structure-lifecycle-capture",
      width: options.terrain.length,
      height: 1,
      terrain: options.terrain,
      initialOwners: options.owners,
      factions: options.factions,
    }),
  );
}

function withStructures(
  state: ReturnType<typeof stateWithFactions> | ReturnType<typeof stateForTerrain>,
  structures: readonly PersistentStructureState[],
) {
  return createProspectiveMatchState(state, { structures });
}

describe("persistent structure construction lifecycle", () => {
  it("progresses fresh construction once per tick and activates atomically on the exact boundary", () => {
    const base = stateForTerrain(["PLAINS"]);
    const constructing = createProspectiveMatchState(base, {
      structures: [
        materializePersistentStructureState({
          id: "city-a",
          ownerId: "alpha",
          type: "CITY",
          cellId: 0,
          active: false,
          construction: { targetLevel: 1, remainingTicks: 2 },
          acquisitionPath: "PURCHASE_BUILD",
        }),
      ],
    });
    const engine = new TickEngine();

    const oneBefore = engine.advance(constructing, []);
    expect(oneBefore.structures).toEqual([
      expect.objectContaining({
        id: "city-a",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 1 },
      }),
    ]);
    expect(oneBefore.structures[0]?.completedLevel).toBeUndefined();

    const completed = engine.advance(oneBefore, []);
    expect(completed.structures).toEqual([
      expect.objectContaining({
        id: "city-a",
        active: true,
        completedLevel: 1,
      }),
    ]);
    expect(completed.structures[0]?.construction).toBeUndefined();

    const after = engine.advance(completed, []);
    expect(after.structures).toEqual(completed.structures);
  });

  it("materializes paid construction as physical inactive state and supports a direct L5 target without hidden levels", () => {
    const base = stateForTerrain(["PLAINS"]);
    const l1 = tryMaterializeStructureBuild(base, {
      structureId: "city-l1",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      level: 1,
    });
    expect(l1).toEqual({
      ok: true,
      structure: expect.objectContaining({
        id: "city-l1",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 50 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
      structures: expect.any(Array),
    });
    if (!l1.ok) throw new Error("expected L1 build admission");
    expect(l1.structure.completedLevel).toBeUndefined();

    const l5Base = stateForTerrain(["PLAINS"]);
    const l5 = tryMaterializeStructureBuild(l5Base, {
      structureId: "city-l5",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      level: 5,
    });
    expect(l5).toEqual({
      ok: true,
      structure: expect.objectContaining({
        id: "city-l5",
        active: false,
        construction: { targetLevel: 5, remainingTicks: 50 },
      }),
      structures: expect.any(Array),
    });
    if (!l5.ok) throw new Error("expected direct L5 build admission");
    expect(l5.structure.completedLevel).toBeUndefined();
  });

  it("ceil-finalizes effective construction ticks after rule composition and rejects non-positive results", () => {
    const modified = stateWithFactions({
      terrain: ["PLAINS"],
      owners: ["alpha"],
      factions: [
        {
          id: "alpha",
          rules: echoRules("structure.CITY.construction_time", 500),
        },
      ],
    });
    expect(effectiveStructureConstructionTicks(modified, "alpha", "CITY")).toBe(48);

    const invalid = stateWithFactions({
      terrain: ["PLAINS"],
      owners: ["alpha"],
      factions: [
        {
          id: "alpha",
          rules: echoRules("structure.CITY.construction_time", 10_000),
        },
      ],
    });
    expect(() => effectiveStructureConstructionTicks(invalid, "alpha", "CITY")).toThrow(
      /positive/i,
    );
  });

  it("begins an ordinary upgrade without disabling or exposing the target early, and rejects max-level/N06 upgrades", () => {
    const base = stateForTerrain(["PLAINS"]);
    const l1 = withStructures(base, [
      materializePersistentStructureState({
        id: "city-upgrade",
        ownerId: "alpha",
        type: "CITY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }),
    ]);
    const upgrading = tryBeginStructureUpgrade(l1, {
      structureId: "city-upgrade",
      ownerId: "alpha",
    });
    expect(upgrading).toEqual({
      ok: true,
      structure: expect.objectContaining({
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 50 },
      }),
      structures: expect.any(Array),
    });

    const l5 = withStructures(base, [
      materializePersistentStructureState({
        id: "city-max",
        ownerId: "alpha",
        type: "CITY",
        cellId: 0,
        completedLevel: 5,
        active: true,
        acquisitionPath: "GRANT",
      }),
    ]);
    expect(tryBeginStructureUpgrade(l5, {
      structureId: "city-max",
      ownerId: "alpha",
    })).toEqual({ ok: false, failure: { code: "MAX_LEVEL" } });

    const n06Base = stateWithFactions({
      terrain: ["PLAINS"],
      owners: ["alpha"],
      factions: [{ id: "alpha", rules: originRules(["N06"]) }],
    });
    const n06 = withStructures(n06Base, [
      materializePersistentStructureState({
        id: "city-n06",
        ownerId: "alpha",
        type: "CITY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }),
    ]);
    expect(tryBeginStructureUpgrade(n06, {
      structureId: "city-n06",
      ownerId: "alpha",
    })).toEqual({ ok: false, failure: { code: "UPGRADE_NOT_PERMITTED" } });
  });

  it("captures incomplete work before progress and completes a remaining-1 structure under the new owner", () => {
    const base = stateWithFactions({
      terrain: ["PLAINS", "PLAINS"],
      owners: ["beta", "beta"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    });
    const state = withStructures(base, [
      materializePersistentStructureState({
        id: "fresh-two",
        ownerId: "beta",
        type: "CITY",
        cellId: 0,
        active: false,
        construction: { targetLevel: 1, remainingTicks: 2 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
      materializePersistentStructureState({
        id: "fresh-one",
        ownerId: "beta",
        type: "FORT",
        cellId: 1,
        active: false,
        construction: { targetLevel: 1, remainingTicks: 1 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
    ]);

    const resolved = resolvePersistentStructureLifecycleTick(
      state,
      ["alpha", "alpha"],
      1,
    );
    expect(resolved).toEqual([
      expect.objectContaining({
        id: "fresh-one",
        ownerId: "alpha",
        completedLevel: 1,
        active: true,
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
      expect.objectContaining({
        id: "fresh-two",
        ownerId: "alpha",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 1 },
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ]);
    expect(resolved.find((entry) => entry.id === "fresh-one")?.construction).toBeUndefined();
  });

  it("preserves the previous completed level during a captured upgrade until atomic completion", () => {
    const base = stateWithFactions({
      terrain: ["PLAINS"],
      owners: ["beta"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    });
    const state = withStructures(base, [
      materializePersistentStructureState({
        id: "fort-upgrade",
        ownerId: "beta",
        type: "FORT",
        cellId: 0,
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 2 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
    ]);
    const first = resolvePersistentStructureLifecycleTick(state, ["alpha"], 1);
    expect(first[0]).toEqual(expect.objectContaining({
      ownerId: "alpha",
      completedLevel: 1,
      active: true,
      construction: { targetLevel: 2, remainingTicks: 1 },
      acquisitionPath: "CAPTURE_TRANSFER",
    }));

    const transferred = createProspectiveMatchState(state, {
      ownership: ["alpha"],
      structures: first,
    });
    const second = resolvePersistentStructureLifecycleTick(transferred, ["alpha"], 2);
    expect(second[0]).toEqual(expect.objectContaining({
      ownerId: "alpha",
      completedLevel: 2,
      active: true,
    }));
    expect(second[0]?.construction).toBeUndefined();
  });

  it("applies N17 destruction and deterministic N07 capture-slot admission without undoing territorial capture", () => {
    const n17Base = stateWithFactions({
      terrain: ["PLAINS"],
      owners: ["beta"],
      factions: [
        { id: "alpha", rules: originRules(["N17"]) },
        { id: "beta", rules: emptyRules() },
      ],
    });
    const n17State = withStructures(n17Base, [
      materializePersistentStructureState({
        id: "factory-cut",
        ownerId: "beta",
        type: "FACTORY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }),
    ]);
    expect(resolvePersistentStructureLifecycleTick(n17State, ["alpha"], 1)).toEqual([]);

    const n07Base = stateWithFactions({
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      owners: ["alpha", "beta", "gamma"],
      factions: [
        { id: "alpha", rules: originRules(["N07"]) },
        { id: "beta", rules: emptyRules() },
        { id: "gamma", rules: emptyRules() },
      ],
    });
    const n07State = withStructures(n07Base, [
      materializePersistentStructureState({
        id: "factory-z",
        ownerId: "beta",
        type: "FACTORY",
        cellId: 1,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }),
      materializePersistentStructureState({
        id: "factory-a",
        ownerId: "gamma",
        type: "FACTORY",
        cellId: 2,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }),
    ]);
    const resolved = resolvePersistentStructureLifecycleTick(
      n07State,
      ["alpha", "alpha", "alpha"],
      1,
    );
    expect(resolved).toEqual([
      expect.objectContaining({
        id: "factory-z",
        cellId: 1,
        ownerId: "alpha",
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ]);
  });

  it("ceil-finalizes and snapshots Silo recharge duration when an upgrade adds a slot", () => {
    const base = stateWithFactions({
      terrain: ["PLAINS"],
      owners: ["alpha"],
      factions: [
        {
          id: "alpha",
          rules: echoRules("silo.recharge_time", 500),
        },
      ],
    });
    expect(effectiveStructureRechargeTicks(base, "alpha", "MISSILE_SILO")).toBe(86);

    const state = withStructures(base, [
      materializePersistentStructureState({
        id: "silo-upgrade",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 1 },
        chargeSlots: [{ slotId: 0, state: "READY" }],
        acquisitionPath: "GRANT",
      }),
    ]);
    const resolved = resolvePersistentStructureLifecycleTick(state, ["alpha"], 10);
    expect(resolved[0]).toEqual(expect.objectContaining({
      completedLevel: 2,
      active: true,
      chargeSlots: [
        { slotId: 0, state: "READY" },
        { slotId: 1, state: "RECHARGING", readyAtTick: 96 },
      ],
    }));
  });

  it("rejects malformed authoritative construction timing before it can enter state", () => {
    expect(() =>
      materializePersistentStructureState({
        id: "bad-city",
        ownerId: "alpha",
        type: "CITY",
        cellId: 0,
        active: false,
        construction: { targetLevel: 1, remainingTicks: Number.NaN },
        acquisitionPath: "PURCHASE_BUILD",
      }),
    ).toThrow(/remainingTicks/i);
  });

  it("rejects skipped upgrade target levels before they can enter authoritative state", () => {
    expect(() =>
      materializePersistentStructureState({
        id: "bad-upgrade",
        ownerId: "alpha",
        type: "CITY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 5, remainingTicks: 10 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
    ).toThrow(/next level/i);
  });

  it("admits an exact-cell Port only with a cardinal Deep-Water interface", () => {
    const deepCoast = stateForTerrain(["PLAINS", "DEEP_WATER"]);
    const deepAdmission = evaluateStructureAcquisitionAdmission(deepCoast, {
      structureId: "port-deep",
      ownerId: "alpha",
      type: "PORT",
      cellId: 0,
      level: 1,
      acquisitionPath: "PURCHASE_BUILD",
    });
    expect(deepAdmission).toEqual({ ok: true });

    const shallowOnly = stateForTerrain(["PLAINS", "SHALLOW_WATER"]);
    const shallowAdmission = evaluateStructureAcquisitionAdmission(shallowOnly, {
      structureId: "port-shallow",
      ownerId: "alpha",
      type: "PORT",
      cellId: 0,
      level: 1,
      acquisitionPath: "PURCHASE_BUILD",
    });
    expect(shallowAdmission).toEqual({
      ok: false,
      failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
    });
  });

  it("keeps general coast projection land-sided even when Shallow Water borders Deep Water", async () => {
    const state = stateForTerrain(["PLAINS", "SHALLOW_WATER", "DEEP_WATER"]);
    const session = createControllerQuerySession(state, "alpha", {
      queriesPerDecision: 8,
      materializedCellsPerDecision: 8,
    });

    expect((await session.cells.get(0))?.isCoast).toBe(true);
    expect((await session.cells.get(1))?.isCoast).toBe(false);
    expect((await session.cells.get(1))?.isShoreline).toBe(true);
  });

  it("atomically swaps a Fort field to the newly completed level", async () => {
    const terrain = Array.from({ length: 40 }, () => "PLAINS" as const);
    const base = stateForTerrain(terrain);
    const state = withStructures(base, [
      materializePersistentStructureState({
        id: "fort-field",
        ownerId: "alpha",
        type: "FORT",
        cellId: 0,
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 1 },
        acquisitionPath: "GRANT",
      }),
    ]);
    const before = createControllerQuerySession(state, "alpha", {
      queriesPerDecision: 4,
      materializedCellsPerDecision: 4,
    });
    expect(await before.cells.count({
      kind: "STRUCTURE_FIELD_INSTANCE",
      structureId: "fort-field",
      field: "FORT",
    })).toBe(31);

    const structures = resolvePersistentStructureLifecycleTick(state, state.ownership, 1);
    const completed = createProspectiveMatchState(state, { structures });
    const after = createControllerQuerySession(completed, "alpha", {
      queriesPerDecision: 4,
      materializedCellsPerDecision: 4,
    });
    expect(await after.cells.count({
      kind: "STRUCTURE_FIELD_INSTANCE",
      structureId: "fort-field",
      field: "FORT",
    })).toBe(36);
  });

  it("keeps in-progress lifecycle state deterministic in canonical serialization regardless of input order", () => {
    const base = stateWithFactions({
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", "alpha"],
      factions: [{ id: "alpha", rules: emptyRules() }],
    });
    const a = materializePersistentStructureState({
      id: "a",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      active: false,
      construction: { targetLevel: 1, remainingTicks: 17 },
      acquisitionPath: "PURCHASE_BUILD",
    });
    const b = materializePersistentStructureState({
      id: "b",
      ownerId: "alpha",
      type: "FORT",
      cellId: 1,
      completedLevel: 1,
      active: true,
      construction: { targetLevel: 2, remainingTicks: 9 },
      acquisitionPath: "GRANT",
    });
    const left = createProspectiveMatchState(base, { structures: [a, b] });
    const right = createProspectiveMatchState(base, { structures: [b, a] });
    expect(canonicalMatchStateSerialization(left)).toBe(
      canonicalMatchStateSerialization(right),
    );
  });
});
