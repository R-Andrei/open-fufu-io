import {
  BASIS_POINTS_SCALE,
  canonicalizeRuleConditions,
  evaluateDynamicRuleProvider,
  rationalToFiniteNumber,
  reducedRational,
  ruleScopeMatches,
  type DynamicRuleProvider,
  type RuleAxisDefinition,
  type RuleAxisRegistry,
  type RuleConditions,
  type RuleScope,
  type RuleStateDependency,
  type RuleUnit,
} from "./RuleComposition";
import type { CompiledRuleProfile } from "./RuleCompiler";
import type {
  NormalizedRuleRecord,
  NormalizedRuleValue,
  RuleProvenance,
} from "./RuleNormalization";

/** Authoritative state fields consumed by current symbolic V1 providers. */
export interface RuleDynamicState {
  readonly ownedPersistentStructureCount: number;
  readonly territorialContactCount: number;
  readonly peakTotalPopulation: number;
}

/** Static normalized records and evaluated dynamic providers share this shape. */
export type ResolvedRuleTerm = NormalizedRuleRecord;

export type RuleConditionPredicate = (conditions: RuleConditions) => boolean;

function dependencyValue(
  dependency: RuleStateDependency,
  state: RuleDynamicState,
): number {
  switch (dependency) {
    case "OWNED_PERSISTENT_STRUCTURE_COUNT":
      return state.ownedPersistentStructureCount;
    case "TERRITORIAL_CONTACT_COUNT":
      return state.territorialContactCount;
    case "PEAK_TOTAL_POPULATION":
      return state.peakTotalPopulation;
  }
}

function stageForProvider(
  registry: RuleAxisRegistry,
  provider: DynamicRuleProvider,
) {
  const definition = registry[provider.axis];
  if (definition === undefined) {
    throw new Error(`Dynamic provider ${provider.id} targets unknown axis ${provider.axis}`);
  }
  const stage = definition.stages.find((entry) => entry.id === provider.stage);
  if (stage === undefined) {
    throw new Error(
      `Dynamic provider ${provider.id} targets missing stage ${provider.stage}`,
    );
  }
  return { definition, stage };
}

function dynamicProductValue(
  provider: DynamicRuleProvider,
  resolved: ReturnType<typeof evaluateDynamicRuleProvider>,
): NormalizedRuleValue {
  if (resolved.kind === "RATIONAL") {
    return {
      kind: "PRODUCT",
      numerator: resolved.numerator,
      denominator: resolved.denominator,
    };
  }
  if (resolved.kind === "BASIS_POINTS") {
    const reduced = reducedRational(
      BigInt(resolved.value),
      BigInt(BASIS_POINTS_SCALE),
    );
    return {
      kind: "PRODUCT",
      numerator: reduced.numerator.toString(),
      denominator: reduced.denominator.toString(),
    };
  }
  throw new Error(`${provider.id}/MULTIPLY did not materialize a multiplier`);
}

export function resolveDynamicRuleProvider(
  registry: RuleAxisRegistry,
  provider: DynamicRuleProvider,
  dependency: number,
): ResolvedRuleTerm {
  const { definition, stage } = stageForProvider(registry, provider);
  const resolved = evaluateDynamicRuleProvider(provider, dependency);
  let value: NormalizedRuleValue;
  let valueUnit: RuleUnit;

  switch (provider.operator) {
    case "ADD_PERCENT":
      if (resolved.kind !== "BASIS_POINTS") {
        throw new Error(`${provider.id}/ADD_PERCENT requires basis points`);
      }
      value = { kind: "SUM", value: resolved.value };
      valueUnit = "BASIS_POINTS";
      break;
    case "MULTIPLY":
      value = dynamicProductValue(provider, resolved);
      valueUnit = "BASIS_POINTS";
      break;
    case "CAP_LIMIT": {
      if (resolved.kind !== "INTEGER") {
        throw new Error(`${provider.id}/CAP_LIMIT requires an integer`);
      }
      const exact = BigInt(resolved.value);
      if (
        exact > BigInt(Number.MAX_SAFE_INTEGER) ||
        exact < BigInt(Number.MIN_SAFE_INTEGER)
      ) {
        throw new Error(`${provider.id} cap exceeds the safe-integer range`);
      }
      value = { kind: "MIN", value: Number(exact) };
      valueUnit = definition.unit;
      break;
    }
  }

  if (value.kind !== stage.reducer) {
    throw new Error(
      `${provider.id} resolved to ${value.kind}, expected reducer ${stage.reducer}`,
    );
  }
  const conditions = canonicalizeRuleConditions(provider.conditions);
  return Object.freeze({
    axis: provider.axis,
    scope: provider.scope,
    stage: provider.stage,
    reducer: stage.reducer,
    valueUnit,
    ...(conditions === undefined || conditions.length === 0
      ? {}
      : { conditions }),
    value,
    provenance: Object.freeze([
      { sourceKind: provider.sourceKind, sourceId: provider.sourceId },
    ] satisfies readonly RuleProvenance[]),
  });
}

