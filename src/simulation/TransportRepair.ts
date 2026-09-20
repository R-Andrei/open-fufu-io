import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducedRational,
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import type { StructureRadialFieldProfile } from "../core/rules/StructureFieldGeometry";
import {
  createProspectiveMatchState,
  type MatchState,
  type TransportExactHealth,
  type TransportOperationalState,
  type TransportRepairResumeRoute,
} from "./MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  type MobileUnitState,
} from "./MobileUnits";
import { createNavigation, type NavigationTraversalPolicy } from "./Navigation";
import {
  advanceVehicleRepairIntentPhase,
  advanceVehicleRepairServicePhase,
  fixedRepairField,
  repairFieldContainsCell,
  repairPerTick,
  repairServiceProfileForLevel,
  scaledRepairField,
  vehicleFastServiceQueueEntries,
  type ExactRepairAmount,
  type RepairServiceProfile,
  type VehicleFastServiceQueueEntry,
  type VehicleRepairDomain,
  type VehicleRepairPhaseResult,
  type VehicleRepairProviderState,
  type VehicleRepairRoute,
} from "./RepairService";

const TICKS_PER_SECOND = 10n;
const BASE_TRANSPORT_SPEED_CELLS_PER_SECOND = 10n;
const BASE_ARMORED_TRANSPORT_MAX_HEALTH = 500n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

interface RepairableTransportOperationalState extends TransportOperationalState {
  readonly health: TransportExactHealth;
}

interface TransportRepairProvider extends VehicleRepairProviderState {
  readonly structure: MatchState["structures"][number];
}

function territorialContactCount(state: MatchState, ownerId: string): number {
  const active = new Set(
    state.factions
      .filter((faction) => faction.status === "ACTIVE")
      .map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < state.ownership.length; cellId += 1) {
    if (state.ownership[cellId] !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwner = state.ownership[neighbor] ?? null;
      if (
        neighborOwner !== null &&
        neighborOwner !== ownerId &&
        active.has(neighborOwner)
      ) {
        contacts.add(neighborOwner);
      }
    }
  }
  return contacts.size;
}

function ruleDynamicState(state: MatchState, ownerId: string): RuleDynamicState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: territorialContactCount(state, ownerId),
    peakTotalPopulation: owner.population.peakTotal,
  });
}

function portRepairCondition(
  condition: RuleCondition,
  port: MatchState["structures"][number],
): boolean {
  switch (condition.kind) {
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return condition.path === port.acquisitionPath;
    case "TARGET_UNIT_IS":
      return condition.unit === "TRANSPORT_SHIP";
    default:
      throw new Error(
        `Unsupported Transport/Port repair rule condition ${condition.kind}`,
      );
  }
}

function repairTerms(
  state: MatchState,
  port: MatchState["structures"][number],
  axis:
    | "STRUCTURE_REPAIR_RADIUS"
    | "STRUCTURE_FAST_REPAIR_RADIUS"
    | "STRUCTURE_REPAIR_RATE",
) {
  const owner = state.factions.find((faction) => faction.id === port.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${port.ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: "PORT",
  } as const satisfies RuleScope;
  return conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      axis,
      scope,
      ruleDynamicState(state, port.ownerId),
    ),
    (conditions) =>
      conditions.every((condition) => portRepairCondition(condition, port)),
  );
}

function integralScaledRadius(
  baseRadiusCells: number,
  scaleNumerator: bigint,
  scaleDenominator: bigint,
  label: string,
): number {
  if (scaleNumerator < 0n || scaleDenominator <= 0n) {
    throw new Error(`${label} must resolve to a non-negative scale`);
  }
  const numerator = BigInt(baseRadiusCells) * scaleNumerator;
  if (numerator % scaleDenominator !== 0n) {
    throw new Error(`${label} must resolve to an integral cell radius`);
  }
  const radius = numerator / scaleDenominator;
  if (radius > MAX_SAFE_BIGINT) {
    throw new Error(`${label} exceeds the safe-integer cell range`);
  }
  return Number(radius);
}

