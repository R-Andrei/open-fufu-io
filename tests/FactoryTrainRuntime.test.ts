import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createFactoryRailLoopLifecycleState,
  retainFactoryRailLoopSnapshot,
} from "../src/simulation/FactoryRailLifecycle";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  createAdvancedMatchState,
  canonicalMatchStateSerialization,
} from "../src/simulation/MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  createMobileUnit,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { TickEngine } from "../src/simulation/TickEngine";
import {
  createFactoryTrainServiceEpoch,
  createTrainDispatchEconomicSnapshot,
  createTrainRouteInput,
  markFactoryPrimaryTrainDispatched,
} from "../src/simulation/TrainService";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

describe("authoritative Factory Train runtime state", () => {
  it("stores and canonically serializes loop lifecycle, service epoch, and per-Train dispatch/dwell linkage", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "factory-train-runtime-state",
        width: 4,
        height: 1,
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );

    expect(base.factoryRailLoops).toEqual([]);
    expect(base.factoryTrainEpochs).toEqual([]);
    expect(base.trainServices).toEqual([]);

    const created = createMobileUnit(
      base.map,
      base.factions.map((faction) => faction.id),
      {
        mobileUnits: base.mobileUnits,
        nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
      },
      {
        ownerId: "alpha",
        type: "TRAIN",
        movementClass: "RAIL",
        cellId: 0,
      },
    );
    const routed = assignMobileUnitRoute(
      base.map,
      created.unit,
      createTrainRouteInput([0, 1, 2]),
    );

    const loop = retainFactoryRailLoopSnapshot(
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: Object.freeze([0, 1, 2]),
        sharedExistingEdgeCount: 0,
      }),
      routed.id,
    );
    const epoch = markFactoryPrimaryTrainDispatched(
      createFactoryTrainServiceEpoch("factory-a", "alpha"),
      routed.id,
    );
    const dispatchSnapshot = createTrainDispatchEconomicSnapshot(
      "factory-a",
      "alpha",
      1,
    );

    const materialized = createProspectiveMatchState(base, {
      mobileUnits: [routed],
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      factoryRailLoops: [loop],
      factoryTrainEpochs: [epoch],
      trainServices: [
        {
          trainId: routed.id,
          factoryId: "factory-a",
          loopSnapshotId: routed.id,
          isPrimary: true,
          dispatchSnapshot,
          resumeAtTick: null,
        },
      ],
    });

    expect(materialized.factoryRailLoops[0]?.factoryId).toBe("factory-a");
    expect(materialized.factoryTrainEpochs[0]?.activePrimaryTrainId).toBe(
      routed.id,
    );
    expect(materialized.trainServices[0]).toMatchObject({
      trainId: routed.id,
      factoryId: "factory-a",
      loopSnapshotId: routed.id,
      isPrimary: true,
      resumeAtTick: null,
    });
    expect(Object.isFrozen(materialized.factoryRailLoops)).toBe(true);
    expect(Object.isFrozen(materialized.factoryTrainEpochs)).toBe(true);
    expect(Object.isFrozen(materialized.trainServices)).toBe(true);
    expect(Object.isFrozen(materialized.trainServices[0])).toBe(true);

    const serialized = JSON.parse(canonicalMatchStateSerialization(materialized));
    expect(serialized.factoryRailLoops).toHaveLength(1);
    expect(serialized.factoryTrainEpochs).toEqual([
      {
        factoryId: "factory-a",
        ownerId: "alpha",
        activePrimaryTrainId: routed.id,
        turnaroundRemainingActiveTicks: 0,
        p07PrimaryDispatchPhase: 0,
      },
    ]);
    expect(serialized.trainServices).toEqual([
      {
        trainId: routed.id,
        factoryId: "factory-a",
        loopSnapshotId: routed.id,
        isPrimary: true,
        dispatchSnapshot: {
          factoryId: "factory-a",
          dispatchOwnerId: "alpha",
          factoryLevel: 1,
          baseCargoFfy: { numerator: "10000", denominator: "1" },
        },
        resumeAtTick: null,
      },
    ]);

    const advanced = createAdvancedMatchState(materialized, {});
    expect(advanced.factoryRailLoops).toEqual(materialized.factoryRailLoops);
    expect(advanced.factoryTrainEpochs).toEqual(materialized.factoryTrainEpochs);
    expect(advanced.trainServices).toEqual(materialized.trainServices);
    expect(canonicalMatchStateSerialization(advanced)).not.toBe(
      canonicalMatchStateSerialization(materialized),
    );
  });

  it("reconciles a fresh Factory epoch, dispatches from its stored loop, snapshots it, and moves the Train in the same tick", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "factory-train-runtime-dispatch",
        width: 12,
        height: 1,
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const loopCells = Object.freeze(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    const prepared = createProspectiveMatchState(base, {
      structures: [
        {
          id: "factory-a",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
        {
          id: "city-a",
          ownerId: "alpha",
          type: "CITY",
          cellId: 10,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
      ],
      factoryRailLoops: [
        createFactoryRailLoopLifecycleState("factory-a", {
          factoryId: "factory-a",
          targetStructureIds: Object.freeze(["city-a"]),
          servicedStructureIds: Object.freeze(["city-a"]),
          cells: loopCells,
          sharedExistingEdgeCount: 0,
        }),
      ],
    });

    const advanced = new TickEngine().advance(prepared, []);

    expect(advanced.tick).toBe(1);
    expect(advanced.factoryTrainEpochs).toHaveLength(1);
    expect(advanced.mobileUnits).toHaveLength(1);
    expect(advanced.trainServices).toHaveLength(1);

    const train = advanced.mobileUnits[0]!;
    expect(train).toMatchObject({
      ownerId: "alpha",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 3,
    });
    expect(train.route).toMatchObject({
      cells: loopCells,
      nextCellIndex: 3,
      edgeProgress: 1,
    });
    expect(advanced.factoryTrainEpochs[0]).toMatchObject({
      factoryId: "factory-a",
      ownerId: "alpha",
      activePrimaryTrainId: train.id,
      turnaroundRemainingActiveTicks: 0,
      p07PrimaryDispatchPhase: 0,
    });
    expect(advanced.factoryRailLoops[0]?.retainedSnapshots).toEqual([
      { snapshotId: train.id, cells: loopCells },
    ]);
    expect(advanced.trainServices[0]).toMatchObject({
      trainId: train.id,
      factoryId: "factory-a",
      loopSnapshotId: train.id,
      isPrimary: true,
      dispatchSnapshot: {
        factoryId: "factory-a",
        dispatchOwnerId: "alpha",
        factoryLevel: 1,
        baseCargoFfy: { numerator: 10_000n, denominator: 1n },
      },
      resumeAtTick: null,
    });
  });

  it("advances an existing primary to loop completion, releases its snapshot, and starts exactly 50 active turnaround ticks", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "factory-train-runtime-return",
        width: 12,
        height: 1,
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const loopCells = Object.freeze(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    const created = createMobileUnit(
      base.map,
      base.factions.map((faction) => faction.id),
      {
        mobileUnits: base.mobileUnits,
        nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
      },
      {
        ownerId: "alpha",
        type: "TRAIN",
        movementClass: "RAIL",
        cellId: loopCells[0]!,
      },
    );
    const routed = assignMobileUnitRoute(
      base.map,
      created.unit,
      createTrainRouteInput(loopCells),
    );
    const nearReturn = advanceMobileUnit(routed, 18).unit;
    expect(nearReturn).toMatchObject({
      cellId: 10,
      route: { nextCellIndex: 10, edgeProgress: 0 },
    });

    const lifecycle = retainFactoryRailLoopSnapshot(
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
      }),
      nearReturn.id,
    );
    const epoch = markFactoryPrimaryTrainDispatched(
      createFactoryTrainServiceEpoch("factory-a", "alpha"),
      nearReturn.id,
    );
    const prepared = createProspectiveMatchState(base, {
      structures: [
        {
          id: "factory-a",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
        {
          id: "city-a",
          ownerId: "alpha",
          type: "CITY",
          cellId: 10,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
      ],
      mobileUnits: [nearReturn],
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      factoryRailLoops: [lifecycle],
      factoryTrainEpochs: [epoch],
      trainServices: [
        {
          trainId: nearReturn.id,
          factoryId: "factory-a",
          loopSnapshotId: nearReturn.id,
          isPrimary: true,
          dispatchSnapshot: createTrainDispatchEconomicSnapshot(
            "factory-a",
            "alpha",
            1,
          ),
          resumeAtTick: null,
        },
      ],
    });

    const advanced = new TickEngine().advance(prepared, []);

    expect(advanced.tick).toBe(1);
    expect(advanced.mobileUnits).toEqual([]);
    expect(advanced.trainServices).toEqual([]);
    expect(advanced.factoryRailLoops[0]?.retainedSnapshots).toEqual([]);
    expect(advanced.factoryTrainEpochs).toEqual([
      {
        factoryId: "factory-a",
        ownerId: "alpha",
        activePrimaryTrainId: null,
        turnaroundRemainingActiveTicks: 50,
        p07PrimaryDispatchPhase: 0,
      },
    ]);
  });
});
