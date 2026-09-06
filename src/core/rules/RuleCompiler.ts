import {
  RULE_COMPOSITION_VERSION,
  RULE_SOURCE_KINDS,
  RULE_STAGE_ALLOWED_SOURCE_KINDS,
  canonicalRuleJson,
  canonicalizeRuleConditions,
  canonicalizeRuleContribution,
  compareRuleStrings,
  isValidRuleCondition,
  isValidRuleContributionShape,
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
  type RuleSourceKind,
  type RuleValidationIssue,
} from "./RuleComposition";
import {
  normalizeValidatedRuleContributions,
  type NormalizedRuleRecord,
} from "./RuleNormalization";

export type RuleCompilerIssueCode =
  | RuleValidationIssue["code"]
  | "INVALID_PROFILE_INPUT"
  | "OVERLAPPING_SINGLETON_CONFLICT"
  | "OVERLAPPING_MIXED_OPERATORS"
  | "UNSATISFIABLE_CONDITION_SET"
  | "DUPLICATE_DYNAMIC_PROVIDER"
  | "INVALID_DYNAMIC_PROVIDER"
  | "INVALID_DYNAMIC_PROVIDER_SHAPE"
  | "INVALID_DYNAMIC_DEPENDENCY"
  | "INVALID_DYNAMIC_FORMULA"
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

interface CheckedProfileInput {
  readonly contributions: readonly unknown[];
  readonly dynamicProviders: readonly unknown[];
  readonly customDomains: readonly unknown[];
}

