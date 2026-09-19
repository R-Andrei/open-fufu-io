import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { grantPopulation } from "../src/simulation/Population";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { resolvePersistentStructureLifecycleTick } from "../src/simulation/Structures";
import {
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructures,
  tryMaterializeStructureGrant,
} from "../src/simulation/StructuresCore";
import { advanceTankProductionPhase } from "../src/simulation/Tanks";
import {
  completeTradeShipArrival,
  isTradeShipDeliveryCell,
  tryLaunchTradeShipAtPortDock,
} from "../src/simulation/TradeShips";
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

function warshipCapFixture(
  rules: ReturnType<typeof compileRuleProfile>,
  ffy = 1_000_000,
) {
  const base = createInitialMatchState(createMicroSimulationSpec({
    seed: "warship-cap-reservation-red",
    width: 5,
    height: 1,
    terrain: ["DEEP_WATER", "PLAINS", "DEEP_WATER", "PLAINS", "DEEP_WATER"],
    initialOwners: [null, "alpha", null, "alpha", null],
    factions: [{ id: "alpha", rules }],
  }));
  return createProspectiveMatchState(base, {
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
      {
        id: "port-b",
        ownerId: "alpha",
        type: "PORT",
        cellId: 3,
        outputCellId: 4,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
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

  it("keeps baseline Warship ownership uncapped across distinct Ports", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const initial = warshipCapFixture(rules);
    const first = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("expected first baseline Warship admission");

    const second = tryStartWarshipProduction(first.state, {
      ownerId: "alpha",
      portId: "port-b",
      strategicDestinationCellId: 2,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("expected second baseline Warship admission");
    expect(second.state.warshipProductionJobs).toHaveLength(2);
  });

  it("P23 cap=1 counts a committed Warship job and rejects a second Port atomically", () => {
    const rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P23"]),
    );
    const initial = warshipCapFixture(rules);
    const first = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("expected first P23 Warship admission");

    const beforeSecond = first.state;
    const beforeFfy = beforeSecond.factions[0]?.ffy;
    const rejected = tryStartWarshipProduction(beforeSecond, {
      ownerId: "alpha",
      portId: "port-b",
      strategicDestinationCellId: 2,
    });

    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "OWNERSHIP_CAP" },
    });
    expect(rejected.state).toBe(beforeSecond);
    expect(rejected.state.factions[0]?.ffy).toEqual(beforeFfy);
    expect(rejected.state.warshipProductionJobs).toHaveLength(1);
  });

  it("P23 cap=1 counts an active Warship and rejects production without mutation", () => {
    const rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P23"]),
    );
    const initial = warshipCapFixture(rules);
    const created = createMobileUnit(
      initial.map,
      initial.factions.map((faction) => faction.id),
      initial,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 2,
      },
    );
    const withWarship = createProspectiveMatchState(initial, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        {
          unitId: created.unit.id,
          operatingAnchorCellId: created.unit.cellId,
        },
      ],
    });
    const beforeFfy = withWarship.factions[0]?.ffy;

    const rejected = tryStartWarshipProduction(withWarship, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });

    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "OWNERSHIP_CAP" },
    });
    expect(rejected.state).toBe(withWarship);
    expect(rejected.state.factions[0]?.ffy).toEqual(beforeFfy);
    expect(rejected.state.warshipProductionJobs).toHaveLength(0);
  });

  it("N12 rejects Warship production before any resource or reservation mutation", () => {
    const rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["N12"]),
    );
    const initial = warshipCapFixture(rules, 250_000);
    const beforeFfy = initial.factions[0]?.ffy;
    const beforePopulation = initial.factions[0]?.population;

    const rejected = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });

    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "BUILD_NOT_PERMITTED" },
    });
    expect(rejected.state).toBe(initial);
    expect(rejected.state.factions[0]?.ffy).toEqual(beforeFfy);
    expect(rejected.state.factions[0]?.population).toEqual(beforePopulation);
    expect(rejected.state.warshipProductionJobs).toHaveLength(0);
  });

  it("N12 prohibition still wins when P42 replaces the Warship payment", () => {
    const rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["N12", "P42"]),
    );
    const base = warshipCapFixture(rules, 0);
    const initial = createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha"
          ? {
              ...faction,
              population: grantPopulation(faction.population, 2_000),
            }
          : faction,
      ),
    });

    const rejected = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });

    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "BUILD_NOT_PERMITTED" },
    });
    expect(rejected.state).toBe(initial);
    expect(rejected.state.factions[0]?.ffy).toBe(0);
    expect(rejected.state.factions[0]?.population.available).toBe(2_000);
    expect(rejected.state.warshipProductionJobs).toHaveLength(0);
  });

  it("P42 atomically replaces Warship FFY payment with 2000 Available Population", () => {
    const rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P42"]),
    );
    const base = warshipCapFixture(rules, 0);
    const initial = createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha"
          ? {
              ...faction,
              population: grantPopulation(faction.population, 2_000),
            }
          : faction,
      ),
    });

    const accepted = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected P42 Warship admission");
    expect(accepted.cost).toBe(0);
    expect(accepted.state.factions[0]?.ffy).toBe(0);
    expect(accepted.state.factions[0]?.population).toMatchObject({
      total: 0,
      available: 0,
      peakTotal: 2_000,
    });
    expect(accepted.state.warshipProductionJobs).toEqual([
      expect.objectContaining({
        portId: "port-a",
        ownerId: "alpha",
        state: "BUILDING",
        remainingTicks: 50,
      }),
    ]);
  });

  it("P42 rejects insufficient Available Population without partial payment or reservation", () => {
    const rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P42"]),
    );
    const base = warshipCapFixture(rules, 1_000_000);
    const initial = createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha"
          ? {
              ...faction,
              population: grantPopulation(faction.population, 1_999),
            }
          : faction,
      ),
    });
    const beforeFfy = initial.factions[0]?.ffy;
    const beforePopulation = initial.factions[0]?.population;

    const rejected = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });

    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "INSUFFICIENT_POPULATION" },
    });
    expect(rejected.state).toBe(initial);
    expect(rejected.state.factions[0]?.ffy).toEqual(beforeFfy);
    expect(rejected.state.factions[0]?.population).toEqual(beforePopulation);
    expect(rejected.state.warshipProductionJobs).toHaveLength(0);
  });

  it("builds a Warship for 50 ticks and deploys only through the persisted Port dock", () => {
    const initial = warshipProductionFixture(250_000);
    const accepted = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Warship production admission");
    expect(accepted.cost).toBe(250_000);
    expect(accepted.job).toMatchObject({
      portId: "port-a",
      ownerId: "alpha",
      state: "BUILDING",
      remainingTicks: 50,
      strategicDestinationCellId: 2,
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
        strategicDestinationCellId: 2,
      }),
    ]);
  });

  it("holds completed Warship output on the exact occupied dock and never reroutes", () => {
    const initial = warshipProductionFixture(250_000, true);
    const accepted = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
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
        strategicDestinationCellId: 2,
        state: "READY_TO_DEPLOY",
      },
    ]);
    expect(waiting.mobileUnits.some((unit) => unit.cellId === 2)).toBe(false);

    const serializedWaiting = JSON.parse(
      canonicalMatchStateSerialization(waiting),
    ) as {
      readonly structures: readonly {
        readonly id: string;
        readonly outputCellId?: number;
      }[];
      readonly warshipProductionJobs: readonly {
        readonly portId: string;
        readonly ownerId: string;
        readonly strategicDestinationCellId: number;
        readonly state: string;
      }[];
    };
    expect(serializedWaiting.structures).toContainEqual(
      expect.objectContaining({
        id: "port-a",
        outputCellId: 0,
      }),
    );
    expect(serializedWaiting.warshipProductionJobs).toEqual([
      {
        portId: "port-a",
        ownerId: "alpha",
        strategicDestinationCellId: 2,
        state: "READY_TO_DEPLOY",
      },
    ]);

    const cleared = createProspectiveMatchState(waiting, { mobileUnits: [] });
    const deployed = advanceWarshipProductionPhase(cleared);
    expect(deployed.warshipProductionJobs).toHaveLength(0);
    expect(deployed.mobileUnits).toEqual([
      expect.objectContaining({
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 0,
        strategicDestinationCellId: 2,
      }),
    ]);
  });

  it("launches Trade Ships only through the persisted source Port dock", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const base = createInitialMatchState(createMicroSimulationSpec({
      seed: "trade-ship-source-dock-red",
      width: 3,
      height: 1,
      terrain: ["DEEP_WATER", "PLAINS", "DEEP_WATER"],
      initialOwners: [null, "alpha", null],
      factions: [{ id: "alpha", rules }],
    }));
    const source = createProspectiveMatchState(base, {
      structures: [{
        id: "port-source",
        ownerId: "alpha",
        type: "PORT",
        cellId: 1,
        outputCellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }],
    });
    const blocker = createMobileUnit(
      source.map,
      source.factions.map((faction) => faction.id),
      source,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 0,
      },
    );
    const blocked = createProspectiveMatchState(source, {
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
    });

    const rejected = tryLaunchTradeShipAtPortDock(blocked, {
      ownerId: "alpha",
      sourcePortId: "port-source",
    });
    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "DOCK_BLOCKED" },
    });
    expect(rejected.state).toBe(blocked);
    expect(rejected.state.mobileUnits.some((unit) => unit.cellId === 2)).toBe(false);

    const cleared = createProspectiveMatchState(blocked, { mobileUnits: [] });
    const launched = tryLaunchTradeShipAtPortDock(cleared, {
      ownerId: "alpha",
      sourcePortId: "port-source",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade Ship dock launch");
    expect(launched.unit).toMatchObject({
      ownerId: "alpha",
      type: "TRADE_SHIP",
      movementClass: "NAVAL",
      cellId: 0,
    });
    expect(launched.state.mobileUnits.some((unit) => unit.cellId === 2)).toBe(false);
  });

  it("completes Trade Ship service on lawful radius-5 Deep Water without destination-dock serialization", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const terrain = Array.from({ length: 13 }, () => "DEEP_WATER" as const);
    terrain[6] = "PLAINS";
    const base = createInitialMatchState(createMicroSimulationSpec({
      seed: "trade-ship-radius-five-red",
      width: 13,
      height: 1,
      terrain,
      initialOwners: Array.from({ length: 13 }, (_, cellId) =>
        cellId === 6 ? "beta" : null,
      ),
      factions: [{ id: "alpha", rules }, { id: "beta", rules }],
    }));
    const withPort = createProspectiveMatchState(base, {
      structures: [{
        id: "port-destination",
        ownerId: "beta",
        type: "PORT",
        cellId: 6,
        outputCellId: 5,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }],
    });
    const arriving = createMobileUnit(
      withPort.map,
      withPort.factions.map((faction) => faction.id),
      withPort,
      {
        ownerId: "alpha",
        type: "TRADE_SHIP",
        movementClass: "NAVAL",
        cellId: 1,
      },
    );
    const dockBlocker = createMobileUnit(
      withPort.map,
      withPort.factions.map((faction) => faction.id),
      arriving,
      {
        ownerId: "alpha",
        type: "TRADE_SHIP",
        movementClass: "NAVAL",
        cellId: 5,
      },
    );
    const secondArriving = createMobileUnit(
      withPort.map,
      withPort.factions.map((faction) => faction.id),
      dockBlocker,
      {
        ownerId: "alpha",
        type: "TRADE_SHIP",
        movementClass: "NAVAL",
        cellId: 2,
      },
    );
    const thirdArriving = createMobileUnit(
      withPort.map,
      withPort.factions.map((faction) => faction.id),
      secondArriving,
      {
        ownerId: "alpha",
        type: "TRADE_SHIP",
        movementClass: "NAVAL",
        cellId: 3,
      },
    );
    const occupied = createProspectiveMatchState(withPort, {
      mobileUnits: thirdArriving.mobileUnits,
      nextMobileUnitOrdinal: thirdArriving.nextMobileUnitOrdinal,
    });

    expect(isTradeShipDeliveryCell(occupied, "port-destination", 1)).toBe(true);
    expect(isTradeShipDeliveryCell(occupied, "port-destination", 2)).toBe(true);
    expect(isTradeShipDeliveryCell(occupied, "port-destination", 3)).toBe(true);
    expect(isTradeShipDeliveryCell(occupied, "port-destination", 0)).toBe(false);

    let completionState = occupied;
    for (const unitId of [
      arriving.unit.id,
      secondArriving.unit.id,
      thirdArriving.unit.id,
    ]) {
      const completed = completeTradeShipArrival(completionState, {
        unitId,
        destinationPortId: "port-destination",
      });
      expect(completed.ok).toBe(true);
      if (!completed.ok) {
        throw new Error("expected independent Trade Ship radius-5 completion");
      }
      completionState = completed.state;
    }
    expect(completionState.mobileUnits).toEqual([
      expect.objectContaining({
        id: dockBlocker.unit.id,
        type: "TRADE_SHIP",
        cellId: 5,
      }),
    ]);
  });
});