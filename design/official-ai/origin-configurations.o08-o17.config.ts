// Open Fufu Official-AI named-Origin configurations, first 10 in canonical UI/library order.
//
// DESIGN-TIME SOURCE OF TRUTH.
// `traitIds` mirror OFFICIAL_ORIGINS.md and must validate exactly against that
// content registry. `requiredCombinationSupportIds` asserts which reusable
// combination-support entries must compose for this Origin. `profileAssertions`
// are intentionally partial golden assertions, not a duplicate full derived
// OriginStrategicProfile. `originSpecificSupport` remains null unless a named
// Origin needs support that cannot be generalized to its trait combination.

export const OFFICIAL_AI_ORIGIN_CONFIGURATIONS_O08_O17 = [
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
] as const;
