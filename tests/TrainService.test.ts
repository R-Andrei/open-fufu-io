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
  createFactoryTrainServiceEpoch,
  createTrainRouteInput,
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
});
