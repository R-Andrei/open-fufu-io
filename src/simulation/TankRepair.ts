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
  addRepairClamped,
  fixedRepairField,
  repairFieldContainsCell,
  repairPerTick,
  repairServiceProfileForLevel,
  scaledRepairField,
  selectFastServiceUnitIds,
  type ExactRepairAmount,
  type RepairServiceProfile,
} from "./RepairService";
import type { PersistentStructureState } from "./Structures";
import {
  tankCellTraversalTiming,
  tankNavigationRoute,
  type TankChassisType,
  type TankExactHealth,
  type TankNavigationRoute,
  type TankOperationalState,
} from "./Tanks";

const TICKS_PER_SECOND = 10n;
const BASE_TANK_MAX_HEALTH = 1_000n;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
): TankExactHealth {
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
  const repair = repairPerTick(
    baseHealthPerSecond,
    scale.numerator,
    scale.denominator,
    TICKS_PER_SECOND,
  );
  return Object.freeze({
    numerator: repair.numerator,
    denominator: repair.denominator,
  });
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

function insideField(
  state: MatchState,
  factory: PersistentStructureState,
  unit: MobileUnitState,
  field: StructureRadialFieldProfile,
): boolean {
  return cellInsideField(state, factory, unit.cellId, field);
}

function cellInsideField(
  state: MatchState,
  factory: PersistentStructureState,
  cellId: number,
  field: StructureRadialFieldProfile,
): boolean {
  const center = state.map.positionOf(factory.cellId);
  const candidate = state.map.positionOf(cellId);
  return repairFieldContainsCell(
    field,
    center.x,
    center.y,
    candidate.x,
    candidate.y,
  );
}

function clearRepairState(
  operational: TankOperationalState,
  health: TankExactHealth,
): TankOperationalState {
  const {
    repairFactoryId: _repairFactoryId,
    repairArrivalTick: _repairArrivalTick,
    ...withoutRepair
  } = operational;
  return Object.freeze({ ...withoutRepair, health });
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

function withRepairFactory(
  operational: TankOperationalState,
  factoryId: string,
): TankOperationalState {
  const { repairArrivalTick: _repairArrivalTick, ...withoutArrival } = operational;
  return Object.freeze({ ...withoutArrival, repairFactoryId: factoryId });
}

function withRepairArrival(
  operational: TankOperationalState,
  factoryId: string,
  tick: number,
): TankOperationalState {
  return Object.freeze({
    ...operational,
    repairFactoryId: factoryId,
    repairArrivalTick: tick,
  });
}

function isEligibleRepairFactory(
  factory: PersistentStructureState,
  unit: MobileUnitState,
): boolean {
  return (
    factory.type === "FACTORY" &&
    factory.active &&
    factory.completedLevel !== undefined &&
    factory.ownerId === unit.ownerId
  );
}

function atOrBelowRepairThreshold(
  health: TankExactHealth,
  maximum: TankExactHealth,
): boolean {
  if (health.numerator <= 0n) return false;
  return (
    health.numerator * maximum.denominator * 2n <=
    maximum.numerator * health.denominator
  );
}

function fastServiceCellIds(
  state: MatchState,
  factory: PersistentStructureState,
  profile: RepairServiceProfile,
): readonly number[] {
  const field = fixedRepairField(profile.fastRadiusCells);
  const center = state.map.positionOf(factory.cellId);
  const cells: number[] = [];
  const radius = profile.fastRadiusCells;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (
        !repairFieldContainsCell(
          field,
          center.x,
          center.y,
          center.x + dx,
          center.y + dy,
        )
      ) {
        continue;
      }
      const cellId = state.map.cellIdAt(center.x + dx, center.y + dy);
      if (cellId !== undefined) cells.push(cellId);
    }
  }
  cells.sort((left, right) => left - right);
  return Object.freeze(cells);
}

interface RepairDestination {
  readonly factory: PersistentStructureState;
  readonly destinationCellId: number;
  readonly route: TankNavigationRoute;
}

