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
  TRAIN_TURNAROUND_ACTIVE_TICKS,
  advanceFactoryTrainServiceSchedulerTick,
  canDispatchFactoryPrimaryTrain,
  createFactoryTrainServiceEpoch,
  createTrainRouteInput,
  finishFactoryPrimaryTrain,
  markFactoryPrimaryTrainDispatched,
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
});
