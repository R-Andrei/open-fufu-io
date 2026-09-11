import type { CellId } from "../core/controller/ControllerApi";
import {
  advanceMobileUnit,
  type MobileUnitRouteInput,
  type MobileUnitState,
} from "./MobileUnits";

export const TRAIN_RAIL_EDGE_WORK = 2 as const;
export const TRAIN_MOVEMENT_WORK_PER_TICK = 5 as const;
export const TRAIN_STATION_DWELL_TICKS = 15 as const;
export const TRAIN_TURNAROUND_ACTIVE_TICKS = 50 as const;

export interface FactoryTrainServiceEpochState {
  readonly factoryId: string;
  readonly ownerId: string;
  readonly activePrimaryTrainId: string | null;
  readonly turnaroundRemainingActiveTicks: number;
}

export interface TrainMovementTickResult {
  readonly unit: MobileUnitState;
  readonly stationEntryCellId: CellId | null;
  readonly resumeAtTick: number | null;
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

function assertCanonicalTick(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
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

export function transferFactoryTrainServiceEpoch(
  state: FactoryTrainServiceEpochState,
  newOwnerId: string,
): FactoryTrainServiceEpochState {
  return createFactoryTrainServiceEpoch(state.factoryId, newOwnerId);
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

function firstQualifyingStationEntryWithinTick(
  unit: MobileUnitState,
  qualifyingStationCellIds: ReadonlySet<CellId>,
): Readonly<{ cellId: CellId; movementWork: number }> | null {
  const route = unit.route;
  if (route === undefined) return null;

  let movementWork =
    route.edgeWeights[route.nextCellIndex - 1]! - route.edgeProgress;
  for (
    let cellIndex = route.nextCellIndex;
    cellIndex < route.cells.length;
    cellIndex += 1
  ) {
    if (movementWork > TRAIN_MOVEMENT_WORK_PER_TICK) return null;

    const enteredCellId = route.cells[cellIndex]!;
    if (qualifyingStationCellIds.has(enteredCellId)) {
      return Object.freeze({
        cellId: enteredCellId,
        movementWork,
      });
    }

    if (cellIndex < route.edgeWeights.length) {
      movementWork += route.edgeWeights[cellIndex]!;
    }
  }

  return null;
}

export function advanceTrainMovementTick(
  unit: MobileUnitState,
  currentTick: number,
  resumeAtTick: number | null,
  qualifyingStationCellIds: readonly CellId[],
): TrainMovementTickResult {
  assertCanonicalTick(currentTick, "Train current tick");
  if (resumeAtTick !== null) {
    assertCanonicalTick(resumeAtTick, "Train resume tick");
    if (currentTick < resumeAtTick) {
      return Object.freeze({
        unit,
        stationEntryCellId: null,
        resumeAtTick,
      });
    }
  }

  const stationEntry = firstQualifyingStationEntryWithinTick(
    unit,
    new Set(qualifyingStationCellIds),
  );
  if (stationEntry !== null) {
    if (currentTick > Number.MAX_SAFE_INTEGER - TRAIN_STATION_DWELL_TICKS) {
      throw new Error("Train dwell resume tick exceeds the safe-integer range");
    }
    const advanced = advanceMobileUnit(unit, stationEntry.movementWork);
    return Object.freeze({
      unit: advanced.unit,
      stationEntryCellId: stationEntry.cellId,
      resumeAtTick: currentTick + TRAIN_STATION_DWELL_TICKS,
    });
  }

  return Object.freeze({
    unit: advanceMobileUnit(unit, TRAIN_MOVEMENT_WORK_PER_TICK).unit,
    stationEntryCellId: null,
    resumeAtTick: null,
  });
}
