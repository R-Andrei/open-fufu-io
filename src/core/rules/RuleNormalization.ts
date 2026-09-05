import {
  BASIS_POINTS_SCALE,
  RULE_COMPOSITION_VERSION,
  type RuleAxisRegistry,
  type RuleCondition,
  type RuleContribution,
  type RuleReducer,
  type RuleScope,
  type RuleStageId,
  type RuleValue,
  validateRuleContributions,
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
  readonly condition?: RuleCondition;
  readonly component?: string;
  readonly value: NormalizedRuleValue;
  readonly provenance: readonly RuleProvenance[];
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareStrings);
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Unsupported canonical value: ${typeof value}`);
}

function canonicalRuleValue(value: RuleValue): RuleValue {
  return Array.isArray(value) ? [...value].sort(compareStrings) : value;
}

function numericValue(contribution: RuleContribution): number {
  if (typeof contribution.value !== "number") {
    throw new Error(`Expected numeric value from ${contribution.sourceId}`);
  }
  return contribution.value;
}

function capabilityValues(value: RuleValue | undefined): readonly string[] {
  if (typeof value === "string") return [value];
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return value;
  }
  throw new Error("Expected capability ID(s)");
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let left = abs(a);
  let right = abs(b);
  while (right !== 0n) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left === 0n ? 1n : left;
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
    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
  }
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
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
  const values = new Set<string>();
  for (const contribution of contributions) {
    for (const value of capabilityValues(contribution.value)) values.add(value);
  }
  return [...values].sort(compareStrings);
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
  return canonicalJson({
    axis: contribution.axis,
    scope: contribution.scope,
    stage: contribution.stage,
    condition: contribution.condition,
    component: contribution.component,
  });
}

function sortedProvenance(
  contributions: readonly RuleContribution[],
): readonly RuleProvenance[] {
  return contributions
    .map(({ sourceKind, sourceId }) => ({ sourceKind, sourceId }))
    .sort((a, b) =>
      compareStrings(
        `${a.sourceKind}\0${a.sourceId}`,
        `${b.sourceKind}\0${b.sourceId}`,
      ),
    );
}

export function normalizeRuleContributions(
  registry: RuleAxisRegistry,
  contributions: readonly RuleContribution[],
): readonly NormalizedRuleRecord[] {
  const validationIssues = validateRuleContributions(contributions, registry);
  if (validationIssues.length > 0) {
    throw new Error(
      validationIssues.map((issue) => issue.message).join("; "),
    );
  }

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
    records.push({
      axis: first.axis,
      scope: first.scope,
      stage: first.stage,
      reducer: stage.reducer,
      valueUnit: first.valueUnit,
      ...(first.condition === undefined ? {} : { condition: first.condition }),
      ...(first.component === undefined ? {} : { component: first.component }),
      value: normalizeValue(stage.reducer, group),
      provenance: sortedProvenance(group),
    });
  }

  records.sort((a, b) => compareStrings(canonicalJson(a), canonicalJson(b)));
  return Object.freeze(records);
}

export function serializeNormalizedRuleRecords(
  records: readonly NormalizedRuleRecord[],
): string {
  const sorted = [...records].sort((a, b) =>
    compareStrings(canonicalJson(a), canonicalJson(b)),
  );
  return canonicalJson({
    version: RULE_COMPOSITION_VERSION,
    rules: sorted,
  });
}
