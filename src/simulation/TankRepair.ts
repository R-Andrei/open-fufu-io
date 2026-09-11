import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducedRational,
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromRangeFactor,
  type StructureRadialFieldProfile,
} from "../core/rules/StructureFieldGeometry";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import type { MobileUnitState } from "./MobileUnits";
import type { PersistentStructureState } from "./Structures";
import type {
  TankChassisType,
  TankExactHealth,
  TankOperationalState,
} from "./Tanks";

const BASE_FACTORY_REPAIR_RADIUS_CELLS = 5;
const BASE_FACTORY_REPAIR_HEALTH_PER_SECOND = 100n;
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

function effectiveRepairField(
  state: MatchState,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
): StructureRadialFieldProfile {
  const terms = repairTerms(
    state,
    factory,
    chassisType,
    "STRUCTURE_REPAIR_RADIUS",
  );
  if (terms.some((term) => term.stage === "FINAL_OVERRIDE")) {
    const radius = materializeScalarRuleTerms(
      BASE_FACTORY_REPAIR_RADIUS_CELLS,
      RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RADIUS,
      terms,
    );
    if (!Number.isSafeInteger(radius) || radius < 0 || Object.is(radius, -0)) {
      throw new Error(
        "Factory repair-radius final override must resolve to a non-negative safe-integer cell radius",
      );
    }
    return structureRadialFieldFromRangeFactor(radius, 1n, 1n);
  }

  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RADIUS,
    terms,
  );
  if (scale.numerator < 0n || scale.denominator <= 0n) {
    throw new Error("Factory repair radius must resolve to a non-negative value");
  }
  return structureRadialFieldFromRangeFactor(
    BASE_FACTORY_REPAIR_RADIUS_CELLS,
    scale.numerator,
    scale.denominator,
  );
}

function effectiveRepairPerTick(
  state: MatchState,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
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
  if (scale.numerator < 0n || scale.denominator <= 0n) {
    throw new Error("Factory repair rate must resolve to a non-negative value");
  }
  const repair = reducedRational(
    BASE_FACTORY_REPAIR_HEALTH_PER_SECOND * scale.numerator,
    TICKS_PER_SECOND * scale.denominator,
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

function healthAtLeast(left: TankExactHealth, right: TankExactHealth): boolean {
  return left.numerator * right.denominator >= right.numerator * left.denominator;
}

function repairedHealth(
  current: TankExactHealth,
  repair: TankExactHealth,
  maximum: TankExactHealth,
): Readonly<{ health: TankExactHealth; full: boolean }> {
  if (healthAtLeast(current, maximum)) {
    return Object.freeze({ health: current, full: true });
  }
  const sum = reducedRational(
    current.numerator * repair.denominator + repair.numerator * current.denominator,
    current.denominator * repair.denominator,
  );
  const candidate = Object.freeze({
    numerator: sum.numerator,
    denominator: sum.denominator,
  });
  if (healthAtLeast(candidate, maximum)) {
    return Object.freeze({ health: maximum, full: true });
  }
  return Object.freeze({ health: candidate, full: false });
}

function chassisTypeOf(unit: MobileUnitState): TankChassisType | undefined {
  if (unit.type === "TANK" || unit.type === "HEAVY_ARTILLERY") {
    return unit.type;
  }
  return undefined;
}

function insideRepairField(
  state: MatchState,
  factory: PersistentStructureState,
  unit: MobileUnitState,
  chassisType: TankChassisType,
): boolean {
  const field = effectiveRepairField(state, factory, chassisType);
  const center = state.map.positionOf(factory.cellId);
  const candidate = state.map.positionOf(unit.cellId);
  return structureRadialFieldContainsCell(
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
    const candidates = state.tankOperationalStates
      .filter(
        (operational) =>
          operational.repairFactoryId === factory.id &&
          operational.repairArrivalTick !== undefined,
      )
      .flatMap((operational) => {
        const unit = unitById.get(operational.unitId);
        if (unit === undefined || unit.ownerId !== factory.ownerId) return [];
        const chassisType = chassisTypeOf(unit);
        if (chassisType === undefined) return [];
        if (!insideRepairField(state, factory, unit, chassisType)) return [];
        return [{ operational, unit, chassisType }];
      })
      .sort(
        (left, right) =>
          left.operational.repairArrivalTick! -
            right.operational.repairArrivalTick! ||
          compareIds(left.operational.unitId, right.operational.unitId),
      );

    for (const candidate of candidates.slice(0, factory.completedLevel!)) {
      const maximum = effectiveTankMaxHealth(state, candidate.unit.ownerId);
      const repair = effectiveRepairPerTick(
        state,
        factory,
        candidate.chassisType,
      );
      const result = repairedHealth(
        candidate.operational.health,
        repair,
        maximum,
      );
      const updated = result.full
        ? clearRepairState(candidate.operational, result.health)
        : Object.freeze({ ...candidate.operational, health: result.health });
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
