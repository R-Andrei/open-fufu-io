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
  assignMobileUnitRoute,
  createMobileUnit,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
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
});
