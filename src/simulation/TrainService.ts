import type { CellId } from "../core/controller/ControllerApi";
import type { MobileUnitRouteInput } from "./MobileUnits";

export const TRAIN_RAIL_EDGE_WORK = 2 as const;
export const TRAIN_MOVEMENT_WORK_PER_TICK = 5 as const;
export const TRAIN_TURNAROUND_ACTIVE_TICKS = 50 as const;

export interface FactoryTrainServiceEpochState {
  readonly factoryId: string;
  readonly ownerId: string;
  readonly activePrimaryTrainId: string | null;
  readonly turnaroundRemainingActiveTicks: number;
}

function freezeEpoch(
  state: FactoryTrainServiceEpochState,
): FactoryTrainServiceEpochState {
  return Object.freeze({
    factoryId: state.factoryId,
    ownerId: state.ownerId,
    activePrimaryTrainId: state.activePrimaryTrainId,
    turnaroundRemainingActiveTicks: state.turnaroundRemainingActiveTicks,
  });
}

export function createFactoryTrainServiceEpoch(
  factoryId: string,
  ownerId: string,
): FactoryTrainServiceEpochState {
  return freezeEpoch({
    factoryId,
    ownerId,
    activePrimaryTrainId: null,
    turnaroundRemainingActiveTicks: 0,
  });
}

export function canDispatchFactoryPrimaryTrain(
  state: FactoryTrainServiceEpochState,
  factoryActive: boolean,
  hasServiceLoop: boolean,
): boolean {
  return (
    factoryActive &&
    hasServiceLoop &&
    state.activePrimaryTrainId === null &&
    state.turnaroundRemainingActiveTicks === 0
  );
}

export function markFactoryPrimaryTrainDispatched(
  state: FactoryTrainServiceEpochState,
  trainId: string,
): FactoryTrainServiceEpochState {
  if (state.activePrimaryTrainId !== null) {
    throw new Error(
      `Factory ${state.factoryId} already has active primary Train ${state.activePrimaryTrainId}`,
    );
  }
  if (state.turnaroundRemainingActiveTicks !== 0) {
    throw new Error(
      `Factory ${state.factoryId} primary Train is still in turnaround`,
    );
  }
  return freezeEpoch({
    ...state,
    activePrimaryTrainId: trainId,
  });
}

export function finishFactoryPrimaryTrain(
  state: FactoryTrainServiceEpochState,
  trainId: string,
): FactoryTrainServiceEpochState {
  if (state.activePrimaryTrainId !== trainId) {
    throw new Error(
      `Factory ${state.factoryId} primary Train ${trainId} is not active`,
    );
  }
  return freezeEpoch({
    ...state,
    activePrimaryTrainId: null,
    turnaroundRemainingActiveTicks: TRAIN_TURNAROUND_ACTIVE_TICKS,
  });
}

export function advanceFactoryTrainServiceSchedulerTick(
  state: FactoryTrainServiceEpochState,
  factoryActive: boolean,
): FactoryTrainServiceEpochState {
  if (
    !factoryActive ||
    state.activePrimaryTrainId !== null ||
    state.turnaroundRemainingActiveTicks === 0
  ) {
    return state;
  }
  return freezeEpoch({
    ...state,
    turnaroundRemainingActiveTicks: state.turnaroundRemainingActiveTicks - 1,
  });
}

export function createTrainRouteInput(
  cells: readonly CellId[],
): MobileUnitRouteInput {
  const routeCells = Object.freeze([...cells]);
  return Object.freeze({
    cells: routeCells,
    edgeWeights: Object.freeze(
      Array.from(
        { length: Math.max(0, routeCells.length - 1) },
        () => TRAIN_RAIL_EDGE_WORK,
      ),
    ),
  });
}