function serviceProfile(
  state: MatchState,
  port: MatchState["structures"][number],
): RepairServiceProfile {
  const level = port.completedLevel;
  if (level === undefined) {
    throw new Error(`Port ${port.id} has no completed repair-service level`);
  }
  const base = repairServiceProfileForLevel(level);
  const terms = repairTerms(state, port, "STRUCTURE_FAST_REPAIR_RADIUS");
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_FAST_REPAIR_RADIUS,
    terms,
  );
  return Object.freeze({
    ...base,
    fastRadiusCells: integralScaledRadius(
      base.fastRadiusCells,
      scale.numerator,
      scale.denominator,
      "Port fast repair radius",
    ),
  });
}

function effectiveBroadRepairField(
  state: MatchState,
  port: MatchState["structures"][number],
  profile: RepairServiceProfile,
): StructureRadialFieldProfile {
  const terms = repairTerms(state, port, "STRUCTURE_REPAIR_RADIUS");
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RADIUS,
    terms,
  );
  return scaledRepairField(
    profile.broadRadiusCells,
    scale.numerator,
    scale.denominator,
  );
}

function effectiveRepairPerTick(
  state: MatchState,
  port: MatchState["structures"][number],
  baseHealthPerSecond: ExactRepairAmount,
): ExactRepairAmount {
  const terms = repairTerms(state, port, "STRUCTURE_REPAIR_RATE");
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RATE,
    terms,
  );
  return repairPerTick(
    baseHealthPerSecond,
    scale.numerator,
    scale.denominator,
    TICKS_PER_SECOND,
  );
}

function movementTiming(
  state: MatchState,
  ownerId: string,
): Readonly<{ movementWorkPerTick: number; edgeWeight: number }> {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = {
    kind: "UNIT",
    unit: "TRANSPORT_SHIP",
  } as const satisfies RuleScope;
  const terms = resolvedRuleTermsForScope(
    owner.rules,
    RULE_AXIS_REGISTRY,
    "UNIT_MOVEMENT_SPEED",
    scope,
    ruleDynamicState(state, ownerId),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_MOVEMENT_SPEED,
    terms,
  );
  if (scale.numerator <= 0n || scale.denominator <= 0n) {
    throw new Error("Transport movement speed must resolve to a positive value");
  }
  const perTick = reducedRational(
    BASE_TRANSPORT_SPEED_CELLS_PER_SECOND * scale.numerator,
    scale.denominator * TICKS_PER_SECOND,
  );
  if (
    perTick.numerator <= 0n ||
    perTick.denominator <= 0n ||
    perTick.numerator > MAX_SAFE_BIGINT ||
    perTick.denominator > MAX_SAFE_BIGINT
  ) {
    throw new Error("Transport movement timing exceeds the safe-integer range");
  }
  return Object.freeze({
    movementWorkPerTick: Number(perTick.numerator),
    edgeWeight: Number(perTick.denominator),
  });
}

function isTransportWaterCell(state: MatchState, cellId: number): boolean {
  const terrain = state.map.terrainAt(cellId);
  return terrain === "SHALLOW_WATER" || terrain === "DEEP_WATER";
}

function routeCellAvailable(
  state: MatchState,
  unit: MobileUnitState,
  cellId: number,
  respectMobileOccupancy: boolean,
): boolean {
  if (!isTransportWaterCell(state, cellId)) return false;
  if (state.structures.some((structure) => structure.cellId === cellId)) {
    return false;
  }
  if (!respectMobileOccupancy || cellId === unit.cellId) return true;
  return !state.mobileUnits.some(
    (candidate) => candidate.id !== unit.id && candidate.cellId === cellId,
  );
}

function transportRoute(
  state: MatchState,
  unit: MobileUnitState,
  destinationCellId: number,
  respectMobileOccupancy: boolean,
): VehicleRepairRoute | undefined {
  if (
    unit.type !== "TRANSPORT_SHIP" ||
    !state.map.isValidCellId(destinationCellId)
  ) {
    return undefined;
  }
  const timing = movementTiming(state, unit.ownerId);
  const policy: NavigationTraversalPolicy = {
    traversalWeight: (fromCellId, toCellId) =>
      routeCellAvailable(state, unit, fromCellId, respectMobileOccupancy) &&
      routeCellAvailable(state, unit, toCellId, respectMobileOccupancy)
        ? timing.edgeWeight
        : undefined,
  };
  const result = createNavigation(state.map).path(
    unit.cellId,
    destinationCellId,
    policy,
  );
  if (result.status !== "FOUND") return undefined;
  const cells = Object.freeze([...result.path.cells]);
  return Object.freeze({
    cells,
    edgeWeights: Object.freeze(cells.slice(1).map(() => timing.edgeWeight)),
    totalWeight: result.path.totalWeight,
    movementWorkPerTick: timing.movementWorkPerTick,
  });
}

