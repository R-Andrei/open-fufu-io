import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { resolvePersistentStructureLifecycleTick } from "../src/simulation/Structures";
import {
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructures,
  tryMaterializeStructureGrant,
} from "../src/simulation/StructuresCore";
import { advanceTankProductionPhase } from "../src/simulation/Tanks";
import {
  advanceWarshipProductionPhase,
  tryStartWarshipProduction,
  warshipPurchaseCost,
} from "../src/simulation/Warships";

function baseState(seed: string, width = 6) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(createMicroSimulationSpec({
    seed,
    width,
    height: 1,
    terrain: Array.from({ length: width }, () => "PLAINS" as const),
    initialOwners: Array.from({ length: width }, () => "alpha"),
    factions: [{ id: "alpha", rules }, { id: "beta", rules }],
  }));
}

function structure(id: string, cellId: number) {
  return {
    id,
    ownerId: "alpha",
    type: "FACTORY" as const,
    cellId,
    outputCellId: Math.max(0, cellId - 1),
    completedLevel: 1 as const,
    active: true,
    acquisitionPath: "GRANT" as const,
  };
}

function warshipProductionFixture(ffy: number, blocked = false) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  const base = createInitialMatchState(createMicroSimulationSpec({
    seed: blocked ? "warship-production-blocked-red" : "warship-production-red",
    width: 3,
    height: 1,
    terrain: ["DEEP_WATER", "PLAINS", "DEEP_WATER"],
    initialOwners: [null, "alpha", null],
    factions: [{ id: "alpha", rules }],
  }));
  const withPort = createProspectiveMatchState(base, {
    factions: base.factions.map((faction) => ({ ...faction, ffy })),
    structures: [
      {
        id: "port-a",
        ownerId: "alpha",
        type: "PORT",
        cellId: 1,
        outputCellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
  });
  if (!blocked) return withPort;
  const blocker = createMobileUnit(
    withPort.map,
    withPort.factions.map((faction) => faction.id),
    withPort,
    {
      ownerId: "alpha",
      type: "TRADE_SHIP",
      movementClass: "NAVAL",
      cellId: 0,
    },
  );
  return createProspectiveMatchState(withPort, {
    mobileUnits: blocker.mobileUnits,
    nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
  });
}

function runWarshipProductionPhases(
  state: ReturnType<typeof warshipProductionFixture>,
  count: number,
) {
  let current = state;
  for (let tick = 0; tick < count; tick += 1) {
    current = advanceWarshipProductionPhase(current);
  }
  return current;
}

describe("physical occupancy admission", () => {
  it("rejects duplicate persistent-structure cells during materialization", () => {
    expect(() => materializePersistentStructures([
      {
        id: "city-a", ownerId: "alpha", type: "CITY", cellId: 2,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
      {
        id: "city-b", ownerId: "beta", type: "CITY", cellId: 2,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
    ])).toThrow(/occup/i);
  });

  it("rejects duplicate persistent-structure identities during materialization", () => {
    expect(() => materializePersistentStructures([
      {
        id: "city-a", ownerId: "alpha", type: "CITY", cellId: 2,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
      {
        id: "city-a", ownerId: "beta", type: "CITY", cellId: 3,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
    ])).toThrow(/identity|conflict|duplicate/i);
  });

  it("rejects structure acquisition on a cell occupied by a mobile unit", () => {
    const base = baseState("occupancy-structure-admission");
    const created = createMobileUnit(base.map, base.factions.map((f) => f.id), base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 2,
    });
    const occupied = createProspectiveMatchState(base, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    });
    expect(evaluateStructureAcquisitionAdmission(occupied, {
      structureId: "factory-a", ownerId: "alpha", type: "FACTORY", cellId: 2,
      level: 1, acquisitionPath: "GRANT",
    })).toEqual({ ok: false, failure: { code: "CELL_OCCUPIED" } });
  });

  it.each(["GRANT", "PURCHASE_BUILD"] as const)(
    "rejects Factory %s acquisition when no legal Tank output cell can be designated",
    (acquisitionPath) => {
      const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
      const state = createInitialMatchState(createMicroSimulationSpec({
        seed: `producer-output-no-fallback-${acquisitionPath}`,
        width: 3,
        height: 1,
        terrain: ["DEEP_WATER", "PLAINS", "DEEP_WATER"],
        initialOwners: [null, "alpha", null],
        factions: [{ id: "alpha", rules }],
      }));

      expect(evaluateStructureAcquisitionAdmission(state, {
        structureId: "factory-no-output",
        ownerId: "alpha",
        type: "FACTORY",
        cellId: 1,
        level: 1,
        acquisitionPath,
      })).toEqual({
        ok: false,
        failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
      });
    },
  );

  it.each(["GRANT", "PURCHASE_BUILD"] as const)(
    "rejects Port %s acquisition when no Deep-Water dock can be designated",
    (acquisitionPath) => {
      const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
      const state = createInitialMatchState(createMicroSimulationSpec({
        seed: `producer-port-no-dock-${acquisitionPath}`,
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "alpha"],
        factions: [{ id: "alpha", rules }],
      }));

      expect(evaluateStructureAcquisitionAdmission(state, {
        structureId: "port-no-dock",
        ownerId: "alpha",
        type: "PORT",
        cellId: 1,
        level: 1,
        acquisitionPath,
      })).toEqual({
        ok: false,
        failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
      });
    },
  );

  it("selects the lowest stable cell id when producer output candidates tie", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const state = createInitialMatchState(createMicroSimulationSpec({
      seed: "producer-output-deterministic-tie",
      width: 3,
      height: 3,
      terrain: Array.from({ length: 9 }, () => "PLAINS" as const),
      initialOwners: Array.from({ length: 9 }, () => "alpha"),
      factions: [{ id: "alpha", rules }],
    }));
    const granted = tryMaterializeStructureGrant(state, {
      structureId: "factory-tie",
      ownerId: "alpha",
      type: "FACTORY",
      cellId: 4,
      level: 1,
    });

    expect(granted.ok).toBe(true);
    if (!granted.ok) throw new Error("expected Factory grant admission");
    expect(granted.structure.outputCellId).toBe(1);
  });

  it("serializes the persisted designated producer output cell", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const base = createInitialMatchState(createMicroSimulationSpec({
      seed: "producer-output-serialization-red",
      width: 3,
      height: 3,
      terrain: Array.from({ length: 9 }, () => "PLAINS" as const),
      initialOwners: Array.from({ length: 9 }, () => "alpha"),
      factions: [{ id: "alpha", rules }],
    }));
    const granted = tryMaterializeStructureGrant(base, {
      structureId: "factory-serialized",
      ownerId: "alpha",
      type: "FACTORY",
      cellId: 4,
      level: 1,
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) throw new Error("expected Factory grant admission");
    const state = createProspectiveMatchState(base, {
      structures: granted.structures,
    });
    const serialized = JSON.parse(canonicalMatchStateSerialization(state)) as {
      readonly structures: readonly { readonly outputCellId?: number }[];
    };

    expect(serialized.structures[0]?.outputCellId).toBe(1);
  });

  it("preserves designated producer output through construction completion", () => {
    const base = baseState("producer-output-lifecycle-red", 3);
    const constructing = createProspectiveMatchState(base, {
      structures: [
        {
          id: "factory-lifecycle",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 1,
          outputCellId: 0,
          active: false,
          construction: { targetLevel: 1, remainingTicks: 1 },
          acquisitionPath: "PURCHASE_BUILD",
        },
      ],
    });

    const completed = resolvePersistentStructureLifecycleTick(constructing, [], 1);
    expect(completed[0]).toEqual(expect.objectContaining({
      id: "factory-lifecycle",
      completedLevel: 1,
      active: true,
      outputCellId: 0,
    }));
  });

  it("preserves designated producer output through upgrade completion", () => {
    const base = baseState("producer-output-upgrade-lifecycle", 3);
    const upgrading = createProspectiveMatchState(base, {
      structures: [
        {
          id: "factory-upgrade",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 1,
          outputCellId: 0,
          completedLevel: 1,
          active: true,
          construction: { targetLevel: 2, remainingTicks: 1 },
          acquisitionPath: "GRANT",
        },
      ],
    });

    const completed = resolvePersistentStructureLifecycleTick(upgrading, [], 1);
    expect(completed[0]).toEqual(expect.objectContaining({
      id: "factory-upgrade",
      completedLevel: 2,
      active: true,
      outputCellId: 0,
    }));
  });

  it("holds Tank completion on the exact designated slot without rerouting", () => {
    const base = baseState("producer-output-exact-slot", 4);
    const blocker = createMobileUnit(
      base.map,
      base.factions.map((faction) => faction.id),
      base,
      {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId: 2,
      },
    );
    const blocked = createProspectiveMatchState(base, {
      structures: [
        {
          id: "factory-exact-slot",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 1,
          outputCellId: 2,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
      ],
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
      tankProductionJobs: [
        {
          factoryId: "factory-exact-slot",
          ownerId: "alpha",
          chassisType: "TANK",
          strategicDestinationCellId: 0,
          state: "READY_TO_DEPLOY",
        },
      ],
    });

    const waiting = advanceTankProductionPhase(blocked);
    expect(waiting.mobileUnits).toHaveLength(1);
    expect(waiting.mobileUnits[0]?.cellId).toBe(2);
    expect(waiting.tankProductionJobs).toEqual([
      expect.objectContaining({
        factoryId: "factory-exact-slot",
        state: "READY_TO_DEPLOY",
      }),
    ]);

    const cleared = createProspectiveMatchState(waiting, { mobileUnits: [] });
    const deployed = advanceTankProductionPhase(cleared);
    expect(deployed.tankProductionJobs).toHaveLength(0);
    expect(deployed.mobileUnits).toHaveLength(1);
    expect(deployed.mobileUnits[0]).toMatchObject({
      ownerId: "alpha",
      type: "TANK",
      cellId: 2,
    });
  });

  it("uses the baseline active-Warship purchase-cost curve", () => {
    expect(warshipPurchaseCost(0)).toBe(250_000);
    expect(warshipPurchaseCost(1)).toBe(500_000);
    expect(warshipPurchaseCost(2)).toBe(750_000);
    expect(warshipPurchaseCost(3)).toBe(1_000_000);
    expect(warshipPurchaseCost(4)).toBe(1_000_000);
  });

  it("builds a Warship for 50 ticks and deploys only through the persisted Port dock", () => {
    const initial = warshipProductionFixture(250_000);
    const accepted = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Warship production admission");
    expect(accepted.cost).toBe(250_000);
    expect(accepted.job).toMatchObject({
      portId: "port-a",
      ownerId: "alpha",
      state: "BUILDING",
      remainingTicks: 50,
    });

    const beforeCompletion = runWarshipProductionPhases(accepted.state, 49);
    expect(beforeCompletion.warshipProductionJobs).toEqual([
      expect.objectContaining({
        portId: "port-a",
        state: "BUILDING",
        remainingTicks: 1,
      }),
    ]);
    expect(beforeCompletion.mobileUnits).toHaveLength(0);

    const completed = advanceWarshipProductionPhase(beforeCompletion);
    expect(completed.warshipProductionJobs).toHaveLength(0);
    expect(completed.mobileUnits).toEqual([
      expect.objectContaining({
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 0,
      }),
    ]);
  });

  it("holds completed Warship output on the exact occupied dock and never reroutes", () => {
    const initial = warshipProductionFixture(250_000, true);
    const accepted = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Warship production admission");

    const waiting = runWarshipProductionPhases(accepted.state, 50);
    expect(waiting.mobileUnits).toHaveLength(1);
    expect(waiting.mobileUnits[0]).toMatchObject({
      type: "TRADE_SHIP",
      cellId: 0,
    });
    expect(waiting.warshipProductionJobs).toEqual([
      {
        portId: "port-a",
        ownerId: "alpha",
        state: "READY_TO_DEPLOY",
      },
    ]);
    expect(waiting.mobileUnits.some((unit) => unit.cellId === 2)).toBe(false);

    const cleared = createProspectiveMatchState(waiting, { mobileUnits: [] });
    const deployed = advanceWarshipProductionPhase(cleared);
    expect(deployed.warshipProductionJobs).toHaveLength(0);
    expect(deployed.mobileUnits).toEqual([
      expect.objectContaining({
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 0,
      }),
    ]);
  });
});
