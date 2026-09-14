import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createFactoryRailLoopLifecycleState,
  retainFactoryRailLoopSnapshot,
} from "../src/simulation/FactoryRailLifecycle";
import {
  advanceFactoryTrainRuntimePhase,
  settleFactoryTrainEconomicEvents,
} from "../src/simulation/FactoryTrainRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
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

function originRules(traitIds: readonly string[]) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function stationInterfaceLoop() {
  return Object.freeze({
    factoryId: "factory-a",
    targetStructureIds: Object.freeze(["city-a"]),
    servicedStructureIds: Object.freeze(["city-a"]),
    cells: Object.freeze([1, 2, 3, 2, 1]),
    sharedExistingEdgeCount: 0,
    stationInterfaces: Object.freeze([
      Object.freeze({ structureId: "city-a", cellId: 3 }),
    ]),
  });
}

function activeStructures() {
  return Object.freeze([
    Object.freeze({
      id: "factory-a",
      ownerId: "alpha",
      type: "FACTORY" as const,
      cellId: 0,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT" as const,
    }),
    Object.freeze({
      id: "city-a",
      ownerId: "alpha",
      type: "CITY" as const,
      cellId: 4,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT" as const,
    }),
  ]);
}

describe("Factory Train adjacent station interfaces", () => {
  it("stops and starts dwell on the retained adjacent interface without entering the structure cell", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "factory-train-interface-dwell",
        width: 6,
        height: 1,
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
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
        cellId: 1,
      },
    );
    const routed = assignMobileUnitRoute(
      base.map,
      created.unit,
      createTrainRouteInput(stationInterfaceLoop().cells),
    );
    const lifecycle = retainFactoryRailLoopSnapshot(
      createFactoryRailLoopLifecycleState("factory-a", stationInterfaceLoop()),
      routed.id,
    );
    const epoch = markFactoryPrimaryTrainDispatched(
      createFactoryTrainServiceEpoch("factory-a", "alpha"),
      routed.id,
    );
    const prepared = createProspectiveMatchState(base, {
      structures: activeStructures(),
      mobileUnits: [routed],
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      factoryRailLoops: [lifecycle],
      factoryTrainEpochs: [epoch],
      trainServices: [
        {
          trainId: routed.id,
          factoryId: "factory-a",
          loopSnapshotId: routed.id,
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

    const update = advanceFactoryTrainRuntimePhase(prepared, prepared.tick, []);
    const train = update.mobileUnits.find((unit) => unit.id === routed.id);

    expect(train).toMatchObject({
      cellId: 3,
      route: {
        nextCellIndex: 3,
        edgeProgress: 0,
      },
    });
    expect(train?.cellId).not.toBe(4);
    expect(update.trainServices[0]).toMatchObject({
      trainId: routed.id,
      resumeAtTick: 15,
    });
  });

  it("settles the mapped station while evaluating location-conditioned economics at the structure cell", () => {
    const alphaRules = originRules(["P14"]);
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "factory-train-interface-economic-location",
        width: 6,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "DESERT", "PLAINS"],
        factions: [
          { id: "alpha", rules: alphaRules },
          { id: "beta", rules: emptyRules() },
        ],
      }),
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
        cellId: 3,
      },
    );
    const lifecycle = retainFactoryRailLoopSnapshot(
      createFactoryRailLoopLifecycleState("factory-a", stationInterfaceLoop()),
      created.unit.id,
    );
    const epoch = markFactoryPrimaryTrainDispatched(
      createFactoryTrainServiceEpoch("factory-a", "alpha"),
      created.unit.id,
    );
    const prepared = createProspectiveMatchState(base, {
      structures: activeStructures(),
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      factoryRailLoops: [lifecycle],
      factoryTrainEpochs: [epoch],
      trainServices: [
        {
          trainId: created.unit.id,
          factoryId: "factory-a",
          loopSnapshotId: created.unit.id,
          isPrimary: true,
          dispatchSnapshot: createTrainDispatchEconomicSnapshot(
            "factory-a",
            "alpha",
            1,
          ),
          resumeAtTick: 15,
        },
      ],
    });
    const alphaBefore = prepared.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;

    const update = settleFactoryTrainEconomicEvents(
      prepared,
      [],
      [],
      () => false,
    );

    expect(update).not.toBeNull();
    expect(update?.factions.find((faction) => faction.id === "alpha")?.ffy).toBe(
      alphaBefore + 13_300,
    );
  });
});
