export const RULE_COMPOSITION_VERSION = "1" as const;
export const BASIS_POINTS_SCALE = 10_000;

export type RuleAxisKind =
  | "SCALAR"
  | "PERMISSION"
  | "CAP"
  | "CAPABILITY_SET"
  | "STRUCTURAL";

export type RuleSourceKind =
  | "BASE_RULESET"
  | "RULESET_TRANSFORM"
  | "ORIGIN"
  | "ECHO"
  | "TERRAIN"
  | "STRUCTURE"
  | "UNIT_PROFILE"
  | "SITUATIONAL";

export type RuleUnit =
  | "AREA"
  | "BASIS_POINTS"
  | "CELLS"
  | "CELLS_PER_SECOND"
  | "DAMAGE"
  | "FFY"
  | "POPULATION"
  | "RATIO"
  | "BOOLEAN"
  | "COUNT"
  | "CAPABILITY_SET"
  | "PROFILE_ID";

export type RuleStageId =
  | "STRUCTURAL_PROFILE"
  | "BASE_REPLACEMENT"
  | "ORIGIN_FLAT"
  | "ORIGIN_PERCENT"
  | "ORIGIN_SCALAR"
  | "ORIGIN_CAP"
  | "ECHO_PERCENT"
  | "ECHO_SCALAR"
  | "CONTEXTUAL_PERCENT"
  | "CONTEXTUAL_SCALAR"
  | "CAPABILITY_ADD"
  | "CAPABILITY_REMOVE"
  | "CAPABILITY_REPLACE"
  | "PERMISSION"
  | "FINAL_OVERRIDE"
  | "TERMINAL";

export type RuleOperator =
  | "ADD_FLAT"
  | "ADD_PERCENT"
  | "MULTIPLY"
  | "REPLACE_BASE"
  | "FINAL_OVERRIDE"
  | "HARD_ZERO"
  | "ALLOW"
  | "PROHIBIT"
  | "CAP_LIMIT"
  | "CAP_FLOOR"
  | "ADD_CAP"
  | "ADD_CAPABILITY"
  | "REMOVE_CAPABILITY"
  | "REPLACE_CAPABILITIES"
  | "STRUCTURAL_TRANSFORM";

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

export type RuleCondition =
  | { readonly kind: "SOURCE_TERRAIN_IS"; readonly terrain: string }
  | { readonly kind: "TARGET_TERRAIN_IS"; readonly terrain: string }
  | { readonly kind: "TARGET_HAS_FALLOUT" }
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
  readonly stage: RuleStageId;
  readonly operator: RuleOperator;
  readonly sourceKind: RuleSourceKind;
  readonly sourceId: string;
  readonly unit: RuleUnit;
  readonly value?: RuleValue;
  readonly condition?: RuleCondition;
  readonly component?: string;
}

export interface RuleStageDefinition {
  readonly id: RuleStageId;
  readonly reducer: RuleReducer;
  readonly allowedOperators: readonly RuleOperator[];
  /** Semantic dependency only. Numeric priority values are intentionally absent. */
  readonly after?: readonly RuleStageId[];
}

export interface RuleAxisDefinition {
  readonly id: string;
  readonly kind: RuleAxisKind;
  readonly unit: RuleUnit;
  readonly stages: readonly RuleStageDefinition[];
  readonly allowedSourceKinds: readonly RuleSourceKind[];
}

export type RuleAxisRegistry = Readonly<Record<string, RuleAxisDefinition>>;

export type RuleValidationCode =
  | "AXIS_ID_MISMATCH"
  | "DUPLICATE_STAGE"
  | "UNKNOWN_STAGE_DEPENDENCY"
  | "STAGE_DEPENDENCY_CYCLE"
  | "UNKNOWN_AXIS"
  | "UNIT_MISMATCH"
  | "SOURCE_KIND_NOT_ALLOWED"
  | "STAGE_NOT_ALLOWED"
  | "OPERATOR_NOT_ALLOWED"
  | "VALUE_REQUIRED"
  | "VALUE_NOT_ALLOWED"
  | "INVALID_NUMERIC_VALUE"
  | "INVALID_STRING_VALUE"
  | "INVALID_CAPABILITY_VALUE"
  | "SINGLETON_CONFLICT"
  | "MIXED_STAGE_OPERATORS"
  | "WRONG_AXIS_KIND";

