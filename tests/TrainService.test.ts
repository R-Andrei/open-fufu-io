import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleCondition } from "../src/core/rules/RuleComposition";
import { resolveFfyEconomicStage } from "../src/simulation/Economy";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  createMobileUnit,
  type MobileUnitCollectionState,
} from "../src/simulation/MobileUnits";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import {
  TRAIN_MOVEMENT_WORK_PER_TICK,
  TRAIN_RAIL_EDGE_WORK,
  TRAIN_STATION_DWELL_TICKS,
  TRAIN_TURNAROUND_ACTIVE_TICKS,
  advanceFactoryTrainServiceSchedulerTick,
  advanceTrainMovementTick,
  canDispatchFactoryPrimaryTrain,
  createFactoryTrainDispatchRoutes,
  createFactoryTrainServiceEpoch,
  createTrainDispatchEconomicSnapshot,
  createTrainRouteInput,
  createTrainStationFfyEvent,
  dispatchFactoryPrimaryTrain,
  finishFactoryPrimaryTrain,
  markFactoryPrimaryTrainDispatched,
  transferFactoryTrainServiceEpoch,
} from "../src/simulation/TrainService";

function emptyCollection(): MobileUnitCollectionState {
  return Object.freeze({
    mobileUnits: Object.freeze([]),
    nextMobileUnitOrdinal: 0,
  });
}

function railTestMap() {
  return createSimulationMap({
    source: "SYNTHETIC",
    width: 6,
    height: 1,
    terrain: Array.from({ length: 6 }, () => "TEST" as const),
  });
}

function rulesWithTraits(traitIds: readonly ("P14" | "N11")[] = []) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

const RULE_STATE = Object.freeze({
  ownedPersistentStructureCount: 0,
  territorialContactCount: 0,
  peakTotalPopulation: 0,
});

function desertEventCondition(condition: RuleCondition): boolean {
  return (
    condition.kind === "EVENT_TERRAIN_IS" && condition.terrain === "DESERT"
  );
}

function completeFactoryTurnaround(
  state: ReturnType<typeof createFactoryTrainServiceEpoch>,
  primaryTrainId: string,
) {
  let current = finishFactoryPrimaryTrain(state, primaryTrainId);
  for (let tick = 0; tick < TRAIN_TURNAROUND_ACTIVE_TICKS; tick += 1) {
    current = advanceFactoryTrainServiceSchedulerTick(current, true);
  }
  return current;
}