function bestDestinationForFactory(
  state: MatchState,
  unit: MobileUnitState,
  chassisType: TankChassisType,
  factory: PersistentStructureState,
): RepairDestination | undefined {
  const profile = serviceProfile(factory);
  let best: RepairDestination | undefined;
  for (const destinationCellId of fastServiceCellIds(state, factory, profile)) {
    const routed = tankNavigationRoute(
      state,
      unit.ownerId,
      chassisType,
      unit.cellId,
      destinationCellId,
    );
    if (routed.status !== "FOUND") continue;
    const candidate = Object.freeze({
      factory,
      destinationCellId,
      route: routed.route,
    });
    if (
      best === undefined ||
      candidate.route.totalWeight < best.route.totalWeight ||
      (candidate.route.totalWeight === best.route.totalWeight &&
        candidate.destinationCellId < best.destinationCellId)
    ) {
      best = candidate;
      if (candidate.route.totalWeight === 0) break;
    }
  }
  return best;
}

function bestRepairDestination(
  state: MatchState,
  unit: MobileUnitState,
  chassisType: TankChassisType,
): RepairDestination | undefined {
  let best: RepairDestination | undefined;
  const factories = state.structures
    .filter((factory) => isEligibleRepairFactory(factory, unit))
    .sort((left, right) => compareIds(left.id, right.id));
  for (const factory of factories) {
    const candidate = bestDestinationForFactory(
      state,
      unit,
      chassisType,
      factory,
    );
    if (candidate === undefined) continue;
    if (
      best === undefined ||
      candidate.route.totalWeight < best.route.totalWeight ||
      (candidate.route.totalWeight === best.route.totalWeight &&
        compareIds(candidate.factory.id, best.factory.id) < 0)
    ) {
      best = candidate;
    }
  }
  return best;
}

function existingRepairRouteIsLegal(
  state: MatchState,
  unit: MobileUnitState,
  chassisType: TankChassisType,
  factory: PersistentStructureState,
  fastField: StructureRadialFieldProfile,
): boolean {
  const route = unit.route;
  if (
    route === undefined ||
    !cellInsideField(state, factory, route.destinationCellId, fastField)
  ) {
    return false;
  }
  for (let index = route.nextCellIndex - 1; index < route.cells.length; index += 1) {
    if (
      tankCellTraversalTiming(
        state,
        unit.ownerId,
        chassisType,
        route.cells[index]!,
      ) === undefined
    ) {
      return false;
    }
  }
  return true;
}

function assignRepairDestination(
  state: MatchState,
  unit: MobileUnitState,
  operational: TankOperationalState,
  chassisType: TankChassisType,
  destination: RepairDestination,
  preserveExistingRoute: boolean,
): Readonly<{
  unit: MobileUnitState;
  operational: TankOperationalState;
}> {
  const profile = serviceProfile(destination.factory);
  const fastField = fixedRepairField(profile.fastRadiusCells);
  if (insideField(state, destination.factory, unit, fastField)) {
    return Object.freeze({
      unit: clearUnitRoute(state, unit),
      operational: withRepairArrival(
        operational,
        destination.factory.id,
        state.tick,
      ),
    });
  }
  if (
    preserveExistingRoute &&
    existingRepairRouteIsLegal(
      state,
      unit,
      chassisType,
      destination.factory,
      fastField,
    )
  ) {
    return Object.freeze({
      unit,
      operational: withRepairFactory(operational, destination.factory.id),
    });
  }
  const routed = assignMobileUnitRoute(state.map, unit, {
    cells: destination.route.cells,
    edgeWeights: destination.route.edgeWeights,
  });
  return Object.freeze({
    unit: routed,
    operational:
      routed.route === undefined
        ? withRepairArrival(operational, destination.factory.id, state.tick)
        : withRepairFactory(operational, destination.factory.id),
  });
}

