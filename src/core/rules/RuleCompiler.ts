import {
  RULE_COMPOSITION_VERSION,
  RULE_STAGE_ALLOWED_SOURCE_KINDS,
  canonicalRuleJson,
  canonicalizeRuleConditions,
  compareRuleStrings,
  isValidRuleCondition,
  isValidRuleScope,
  ruleScopeMatches,
  validateRuleAxisRegistry,
  validateRuleContributions,
  type DynamicRuleOperandKind,
  type DynamicRuleProvider,
  type RuleAxisRegistry,
  type RuleCondition,
  type RuleConditions,
  type RuleContribution,
  type RuleCustomDomainDeclaration,
  type RuleOperator,
  type RuleScope,
  type RuleValidationIssue,
} from "./RuleComposition";
import {
  normalizeValidatedRuleContributions,
  type NormalizedRuleRecord,
} from "./RuleNormalization";

export type RuleCompilerIssueCode =
  | RuleValidationIssue["code"]
  | "OVERLAPPING_SINGLETON_CONFLICT"
  | "OVERLAPPING_MIXED_OPERATORS"
  | "DUPLICATE_DYNAMIC_PROVIDER"
  | "INVALID_DYNAMIC_PROVIDER"
  | "DYNAMIC_OPERAND_KIND_MISMATCH"
  | "INVALID_CUSTOM_DOMAIN";

export interface RuleCompilerIssue {
  readonly code: RuleCompilerIssueCode;
  readonly axis: string;
  readonly stage?: RuleContribution["stage"];
  readonly sourceIds?: readonly string[];
  readonly message: string;
}

export interface RuleProfileInput {
  readonly contributions: readonly RuleContribution[];
  readonly dynamicProviders?: readonly DynamicRuleProvider[];
  readonly customDomains?: readonly RuleCustomDomainDeclaration[];
}

export interface CompiledRuleProfile {
  readonly version: typeof RULE_COMPOSITION_VERSION;
  readonly contributions: readonly RuleContribution[];
  readonly normalizedRules: readonly NormalizedRuleRecord[];
  readonly dynamicProviders: readonly DynamicRuleProvider[];
  readonly customDomains: readonly RuleCustomDomainDeclaration[];
  readonly canonicalSerialization: string;
}

function profileInput(
  input: readonly RuleContribution[] | RuleProfileInput,
): Required<RuleProfileInput> {
  if (Array.isArray(input)) {
    return {
      contributions: input,
      dynamicProviders: [],
      customDomains: [],
    };
  }
  const typed = input as RuleProfileInput;
  return {
    contributions: typed.contributions,
    dynamicProviders: typed.dynamicProviders ?? [],
    customDomains: typed.customDomains ?? [],
  };
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
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return (
        b.kind === "STRUCTURE_ACQUISITION_PATH_IS" && a.path !== b.path
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

export function ruleConditionSetsMayOverlap(
  a: RuleConditions | undefined,
  b: RuleConditions | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  for (const leftCondition of left) {
    for (const rightCondition of right) {
      if (!ruleConditionsMayOverlap(leftCondition, rightCondition)) {
        return false;
      }
    }
  }
  return true;
}

interface RuleShape {
  readonly axis: string;
  readonly scope: RuleScope;
  readonly stage: RuleContribution["stage"];
  readonly operator: RuleOperator;
  readonly sourceId: string;
  readonly conditions?: RuleConditions;
}

function ruleShapesMayCoexist(a: RuleShape, b: RuleShape): boolean {
  return (
    a.axis === b.axis &&
    a.stage === b.stage &&
    ruleScopesOverlap(a.scope, b.scope) &&
    ruleConditionSetsMayOverlap(a.conditions, b.conditions)
  );
}

function expectedDynamicOperandKinds(
  operator: DynamicRuleProvider["operator"],
): readonly DynamicRuleOperandKind[] {
  switch (operator) {
    case "MULTIPLY":
      return ["RATIONAL", "BASIS_POINTS"];
    case "ADD_PERCENT":
      return ["BASIS_POINTS"];
    case "CAP_LIMIT":
      return ["INTEGER"];
  }
}

function validateDynamicProviders(
  registry: RuleAxisRegistry,
  providers: readonly DynamicRuleProvider[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [];
  const providerIds = new Set<string>();
  for (const provider of providers) {
    if (providerIds.has(provider.id)) {
      issues.push({
        code: "DUPLICATE_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `Dynamic provider id ${provider.id} is duplicated`,
      });
    }
    providerIds.add(provider.id);

    const definition = registry[provider.axis];
    if (definition === undefined) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} targets unknown axis ${provider.axis}`,
      });
      continue;
    }
    if (!isValidRuleScope(provider.scope as unknown)) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} has an invalid scope`,
      });
      continue;
    }
    if (provider.scope.kind !== definition.scopeKind) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} expects ${definition.scopeKind} scope`,
      });
    }
    if (
      provider.conditions !== undefined &&
      (provider.conditions.length === 0 ||
        provider.conditions.some(
          (condition) => !isValidRuleCondition(condition as unknown),
        ))
    ) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} has an invalid condition conjunction`,
      });
    }
    if (!definition.allowedSourceKinds.includes(provider.sourceKind)) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.sourceKind} cannot author ${provider.axis}`,
      });
    }
    const stage = definition.stages.find(
      (candidate) => candidate.id === provider.stage,
    );
    if (stage === undefined || !stage.allowedOperators.includes(provider.operator)) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} uses an invalid stage/operator for ${provider.axis}`,
      });
      continue;
    }
    const allowedSources: readonly string[] =
      RULE_STAGE_ALLOWED_SOURCE_KINDS[provider.stage];
    if (!allowedSources.includes(provider.sourceKind)) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.sourceKind} cannot author semantic stage ${provider.stage}`,
      });
    }
    if (!expectedDynamicOperandKinds(provider.operator).includes(provider.operandKind)) {
      issues.push({
        code: "DYNAMIC_OPERAND_KIND_MISMATCH",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id}/${provider.operator} cannot materialize ${provider.operandKind}`,
      });
    }
  }
  return issues;
}

