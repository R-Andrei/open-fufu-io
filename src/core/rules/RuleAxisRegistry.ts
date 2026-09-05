import type {
  RuleAxisDefinition,
  RuleAxisRegistry,
  RuleScopeKind,
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
  "SCENARIO",
  "SITUATIONAL",
] as const satisfies readonly RuleSourceKind[];

const ORIGIN_ECHO_SOURCES = [
  "BASE_RULESET",
  "RULESET_TRANSFORM",
  "ORIGIN",
  "ECHO",
  "SCENARIO",
] as const satisfies readonly RuleSourceKind[];

const ORIGIN_RULESET_SOURCES = [
  "BASE_RULESET",
  "RULESET_TRANSFORM",
  "ORIGIN",
  "SCENARIO",
] as const satisfies readonly RuleSourceKind[];

const originPercentStage: RuleStageDefinition = {
  id: "ORIGIN_PERCENT",
  reducer: "SUM",
  allowedOperators: ["ADD_PERCENT"],
};
const originScalarStage: RuleStageDefinition = {
  id: "ORIGIN_SCALAR",
  reducer: "PRODUCT",
  allowedOperators: ["MULTIPLY"],
  after: ["ORIGIN_PERCENT"],
};
const echoPercentStage: RuleStageDefinition = {
  id: "ECHO_PERCENT",
  reducer: "SUM",
  allowedOperators: ["ADD_PERCENT"],
  after: ["ORIGIN_SCALAR"],
};
const echoScalarStage: RuleStageDefinition = {
  id: "ECHO_SCALAR",
  reducer: "PRODUCT",
  allowedOperators: ["MULTIPLY"],
  after: ["ECHO_PERCENT"],
};

function standardScalarAxis(
  id: string,
  unit: RuleAxisDefinition["unit"],
  scopeKind: RuleScopeKind,
  options: {
    readonly hardZero?: boolean;
    readonly echo?: boolean;
    readonly baseReplacement?: boolean;
    readonly finalOverride?: boolean;
    readonly contextual?: boolean;
  } = {},
): RuleAxisDefinition {
  const echo = options.echo ?? true;
  const stages: RuleStageDefinition[] = [];
  if (options.baseReplacement) {
    stages.push({
      id: "BASE_REPLACEMENT",
      reducer: "SINGLETON",
      allowedOperators: ["REPLACE_BASE"],
    });
  }
  stages.push(originPercentStage, originScalarStage);
  if (echo) stages.push(echoPercentStage, echoScalarStage);
  if (options.contextual) {
    stages.push(
      {
        id: "CONTEXTUAL_PERCENT",
        reducer: "SUM",
        allowedOperators: ["ADD_PERCENT"],
        after: [echo ? "ECHO_SCALAR" : "ORIGIN_SCALAR"],
      },
      {
        id: "CONTEXTUAL_SCALAR",
        reducer: "PRODUCT",
        allowedOperators: ["MULTIPLY"],
        after: ["CONTEXTUAL_PERCENT"],
      },
    );
  }
  if (options.finalOverride) {
    stages.push({
      id: "FINAL_OVERRIDE",
      reducer: "SINGLETON",
      allowedOperators: ["FINAL_OVERRIDE"],
      after: [
        options.contextual
          ? "CONTEXTUAL_SCALAR"
          : echo
            ? "ECHO_SCALAR"
            : "ORIGIN_SCALAR",
      ],
    });
  }
  if (options.hardZero) {
    stages.push({
      id: "TERMINAL",
      reducer: "ANY",
      allowedOperators: ["HARD_ZERO"],
      after: [
        options.finalOverride
          ? "FINAL_OVERRIDE"
          : options.contextual
            ? "CONTEXTUAL_SCALAR"
            : echo
              ? "ECHO_SCALAR"
              : "ORIGIN_SCALAR",
      ],
    });
  }
  return {
    id,
    kind: "SCALAR",
    unit,
    scopeKind,
    stages,
    // Contextual stages can legitimately be authored by terrain, structure,
    // unit-profile, scenario, and situational provenance. Fine-grained stage
    // legality remains enforced by RULE_STAGE_ALLOWED_SOURCE_KINDS.
    allowedSourceKinds: options.contextual
      ? STATIC_RULE_SOURCES
      : echo
        ? ORIGIN_ECHO_SOURCES
        : ORIGIN_RULESET_SOURCES,
  };
}

