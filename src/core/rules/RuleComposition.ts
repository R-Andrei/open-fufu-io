import { pow2 as deterministicPow2 } from "../DetMath";

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

export const CONCRETE_UNIT_IDS = [
  "TANK",
  "HEAVY_ARTILLERY",
  "WARSHIP",
  "TRANSPORT_SHIP",
  "TRADE_SHIP",
  "TRAIN",
] as const;
export type ConcreteUnitId = (typeof CONCRETE_UNIT_IDS)[number];
export const UNIT_SCOPE_IDS = ["ALL", ...CONCRETE_UNIT_IDS] as const;
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

export const STRUCTURE_ACQUISITION_PATHS = [
  "PURCHASE_BUILD",
  "GRANT",
  "CAPTURE_TRANSFER",
] as const;
export type StructureAcquisitionPath =
  (typeof STRUCTURE_ACQUISITION_PATHS)[number];

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

export const RULE_UNITS = [
  "NONE",
  "AREA",
  "BASIS_POINTS",
  "CELLS",
  "CELLS_PER_SECOND",
  "DAMAGE",
  "HEALTH_POINTS",
  "HEALTH_PER_SECOND",
  "FFY",
  "POPULATION",
  "SECONDS",
  "TICKS",
  "RATIO",
  "BOOLEAN",
  "COUNT",
  "CAPABILITY_SET",
  "COMPONENT_SET",
  "PROFILE_ID",
] as const;
export type RuleUnit = (typeof RULE_UNITS)[number];

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
  | { readonly kind: "TARGET_UNIT_IS"; readonly unit: ConcreteUnitId }
  | {
      readonly kind: "EVENT_INSIDE_FIELD";
      readonly field: "FORT" | "SAM" | "COMMAND_POST";
    }
  | {
      readonly kind: "SOURCE_INSIDE_FIELD";
      readonly field: "FORT" | "COMMAND_POST";
    }
  | {
      readonly kind: "STRUCTURE_ACQUISITION_PATH_IS";
      readonly path: StructureAcquisitionPath;
    };

/** Conditions on one contribution are a closed logical conjunction (AND). */
export type RuleConditions = readonly RuleCondition[];
export type RuleValue = number | string | readonly string[];

export interface RuleContribution {
  readonly axis: string;
  readonly scope: RuleScope;
  readonly stage: RuleStageId;
  readonly operator: RuleOperator;
  readonly sourceKind: RuleSourceKind;
  readonly sourceId: string;
  /** Operand unit. Authored percentages/scalars use integer basis points. */
  readonly valueUnit: RuleUnit;
  readonly value?: RuleValue;
  readonly conditions?: RuleConditions;
  readonly component?: string;
}

export interface RuleStageDefinition {
  readonly id: RuleStageId;
  readonly reducer: RuleReducer;
  readonly allowedOperators: readonly RuleOperator[];
  readonly after?: readonly RuleStageId[];
}

export interface RuleAxisDefinition {
  readonly id: string;
  readonly kind: RuleAxisKind;
  readonly unit: RuleUnit;
  readonly scopeKind: RuleScopeKind;
  readonly stages: readonly RuleStageDefinition[];
  readonly allowedSourceKinds: readonly RuleSourceKind[];
  /** Closed, axis-specific structural output vocabulary. */
  readonly allowedProfileIds?: readonly string[];
}
export type RuleAxisRegistry = Readonly<Record<string, RuleAxisDefinition>>;

export type RuleStateDependency =
  | "OWNED_PERSISTENT_STRUCTURE_COUNT"
  | "TERRITORIAL_CONTACT_COUNT"
  | "PEAK_TOTAL_POPULATION";

export type DynamicRuleFormula =
  | {
      readonly kind: "RATIONAL_POWER";
      readonly numerator: number;
      readonly denominator: number;
    }
  | {
      readonly kind: "BASIS_POINTS_PER_COUNT";
      readonly bpPerUnit: number;
    }
  | {
      readonly kind: "FLOOR_COUNT_PER_UNITS";
      readonly unitsPerStep: number;
    };

export type DynamicRuleOperandKind =
  | "RATIONAL"
  | "BASIS_POINTS"
  | "INTEGER";

export interface DynamicRuleProvider {
  readonly id: string;
  readonly axis: string;
  readonly scope: RuleScope;
  readonly stage: RuleStageId;
  readonly operator: "MULTIPLY" | "ADD_PERCENT" | "CAP_LIMIT";
  readonly sourceKind: RuleSourceKind;
  readonly sourceId: string;
  readonly dependency: RuleStateDependency;
  readonly formula: DynamicRuleFormula;
  readonly operandKind: DynamicRuleOperandKind;
  readonly conditions?: RuleConditions;
}

