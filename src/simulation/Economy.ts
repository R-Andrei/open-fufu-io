import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import {
  isTerrainScopeId,
  reducePermissionRule,
  reducedRational,
  selectRuleContributionsForScope,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  resolvedRuleTermsForScope,
  type ExactRuleScaleFactor,
  type ResolvedRuleTerm,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { landTerrainBaseSpec } from "./LandOperations";
import type { MatchFactionState, MatchState } from "./MatchState";

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
const FFY_EVENT_FAMILIES = new Set<FfyEventFamily>([
  "ALL",
  "MILITARY_CONQUEST",
  "NAVAL_TRADE",
  "INDUSTRIAL",
]);

export interface ExactFfyValue {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export type FfyEventFamily =
  | "ALL"
  | "MILITARY_CONQUEST"
  | "NAVAL_TRADE"
  | "INDUSTRIAL";

export interface PositiveFfyEventInput {
  readonly id: string;
  readonly family: FfyEventFamily;
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
}

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
    { capacity: number; desertPopulationBearingCells: number }
  >(
    state.factions.map((faction) => [
      faction.id,
      { capacity: 0, desertPopulationBearingCells: 0 },
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
  }

  return new Map(
    [...mutable.entries()].map(([factionId, counts]) => [
      factionId,
      Object.freeze({ ...counts }),
    ]),
  );
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
  const scope = Object.freeze({
    kind: "FFY_FAMILY" as const,
    family: event.family,
  });
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      rules,
      RULE_AXIS_REGISTRY,
      "FFY_EVENT_YIELD",
      scope,
      dynamicState,
    ),
    eventConditionPredicate(event),
  );
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
      Object.freeze({ id: event.id, family: event.family, award }),
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
 * Resolve the canonical passive earning snapshot after accepted inputs and before
 * autonomous tick systems. Every passive source is finalized independently.
 */
export function resolvePassiveFfyTick(
  state: MatchState,
): readonly MatchFactionState[] {
  const terrainCounts = derivePassiveTerrainCounts(state);
  const structures = structureCounts(state);

  return state.factions.map((faction) => {
    if (faction.status !== "ACTIVE") return faction;

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
    return { ...faction, ffy: checkedCredit(faction.ffy, award) };
  });
}