function permissionAxis(
  id: string,
  scopeKind: RuleScopeKind,
): RuleAxisDefinition {
  return {
    id,
    kind: "PERMISSION",
    unit: "BOOLEAN",
    scopeKind,
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

function capAxis(
  id: string,
  scopeKind: RuleScopeKind,
  options: { readonly additive?: boolean } = {},
): RuleAxisDefinition {
  return {
    id,
    kind: "CAP",
    unit: "COUNT",
    scopeKind,
    stages: [
      options.additive
        ? {
            id: "ORIGIN_CAP",
            reducer: "SUM",
            allowedOperators: ["ADD_CAP"],
          }
        : {
            id: "ORIGIN_CAP",
            reducer: "MIN",
            allowedOperators: ["CAP_LIMIT"],
          },
    ],
    allowedSourceKinds: ORIGIN_RULESET_SOURCES,
  };
}

function componentSuppressionAxis(
  id: string,
  scopeKind: RuleScopeKind,
): RuleAxisDefinition {
  return {
    id,
    kind: "COMPONENT_SET",
    unit: "COMPONENT_SET",
    scopeKind,
    stages: [
      {
        id: "COMPONENT_SUPPRESSION",
        reducer: "UNION",
        allowedOperators: ["SUPPRESS_COMPONENT"],
      },
    ],
    allowedSourceKinds: STATIC_RULE_SOURCES,
  };
}

function structuralAxis(
  id: string,
  scopeKind: RuleScopeKind,
): RuleAxisDefinition {
  return {
    id,
    kind: "STRUCTURAL",
    unit: "PROFILE_ID",
    scopeKind,
    stages: [
      {
        id: "STRUCTURAL_PROFILE",
        reducer: "SINGLETON",
        allowedOperators: ["STRUCTURAL_TRANSFORM"],
      },
    ],
    allowedSourceKinds: ORIGIN_RULESET_SOURCES,
  };
}

function capabilityAxis(
  id: string,
  scopeKind: RuleScopeKind,
): RuleAxisDefinition {
  return {
    id,
    kind: "CAPABILITY_SET",
    unit: "CAPABILITY_SET",
    scopeKind,
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
  };
}

export const RULE_AXIS_REGISTRY = {
  INITIAL_TERRITORY_QUOTA: standardScalarAxis(
    "INITIAL_TERRITORY_QUOTA",
    "COUNT",
    "GLOBAL",
    { echo: false },
  ),
  POPULATION_GROWTH_UTILIZATION_PROFILE: structuralAxis(
    "POPULATION_GROWTH_UTILIZATION_PROFILE",
    "GLOBAL",
  ),
  POPULATION_GROWTH: standardScalarAxis(
    "POPULATION_GROWTH",
    "RATIO",
    "GLOBAL",
  ),
  STARTING_POPULATION_FRACTION: standardScalarAxis(
    "STARTING_POPULATION_FRACTION",
    "RATIO",
    "GLOBAL",
  ),
  NEUTRAL_SETTLEMENT_PROGRESS: standardScalarAxis(
    "NEUTRAL_SETTLEMENT_PROGRESS",
    "RATIO",
    "GLOBAL",
    { contextual: true },
  ),
  NEUTRAL_SETTLEMENT_POPULATION_COST: standardScalarAxis(
    "NEUTRAL_SETTLEMENT_POPULATION_COST",
    "POPULATION",
    "GLOBAL",
    { baseReplacement: true, echo: false },
  ),
  ACQUISITION_PROGRESS: standardScalarAxis(
    "ACQUISITION_PROGRESS",
    "RATIO",
    "GLOBAL",
    { contextual: true },
  ),
  ACQUISITION_SUPPRESSED_COMPONENTS: componentSuppressionAxis(
    "ACQUISITION_SUPPRESSED_COMPONENTS",
    "GLOBAL",
  ),
  GLOBAL_OFFENSIVE_PRESSURE: standardScalarAxis(
    "GLOBAL_OFFENSIVE_PRESSURE",
    "RATIO",
    "GLOBAL",
    { contextual: true },
  ),
  GLOBAL_DEFENSIVE_PRESSURE: standardScalarAxis(
    "GLOBAL_DEFENSIVE_PRESSURE",
    "RATIO",
    "GLOBAL",
    { contextual: true },
  ),
  LAND_PRESSURE_SUPPRESSED_COMPONENTS: componentSuppressionAxis(
    "LAND_PRESSURE_SUPPRESSED_COMPONENTS",
    "GLOBAL",
  ),
  COUNTER_RESPONSE_EFFECTIVENESS: standardScalarAxis(
    "COUNTER_RESPONSE_EFFECTIVENESS",
    "RATIO",
    "GLOBAL",
    { finalOverride: true },
  ),

  TERRAIN_OFFENSIVE_PRESSURE: standardScalarAxis(
    "TERRAIN_OFFENSIVE_PRESSURE",
    "RATIO",
    "TERRAIN",
  ),
  TERRAIN_DEFENSIVE_PRESSURE: standardScalarAxis(
    "TERRAIN_DEFENSIVE_PRESSURE",
    "RATIO",
    "TERRAIN",
  ),
  TERRAIN_ACQUISITION_SPEED: standardScalarAxis(
    "TERRAIN_ACQUISITION_SPEED",
    "RATIO",
    "TERRAIN",
  ),
  TERRAIN_POPULATION_BEARING_PERMISSION: permissionAxis(
    "TERRAIN_POPULATION_BEARING_PERMISSION",
    "TERRAIN",
  ),
  FALLOUT_ACQUISITION_PERMISSION: permissionAxis(
    "FALLOUT_ACQUISITION_PERMISSION",
    "GLOBAL",
  ),

  FFY_EVENT_YIELD: standardScalarAxis(
    "FFY_EVENT_YIELD",
    "FFY",
    "FFY_FAMILY",
    { hardZero: true },
  ),
  EXTERNAL_TRADE_WARTIME_MULTIPLIER: standardScalarAxis(
    "EXTERNAL_TRADE_WARTIME_MULTIPLIER",
    "RATIO",
    "GLOBAL",
    { baseReplacement: true, echo: false },
  ),

  STRUCTURE_BUILD_COST: standardScalarAxis(
    "STRUCTURE_BUILD_COST",
    "FFY",
    "STRUCTURE",
    { hardZero: true },
  ),
  STRUCTURE_UPGRADE_COST: standardScalarAxis(
    "STRUCTURE_UPGRADE_COST",
    "FFY",
    "STRUCTURE",
  ),
  STRUCTURE_CONSTRUCTION_TIME: standardScalarAxis(
    "STRUCTURE_CONSTRUCTION_TIME",
    "TICKS",
    "STRUCTURE",
  ),
  STRUCTURE_BUILD_PERMISSION: permissionAxis(
    "STRUCTURE_BUILD_PERMISSION",
    "STRUCTURE",
  ),
  STRUCTURE_UPGRADE_PERMISSION: permissionAxis(
    "STRUCTURE_UPGRADE_PERMISSION",
    "STRUCTURE",
  ),
  STRUCTURE_OWNERSHIP_CAP: capAxis(
    "STRUCTURE_OWNERSHIP_CAP",
    "STRUCTURE",
  ),
  CITY_GROWTH_CONTRIBUTION: standardScalarAxis(
    "CITY_GROWTH_CONTRIBUTION",
    "RATIO",
    "STRUCTURE",
  ),
  STRUCTURE_FIELD_COVERAGE_AREA: standardScalarAxis(
    "STRUCTURE_FIELD_COVERAGE_AREA",
    "AREA",
    "STRUCTURE",
  ),
  STRUCTURE_PRESSURE_MAGNITUDE: standardScalarAxis(
    "STRUCTURE_PRESSURE_MAGNITUDE",
    "BASIS_POINTS",
    "STRUCTURE",
    { hardZero: true },
  ),
  STRUCTURE_REPAIR_RADIUS: standardScalarAxis(
    "STRUCTURE_REPAIR_RADIUS",
    "CELLS",
    "STRUCTURE",
  ),
  STRUCTURE_REPAIR_RATE: standardScalarAxis(
    "STRUCTURE_REPAIR_RATE",
    "HEALTH_PER_SECOND",
    "STRUCTURE",
  ),
  STRUCTURE_OBSERVATION_RADIUS: standardScalarAxis(
    "STRUCTURE_OBSERVATION_RADIUS",
    "CELLS",
    "STRUCTURE",
  ),
  STRUCTURE_INTERCEPTION_RANGE: standardScalarAxis(
    "STRUCTURE_INTERCEPTION_RANGE",
    "CELLS",
    "STRUCTURE",
  ),
  STRUCTURE_RECHARGE_TIME: standardScalarAxis(
    "STRUCTURE_RECHARGE_TIME",
    "TICKS",
    "STRUCTURE",
  ),
  STRUCTURE_CHARGE_CAPACITY: capAxis(
    "STRUCTURE_CHARGE_CAPACITY",
    "STRUCTURE",
  ),
  STRUCTURE_EFFECT_PROFILE: structuralAxis(
    "STRUCTURE_EFFECT_PROFILE",
    "STRUCTURE",
  ),
  STRUCTURE_ATTACK_CAPABILITIES: capabilityAxis(
    "STRUCTURE_ATTACK_CAPABILITIES",
    "STRUCTURE",
  ),

  UNIT_PURCHASE_FFY_COST: standardScalarAxis(
    "UNIT_PURCHASE_FFY_COST",
    "FFY",
    "UNIT",
    { hardZero: true },
  ),
  UNIT_PURCHASE_POPULATION_COST: standardScalarAxis(
    "UNIT_PURCHASE_POPULATION_COST",
    "POPULATION",
    "UNIT",
    { baseReplacement: true, echo: false },
  ),
  UNIT_MOVEMENT_SPEED: standardScalarAxis(
    "UNIT_MOVEMENT_SPEED",
    "CELLS_PER_SECOND",
    "UNIT",
  ),
  UNIT_ATTACK_RANGE: standardScalarAxis(
    "UNIT_ATTACK_RANGE",
    "CELLS",
    "UNIT",
  ),
  UNIT_DAMAGE: standardScalarAxis("UNIT_DAMAGE", "DAMAGE", "UNIT"),
  UNIT_MAX_HEALTH: standardScalarAxis(
    "UNIT_MAX_HEALTH",
    "HEALTH_POINTS",
    "UNIT",
  ),
  UNIT_BUILD_PERMISSION: permissionAxis("UNIT_BUILD_PERMISSION", "UNIT"),
  UNIT_OWNERSHIP_CAP: capAxis("UNIT_OWNERSHIP_CAP", "UNIT"),
  UNIT_MAX_RANK: capAxis("UNIT_MAX_RANK", "UNIT", { additive: true }),
  UNIT_CHASSIS_PROFILE: structuralAxis("UNIT_CHASSIS_PROFILE", "UNIT"),
  UNIT_ATTACK_CAPABILITIES: capabilityAxis(
    "UNIT_ATTACK_CAPABILITIES",
    "UNIT",
  ),

  TRANSPORT_EMBARK_COST: {
    id: "TRANSPORT_EMBARK_COST",
    kind: "SCALAR",
    unit: "FFY",
    scopeKind: "GLOBAL",
    stages: [
      {
        id: "ORIGIN_FLAT",
        reducer: "SUM",
        allowedOperators: ["ADD_FLAT"],
      },
    ],
    allowedSourceKinds: ORIGIN_RULESET_SOURCES,
  },
  TRANSPORT_LANDING_SURVIVAL_FRACTION: standardScalarAxis(
    "TRANSPORT_LANDING_SURVIVAL_FRACTION",
    "RATIO",
    "GLOBAL",
    { baseReplacement: true, echo: false },
  ),

  WEAPON_PROJECTILE_SPEED: standardScalarAxis(
    "WEAPON_PROJECTILE_SPEED",
    "CELLS_PER_SECOND",
    "WEAPON",
  ),
  WEAPON_PURCHASE_FFY_COST: standardScalarAxis(
    "WEAPON_PURCHASE_FFY_COST",
    "FFY",
    "WEAPON",
  ),
  WEAPON_BLAST_AREA: standardScalarAxis(
    "WEAPON_BLAST_AREA",
    "AREA",
    "WEAPON",
  ),
  WEAPON_USE_PERMISSION: permissionAxis("WEAPON_USE_PERMISSION", "WEAPON"),

  SPAWN_PROFILE: structuralAxis("SPAWN_PROFILE", "GLOBAL"),
  SPAWN_FOOTPRINT_PROFILE: structuralAxis(
    "SPAWN_FOOTPRINT_PROFILE",
    "GLOBAL",
  ),
} as const satisfies RuleAxisRegistry;

export type RuleAxisId = keyof typeof RULE_AXIS_REGISTRY;

export function ruleAxis(id: RuleAxisId): RuleAxisDefinition {
  return RULE_AXIS_REGISTRY[id];
}
