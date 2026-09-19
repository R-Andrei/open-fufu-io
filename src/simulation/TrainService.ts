import type {
  CellId,
  StructureAcquisitionPath,
} from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import {
  reducedRational,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import {
  materializeCompiledScalarScaleFactor,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import {
  resolveExternalWartimeTradeMultiplier,
  type ExactFfyValue,
  type PositiveFfyEventInput,
} from "./Economy";
import {
  advanceMobileUnit,
  type MobileUnitRouteInput,
  type MobileUnitState,
} from "./MobileUnits";
import { grantPopulation, type PopulationState } from "./Population";
import type { UnitDestroyedEvent } from "./SimulationEvents";
import type { PersistentStructureState } from "./Structures";

export const TRAIN_RAIL_EDGE_WORK = 2 as const;
export const TRAIN_MOVEMENT_WORK_PER_TICK = 5 as const;
export const TRAIN_STATION_DWELL_TICKS = 15 as const;
export const TRAIN_TURNAROUND_ACTIVE_TICKS = 50 as const;

const P07_TURNAROUND_WORK_RATE_NUMERATOR = 5;
const P07_TURNAROUND_WORK_RATE_DENOMINATOR = 4;
const FACTORY_TRAIN_EVENT_BASE_FFY = Object.freeze({
  1: 10_000,
  2: 11_250,
  3: 12_500,
  4: 13_750,
  5: 15_000,
} as const);
const EXACT_ONE = Object.freeze({ numerator: 1n, denominator: 1n });
const FACTORY_RULE_SCOPE = Object.freeze({
  kind: "STRUCTURE" as const,
  structure: "FACTORY" as const,
});
const TRAIN_CITY_POPULATION_PER_LEVEL = 20;
const TRAIN_CITY_POPULATION_GRANT_DOMAIN = "TRAIN_CITY_POPULATION_GRANT";
const NO_BLOCKED_TRAIN_CELLS: ReadonlySet<CellId> = new Set<CellId>();

export interface FactoryTrainServiceEpochState {
  readonly factoryId: string;
  readonly ownerId: string;
  readonly activePrimaryTrainId: string | null;
  readonly turnaroundRemainingActiveTicks: number;
}

export interface FactoryTrainPrimaryDispatchResult {
  readonly epoch: FactoryTrainServiceEpochState;
}

export interface FactoryTrainDispatchRoutes {
  readonly primary: MobileUnitRouteInput;
}

export interface TrainMovementTickPlan {
  readonly movementWork: number;
  readonly stationEntryCellId: CellId | null;
  readonly holdResumeAtTick: number | null;
}

export interface TrainMovementTickResult {
  readonly unit: MobileUnitState;
  readonly stationEntryCellId: CellId | null;
  readonly resumeAtTick: number | null;
}

export interface TrainDispatchEconomicSnapshot {
  readonly factoryId: string;
  readonly dispatchOwnerId: string;
  readonly factoryLevel: number;
  readonly baseCargoFfy: ExactFfyValue;
}

export interface TrainStationFfyEventInput {
  readonly eventId: string;
  readonly externalWartimeMultiplier?: ExactFfyValue;
  readonly conditionApplies?: (condition: RuleCondition) => boolean;
}

export interface TrainCityPopulationGrantResult {
  readonly population: PopulationState;
  readonly grantedPopulation: number;
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

function factoryTrainTurnaroundActiveTicks(p07Active: boolean): number {
  if (!p07Active) return TRAIN_TURNAROUND_ACTIVE_TICKS;
  return Math.ceil(
    (TRAIN_TURNAROUND_ACTIVE_TICKS * P07_TURNAROUND_WORK_RATE_DENOMINATOR) /
      P07_TURNAROUND_WORK_RATE_NUMERATOR,
  );
}

function materializeExactNonNegative(
  value: ExactFfyValue,
  label: string,
): ExactFfyValue {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof value.numerator !== "bigint" ||
    typeof value.denominator !== "bigint" ||
    value.numerator < 0n ||
    value.denominator <= 0n
  ) {
    throw new Error(`${label} must be a non-negative exact rational`);
  }
  return Object.freeze(reducedRational(value.numerator, value.denominator));
}

function multiplyExact(
  left: ExactFfyValue,
  right: ExactFfyValue,
): ExactFfyValue {
  return Object.freeze(
    reducedRational(
      left.numerator * right.numerator,
      left.denominator * right.denominator,
    ),
  );
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

export function dispatchFactoryPrimaryTrain(
  state: FactoryTrainServiceEpochState,
  trainId: string,
  _p07Active: boolean,
): FactoryTrainPrimaryDispatchResult {
  return Object.freeze({
    epoch: markFactoryPrimaryTrainDispatched(state, trainId),
  });
}

export function finishFactoryPrimaryTrain(
  state: FactoryTrainServiceEpochState,
  trainId: string,
  p07Active = false,
): FactoryTrainServiceEpochState {
  if (state.activePrimaryTrainId !== trainId) {
    throw new Error(
      `Factory ${state.factoryId} primary Train ${trainId} is not active`,
    );
  }
  return freezeEpoch({
    ...state,
    activePrimaryTrainId: null,
    turnaroundRemainingActiveTicks: factoryTrainTurnaroundActiveTicks(p07Active),
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

export function createFactoryTrainDispatchRoutes(
  cells: readonly CellId[],
): FactoryTrainDispatchRoutes {
  return Object.freeze({
    primary: createTrainRouteInput(cells),
  });
}

export function resolveTrainExternalWartimeMultiplier(
  trainOwnerRules: CompiledRuleProfile,
  ruleDynamicState: RuleDynamicState,
  currentlyAtWar: boolean,
): ExactFfyValue {
  return resolveExternalWartimeTradeMultiplier(
    trainOwnerRules,
    ruleDynamicState,
    currentlyAtWar,
  );
}

export function resolveFactoryTrainEventBaseMultiplier(
  trainOwnerRules: CompiledRuleProfile,
  ruleDynamicState: RuleDynamicState,
  acquisitionPath: StructureAcquisitionPath,
): ExactFfyValue {
  const scale = materializeCompiledScalarScaleFactor(
    trainOwnerRules,
    RULE_AXIS_REGISTRY,
    "FACTORY_TRAIN_EVENT_BASE_VALUE",
    FACTORY_RULE_SCOPE,
    ruleDynamicState,
    (conditions) =>
      conditions.every(
        (condition) =>
          condition.kind === "STRUCTURE_ACQUISITION_PATH_IS" &&
          condition.path === acquisitionPath,
      ),
  );
  return Object.freeze(reducedRational(scale.numerator, scale.denominator));
}

export function createTrainDispatchEconomicSnapshot(
  factoryId: string,
  dispatchOwnerId: string,
  factoryLevel: number,
  factoryBaseMultiplier: ExactFfyValue = EXACT_ONE,
): TrainDispatchEconomicSnapshot {
  if (
    !Number.isSafeInteger(factoryLevel) ||
    factoryLevel < 1 ||
    factoryLevel > 5
  ) {
    throw new Error("Factory Train dispatch level must be an integer from 1 through 5");
  }
  const base = FACTORY_TRAIN_EVENT_BASE_FFY[
    factoryLevel as keyof typeof FACTORY_TRAIN_EVENT_BASE_FFY
  ];
  const multiplier = materializeExactNonNegative(
    factoryBaseMultiplier,
    "Factory Train base multiplier",
  );
  const baseCargoFfy = multiplyExact(
    Object.freeze({ numerator: BigInt(base), denominator: 1n }),
    multiplier,
  );
  return Object.freeze({
    factoryId,
    dispatchOwnerId,
    factoryLevel,
    baseCargoFfy,
  });
}

export function createTrainStationFfyEvent(
  snapshot: TrainDispatchEconomicSnapshot,
  input: TrainStationFfyEventInput,
): PositiveFfyEventInput {
  const externalWartimeMultiplier = materializeExactNonNegative(
    input.externalWartimeMultiplier ?? EXACT_ONE,
    "Train external wartime multiplier",
  );
  return Object.freeze({
    id: input.eventId,
    family: "INDUSTRIAL",
    baseValue: snapshot.baseCargoFfy,
    structuralMultiplier: externalWartimeMultiplier,
    ...(input.conditionApplies === undefined
      ? {}
      : { conditionApplies: input.conditionApplies }),
  });
}

export function applyTrainCityPopulationGrant(
  cityOwnerRules: CompiledRuleProfile,
  station: PersistentStructureState,
  cityOwnerPopulation: PopulationState,
  cityOwnerPopulationCapacity: number,
): TrainCityPopulationGrantResult {
  if (
    !Number.isSafeInteger(cityOwnerPopulationCapacity) ||
    cityOwnerPopulationCapacity < 0
  ) {
    throw new Error("Train City Population Capacity must be a non-negative safe integer");
  }

  const p33Active = cityOwnerRules.customDomains.some(
    (entry) => entry.domain === TRAIN_CITY_POPULATION_GRANT_DOMAIN,
  );
  if (
    !p33Active ||
    station.type !== "CITY" ||
    !station.active ||
    station.completedLevel === undefined
  ) {
    return Object.freeze({
      population: cityOwnerPopulation,
      grantedPopulation: 0,
    });
  }

  const capacityHeadroom = Math.max(
    0,
    cityOwnerPopulationCapacity - cityOwnerPopulation.total,
  );
  const authoredGrant =
    TRAIN_CITY_POPULATION_PER_LEVEL * station.completedLevel;
  const grantedPopulation = Math.min(authoredGrant, capacityHeadroom);
  if (grantedPopulation === 0) {
    return Object.freeze({
      population: cityOwnerPopulation,
      grantedPopulation: 0,
    });
  }

  return Object.freeze({
    population: grantPopulation(cityOwnerPopulation, grantedPopulation),
    grantedPopulation,
  });
}

function firstQualifyingStationEntryWithinTick(
  unit: MobileUnitState,
  qualifyingStationCellIds: ReadonlySet<CellId>,
  blockedCellIds: ReadonlySet<CellId>,
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
    if (blockedCellIds.has(enteredCellId)) return null;
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

export function planTrainMovementTick(
  unit: MobileUnitState,
  currentTick: number,
  resumeAtTick: number | null,
  qualifyingStationCellIds: readonly CellId[],
  blockedCellIds: ReadonlySet<CellId> = NO_BLOCKED_TRAIN_CELLS,
): TrainMovementTickPlan {
  assertCanonicalTick(currentTick, "Train current tick");
  if (resumeAtTick !== null) {
    assertCanonicalTick(resumeAtTick, "Train resume tick");
    if (currentTick < resumeAtTick) {
      return Object.freeze({
        movementWork: 0,
        stationEntryCellId: null,
        holdResumeAtTick: resumeAtTick,
      });
    }
  }

  const stationEntry = firstQualifyingStationEntryWithinTick(
    unit,
    new Set(qualifyingStationCellIds),
    blockedCellIds,
  );
  if (stationEntry !== null) {
    if (currentTick > Number.MAX_SAFE_INTEGER - TRAIN_STATION_DWELL_TICKS) {
      throw new Error("Train dwell resume tick exceeds the safe-integer range");
    }
    return Object.freeze({
      movementWork: stationEntry.movementWork,
      stationEntryCellId: stationEntry.cellId,
      holdResumeAtTick: null,
    });
  }

  return Object.freeze({
    movementWork: TRAIN_MOVEMENT_WORK_PER_TICK,
    stationEntryCellId: null,
    holdResumeAtTick: null,
  });
}

export function advanceTrainMovementTick(
  unit: MobileUnitState,
  currentTick: number,
  resumeAtTick: number | null,
  qualifyingStationCellIds: readonly CellId[],
  blockedCellIds: ReadonlySet<CellId> = NO_BLOCKED_TRAIN_CELLS,
): TrainMovementTickResult {
  const plan = planTrainMovementTick(
    unit,
    currentTick,
    resumeAtTick,
    qualifyingStationCellIds,
    blockedCellIds,
  );
  if (plan.movementWork === 0) {
    return Object.freeze({
      unit,
      stationEntryCellId: null,
      resumeAtTick: plan.holdResumeAtTick,
    });
  }

  const advanced = advanceMobileUnit(unit, plan.movementWork, blockedCellIds).unit;
  const stationEntered =
    plan.stationEntryCellId !== null &&
    advanced.cellId === plan.stationEntryCellId;
  return Object.freeze({
    unit: advanced,
    stationEntryCellId: stationEntered ? plan.stationEntryCellId : null,
    resumeAtTick: stationEntered
      ? currentTick + TRAIN_STATION_DWELL_TICKS
      : null,
  });
}

export interface TrainInterceptionEconomicInput {
  readonly raiderEventId: string;
  readonly pendingStationEvent?: PositiveFfyEventInput | null;
  readonly conditionApplies?: (condition: RuleCondition) => boolean;
}

export interface TrainInterceptionEconomicOutcome {
  readonly canceledStationEventId: string | null;
  readonly pendingStationEvent: null;
  readonly raiderEvent: PositiveFfyEventInput;
}

export function resolveTrainInterceptionEconomicOutcome(
  snapshot: TrainDispatchEconomicSnapshot,
  input: TrainInterceptionEconomicInput,
): TrainInterceptionEconomicOutcome {
  const pendingStationEvent = input.pendingStationEvent ?? null;
  return Object.freeze({
    canceledStationEventId: pendingStationEvent?.id ?? null,
    pendingStationEvent: null,
    raiderEvent: Object.freeze({
      id: input.raiderEventId,
      family: "MILITARY_CONQUEST",
      baseValue: snapshot.baseCargoFfy,
      conditionApplies: input.conditionApplies ?? (() => false),
    }),
  });
}

export interface TrainDestroyedEconomicService {
  readonly trainId: string;
  readonly dispatchSnapshot: TrainDispatchEconomicSnapshot;
}

export interface TrainDestroyedEconomicResolution {
  readonly trainId: string;
  readonly raiderOwnerId: string;
  readonly economic: TrainInterceptionEconomicOutcome;
}

export function resolveTrainDestroyedEconomicOutcome(
  services: readonly TrainDestroyedEconomicService[],
  destructionEvent: UnitDestroyedEvent,
  input: TrainInterceptionEconomicInput,
): TrainDestroyedEconomicResolution | null {
  if (destructionEvent.payload.unit.unitType !== "TRAIN") return null;

  const service = services.find(
    (candidate) => candidate.trainId === destructionEvent.payload.unit.unitId,
  );
  if (service === undefined) return null;

  let creditedCause = destructionEvent.payload.causes.find(
    (cause) =>
      cause.kind === "UNIT_ATTACK" && cause.attacker.unitType === "TANK",
  );
  if (creditedCause === undefined) return null;

  for (const cause of destructionEvent.payload.causes) {
    if (
      cause.kind === "UNIT_ATTACK" &&
      cause.attacker.unitType === "TANK" &&
      cause.attacker.unitId < creditedCause.attacker.unitId
    ) {
      creditedCause = cause;
    }
  }

  return Object.freeze({
    trainId: service.trainId,
    raiderOwnerId: creditedCause.attacker.ownerId,
    economic: resolveTrainInterceptionEconomicOutcome(
      service.dispatchSnapshot,
      input,
    ),
  });
}