function clearUnitRoute(
  state: MatchState,
  unit: MobileUnitState,
): MobileUnitState {
  if (unit.route === undefined) return unit;
  return assignMobileUnitRoute(state.map, unit, {
    cells: [unit.cellId],
    edgeWeights: [],
  });
}

function withRepairAssignment(
  operational: RepairableTransportOperationalState,
  portId: string,
  arrivalTick: number | undefined,
): RepairableTransportOperationalState {
  if (arrivalTick === undefined) {
    const {
      repairArrivalTick: _arrivalTick,
      ...withoutArrival
    } = operational;
    return Object.freeze({
      ...withoutArrival,
      repairPortId: portId,
    });
  }
  return Object.freeze({
    ...operational,
    repairPortId: portId,
    repairArrivalTick: arrivalTick,
  });
}

function clearRepairAssignment(
  operational: RepairableTransportOperationalState,
  health: ExactRepairAmount,
): RepairableTransportOperationalState {
  const {
    repairPortId: _repairPortId,
    repairArrivalTick: _repairArrivalTick,
    ...withoutRepair
  } = operational;
  return Object.freeze({
    ...withoutRepair,
    health: Object.freeze({
      numerator: health.numerator,
      denominator: health.denominator,
    }),
  });
}

function repairableOperationalStates(
  state: MatchState,
): readonly RepairableTransportOperationalState[] {
  return Object.freeze(
    state.transportOperationalStates.filter(
      (entry): entry is RepairableTransportOperationalState =>
        entry.health !== undefined,
    ),
  );
}

function transportRepairProviders(
  state: MatchState,
): readonly TransportRepairProvider[] {
  return Object.freeze(
    state.structures.flatMap((structure) => {
      if (
        structure.type !== "PORT" ||
        !structure.active ||
        structure.completedLevel === undefined
      ) {
        return [];
      }
      return [
        Object.freeze({
          id: structure.id,
          cellId: structure.cellId,
          profile: serviceProfile(state, structure),
          structure,
        }),
      ];
    }),
  );
}

function transportRepairDomain(
  state: MatchState,
): VehicleRepairDomain<
  MobileUnitState,
  RepairableTransportOperationalState,
  TransportRepairProvider
> {
  return Object.freeze({
    map: state.map,
    tick: state.tick,
    units: state.mobileUnits,
    operationalStates: repairableOperationalStates(state),
    providers: transportRepairProviders(state),
    isRepairableUnit: (unit) => unit.type === "TRANSPORT_SHIP",
    isEligibleProvider: (provider, unit) =>
      provider.structure.ownerId === unit.ownerId,
    repairProviderId: (operational) => operational.repairPortId,
    repairArrivalTick: (operational) => operational.repairArrivalTick,
    withRepairAssignment,
    clearRepairAssignment,
    withHealth: (operational, health) =>
      Object.freeze({
        ...operational,
        health: Object.freeze({
          numerator: health.numerator,
          denominator: health.denominator,
        }),
      }),
    maximumHealth: () =>
      Object.freeze({
        numerator: BASE_ARMORED_TRANSPORT_MAX_HEALTH,
        denominator: 1n,
      }),
    routeTo: (unit, destinationCellId) =>
      transportRoute(state, unit, destinationCellId, true),
    isTraversableCell: (_unit, cellId) => isTransportWaterCell(state, cellId),
    movementWorkPerTick: (unit) =>
      unit.type === "TRANSPORT_SHIP"
        ? movementTiming(state, unit.ownerId).movementWorkPerTick
        : undefined,
    assignRoute: (unit, route) =>
      assignMobileUnitRoute(state.map, unit, {
        cells: route.cells,
        edgeWeights: route.edgeWeights,
      }),
    clearRoute: (unit) => clearUnitRoute(state, unit),
    advanceUnit: (unit, movementWorkPerTick) =>
      advanceMobileUnit(unit, movementWorkPerTick).unit,
    broadRepairField: (provider) =>
      effectiveBroadRepairField(
        state,
        provider.structure,
        provider.profile,
      ),
    repairPerTick: (provider, _unit, fastService) =>
      effectiveRepairPerTick(
        state,
        provider.structure,
        fastService
          ? provider.profile.fastHealthPerSecond
          : provider.profile.broadHealthPerSecond,
      ),
  });
}

