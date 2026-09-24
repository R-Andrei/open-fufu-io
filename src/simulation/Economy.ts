import { pow as deterministicPow } from "../core/DetMath";
import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import {
  isTerrainScopeId,
  rationalToFiniteNumber,
  reducePermissionRule,
  reducedRational,
  selectRuleContributionsForScope,
  selectStructuralTransform,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeCompiledScalarRule,
  materializeCompiledScalarScaleFactor,
  resolvedRuleTermsForScope,
  type ExactRuleScaleFactor,
  type ResolvedRuleTerm,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromAreaFactor,
  structureRadialFieldFromRangeFactor,
} from "../core/rules/StructureFieldGeometry";
import { landTerrainBaseSpec } from "./LandOperations";
import type { MatchFactionState, MatchState } from "./MatchState";
import { POPULATION_GROWTH_RESIDUAL_SCALE } from "./Population";

export const STARTING_FFY = 25_000;
export const BASELINE_PASSIVE_FFY_PER_SECOND = 1_000;
export const ECONOMY_TICKS_PER_SECOND = 10;

const BASELINE_PASSIVE_FFY_PER_TICK =
  BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;
const PASSIVE_FFY_DOMAIN = "PASSIVE_FFY_SOURCE";
const DESERT_FFY_BONUS_BP = 600;
const BASIS_POINTS = 10_000n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const FFY_ALL_SCOPE = Object.freeze({
  kind: "FFY_FAMILY" as const,
  family: "ALL" as const,
});
const FFY_PIRACY_SCOPE = Object.freeze({
  kind: "FFY_FAMILY" as const,
  family: "PIRACY" as const,
});
const FFY_EVENT_FAMILIES = new Set<FfyEventFamily>([
  "ALL",
  "MILITARY_CONQUEST",
  "NAVAL_TRADE",
  "INDUSTRIAL",
]);
const FFY_EVENT_SPECIALIZATIONS = new Set<FfyEventSpecialization>(["PIRACY"]);

export interface ExactFfyValue {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export type FfyEventFamily =
  | "ALL"
  | "MILITARY_CONQUEST"
  | "NAVAL_TRADE"
  | "INDUSTRIAL";

export type FfyEventSpecialization = "PIRACY";

export interface PositiveFfyEventInput {
  readonly id: string;
  readonly family: FfyEventFamily;
  readonly specialization?: FfyEventSpecialization;
  readonly baseValue: ExactFfyValue;
  readonly structuralMultiplier?: ExactFfyValue;
  readonly conditionApplies?: (condition: RuleCondition) => boolean;
}

export interface SignedFfyFactInput {
  readonly id: string;
  readonly components: readonly ExactFfyValue[];
}

export interface FfyEconomicStageInput {
  readonly balance: number;
  readonly rules: CompiledRuleProfile;
  readonly ruleDynamicState: RuleDynamicState;
  readonly positiveEvents: readonly PositiveFfyEventInput[];
  readonly signedFacts: readonly SignedFfyFactInput[];
}

export interface FinalizedPositiveFfyEvent {
  readonly id: string;
  readonly family: FfyEventFamily;
  readonly specialization?: FfyEventSpecialization;
  readonly award: number;
}

export interface FinalizedSignedFfyFact {
  readonly id: string;
}

export interface FfyEconomicStageResult {
  readonly balance: number;
  readonly finalizedSignedDelta: number;
  readonly positiveEvents: readonly FinalizedPositiveFfyEvent[];
  readonly signedFacts: readonly FinalizedSignedFfyFact[];
}

export type FfyDebitResult =
  | {
      readonly ok: true;
      readonly cost: number;
      readonly balance: number;
    }
  | {
      readonly ok: false;
      readonly cost: number;
      readonly balance: number;
      readonly reason: "INSUFFICIENT_FFY";
    };

interface PassiveTerrainCounts {
  readonly capacity: number;
  readonly desertPopulationBearingCells: number;
  readonly plainsPopulationBearingCells: number;
}


type EventInsideFieldCondition = Extract<
  RuleCondition,
  { readonly kind: "EVENT_INSIDE_FIELD" }
>;

type EventStructureFieldDefinition = Readonly<{
  structureType: "FORT" | "SAM_LAUNCHER" | "COMMAND_POST";
  axis: "STRUCTURE_FIELD_COVERAGE_AREA" | "STRUCTURE_INTERCEPTION_RANGE";
  scaling: "AREA" | "RANGE";
  baselineRadii: readonly [number, number, number, number, number];
}>;

const EVENT_STRUCTURE_FIELD_DEFINITIONS: Readonly<
  Record<EventInsideFieldCondition["field"], EventStructureFieldDefinition>
> = Object.freeze({
  FORT: Object.freeze({
    structureType: "FORT",
    axis: "STRUCTURE_FIELD_COVERAGE_AREA",
    scaling: "AREA",
    baselineRadii: Object.freeze([30, 35, 40, 45, 50] as const),
  }),
  SAM_LAUNCHER: Object.freeze({
    structureType: "SAM_LAUNCHER",
    axis: "STRUCTURE_INTERCEPTION_RANGE",
    scaling: "RANGE",
    baselineRadii: Object.freeze([70, 80, 90, 100, 105] as const),
  }),
  COMMAND_POST: Object.freeze({
    structureType: "COMMAND_POST",
    axis: "STRUCTURE_FIELD_COVERAGE_AREA",
    scaling: "AREA",
    baselineRadii: Object.freeze([30, 35, 40, 45, 50] as const),
  }),
});

const EXTERNAL_TRADE_GLOBAL_SCOPE = Object.freeze({ kind: "GLOBAL" as const });

function exactFfy(
  numerator: bigint,
  denominator: bigint = 1n,
): ExactFfyValue {
  if (denominator <= 0n) {
    throw new Error("FFY exact denominator must be positive");
  }
  const reduced = reducedRational(numerator, denominator);
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

function currentTerritorialContactCount(
  state: MatchState,
  ownerId: string,
): number {
  const activeFactionIds = new Set(
    state.factions
      .filter((faction) => faction.status === "ACTIVE")
      .map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < state.ownership.length; cellId += 1) {
    if (state.ownership[cellId] !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwnerId = state.ownership[neighbor] ?? null;
      if (
        neighborOwnerId !== null &&
        neighborOwnerId !== ownerId &&
        activeFactionIds.has(neighborOwnerId)
      ) {
        contacts.add(neighborOwnerId);
      }
    }
  }
  return contacts.size;
}

export function ffyRuleDynamicState(
  state: MatchState,
  ownerId: string,
): RuleDynamicState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`FFY consequence references unknown faction ${ownerId}`);
  }
  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: currentTerritorialContactCount(state, ownerId),
    peakTotalPopulation: owner.population.peakTotal,
  });
}

