import {
  RULE_COMPOSITION_VERSION,
  ruleScopeMatches,
  validateRuleAxisRegistry,
  validateRuleContributions,
  type RuleAxisRegistry,
  type RuleCondition,
  type RuleContribution,
  type RuleScope,
  type RuleValidationIssue,
} from "./RuleComposition";
import {
  normalizeRuleContributions,
  serializeNormalizedRuleRecords,
  type NormalizedRuleRecord,
} from "./RuleNormalization";

export type RuleCompilerIssueCode =
  | RuleValidationIssue["code"]
  | "OVERLAPPING_SINGLETON_CONFLICT"
  | "OVERLAPPING_MIXED_OPERATORS";

export interface RuleCompilerIssue {
  readonly code: RuleCompilerIssueCode;
  readonly axis: string;
  readonly stage?: RuleContribution["stage"];
  readonly sourceIds?: readonly string[];
  readonly message: string;
}

export interface CompiledRuleProfile {
  readonly version: typeof RULE_COMPOSITION_VERSION;
  /** Canonically sorted authored contributions retained for provenance/debugging. */
  readonly contributions: readonly RuleContribution[];
  /** Canonical normal form: commutative exact-scope groups are mathematically reduced. */
  readonly normalizedRules: readonly NormalizedRuleRecord[];
  readonly canonicalSerialization: string;
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
    const items = value.every((entry) => typeof entry === "string")
      ? [...value].sort(compareStrings)
      : value;
    return `[${items.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareStrings)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Unsupported canonical value: ${typeof value}`);
}

function scopeValue(scope: RuleScope): string {
  switch (scope.kind) {
    case "GLOBAL":
      return "GLOBAL";
    case "TERRAIN":
      return scope.terrain;
    case "STRUCTURE":
      return scope.structure;
    case "UNIT":
      return scope.unit;
    case "WEAPON":
      return scope.weapon;
    case "FFY_FAMILY":
      return scope.family;
  }
}

export function ruleScopesOverlap(a: RuleScope, b: RuleScope): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "GLOBAL") return true;
  const left = scopeValue(a);
  const right = scopeValue(b);
  return left === "ALL" || right === "ALL" || left === right;
}

function exclusiveSameKindCondition(
  a: RuleCondition,
  b: RuleCondition,
): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "SOURCE_TERRAIN_IS":
    case "TARGET_TERRAIN_IS":
    case "EVENT_TERRAIN_IS":
    case "BUILD_TERRAIN_IS":
      return b.kind === a.kind && a.terrain !== b.terrain;
    case "TARGET_UNIT_IS":
      return b.kind === "TARGET_UNIT_IS" && a.unit !== b.unit;
    case "STRUCTURE_PROVENANCE_IS":
      return (
        b.kind === "STRUCTURE_PROVENANCE_IS" &&
        a.provenance !== b.provenance
      );
    default:
      return false;
  }
}

export function ruleConditionsMayOverlap(
  a: RuleCondition | undefined,
  b: RuleCondition | undefined,
): boolean {
  if (a === undefined || b === undefined) return true;
  if (
    (a.kind === "TARGET_HAS_FALLOUT" &&
      b.kind === "TARGET_LACKS_FALLOUT") ||
    (a.kind === "TARGET_LACKS_FALLOUT" &&
      b.kind === "TARGET_HAS_FALLOUT")
  ) {
    return false;
  }
  return !exclusiveSameKindCondition(a, b);
}

function contributionsMayCoexist(
  a: RuleContribution,
  b: RuleContribution,
): boolean {
  return (
    a.axis === b.axis &&
    a.stage === b.stage &&
    ruleScopesOverlap(a.scope, b.scope) &&
    ruleConditionsMayOverlap(a.condition, b.condition)
  );
}

export function validateRuleProfile(
  registry: RuleAxisRegistry,
  contributions: readonly RuleContribution[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [
    ...validateRuleAxisRegistry(registry),
    ...validateRuleContributions(contributions, registry),
  ];

  for (let i = 0; i < contributions.length; i += 1) {
    const left = contributions[i];
    if (left === undefined) continue;
    const stage = registry[left.axis]?.stages.find(
      (candidate) => candidate.id === left.stage,
    );
    if (stage === undefined) continue;
    for (let j = i + 1; j < contributions.length; j += 1) {
      const right = contributions[j];
      if (right === undefined || !contributionsMayCoexist(left, right)) {
        continue;
      }
      if (stage.reducer === "SINGLETON") {
        issues.push({
          code: "OVERLAPPING_SINGLETON_CONFLICT",
          axis: left.axis,
          stage: left.stage,
          sourceIds: [left.sourceId, right.sourceId],
          message: `${left.axis}/${left.stage} has overlapping singleton contributions from ${left.sourceId} and ${right.sourceId}`,
        });
      } else if (
        stage.reducer !== "PROHIBIT_WINS" &&
        left.operator !== right.operator
      ) {
        issues.push({
          code: "OVERLAPPING_MIXED_OPERATORS",
          axis: left.axis,
          stage: left.stage,
          sourceIds: [left.sourceId, right.sourceId],
          message: `${left.axis}/${left.stage} has overlapping operators ${left.operator} and ${right.operator}`,
        });
      }
    }
  }
  return issues;
}

function canonicalContributionKey(contribution: RuleContribution): string {
  return canonicalJson({
    axis: contribution.axis,
    scope: contribution.scope,
    stage: contribution.stage,
    operator: contribution.operator,
    sourceKind: contribution.sourceKind,
    sourceId: contribution.sourceId,
    valueUnit: contribution.valueUnit,
    value: contribution.value,
    condition: contribution.condition,
    component: contribution.component,
  });
}

export function compileRuleProfile(
  registry: RuleAxisRegistry,
  contributions: readonly RuleContribution[],
): CompiledRuleProfile {
  const issues = validateRuleProfile(registry, contributions);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }

  const sorted = [...contributions].sort((a, b) =>
    compareStrings(canonicalContributionKey(a), canonicalContributionKey(b)),
  );
  const normalizedRules = normalizeRuleContributions(registry, sorted);

  return Object.freeze({
    version: RULE_COMPOSITION_VERSION,
    contributions: Object.freeze(sorted),
    normalizedRules,
    canonicalSerialization: serializeNormalizedRuleRecords(normalizedRules),
  });
}

export function compiledRuleContributionsForScope(
  profile: CompiledRuleProfile,
  axis: string,
  scope: RuleScope,
): readonly RuleContribution[] {
  return profile.contributions.filter(
    (entry) => entry.axis === axis && ruleScopeMatches(entry.scope, scope),
  );
}

export function compiledNormalizedRulesForScope(
  profile: CompiledRuleProfile,
  axis: string,
  scope: RuleScope,
): readonly NormalizedRuleRecord[] {
  return profile.normalizedRules.filter(
    (entry) => entry.axis === axis && ruleScopeMatches(entry.scope, scope),
  );
}

/** @deprecated Scope selection does not evaluate contextual conditions. */
export const compiledContributionsFor = compiledRuleContributionsForScope;
/** @deprecated Scope selection does not evaluate contextual conditions. */
export const compiledNormalizedRulesFor = compiledNormalizedRulesForScope;
