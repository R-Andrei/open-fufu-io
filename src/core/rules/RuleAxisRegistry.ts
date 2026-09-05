import {
  RuleAxisDefinition,
  RuleAxisRegistry,
  RuleSourceKind,
  RuleStageDefinition,
} from "./RuleComposition";

const STATIC_RULE_SOURCES = [
  "BASE_RULESET",
  "RULESET_TRANSFORM",
  "ORIGIN",
  "ECHO",
  "TERRAIN",
  "STRUCTURE",
  "UNIT_PROFILE",
  "SITUATIONAL",
] as const satisfies readonly RuleSourceKind[];

const ORIGIN_ECHO_SOURCES = [
  "BASE_RULESET",
  "RULESET_TRANSFORM",
  "ORIGIN",
  "ECHO",
] as const satisfies readonly RuleSourceKind[];

const ORIGIN_ONLY_SOURCES = [
  "BASE_RULESET",
  "RULESET_TRANSFORM",
  "ORIGIN",
] as const satisfies readonly RuleSourceKind[];

const originPercentStage: RuleStageDefinition = {
  id: "ORIGIN_PERCENT",
  reducer: "SUM",
  allowedOperators: ["ADD_PERCENT"],
};

const echoPercentStage: RuleStageDefinition = {
  id: "ECHO_PERCENT",
  reducer: "SUM",
  allowedOperators: ["ADD_PERCENT"],
  after: ["ORIGIN_PERCENT"],
};

const terminalHardZeroStage: RuleStageDefinition = {
  id: "TERMINAL",
  reducer: "ANY",
  allowedOperators: ["HARD_ZERO"],
};

function percentScalarAxis(
  id: string,
  unit: RuleAxisDefinition["unit"],
  options: { readonly hardZero?: boolean; readonly echo?: boolean } = {},
): RuleAxisDefinition {
  const echo = options.echo ?? true;
  const hardZero = options.hardZero ?? false;
  const stages: RuleStageDefinition[] = [originPercentStage];
  if (echo) stages.push(echoPercentStage);
  if (hardZero) {
    stages.push({
      ...terminalHardZeroStage,
      after: [echo ? "ECHO_PERCENT" : "ORIGIN_PERCENT"],
    });
  }
  return {
    id,
    kind: "SCALAR",
    unit,
    stages,
    allowedSourceKinds: echo ? ORIGIN_ECHO_SOURCES : ORIGIN_ONLY_SOURCES,
  };
}

function hardPermissionAxis(id: string): RuleAxisDefinition {
  return {
    id,
    kind: "PERMISSION",
    unit: "BOOLEAN",
    stages: [
      {
        id: "PERMISSION",
        reducer: "PROHIBIT_WINS",
        allowedOperators: ["ALLOW", "PROHIBIT"],
      },
    ],
    allowedSourceKinds: STATIC_RULE_SOURCES,
  };
}

