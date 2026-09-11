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
import type { MobileUnitState } from "./MobileUnits";
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
import type {
  TankChassisType,
  TankExactHealth,
  TankOperationalState,
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
  const center = state.map.positionOf(factory.cellId);
  const candidate = state.map.positionOf(unit.cellId);
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
