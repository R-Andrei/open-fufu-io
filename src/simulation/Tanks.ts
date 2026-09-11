import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  reducedRational,
  ruleScopeMatches,
  selectRuleContributionsForScope,
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { tryDebitFfy, type ExactFfyValue } from "./Economy";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import type { SimulationMap } from "./SimulationMap";
import type { PersistentStructureState } from "./Structures";

export type TankChassisType = "TANK" | "HEAVY_ARTILLERY";

export type TankProductionJobState =
  | {
      readonly factoryId: string;
      readonly ownerId: string;
      readonly chassisType: TankChassisType;
      readonly state: "BUILDING";
      readonly remainingTicks: number;
    }
  | {
      readonly factoryId: string;
      readonly ownerId: string;
      readonly chassisType: TankChassisType;
      readonly state: "WAITING_DEPLOYMENT";
    };

export interface StartTankProductionRequest {
  readonly ownerId: string;
  readonly factoryId: string;
}

export type TankProductionFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "UNKNOWN_FACTORY"
  | "NOT_OWNER"
  | "FACTORY_INACTIVE"
  | "FACTORY_LEVEL_REQUIRED"
  | "FACTORY_CAPACITY"
  | "BUILD_NOT_PERMITTED"
  | "INSUFFICIENT_FFY";

export type StartTankProductionResult =
  | {
      readonly ok: true;
      readonly cost: number;
      readonly job: TankProductionJobState;
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: TankProductionFailureCode }>;
      readonly state: MatchState;
    };

const BASE_TANK_BUILD_TICKS = 50;
const HEAVY_ARTILLERY_BUILD_TICKS = 100;

function failure(
  state: MatchState,
  code: TankProductionFailureCode,
): StartTankProductionResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

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

function exactMultiply(
  left: ExactFfyValue,
  numerator: bigint,
  denominator: bigint,
): ExactFfyValue {
  const reduced = reducedRational(
    left.numerator * numerator,
    left.denominator * denominator,
  );
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

function effectiveTankChassisType(
  state: MatchState,
  ownerId: string,
): TankChassisType {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_CHASSIS_PROFILE",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );
  if (terms.length === 0) return "TANK";
  if (terms.length !== 1) {
    throw new Error("Tank chassis profile must resolve to at most one transform");
  }
  const value = terms[0]?.value;
  if (
    value?.kind !== "SINGLETON" ||
    (value.value !== "HEAVY_ARTILLERY" && value.value !== "TANK")
  ) {
    throw new Error("Tank chassis profile resolved to an unsupported profile");
  }
  return value.value;
}

function unitBuildPermitted(state: MatchState, ownerId: string): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "UNIT_BUILD_PERMISSION",
    scope,
    owner.rules.contributions,
  );
  if (
    contributions.some(
      (entry) => entry.conditions !== undefined && entry.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned Tank build permission requires an explicit Tank admission context",
    );
  }
  return reducePermissionRule(
    true,
    RULE_AXIS_REGISTRY.UNIT_BUILD_PERMISSION,
    contributions,
  );
}

function activeTankChassisCount(state: MatchState, ownerId: string): number {
  return state.mobileUnits.filter(
    (unit) =>
      unit.ownerId === ownerId &&
      (unit.type === "TANK" || unit.type === "HEAVY_ARTILLERY"),
  ).length;
}

export function tankPurchaseCost(activeTankChassis: number): number {
  if (
    !Number.isSafeInteger(activeTankChassis) ||
    activeTankChassis < 0 ||
    Object.is(activeTankChassis, -0)
  ) {
    throw new Error("active Tank chassis count must be a non-negative safe integer");
  }
  return Math.min(1_000_000, 250_000 * (activeTankChassis + 1));
}

function effectiveTankPurchaseCost(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
): ExactFfyValue {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_PURCHASE_FFY_COST",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );

  let cost: ExactFfyValue = Object.freeze({
    numerator: BigInt(tankPurchaseCost(activeTankChassisCount(state, ownerId))),
    denominator: 1n,
  });
  if (chassisType === "HEAVY_ARTILLERY") {
    cost = exactMultiply(cost, 3n, 2n);
  }
  if (terms.some((term) => term.stage === "TERMINAL")) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_PURCHASE_FFY_COST,
    terms,
  );
  return exactMultiply(cost, scale.numerator, scale.denominator);
}