export const RULE_AXIS_REGISTRY = {
  FORT_COVERAGE_AREA: percentScalarAxis("FORT_COVERAGE_AREA", "AREA"),
  FORT_DEFENSIVE_PRESSURE: percentScalarAxis(
    "FORT_DEFENSIVE_PRESSURE",
    "BASIS_POINTS",
    { hardZero: true },
  ),
  FORT_BUILD_COST: percentScalarAxis("FORT_BUILD_COST", "FFY"),

  WARSHIP_NAVAL_GUN_RANGE: percentScalarAxis(
    "WARSHIP_NAVAL_GUN_RANGE",
    "CELLS",
  ),
  WARSHIP_MOVEMENT_SPEED: percentScalarAxis(
    "WARSHIP_MOVEMENT_SPEED",
    "CELLS_PER_SECOND",
  ),
  WARSHIP_DAMAGE: percentScalarAxis("WARSHIP_DAMAGE", "DAMAGE"),
  WARSHIP_PURCHASE_FFY_COST: {
    id: "WARSHIP_PURCHASE_FFY_COST",
    kind: "SCALAR",
    unit: "FFY",
    stages: [
      originPercentStage,
      echoPercentStage,
      {
        id: "TERMINAL",
        reducer: "ANY",
        allowedOperators: ["HARD_ZERO"],
        after: ["ECHO_PERCENT"],
      },
    ],
    allowedSourceKinds: ORIGIN_ECHO_SOURCES,
  },
  WARSHIP_PURCHASE_POPULATION_COST: {
    id: "WARSHIP_PURCHASE_POPULATION_COST",
    kind: "SCALAR",
    unit: "POPULATION",
    stages: [
      {
        id: "BASE_REPLACEMENT",
        reducer: "SINGLETON",
        allowedOperators: ["REPLACE_BASE"],
      },
    ],
    allowedSourceKinds: ORIGIN_ONLY_SOURCES,
  },
  WARSHIP_BUILD_PERMISSION: hardPermissionAxis("WARSHIP_BUILD_PERMISSION"),
  FACTORY_BUILD_PERMISSION: hardPermissionAxis("FACTORY_BUILD_PERMISSION"),
  FALLOUT_ACQUISITION_PERMISSION: hardPermissionAxis(
    "FALLOUT_ACQUISITION_PERMISSION",
  ),
  TUNDRA_STRUCTURE_BUILD_PERMISSION: hardPermissionAxis(
    "TUNDRA_STRUCTURE_BUILD_PERMISSION",
  ),
  WARSHIP_OWNERSHIP_CAP: {
    id: "WARSHIP_OWNERSHIP_CAP",
    kind: "CAP",
    unit: "COUNT",
    stages: [
      {
        id: "ORIGIN_CAP",
        reducer: "MIN",
        allowedOperators: ["CAP_LIMIT"],
      },
    ],
    allowedSourceKinds: ORIGIN_ONLY_SOURCES,
  },

  TRANSPORT_EMBARK_COST: {
    id: "TRANSPORT_EMBARK_COST",
    kind: "SCALAR",
    unit: "FFY",
    stages: [
      {
        id: "ORIGIN_FLAT",
        reducer: "SUM",
        allowedOperators: ["ADD_FLAT"],
      },
    ],
    allowedSourceKinds: ORIGIN_ONLY_SOURCES,
  },

  FFY_EVENT_YIELD: {
    id: "FFY_EVENT_YIELD",
    kind: "SCALAR",
    unit: "FFY",
    stages: [
      originPercentStage,
      echoPercentStage,
      {
        id: "TERMINAL",
        reducer: "ANY",
        allowedOperators: ["HARD_ZERO"],
        after: ["ECHO_PERCENT"],
      },
    ],
    allowedSourceKinds: STATIC_RULE_SOURCES,
  },

  COUNTER_RESPONSE_EFFECTIVENESS: {
    id: "COUNTER_RESPONSE_EFFECTIVENESS",
    kind: "SCALAR",
    unit: "RATIO",
    stages: [
      originPercentStage,
      echoPercentStage,
      {
        id: "FINAL_OVERRIDE",
        reducer: "SINGLETON",
        allowedOperators: ["FINAL_OVERRIDE"],
        after: ["ECHO_PERCENT"],
      },
    ],
    allowedSourceKinds: ORIGIN_ECHO_SOURCES,
  },

  TANK_CHASSIS_PROFILE: {
    id: "TANK_CHASSIS_PROFILE",
    kind: "STRUCTURAL",
    unit: "PROFILE_ID",
    stages: [
      {
        id: "STRUCTURAL_PROFILE",
        reducer: "SINGLETON",
        allowedOperators: ["STRUCTURAL_TRANSFORM"],
      },
    ],
    allowedSourceKinds: ORIGIN_ONLY_SOURCES,
  },

  WARSHIP_ATTACK_CAPABILITIES: {
    id: "WARSHIP_ATTACK_CAPABILITIES",
    kind: "CAPABILITY_SET",
    unit: "CAPABILITY_SET",
    stages: [
      {
        id: "CAPABILITY_REPLACE",
        reducer: "SINGLETON",
        allowedOperators: ["REPLACE_CAPABILITIES"],
      },
      {
        id: "CAPABILITY_ADD",
        reducer: "UNION",
        allowedOperators: ["ADD_CAPABILITY"],
        after: ["CAPABILITY_REPLACE"],
      },
      {
        id: "CAPABILITY_REMOVE",
        reducer: "DIFFERENCE",
        allowedOperators: ["REMOVE_CAPABILITY"],
        after: ["CAPABILITY_ADD"],
      },
    ],
    allowedSourceKinds: STATIC_RULE_SOURCES,
  },
} as const satisfies RuleAxisRegistry;

export type RuleAxisId = keyof typeof RULE_AXIS_REGISTRY;

export function ruleAxis(id: RuleAxisId): RuleAxisDefinition {
  return RULE_AXIS_REGISTRY[id];
}