export type DynamicRuleResolvedValue =
  | {
      readonly kind: "RATIONAL";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "BASIS_POINTS"; readonly value: number }
  | { readonly kind: "INTEGER"; readonly value: string };

export interface RuleCustomDomainDeclaration {
  readonly sourceKind: RuleSourceKind;
  readonly sourceId: string;
  readonly domain: string;
}

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
  | "MISSING_PROFILE_VOCABULARY"
  | "DUPLICATE_PROFILE_ID"
  | "UNKNOWN_AXIS"
  | "INVALID_CONTRIBUTION_SHAPE"
  | "INVALID_SOURCE_ID"
  | "INVALID_SCOPE_VALUE"
  | "SCOPE_KIND_MISMATCH"
  | "INVALID_CONDITION"
  | "INVALID_CONDITION_SET"
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
  | "INVALID_PROFILE_ID"
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
const CONCRETE_UNIT_ID_SET = new Set<string>(CONCRETE_UNIT_IDS);
const WEAPON_SCOPE_ID_SET = new Set<string>(WEAPON_SCOPE_IDS);
const FFY_FAMILY_SCOPE_ID_SET = new Set<string>(FFY_FAMILY_SCOPE_IDS);
const STRUCTURE_ACQUISITION_PATH_SET = new Set<string>(STRUCTURE_ACQUISITION_PATHS);
const RULE_SOURCE_KIND_SET = new Set<string>(RULE_SOURCE_KINDS);
const RULE_STAGE_ID_SET = new Set<string>(RULE_STAGE_IDS);
const RULE_OPERATOR_SET = new Set<string>(RULE_OPERATORS);
const RULE_UNIT_SET = new Set<string>(RULE_UNITS);
const RULE_CAPABILITY_ID_SET = new Set<string>(RULE_CAPABILITY_IDS);
const RULE_COMPONENT_ID_SET = new Set<string>(RULE_COMPONENT_IDS);

const CONTRIBUTION_REQUIRED_KEYS = [
  "axis",
  "scope",
  "stage",
  "operator",
  "sourceKind",
  "sourceId",
  "valueUnit",
] as const;
const CONTRIBUTION_OPTIONAL_KEYS = ["value", "conditions", "component"] as const;