describe("Factory Train service timing and movement", () => {
  it("dispatches a fresh epoch immediately when a loop exists and enforces exactly 50 active turnaround ticks", () => {
    const fresh = createFactoryTrainServiceEpoch("factory-a", "alpha");

    expect(TRAIN_TURNAROUND_ACTIVE_TICKS).toBe(50);
    expect(canDispatchFactoryPrimaryTrain(fresh, true, false)).toBe(false);
    expect(canDispatchFactoryPrimaryTrain(fresh, true, true)).toBe(true);
    expect(canDispatchFactoryPrimaryTrain(fresh, false, true)).toBe(false);

    const active = markFactoryPrimaryTrainDispatched(fresh, "train-primary-a");
    expect(canDispatchFactoryPrimaryTrain(active, true, true)).toBe(false);
    expect(active.activePrimaryTrainId).toBe("train-primary-a");

    let turnaround = finishFactoryPrimaryTrain(active, "train-primary-a");
    expect(turnaround.activePrimaryTrainId).toBeNull();
    expect(turnaround.turnaroundRemainingActiveTicks).toBe(50);

    turnaround = advanceFactoryTrainServiceSchedulerTick(turnaround, false);
    expect(turnaround.turnaroundRemainingActiveTicks).toBe(50);
    expect(canDispatchFactoryPrimaryTrain(turnaround, false, true)).toBe(false);

    for (let elapsed = 1; elapsed <= 49; elapsed += 1) {
      turnaround = advanceFactoryTrainServiceSchedulerTick(turnaround, true);
    }
    expect(turnaround.turnaroundRemainingActiveTicks).toBe(1);
    expect(canDispatchFactoryPrimaryTrain(turnaround, true, true)).toBe(false);

    turnaround = advanceFactoryTrainServiceSchedulerTick(turnaround, true);
    expect(turnaround.turnaroundRemainingActiveTicks).toBe(0);
    expect(canDispatchFactoryPrimaryTrain(turnaround, true, true)).toBe(true);
  });

  it("represents 25 rail cells per second exactly as five work per tick over weight-two rail edges", () => {
    expect(TRAIN_RAIL_EDGE_WORK).toBe(2);
    expect(TRAIN_MOVEMENT_WORK_PER_TICK).toBe(5);

    const map = railTestMap();
    const created = createMobileUnit(map, ["alpha"], emptyCollection(), {
      ownerId: "alpha",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 0,
    });
    const routeInput = createTrainRouteInput([0, 1, 2, 3, 4, 5]);
    expect(routeInput.edgeWeights).toEqual([2, 2, 2, 2, 2]);
    const routed = assignMobileUnitRoute(map, created.unit, routeInput);

    const afterOneTick = advanceMobileUnit(routed, TRAIN_MOVEMENT_WORK_PER_TICK);
    expect(afterOneTick.unit.cellId).toBe(2);
    expect(afterOneTick.unit.route).toMatchObject({
      nextCellIndex: 3,
      edgeProgress: 1,
    });
    expect(afterOneTick.unusedWork).toBe(0);

    const afterTwoTicks = advanceMobileUnit(
      afterOneTick.unit,
      TRAIN_MOVEMENT_WORK_PER_TICK,
    );
    expect(afterTwoTicks.unit.cellId).toBe(5);
    expect(afterTwoTicks.unit.route).toBeUndefined();
    expect(afterTwoTicks.unusedWork).toBe(0);
  });

  it("stops on station entry, dwells through arrival+14, resumes at arrival+15, and pays again only after re-entry", () => {
    expect(TRAIN_STATION_DWELL_TICKS).toBe(15);

    const map = railTestMap();
    const created = createMobileUnit(map, ["alpha"], emptyCollection(), {
      ownerId: "alpha",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 0,
    });
    const routed = assignMobileUnitRoute(
      map,
      created.unit,
      createTrainRouteInput([0, 1, 2, 1, 0]),
    );

    const arrival = advanceTrainMovementTick(routed, 100, null, [1]);
    expect(arrival.unit.cellId).toBe(1);
    expect(arrival.stationEntryCellId).toBe(1);
    expect(arrival.resumeAtTick).toBe(115);
    expect(arrival.unit.route).toMatchObject({ nextCellIndex: 2, edgeProgress: 0 });

    const duringDwell = advanceTrainMovementTick(
      arrival.unit,
      114,
      arrival.resumeAtTick,
      [1],
    );
    expect(duringDwell.unit).toBe(arrival.unit);
    expect(duringDwell.stationEntryCellId).toBeNull();
    expect(duringDwell.resumeAtTick).toBe(115);

    const reentry = advanceTrainMovementTick(
      duringDwell.unit,
      115,
      duringDwell.resumeAtTick,
      [1],
    );
    expect(reentry.unit.cellId).toBe(1);
    expect(reentry.stationEntryCellId).toBe(1);
    expect(reentry.resumeAtTick).toBe(130);
    expect(reentry.unit.route).toMatchObject({ nextCellIndex: 4, edgeProgress: 0 });
  });

  it("creates a fresh new-owner Factory epoch while an old-owner primary remains isolated", () => {
    const oldFresh = createFactoryTrainServiceEpoch("factory-a", "alpha");
    const oldActive = markFactoryPrimaryTrainDispatched(oldFresh, "train-old");

    const newFresh = transferFactoryTrainServiceEpoch(oldActive, "beta");
    expect(newFresh).toEqual({
      factoryId: "factory-a",
      ownerId: "beta",
      activePrimaryTrainId: null,
      turnaroundRemainingActiveTicks: 0,
      p07PrimaryDispatchPhase: 0,
    });
    expect(canDispatchFactoryPrimaryTrain(newFresh, true, true)).toBe(true);

    const newActive = markFactoryPrimaryTrainDispatched(newFresh, "train-new");
    const oldReturned = finishFactoryPrimaryTrain(oldActive, "train-old");

    expect(oldReturned.ownerId).toBe("alpha");
    expect(oldReturned.turnaroundRemainingActiveTicks).toBe(50);
    expect(newActive.ownerId).toBe("beta");
    expect(newActive.activePrimaryTrainId).toBe("train-new");
    expect(() => finishFactoryPrimaryTrain(newActive, "train-old")).toThrow(
      /not active/i,
    );
  });

  it("freezes Factory-side base cargo at dispatch while spatial yield and wartime scaling remain event-time current", () => {
    const dispatch = createTrainDispatchEconomicSnapshot(
      "factory-a",
      "alpha",
      1,
      { numerator: 3n, denominator: 2n },
    );
    expect(dispatch).toEqual({
      factoryId: "factory-a",
      dispatchOwnerId: "alpha",
      factoryLevel: 1,
      baseCargoFfy: { numerator: 15_000n, denominator: 1n },
    });

    const laterFactoryProfile = createTrainDispatchEconomicSnapshot(
      "factory-a",
      "beta",
      2,
    );
    expect(laterFactoryProfile.baseCargoFfy).toEqual({
      numerator: 11_250n,
      denominator: 1n,
    });
    expect(dispatch.dispatchOwnerId).toBe("alpha");
    expect(dispatch.baseCargoFfy).toEqual({
      numerator: 15_000n,
      denominator: 1n,
    });

    const wartimeDesert = createTrainStationFfyEvent(dispatch, {
      eventId: "train:station:war-desert",
      externalWartimeMultiplier: { numerator: 1n, denominator: 2n },
      conditionApplies: desertEventCondition,
    });
    const wartimeDesertResult = resolveFfyEconomicStage({
      balance: 0,
      rules: rulesWithTraits(["P14"]),
      ruleDynamicState: RULE_STATE,
      positiveEvents: [wartimeDesert],
      signedFacts: [],
    });
    expect(wartimeDesertResult.positiveEvents[0]).toEqual({
      id: "train:station:war-desert",
      family: "INDUSTRIAL",
      award: 9_975,
    });

    const peacefulDesert = createTrainStationFfyEvent(dispatch, {
      eventId: "train:station:peace-desert",
      externalWartimeMultiplier: { numerator: 1n, denominator: 1n },
      conditionApplies: desertEventCondition,
    });
    const peacefulDesertResult = resolveFfyEconomicStage({
      balance: 0,
      rules: rulesWithTraits(["P14"]),
      ruleDynamicState: RULE_STATE,
      positiveEvents: [peacefulDesert],
      signedFacts: [],
    });
    expect(peacefulDesertResult.positiveEvents[0]?.award).toBe(19_950);

    const wartimeNonDesert = createTrainStationFfyEvent(dispatch, {
      eventId: "train:station:war-plain",
      externalWartimeMultiplier: { numerator: 1n, denominator: 2n },
      conditionApplies: () => false,
    });
    const wartimeNonDesertResult = resolveFfyEconomicStage({
      balance: 0,
      rules: rulesWithTraits(["P14"]),
      ruleDynamicState: RULE_STATE,
      positiveEvents: [wartimeNonDesert],
      signedFacts: [],
    });
    expect(wartimeNonDesertResult.positiveEvents[0]?.award).toBe(7_500);
  });

  it("advances P07 only on primary dispatches, emits one fourth-primary bonus on the same loop, and resets on transfer", () => {
    const fresh = createFactoryTrainServiceEpoch("factory-p07", "alpha");
    expect(fresh.p07PrimaryDispatchPhase).toBe(0);

    const transferAfterOne = dispatchFactoryPrimaryTrain(
      fresh,
      "transfer-primary",
      true,
    );
    expect(transferAfterOne.epoch.p07PrimaryDispatchPhase).toBe(1);
    expect(transferAfterOne.bonusTrainRequired).toBe(false);
    expect(
      transferFactoryTrainServiceEpoch(transferAfterOne.epoch, "beta")
        .p07PrimaryDispatchPhase,
    ).toBe(0);

    let ready = createFactoryTrainServiceEpoch("factory-p07", "alpha");
    let fourth: ReturnType<typeof dispatchFactoryPrimaryTrain> | undefined;
    for (let dispatchNumber = 1; dispatchNumber <= 4; dispatchNumber += 1) {
      const primaryId = `primary-${dispatchNumber}`;
      const result = dispatchFactoryPrimaryTrain(ready, primaryId, true);
      expect(result.bonusTrainRequired).toBe(dispatchNumber === 4);
      expect(result.epoch.p07PrimaryDispatchPhase).toBe(dispatchNumber % 4);

      if (dispatchNumber < 4) {
        const paused = advanceFactoryTrainServiceSchedulerTick(
          finishFactoryPrimaryTrain(result.epoch, primaryId),
          false,
        );
        expect(paused.p07PrimaryDispatchPhase).toBe(dispatchNumber % 4);
        ready = paused;
        for (let tick = 0; tick < TRAIN_TURNAROUND_ACTIVE_TICKS; tick += 1) {
          ready = advanceFactoryTrainServiceSchedulerTick(ready, true);
        }
      } else {
        fourth = result;
      }
    }

    expect(fourth).toBeDefined();
    expect(fourth!.epoch.activePrimaryTrainId).toBe("primary-4");
    expect(fourth!.epoch.p07PrimaryDispatchPhase).toBe(0);

    const pairedRoutes = createFactoryTrainDispatchRoutes(
      [0, 1, 2, 3, 4],
      fourth!.bonusTrainRequired,
    );
    expect(pairedRoutes.bonus).not.toBeNull();
    expect(pairedRoutes.primary.cells).toEqual(pairedRoutes.bonus!.cells);
    expect(pairedRoutes.primary.edgeWeights).toEqual(
      pairedRoutes.bonus!.edgeWeights,
    );
    expect(pairedRoutes.primary).not.toBe(pairedRoutes.bonus);
    expect(pairedRoutes.primary.cells).not.toBe(pairedRoutes.bonus!.cells);

    const map = railTestMap();
    const primary = createMobileUnit(map, ["alpha"], emptyCollection(), {
      ownerId: "alpha",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 0,
    });
    const bonus = createMobileUnit(map, ["alpha"], primary, {
      ownerId: "alpha",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 0,
    });
    expect(primary.unit.id).not.toBe(bonus.unit.id);
    expect(() =>
      finishFactoryPrimaryTrain(fourth!.epoch, bonus.unit.id),
    ).toThrow(/not active/i);

    const ordinary = dispatchFactoryPrimaryTrain(
      createFactoryTrainServiceEpoch("factory-ordinary", "alpha"),
      "ordinary-primary",
      false,
    );
    expect(ordinary.bonusTrainRequired).toBe(false);
    expect(ordinary.epoch.p07PrimaryDispatchPhase).toBe(0);
  });
});