export interface RuleValidationIssue {
  readonly code: RuleValidationCode;
  readonly axis: string;
  readonly message: string;
  readonly sourceId?: string;
  readonly stage?: RuleStageId;
}

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

function compareCanonicalStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalizeValue(value: RuleValue | undefined): RuleValue | undefined {
  if (!Array.isArray(value)) return value;
  return [...value].sort(compareCanonicalStrings);
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareCanonicalStrings);
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
}

function canonicalContribution(contribution: RuleContribution): RuleContribution {
  return {
    axis: contribution.axis,
    stage: contribution.stage,
    operator: contribution.operator,
    sourceKind: contribution.sourceKind,
    sourceId: contribution.sourceId,
    unit: contribution.unit,
    ...(contribution.value === undefined
      ? {}
      : { value: canonicalizeValue(contribution.value) }),
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
  normalized.sort((a, b) =>
    compareCanonicalStrings(canonicalJson(a), canonicalJson(b)),
  );
  return canonicalJson({
    version: RULE_COMPOSITION_VERSION,
    contributions: normalized,
  });
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

    const stageIds = new Set<RuleStageId>();
    for (const stage of definition.stages) {
      if (stageIds.has(stage.id)) {
        issues.push({
          code: "DUPLICATE_STAGE",
          axis: axisId,
          stage: stage.id,
          message: `Axis ${axisId} defines stage ${stage.id} more than once`,
        });
      }
      stageIds.add(stage.id);
    }

    const graph = new Map<RuleStageId, readonly RuleStageId[]>();
    for (const stage of definition.stages) {
      const dependencies = stage.after ?? [];
      graph.set(stage.id, dependencies);
      for (const dependency of dependencies) {
        if (!stageIds.has(dependency)) {
          issues.push({
            code: "UNKNOWN_STAGE_DEPENDENCY",
            axis: axisId,
            stage: stage.id,
            message: `Stage ${stage.id} depends on unknown stage ${dependency}`,
          });
        }
      }
    }

    const visiting = new Set<RuleStageId>();
    const visited = new Set<RuleStageId>();
    const visit = (stageId: RuleStageId): boolean => {
      if (visiting.has(stageId)) return true;
      if (visited.has(stageId)) return false;
      visiting.add(stageId);
      for (const dependency of graph.get(stageId) ?? []) {
        if (graph.has(dependency) && visit(dependency)) return true;
      }
      visiting.delete(stageId);
      visited.add(stageId);
      return false;
    };

    for (const stageId of graph.keys()) {
      if (visit(stageId)) {
        issues.push({
          code: "STAGE_DEPENDENCY_CYCLE",
          axis: axisId,
          stage: stageId,
          message: `Axis ${axisId} contains a cyclic stage dependency`,
        });
        break;
      }
    }
  }

  return issues;
}