export function compareRuleStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalRuleJson(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalRuleJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareRuleStrings);
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalRuleJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Unsupported canonical value: ${typeof value}`);
}

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

export function isValidRuleScope(scope: unknown): scope is RuleScope {
  if (!isRecord(scope) || typeof scope.kind !== "string") return false;
  switch (scope.kind) {
    case "GLOBAL":
      return hasExactKeys(scope, ["kind"]);
    case "TERRAIN":
      return (
        hasExactKeys(scope, ["kind", "terrain"]) &&
        typeof scope.terrain === "string" &&
        TERRAIN_SCOPE_ID_SET.has(scope.terrain)
      );
    case "STRUCTURE":
      return (
        hasExactKeys(scope, ["kind", "structure"]) &&
        typeof scope.structure === "string" &&
        STRUCTURE_SCOPE_ID_SET.has(scope.structure)
      );
    case "UNIT":
      return (
        hasExactKeys(scope, ["kind", "unit"]) &&
        typeof scope.unit === "string" &&
        UNIT_SCOPE_ID_SET.has(scope.unit)
      );
    case "WEAPON":
      return (
        hasExactKeys(scope, ["kind", "weapon"]) &&
        typeof scope.weapon === "string" &&
        WEAPON_SCOPE_ID_SET.has(scope.weapon)
      );
    case "FFY_FAMILY":
      return (
        hasExactKeys(scope, ["kind", "family"]) &&
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
        hasExactKeys(condition, ["kind", "terrain"]) &&
        typeof condition.terrain === "string" &&
        TERRAIN_SCOPE_ID_SET.has(condition.terrain)
      );
    case "TARGET_HAS_FALLOUT":
    case "TARGET_LACKS_FALLOUT":
      return hasExactKeys(condition, ["kind"]);
    case "TARGET_UNIT_IS":
      return (
        hasExactKeys(condition, ["kind", "unit"]) &&
        typeof condition.unit === "string" &&
        CONCRETE_UNIT_ID_SET.has(condition.unit)
      );
    case "EVENT_INSIDE_FIELD":
      return (
        hasExactKeys(condition, ["kind", "field"]) &&
        (condition.field === "FORT" ||
          condition.field === "SAM" ||
          condition.field === "COMMAND_POST")
      );
    case "SOURCE_INSIDE_FIELD":
      return (
        hasExactKeys(condition, ["kind", "field"]) &&
        (condition.field === "FORT" || condition.field === "COMMAND_POST")
      );
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return (
        hasExactKeys(condition, ["kind", "path"]) &&
        typeof condition.path === "string" &&
        STRUCTURE_ACQUISITION_PATH_SET.has(condition.path)
      );
    default:
      return false;
  }
}

export function isValidRuleContributionShape(raw: unknown): raw is RuleContribution {
  if (!isRecord(raw)) return false;
  if (!hasExactKeys(raw, CONTRIBUTION_REQUIRED_KEYS, CONTRIBUTION_OPTIONAL_KEYS)) {
    return false;
  }
  return (
    typeof raw.axis === "string" &&
    raw.axis.length > 0 &&
    Object.prototype.hasOwnProperty.call(raw, "scope") &&
    typeof raw.stage === "string" &&
    RULE_STAGE_ID_SET.has(raw.stage) &&
    typeof raw.operator === "string" &&
    RULE_OPERATOR_SET.has(raw.operator) &&
    typeof raw.sourceKind === "string" &&
    RULE_SOURCE_KIND_SET.has(raw.sourceKind) &&
    typeof raw.sourceId === "string" &&
    typeof raw.valueUnit === "string" &&
    RULE_UNIT_SET.has(raw.valueUnit) &&
    (raw.conditions === undefined || Array.isArray(raw.conditions)) &&
    (raw.component === undefined ||
      (typeof raw.component === "string" && raw.component.length > 0))
  );
}

export function canonicalizeRuleConditions(
  conditions: RuleConditions | undefined,
): RuleConditions | undefined {
  if (conditions === undefined) return undefined;
  const byKey = new Map<string, RuleCondition>();
  for (const condition of conditions) {
    byKey.set(canonicalRuleJson(condition), condition);
  }
  return Object.freeze(
    [...byKey.entries()]
      .sort(([a], [b]) => compareRuleStrings(a, b))
      .map(([, condition]) => condition),
  );
}

export function canonicalizeStringSet(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareRuleStrings));
}

export function canonicalizeRuleContribution(
  contribution: RuleContribution,
): RuleContribution {
  const value = Array.isArray(contribution.value)
    ? canonicalizeStringSet(contribution.value)
    : contribution.value;
  const conditions = canonicalizeRuleConditions(contribution.conditions);
  return {
    axis: contribution.axis,
    scope: contribution.scope,
    stage: contribution.stage,
    operator: contribution.operator,
    sourceKind: contribution.sourceKind,
    sourceId: contribution.sourceId,
    valueUnit: contribution.valueUnit,
    ...(value === undefined ? {} : { value }),
    ...(conditions === undefined || conditions.length === 0
      ? {}
      : { conditions }),
    ...(contribution.component === undefined
      ? {}
      : { component: contribution.component }),
  };
}

export function serializeRuleContributions(
  contributions: readonly RuleContribution[],
): string {
  const normalized = contributions.map(canonicalizeRuleContribution);
  normalized.sort((a, b) =>
    compareRuleStrings(canonicalRuleJson(a), canonicalRuleJson(b)),
  );
  return canonicalRuleJson({
    version: RULE_COMPOSITION_VERSION,
    contributions: normalized,
  });
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

    if (definition.kind === "STRUCTURAL") {
      const profiles = definition.allowedProfileIds;
      if (profiles === undefined || profiles.length === 0) {
        issues.push({
          code: "MISSING_PROFILE_VOCABULARY",
          axis: axisId,
          message: `${axisId} is structural but declares no profile vocabulary`,
        });
      } else if (new Set(profiles).size !== profiles.length) {
        issues.push({
          code: "DUPLICATE_PROFILE_ID",
          axis: axisId,
          message: `${axisId} declares duplicate structural profile IDs`,
        });
      }
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
        typeof entry === "string" && entry.length > 0 && allowed.has(entry),
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
  definition: RuleAxisDefinition,
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
      return;
    }
    if (
      definition.kind !== "STRUCTURAL" ||
      definition.allowedProfileIds === undefined ||
      !definition.allowedProfileIds.includes(contribution.value)
    ) {
      issues.push({
        ...base,
        code: "INVALID_PROFILE_ID",
        message: `${contribution.value} is not a registered profile for ${definition.id}`,
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

function invalidContributionContext(raw: unknown): {
  readonly axis: string;
  readonly sourceId?: string;
} {
  if (!isRecord(raw)) return { axis: "RULE_CONTRIBUTION" };
  return {
    axis: typeof raw.axis === "string" ? raw.axis : "RULE_CONTRIBUTION",
    ...(typeof raw.sourceId === "string" ? { sourceId: raw.sourceId } : {}),
  };
}

export function validateRuleContributions(
  contributions: readonly unknown[],
  registry: RuleAxisRegistry,
): readonly RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const groups = new Map<string, RuleContribution[]>();

  for (const rawContribution of contributions) {
    const context = invalidContributionContext(rawContribution);
    if (!isValidRuleContributionShape(rawContribution)) {
      issues.push({
        code: "INVALID_CONTRIBUTION_SHAPE",
        axis: context.axis,
        ...(context.sourceId === undefined ? {} : { sourceId: context.sourceId }),
        message:
          "Rule contribution must use the exact closed RuleContribution shape and registered runtime vocabulary",
      });
      continue;
    }
    const contribution = rawContribution;
    if (contribution.sourceId.length === 0) {
      issues.push({
        code: "INVALID_SOURCE_ID",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: "Rule contribution sourceId must be non-empty",
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
    if (contribution.conditions !== undefined) {
      if (contribution.conditions.length === 0) {
        issues.push({
          code: "INVALID_CONDITION_SET",
          axis: contribution.axis,
          sourceId: contribution.sourceId,
          stage: contribution.stage,
          message: `${contribution.axis} conditions must be a non-empty conjunction when present`,
        });
      } else {
        for (const condition of contribution.conditions) {
          if (!isValidRuleCondition(condition as unknown)) {
            issues.push({
              code: "INVALID_CONDITION",
              axis: contribution.axis,
              sourceId: contribution.sourceId,
              stage: contribution.stage,
              message: `${contribution.axis} received an invalid runtime condition`,
            });
          }
        }
      }
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
    validateValue(contribution, definition, issues);

    const key = canonicalRuleJson({
      axis: contribution.axis,
      scope: contribution.scope,
      stage: contribution.stage,
      conditions: canonicalizeRuleConditions(contribution.conditions),
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

function bigintAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function bigintGcd(a: bigint, b: bigint): bigint {
  let left = bigintAbs(a);
  let right = bigintAbs(b);
  while (right !== 0n) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left === 0n ? 1n : left;
}

export function reducedRational(
  numeratorInput: bigint,
  denominatorInput: bigint,
): { readonly numerator: bigint; readonly denominator: bigint } {
  if (denominatorInput === 0n) throw new Error("Rational denominator cannot be zero");
  let numerator = numeratorInput;
  let denominator = denominatorInput;
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const divisor = bigintGcd(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function powBigInt(baseInput: bigint, exponentInput: number): bigint {
  if (!Number.isSafeInteger(exponentInput) || exponentInput < 0) {
    throw new Error("Exponent must be a non-negative safe integer");
  }
  let base = baseInput;
  let exponent = exponentInput;
  let result = 1n;
  while (exponent > 0) {
    if (exponent % 2 === 1) result *= base;
    exponent = Math.floor(exponent / 2);
    if (exponent > 0) base *= base;
  }
  return result;
}

export function evaluateDynamicRuleProvider(
  provider: DynamicRuleProvider,
  dependencyValue: number,
): DynamicRuleResolvedValue {
  if (!Number.isSafeInteger(dependencyValue) || dependencyValue < 0) {
    throw new Error(`${provider.dependency} must be a non-negative safe integer`);
  }
  switch (provider.formula.kind) {
    case "RATIONAL_POWER": {
      const numerator = provider.formula.numerator;
      const denominator = provider.formula.denominator;
      if (
        !Number.isSafeInteger(numerator) ||
        !Number.isSafeInteger(denominator) ||
        denominator <= 0
      ) {
        throw new Error("RATIONAL_POWER requires safe integer numerator/denominator");
      }
      const reduced = reducedRational(
        powBigInt(BigInt(numerator), dependencyValue),
        powBigInt(BigInt(denominator), dependencyValue),
      );
      return {
        kind: "RATIONAL",
        numerator: reduced.numerator.toString(),
        denominator: reduced.denominator.toString(),
      };
    }
    case "BASIS_POINTS_PER_COUNT": {
      if (!Number.isSafeInteger(provider.formula.bpPerUnit)) {
        throw new Error("BASIS_POINTS_PER_COUNT requires a safe integer rate");
      }
      const value = dependencyValue * provider.formula.bpPerUnit;
      if (!Number.isSafeInteger(value)) {
        throw new Error("Dynamic basis-point result exceeds safe-integer range");
      }
      return { kind: "BASIS_POINTS", value };
    }
    case "FLOOR_COUNT_PER_UNITS": {
      if (
        !Number.isSafeInteger(provider.formula.unitsPerStep) ||
        provider.formula.unitsPerStep <= 0
      ) {
        throw new Error("FLOOR_COUNT_PER_UNITS requires a positive safe integer step");
      }
      return {
        kind: "INTEGER",
        value: Math.floor(
          dependencyValue / provider.formula.unitsPerStep,
        ).toString(),
      };
    }
  }
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

function exactBasisPointProduct(
  group: readonly RuleContribution[],
): { readonly numerator: bigint; readonly denominator: bigint } {
  let numerator = 1n;
  let denominator = 1n;
  for (const entry of group) {
    const value = numericValue(entry);
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Unsafe basis-point multiplier from ${entry.sourceId}`);
    }
    numerator *= BigInt(value);
    denominator *= BigInt(BASIS_POINTS_SCALE);
    const reduced = reducedRational(numerator, denominator);
    numerator = reduced.numerator;
    denominator = reduced.denominator;
  }
  return { numerator, denominator };
}