export function resolveDynamicProviders(
  registry: RuleAxisRegistry,
  providers: readonly DynamicRuleProvider[],
  state: RuleDynamicState,
): readonly ResolvedRuleTerm[] {
  return Object.freeze(
    providers.map((provider) =>
      resolveDynamicRuleProvider(
        registry,
        provider,
        dependencyValue(provider.dependency, state),
      ),
    ),
  );
}

/**
 * Select by axis/scope and resolve dynamic state. Conditions are deliberately
 * retained; callers must evaluate them before materialization.
 */
export function resolvedRuleTermsForScope(
  profile: CompiledRuleProfile,
  registry: RuleAxisRegistry,
  axis: string,
  requestedScope: RuleScope,
  state: RuleDynamicState,
): readonly ResolvedRuleTerm[] {
  const staticTerms = profile.normalizedRules.filter(
    (entry) => entry.axis === axis && ruleScopeMatches(entry.scope, requestedScope),
  );
  const dynamicTerms = resolveDynamicProviders(
    registry,
    profile.dynamicProviders.filter(
      (entry) => entry.axis === axis && ruleScopeMatches(entry.scope, requestedScope),
    ),
    state,
  );
  const stageIndex = new Map(
    (registry[axis]?.stages ?? []).map((stage, index) => [stage.id, index]),
  );
  return Object.freeze(
    [...staticTerms, ...dynamicTerms].sort((a, b) => {
      const stageOrder =
        (stageIndex.get(a.stage) ?? Number.MAX_SAFE_INTEGER) -
        (stageIndex.get(b.stage) ?? Number.MAX_SAFE_INTEGER);
      if (stageOrder !== 0) return stageOrder;
      const left = `${a.scope.kind}\0${JSON.stringify(a.scope)}\0${a.provenance
        .map((entry) => `${entry.sourceKind}:${entry.sourceId}`)
        .join("|")}`;
      const right = `${b.scope.kind}\0${JSON.stringify(b.scope)}\0${b.provenance
        .map((entry) => `${entry.sourceKind}:${entry.sourceId}`)
        .join("|")}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }),
  );
}

/** Rejects accidental application of conditioned terms without domain context. */
export function conditionEligibleRuleTerms(
  terms: readonly ResolvedRuleTerm[],
  conditionApplies?: RuleConditionPredicate,
): readonly ResolvedRuleTerm[] {
  return Object.freeze(
    terms.filter((term) => {
      const conditions = term.conditions;
      if (conditions === undefined || conditions.length === 0) return true;
      if (conditionApplies === undefined) {
        throw new Error(
          `Rule term ${term.axis}/${term.stage} has unresolved conditions`,
        );
      }
      return conditionApplies(conditions);
    }),
  );
}

function assertTerms(
  definition: RuleAxisDefinition,
  terms: readonly ResolvedRuleTerm[],
): void {
  for (const term of terms) {
    if (term.axis !== definition.id) {
      throw new Error(`Materializer for ${definition.id} received ${term.axis}`);
    }
    if (term.conditions !== undefined && term.conditions.length > 0) {
      throw new Error(
        `Materializer for ${definition.id} received unresolved conditions`,
      );
    }
    const stage = definition.stages.find((entry) => entry.id === term.stage);
    if (stage === undefined || stage.reducer !== term.reducer) {
      throw new Error(
        `Rule term ${term.axis}/${term.stage} does not match its axis reducer`,
      );
    }
  }
}

function exactSum(terms: readonly ResolvedRuleTerm[]): number {
  let total = 0n;
  for (const term of terms) {
    if (term.value.kind !== "SUM" || !Number.isSafeInteger(term.value.value)) {
      throw new Error("SUM stage requires safe-integer SUM terms");
    }
    total += BigInt(term.value.value);
  }
  const result = Number(total);
  if (!Number.isSafeInteger(result)) {
    throw new Error("Combined SUM exceeds the safe-integer range");
  }
  return result;
}

function exactProduct(terms: readonly ResolvedRuleTerm[]): {
  readonly numerator: bigint;
  readonly denominator: bigint;
} {
  let numerator = 1n;
  let denominator = 1n;
  for (const term of terms) {
    if (term.value.kind !== "PRODUCT") {
      throw new Error("PRODUCT stage requires PRODUCT terms");
    }
    numerator *= BigInt(term.value.numerator);
    denominator *= BigInt(term.value.denominator);
    const reduced = reducedRational(numerator, denominator);
    numerator = reduced.numerator;
    denominator = reduced.denominator;
  }
  return { numerator, denominator };
}

function singletonNumber(terms: readonly ResolvedRuleTerm[]): number {
  if (terms.length !== 1) {
    throw new Error(`SINGLETON stage received ${terms.length} applicable terms`);
  }
  const value = terms[0]?.value;
  if (
    value === undefined ||
    value.kind !== "SINGLETON" ||
    typeof value.value !== "number"
  ) {
    throw new Error("Scalar SINGLETON requires one numeric value");
  }
  return value.value;
}

function minValue(terms: readonly ResolvedRuleTerm[]): number {
  return Math.min(
    ...terms.map((term) => {
      if (term.value.kind !== "MIN") throw new Error("MIN stage requires MIN terms");
      return term.value.value;
    }),
  );
}

function maxValue(terms: readonly ResolvedRuleTerm[]): number {
  return Math.max(
    ...terms.map((term) => {
      if (term.value.kind !== "MAX") throw new Error("MAX stage requires MAX terms");
      return term.value.value;
    }),
  );
}

function applyBasisPointDelta(value: number, deltaBasisPoints: number): number {
  return (
    (value * (BASIS_POINTS_SCALE + deltaBasisPoints)) /
    BASIS_POINTS_SCALE
  );
}

/** Materialize already condition-eligible scalar terms in axis stage order. */
export function materializeScalarRuleTerms(
  baseValue: number,
  definition: RuleAxisDefinition,
  terms: readonly ResolvedRuleTerm[],
): number {
  if (definition.kind !== "SCALAR") {
    throw new Error(`${definition.id} is ${definition.kind}; expected SCALAR`);
  }
  assertTerms(definition, terms);
  let current = baseValue;

  for (const stage of definition.stages) {
    const group = terms.filter((term) => term.stage === stage.id);
    if (group.length === 0) continue;
    switch (stage.reducer) {
      case "SUM": {
        const sum = exactSum(group);
        if (
          stage.id === "ORIGIN_PERCENT" ||
          stage.id === "ECHO_PERCENT" ||
          stage.id === "CONTEXTUAL_PERCENT"
        ) {
          current = applyBasisPointDelta(current, sum);
        } else {
          current += sum;
        }
        break;
      }
      case "PRODUCT": {
        const product = exactProduct(group);
        current *= rationalToFiniteNumber(product.numerator, product.denominator);
        break;
      }
      case "SINGLETON":
        current = singletonNumber(group);
        break;
      case "ANY":
        if (!group.every((term) => term.value.kind === "ANY")) {
          throw new Error("ANY stage requires ANY terms");
        }
        current = 0;
        break;
      case "MIN":
        current = Math.min(current, minValue(group));
        break;
      case "MAX":
        current = Math.max(current, maxValue(group));
        break;
      default:
        throw new Error(`${stage.reducer} is invalid for scalar ${definition.id}`);
    }
  }
  return current;
}

/** Materialize already condition-eligible cap terms in axis stage order. */
export function materializeCapRuleTerms(
  baseCap: number,
  definition: RuleAxisDefinition,
  terms: readonly ResolvedRuleTerm[],
): number {
  if (definition.kind !== "CAP") {
    throw new Error(`${definition.id} is ${definition.kind}; expected CAP`);
  }
  assertTerms(definition, terms);
  let current = baseCap;
  for (const stage of definition.stages) {
    const group = terms.filter((term) => term.stage === stage.id);
    if (group.length === 0) continue;
    if (stage.reducer === "SUM") current += exactSum(group);
    else if (stage.reducer === "MIN") current = Math.min(current, minValue(group));
    else if (stage.reducer === "MAX") current = Math.max(current, maxValue(group));
    else throw new Error(`${stage.reducer} is invalid for cap ${definition.id}`);
  }
  return current;
}

export function materializeCompiledScalarRule(
  baseValue: number,
  profile: CompiledRuleProfile,
  registry: RuleAxisRegistry,
  axis: string,
  scope: RuleScope,
  state: RuleDynamicState,
  conditionApplies?: RuleConditionPredicate,
): number {
  const definition = registry[axis];
  if (definition === undefined) throw new Error(`Unknown axis ${axis}`);
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(profile, registry, axis, scope, state),
    conditionApplies,
  );
  return materializeScalarRuleTerms(baseValue, definition, terms);
}

export function materializeCompiledCapRule(
  baseCap: number,
  profile: CompiledRuleProfile,
  registry: RuleAxisRegistry,
  axis: string,
  scope: RuleScope,
  state: RuleDynamicState,
  conditionApplies?: RuleConditionPredicate,
): number {
  const definition = registry[axis];
  if (definition === undefined) throw new Error(`Unknown axis ${axis}`);
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(profile, registry, axis, scope, state),
    conditionApplies,
  );
  return materializeCapRuleTerms(baseCap, definition, terms);
}