export function validateRuleContributions(
  contributions: readonly RuleContribution[],
  registry: RuleAxisRegistry,
): readonly RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const byAxisAndStage = new Map<string, RuleContribution[]>();

  for (const contribution of contributions) {
    const definition = registry[contribution.axis];
    if (definition === undefined) {
      issues.push({
        code: "UNKNOWN_AXIS",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `Unknown rule axis ${contribution.axis}`,
      });
      continue;
    }

    if (contribution.unit !== definition.unit) {
      issues.push({
        code: "UNIT_MISMATCH",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `Axis ${contribution.axis} expects ${definition.unit}, received ${contribution.unit}`,
      });
    }

    if (!definition.allowedSourceKinds.includes(contribution.sourceKind)) {
      issues.push({
        code: "SOURCE_KIND_NOT_ALLOWED",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `Source kind ${contribution.sourceKind} is not allowed on ${contribution.axis}`,
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
        message: `Stage ${contribution.stage} is not defined on ${contribution.axis}`,
      });
      continue;
    }

    if (!stage.allowedOperators.includes(contribution.operator)) {
      issues.push({
        code: "OPERATOR_NOT_ALLOWED",
        axis: contribution.axis,
        sourceId: contribution.sourceId,
        stage: contribution.stage,
        message: `Operator ${contribution.operator} is not allowed in ${contribution.axis}/${contribution.stage}`,
      });
    }

    if (NUMERIC_OPERATORS.has(contribution.operator)) {
      if (typeof contribution.value !== "number") {
        issues.push({
          code: "VALUE_REQUIRED",
          axis: contribution.axis,
          sourceId: contribution.sourceId,
          stage: contribution.stage,
          message: `Operator ${contribution.operator} requires a numeric value`,
        });
      } else if (!Number.isFinite(contribution.value)) {
        issues.push({
          code: "INVALID_NUMERIC_VALUE",
          axis: contribution.axis,
          sourceId: contribution.sourceId,
          stage: contribution.stage,
          message: `Operator ${contribution.operator} requires a finite numeric value`,
        });
      }
    } else if (NO_VALUE_OPERATORS.has(contribution.operator)) {
      if (contribution.value !== undefined) {
        issues.push({
          code: "VALUE_NOT_ALLOWED",
          axis: contribution.axis,
          sourceId: contribution.sourceId,
          stage: contribution.stage,
          message: `Operator ${contribution.operator} does not accept a value`,
        });
      }
    } else if (STRING_OPERATORS.has(contribution.operator)) {
      if (typeof contribution.value !== "string" || contribution.value.length === 0) {
        issues.push({
          code: "INVALID_STRING_VALUE",
          axis: contribution.axis,
          sourceId: contribution.sourceId,
          stage: contribution.stage,
          message: `Operator ${contribution.operator} requires a non-empty string value`,
        });
      }
    } else if (CAPABILITY_OPERATORS.has(contribution.operator)) {
      const value = contribution.value;
      const valid =
        typeof value === "string" ||
        (Array.isArray(value) &&
          value.length > 0 &&
          value.every((entry) => typeof entry === "string" && entry.length > 0));
      if (!valid) {
        issues.push({
          code: "INVALID_CAPABILITY_VALUE",
          axis: contribution.axis,
          sourceId: contribution.sourceId,
          stage: contribution.stage,
          message: `Operator ${contribution.operator} requires one or more capability IDs`,
        });
      }
    }

    const groupKey = `${contribution.axis}\u0000${contribution.stage}`;
    const group = byAxisAndStage.get(groupKey);
    if (group === undefined) {
      byAxisAndStage.set(groupKey, [contribution]);
    } else {
      group.push(contribution);
    }
  }

  for (const group of byAxisAndStage.values()) {
    const first = group[0];
    if (first === undefined) continue;
    const definition = registry[first.axis];
    const stage = definition?.stages.find((candidate) => candidate.id === first.stage);
    if (stage === undefined) continue;

    if (stage.reducer === "SINGLETON" && group.length > 1) {
      issues.push({
        code: "SINGLETON_CONFLICT",
        axis: first.axis,
        stage: first.stage,
        message: `Axis ${first.axis}/${first.stage} received ${group.length} contributions but requires exactly zero or one`,
      });
    }

    const operators = new Set(group.map((contribution) => contribution.operator));
    if (operators.size > 1 && stage.reducer !== "PROHIBIT_WINS") {
      issues.push({
        code: "MIXED_STAGE_OPERATORS",
        axis: first.axis,
        stage: first.stage,
        message: `Axis ${first.axis}/${first.stage} received mixed operators: ${[...operators].join(", ")}`,
      });
    }
  }

  return issues;
}

function numericValue(contribution: RuleContribution): number {
  if (typeof contribution.value !== "number") {
    throw new Error(
      `Expected numeric value for ${contribution.axis}/${contribution.stage}/${contribution.sourceId}`,
    );
  }
  return contribution.value;
}

function assertAxisKind(
  definition: RuleAxisDefinition,
  expected: RuleAxisKind,
): void {
  if (definition.kind !== expected) {
    throw new Error(
      `Axis ${definition.id} is ${definition.kind}; expected ${expected}`,
    );
  }
}