function preserveExistingRepairAssignment(
  state: MatchState,
  unit: MobileUnitState,
  operational: TankOperationalState,
  chassisType: TankChassisType,
  factory: PersistentStructureState,
): Readonly<{
  unit: MobileUnitState;
  operational: TankOperationalState;
}> | undefined {
  if (!isEligibleRepairFactory(factory, unit)) return undefined;
  const profile = serviceProfile(factory);
  const fastField = fixedRepairField(profile.fastRadiusCells);
  if (
    operational.repairArrivalTick !== undefined &&
    insideField(state, factory, unit, fastField)
  ) {
    return Object.freeze({
      unit: clearUnitRoute(state, unit),
      operational,
    });
  }
  if (
    operational.repairArrivalTick === undefined &&
    existingRepairRouteIsLegal(state, unit, chassisType, factory, fastField)
  ) {
    return Object.freeze({ unit, operational });
  }
  const destination = bestDestinationForFactory(
    state,
    unit,
    chassisType,
    factory,
  );
  if (destination === undefined) return undefined;
  return assignRepairDestination(
    state,
    unit,
    operational,
    chassisType,
    destination,
    false,
  );
}

export function advanceTankRepairIntentPhase(state: MatchState): MatchState {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const structuresById = new Map(
    state.structures.map((structure) => [structure.id, structure]),
  );
  const unitUpdates = new Map<string, MobileUnitState>();
  const operationalUpdates = new Map<string, TankOperationalState>();

  for (const operational of state.tankOperationalStates) {
    const unit = unitsById.get(operational.unitId);
    if (unit === undefined) continue;
    const chassisType = chassisTypeOf(unit);
    if (chassisType === undefined) continue;

    if (operational.repairFactoryId !== undefined) {
      const assignedFactory = structuresById.get(operational.repairFactoryId);
      if (assignedFactory !== undefined) {
        const preserved = preserveExistingRepairAssignment(
          state,
          unit,
          operational,
          chassisType,
          assignedFactory,
        );
        if (preserved !== undefined) {
          if (preserved.unit !== unit) unitUpdates.set(unit.id, preserved.unit);
          if (preserved.operational !== operational) {
            operationalUpdates.set(unit.id, preserved.operational);
          }
          continue;
        }
      }

      const replacement = bestRepairDestination(state, unit, chassisType);
      if (replacement !== undefined) {
        const assigned = assignRepairDestination(
          state,
          unit,
          operational,
          chassisType,
          replacement,
          false,
        );
        if (assigned.unit !== unit) unitUpdates.set(unit.id, assigned.unit);
        operationalUpdates.set(unit.id, assigned.operational);
      } else {
        const cleared = clearRepairState(operational, operational.health);
        const clearedUnit = clearUnitRoute(state, unit);
        if (clearedUnit !== unit) unitUpdates.set(unit.id, clearedUnit);
        operationalUpdates.set(unit.id, cleared);
      }
      continue;
    }

    const maximum = effectiveTankMaxHealth(state, unit.ownerId);
    if (!atOrBelowRepairThreshold(operational.health, maximum)) continue;
    const destination = bestRepairDestination(state, unit, chassisType);
    if (destination === undefined) continue;
    const assigned = assignRepairDestination(
      state,
      unit,
      operational,
      chassisType,
      destination,
      false,
    );
    if (assigned.unit !== unit) unitUpdates.set(unit.id, assigned.unit);
    operationalUpdates.set(unit.id, assigned.operational);
  }

  if (unitUpdates.size === 0 && operationalUpdates.size === 0) return state;
  return createProspectiveMatchState(state, {
    mobileUnits: state.mobileUnits.map((unit) => unitUpdates.get(unit.id) ?? unit),
    tankOperationalStates: state.tankOperationalStates.map(
      (operational) => operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}

export function advanceTankRepairMovementPhase(state: MatchState): MatchState {
  const operationalById = new Map(
    state.tankOperationalStates.map((operational) => [operational.unitId, operational]),
  );
  const structuresById = new Map(
    state.structures.map((structure) => [structure.id, structure]),
  );
  const unitUpdates = new Map<string, MobileUnitState>();
  const operationalUpdates = new Map<string, TankOperationalState>();

  for (const unit of state.mobileUnits) {
    const operational = operationalById.get(unit.id);
    if (
      operational === undefined ||
      operational.repairFactoryId === undefined ||
      operational.repairArrivalTick !== undefined ||
      unit.route === undefined
    ) {
      continue;
    }
    const chassisType = chassisTypeOf(unit);
    if (chassisType === undefined) continue;
    const movementProfile = tankNavigationRoute(
      state,
      unit.ownerId,
      chassisType,
      unit.cellId,
      unit.cellId,
    );
    if (movementProfile.status !== "FOUND") continue;

    const advanced = advanceMobileUnit(
      unit,
      movementProfile.route.movementWorkPerTick,
    ).unit;
    if (advanced !== unit) unitUpdates.set(unit.id, advanced);
    if (advanced.route !== undefined) continue;

    const factory = structuresById.get(operational.repairFactoryId);
    if (factory === undefined || !isEligibleRepairFactory(factory, advanced)) {
      continue;
    }
    const fastField = fixedRepairField(serviceProfile(factory).fastRadiusCells);
    if (!insideField(state, factory, advanced, fastField)) continue;
    operationalUpdates.set(
      unit.id,
      withRepairArrival(
        operational,
        operational.repairFactoryId,
        state.tick,
      ),
    );
  }

  if (unitUpdates.size === 0 && operationalUpdates.size === 0) return state;
  return createProspectiveMatchState(state, {
    mobileUnits: state.mobileUnits.map((unit) => unitUpdates.get(unit.id) ?? unit),
    tankOperationalStates: state.tankOperationalStates.map(
      (operational) => operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}

interface RepairCandidate {
  readonly operational: TankOperationalState;
  readonly unit: MobileUnitState;
  readonly chassisType: TankChassisType;
  readonly broadField: StructureRadialFieldProfile;
}

export function advanceTankRepairPhase(state: MatchState): MatchState {
  const unitById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const updates = new Map<string, TankOperationalState>();
  const factories = state.structures
    .filter(
      (structure) =>
        structure.type === "FACTORY" &&
        structure.active &&
        structure.completedLevel !== undefined,
    )
    .sort((left, right) => compareIds(left.id, right.id));

  for (const factory of factories) {
    const profile = serviceProfile(factory);
    const fastField = fixedRepairField(profile.fastRadiusCells);
    const candidates: RepairCandidate[] = state.tankOperationalStates
      .filter((operational) => operational.repairFactoryId === factory.id)
      .flatMap((operational) => {
        const unit = unitById.get(operational.unitId);
        if (unit === undefined || unit.ownerId !== factory.ownerId) return [];
        const chassisType = chassisTypeOf(unit);
        if (chassisType === undefined) return [];
        return [
          {
            operational,
            unit,
            chassisType,
            broadField: effectiveBroadRepairField(
              state,
              factory,
              chassisType,
              profile,
            ),
          },
        ];
      });

    const fastRecipients = new Set(
      selectFastServiceUnitIds(
        candidates.flatMap((candidate) => {
          const arrival = candidate.operational.repairArrivalTick;
          if (
            arrival === undefined ||
            !insideField(state, factory, candidate.unit, fastField)
          ) {
            return [];
          }
          return [
            {
              unitId: candidate.operational.unitId,
              repairArrivalTick: arrival,
            },
          ];
        }),
        profile.fastCapacity,
      ),
    );

    for (const candidate of candidates) {
      const useFast = fastRecipients.has(candidate.operational.unitId);
      const useBroad =
        !useFast &&
        insideField(state, factory, candidate.unit, candidate.broadField);
      if (!useFast && !useBroad) continue;

      const maximum = effectiveTankMaxHealth(state, candidate.unit.ownerId);
      const repair = effectiveRepairPerTick(
        state,
        factory,
        candidate.chassisType,
        useFast
          ? profile.fastHealthPerSecond
          : profile.broadHealthPerSecond,
      );
      const result = addRepairClamped(
        candidate.operational.health,
        repair,
        maximum,
      );
      const health = Object.freeze({
        numerator: result.amount.numerator,
        denominator: result.amount.denominator,
      });
      const updated = result.full
        ? clearRepairState(candidate.operational, health)
        : Object.freeze({ ...candidate.operational, health });
      updates.set(candidate.operational.unitId, updated);
    }
  }

  if (updates.size === 0) return state;
  return createProspectiveMatchState(state, {
    tankOperationalStates: state.tankOperationalStates.map(
      (operational) => updates.get(operational.unitId) ?? operational,
    ),
  });
}