function snapshotResumeRoute(
  unit: MobileUnitState,
): TransportRepairResumeRoute | undefined {
  const route = unit.route;
  if (route === undefined || route.nextCellIndex >= route.cells.length) {
    return undefined;
  }
  const startIndex = route.nextCellIndex - 1;
  const cells = [...route.cells.slice(startIndex)];
  const edgeWeights = [...route.edgeWeights.slice(startIndex)];
  if (cells[0] !== unit.cellId) {
    throw new Error("Transport retained route does not begin at its current cell");
  }
  if (edgeWeights.length > 0 && route.edgeProgress > 0) {
    const remaining = edgeWeights[0]! - route.edgeProgress;
    if (!Number.isSafeInteger(remaining) || remaining <= 0) {
      throw new Error("Transport retained route has invalid remaining edge work");
    }
    edgeWeights[0] = remaining;
  }
  return Object.freeze({
    interruptionCellId: unit.cellId,
    destinationCellId: route.destinationCellId,
    cells: Object.freeze(cells),
    edgeWeights: Object.freeze(edgeWeights),
  });
}

function mergeRepairableOperationalStates(
  state: MatchState,
  repairable: readonly RepairableTransportOperationalState[],
): readonly TransportOperationalState[] {
  const byId = new Map(repairable.map((entry) => [entry.unitId, entry]));
  return Object.freeze(
    state.transportOperationalStates.map(
      (entry) => byId.get(entry.unitId) ?? entry,
    ),
  );
}

function applyRepairPhase(
  state: MatchState,
  result: VehicleRepairPhaseResult<
    MobileUnitState,
    RepairableTransportOperationalState
  >,
  resumeSnapshots?: ReadonlyMap<string, TransportRepairResumeRoute>,
): MatchState {
  if (!result.changed && (resumeSnapshots?.size ?? 0) === 0) return state;
  const beforeById = new Map(
    state.transportOperationalStates.map((entry) => [entry.unitId, entry]),
  );
  const withSnapshots = result.operationalStates.map((operational) => {
    const before = beforeById.get(operational.unitId);
    const snapshot = resumeSnapshots?.get(operational.unitId);
    if (
      before?.repairPortId === undefined &&
      operational.repairPortId !== undefined &&
      operational.repairResumeRoute === undefined &&
      snapshot !== undefined
    ) {
      return Object.freeze({
        ...operational,
        repairResumeRoute: snapshot,
      });
    }
    return operational;
  });
  return createProspectiveMatchState(state, {
    mobileUnits: result.units,
    transportOperationalStates: mergeRepairableOperationalStates(
      state,
      withSnapshots,
    ),
  });
}