function assertValidForAxis(
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): void {
  const registry: RuleAxisRegistry = { [definition.id]: definition };
  const issues = validateRuleContributions(contributions, registry);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
  for (const contribution of contributions) {
    if (contribution.axis !== definition.id) {
      throw new Error(
        `Contribution for ${contribution.axis} passed to reducer for ${definition.id}`,
      );
    }
  }
}

/**
 * Reduce contributions whose runtime eligibility conditions have already been
 * resolved by the owning subsystem. The reducer itself never executes arbitrary
 * predicates or callbacks.
 */
export function reduceScalarRule(
  baseValue: number,
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): number {
  assertAxisKind(definition, "SCALAR");
  assertValidForAxis(definition, contributions);

  let current = baseValue;
  for (const stage of definition.stages) {
    const group = contributions.filter(
      (contribution) => contribution.stage === stage.id,
    );
    if (group.length === 0) continue;
    const operator = group[0]?.operator;
    if (operator === undefined) continue;

    switch (stage.reducer) {
      case "SUM": {
        const sum = group.reduce(
          (total, contribution) => total + numericValue(contribution),
          0,
        );
        if (operator === "ADD_FLAT") {
          current += sum;
        } else if (operator === "ADD_PERCENT") {
          current *= 1 + sum / BASIS_POINTS_SCALE;
        } else {
          throw new Error(`SUM reducer cannot apply operator ${operator}`);
        }
        break;
      }
      case "PRODUCT": {
        if (operator !== "MULTIPLY") {
          throw new Error(`PRODUCT reducer cannot apply operator ${operator}`);
        }
        const factor = group.reduce(
          (product, contribution) =>
            product * (numericValue(contribution) / BASIS_POINTS_SCALE),
          1,
        );
        current *= factor;
        break;
      }
      case "SINGLETON": {
        const contribution = group[0];
        if (contribution === undefined) break;
        if (operator === "REPLACE_BASE" || operator === "FINAL_OVERRIDE") {
          current = numericValue(contribution);
        } else {
          throw new Error(`SINGLETON reducer cannot apply operator ${operator}`);
        }
        break;
      }
      case "ANY": {
        if (operator !== "HARD_ZERO") {
          throw new Error(`ANY reducer cannot apply operator ${operator}`);
        }
        current = 0;
        break;
      }
      case "MIN": {
        current = Math.min(current, ...group.map(numericValue));
        break;
      }
      case "MAX": {
        current = Math.max(current, ...group.map(numericValue));
        break;
      }
      default:
        throw new Error(
          `Reducer ${stage.reducer} is not valid for scalar axis ${definition.id}`,
        );
    }
  }

  return current;
}

export function reducePermissionRule(
  baseAllowed: boolean,
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): boolean {
  assertAxisKind(definition, "PERMISSION");
  assertValidForAxis(definition, contributions);

  let allowed = baseAllowed;
  for (const stage of definition.stages) {
    const group = contributions.filter(
      (contribution) => contribution.stage === stage.id,
    );
    if (group.length === 0) continue;
    if (stage.reducer !== "PROHIBIT_WINS") {
      throw new Error(
        `Permission axis ${definition.id} requires PROHIBIT_WINS reducer`,
      );
    }
    if (group.some((contribution) => contribution.operator === "PROHIBIT")) {
      allowed = false;
    } else if (group.some((contribution) => contribution.operator === "ALLOW")) {
      allowed = true;
    }
  }
  return allowed;
}

export function reduceCapRule(
  baseCap: number,
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): number {
  assertAxisKind(definition, "CAP");
  assertValidForAxis(definition, contributions);

  let cap = baseCap;
  for (const stage of definition.stages) {
    const group = contributions.filter(
      (contribution) => contribution.stage === stage.id,
    );
    if (group.length === 0) continue;
    const operator = group[0]?.operator;
    if (operator === undefined) continue;

    if (stage.reducer === "SUM" && operator === "ADD_CAP") {
      cap += group.reduce(
        (total, contribution) => total + numericValue(contribution),
        0,
      );
    } else if (stage.reducer === "MIN" && operator === "CAP_LIMIT") {
      cap = Math.min(cap, ...group.map(numericValue));
    } else if (stage.reducer === "MAX" && operator === "CAP_FLOOR") {
      cap = Math.max(cap, ...group.map(numericValue));
    } else {
      throw new Error(
        `Reducer/operator ${stage.reducer}/${operator} is not valid for cap axis ${definition.id}`,
      );
    }
  }
  return cap;
}