const PROFILE_REQUIRED_KEYS = ["contributions"] as const;
const PROFILE_OPTIONAL_KEYS = ["dynamicProviders", "customDomains"] as const;
const DYNAMIC_PROVIDER_REQUIRED_KEYS = [
  "id",
  "axis",
  "scope",
  "stage",
  "operator",
  "sourceKind",
  "sourceId",
  "dependency",
  "formula",
  "operandKind",
] as const;
const DYNAMIC_PROVIDER_OPTIONAL_KEYS = ["conditions"] as const;
const CUSTOM_DOMAIN_REQUIRED_KEYS = ["sourceKind", "sourceId", "domain"] as const;
const DYNAMIC_DEPENDENCIES = new Set([
  "OWNED_PERSISTENT_STRUCTURE_COUNT",
  "TERRITORIAL_CONTACT_COUNT",
  "PEAK_TOTAL_POPULATION",
]);
const DYNAMIC_OPERATORS = new Set(["MULTIPLY", "ADD_PERCENT", "CAP_LIMIT"]);
const DYNAMIC_OPERAND_KINDS = new Set<DynamicRuleOperandKind>([
  "RATIONAL",
  "BASIS_POINTS",
  "INTEGER",
]);
const RULE_SOURCE_KIND_SET = new Set<string>(RULE_SOURCE_KINDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function checkedProfileInput(input: unknown): CheckedProfileInput | undefined {
  if (Array.isArray(input)) {
    return {
      contributions: input,
      dynamicProviders: [],
      customDomains: [],
    };
  }
  if (!isRecord(input) || !hasExactKeys(input, PROFILE_REQUIRED_KEYS, PROFILE_OPTIONAL_KEYS)) {
    return undefined;
  }
  if (
    !Array.isArray(input.contributions) ||
    (input.dynamicProviders !== undefined && !Array.isArray(input.dynamicProviders)) ||
    (input.customDomains !== undefined && !Array.isArray(input.customDomains))
  ) {
    return undefined;
  }
  return {
    contributions: input.contributions,
    dynamicProviders: input.dynamicProviders ?? [],
    customDomains: input.customDomains ?? [],
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

export function ruleConditionSetIsSatisfiable(
  conditions: RuleConditions | undefined,
): boolean {
  const entries = conditions ?? [];
  for (let i = 0; i < entries.length; i += 1) {
    const left = entries[i];
    if (left === undefined) continue;
    for (let j = i + 1; j < entries.length; j += 1) {
      const right = entries[j];
      if (right !== undefined && !ruleConditionsMayOverlap(left, right)) {
        return false;
      }
    }
  }
  return true;
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

interface DynamicFormulaValidation {
  readonly resultKind?: DynamicRuleOperandKind;
  readonly message?: string;
}

function validateDynamicFormula(formula: unknown): DynamicFormulaValidation {
  if (!isRecord(formula) || typeof formula.kind !== "string") {
    return { message: "Dynamic formula must be a typed object" };
  }

  switch (formula.kind) {
    case "RATIONAL_POWER": {
      if (!hasExactKeys(formula, ["kind", "numerator", "denominator"])) {
        return { message: "RATIONAL_POWER has missing or unknown fields" };
      }
      const { numerator, denominator } = formula;
      if (
        typeof numerator !== "number" ||
        typeof denominator !== "number" ||
        !Number.isSafeInteger(numerator) ||
        !Number.isSafeInteger(denominator) ||
        denominator <= 0
      ) {
        return {
          message:
            "RATIONAL_POWER requires safe-integer numerator and positive safe-integer denominator",
        };
      }
      return { resultKind: "RATIONAL" };
    }
    case "BASIS_POINTS_PER_COUNT": {
      if (!hasExactKeys(formula, ["kind", "bpPerUnit"])) {
        return {
          message: "BASIS_POINTS_PER_COUNT has missing or unknown fields",
        };
      }
      if (
        typeof formula.bpPerUnit !== "number" ||
        !Number.isSafeInteger(formula.bpPerUnit)
      ) {
        return {
          message: "BASIS_POINTS_PER_COUNT requires a safe-integer rate",
        };
      }
      return { resultKind: "BASIS_POINTS" };
    }
    case "FLOOR_COUNT_PER_UNITS": {
      if (!hasExactKeys(formula, ["kind", "unitsPerStep"])) {
        return {
          message: "FLOOR_COUNT_PER_UNITS has missing or unknown fields",
        };
      }
      if (
        typeof formula.unitsPerStep !== "number" ||
        !Number.isSafeInteger(formula.unitsPerStep) ||
        formula.unitsPerStep <= 0
      ) {
        return {
          message:
            "FLOOR_COUNT_PER_UNITS requires a positive safe-integer step",
        };
      }
      return { resultKind: "INTEGER" };
    }
    default:
      return { message: `Unknown dynamic formula ${formula.kind}` };
  }
}

function dynamicProviderShapeIsValid(raw: unknown): raw is DynamicRuleProvider {
  if (!isRecord(raw)) return false;
  if (
    !hasExactKeys(
      raw,
      DYNAMIC_PROVIDER_REQUIRED_KEYS,
      DYNAMIC_PROVIDER_OPTIONAL_KEYS,
    )
  ) {
    return false;
  }
  return (
    typeof raw.id === "string" &&
    raw.id.length > 0 &&
    typeof raw.axis === "string" &&
    raw.axis.length > 0 &&
    typeof raw.stage === "string" &&
    typeof raw.operator === "string" &&
    DYNAMIC_OPERATORS.has(raw.operator) &&
    typeof raw.sourceKind === "string" &&
    typeof raw.sourceId === "string" &&
    raw.sourceId.length > 0 &&
    typeof raw.dependency === "string" &&
    typeof raw.operandKind === "string" &&
    DYNAMIC_OPERAND_KINDS.has(raw.operandKind as DynamicRuleOperandKind) &&
    Object.prototype.hasOwnProperty.call(raw, "scope") &&
    Object.prototype.hasOwnProperty.call(raw, "formula") &&
    (raw.conditions === undefined || Array.isArray(raw.conditions))
  );
}

function dynamicProviderIssueContext(raw: unknown): {
  readonly axis: string;
  readonly sourceId: string;
} {
  if (!isRecord(raw)) return { axis: "DYNAMIC_PROVIDER", sourceId: "<invalid>" };
  return {
    axis: typeof raw.axis === "string" ? raw.axis : "DYNAMIC_PROVIDER",
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : "<invalid>",
  };
}

function validateDynamicProviders(
  registry: RuleAxisRegistry,
  providers: readonly unknown[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [];
  const providerIds = new Set<string>();

  for (const rawProvider of providers) {
    const context = dynamicProviderIssueContext(rawProvider);
    if (!dynamicProviderShapeIsValid(rawProvider)) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER_SHAPE",
        axis: context.axis,
        sourceIds: [context.sourceId],
        message:
          "Dynamic provider must use the exact closed provider shape and valid operator/result-kind vocabulary",
      });
      continue;
    }
    const provider = rawProvider;

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

    if (!DYNAMIC_DEPENDENCIES.has(provider.dependency)) {
      issues.push({
        code: "INVALID_DYNAMIC_DEPENDENCY",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} uses unknown state dependency ${provider.dependency}`,
      });
    }

    const formulaValidation = validateDynamicFormula(provider.formula);
    if (formulaValidation.message !== undefined) {
      issues.push({
        code: "INVALID_DYNAMIC_FORMULA",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id}: ${formulaValidation.message}`,
      });
    } else if (formulaValidation.resultKind !== provider.operandKind) {
      issues.push({
        code: "DYNAMIC_OPERAND_KIND_MISMATCH",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} formula materializes ${formulaValidation.resultKind}, not declared ${provider.operandKind}`,
      });
    }

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

    let validConditionSet = true;
    if (provider.conditions !== undefined) {
      validConditionSet =
        provider.conditions.length > 0 &&
        provider.conditions.every((condition) =>
          isValidRuleCondition(condition as unknown),
        );
      if (!validConditionSet) {
        issues.push({
          code: "INVALID_DYNAMIC_PROVIDER",
          axis: provider.axis,
          stage: provider.stage,
          sourceIds: [provider.sourceId],
          message: `${provider.id} has an invalid condition conjunction`,
        });
      }
    }
    if (
      validConditionSet &&
      !ruleConditionSetIsSatisfiable(provider.conditions)
    ) {
      issues.push({
        code: "UNSATISFIABLE_CONDITION_SET",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} has an internally contradictory condition conjunction`,
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
    if (
      stage === undefined ||
      !stage.allowedOperators.includes(provider.operator)
    ) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.id} uses an invalid stage/operator for ${provider.axis}`,
      });
      continue;
    }
    const allowedSources = RULE_STAGE_ALLOWED_SOURCE_KINDS[
      provider.stage
    ] as readonly string[] | undefined;
    if (
      allowedSources === undefined ||
      !allowedSources.includes(provider.sourceKind)
    ) {
      issues.push({
        code: "INVALID_DYNAMIC_PROVIDER",
        axis: provider.axis,
        stage: provider.stage,
        sourceIds: [provider.sourceId],
        message: `${provider.sourceKind} cannot author semantic stage ${provider.stage}`,
      });
    }
    if (
      !expectedDynamicOperandKinds(provider.operator).includes(
        provider.operandKind,
      )
    ) {
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

function validateStaticConditionSets(
  contributions: readonly RuleContribution[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [];
  for (const contribution of contributions) {
    if (
      contribution.conditions === undefined ||
      contribution.conditions.length === 0 ||
      contribution.conditions.some(
        (condition) => !isValidRuleCondition(condition as unknown),
      )
    ) {
      continue;
    }
    if (!ruleConditionSetIsSatisfiable(contribution.conditions)) {
      issues.push({
        code: "UNSATISFIABLE_CONDITION_SET",
        axis: contribution.axis,
        stage: contribution.stage,
        sourceIds: [contribution.sourceId],
        message: `${contribution.sourceId} has an internally contradictory condition conjunction`,
      });
    }
  }
  return issues;
}

function customDomainShapeIsValid(
  raw: unknown,
): raw is RuleCustomDomainDeclaration {
  return (
    isRecord(raw) &&
    hasExactKeys(raw, CUSTOM_DOMAIN_REQUIRED_KEYS) &&
    typeof raw.sourceKind === "string" &&
    RULE_SOURCE_KIND_SET.has(raw.sourceKind) &&
    typeof raw.sourceId === "string" &&
    raw.sourceId.length > 0 &&
    typeof raw.domain === "string" &&
    raw.domain.length > 0
  );
}

function validateCustomDomains(
  domains: readonly unknown[],
): readonly RuleCompilerIssue[] {
  const issues: RuleCompilerIssue[] = [];
  for (const raw of domains) {
    if (!customDomainShapeIsValid(raw)) {
      const sourceId =
        isRecord(raw) && typeof raw.sourceId === "string"
          ? raw.sourceId
          : "<invalid>";
      issues.push({
        code: "INVALID_CUSTOM_DOMAIN",
        axis: "CUSTOM_DOMAIN",
        sourceIds: [sourceId],
        message:
          "Custom domain declaration must use exact {sourceKind, sourceId, domain} shape with registered provenance",
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
  const profile = checkedProfileInput(input as unknown);
  if (profile === undefined) {
    return [
      {
        code: "INVALID_PROFILE_INPUT",
        axis: "RULE_PROFILE",
        message:
          "Rule profile must be an authored contribution array or exact {contributions, dynamicProviders?, customDomains?} object",
      },
    ];
  }

  const validStaticContributions = profile.contributions.filter(
    (entry): entry is RuleContribution =>
      isValidRuleContributionShape(entry as unknown),
  );
  const validDynamicProviders = profile.dynamicProviders.filter(
    (entry): entry is DynamicRuleProvider =>
      dynamicProviderShapeIsValid(entry as unknown),
  );
  const issues: RuleCompilerIssue[] = [
    ...validateRuleAxisRegistry(registry),
    ...validateRuleContributions(profile.contributions, registry),
    ...validateStaticConditionSets(validStaticContributions),
    ...validateDynamicProviders(registry, profile.dynamicProviders),
    ...validateCustomDomains(profile.customDomains),
  ];

  const shapes: RuleShape[] = [
    ...validStaticContributions.map((entry) => ({
      axis: entry.axis,
      scope: entry.scope,
      stage: entry.stage,
      operator: entry.operator,
      sourceId: entry.sourceId,
      ...(entry.conditions === undefined ? {} : { conditions: entry.conditions }),
    })),
    ...validDynamicProviders.map((entry) => ({
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

function canonicalDynamicProvider(
  provider: DynamicRuleProvider,
): DynamicRuleProvider {
  const conditions = canonicalizeRuleConditions(provider.conditions);
  return {
    id: provider.id,
    axis: provider.axis,
    scope: provider.scope,
    stage: provider.stage,
    operator: provider.operator,
    sourceKind: provider.sourceKind,
    sourceId: provider.sourceId,
    dependency: provider.dependency,
    formula: provider.formula,
    operandKind: provider.operandKind,
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
    const canonical = {
      sourceKind: declaration.sourceKind,
      sourceId: declaration.sourceId,
      domain: declaration.domain,
    } as const;
    byKey.set(canonicalRuleJson(canonical), canonical);
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
  const issues = validateRuleProfile(registry, input);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
  const profile = checkedProfileInput(input as unknown);
  if (profile === undefined) {
    throw new Error("Rule profile input became invalid after validation");
  }

  const contributions = (profile.contributions as readonly RuleContribution[])
    .map(canonicalizeRuleContribution)
    .sort((a, b) =>
      compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
    );
  const dynamicProviders = (profile.dynamicProviders as readonly DynamicRuleProvider[])
    .map(canonicalDynamicProvider)
    .sort((a, b) =>
      compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
    );
  const customDomains = canonicalCustomDomains(
    profile.customDomains as readonly RuleCustomDomainDeclaration[],
  );
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
