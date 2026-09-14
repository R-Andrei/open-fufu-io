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
} from "./MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  type MobileUnitState,
} from "./MobileUnits";
import {
  advanceVehicleRepairIntentPhase,
  advanceVehicleRepairMovementPhase,
  advanceVehicleRepairServicePhase,
  fixedRepairField,
  repairFieldContainsCell,
  repairPerTick,
  repairServiceProfileForLevel,
  scaledRepairField,
  vehicleFastServiceUnitIds,
  type ExactRepairAmount,
  type RepairServiceProfile,
  type VehicleRepairDomain,
  type VehicleRepairPhaseResult,
  type VehicleRepairProviderState,
  type VehicleRepairRoute,
} from "./RepairService";
import type { PersistentStructureState } from "./Structures";
import {
  tankCellTraversalTiming,
  tankNavigationRoute,
  type TankChassisType,
  type TankExactHealth,
  type TankOperationalState,
} from "./Tanks";

const TICKS_PER_SECOND = 10n;
const BASE_TANK_MAX_HEALTH = 1_000n;

interface TankRepairProvider extends VehicleRepairProviderState {
  readonly structure: PersistentStructureState;
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

function factoryRepairCondition(
  condition: RuleCondition,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
): boolean {
  switch (condition.kind) {
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return condition.path === factory.acquisitionPath;
    case "TARGET_UNIT_IS":
      return condition.unit === chassisType;
    default:
      throw new Error(`Unsupported Tank-repair rule condition ${condition.kind}`);
  }
}

function repairTerms(
  state: MatchState,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
  axis: "STRUCTURE_REPAIR_RADIUS" | "STRUCTURE_REPAIR_RATE",
) {
  const owner = state.factions.find((faction) => faction.id === factory.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${factory.ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: "FACTORY",
  } as const satisfies RuleScope;
  return conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      axis,
      scope,
      ruleDynamicState(state, factory.ownerId),
    ),
    (conditions) =>
      conditions.every((condition) =>
        factoryRepairCondition(condition, factory, chassisType),
      ),
  );
}

function serviceProfile(factory: PersistentStructureState): RepairServiceProfile {
  const level = factory.completedLevel;
  if (level === undefined) {
    throw new Error(`Factory ${factory.id} has no completed repair-service level`);
  }
  return repairServiceProfileForLevel(level);
}

function effectiveBroadRepairField(
  state: MatchState,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
  profile: RepairServiceProfile,
): StructureRadialFieldProfile {
  const terms = repairTerms(
    state,
    factory,
    chassisType,
    "STRUCTURE_REPAIR_RADIUS",
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RADIUS,
    terms,
  );
  if (scale.numerator < 0n || scale.denominator <= 0n) {
    throw new Error("Factory broad repair radius must resolve to a non-negative value");
  }
  return scaledRepairField(
    profile.broadRadiusCells,
    scale.numerator,
    scale.denominator,
  );
}

function effectiveRepairPerTick(
  state: MatchState,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
  baseHealthPerSecond: ExactRepairAmount,
): ExactRepairAmount {
  const terms = repairTerms(
    state,
    factory,
    chassisType,
    "STRUCTURE_REPAIR_RATE",
  );
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

function effectiveTankMaxHealth(
  state: MatchState,
  ownerId: string,
): TankExactHealth {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_MAX_HEALTH",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_MAX_HEALTH,
    terms,
  );
  const health = reducedRational(
    BASE_TANK_MAX_HEALTH * scale.numerator,
    scale.denominator,
  );
  if (health.numerator <= 0n || health.denominator <= 0n) {
    throw new Error("Tank maximum health must resolve to a positive value");
  }
  return Object.freeze({
    numerator: health.numerator,
    denominator: health.denominator,
  });
}

function chassisTypeOf(unit: MobileUnitState): TankChassisType | undefined {
  if (unit.type === "TANK" || unit.type === "HEAVY_ARTILLERY") {
    return unit.type;
  }
  return undefined;
}

function clearUnitRoute(state: MatchState, unit: MobileUnitState): MobileUnitState {
  if (unit.route === undefined) return unit;
  return assignMobileUnitRoute(state.map, unit, {
    cells: [unit.cellId],
    edgeWeights: [],
  });
}

function withRepairAssignment(
  operational: TankOperationalState,
  factoryId: string,
  arrivalTick: number | undefined,
): TankOperationalState {
  if (arrivalTick === undefined) {
    const { repairArrivalTick: _arrivalTick, ...withoutArrival } = operational;
    return Object.freeze({ ...withoutArrival, repairFactoryId: factoryId });
  }
  return Object.freeze({
    ...operational,
    repairFactoryId: factoryId,
    repairArrivalTick: arrivalTick,
  });
}