export function rationalToFiniteNumber(
  numeratorInput: bigint,
  denominatorInput: bigint,
): number {
  if (denominatorInput === 0n) {
    throw new Error("Exact rational denominator cannot be zero");
  }
  if (numeratorInput === 0n) return 0;

  const negative = (numeratorInput < 0n) !== (denominatorInput < 0n);
  const numerator = numeratorInput < 0n ? -numeratorInput : numeratorInput;
  const denominator = denominatorInput < 0n ? -denominatorInput : denominatorInput;
  const numeratorBits = numerator.toString(2).length;
  const denominatorBits = denominator.toString(2).length;
  const numeratorShift = Math.max(0, numeratorBits - 53);
  const denominatorShift = Math.max(0, denominatorBits - 53);
  const numeratorMantissa = Number(numerator >> BigInt(numeratorShift));
  const denominatorMantissa = Number(denominator >> BigInt(denominatorShift));
  const exponent = numeratorShift - denominatorShift;
  const magnitude =
    (numeratorMantissa / denominatorMantissa) * deterministicPow2(exponent);
  const result = negative ? -magnitude : magnitude;
  if (!Number.isFinite(result)) {
    throw new Error("Exact rational materialized to a non-finite number");
  }
  return result;
}

function applyBasisPointDelta(value: number, deltaBasisPoints: number): number {
  return (
    (value * (BASIS_POINTS_SCALE + deltaBasisPoints)) /
    BASIS_POINTS_SCALE
  );
}