function validateCustomDomains(
  domains: readonly RuleCustomDomainDeclaration[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [];
  for (const declaration of domains) {
    if (
      declaration.sourceId.length === 0 ||
      declaration.domain.length === 0
    ) {
      issues.push({
        code: "INVALID_CUSTOM_DOMAIN",
        axis: "CUSTOM_DOMAIN",
        sourceIds: [declaration.sourceId],
        message: "Custom rule-domain declarations require non-empty source/domain IDs",
      });
    }
  }
  return issues;
}

function validateOverlap(
  registry: RuleAxisRegistry,
  shapes: readonly RuleShape[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [];
  for (let i = 0; i < shapes.length; i += 1) {
    const left = shapes[i];
    if (left === undefined) continue;
    const stage = registry[left.axis]?.stages.find(
      (candidate) => candidate.id === left.stage,
    );
    if (stage === undefined) continue;
    for (let j = i + 1; j < shapes.length; j += 1) {
      const right = shapes[j];
      if (right === undefined || !ruleShapesMayCoexist(left, right)) continue;
      if (stage.reducer === "SINGLETON") {
        issues.push({
          code: "OVERLAPPING_SINGLETON_CONFLICT",
          axis: left.axis,
          stage: left.stage,
          sourceIds: [left.sourceId, right.sourceId],
          message: `${left.axis}/${left.stage} has overlapping singleton rules from ${left.sourceId} and ${right.sourceId}`,
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

export function validateRuleProfile(
  registry: RuleAxisRegistry,
  input: readonly RuleContribution[] | RuleProfileInput,
): readonly RuleCompilerIssue[] {
  const profile = profileInput(input);
  const issues: RuleCompilerIssue[] = [
    ...validateRuleAxisRegistry(registry),
    ...validateRuleContributions(profile.contributions, registry),
    ...validateDynamicProviders(registry, profile.dynamicProviders),
    ...validateCustomDomains(profile.customDomains),
  ];
  const shapes: RuleShape[] = [
    ...profile.contributions.map((entry) => ({
      axis: entry.axis,
      scope: entry.scope,
      stage: entry.stage,
      operator: entry.operator,
      sourceId: entry.sourceId,
      ...(entry.conditions === undefined ? {} : { conditions: entry.conditions }),
    })),
    ...profile.dynamicProviders.map((entry) => ({
      axis: entry.axis,
      scope: entry.scope,
      stage: entry.stage,
      operator: entry.operator,
      sourceId: entry.sourceId,
      ...(entry.conditions === undefined ? {} : { conditions: entry.conditions }),
    })),
  ];
  issues.push(...validateOverlap(registry, shapes));
  return issues;
}

function canonicalContribution(contribution: RuleContribution): RuleContribution {
  const conditions = canonicalizeRuleConditions(contribution.conditions);
  const value = Array.isArray(contribution.value)
    ? [...new Set(contribution.value)].sort(compareRuleStrings)
    : contribution.value;
  return {
    ...contribution,
    ...(value === undefined ? {} : { value }),
    ...(conditions === undefined || conditions.length === 0
      ? {}
      : { conditions }),
  };
}

function canonicalDynamicProvider(
  provider: DynamicRuleProvider,
): DynamicRuleProvider {
  const conditions = canonicalizeRuleConditions(provider.conditions);
  return {
    ...provider,
    ...(conditions === undefined || conditions.length === 0
      ? {}
      : { conditions }),
  };
}

function canonicalCustomDomains(
  domains: readonly RuleCustomDomainDeclaration[],
): readonly RuleCustomDomainDeclaration[] {
  const byKey = new Map<string, RuleCustomDomainDeclaration>();
  for (const declaration of domains) {
    byKey.set(canonicalRuleJson(declaration), declaration);
  }
  return Object.freeze(
    [...byKey.entries()]
      .sort(([a], [b]) => compareRuleStrings(a, b))
      .map(([, declaration]) => declaration),
  );
}

export function compileRuleProfile(
  registry: RuleAxisRegistry,
  input: readonly RuleContribution[] | RuleProfileInput,
): CompiledRuleProfile {
  const profile = profileInput(input);
  const issues = validateRuleProfile(registry, profile);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }

  const contributions = profile.contributions
    .map(canonicalContribution)
    .sort((a, b) =>
      compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
    );
  const dynamicProviders = profile.dynamicProviders
    .map(canonicalDynamicProvider)
    .sort((a, b) =>
      compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
    );
  const customDomains = canonicalCustomDomains(profile.customDomains);
  const normalizedRules = normalizeValidatedRuleContributions(
    registry,
    contributions,
  );

  const canonicalSerialization = canonicalRuleJson({
    version: RULE_COMPOSITION_VERSION,
    rules: normalizedRules,
    dynamicProviders,
    customDomains,
  });

  return Object.freeze({
    version: RULE_COMPOSITION_VERSION,
    contributions: Object.freeze(contributions),
    normalizedRules,
    dynamicProviders: Object.freeze(dynamicProviders),
    customDomains,
    canonicalSerialization,
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

export function compiledDynamicProvidersForScope(
  profile: CompiledRuleProfile,
  axis: string,
  scope: RuleScope,
): readonly DynamicRuleProvider[] {
  return profile.dynamicProviders.filter(
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