function capabilityIds(value: RuleValue | undefined): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }
  throw new Error("Expected capability ID or capability ID array");
}

export function reduceCapabilitySetRule(
  baseCapabilities: readonly string[],
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): readonly string[] {
  assertAxisKind(definition, "CAPABILITY_SET");
  assertValidForAxis(definition, contributions);

  let capabilities = new Set(baseCapabilities);
  for (const stage of definition.stages) {
    const group = contributions.filter(
      (contribution) => contribution.stage === stage.id,
    );
    if (group.length === 0) continue;

    if (stage.reducer === "UNION") {
      for (const contribution of group) {
        for (const capability of capabilityIds(contribution.value)) {
          capabilities.add(capability);
        }
      }
    } else if (stage.reducer === "DIFFERENCE") {
      for (const contribution of group) {
        for (const capability of capabilityIds(contribution.value)) {
          capabilities.delete(capability);
        }
      }
    } else if (stage.reducer === "SINGLETON") {
      const contribution = group[0];
      if (contribution !== undefined) {
        capabilities = new Set(capabilityIds(contribution.value));
      }
    } else {
      throw new Error(
        `Reducer ${stage.reducer} is not valid for capability axis ${definition.id}`,
      );
    }
  }

  return [...capabilities].sort(compareCanonicalStrings);
}

export function selectStructuralTransform(
  definition: RuleAxisDefinition,
  contributions: readonly RuleContribution[],
): string | undefined {
  assertAxisKind(definition, "STRUCTURAL");
  assertValidForAxis(definition, contributions);
  if (contributions.length === 0) return undefined;
  const contribution = contributions[0];
  if (
    contribution === undefined ||
    contribution.operator !== "STRUCTURAL_TRANSFORM" ||
    typeof contribution.value !== "string"
  ) {
    throw new Error(`Invalid structural transform for ${definition.id}`);
  }
  return contribution.value;
}

export interface StructurePressureFieldContribution {
  readonly fieldType: "FORT" | "COMMAND_POST";
  readonly component: string;
  /** Relative bonus magnitude in basis points, e.g. 3000 = +30%. */
  readonly bonusBp: number;
}

export interface PressureCompositionInput {
  readonly basePressure: number;
  /** Relative terrain contribution(s), summed within the terrain component. */
  readonly terrainPercentBp?: readonly number[];
  /** General/conditional rule contributions, summed within the rule component. */
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
    if (field.fieldType !== type) continue;
    if (field.bonusBp > strongest) strongest = field.bonusBp;
  }
  return strongest / BASIS_POINTS_SCALE;
}

/**
 * Component-aware land-pressure composition. Same-type structure fields choose
 * the strongest applicable effective field; distinct Fort/Command fields then
 * use the canonical complement reducer before the final pressure is materialized.
 */
export function composePressure(input: PressureCompositionInput): number {
  const suppressed = input.suppressedComponents ?? new Set<string>();
  const terrainBp = (input.terrainPercentBp ?? []).reduce(
    (sum, value) => sum + value,
    0,
  );
  const ruleBp = (input.rulePercentBp ?? []).reduce(
    (sum, value) => sum + value,
    0,
  );

  const eligibleFields = (input.structureFields ?? []).filter(
    (field) => !suppressed.has(field.component),
  );
  const fortBonus = strongestFieldBonus(eligibleFields, "FORT");
  const commandBonus = strongestFieldBonus(eligibleFields, "COMMAND_POST");
  const combinedStructureBonus =
    1 - (1 - fortBonus) * (1 - commandBonus);

  return (
    input.basePressure *
    (1 + terrainBp / BASIS_POINTS_SCALE) *
    (1 + ruleBp / BASIS_POINTS_SCALE) *
    (1 + combinedStructureBonus)
  );
}