function factoryWorkCondition(
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
      throw new Error(
        `Unsupported Tank-construction rule condition ${condition.kind}`,
      );
  }
}

function effectiveTankBuildTicks(
  state: MatchState,
  ownerId: string,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: "FACTORY",
  } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_UNIT_CONSTRUCTION_WORK_RATE",
      scope,
      ruleDynamicState(state, ownerId),
    ),
    (conditions) =>
      conditions.every((condition) =>
        factoryWorkCondition(condition, factory, chassisType),
      ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_UNIT_CONSTRUCTION_WORK_RATE,
    terms,
  );
  if (scale.numerator <= 0n || scale.denominator <= 0n) {
    throw new Error("Tank construction work rate must resolve to a positive value");
  }
  const baseTicks =
    chassisType === "HEAVY_ARTILLERY"
      ? HEAVY_ARTILLERY_BUILD_TICKS
      : BASE_TANK_BUILD_TICKS;
  const numerator = BigInt(baseTicks) * scale.denominator;
  const ticks = (numerator + scale.numerator - 1n) / scale.numerator;
  if (ticks <= 0n || ticks > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Tank build duration must resolve to a positive safe integer");
  }
  return Number(ticks);
}

export function tankWeaponRangeContains(
  map: SimulationMap,
  attackerCellId: number,
  targetCellId: number,
  range: number,
): boolean {
  if (!map.isValidCellId(attackerCellId) || !map.isValidCellId(targetCellId)) {
    throw new Error("Tank weapon range query requires valid map cells");
  }
  if (!Number.isFinite(range) || range < 0) {
    throw new Error("Tank weapon range must be a finite non-negative value");
  }
  const attacker = map.positionOf(attackerCellId);
  const target = map.positionOf(targetCellId);
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  return dx * dx + dy * dy <= range * range;
}

export function tryStartTankProduction(
  state: MatchState,
  request: StartTankProductionRequest,
): StartTankProductionResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.factoryId !== "string" ||
    request.factoryId.length === 0
  ) {
    return failure(state, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return failure(state, "UNKNOWN_OWNER");
  const factory = state.structures.find(
    (structure) => structure.id === request.factoryId,
  );
  if (factory === undefined || factory.type !== "FACTORY") {
    return failure(state, "UNKNOWN_FACTORY");
  }
  if (factory.ownerId !== request.ownerId) return failure(state, "NOT_OWNER");
  if (!factory.active) return failure(state, "FACTORY_INACTIVE");
  if (factory.completedLevel === undefined || factory.completedLevel < 1) {
    return failure(state, "FACTORY_LEVEL_REQUIRED");
  }
  if (
    (state.tankProductionJobs ?? []).some(
      (job) => job.factoryId === request.factoryId,
    )
  ) {
    return failure(state, "FACTORY_CAPACITY");
  }
  if (!unitBuildPermitted(state, request.ownerId)) {
    return failure(state, "BUILD_NOT_PERMITTED");
  }

  const chassisType = effectiveTankChassisType(state, request.ownerId);
  const debit = tryDebitFfy(
    owner.ffy,
    effectiveTankPurchaseCost(state, request.ownerId, chassisType),
  );
  if (!debit.ok) return failure(state, "INSUFFICIENT_FFY");

  const job = Object.freeze({
    factoryId: factory.id,
    ownerId: request.ownerId,
    chassisType,
    state: "BUILDING" as const,
    remainingTicks: effectiveTankBuildTicks(
      state,
      request.ownerId,
      factory,
      chassisType,
    ),
  });
  const factions = state.factions.map((faction) =>
    faction.id === request.ownerId
      ? Object.freeze({ ...faction, ffy: debit.balance })
      : faction,
  );
  const jobs = Object.freeze(
    [...(state.tankProductionJobs ?? []), job].sort((left, right) =>
      compareIds(left.factoryId, right.factoryId),
    ),
  );
  const next = createProspectiveMatchState(state, {
    factions,
    tankProductionJobs: jobs,
  });
  return Object.freeze({
    ok: true,
    cost: debit.cost,
    job,
    state: next,
  });
}
