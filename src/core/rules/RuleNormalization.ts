import {
  BASIS_POINTS_SCALE,
  RULE_COMPOSITION_VERSION,
  canonicalRuleJson,
  canonicalizeRuleConditions,
  canonicalizeStringSet,
  compareRuleStrings,
  reducedRational,
  type RuleAxisRegistry,
  type RuleConditions,
  type RuleContribution,
  type RuleReducer,
  type RuleScope,
  type RuleStageId,
  type RuleValue,
} from "./RuleComposition";

export interface RuleProvenance {
  readonly sourceKind: RuleContribution["sourceKind"];
  readonly sourceId: string;
}

export type NormalizedRuleValue =
  | { readonly kind: "SUM"; readonly value: number }
  | {
      readonly kind: "PRODUCT";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "SINGLETON"; readonly value: RuleValue }
  | { readonly kind: "ANY"; readonly value: true }
  | { readonly kind: "MIN"; readonly value: number }
  | { readonly kind: "MAX"; readonly value: number }
  | { readonly kind: "UNION"; readonly values: readonly string[] }
  | { readonly kind: "DIFFERENCE"; readonly values: readonly string[] }
  | {
      readonly kind: "PROHIBIT_WINS";
      readonly decision: "ALLOW" | "PROHIBIT";
    };

export interface NormalizedRuleRecord {
  readonly axis: string;
  readonly scope: RuleScope;
  readonly stage: RuleStageId;
  readonly reducer: RuleReducer;
  readonly valueUnit: RuleContribution["valueUnit"];
  readonly conditions?: RuleConditions;
  readonly component?: string;
  readonly value: NormalizedRuleValue;
  readonly provenance: readonly RuleProvenance[];
}

function canonicalRuleValue(value: RuleValue): RuleValue {
  return Array.isArray(value) ? canonicalizeStringSet(value) : value;
}

function numericValue(contribution: RuleContribution): number {
  if (typeof contribution.value !== "number") {
    throw new Error(`Expected numeric value from ${contribution.sourceId}`);
  }
  return contribution.value;
}

function stringValues(value: RuleValue | undefined): readonly string[] {
  if (typeof value === "string") return [value];
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return canonicalizeStringSet(value);
  }
  throw new Error("Expected string ID(s)");
}

function normalizedProduct(
  contributions: readonly RuleContribution[],
): NormalizedRuleValue {
  let numerator = 1n;
  let denominator = 1n;
  for (const contribution of contributions) {
    const value = numericValue(contribution);
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `MULTIPLY requires a safe integer basis-point operand; ${contribution.sourceId} supplied ${value}`,
      );
    }
    numerator *= BigInt(value);
    denominator *= BigInt(BASIS_POINTS_SCALE);
    const reduced = reducedRational(numerator, denominator);
    numerator = reduced.numerator;
    denominator = reduced.denominator;
  }
  return {
    kind: "PRODUCT",
    numerator: numerator.toString(),
    denominator: denominator.toString(),
  };
}

function normalizedSum(
  contributions: readonly RuleContribution[],
): NormalizedRuleValue {
  let total = 0n;
  for (const contribution of contributions) {
    const value = numericValue(contribution);
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `SUM requires a safe-integer fixed-scale operand; ${contribution.sourceId} supplied ${value}`,
      );
    }
    total += BigInt(value);
  }
  const value = Number(total);
  if (!Number.isSafeInteger(value)) {
    throw new Error("Normalized SUM exceeds the safe-integer range");
  }
  return { kind: "SUM", value };
}

function normalizedSet(
  contributions: readonly RuleContribution[],
): readonly string[] {
  const values: string[] = [];
  for (const contribution of contributions) {
    values.push(...stringValues(contribution.value));
  }
  return canonicalizeStringSet(values);
}

function normalizeValue(
  reducer: RuleReducer,
  contributions: readonly RuleContribution[],
): NormalizedRuleValue {
  switch (reducer) {
    case "SUM":
      return normalizedSum(contributions);
    case "PRODUCT":
      return normalizedProduct(contributions);
    case "SINGLETON": {
      const contribution = contributions[0];
      if (contribution === undefined || contribution.value === undefined) {
        throw new Error("SINGLETON normalization requires one value");
      }
      return {
        kind: "SINGLETON",
        value: canonicalRuleValue(contribution.value),
      };
    }
    case "ANY":
      return { kind: "ANY", value: true };
    case "MIN":
      return {
        kind: "MIN",
        value: Math.min(...contributions.map(numericValue)),
      };
    case "MAX":
      return {
        kind: "MAX",
        value: Math.max(...contributions.map(numericValue)),
      };
    case "UNION":
      return { kind: "UNION", values: normalizedSet(contributions) };
    case "DIFFERENCE":
      return { kind: "DIFFERENCE", values: normalizedSet(contributions) };
    case "PROHIBIT_WINS":
      return {
        kind: "PROHIBIT_WINS",
        decision: contributions.some(
          (contribution) => contribution.operator === "PROHIBIT",
        )
          ? "PROHIBIT"
          : "ALLOW",
      };
  }
}

function semanticGroupKey(contribution: RuleContribution): string {
  return canonicalRuleJson({
    axis: contribution.axis,
    scope: contribution.scope,
    stage: contribution.stage,
    conditions: canonicalizeRuleConditions(contribution.conditions),
    component: contribution.component,
  });
}

function sortedProvenance(
  contributions: readonly RuleContribution[],
): readonly RuleProvenance[] {
  return contributions
    .map(({ sourceKind, sourceId }) => ({ sourceKind, sourceId }))
    .sort((a, b) =>
      compareRuleStrings(
        `${a.sourceKind}\0${a.sourceId}`,
        `${b.sourceKind}\0${b.sourceId}`,
      ),
    );
}

/**
 * Internal compiler phase. Callers should enter through compileRuleProfile(),
 * which performs full wildcard/condition overlap validation before normalization.
 */
export function normalizeValidatedRuleContributions(
  registry: RuleAxisRegistry,
  contributions: readonly RuleContribution[],
): readonly NormalizedRuleRecord[] {
  const groups = new Map<string, RuleContribution[]>();
  for (const contribution of contributions) {
    const key = semanticGroupKey(contribution);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [contribution]);
    else group.push(contribution);
  }

  const records: NormalizedRuleRecord[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (first === undefined) continue;
    const definition = registry[first.axis];
    const stage = definition?.stages.find(
      (candidate) => candidate.id === first.stage,
    );
    if (stage === undefined) {
      throw new Error(`Missing stage ${first.axis}/${first.stage}`);
    }
    const conditions = canonicalizeRuleConditions(first.conditions);
    records.push({
      axis: first.axis,
      scope: first.scope,
      stage: first.stage,
      reducer: stage.reducer,
      valueUnit: first.valueUnit,
      ...(conditions === undefined || conditions.length === 0
        ? {}
        : { conditions }),
      ...(first.component === undefined ? {} : { component: first.component }),
      value: normalizeValue(stage.reducer, group),
      provenance: sortedProvenance(group),
    });
  }

  records.sort((a, b) =>
    compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
  );
  return Object.freeze(records);
}

export function serializeNormalizedRuleRecords(
  records: readonly NormalizedRuleRecord[],
): string {
  const sorted = [...records].sort((a, b) =>
    compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
  );
  return canonicalRuleJson({
    version: RULE_COMPOSITION_VERSION,
    rules: sorted,
  });
}
