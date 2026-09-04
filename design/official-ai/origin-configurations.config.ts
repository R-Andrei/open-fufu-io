// Open Fufu Official-AI named-Origin configuration.
//
// DESIGN-TIME SOURCE OF TRUTH.
// `traitIds` mirror OFFICIAL_ORIGINS.md and must validate exactly against that
// content registry. `requiredCombinationSupportIds` asserts which reusable
// combination-support entries must compose for each Origin. `profileAssertions`
// are intentionally partial golden assertions, not a duplicate full derived
// OriginStrategicProfile. `originSpecificSupport` remains null unless a named
// Origin needs support that cannot be generalized to its trait combination.
//
// New accepted Origin batches are appended to this file. Do not create batch
// shards solely for incremental authoring.

export const OFFICIAL_AI_ORIGIN_CONFIGURATIONS = [
  {
    originId: "O08",
    traitIds: ["P06", "P09"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["TRADE", "FORTIFICATION", "INFRASTRUCTURE"],
      requiredAffordances: ["SCALE_TRADE", "HOLD_GROUND"],
      requiredCautions: [],
    },
    validationFocus: [
      "FAST_TRADE_THROUGHPUT",
      "IMPROVED_FORT_INVESTMENT",
      "NO_FALSE_SPECIALIST_REQUIREMENT",
    ],
  },
  {
    originId: "O09",
    traitIds: ["P01", "P06", "N01"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["EXPANSION", "TRADE", "POSITIONAL_CONTROL"],
      requiredAffordances: ["SCALE_TRADE"],
      requiredCautions: [],
    },
    validationFocus: [
      "LARGER_INITIAL_TERRITORY_SPAWN",
      "FAST_TRADE_THROUGHPUT",
      "REDUCED_CITY_GROWTH_FORECAST",
    ],
  },
  {
    originId: "O10",
    traitIds: ["P09", "P13", "P15", "N02"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["FORTIFICATION", "POSITIONAL_CONTROL", "SPECIALIZATION"],
      requiredAffordances: ["HOLD_GROUND", "EXPLOIT_TERRAIN", "CREATE_BREAKTHROUGH"],
      requiredCautions: ["TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "FORT_MOUNTAIN_DEFENSE_VALUE",
      "HIGHLAND_OFFENSIVE_STAGING",
      "PLAINS_OFFENSE_PENALTY",
      "NO_BLIND_TERRAIN_BONUS_CHASING",
    ],
  },
  {
    originId: "O11",
    traitIds: ["P08", "P06", "P07", "N01"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["TRADE", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING"],
      requiredAffordances: ["SCALE_TRADE", "SCALE_INDUSTRY", "SCALE_ECONOMY"],
      requiredCautions: [],
    },
    validationFocus: [
      "FULL_WARTIME_TRADE_VALUE",
      "FAST_TRADE_THROUGHPUT",
      "INCREASED_TRAIN_THROUGHPUT",
      "REDUCED_CITY_GROWTH_FORECAST",
    ],
  },
  {
    originId: "O12",
    traitIds: ["P23", "P22", "N01"],
    requiredCombinationSupportIds: ["ELITE_SINGLE_FLAGSHIP_PROGRESSION"],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["NAVAL_PROJECTION", "DECISIVE_FORCE", "FORCE_PRESERVATION", "SPECIALIZATION"],
      requiredAffordances: ["PROJECT_FROM_SEA", "FIGHT_FROM_RANGE", "PRESERVE_FORCE"],
      requiredCautions: ["REQUIRES_VETERANCY", "EXPENSIVE_FAILURE"],
    },
    validationFocus: [
      "ONE_WARSHIP_OWNERSHIP_CAP",
      "FLAGSHIP_THEATER_ALLOCATION",
      "EXTENDED_VETERANCY_PROGRESSION",
      "VETERAN_FLAGSHIP_PRESERVATION_VALUE",
      "REDUCED_CITY_GROWTH_FORECAST",
    ],
  },
  {
    originId: "O13",
    traitIds: ["P25"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["DECISIVE_FORCE", "ESCALATION", "DETERRENCE", "TERRITORIAL_SHAPING", "SPECIALIZATION"],
      requiredAffordances: ["DENY_AREA", "SHAPE_TERRITORY", "FORCE_ENEMY_RESPONSE"],
      requiredCautions: ["HIGH_UPFRONT_COST"],
    },
    validationFocus: [
      "ATOM_AND_MIRV_UNAVAILABLE",
      "HYDROGEN_ONLY_PLANNING",
      "LARGER_HYDROGEN_AREA",
      "HIGHER_HYDROGEN_COST",
    ],
  },
  {
    originId: "O14",
    traitIds: ["P39"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["DISTRIBUTED_PLAY", "POSITIONAL_CONTROL", "EXPANSION", "SPECIALIZATION"],
      requiredAffordances: ["DISTRIBUTE_START", "MULTI_THEATER_ACCESS"],
      requiredCautions: ["SPLIT_FRONT_RISK", "ISOLATED_CORE_RISK"],
    },
    validationFocus: [
      "TWO_INFLUENCE_AREAS",
      "TWO_EXACT_ORIGINS",
      "SPLIT_INITIAL_TERRITORY",
      "ONE_GLOBAL_STARTING_POPULATION_POOL",
      "PAIRWISE_SPAWN_EVALUATION",
    ],
  },
  {
    originId: "O15",
    traitIds: ["P50", "P51"],
    requiredCombinationSupportIds: ["DUAL_GENERAL_SUPPORT_NETWORK"],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["INFRASTRUCTURE", "POSITIONAL_CONTROL", "FORTIFICATION"],
      requiredAffordances: ["HOLD_GROUND", "CREATE_BREAKTHROUGH", "PROTECT_HIGH_VALUE_ASSET"],
      requiredCautions: [],
    },
    validationFocus: [
      "FORT_OFFENSIVE_SUPPORT",
      "COMMAND_POST_DEFENSIVE_SUPPORT",
      "DUAL_SUPPORT_NETWORK_PLACEMENT",
      "OFFENSE_DEFENSE_COVERAGE_TRADEOFF",
    ],
  },
  {
    originId: "O16",
    traitIds: ["P38"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["FORCE_PRESERVATION", "ATTRITION", "SACRIFICE"],
      requiredAffordances: ["PRESERVE_FORCE", "TRADE_GROUND_FOR_CASUALTIES", "LURE_OVEREXTENSION"],
      requiredCautions: [],
    },
    validationFocus: [
      "AUTOMATIC_DEFENDER_SURVIVES_CAPTURE",
      "TERRITORY_LOSS_WITHOUT_DEFENDER_LOSS_FORECAST",
      "ELASTIC_DEFENSE_PLANS_AVAILABLE_AT_CAPABLE_TIERS",
    ],
  },
  {
    originId: "O17",
    traitIds: ["P49", "P45", "N02"],
    requiredCombinationSupportIds: ["LAYERED_COUNTERINTELLIGENCE"],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["INFORMATION", "POSITIONAL_CONTROL", "FORCE_PRESERVATION", "SPECIALIZATION"],
      requiredAffordances: ["GAIN_INFORMATION_ADVANTAGE", "PROTECT_HIGH_VALUE_ASSET"],
      requiredCautions: ["TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "OBSERVATION_POST_BLACKOUT_ROLE",
      "NO_SELF_TACTICAL_OBSERVATION_FROM_POSTS",
      "FOREST_INTERIOR_CONCEALMENT",
      "LAYERED_CONCEALMENT_POSITIONING",
      "PLAINS_OFFENSE_PENALTY",
    ],
  },

  // Next 10 in canonical library/UI order.
  {
    originId: "O01",
    traitIds: ["P38", "P09", "P13", "N02", "N13"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["FORCE_PRESERVATION", "FORTIFICATION", "POSITIONAL_CONTROL", "ATTRITION"],
      requiredAffordances: ["PRESERVE_FORCE", "HOLD_GROUND", "EXPLOIT_TERRAIN", "TRADE_GROUND_FOR_CASUALTIES"],
      requiredCautions: ["TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "AUTOMATIC_DEFENDER_SURVIVES_CAPTURE",
      "IMPROVED_FORT_INVESTMENT",
      "MOUNTAIN_DEFENSE_VALUE",
      "PLAINS_OFFENSE_PENALTY",
      "HALF_TRANSPORT_POPULATION_DIES_ON_LANDING",
    ],
  },
  {
    originId: "O18",
    traitIds: ["P38", "P04", "P13", "N13"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["FORCE_PRESERVATION", "ATTRITION", "FORTIFICATION", "POSITIONAL_CONTROL"],
      requiredAffordances: ["PRESERVE_FORCE", "RETALIATE_EFFICIENTLY", "HOLD_GROUND", "EXPLOIT_TERRAIN"],
      requiredCautions: ["TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "AUTOMATIC_DEFENDER_SURVIVES_CAPTURE",
      "FIXED_RESPONSE_SIDE_COUNTER_RESPONSE",
      "MOUNTAIN_DEFENSE_VALUE",
      "HALF_TRANSPORT_POPULATION_DIES_ON_LANDING",
    ],
  },
  {
    originId: "O19",
    traitIds: ["P04", "P08", "P38", "N07"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["FORCE_PRESERVATION", "ATTRITION", "TRADE", "ECONOMIC_COMPOUNDING", "SPECIALIZATION", "INFRASTRUCTURE"],
      requiredAffordances: ["PRESERVE_FORCE", "RETALIATE_EFFICIENTLY", "SCALE_TRADE", "TRADE_GROUND_FOR_CASUALTIES"],
      requiredCautions: ["EXPENSIVE_FAILURE"],
    },
    validationFocus: [
      "FIXED_RESPONSE_SIDE_COUNTER_RESPONSE",
      "FULL_WARTIME_TRADE_VALUE",
      "AUTOMATIC_DEFENDER_SURVIVES_CAPTURE",
      "ONE_PER_STRUCTURE_TYPE_LIMIT",
      "UNIQUE_STRUCTURE_PLACEMENT_VALUE",
    ],
  },
  {
    originId: "O20",
    traitIds: ["P08", "P02", "P21", "N07"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["TRADE", "ECONOMIC_COMPOUNDING", "GROWTH", "INFRASTRUCTURE", "SPECIALIZATION", "POSITIONAL_CONTROL"],
      requiredAffordances: ["SCALE_TRADE", "SCALE_GROWTH"],
      requiredCautions: ["HIGH_LIQUIDITY_NEED", "EXPENSIVE_FAILURE"],
    },
    validationFocus: [
      "FULL_WARTIME_TRADE_VALUE",
      "WIDE_POPULATION_UTILIZATION_GROWTH",
      "FIRST_STRUCTURE_PURCHASE_ZERO_FFY_CONSUMPTION",
      "FIRST_PURCHASE_STILL_REQUIRES_AFFORDABILITY",
      "ONE_PER_STRUCTURE_TYPE_LIMIT",
    ],
  },
  {
    originId: "O21",
    traitIds: ["P38", "P02", "N12", "N01"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["FORCE_PRESERVATION", "ATTRITION", "SACRIFICE", "GROWTH", "ECONOMIC_COMPOUNDING"],
      requiredAffordances: ["PRESERVE_FORCE", "TRADE_GROUND_FOR_CASUALTIES", "SCALE_GROWTH"],
      requiredCautions: [],
    },
    validationFocus: [
      "AUTOMATIC_DEFENDER_SURVIVES_CAPTURE",
      "WIDE_POPULATION_UTILIZATION_GROWTH",
      "WARSHIP_BUILD_UNAVAILABLE",
      "REDUCED_CITY_GROWTH_FORECAST",
      "NO_PHANTOM_WARSHIP_DEPENDENT_SUPPORT",
    ],
  },
  {
    originId: "O22",
    traitIds: ["P19", "P03", "P15", "N01", "N04"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["DECISIVE_FORCE", "DISTRIBUTED_PLAY", "EXPANSION", "SIEGE", "POSITIONAL_CONTROL", "SPECIALIZATION"],
      requiredAffordances: ["CREATE_BREAKTHROUGH", "SIEGE_STATIC_POSITIONS", "EXPLOIT_TERRAIN"],
      requiredCautions: ["SPLIT_FRONT_RISK", "TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "CONTACT_COUNT_OFFENSE_SCALING",
      "IGNORE_ENEMY_FORT_DEFENSIVE_PRESSURE",
      "HIGHLAND_OFFENSIVE_STAGING",
      "REDUCED_CITY_GROWTH_FORECAST",
      "REDUCED_MOUNTAIN_FFY_VALUE",
    ],
  },
  {
    originId: "O04",
    traitIds: ["P05", "P34", "P15", "N09", "N02"],
    requiredCombinationSupportIds: ["CONQUEST_FACTORY_SNOWBALL", "CONQUEST_ONLY_INDUSTRY"],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["RAIDING", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING", "EXPANSION", "DECISIVE_FORCE", "SPECIALIZATION"],
      requiredAffordances: ["RAID_INFRASTRUCTURE", "SCALE_INDUSTRY", "SCALE_ECONOMY", "CREATE_BREAKTHROUGH", "EXPLOIT_TERRAIN"],
      requiredCautions: ["INFRASTRUCTURE_DEPENDENCE", "TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "CONQUEST_STRUCTURE_FFY_REWARD",
      "CONQUERED_FACTORY_DOUBLE_EFFECT",
      "FACTORY_CONSTRUCTION_UNAVAILABLE",
      "CONQUEST_FACTORY_COMBINED_SNOWBALL_VALUE",
      "CONQUEST_ONLY_FACTORY_ACQUISITION_PRIORITY",
      "PLAINS_OFFENSE_PENALTY",
    ],
  },
  {
    originId: "O23",
    traitIds: ["P05", "P08", "P06", "N13"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["RAIDING", "EXPANSION", "ECONOMIC_COMPOUNDING", "TRADE", "MOBILITY"],
      requiredAffordances: ["RAID_INFRASTRUCTURE", "SCALE_TRADE"],
      requiredCautions: [],
    },
    validationFocus: [
      "CONQUEST_STRUCTURE_FFY_REWARD",
      "FULL_WARTIME_TRADE_VALUE",
      "FAST_TRADE_THROUGHPUT",
      "HALF_TRANSPORT_POPULATION_DIES_ON_LANDING",
    ],
  },
  {
    originId: "O24",
    traitIds: ["P43", "P15", "P19", "N12", "N01"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["SIEGE", "DECISIVE_FORCE", "POSITIONAL_CONTROL", "SPECIALIZATION", "DISTRIBUTED_PLAY", "EXPANSION"],
      requiredAffordances: ["FIGHT_FROM_RANGE", "SIEGE_STATIC_POSITIONS", "CREATE_BREAKTHROUGH", "FORCE_ENEMY_RESPONSE", "EXPLOIT_TERRAIN"],
      requiredCautions: ["HIGH_UPFRONT_COST", "LOW_MOBILITY", "LONG_RELOAD", "CLOSE_RANGE_VULNERABILITY", "EXPENSIVE_FAILURE", "TERRAIN_DEPENDENCE", "SPLIT_FRONT_RISK"],
    },
    validationFocus: [
      "HEAVY_ARTILLERY_REPLACES_TANKS",
      "HEAVY_ARTILLERY_STANDOFF_POSITIONING",
      "HIGHLAND_OFFENSIVE_STAGING",
      "CONTACT_COUNT_OFFENSE_SCALING",
      "WARSHIP_BUILD_UNAVAILABLE",
      "REDUCED_CITY_GROWTH_FORECAST",
    ],
  },
  {
    originId: "O25",
    traitIds: ["P03", "P43", "P15", "N12", "N01"],
    requiredCombinationSupportIds: [],
    originSpecificSupport: null,
    profileAssertions: {
      requiredThemes: ["SIEGE", "DECISIVE_FORCE", "POSITIONAL_CONTROL", "SPECIALIZATION"],
      requiredAffordances: ["SIEGE_STATIC_POSITIONS", "CREATE_BREAKTHROUGH", "FIGHT_FROM_RANGE", "FORCE_ENEMY_RESPONSE", "EXPLOIT_TERRAIN"],
      requiredCautions: ["HIGH_UPFRONT_COST", "LOW_MOBILITY", "LONG_RELOAD", "CLOSE_RANGE_VULNERABILITY", "EXPENSIVE_FAILURE", "TERRAIN_DEPENDENCE"],
    },
    validationFocus: [
      "IGNORE_ENEMY_FORT_DEFENSIVE_PRESSURE",
      "HEAVY_ARTILLERY_REPLACES_TANKS",
      "HEAVY_ARTILLERY_STANDOFF_POSITIONING",
      "HIGHLAND_OFFENSIVE_STAGING",
      "WARSHIP_BUILD_UNAVAILABLE",
      "REDUCED_CITY_GROWTH_FORECAST",
    ],
  },
] as const;
