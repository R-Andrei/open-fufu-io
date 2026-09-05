export const RULE_COMPOSITION_VERSION = "1" as const;
export const BASIS_POINTS_SCALE = 10_000;

export const TERRAIN_SCOPE_IDS = [
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
  "SHALLOW_WATER",
] as const;
export type TerrainScopeId = (typeof TERRAIN_SCOPE_IDS)[number];

export const STRUCTURE_SCOPE_IDS = [
  "ALL",
  "CITY",
  "FORT",
  "PORT",
  "FACTORY",
  "MISSILE_SILO",
  "SAM_LAUNCHER",
  "OBSERVATION_POST",
  "COMMAND_POST",
] as const;
export type StructureScopeId = (typeof STRUCTURE_SCOPE_IDS)[number];

export const UNIT_SCOPE_IDS = [
  "ALL",
  "TANK",
  "HEAVY_ARTILLERY",
  "WARSHIP",
  "TRANSPORT_SHIP",
  "TRADE_SHIP",
  "TRAIN",
] as const;
export type UnitScopeId = (typeof UNIT_SCOPE_IDS)[number];

export const WEAPON_SCOPE_IDS = [
  "ALL",
  "ATOM_BOMB",
  "HYDROGEN_BOMB",
  "MIRV",
] as const;
export type WeaponScopeId = (typeof WEAPON_SCOPE_IDS)[number];

export const FFY_FAMILY_SCOPE_IDS = [
  "ALL",
  "MILITARY_CONQUEST",
  "NAVAL_TRADE",
  "INDUSTRIAL",
  "PIRACY",
] as const;
export type FfyFamilyScopeId = (typeof FFY_FAMILY_SCOPE_IDS)[number];

export const RULE_SOURCE_KINDS = [
  "BASE_RULESET",
  "RULESET_TRANSFORM",
  "ORIGIN",
  "ECHO",
  "TERRAIN",
  "STRUCTURE",
  "UNIT_PROFILE",
  "SCENARIO",
  "SITUATIONAL",
] as const;
export type RuleSourceKind = (typeof RULE_SOURCE_KINDS)[number];

export type RuleAxisKind =
  | "SCALAR"
  | "PERMISSION"
  | "CAP"
  | "CAPABILITY_SET"
  | "COMPONENT_SET"
  | "STRUCTURAL";

export type RuleUnit =
  | "NONE"
  | "AREA"
  | "BASIS_POINTS"
  | "CELLS"
  | "CELLS_PER_SECOND"
  | "DAMAGE"
  | "HEALTH_POINTS"
  | "HEALTH_PER_SECOND"
  | "FFY"
  | "POPULATION"
  | "SECONDS"
  | "TICKS"
  | "RATIO"
  | "BOOLEAN"
  | "COUNT"
  | "CAPABILITY_SET"
  | "COMPONENT_SET"
  | "PROFILE_ID";

export type RuleScope =
  | { readonly kind: "GLOBAL" }
  | { readonly kind: "TERRAIN"; readonly terrain: TerrainScopeId }
  | { readonly kind: "STRUCTURE"; readonly structure: StructureScopeId }
  | { readonly kind: "UNIT"; readonly unit: UnitScopeId }
  | { readonly kind: "WEAPON"; readonly weapon: WeaponScopeId }
  | { readonly kind: "FFY_FAMILY"; readonly family: FfyFamilyScopeId };

export type RuleScopeKind = RuleScope["kind"];

export const RULE_STAGE_IDS = [
  "STRUCTURAL_PROFILE",
  "BASE_REPLACEMENT",
  "ORIGIN_FLAT",
  "ORIGIN_PERCENT",
  "ORIGIN_SCALAR",
  "ORIGIN_CAP",
  "ECHO_PERCENT",
  "ECHO_SCALAR",
  "CONTEXTUAL_PERCENT",
  "CONTEXTUAL_SCALAR",
  "CAPABILITY_ADD",
  "CAPABILITY_REMOVE",
  "CAPABILITY_REPLACE",
  "COMPONENT_SUPPRESSION",
  "PERMISSION",
  "FINAL_OVERRIDE",
  "TERMINAL",
] as const;
export type RuleStageId = (typeof RULE_STAGE_IDS)[number];