function restoreUnassignedResumeRoutes(state: MatchState): MatchState {
  const unitUpdates = new Map<string, MobileUnitState>();
  const operationalUpdates = new Map<string, TransportOperationalState>();
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));

  for (const operational of state.transportOperationalStates) {
    const resume = operational.repairResumeRoute;
    if (operational.repairPortId !== undefined || resume === undefined) continue;
    const unit = unitsById.get(operational.unitId);
    if (unit === undefined || unit.type !== "TRANSPORT_SHIP") continue;
    const rejoin = transportRoute(
      state,
      unit,
      resume.interruptionCellId,
      false,
    );
    if (rejoin === undefined) continue;
    const cells = Object.freeze([
      ...rejoin.cells,
      ...resume.cells.slice(1),
    ]);
    const edgeWeights = Object.freeze([
      ...rejoin.edgeWeights,
      ...resume.edgeWeights,
    ]);
    const restoredUnit = assignMobileUnitRoute(state.map, unit, {
      cells,
      edgeWeights,
    });
    const {
      repairResumeRoute: _repairResumeRoute,
      ...withoutResume
    } = operational;
    unitUpdates.set(unit.id, restoredUnit);
    operationalUpdates.set(
      operational.unitId,
      Object.freeze(withoutResume),
    );
  }

  if (unitUpdates.size === 0 && operationalUpdates.size === 0) return state;
  return createProspectiveMatchState(state, {
    mobileUnits: state.mobileUnits.map(
      (unit) => unitUpdates.get(unit.id) ?? unit,
    ),
    transportOperationalStates: state.transportOperationalStates.map(
      (operational) =>
        operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}

export function advanceTransportRepairIntentPhase(
  state: MatchState,
): MatchState {
  const resumed = restoreUnassignedResumeRoutes(state);
  const unitsById = new Map(resumed.mobileUnits.map((unit) => [unit.id, unit]));
  const snapshots = new Map<string, TransportRepairResumeRoute>();
  for (const operational of repairableOperationalStates(resumed)) {
    if (operational.repairPortId !== undefined) continue;
    const unit = unitsById.get(operational.unitId);
    if (unit === undefined) continue;
    const snapshot = snapshotResumeRoute(unit);
    if (snapshot !== undefined) snapshots.set(operational.unitId, snapshot);
  }
  const result = advanceVehicleRepairIntentPhase(
    transportRepairDomain(resumed),
  );
  return restoreUnassignedResumeRoutes(
    applyRepairPhase(resumed, result, snapshots),
  );
}

export function transportRepairMovementWorkByUnitId(
  state: MatchState,
): Readonly<Record<string, number>> {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const work: Record<string, number> = {};
  for (const operational of repairableOperationalStates(state)) {
    if (
      operational.repairPortId === undefined ||
      operational.repairArrivalTick !== undefined
    ) {
      continue;
    }
    const unit = unitsById.get(operational.unitId);
    if (
      unit === undefined ||
      unit.type !== "TRANSPORT_SHIP" ||
      unit.route === undefined
    ) {
      continue;
    }
    work[unit.id] = movementTiming(state, unit.ownerId).movementWorkPerTick;
  }
  return Object.freeze(work);
}

export function settleTransportRepairMovementPhase(
  stateBeforeMovement: MatchState,
  stateAfterMovement: MatchState,
): MatchState {
  const beforeUnitsById = new Map(
    stateBeforeMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const afterUnitsById = new Map(
    stateAfterMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const providersById = new Map(
    transportRepairProviders(stateBeforeMovement).map((provider) => [
      provider.id,
      provider,
    ]),
  );
  const operationalUpdates = new Map<string, TransportOperationalState>();

  for (const operational of repairableOperationalStates(stateBeforeMovement)) {
    const providerId = operational.repairPortId;
    if (
      providerId === undefined ||
      operational.repairArrivalTick !== undefined
    ) {
      continue;
    }
    const beforeUnit = beforeUnitsById.get(operational.unitId);
    const afterUnit = afterUnitsById.get(operational.unitId);
    if (
      beforeUnit === undefined ||
      afterUnit === undefined ||
      beforeUnit.type !== "TRANSPORT_SHIP" ||
      beforeUnit.route === undefined ||
      afterUnit.route !== undefined
    ) {
      continue;
    }
    const provider = providersById.get(providerId);
    if (
      provider === undefined ||
      provider.structure.ownerId !== afterUnit.ownerId
    ) {
      continue;
    }
    const field = fixedRepairField(provider.profile.fastRadiusCells);
    const center = stateBeforeMovement.map.positionOf(provider.cellId);
    const candidate = stateBeforeMovement.map.positionOf(afterUnit.cellId);
    if (
      !repairFieldContainsCell(
        field,
        center.x,
        center.y,
        candidate.x,
        candidate.y,
      )
    ) {
      continue;
    }
    operationalUpdates.set(
      operational.unitId,
      withRepairAssignment(
        operational,
        providerId,
        stateBeforeMovement.tick,
      ),
    );
  }

  if (operationalUpdates.size === 0) return stateAfterMovement;
  return createProspectiveMatchState(stateAfterMovement, {
    transportOperationalStates:
      stateAfterMovement.transportOperationalStates.map(
        (operational) =>
          operationalUpdates.get(operational.unitId) ?? operational,
      ),
  });
}

export function transportFastServiceQueueEntries(
  state: MatchState,
): readonly VehicleFastServiceQueueEntry[] {
  return vehicleFastServiceQueueEntries(transportRepairDomain(state));
}

export function advanceTransportRepairPhase(
  state: MatchState,
  selectedFastServiceUnitIds?: ReadonlySet<string>,
): MatchState {
  const result = advanceVehicleRepairServicePhase(
    transportRepairDomain(state),
    selectedFastServiceUnitIds,
  );
  return restoreUnassignedResumeRoutes(applyRepairPhase(state, result));
}