function clearRepairAssignment(
  operational: TankOperationalState,
  health: ExactRepairAmount,
): TankOperationalState {
  const {
    repairFactoryId: _repairFactoryId,
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

function tankRepairProviders(state: MatchState): readonly TankRepairProvider[] {
  return Object.freeze(
    state.structures.flatMap((structure) => {
      if (
        structure.type !== "FACTORY" ||
        !structure.active ||
        structure.completedLevel === undefined
      ) {
        return [];
      }
      return [
        Object.freeze({
          id: structure.id,
          cellId: structure.cellId,
          profile: serviceProfile(structure),
          structure,
        }),
      ];
    }),
  );
}

function tankRepairDomain(
  state: MatchState,
): VehicleRepairDomain<MobileUnitState, TankOperationalState, TankRepairProvider> {
  return Object.freeze({
    map: state.map,
    tick: state.tick,
    units: state.mobileUnits,
    operationalStates: state.tankOperationalStates,
    providers: tankRepairProviders(state),
    isRepairableUnit: (unit) => chassisTypeOf(unit) !== undefined,
    isEligibleProvider: (provider, unit) =>
      provider.structure.ownerId === unit.ownerId,
    repairProviderId: (operational) => operational.repairFactoryId,
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
    maximumHealth: (unit) => effectiveTankMaxHealth(state, unit.ownerId),
    routeTo: (unit, destinationCellId): VehicleRepairRoute | undefined => {
      const chassisType = chassisTypeOf(unit);
      if (chassisType === undefined) return undefined;
      const route = tankNavigationRoute(
        state,
        unit.ownerId,
        chassisType,
        unit.cellId,
        destinationCellId,
      );
      return route.status === "FOUND" ? route.route : undefined;
    },
    isTraversableCell: (unit, cellId) => {
      const chassisType = chassisTypeOf(unit);
      return (
        chassisType !== undefined &&
        tankCellTraversalTiming(
          state,
          unit.ownerId,
          chassisType,
          cellId,
        ) !== undefined
      );
    },
    movementWorkPerTick: (unit) => {
      const chassisType = chassisTypeOf(unit);
      if (chassisType === undefined) return undefined;
      const route = tankNavigationRoute(
        state,
        unit.ownerId,
        chassisType,
        unit.cellId,
        unit.cellId,
      );
      return route.status === "FOUND" ? route.route.movementWorkPerTick : undefined;
    },
    assignRoute: (unit, route) =>
      assignMobileUnitRoute(state.map, unit, {
        cells: route.cells,
        edgeWeights: route.edgeWeights,
      }),
    clearRoute: (unit) => clearUnitRoute(state, unit),
    advanceUnit: (unit, movementWorkPerTick) =>
      advanceMobileUnit(unit, movementWorkPerTick).unit,
    broadRepairField: (provider, unit) => {
      const chassisType = chassisTypeOf(unit);
      if (chassisType === undefined) {
        throw new Error(`unsupported Factory repair unit type: ${unit.type}`);
      }
      return effectiveBroadRepairField(
        state,
        provider.structure,
        chassisType,
        provider.profile,
      );
    },
    repairPerTick: (provider, unit, fastService) => {
      const chassisType = chassisTypeOf(unit);
      if (chassisType === undefined) {
        throw new Error(`unsupported Factory repair unit type: ${unit.type}`);
      }
      return effectiveRepairPerTick(
        state,
        provider.structure,
        chassisType,
        fastService
          ? provider.profile.fastHealthPerSecond
          : provider.profile.broadHealthPerSecond,
      );
    },
  });
}

function applyRepairPhase(
  state: MatchState,
  result: VehicleRepairPhaseResult<MobileUnitState, TankOperationalState>,
): MatchState {
  if (!result.changed) return state;
  return createProspectiveMatchState(state, {
    mobileUnits: result.units,
    tankOperationalStates: result.operationalStates,
  });
}

export function advanceTankRepairIntentPhase(state: MatchState): MatchState {
  return applyRepairPhase(
    state,
    advanceVehicleRepairIntentPhase(tankRepairDomain(state)),
  );
}

export function advanceTankRepairMovementPhase(state: MatchState): MatchState {
  return applyRepairPhase(
    state,
    advanceVehicleRepairMovementPhase(tankRepairDomain(state)),
  );
}

export function settleTankRepairMovementPhase(
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
    tankRepairProviders(stateBeforeMovement).map((provider) => [provider.id, provider]),
  );
  const operationalUpdates = new Map<string, TankOperationalState>();

  for (const operational of stateBeforeMovement.tankOperationalStates) {
    const providerId = operational.repairFactoryId;
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
      beforeUnit.route === undefined ||
      afterUnit.route !== undefined ||
      chassisTypeOf(beforeUnit) === undefined
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
      withRepairAssignment(operational, providerId, stateBeforeMovement.tick),
    );
  }

  if (operationalUpdates.size === 0) return stateAfterMovement;
  return createProspectiveMatchState(stateAfterMovement, {
    tankOperationalStates: stateAfterMovement.tankOperationalStates.map(
      (operational) => operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}

export function tankFastServiceUnitIds(state: MatchState): ReadonlySet<string> {
  return vehicleFastServiceUnitIds(tankRepairDomain(state));
}

export function advanceTankRepairPhase(state: MatchState): MatchState {
  return applyRepairPhase(
    state,
    advanceVehicleRepairServicePhase(tankRepairDomain(state)),
  );
}
