import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createFactoryRailLoopLifecycleState,
  retainFactoryRailLoopSnapshot,
} from "../src/simulation/FactoryRailLifecycle";
import { createInitialMatchState, createProspectiveMatchState } from "../src/simulation/MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  createMobileUnit,
  setMobileUnitStrategicDestination,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  tankCellTraversalTiming,
  tankNavigationRoute,
} from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";
import {
  createFactoryTrainServiceEpoch,
  createTrainDispatchEconomicSnapshot,
  createTrainRouteInput,
  markFactoryPrimaryTrainDispatched,
} from "../src/simulation/TrainService";
import { tryStartWarshipProduction } from "../src/simulation/Warships";

function baseState(seed: string, width: number) {
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

function structure(id: string, type: "CITY" | "FACTORY", cellId: number) {
  return {
    id, ownerId: "alpha", type, cellId,
    completedLevel: 1 as const, active: true, acquisitionPath: "GRANT" as const,
  };
}

describe("physical occupancy transition integration", () => {
  it("does not let a retained Tank route enter a newly occupied cell", () => {
    const base = baseState("occupancy-tank-transition", 4);
    const owners = base.factions.map((f) => f.id);
    const created = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const withMover = createProspectiveMatchState(base, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    });
    const plan = tankNavigationRoute(withMover, "alpha", "TANK", 0, 3);
    if (plan.status !== "FOUND") throw new Error("expected Tank route fixture");
    const strategic = setMobileUnitStrategicDestination(base.map, created.unit, 3);
    const routed = assignMobileUnitRoute(base.map, strategic, {
      cells: plan.route.cells, edgeWeights: plan.route.edgeWeights,
    });
    const partial = advanceMobileUnit(routed, plan.route.edgeWeights[0]! - 1).unit;
    const prepared = createProspectiveMatchState(base, {
      structures: [structure("city-blocker", "CITY", 1)],
      mobileUnits: [partial],
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      tankOperationalStates: [{
        unitId: partial.id,
        health: { numerator: 1000n, denominator: 1n },
        operatingAnchorCellId: 0,
        eligibleFromTick: 0,
        attackReadyAtTick: 0,
      }],
    });

    const advanced = new TickEngine().advance(prepared, []);
    expect(advanced.mobileUnits.find((u) => u.id === partial.id)?.cellId).toBe(0);
  });

  it("keeps a Factory Train behind a stationary occupier instead of tunneling through it", () => {
    const base = baseState("occupancy-train-transition", 13);
    const owners = base.factions.map((f) => f.id);
    const blocker = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 2,
    });
    const loopCells = Object.freeze(Array.from({ length: 11 }, (_, i) => i + 1));
    const prepared = createProspectiveMatchState(base, {
      structures: [
        structure("factory-a", "FACTORY", 0),
        structure("city-a", "CITY", 12),
      ],
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
      factoryRailLoops: [createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-a", cellId: 11 }),
        ]),
      })],
    });

    const advanced = new TickEngine().advance(prepared, []);
    expect(advanced.mobileUnits.find((u) => u.type === "TRAIN")?.cellId).toBe(1);
    expect(advanced.mobileUnits.find((u) => u.id === blocker.unit.id)?.cellId).toBe(2);
  });

  it("does not let Tank iteration order choose a winner for one empty destination cell", () => {
    const base = baseState("occupancy-tank-tank-contention", 3);
    const owners = base.factions.map((f) => f.id);
    const leftCreated = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const rightCreated = createMobileUnit(base.map, owners, leftCreated, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 2,
    });
    const timing = tankCellTraversalTiming(base, "alpha", "TANK", 1);
    if (timing === undefined) throw new Error("expected Tank traversal timing fixture");
    const preloadWork = timing.edgeWeight - timing.movementWorkPerTick;
    if (preloadWork < 0) throw new Error("expected one-tick Tank contention fixture");
    const leftRouted = assignMobileUnitRoute(base.map, leftCreated.unit, {
      cells: [0, 1], edgeWeights: [timing.edgeWeight],
    });
    const rightRouted = assignMobileUnitRoute(base.map, rightCreated.unit, {
      cells: [2, 1], edgeWeights: [timing.edgeWeight],
    });
    const leftPartial = advanceMobileUnit(leftRouted, preloadWork).unit;
    const rightPartial = advanceMobileUnit(rightRouted, preloadWork).unit;
    const prepared = createProspectiveMatchState(base, {
      mobileUnits: [rightPartial, leftPartial],
      nextMobileUnitOrdinal: rightCreated.nextMobileUnitOrdinal,
      tankOperationalStates: [
        {
          unitId: leftPartial.id,
          health: { numerator: 1000n, denominator: 1n },
          operatingAnchorCellId: 0,
          eligibleFromTick: 0,
          attackReadyAtTick: 0,
        },
        {
          unitId: rightPartial.id,
          health: { numerator: 1000n, denominator: 1n },
          operatingAnchorCellId: 2,
          eligibleFromTick: 0,
          attackReadyAtTick: 0,
        },
      ],
    });

    const advanced = new TickEngine().advance(prepared, []);
    expect(advanced.mobileUnits.find((u) => u.id === leftPartial.id)).toMatchObject({
      cellId: 0,
      route: { nextCellIndex: 1, edgeProgress: preloadWork },
    });
    expect(advanced.mobileUnits.find((u) => u.id === rightPartial.id)).toMatchObject({
      cellId: 2,
      route: { nextCellIndex: 1, edgeProgress: preloadWork },
    });
  });

  it("does not let the earlier Train phase win an empty-cell claim against a Tank", () => {
    const base = baseState("occupancy-train-tank-contention", 6);
    const owners = base.factions.map((f) => f.id);
    const trainCreated = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TRAIN", movementClass: "RAIL", cellId: 0,
    });
    const trainRouted = assignMobileUnitRoute(
      base.map,
      trainCreated.unit,
      createTrainRouteInput([0, 1, 2, 1, 0]),
    );
    const tankCreated = createMobileUnit(
      base.map,
      owners,
      {
        mobileUnits: [trainRouted],
        nextMobileUnitOrdinal: trainCreated.nextMobileUnitOrdinal,
      },
      {
        ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 3,
      },
    );
    const tankTiming = tankCellTraversalTiming(base, "alpha", "TANK", 2);
    if (tankTiming === undefined) throw new Error("expected Tank traversal timing fixture");
    const tankPreloadWork = tankTiming.edgeWeight - tankTiming.movementWorkPerTick;
    if (tankPreloadWork < 0) throw new Error("expected one-tick Train-vs-Tank fixture");
    const tankRouted = assignMobileUnitRoute(base.map, tankCreated.unit, {
      cells: [3, 2], edgeWeights: [tankTiming.edgeWeight],
    });
    const tankPartial = advanceMobileUnit(tankRouted, tankPreloadWork).unit;

    const loopCells = Object.freeze([0, 1, 2, 1, 0]);
    const loop = retainFactoryRailLoopSnapshot(
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-a", cellId: 2 }),
        ]),
      }),
      trainRouted.id,
    );
    const epoch = markFactoryPrimaryTrainDispatched(
      createFactoryTrainServiceEpoch("factory-a", "alpha"),
      trainRouted.id,
    );
    const prepared = createProspectiveMatchState(base, {
      structures: [
        structure("factory-a", "FACTORY", 4),
        structure("city-a", "CITY", 5),
      ],
      mobileUnits: [trainRouted, tankPartial],
      nextMobileUnitOrdinal: tankCreated.nextMobileUnitOrdinal,
      factoryRailLoops: [loop],
      factoryTrainEpochs: [epoch],
      trainServices: [{
        trainId: trainRouted.id,
        factoryId: "factory-a",
        loopSnapshotId: trainRouted.id,
        isPrimary: true,
        dispatchSnapshot: createTrainDispatchEconomicSnapshot(
          "factory-a",
          "alpha",
          1,
        ),
        resumeAtTick: null,
      }],
      tankOperationalStates: [{
        unitId: tankPartial.id,
        health: { numerator: 1000n, denominator: 1n },
        operatingAnchorCellId: 3,
        eligibleFromTick: 0,
        attackReadyAtTick: 0,
      }],
    });

    const advanced = new TickEngine().advance(prepared, []);
    expect(advanced.mobileUnits.find((u) => u.id === trainRouted.id)).toMatchObject({
      cellId: 1,
      route: { nextCellIndex: 2, edgeProgress: 0 },
    });
    expect(advanced.trainServices.find((service) => service.trainId === trainRouted.id)).toMatchObject({
      resumeAtTick: null,
    });
    expect(advanced.mobileUnits.find((u) => u.id === tankPartial.id)).toMatchObject({
      cellId: 3,
      route: { nextCellIndex: 1, edgeProgress: tankPreloadWork },
    });
  });

  it("advances Warship production through the authoritative TickEngine", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const base = createInitialMatchState(createMicroSimulationSpec({
      seed: "warship-tick-engine-scheduling-red",
      width: 3,
      height: 1,
      terrain: ["DEEP_WATER", "PLAINS", "DEEP_WATER"],
      initialOwners: [null, "alpha", null],
      factions: [{ id: "alpha", rules }, { id: "beta", rules }],
    }));
    const withPort = createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 250_000 } : faction,
      ),
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
    const accepted = tryStartWarshipProduction(withPort, {
      ownerId: "alpha",
      portId: "port-a",
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Warship production admission");

    const engine = new TickEngine();
    let current = accepted.state;
    for (let tick = 0; tick < 50; tick += 1) {
      current = engine.advance(current, []);
    }

    expect(current.warshipProductionJobs).toHaveLength(0);
    expect(current.mobileUnits).toEqual([
      expect.objectContaining({
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 0,
      }),
    ]);
  });
});