/** Scope and condition eligibility must be resolved before materialization. */
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
      case "PRODUCT": {
        if (operator !== "MULTIPLY") {
          throw new Error(`PRODUCT cannot apply ${operator}`);
        }
        const product = exactBasisPointProduct(group);
        current *= rationalToFiniteNumber(product.numerator, product.denominator);
        break;
      }
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
    return canonicalizeStringSet(value);
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
  return canonicalizeStringSet([...capabilities]);
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
  return canonicalizeStringSet([...suppressed]);
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

function exactBasisPointArraySum(values: readonly number[]): number {
  let total = 0n;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new Error("Pressure basis-point operands must be safe integers");
    }
    total += BigInt(value);
  }
  const result = Number(total);
  if (!Number.isSafeInteger(result)) {
    throw new Error("Pressure basis-point sum exceeds safe-integer range");
  }
  return result;
}

/** Component-aware pressure; same-type strongest, cross-type complement. */
export function composePressure(input: PressureCompositionInput): number {
  const suppressed = input.suppressedComponents ?? new Set<string>();
  const terrainBp = exactBasisPointArraySum(input.terrainPercentBp ?? []);
  const ruleBp = exactBasisPointArraySum(input.rulePercentBp ?? []);
  const fields = (input.structureFields ?? []).filter(
    (field) => !suppressed.has(field.component),
  );
  const fort = strongestFieldBonus(fields, "FORT");
  const command = strongestFieldBonus(fields, "COMMAND_POST");
  const structureBonus = 1 - (1 - fort) * (1 - command);
  return (
    applyBasisPointDelta(
      applyBasisPointDelta(input.basePressure, terrainBp),
      ruleBp,
    ) *
    (1 + structureBonus)
  );
}
