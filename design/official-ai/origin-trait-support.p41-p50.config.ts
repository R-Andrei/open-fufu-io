// Open Fufu Official-AI Origin trait support configuration, P41-P50.
//
// DESIGN-TIME SOURCE OF TRUTH.
// Mechanical values remain authoritative in the Origin/game rules. This file
// contains only AI support metadata and registered support-hook identities.

export const OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT_P41_P50 = [
  {
    traitId: "P41",
    mode: "EXTENDED",
    themes: ["INFRASTRUCTURE", "GROWTH", "ECONOMIC_COMPOUNDING", "SPECIALIZATION"],
    affordances: ["BUILD_HIGH_LEVEL_INFRASTRUCTURE", "SCALE_GROWTH"],
    cautions: ["HIGH_UPFRONT_COST"],
    synergyTags: ["CITY_PURCHASE", "POPULATION_GROWTH", "ECONOMY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "P41_LEVEL5_CITY_PURCHASE_VALUE",
      },
      {
        evaluator: "FORECAST",
        hookId: "P41_IMMEDIATE_CITY_LEVEL_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "ENRICH_INPUT",
        hookId: "P41_LEVEL5_CITY_BUILD_RESULT_SEMANTICS",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P41_LEVEL5_CITY_BUILD_VALUE",
      },
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P41_LEVEL5_CITY_LIQUIDITY_VALUE",
      },
    ],
  },
  {
    traitId: "P42",
    mode: "EXTENDED",
    themes: ["NAVAL_PROJECTION", "SACRIFICE", "SPECIALIZATION"],
    affordances: ["PROJECT_FROM_SEA"],
    cautions: ["EXPENSIVE_FAILURE"],
    synergyTags: ["WARSHIP", "NAVAL", "ECONOMY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "P42_POPULATION_FUNDED_WARSHIP_ECONOMY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P42_PERMANENT_POPULATION_COST_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "SPENDING",
        phase: "ENRICH_INPUT",
        hookId: "P42_POPULATION_PURCHASE_SEMANTICS",
      },
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P42_POPULATION_VS_WARSHIP_VALUE",
      },
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P42_SHORT_RANGE_POPULATION_WARSHIP_VALUE",
      },
    ],
  },
  {
    traitId: "P43",
    mode: "EXTENDED",
    themes: ["SIEGE", "DECISIVE_FORCE", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    affordances: ["FIGHT_FROM_RANGE", "SIEGE_STATIC_POSITIONS", "CREATE_BREAKTHROUGH", "FORCE_ENEMY_RESPONSE"],
    cautions: ["HIGH_UPFRONT_COST", "LOW_MOBILITY", "LONG_RELOAD", "CLOSE_RANGE_VULNERABILITY", "EXPENSIVE_FAILURE"],
    synergyTags: ["ARMOR", "POPULATION_ATTACK", "LONG_RANGE_ATTACK", "HIGH_ALPHA"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "P43_HEAVY_ARTILLERY_RANGE_OPPORTUNITY",
      },
      {
        evaluator: "THREAT",
        hookId: "P43_HEAVY_ARTILLERY_CLOSE_THREATS",
      },
      {
        evaluator: "FORECAST",
        hookId: "P43_HEAVY_ARTILLERY_RELOAD_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "ARMOR",
        phase: "ENRICH_INPUT",
        hookId: "P43_HEAVY_ARTILLERY_UNIT_SEMANTICS",
      },
      {
        domain: "ARMOR",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P43_HEAVY_ARTILLERY_STANDOFF_PLANS",
      },
      {
        domain: "ARMOR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P43_HEAVY_ARTILLERY_POSITION_VALUE",
      },
    ],
  },
  {
    traitId: "P44",
    mode: "EXTENDED",
    themes: ["ATTRITION", "TERRITORIAL_SHAPING", "POSITIONAL_CONTROL", "SIEGE"],
    affordances: ["DENY_AREA", "SHAPE_TERRITORY", "CUT_CONNECTIVITY", "FORCE_ENEMY_RESPONSE"],
    cautions: ["SELF_GEOMETRY_RISK"],
    synergyTags: ["ARMOR", "POPULATION_ATTACK", "FALLOUT", "TERRITORY_NEUTRALIZATION"],
    signalSupport: [
      {
        evaluator: "TERRITORY",
        hookId: "P44_RADIOACTIVE_TERRITORY_VALUE",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "P44_RADIOACTIVE_TARGET_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P44_RADIOACTIVE_TERRITORY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "ARMOR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P44_RADIOACTIVE_POPULATION_ATTACK_VALUE",
      },
    ],
  },
  {
    traitId: "P45",
    mode: "EXTENDED",
    themes: ["INFORMATION", "POSITIONAL_CONTROL", "SPECIALIZATION", "FORCE_PRESERVATION"],
    affordances: ["GAIN_INFORMATION_ADVANTAGE", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "OBSERVATION", "DEFENSE"],
    signalSupport: [
      {
        evaluator: "TERRITORY",
        hookId: "P45_FOREST_CONCEALMENT_POSITION_VALUE",
      },
      {
        evaluator: "THREAT",
        hookId: "P45_CONCEALED_STATE_EXPOSURE_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "P45_FOREST_INFORMATION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P45_CONCEALED_FOREST_DEFENSE_VALUE",
      },
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P45_CONCEALED_FOREST_STAGING_VALUE",
      },
    ],
  },
  {
    traitId: "P46",
    mode: "EXTENDED",
    themes: ["INFRASTRUCTURE", "POSITIONAL_CONTROL", "SPECIALIZATION", "FORTIFICATION"],
    affordances: ["EXPLOIT_TERRAIN"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION"],
    signalSupport: [
      {
        evaluator: "TERRITORY",
        hookId: "P46_TUNDRA_STRUCTURE_POSITION_VALUE",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "P46_TUNDRA_BUILD_OPPORTUNITY",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P46_TUNDRA_STRUCTURE_CANDIDATES",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P46_TUNDRA_STRUCTURE_VALUE",
      },
    ],
  },
  {
    traitId: "P47",
    mode: "EXTENDED",
    themes: ["ATTRITION", "SACRIFICE", "POSITIONAL_CONTROL"],
    affordances: ["TRADE_GROUND_FOR_CASUALTIES", "LURE_OVEREXTENSION", "DENY_AREA"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "DEFENSE"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "P47_MARSH_CAPTURE_ATTRITION_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P47_MARSH_CAPTURE_POPULATION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P47_MARSH_ATTRITION_DEFENSE_VALUE",
      },
      {
        domain: "RETREAT",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P47_MARSH_TERRITORY_TRADE_VALUE",
      },
    ],
  },
  {
    traitId: "P48",
    mode: "EXTENDED",
    themes: ["GROWTH", "EXPANSION", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    affordances: ["EXPLOIT_TERRAIN", "SCALE_GROWTH"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "POPULATION_GROWTH"],
    signalSupport: [
      {
        evaluator: "TERRITORY",
        hookId: "P48_SHALLOW_WATER_CAPACITY_VALUE",
      },
      {
        evaluator: "ECONOMY",
        hookId: "P48_SHALLOW_WATER_POPULATION_ECONOMY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P48_SHALLOW_WATER_CAPACITY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "EXPANSION",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P48_SHALLOW_WATER_EXPANSION_VALUE",
      },
    ],
  },
  {
    traitId: "P49",
    mode: "EXTENDED",
    themes: ["INFORMATION", "POSITIONAL_CONTROL", "FORTIFICATION", "SPECIALIZATION"],
    affordances: ["GAIN_INFORMATION_ADVANTAGE", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["OBSERVATION", "DEFENSE"],
    signalSupport: [
      {
        evaluator: "THREAT",
        hookId: "P49_COUNTERINTELLIGENCE_COVERAGE_THREAT",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "P49_BLACKOUT_POSITION_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P49_BLACKOUT_INFORMATION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "OBSERVATION",
        phase: "ENRICH_INPUT",
        hookId: "P49_COUNTERINTELLIGENCE_POST_SEMANTICS",
      },
      {
        domain: "OBSERVATION",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P49_BLACKOUT_PLACEMENT_CANDIDATES",
      },
      {
        domain: "OBSERVATION",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P49_BLACKOUT_PLACEMENT_VALUE",
      },
    ],
  },
  {
    traitId: "P50",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "DECISIVE_FORCE", "POSITIONAL_CONTROL", "INFRASTRUCTURE"],
    affordances: ["HOLD_GROUND", "CREATE_BREAKTHROUGH"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["DEFENSE", "OFFENSE"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "P50_FORT_GENERAL_SUPPORT_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P50_FORT_GENERAL_SUPPORT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P50_FORT_AREA_OFFENSE_VALUE",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P50_GENERAL_SUPPORT_FORT_PLACEMENT_VALUE",
      },
    ],
  },
] as const;