export const RULE_OPERATORS = [
  "ADD_FLAT",
  "ADD_PERCENT",
  "MULTIPLY",
  "REPLACE_BASE",
  "FINAL_OVERRIDE",
  "HARD_ZERO",
  "ALLOW",
  "PROHIBIT",
  "CAP_LIMIT",
  "CAP_FLOOR",
  "ADD_CAP",
  "ADD_CAPABILITY",
  "REMOVE_CAPABILITY",
  "REPLACE_CAPABILITIES",
  "SUPPRESS_COMPONENT",
  "STRUCTURAL_TRANSFORM",
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

export type RuleReducer =
  | "SUM"
  | "PRODUCT"
  | "SINGLETON"
  | "ANY"
  | "MIN"
  | "MAX"
  | "UNION"
  | "DIFFERENCE"
  | "PROHIBIT_WINS";

export const RULE_CAPABILITY_IDS = [
  "NAVAL_GUNFIRE_AGAINST_SHIPS",
  "ATTACK_SHIPS",
] as const;
export type RuleCapabilityId = (typeof RULE_CAPABILITY_IDS)[number];

export const RULE_COMPONENT_IDS = [
  "HOSTILE_FORT_DEFENSIVE_PRESSURE",
  "FALLOUT_ACQUISITION_RESISTANCE",
] as const;
export type RuleComponentId = (typeof RULE_COMPONENT_IDS)[number];

export type RuleCondition =
  | { readonly kind: "SOURCE_TERRAIN_IS"; readonly terrain: TerrainScopeId }
  | { readonly kind: "TARGET_TERRAIN_IS"; readonly terrain: TerrainScopeId }
  | { readonly kind: "EVENT_TERRAIN_IS"; readonly terrain: TerrainScopeId }
  | { readonly kind: "BUILD_TERRAIN_IS"; readonly terrain: TerrainScopeId }
  | { readonly kind: "TARGET_HAS_FALLOUT" }
  | { readonly kind: "TARGET_LACKS_FALLOUT" }
  | { readonly kind: "TARGET_UNIT_IS"; readonly unit: UnitScopeId }
  | {
      readonly kind: "EVENT_INSIDE_FIELD";
      readonly field: "FORT" | "SAM" | "COMMAND_POST";
    }
  | {
      readonly kind: "SOURCE_INSIDE_FIELD";
      readonly field: "FORT" | "COMMAND_POST";
    }
  | {
      readonly kind: "STRUCTURE_PROVENANCE_IS";
      readonly provenance: "BUILT" | "CAPTURED" | "GRANTED";
    };

export type RuleValue = number | string | readonly string[];

export interface RuleContribution {
  readonly axis: string;
  readonly scope: RuleScope;
  readonly stage: RuleStageId;
  readonly operator: RuleOperator;
  readonly sourceKind: RuleSourceKind;
  readonly sourceId: string;
  /** Operand unit. Percentage/scalar operands are integer basis points. */
  readonly valueUnit: RuleUnit;
  readonly value?: RuleValue;
  readonly condition?: RuleCondition;
  /** Optional typed-domain provenance tag used by selective aggregation. */
  readonly component?: string;
}

export interface RuleStageDefinition {
  readonly id: RuleStageId;
  readonly reducer: RuleReducer;
  readonly allowedOperators: readonly RuleOperator[];
  /** Semantic dependency only; arbitrary numeric priority is intentionally absent. */
  readonly after?: readonly RuleStageId[];
}

export interface RuleAxisDefinition {
  readonly id: string;
  readonly kind: RuleAxisKind;
  /** Unit of the materialized effective result. */
  readonly unit: RuleUnit;
  readonly scopeKind: RuleScopeKind;
  /** Ordered semantic stages owned by this axis. */
  readonly stages: readonly RuleStageDefinition[];
  readonly allowedSourceKinds: readonly RuleSourceKind[];
}

export type RuleAxisRegistry = Readonly<Record<string, RuleAxisDefinition>>;

/**
 * Provenance that may author each semantic stage. Axis-level source legality is
 * the coarse bound; this table is the fine-grained layer contract.
 */
export const RULE_STAGE_ALLOWED_SOURCE_KINDS = {
  STRUCTURAL_PROFILE: [
    "BASE_RULESET",
    "RULESET_TRANSFORM",
    "ORIGIN",
    "UNIT_PROFILE",
    "SCENARIO",
  ],
  BASE_REPLACEMENT: [
    "BASE_RULESET",
    "RULESET_TRANSFORM",
    "ORIGIN",
    "SCENARIO",
  ],
  ORIGIN_FLAT: ["ORIGIN"],
  ORIGIN_PERCENT: ["ORIGIN"],
  ORIGIN_SCALAR: ["ORIGIN"],
  ORIGIN_CAP: ["ORIGIN"],
  ECHO_PERCENT: ["ECHO"],
  ECHO_SCALAR: ["ECHO"],
  CONTEXTUAL_PERCENT: [
    "RULESET_TRANSFORM",
    "ORIGIN",
    "TERRAIN",
    "STRUCTURE",
    "UNIT_PROFILE",
    "SCENARIO",
    "SITUATIONAL",
  ],
  CONTEXTUAL_SCALAR: [
    "RULESET_TRANSFORM",
    "ORIGIN",
    "TERRAIN",
    "STRUCTURE",
    "UNIT_PROFILE",
    "SCENARIO",
    "SITUATIONAL",
  ],
  CAPABILITY_ADD: [
    "RULESET_TRANSFORM",
    "ORIGIN",
    "UNIT_PROFILE",
    "SCENARIO",
    "SITUATIONAL",
  ],
  CAPABILITY_REMOVE: [
    "RULESET_TRANSFORM",
    "ORIGIN",
    "UNIT_PROFILE",
    "SCENARIO",
    "SITUATIONAL",
  ],
  CAPABILITY_REPLACE: [
    "BASE_RULESET",
    "RULESET_TRANSFORM",
    "ORIGIN",
    "UNIT_PROFILE",
    "SCENARIO",
  ],
  COMPONENT_SUPPRESSION: [
    "RULESET_TRANSFORM",
    "ORIGIN",
    "SCENARIO",
    "SITUATIONAL",
  ],
  PERMISSION: [
    "BASE_RULESET",
    "RULESET_TRANSFORM",
    "ORIGIN",
    "TERRAIN",
    "STRUCTURE",
    "UNIT_PROFILE",
    "SCENARIO",
    "SITUATIONAL",
  ],
  FINAL_OVERRIDE: [
    "RULESET_TRANSFORM",
    "ORIGIN",
    "SCENARIO",
    "SITUATIONAL",
  ],
  TERMINAL: ["RULESET_TRANSFORM", "ORIGIN", "SCENARIO", "SITUATIONAL"],
} as const satisfies Readonly<Record<RuleStageId, readonly RuleSourceKind[]>>;

export type RuleValidationCode =
  | "AXIS_ID_MISMATCH"
  | "DUPLICATE_STAGE"
  | "UNKNOWN_STAGE_DEPENDENCY"
  | "STAGE_DEPENDENCY_ORDER"
  | "STAGE_DEPENDENCY_CYCLE"
  | "UNKNOWN_AXIS"
  | "INVALID_SCOPE_VALUE"
  | "SCOPE_KIND_MISMATCH"
  | "INVALID_CONDITION"
  | "INVALID_SOURCE_KIND"
  | "INVALID_STAGE"
  | "INVALID_OPERATOR"
  | "VALUE_UNIT_MISMATCH"
  | "SOURCE_KIND_NOT_ALLOWED"
  | "SOURCE_KIND_NOT_ALLOWED_IN_STAGE"
  | "STAGE_NOT_ALLOWED"
  | "OPERATOR_NOT_ALLOWED"
  | "VALUE_REQUIRED"
  | "VALUE_NOT_ALLOWED"
  | "INVALID_NUMERIC_VALUE"
  | "NON_INTEGER_BASIS_POINTS"
  | "NON_INTEGER_FLAT_VALUE"
  | "NON_INTEGER_COUNT_VALUE"
  | "INVALID_STRING_VALUE"
  | "INVALID_CAPABILITY_VALUE"
  | "INVALID_COMPONENT_VALUE"
  | "SINGLETON_CONFLICT"
  | "MIXED_STAGE_OPERATORS";

export interface RuleValidationIssue {
  readonly code: RuleValidationCode;
  readonly axis: string;
  readonly message: string;
  readonly sourceId?: string;
  readonly stage?: RuleStageId;
}

export const GLOBAL_RULE_SCOPE = {
  kind: "GLOBAL",
} as const satisfies RuleScope;

const NUMERIC_OPERATORS = new Set<RuleOperator>([
  "ADD_FLAT",
  "ADD_PERCENT",
  "MULTIPLY",
  "REPLACE_BASE",
  "FINAL_OVERRIDE",
  "CAP_LIMIT",
  "CAP_FLOOR",
  "ADD_CAP",
]);
const NO_VALUE_OPERATORS = new Set<RuleOperator>([
  "HARD_ZERO",
  "ALLOW",
  "PROHIBIT",
]);
const STRING_OPERATORS = new Set<RuleOperator>(["STRUCTURAL_TRANSFORM"]);
const CAPABILITY_OPERATORS = new Set<RuleOperator>([
  "ADD_CAPABILITY",
  "REMOVE_CAPABILITY",
  "REPLACE_CAPABILITIES",
]);
const COMPONENT_OPERATORS = new Set<RuleOperator>(["SUPPRESS_COMPONENT"]);

const TERRAIN_SCOPE_ID_SET = new Set<string>(TERRAIN_SCOPE_IDS);
const STRUCTURE_SCOPE_ID_SET = new Set<string>(STRUCTURE_SCOPE_IDS);
const UNIT_SCOPE_ID_SET = new Set<string>(UNIT_SCOPE_IDS);
const WEAPON_SCOPE_ID_SET = new Set<string>(WEAPON_SCOPE_IDS);
const FFY_FAMILY_SCOPE_ID_SET = new Set<string>(FFY_FAMILY_SCOPE_IDS);
const RULE_SOURCE_KIND_SET = new Set<string>(RULE_SOURCE_KINDS);
const RULE_STAGE_ID_SET = new Set<string>(RULE_STAGE_IDS);
const RULE_OPERATOR_SET = new Set<string>(RULE_OPERATORS);
const RULE_CAPABILITY_ID_SET = new Set<string>(RULE_CAPABILITY_IDS);
const RULE_COMPONENT_ID_SET = new Set<string>(RULE_COMPONENT_IDS);

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

function canonicalContribution(contribution: RuleContribution): RuleContribution {
  const value = Array.isArray(contribution.value)
    ? [...contribution.value].sort(compareStrings)
    : contribution.value;
  return {
    axis: contribution.axis,
    scope: contribution.scope,
    stage: contribution.stage,
    operator: contribution.operator,
    sourceKind: contribution.sourceKind,
    sourceId: contribution.sourceId,
    valueUnit: contribution.valueUnit,
    ...(value === undefined ? {} : { value }),
    ...(contribution.condition === undefined
      ? {}
      : { condition: contribution.condition }),
    ...(contribution.component === undefined
      ? {}
      : { component: contribution.component }),
  };
}

export function serializeRuleContributions(
  contributions: readonly RuleContribution[],
): string {
  const normalized = contributions.map(canonicalContribution);
  normalized.sort((a, b) => compareStrings(canonicalJson(a), canonicalJson(b)));
  return canonicalJson({
    version: RULE_COMPOSITION_VERSION,
    contributions: normalized,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidRuleScope(scope: unknown): scope is RuleScope {
  if (!isRecord(scope) || typeof scope.kind !== "string") return false;
  switch (scope.kind) {
    case "GLOBAL":
      return true;
    case "TERRAIN":
      return (
        typeof scope.terrain === "string" &&
        TERRAIN_SCOPE_ID_SET.has(scope.terrain)
      );
    case "STRUCTURE":
      return (
        typeof scope.structure === "string" &&
        STRUCTURE_SCOPE_ID_SET.has(scope.structure)
      );
    case "UNIT":
      return typeof scope.unit === "string" && UNIT_SCOPE_ID_SET.has(scope.unit);
    case "WEAPON":
      return (
        typeof scope.weapon === "string" &&
        WEAPON_SCOPE_ID_SET.has(scope.weapon)
      );
    case "FFY_FAMILY":
      return (
        typeof scope.family === "string" &&
        FFY_FAMILY_SCOPE_ID_SET.has(scope.family)
      );
    default:
      return false;
  }
}

export function isValidRuleCondition(
  condition: unknown,
): condition is RuleCondition {
  if (!isRecord(condition) || typeof condition.kind !== "string") return false;
  switch (condition.kind) {
    case "SOURCE_TERRAIN_IS":
    case "TARGET_TERRAIN_IS":
    case "EVENT_TERRAIN_IS":
    case "BUILD_TERRAIN_IS":
      return (
        typeof condition.terrain === "string" &&
        TERRAIN_SCOPE_ID_SET.has(condition.terrain)
      );
    case "TARGET_HAS_FALLOUT":
    case "TARGET_LACKS_FALLOUT":
      return true;
    case "TARGET_UNIT_IS":
      return (
        typeof condition.unit === "string" &&
        UNIT_SCOPE_ID_SET.has(condition.unit)
      );
    case "EVENT_INSIDE_FIELD":
      return (
        condition.field === "FORT" ||
        condition.field === "SAM" ||
        condition.field === "COMMAND_POST"
      );
    case "SOURCE_INSIDE_FIELD":
      return condition.field === "FORT" || condition.field === "COMMAND_POST";
    case "STRUCTURE_PROVENANCE_IS":
      return (
        condition.provenance === "BUILT" ||
        condition.provenance === "CAPTURED" ||
        condition.provenance === "GRANTED"
      );
    default:
      return false;
  }
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

/** `ALL` is a typed wildcard only within scope kinds that explicitly define it. */
export function ruleScopeMatches(
  contributionScope: RuleScope,
  requestedScope: RuleScope,
): boolean {
  if (contributionScope.kind !== requestedScope.kind) return false;
  if (contributionScope.kind === "GLOBAL") return true;
  const authored = scopeValue(contributionScope);
  return authored === "ALL" || authored === scopeValue(requestedScope);
}

export function selectRuleContributionsForScope(
  axis: string,
  requestedScope: RuleScope,
  contributions: readonly RuleContribution[],
): readonly RuleContribution[] {
  return contributions.filter(
    (contribution) =>
      contribution.axis === axis &&
      ruleScopeMatches(contribution.scope, requestedScope),
  );
}

/** @deprecated Scope selection does not evaluate contextual conditions. */
export const selectApplicableRuleContributions =
  selectRuleContributionsForScope;

function expectedValueUnit(
  definition: RuleAxisDefinition,
  operator: RuleOperator,
): RuleUnit {
  switch (operator) {
    case "ADD_PERCENT":
    case "MULTIPLY":
      return "BASIS_POINTS";
    case "ADD_FLAT":
    case "REPLACE_BASE":
    case "FINAL_OVERRIDE":
    case "CAP_LIMIT":
    case "CAP_FLOOR":
    case "ADD_CAP":
      return definition.unit;
    case "HARD_ZERO":
    case "ALLOW":
    case "PROHIBIT":
      return "NONE";
    case "ADD_CAPABILITY":
    case "REMOVE_CAPABILITY":
    case "REPLACE_CAPABILITIES":
      return "CAPABILITY_SET";
    case "SUPPRESS_COMPONENT":
      return "COMPONENT_SET";
    case "STRUCTURAL_TRANSFORM":
      return "PROFILE_ID";
  }
}

export function validateRuleAxisRegistry(
  registry: RuleAxisRegistry,
): readonly RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  for (const [axisId, definition] of Object.entries(registry)) {
    if (definition.id !== axisId) {
      issues.push({
        code: "AXIS_ID_MISMATCH",
        axis: axisId,
        message: `Registry key ${axisId} does not match definition id ${definition.id}`,
      });
    }

    const ids = new Set<RuleStageId>();
    const stageIndex = new Map<RuleStageId, number>();
    for (let index = 0; index < definition.stages.length; index += 1) {
      const stage = definition.stages[index];
      if (stage === undefined) continue;
      if (ids.has(stage.id)) {
        issues.push({
          code: "DUPLICATE_STAGE",
          axis: axisId,
          stage: stage.id,
          message: `${axisId} defines ${stage.id} more than once`,
        });
      }
      ids.add(stage.id);
      stageIndex.set(stage.id, index);
    }

    const graph = new Map<RuleStageId, readonly RuleStageId[]>();
    for (const stage of definition.stages) {
      const after = stage.after ?? [];
      graph.set(stage.id, after);
      for (const dependency of after) {
        if (!ids.has(dependency)) {
          issues.push({
            code: "UNKNOWN_STAGE_DEPENDENCY",
            axis: axisId,
            stage: stage.id,
            message: `${stage.id} depends on unknown ${dependency}`,
          });
          continue;
        }
        const dependencyIndex = stageIndex.get(dependency);
        const currentIndex = stageIndex.get(stage.id);
        if (
          dependencyIndex !== undefined &&
          currentIndex !== undefined &&
          dependencyIndex >= currentIndex
        ) {
          issues.push({
            code: "STAGE_DEPENDENCY_ORDER",
            axis: axisId,
            stage: stage.id,
            message: `${stage.id} must appear after dependency ${dependency}`,
          });
        }
      }
    }

    const visiting = new Set<RuleStageId>();
    const visited = new Set<RuleStageId>();
    const cyclic = (id: RuleStageId): boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      for (const dependency of graph.get(id) ?? []) {
        if (graph.has(dependency) && cyclic(dependency)) return true;
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    for (const id of graph.keys()) {
      if (cyclic(id)) {
        issues.push({
          code: "STAGE_DEPENDENCY_CYCLE",
          axis: axisId,
          stage: id,
          message: `${axisId} contains a cyclic stage dependency`,
        });
        break;
      }
    }
  }
  return issues;
}

function validateStringSetValue(
  contribution: RuleContribution,
  code: "INVALID_CAPABILITY_VALUE" | "INVALID_COMPONENT_VALUE",
  label: string,
  allowed: ReadonlySet<string>,
  issues: RuleValidationIssue[],
): void {
  const value = contribution.value;
  const values =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value
        : undefined;
  const valid =
    values !== undefined &&
    values.length > 0 &&
    values.every(
      (entry) =>
        typeof entry === "string" &&
        entry.length > 0 &&
        allowed.has(entry),
    );
  if (!valid) {
    issues.push({
      code,
      axis: contribution.axis,
      sourceId: contribution.sourceId,
      stage: contribution.stage,
      message: `${contribution.operator} requires registered ${label} ID(s)`,
    });
  }
}

function validateValue(
  contribution: RuleContribution,
  issues: RuleValidationIssue[],
): void {
  const base = {
    axis: contribution.axis,
    sourceId: contribution.sourceId,
    stage: contribution.stage,
  };
  if (NUMERIC_OPERATORS.has(contribution.operator)) {
    if (typeof contribution.value !== "number") {
      issues.push({
        ...base,
        code: "VALUE_REQUIRED",
        message: `${contribution.operator} requires a numeric value`,
      });
      return;
    }
    if (!Number.isFinite(contribution.value)) {
      issues.push({
        ...base,
        code: "INVALID_NUMERIC_VALUE",
        message: `${contribution.operator} requires a finite number`,
      });
      return;
    }
    if (
      contribution.valueUnit === "BASIS_POINTS" &&
      !Number.isSafeInteger(contribution.value)
    ) {
      issues.push({
        ...base,
        code: "NON_INTEGER_BASIS_POINTS",
        message: `${contribution.operator} requires an integer basis-point operand`,
      });
    }
    if (
      contribution.operator === "ADD_FLAT" &&
      !Number.isSafeInteger(contribution.value)
    ) {
      issues.push({
        ...base,
        code: "NON_INTEGER_FLAT_VALUE",
        message:
          "V1 flat additions require safe-integer fixed-scale operands; introduce a versioned fixed-point unit before authoring fractional flats",
      });
    }
    if (
      (contribution.operator === "ADD_CAP" ||
        contribution.operator === "CAP_LIMIT" ||
        contribution.operator === "CAP_FLOOR") &&
      !Number.isSafeInteger(contribution.value)
    ) {
      issues.push({
        ...base,
        code: "NON_INTEGER_COUNT_VALUE",
        message: `${contribution.operator} requires a safe-integer count operand`,
      });
    }
    return;
  }
  if (NO_VALUE_OPERATORS.has(contribution.operator)) {
    if (contribution.value !== undefined) {
      issues.push({
        ...base,
        code: "VALUE_NOT_ALLOWED",
        message: `${contribution.operator} does not accept a value`,
      });
    }
    return;
  }
  if (STRING_OPERATORS.has(contribution.operator)) {
    if (
      typeof contribution.value !== "string" ||
      contribution.value.length === 0
    ) {
      issues.push({
        ...base,
        code: "INVALID_STRING_VALUE",
        message: `${contribution.operator} requires a non-empty string`,
      });
    }
    return;
  }
  if (CAPABILITY_OPERATORS.has(contribution.operator)) {
    validateStringSetValue(
      contribution,
      "INVALID_CAPABILITY_VALUE",
      "capability",
      RULE_CAPABILITY_ID_SET,
      issues,
    );
    return;
  }
  if (COMPONENT_OPERATORS.has(contribution.operator)) {
    validateStringSetValue(
      contribution,
      "INVALID_COMPONENT_VALUE",
      "component",
      RULE_COMPONENT_ID_SET,
      issues,
    );
  }
}

export function validateRuleContributions(
  contributions: readonly RuleContribution[],
  registry: RuleAxisRegistry,
): readonly RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const groups = new Map<string, RuleContribution[]>();

  for (const contribution of contributions) {
    const rawSourceKind = contribution.sourceKind as unknown;
    if (
      typeof rawSourceKind !== "string" ||
      !RULE_SOURCE_KIND_SET.has(rawSourceKind)
    ) {
      issues.push({
        code: "INVALID_SOURCE_KIND",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        message: `Unknown source kind ${String(rawSourceKind)}`,
      });
      continue;
    }

    const rawStage = contribution.stage as unknown;
    if (typeof rawStage !== "string" || !RULE_STAGE_ID_SET.has(rawStage)) {
      issues.push({
        code: "INVALID_STAGE",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        message: `Unknown stage ${String(rawStage)}`,
      });
      continue;
    }

    const rawOperator = contribution.operator as unknown;
    if (
      typeof rawOperator !== "string" ||
      !RULE_OPERATOR_SET.has(rawOperator)
    ) {
      issues.push({
        code: "INVALID_OPERATOR",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `Unknown operator ${String(rawOperator)}`,
      });
      continue;
    }

    const definition = registry[contribution.axis];
    if (definition === undefined) {
      issues.push({
        code: "UNKNOWN_AXIS",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `Unknown axis ${contribution.axis}`,
      });
      continue;
    }

    if (!isValidRuleScope(contribution.scope as unknown)) {
      issues.push({
        code: "INVALID_SCOPE_VALUE",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.axis} received an invalid runtime scope`,
      });
      continue;
    }
    if (contribution.scope.kind !== definition.scopeKind) {
      issues.push({
        code: "SCOPE_KIND_MISMATCH",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.axis} expects ${definition.scopeKind} scope`,
      });
    }

    if (
      contribution.condition !== undefined &&
      !isValidRuleCondition(contribution.condition as unknown)
    ) {
      issues.push({
        code: "INVALID_CONDITION",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.axis} received an invalid runtime condition`,
      });
    }

    const expectedUnit = expectedValueUnit(definition, contribution.operator);
    if (contribution.valueUnit !== expectedUnit) {
      issues.push({
        code: "VALUE_UNIT_MISMATCH",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.operator} on ${contribution.axis} expects ${expectedUnit}, received ${contribution.valueUnit}`,
      });
    }

    if (!definition.allowedSourceKinds.includes(contribution.sourceKind)) {
      issues.push({
        code: "SOURCE_KIND_NOT_ALLOWED",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.sourceKind} is not allowed on ${contribution.axis}`,
      });
    }

    const stage = definition.stages.find(
      (candidate) => candidate.id === contribution.stage,
    );
    if (stage === undefined) {
      issues.push({
        code: "STAGE_NOT_ALLOWED",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.stage} is not defined on ${contribution.axis}`,
      });
      continue;
    }

    const stageAllowedSources: readonly RuleSourceKind[] =
      RULE_STAGE_ALLOWED_SOURCE_KINDS[stage.id];
    if (!stageAllowedSources.includes(contribution.sourceKind)) {
      issues.push({
        code: "SOURCE_KIND_NOT_ALLOWED_IN_STAGE",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.sourceKind} cannot author semantic stage ${contribution.stage}`,
      });
    }

    if (!stage.allowedOperators.includes(contribution.operator)) {
      issues.push({
        code: "OPERATOR_NOT_ALLOWED",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `${contribution.operator} is not allowed in ${contribution.axis}/${contribution.stage}`,
      });
    }

    validateValue(contribution, issues);

    const key = canonicalJson({
      axis: contribution.axis,
      scope: contribution.scope,
      stage: contribution.stage,
      condition: contribution.condition,
      component: contribution.component,
    });
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [contribution]);
    else group.push(contribution);
  }

  for (const group of groups.values()) {
    const first = group[0];
    if (first === undefined) continue;
    const stage = registry[first.axis]?.stages.find(
      (candidate) => candidate.id === first.stage,
    );
    if (stage === undefined) continue;
    if (stage.reducer === "SINGLETON" && group.length > 1) {
      issues.push({
        code: "SINGLETON_CONFLICT",
        axis: first.axis,
        stage: first.stage,
        message: `${first.axis}/${first.stage} received ${group.length} singleton contributions`,
      });
    }
    const operators = new Set(group.map((entry) => entry.operator));
    if (operators.size > 1 && stage.reducer !== "PROHIBIT_WINS") {
      issues.push({
        code: "MIXED_STAGE_OPERATORS",
        axis: first.axis,
        stage: first.stage,
        message: `${first.axis}/${first.stage} received mixed operators`,
      });
    }
  }
  return issues;
}

function numericValue(contribution: RuleContribution): number {
  if (typeof contribution.value !== "number") {
    throw new Error(`Expected numeric value from ${contribution.sourceId}`);
  }
  return contribution.value;
}

function assertKind(
  definition: RuleAxisDefinition,
  kind: RuleAxisKind,
): void {
  if (definition.kind !== kind) {
    throw new Error(`${definition.id} is ${definition.kind}; expected ${kind}`);
  }
}

function assertValid(
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): void {
  if (contributions.some((entry) => entry.axis !== definition.id)) {
    throw new Error(`Reducer for ${definition.id} received another axis`);
  }
  const issues = validateRuleContributions(contributions, {
    [definition.id]: definition,
  });
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
  for (const stage of definition.stages) {
    if (
      stage.reducer === "SINGLETON" &&
      contributions.filter((entry) => entry.stage === stage.id).length > 1
    ) {
      throw new Error(
        `${definition.id}/${stage.id} has multiple applicable singletons`,
      );
    }
  }
}

function bigintAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bigintGcd(a: bigint, b: bigint): bigint {
  let left = bigintAbs(a);
  let right = bigintAbs(b);
  while (right !== 0n) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left === 0n ? 1n : left;
}

function exactBasisPointProduct(group: readonly RuleContribution[]): number {
  let numerator = 1n;
  let denominator = 1n;
  for (const entry of group) {
    const value = numericValue(entry);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Unsafe basis-point multiplier from ${entry.sourceId}`);
    }
    numerator *= BigInt(value);
    denominator *= BigInt(BASIS_POINTS_SCALE);
    const divisor = bigintGcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;
  }
  return Number(numerator) / Number(denominator);
}

function exactSafeIntegerSum(group: readonly RuleContribution[]): number {
  let total = 0n;
  for (const entry of group) {
    const value = numericValue(entry);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Unsafe integer sum operand from ${entry.sourceId}`);
    }
    total += BigInt(value);
  }
  const result = Number(total);
  if (!Number.isSafeInteger(result)) {
    throw new Error("Rule SUM exceeds the safe-integer range");
  }
  return result;
}

/** Apply an authored fixed-scale percentage without first materializing 1 + p as a float. */
function applyBasisPointDelta(value: number, deltaBasisPoints: number): number {
  return (
    (value * (BASIS_POINTS_SCALE + deltaBasisPoints)) /
    BASIS_POINTS_SCALE
  );
}

/** Scope/condition eligibility is resolved by the owning subsystem before reduction. */
export function reduceScalarRule(
  baseValue: number,
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): number {
  assertKind(definition, "SCALAR");
  assertValid(definition, contributions);
  let current = baseValue;
  for (const stage of definition.stages) {
    const group = contributions.filter((entry) => entry.stage === stage.id);
    if (group.length === 0) continue;
    const operator = group[0]?.operator;
    if (operator === undefined) continue;
    switch (stage.reducer) {
      case "SUM": {
        const sum = exactSafeIntegerSum(group);
        if (operator === "ADD_FLAT") current += sum;
        else if (operator === "ADD_PERCENT") {
          current = applyBasisPointDelta(current, sum);
        } else throw new Error(`SUM cannot apply ${operator}`);
        break;
      }
      case "PRODUCT":
        if (operator !== "MULTIPLY") {
          throw new Error(`PRODUCT cannot apply ${operator}`);
        }
        current *= exactBasisPointProduct(group);
        break;
      case "SINGLETON": {
        const entry = group[0];
        if (
          entry !== undefined &&
          (operator === "REPLACE_BASE" || operator === "FINAL_OVERRIDE")
        ) {
          current = numericValue(entry);
        } else throw new Error(`SINGLETON cannot apply ${operator}`);
        break;
      }
      case "ANY":
        if (operator !== "HARD_ZERO") {
          throw new Error(`ANY cannot apply ${operator}`);
        }
        current = 0;
        break;
      case "MIN":
        current = Math.min(current, ...group.map(numericValue));
        break;
      case "MAX":
        current = Math.max(current, ...group.map(numericValue));
        break;
      default:
        throw new Error(`${stage.reducer} is invalid for scalar ${definition.id}`);
    }
  }
  return current;
}

export function reducePermissionRule(
  baseAllowed: boolean,
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): boolean {
  assertKind(definition, "PERMISSION");
  assertValid(definition, contributions);
  let allowed = baseAllowed;
  for (const stage of definition.stages) {
    const group = contributions.filter((entry) => entry.stage === stage.id);
    if (group.length === 0) continue;
    if (stage.reducer !== "PROHIBIT_WINS") {
      throw new Error("Permission reducer mismatch");
    }
    if (group.some((entry) => entry.operator === "PROHIBIT")) allowed = false;
    else if (group.some((entry) => entry.operator === "ALLOW")) allowed = true;
  }
  return allowed;
}

export function reduceCapRule(
  baseCap: number,
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): number {
  assertKind(definition, "CAP");
  assertValid(definition, contributions);
  let cap = baseCap;
  for (const stage of definition.stages) {
    const group = contributions.filter((entry) => entry.stage === stage.id);
    if (group.length === 0) continue;
    const operator = group[0]?.operator;
    if (stage.reducer === "SUM" && operator === "ADD_CAP") {
      cap += exactSafeIntegerSum(group);
    } else if (stage.reducer === "MIN" && operator === "CAP_LIMIT") {
      cap = Math.min(cap, ...group.map(numericValue));
    } else if (stage.reducer === "MAX" && operator === "CAP_FLOOR") {
      cap = Math.max(cap, ...group.map(numericValue));
    } else throw new Error(`Invalid cap reducer/operator on ${definition.id}`);
  }
  return cap;
}

function stringIds(value: RuleValue | undefined): readonly string[] {
  if (typeof value === "string") return [value];
  if (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
  ) {
    return value;
  }
  throw new Error("Expected string ID(s)");
}

export function reduceCapabilitySetRule(
  baseCapabilities: readonly string[],
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): readonly string[] {
  assertKind(definition, "CAPABILITY_SET");
  assertValid(definition, contributions);
  let capabilities = new Set(baseCapabilities);
  for (const stage of definition.stages) {
    const group = contributions.filter((entry) => entry.stage === stage.id);
    if (group.length === 0) continue;
    if (stage.reducer === "UNION") {
      for (const entry of group) {
        for (const id of stringIds(entry.value)) capabilities.add(id);
      }
    } else if (stage.reducer === "DIFFERENCE") {
      for (const entry of group) {
        for (const id of stringIds(entry.value)) capabilities.delete(id);
      }
    } else if (stage.reducer === "SINGLETON") {
      capabilities = new Set(stringIds(group[0]?.value));
    } else throw new Error(`${stage.reducer} is invalid for capability set`);
  }
  return [...capabilities].sort(compareStrings);
}

export function reduceComponentSetRule(
  baseSuppressedComponents: readonly string[],
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): readonly string[] {
  assertKind(definition, "COMPONENT_SET");
  assertValid(definition, contributions);
  const suppressed = new Set(baseSuppressedComponents);
  for (const stage of definition.stages) {
    const group = contributions.filter((entry) => entry.stage === stage.id);
    if (group.length === 0) continue;
    if (stage.reducer !== "UNION") {
      throw new Error(`${stage.reducer} is invalid for component suppression`);
    }
    for (const entry of group) {
      for (const id of stringIds(entry.value)) suppressed.add(id);
    }
  }
  return [...suppressed].sort(compareStrings);
}

export function selectStructuralTransform(
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): string | undefined {
  assertKind(definition, "STRUCTURAL");
  assertValid(definition, contributions);
  if (contributions.length === 0) return undefined;
  const entry = contributions[0];
  if (
    entry === undefined ||
    entry.operator !== "STRUCTURAL_TRANSFORM" ||
    typeof entry.value !== "string"
  ) {
    throw new Error(`Invalid structural transform for ${definition.id}`);
  }
  return entry.value;
}

export interface StructurePressureFieldContribution {
  readonly fieldType: "FORT" | "COMMAND_POST";
  readonly component: string;
  readonly bonusBp: number;
}

export interface PressureCompositionInput {
  readonly basePressure: number;
  readonly terrainPercentBp?: readonly number[];
  readonly rulePercentBp?: readonly number[];
  readonly structureFields?: readonly StructurePressureFieldContribution[];
  readonly suppressedComponents?: ReadonlySet<string>;
}

function strongestFieldBonus(
  fields: readonly StructurePressureFieldContribution[],
  type: StructurePressureFieldContribution["fieldType"],
): number {
  let strongest = 0;
  for (const field of fields) {
    if (field.fieldType === type && field.bonusBp > strongest) {
      strongest = field.bonusBp;
    }
  }
  return strongest / BASIS_POINTS_SCALE;
}

/** Component-aware pressure; same-type strongest, cross-type complement. */
export function composePressure(input: PressureCompositionInput): number {
  const suppressed = input.suppressedComponents ?? new Set<string>();
  const terrainBp = [...(input.terrainPercentBp ?? [])].reduce(
    (total, value) => total + BigInt(value),
    0n,
  );
  const ruleBp = [...(input.rulePercentBp ?? [])].reduce(
    (total, value) => total + BigInt(value),
    0n,
  );
  const fields = (input.structureFields ?? []).filter(
    (field) => !suppressed.has(field.component),
  );
  const fort = strongestFieldBonus(fields, "FORT");
  const command = strongestFieldBonus(fields, "COMMAND_POST");
  const structureBonus = 1 - (1 - fort) * (1 - command);
  return (
    applyBasisPointDelta(
      applyBasisPointDelta(input.basePressure, Number(terrainBp)),
      Number(ruleBp),
    ) *
    (1 + structureBonus)
  );
}