function eventFactionIdentity(state: MatchState, ownerId: string) {
  const faction = state.factions.find((candidate) => candidate.id === ownerId);
  if (faction === undefined) {
    throw new Error(`FFY event condition references unknown faction ${ownerId}`);
  }
  return Object.freeze({
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  });
}

function eventFieldAffiliationApplies(
  state: MatchState,
  ruleHolderId: string,
  structureOwnerId: string,
  affiliation: EventInsideFieldCondition["affiliation"],
): boolean {
  const relation = factionRelationBetween(
    eventFactionIdentity(state, ruleHolderId),
    eventFactionIdentity(state, structureOwnerId),
  );
  if (affiliation === "SELF") return relation === "SELF";
  return relation === "SELF" || relation === "ALLY";
}

function eventInsideStructureField(
  state: MatchState,
  ruleHolderId: string,
  eventCellId: number,
  condition: EventInsideFieldCondition,
): boolean {
  const definition = EVENT_STRUCTURE_FIELD_DEFINITIONS[condition.field];
  const eventPosition = state.map.positionOf(eventCellId);
  for (const structure of state.structures) {
    if (
      !structure.active ||
      structure.completedLevel === undefined ||
      structure.type !== definition.structureType ||
      !eventFieldAffiliationApplies(
        state,
        ruleHolderId,
        structure.ownerId,
        condition.affiliation,
      )
    ) {
      continue;
    }
    const structureOwner = state.factions.find(
      (faction) => faction.id === structure.ownerId,
    );
    if (structureOwner === undefined) {
      throw new Error(
        `FFY event field structure ${structure.id} has unknown owner ${structure.ownerId}`,
      );
    }
    const factor = materializeCompiledScalarScaleFactor(
      structureOwner.rules,
      RULE_AXIS_REGISTRY,
      definition.axis,
      { kind: "STRUCTURE", structure: structure.type },
      ffyRuleDynamicState(state, structureOwner.id),
    );
    const baselineRadius = definition.baselineRadii[structure.completedLevel - 1];
    if (baselineRadius === undefined) {
      throw new Error(
        `FFY event field structure ${structure.id} has unsupported level ${structure.completedLevel}`,
      );
    }
    const profile =
      definition.scaling === "AREA"
        ? structureRadialFieldFromAreaFactor(
            baselineRadius,
            factor.numerator,
            factor.denominator,
          )
        : structureRadialFieldFromRangeFactor(
            baselineRadius,
            factor.numerator,
            factor.denominator,
          );
    const center = state.map.positionOf(structure.cellId);
    if (
      structureRadialFieldContainsCell(
        profile,
        center.x,
        center.y,
        eventPosition.x,
        eventPosition.y,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function ffyEventConditionAppliesAtCell(
  state: MatchState,
  ruleHolderId: string,
  eventCellId: number,
  condition: RuleCondition,
): boolean {
  if (!state.map.isValidCellId(eventCellId)) {
    throw new Error("FFY event condition cell must be a valid map cell");
  }
  switch (condition.kind) {
    case "EVENT_TERRAIN_IS":
      return state.map.terrainAt(eventCellId) === condition.terrain;
    case "EVENT_INSIDE_FIELD":
      return eventInsideStructureField(
        state,
        ruleHolderId,
        eventCellId,
        condition,
      );
    default:
      return false;
  }
}

export function resolveExternalWartimeTradeMultiplier(
  rules: CompiledRuleProfile,
  ruleDynamicState: RuleDynamicState,
  currentlyAtWar: boolean,
): ExactFfyValue {
  if (!currentlyAtWar) return exactFfy(1n);
  const resolved = materializeCompiledScalarRule(
    0.5,
    rules,
    RULE_AXIS_REGISTRY,
    "EXTERNAL_TRADE_WARTIME_MULTIPLIER",
    EXTERNAL_TRADE_GLOBAL_SCOPE,
    ruleDynamicState,
  );
  if (resolved === 0.5) return exactFfy(1n, 2n);
  if (resolved === 1) return exactFfy(1n);
  throw new Error(
    "external wartime Trade multiplier must resolve to canonical 0.5 or 1.0",
  );
}

function materializeExactFfy(
  value: ExactFfyValue,
  label: string,
  nonNegative = false,
): ExactFfyValue {
  if (
    value === null ||
    typeof value !== "object" ||
    typeof value.numerator !== "bigint" ||
    typeof value.denominator !== "bigint"
  ) {
    throw new Error(`${label} must be an exact FFY rational`);
  }
  if (value.denominator <= 0n) {
    throw new Error(`${label} denominator must be positive`);
  }
  if (nonNegative && value.numerator < 0n) {
    throw new Error(`${label} must be non-negative`);
  }
  return exactFfy(value.numerator, value.denominator);
}

function addExactFfy(
  left: ExactFfyValue,
  right: ExactFfyValue,
): ExactFfyValue {
  return exactFfy(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiplyExactFfy(
  left: ExactFfyValue,
  right: ExactFfyValue,
): ExactFfyValue {
  return exactFfy(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

function floorPositiveExactFfy(value: ExactFfyValue): number {
  if (value.numerator <= 0n) return 0;
  const whole = value.numerator / value.denominator;
  if (whole > MAX_SAFE_BIGINT) {
    throw new Error("finalized FFY award exceeds the safe-integer range");
  }
  return Number(whole);
}

function ceilNonNegativeExactFfy(value: ExactFfyValue): number {
  if (value.numerator === 0n) return 0;
  const whole =
    (value.numerator + value.denominator - 1n) / value.denominator;
  if (whole > MAX_SAFE_BIGINT) {
    throw new Error("finalized FFY cost exceeds the safe-integer range");
  }
  return Number(whole);
}

function truncateExactFfy(value: ExactFfyValue): number {
  const whole = value.numerator / value.denominator;
  if (whole > MAX_SAFE_BIGINT || whole < MIN_SAFE_BIGINT) {
    throw new Error("finalized signed FFY delta exceeds the safe-integer range");
  }
  return Number(whole);
}

export function materializeFfyBalance(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("FFY balance must be a non-negative safe integer");
  }
  return value;
}

function checkedCredit(balance: number, amount: number): number {
  materializeFfyBalance(balance);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("FFY award must be a non-negative safe integer");
  }
  const result = balance + amount;
  if (!Number.isSafeInteger(result)) {
    throw new Error("FFY balance exceeds the safe-integer range");
  }
  return result;
}

function ffyYieldScaleFromTerms(
  terms: readonly ResolvedRuleTerm[],
  additionalPercentDeltas: readonly ExactFfyValue[] = [],
): ExactRuleScaleFactor {
  if (terms.some((term) => term.stage === "TERMINAL")) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }

  let percentDelta = exactFfy(0n);
  let scalarProduct = exactFfy(1n);

  for (const term of terms) {
    if (term.stage === "TERMINAL") continue;
    if (term.reducer === "SUM") {
      if (term.value.kind !== "SUM" || !Number.isSafeInteger(term.value.value)) {
        throw new Error("FFY percentage SUM requires safe-integer basis points");
      }
      percentDelta = addExactFfy(
        percentDelta,
        exactFfy(BigInt(term.value.value), BASIS_POINTS),
      );
      continue;
    }
    if (term.reducer === "PRODUCT") {
      if (term.value.kind !== "PRODUCT") {
        throw new Error("FFY scalar PRODUCT requires an exact rational");
      }
      scalarProduct = multiplyExactFfy(
        scalarProduct,
        exactFfy(BigInt(term.value.numerator), BigInt(term.value.denominator)),
      );
      continue;
    }
    throw new Error(
      `FFY_EVENT_YIELD/${term.stage} cannot participate in ordinary FFY yield composition`,
    );
  }

  for (const delta of additionalPercentDeltas) {
    percentDelta = addExactFfy(
      percentDelta,
      materializeExactFfy(delta, "FFY contextual percentage"),
    );
  }

  const percentScale = addExactFfy(exactFfy(1n), percentDelta);
  const combined = multiplyExactFfy(percentScale, scalarProduct);
  return Object.freeze({
    numerator: combined.numerator,
    denominator: combined.denominator,
  });
}

function hasPassiveOriginSource(
  faction: MatchFactionState,
  sourceId: "P52" | "P53",
): boolean {
  return faction.rules.customDomains.some(
    (entry) =>
      entry.sourceKind === "ORIGIN" &&
      entry.sourceId === sourceId &&
      entry.domain === PASSIVE_FFY_DOMAIN,
  );
}

function effectivePopulationBearingForTerrain(
  faction: MatchFactionState,
  terrain: MatchState["map"]["terrain"][number],
): boolean {
  const base = landTerrainBaseSpec(terrain).populationBearing;
  if (terrain === "TEST" || !isTerrainScopeId(terrain)) return base;

  const scope = { kind: "TERRAIN" as const, terrain };
  const contributions = selectRuleContributionsForScope(
    "TERRAIN_POPULATION_BEARING_PERMISSION",
    scope,
    faction.rules.contributions,
  );
  if (
    contributions.some(
      (contribution) =>
        contribution.conditions !== undefined &&
        contribution.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned Population-bearing permissions require an authoritative terrain-condition evaluator",
    );
  }
  return reducePermissionRule(
    base,
    RULE_AXIS_REGISTRY.TERRAIN_POPULATION_BEARING_PERMISSION,
    contributions,
  );
}

function derivePassiveTerrainCounts(
  state: MatchState,
): ReadonlyMap<string, PassiveTerrainCounts> {
  const factionsById = new Map(
    state.factions.map((faction) => [faction.id, faction] as const),
  );
  const mutable = new Map<
    string,
    {
      capacity: number;
      desertPopulationBearingCells: number;
      plainsPopulationBearingCells: number;
    }
  >(
    state.factions.map((faction) => [
      faction.id,
      {
        capacity: 0,
        desertPopulationBearingCells: 0,
        plainsPopulationBearingCells: 0,
      },
    ]),
  );
  const populationBearingMemo = new Map<string, boolean>();

  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    const ownerId = state.ownership[cellId] ?? null;
    if (ownerId === null) continue;
    const faction = factionsById.get(ownerId);
    if (faction === undefined) {
      throw new Error(`owned cell ${cellId} references unknown faction ${ownerId}`);
    }
    const terrain = state.map.terrainAt(cellId);
    const memoKey = `${ownerId}\u0000${terrain}`;
    let populationBearing = populationBearingMemo.get(memoKey);
    if (populationBearing === undefined) {
      populationBearing = effectivePopulationBearingForTerrain(faction, terrain);
      populationBearingMemo.set(memoKey, populationBearing);
    }
    if (!populationBearing) continue;

    const counts = mutable.get(ownerId)!;
    counts.capacity += 1;
    if (terrain === "DESERT") counts.desertPopulationBearingCells += 1;
    if (terrain === "PLAINS") counts.plainsPopulationBearingCells += 1;
  }

  return new Map(
    [...mutable.entries()].map(([factionId, counts]) => [
      factionId,
      Object.freeze({ ...counts }),
    ]),
  );
}

export function resolveEffectivePopulationCapacities(
  state: MatchState,
): ReadonlyMap<string, number> {
  return new Map(
    [...derivePassiveTerrainCounts(state).entries()].map(
      ([factionId, counts]) => [factionId, counts.capacity],
    ),
  );
}


interface GrowthExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface OrdinaryPopulationGrowthSnapshot {
  readonly growthPerSecond: number;
  readonly growthUnitsPerTick: number;
}

const GROWTH_GLOBAL_SCOPE = Object.freeze({ kind: "GLOBAL" as const });
const GROWTH_CITY_SCOPE = Object.freeze({
  kind: "STRUCTURE" as const,
  structure: "CITY" as const,
});
const GROWTH_TICKS_PER_SECOND = 10;

function growthRatio(
  numerator: bigint,
  denominator: bigint,
): GrowthExactRatio {
  return reducedRational(numerator, denominator);
}

function addGrowthRatio(
  left: GrowthExactRatio,
  right: GrowthExactRatio,
): GrowthExactRatio {
  return growthRatio(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtractGrowthRatio(
  left: GrowthExactRatio,
  right: GrowthExactRatio,
): GrowthExactRatio {
  return growthRatio(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiplyGrowthRatio(
  left: GrowthExactRatio,
  right: GrowthExactRatio,
): GrowthExactRatio {
  return growthRatio(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}

function compareGrowthRatio(
  left: GrowthExactRatio,
  right: GrowthExactRatio,
): number {
  const delta =
    left.numerator * right.denominator - right.numerator * left.denominator;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

const ORDINARY_GROWTH_PROFILE = Object.freeze([
  Object.freeze({ u: growthRatio(0n, 1n), m: growthRatio(20n, 100n) }),
  Object.freeze({ u: growthRatio(1n, 10n), m: growthRatio(45n, 100n) }),
  Object.freeze({ u: growthRatio(2n, 10n), m: growthRatio(70n, 100n) }),
  Object.freeze({ u: growthRatio(3n, 10n), m: growthRatio(88n, 100n) }),
  Object.freeze({ u: growthRatio(4n, 10n), m: growthRatio(100n, 100n) }),
  Object.freeze({ u: growthRatio(5n, 10n), m: growthRatio(100n, 100n) }),
  Object.freeze({ u: growthRatio(6n, 10n), m: growthRatio(100n, 100n) }),
  Object.freeze({ u: growthRatio(7n, 10n), m: growthRatio(85n, 100n) }),
  Object.freeze({ u: growthRatio(8n, 10n), m: growthRatio(60n, 100n) }),
  Object.freeze({ u: growthRatio(9n, 10n), m: growthRatio(35n, 100n) }),
  Object.freeze({ u: growthRatio(10n, 10n), m: growthRatio(0n, 1n) }),
]);

function interpolateOrdinaryGrowthProfile(
  utilization: GrowthExactRatio,
): GrowthExactRatio {
  if (compareGrowthRatio(utilization, growthRatio(1n, 1n)) >= 0) {
    return growthRatio(0n, 1n);
  }

  for (let index = 1; index < ORDINARY_GROWTH_PROFILE.length; index += 1) {
    const right = ORDINARY_GROWTH_PROFILE[index]!;
    if (compareGrowthRatio(utilization, right.u) > 0) continue;
    const left = ORDINARY_GROWTH_PROFILE[index - 1]!;
    const span = subtractGrowthRatio(right.u, left.u);
    const offset = subtractGrowthRatio(utilization, left.u);
    const t = growthRatio(
      offset.numerator * span.denominator,
      offset.denominator * span.numerator,
    );
    return addGrowthRatio(
      left.m,
      multiplyGrowthRatio(subtractGrowthRatio(right.m, left.m), t),
    );
  }

  return growthRatio(0n, 1n);
}

function populationGrowthProfile(
  faction: MatchFactionState,
): string | undefined {
  return selectStructuralTransform(
    RULE_AXIS_REGISTRY.POPULATION_GROWTH_UTILIZATION_PROFILE,
    selectRuleContributionsForScope(
      "POPULATION_GROWTH_UTILIZATION_PROFILE",
      GROWTH_GLOBAL_SCOPE,
      faction.rules.contributions,
    ),
  );
}

function growthUtilizationMultiplier(
  faction: MatchFactionState,
  capacity: number,
): GrowthExactRatio {
  if (capacity <= 0 || faction.population.total >= capacity) {
    return growthRatio(0n, 1n);
  }
  const utilization = growthRatio(
    BigInt(faction.population.total),
    BigInt(capacity),
  );
  const profile = populationGrowthProfile(faction);
  if (profile === undefined) {
    return interpolateOrdinaryGrowthProfile(utilization);
  }
  if (profile !== "ORIGIN_P02_30_70") {
    throw new Error(`unsupported Population growth utilization profile ${profile}`);
  }

  const threeTenths = growthRatio(3n, 10n);
  const sevenTenths = growthRatio(7n, 10n);
  if (compareGrowthRatio(utilization, threeTenths) < 0) {
    return interpolateOrdinaryGrowthProfile(
      multiplyGrowthRatio(utilization, growthRatio(4n, 3n)),
    );
  }
  if (compareGrowthRatio(utilization, sevenTenths) <= 0) {
    return growthRatio(1n, 1n);
  }
  return interpolateOrdinaryGrowthProfile(
    addGrowthRatio(
      growthRatio(3n, 5n),
      multiplyGrowthRatio(
        subtractGrowthRatio(utilization, sevenTenths),
        growthRatio(4n, 3n),
      ),
    ),
  );
}

function exactScaleRatio(scale: ExactRuleScaleFactor): GrowthExactRatio {
  return growthRatio(scale.numerator, scale.denominator);
}

function explicitPopulationGrowthMultiplier(
  state: MatchState,
  faction: MatchFactionState,
  terrain: PassiveTerrainCounts,
): GrowthExactRatio {
  if (terrain.capacity <= 0) return growthRatio(1n, 1n);
  const dynamicState = ffyRuleDynamicState(state, faction.id);
  const cityScale = exactScaleRatio(
    materializeCompiledScalarScaleFactor(
      faction.rules,
      RULE_AXIS_REGISTRY,
      "CITY_GROWTH_CONTRIBUTION",
      GROWTH_CITY_SCOPE,
      dynamicState,
    ),
  );

  let cityContribution = growthRatio(0n, 1n);
  for (const structure of state.structures) {
    if (
      structure.ownerId !== faction.id ||
      structure.type !== "CITY" ||
      structure.completedLevel === undefined
    ) {
      continue;
    }
    cityContribution = addGrowthRatio(
      cityContribution,
      multiplyGrowthRatio(
        growthRatio(BigInt(structure.completedLevel), 100n),
        cityScale,
      ),
    );
  }

  const plainsContribution = growthRatio(
    6n * BigInt(terrain.plainsPopulationBearingCells),
    100n * BigInt(terrain.capacity),
  );
  const baseline = addGrowthRatio(
    growthRatio(1n, 1n),
    addGrowthRatio(cityContribution, plainsContribution),
  );
  const globalScale = exactScaleRatio(
    materializeCompiledScalarScaleFactor(
      faction.rules,
      RULE_AXIS_REGISTRY,
      "POPULATION_GROWTH",
      GROWTH_GLOBAL_SCOPE,
      dynamicState,
    ),
  );
  return multiplyGrowthRatio(baseline, globalScale);
}

export function resolveOrdinaryPopulationGrowth(
  state: MatchState,
): ReadonlyMap<string, OrdinaryPopulationGrowthSnapshot> {
  const terrainCounts = derivePassiveTerrainCounts(state);
  const result = new Map<string, OrdinaryPopulationGrowthSnapshot>();

  for (const faction of state.factions) {
    if (faction.status !== "ACTIVE") {
      result.set(
        faction.id,
        Object.freeze({ growthPerSecond: 0, growthUnitsPerTick: 0 }),
      );
      continue;
    }

    const terrain = terrainCounts.get(faction.id);
    if (terrain === undefined) {
      throw new Error(`missing Population growth terrain counts for faction ${faction.id}`);
    }
    const utilization = growthUtilizationMultiplier(faction, terrain.capacity);
    if (utilization.numerator === 0n) {
      result.set(
        faction.id,
        Object.freeze({ growthPerSecond: 0, growthUnitsPerTick: 0 }),
      );
      continue;
    }

    const explicit = explicitPopulationGrowthMultiplier(state, faction, terrain);
    const explicitFinite = rationalToFiniteNumber(
      explicit.numerator,
      explicit.denominator,
    );
    const utilizationFinite = rationalToFiniteNumber(
      utilization.numerator,
      utilization.denominator,
    );
    const growthPerSecond =
      0.05 *
      deterministicPow(terrain.capacity, 0.75) *
      utilizationFinite *
      explicitFinite;
    if (!Number.isFinite(growthPerSecond) || growthPerSecond < 0) {
      throw new Error("ordinary Population growth materialized to an invalid rate");
    }

    const growthUnitsPerTick = Math.floor(
      (growthPerSecond / GROWTH_TICKS_PER_SECOND) *
        POPULATION_GROWTH_RESIDUAL_SCALE,
    );
    if (!Number.isSafeInteger(growthUnitsPerTick) || growthUnitsPerTick < 0) {
      throw new Error(
        "ordinary Population growth residual increment exceeds the safe-integer range",
      );
    }

    result.set(
      faction.id,
      Object.freeze({ growthPerSecond, growthUnitsPerTick }),
    );
  }

  return result;
}

function structureCounts(state: MatchState): {
  readonly owned: ReadonlyMap<string, number>;
  readonly readyPersistentSiloCharges: ReadonlyMap<string, number>;
} {
  const owned = new Map(state.factions.map((faction) => [faction.id, 0]));
  const readyPersistentSiloCharges = new Map(
    state.factions.map((faction) => [faction.id, 0]),
  );

  for (const structure of state.structures) {
    if (!owned.has(structure.ownerId)) {
      throw new Error(
        `structure ${structure.id} references unknown owner ${structure.ownerId}`,
      );
    }
    owned.set(structure.ownerId, owned.get(structure.ownerId)! + 1);
    if (
      structure.active &&
      structure.type === "MISSILE_SILO" &&
      structure.chargeSlots !== undefined
    ) {
      const ready = structure.chargeSlots.filter(
        (slot) => slot.state === "READY",
      ).length;
      readyPersistentSiloCharges.set(
        structure.ownerId,
        readyPersistentSiloCharges.get(structure.ownerId)! + ready,
      );
    }
  }

  return Object.freeze({ owned, readyPersistentSiloCharges });
}

function staticAllFfyTerms(
  faction: MatchFactionState,
  ownedPersistentStructureCount: number,
): readonly ResolvedRuleTerm[] {
  if (
    faction.rules.dynamicProviders.some(
      (provider) =>
        provider.axis === "FFY_EVENT_YIELD" &&
        provider.dependency === "TERRITORIAL_CONTACT_COUNT",
    )
  ) {
    throw new Error(
      "FFY_EVENT_YIELD requires Territorial Contact state unavailable to the current economy foundation",
    );
  }

  return conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      faction.rules,
      RULE_AXIS_REGISTRY,
      "FFY_EVENT_YIELD",
      FFY_ALL_SCOPE,
      {
        ownedPersistentStructureCount,
        territorialContactCount: 0,
        peakTotalPopulation: faction.population.peakTotal,
      },
    ),
    () => false,
  );
}

function desertSharePercentDelta(
  counts: PassiveTerrainCounts,
): ExactFfyValue {
  if (counts.capacity === 0 || counts.desertPopulationBearingCells === 0) {
    return exactFfy(0n);
  }
  return exactFfy(
    BigInt(DESERT_FFY_BONUS_BP) * BigInt(counts.desertPopulationBearingCells),
    BASIS_POINTS * BigInt(counts.capacity),
  );
}

function passiveSources(
  faction: MatchFactionState,
  terrain: PassiveTerrainCounts,
  readyPersistentSiloCharges: number,
): readonly ExactFfyValue[] {
  const sources: ExactFfyValue[] = [
    exactFfy(BigInt(BASELINE_PASSIVE_FFY_PER_TICK)),
  ];

  if (hasPassiveOriginSource(faction, "P52")) {
    const emptyCapacity = Math.max(
      0,
      terrain.capacity - faction.population.total,
    );
    sources.push(exactFfy(BigInt(emptyCapacity), 2_500n));
  }
  if (hasPassiveOriginSource(faction, "P53")) {
    sources.push(exactFfy(BigInt(readyPersistentSiloCharges) * 200n));
  }
  return Object.freeze(sources);
}

function eventConditionPredicate(
  event: PositiveFfyEventInput,
): ((conditions: readonly RuleCondition[]) => boolean) | undefined {
  if (event.conditionApplies === undefined) return undefined;
  return (conditions) =>
    conditions.every((condition) => event.conditionApplies!(condition));
}

function positiveEventRuleTerms(
  event: PositiveFfyEventInput,
  rules: CompiledRuleProfile,
  dynamicState: RuleDynamicState,
): readonly ResolvedRuleTerm[] {
  const familyScope = Object.freeze({
    kind: "FFY_FAMILY" as const,
    family: event.family,
  });
  const familyTerms = resolvedRuleTermsForScope(
    rules,
    RULE_AXIS_REGISTRY,
    "FFY_EVENT_YIELD",
    familyScope,
    dynamicState,
  );
  if (event.specialization === undefined) {
    return conditionEligibleRuleTerms(
      familyTerms,
      eventConditionPredicate(event),
    );
  }

  const specializationTerms = resolvedRuleTermsForScope(
    rules,
    RULE_AXIS_REGISTRY,
    "FFY_EVENT_YIELD",
    FFY_PIRACY_SCOPE,
    dynamicState,
  ).filter(
    (term) =>
      term.scope.kind === "FFY_FAMILY" && term.scope.family === "PIRACY",
  );
  return conditionEligibleRuleTerms(
    Object.freeze([...familyTerms, ...specializationTerms]),
    eventConditionPredicate(event),
  );
}

function positiveEventAward(
  event: PositiveFfyEventInput,
  rules: CompiledRuleProfile,
  dynamicState: RuleDynamicState,
): number {
  if (typeof event.id !== "string" || event.id.length === 0) {
    throw new Error("positive FFY event id must be a non-empty string");
  }
  if (!FFY_EVENT_FAMILIES.has(event.family)) {
    throw new Error(`unknown positive FFY event family: ${String(event.family)}`);
  }
  if (
    event.specialization !== undefined &&
    !FFY_EVENT_SPECIALIZATIONS.has(event.specialization)
  ) {
    throw new Error(
      `unknown positive FFY event specialization: ${String(event.specialization)}`,
    );
  }
  if (event.specialization === "PIRACY" && event.family !== "NAVAL_TRADE") {
    throw new Error("PIRACY specialization requires NAVAL_TRADE event family");
  }
  const baseValue = materializeExactFfy(
    event.baseValue,
    "positive FFY event base value",
    true,
  );
  const structuralMultiplier =
    event.structuralMultiplier === undefined
      ? exactFfy(1n)
      : materializeExactFfy(
          event.structuralMultiplier,
          "positive FFY event structural multiplier",
        );
  const transformed = multiplyExactFfy(baseValue, structuralMultiplier);
  const terms = positiveEventRuleTerms(event, rules, dynamicState);
  const scale = ffyYieldScaleFromTerms(terms);
  return floorPositiveExactFfy(
    multiplyExactFfy(transformed, {
      numerator: scale.numerator,
      denominator: scale.denominator,
    }),
  );
}

function signedFactTotal(fact: SignedFfyFactInput): ExactFfyValue {
  if (typeof fact.id !== "string" || fact.id.length === 0) {
    throw new Error("signed FFY fact id must be a non-empty string");
  }
  let total = exactFfy(0n);
  for (const component of fact.components) {
    total = addExactFfy(
      total,
      materializeExactFfy(component, "signed FFY component"),
    );
  }
  return total;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Finalize ordinary positive FFY events first, then one exact same-tick signed
 * consequence stage. Event/fact identities are retained for replay/debug output.
 */
export function resolveFfyEconomicStage(
  input: FfyEconomicStageInput,
): FfyEconomicStageResult {
  let balance = materializeFfyBalance(input.balance);
  const positiveEvents: FinalizedPositiveFfyEvent[] = [];

  for (const event of input.positiveEvents) {
    const award = positiveEventAward(event, input.rules, input.ruleDynamicState);
    balance = checkedCredit(balance, award);
    positiveEvents.push(
      Object.freeze({
        id: event.id,
        family: event.family,
        ...(event.specialization === undefined
          ? {}
          : { specialization: event.specialization }),
        award,
      }),
    );
  }

  const signedTotals = input.signedFacts
    .map((fact) => Object.freeze({ fact, total: signedFactTotal(fact) }))
    .sort((left, right) => {
      const idOrder = compareStrings(left.fact.id, right.fact.id);
      if (idOrder !== 0) return idOrder;
      const leftKey = `${left.total.numerator}/${left.total.denominator}`;
      const rightKey = `${right.total.numerator}/${right.total.denominator}`;
      return compareStrings(leftKey, rightKey);
    });

  let tickSignedDelta = exactFfy(0n);
  for (const entry of signedTotals) {
    tickSignedDelta = addExactFfy(tickSignedDelta, entry.total);
  }
  const finalizedSignedDelta = truncateExactFfy(tickSignedDelta);
  const postSigned = BigInt(balance) + BigInt(finalizedSignedDelta);
  if (postSigned <= 0n) {
    balance = 0;
  } else {
    if (postSigned > MAX_SAFE_BIGINT) {
      throw new Error("FFY balance exceeds the safe-integer range");
    }
    balance = Number(postSigned);
  }

  return Object.freeze({
    balance,
    finalizedSignedDelta,
    positiveEvents: Object.freeze(positiveEvents),
    signedFacts: Object.freeze(
      signedTotals.map(({ fact }) => Object.freeze({ id: fact.id })),
    ),
  });
}

/** Finalize a positive exact FFY cost once, then atomically accept/reject debit. */
export function tryDebitFfy(
  balance: number,
  requestedCost: ExactFfyValue,
): FfyDebitResult {
  const validatedBalance = materializeFfyBalance(balance);
  const exactCost = materializeExactFfy(
    requestedCost,
    "FFY cost",
    true,
  );
  const cost = ceilNonNegativeExactFfy(exactCost);
  if (validatedBalance < cost) {
    return Object.freeze({
      ok: false,
      cost,
      balance: validatedBalance,
      reason: "INSUFFICIENT_FFY" as const,
    });
  }
  return Object.freeze({
    ok: true,
    cost,
    balance: validatedBalance - cost,
  });
}

/**
 * Resolve finalized per-faction passive awards from the canonical earning snapshot
 * without applying those awards to current FFY balances.
 */
export function resolvePassiveFfyAwards(
  state: MatchState,
): ReadonlyMap<string, number> {
  const terrainCounts = derivePassiveTerrainCounts(state);
  const structures = structureCounts(state);
  const awards = new Map<string, number>();

  for (const faction of state.factions) {
    if (faction.status !== "ACTIVE") {
      awards.set(faction.id, 0);
      continue;
    }

    const terrain = terrainCounts.get(faction.id);
    if (terrain === undefined) {
      throw new Error(`missing passive terrain counts for faction ${faction.id}`);
    }
    const terms = staticAllFfyTerms(
      faction,
      structures.owned.get(faction.id) ?? 0,
    );
    const fullScale = ffyYieldScaleFromTerms(terms, [
      desertSharePercentDelta(terrain),
    ]);
    const sources = passiveSources(
      faction,
      terrain,
      structures.readyPersistentSiloCharges.get(faction.id) ?? 0,
    );
    const award = sources.reduce(
      (sum, source) =>
        sum +
        floorPositiveExactFfy(
          multiplyExactFfy(source, {
            numerator: fullScale.numerator,
            denominator: fullScale.denominator,
          }),
        ),
      0,
    );
    if (!Number.isSafeInteger(award)) {
      throw new Error("combined passive FFY award exceeds the safe-integer range");
    }
    awards.set(faction.id, award);
  }

  return awards;
}

/**
 * Resolve the canonical passive earning snapshot after accepted inputs and before
 * autonomous tick systems. Every passive source is finalized independently.
 */
export function resolvePassiveFfyTick(
  state: MatchState,
): readonly MatchFactionState[] {
  const awards = resolvePassiveFfyAwards(state);

  return state.factions.map((faction) => {
    const award = awards.get(faction.id);
    if (award === undefined) {
      throw new Error(`missing passive FFY award for faction ${faction.id}`);
    }
    if (faction.status !== "ACTIVE") return faction;
    return {
      ...faction,
      ffy: checkedCredit(faction.ffy, award),
      lifetimeGrossPositiveFfyEarned: checkedCredit(
        faction.lifetimeGrossPositiveFfyEarned,
        award,
      ),
    };
  });
}

interface ScoreExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface WeightedScoreRatio {
  readonly weight: bigint;
  readonly ratio: ScoreExactRatio;
}

function scoreIntegerSqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("Faction score square root requires a non-negative value");
  }
  if (value < 2n) return value;

  let estimate = 1n << ((BigInt(value.toString(2).length) + 1n) >> 1n);
  while (true) {
    const next = (estimate + value / estimate) >> 1n;
    if (next >= estimate) return estimate;
    estimate = next;
  }
}

function scoreRatio(
  numerator: bigint,
  denominator: bigint,
  label: string,
): ScoreExactRatio {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error(`${label} must be a non-negative exact ratio`);
  }
  return Object.freeze({ numerator, denominator });
}

function floorWeightedScoreRoots(terms: readonly WeightedScoreRatio[]): number {
  for (let bits = 32; bits <= 4096; bits *= 2) {
    const scale = 1n << BigInt(bits);
    const scaleSquared = scale * scale;
    let lower = 0n;
    let upper = 0n;
    let hasStrictUpper = false;

    for (const term of terms) {
      const scaledNumerator = term.ratio.numerator * scaleSquared;
      const rootFloor = scoreIntegerSqrt(
        scaledNumerator / term.ratio.denominator,
      );
      const exactAtScale =
        rootFloor * rootFloor * term.ratio.denominator === scaledNumerator;
      lower += term.weight * rootFloor;
      upper += term.weight * (exactAtScale ? rootFloor : rootFloor + 1n);
      if (!exactAtScale) hasStrictUpper = true;
    }

    const minimumFloor = lower / scale;
    const maximumFloor = hasStrictUpper
      ? (upper - 1n) / scale
      : upper / scale;
    if (minimumFloor === maximumFloor) {
      if (minimumFloor > MAX_SAFE_BIGINT) {
        throw new Error("Faction score exceeds the safe-integer range");
      }
      return Number(minimumFloor);
    }
  }

  throw new Error("Faction score exact square-root floor did not converge");
}

interface ScoreTerritoryAggregate {
  readonly map: MatchState["map"];
  readonly total: bigint;
  readonly ownedByFaction: ReadonlyMap<string, bigint>;
}

const SCORE_TERRITORY_AGGREGATE_CACHE = new WeakMap<
  MatchState["ownership"],
  ScoreTerritoryAggregate
>();

function scoreOwnableCellCounts(
  state: MatchState,
  factionId: string,
): Readonly<{ owned: bigint; total: bigint }> {
  let aggregate = SCORE_TERRITORY_AGGREGATE_CACHE.get(state.ownership);
  if (aggregate === undefined || aggregate.map !== state.map) {
    let total = 0n;
    const ownedByFaction = new Map<string, bigint>();
    for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
      if (!landTerrainBaseSpec(state.map.terrainAt(cellId)).conquerable) continue;
      total += 1n;
      const ownerId = state.ownership[cellId] ?? null;
      if (ownerId === null) continue;
      ownedByFaction.set(
        ownerId,
        (ownedByFaction.get(ownerId) ?? 0n) + 1n,
      );
    }
    aggregate = Object.freeze({
      map: state.map,
      total,
      ownedByFaction,
    });
    SCORE_TERRITORY_AGGREGATE_CACHE.set(state.ownership, aggregate);
  }
  return Object.freeze({
    owned: aggregate.ownedByFaction.get(factionId) ?? 0n,
    total: aggregate.total,
  });
}

function assertFactionScorePowerSliceSupported(
  state: MatchState,
  factionId: string,
): void {
  if (
    state.structures.some((structure) => structure.ownerId === factionId) ||
    state.tankProductionJobs.some((job) => job.ownerId === factionId) ||
    state.mobileUnits.some(
      (unit) =>
        unit.ownerId === factionId &&
        (unit.type === "TANK" ||
          unit.type === "HEAVY_ARTILLERY" ||
          unit.type === "WARSHIP"),
    )
  ) {
    throw new Error(
      "Faction score asset replacement valuation is not materialized in this implementation slice",
    );
  }
}

/**
 * Score-composition helper for FactionScore.ts. The caller must prepare the
 * target faction's FFY as full Current Power and remove separately valued
 * scoreable assets. This is not the authoritative score producer; use
 * FactionScore.calculateFactionScore for trusted combined score reads.
 */
export function calculateFactionScoreFromPreparedPowerState(
  state: MatchState,
  factionId: string,
): number {
  const faction = state.factions.find((candidate) => candidate.id === factionId);
  if (faction === undefined) throw new Error(`unknown faction: ${factionId}`);
  if (faction.status !== "ACTIVE") return 0;

  assertFactionScorePowerSliceSupported(state, factionId);

  const cells = scoreOwnableCellCounts(state, factionId);
  if (cells.total === 0n) {
    throw new Error("Faction score requires at least one ownable map cell");
  }
  if (state.factions.length <= 0) {
    throw new Error("Faction score requires at least one starting Major faction");
  }

  const reference =
    BigInt(STARTING_FFY) +
    BigInt(BASELINE_PASSIVE_FFY_PER_TICK) * BigInt(state.tick);
  const territoryRatio = scoreRatio(
    cells.owned * BigInt(state.factions.length),
    cells.total,
    "Faction score territory ratio",
  );
  const economyRatio = scoreRatio(
    BigInt(STARTING_FFY) + BigInt(faction.lifetimeGrossPositiveFfyEarned),
    reference,
    "Faction score economy ratio",
  );
  const powerRatio = scoreRatio(
    BigInt(faction.ffy),
    reference,
    "Faction score current-power ratio",
  );

  return floorWeightedScoreRoots([
    { weight: 300n, ratio: territoryRatio },
    { weight: 250n, ratio: economyRatio },
    { weight: 450n, ratio: powerRatio },
  ]);
}
