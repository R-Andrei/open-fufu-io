// Documentation entry point: docs/official-ai/README.md
// Specific owners: docs/official-ai/OFFICIAL_AI_TRAIT_SUPPORT.md
//                  docs/official-ai/OFFICIAL_AI_ORIGIN_SUPPORT.md
// Gameplay owner:  docs/ORIGIN_TRAIT_CATALOGUE.md
//
// Open Fufu Official-AI Origin trait support configuration.
//
// DESIGN-TIME SOURCE OF TRUTH.
// This is the single canonical code-readable source for all Official-AI
// Origin trait support, additive trait-combination support, and semantic
// support-suppression rules. Mechanical values remain authoritative in the
// Origin/game rules and final EffectiveRulesView.
//
// Internal range constants exist only to keep this large catalogue readable.
// New accepted batches are appended here; do not create batch shard files.

const TRAIT_SUPPORT_P01_P40 = [
  {
    traitId: "P01",
    mode: "GENERIC",
    themes: ["EXPANSION", "POSITIONAL_CONTROL"],
    affordances: [],
    cautions: [],
    synergyTags: ["INITIAL_TERRITORY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P02",
    mode: "GENERIC",
    themes: ["GROWTH", "ECONOMIC_COMPOUNDING", "FORCE_PRESERVATION"],
    affordances: ["SCALE_GROWTH"],
    cautions: [],
    synergyTags: ["POPULATION_GROWTH"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P03",
    mode: "GENERIC",
    themes: ["SIEGE", "DECISIVE_FORCE"],
    affordances: ["SIEGE_STATIC_POSITIONS", "CREATE_BREAKTHROUGH"],
    cautions: [],
    synergyTags: ["OFFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P04",
    mode: "GENERIC",
    themes: ["ATTRITION", "FORCE_PRESERVATION"],
    affordances: ["RETALIATE_EFFICIENTLY", "PRESERVE_FORCE"],
    cautions: [],
    synergyTags: ["COUNTER_RESPONSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P05",
    mode: "EXTENDED",
    themes: ["RAIDING", "EXPANSION", "ECONOMIC_COMPOUNDING"],
    affordances: ["RAID_INFRASTRUCTURE"],
    cautions: [],
    synergyTags: ["ECONOMY", "OFFENSE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P05_STRUCTURE_CAPTURE_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P05_STRUCTURE_CAPTURE_FFY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P05_STRUCTURE_CAPTURE_TARGET_VALUE" },
    ],
  },
  {
    traitId: "P06",
    mode: "GENERIC",
    themes: ["TRADE", "MOBILITY", "ECONOMIC_COMPOUNDING"],
    affordances: ["SCALE_TRADE"],
    cautions: [],
    synergyTags: ["TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P07",
    mode: "GENERIC",
    themes: ["INDUSTRIALIZATION", "INFRASTRUCTURE", "ECONOMIC_COMPOUNDING"],
    affordances: ["SCALE_INDUSTRY", "SCALE_ECONOMY"],
    cautions: [],
    synergyTags: ["TRAIN_ECONOMY", "INDUSTRIAL_ECONOMY", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P08",
    mode: "GENERIC",
    themes: ["TRADE", "ECONOMIC_COMPOUNDING"],
    affordances: ["SCALE_TRADE"],
    cautions: [],
    synergyTags: ["TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P09",
    mode: "GENERIC",
    themes: ["FORTIFICATION", "INFRASTRUCTURE", "POSITIONAL_CONTROL"],
    affordances: ["HOLD_GROUND", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: [],
    synergyTags: ["DEFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P10",
    mode: "GENERIC",
    themes: ["DETERRENCE", "ESCALATION", "DECISIVE_FORCE"],
    affordances: ["REDUCE_INTERCEPTION_WINDOW"],
    cautions: [],
    synergyTags: ["STRATEGIC_WEAPON"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P11",
    mode: "EXTENDED",
    themes: ["GROWTH", "FORTIFICATION", "INFRASTRUCTURE", "DETERRENCE"],
    affordances: ["INTERCEPT_OVER_LARGE_AREA", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: [],
    synergyTags: ["POPULATION_GROWTH", "SAM_INTERCEPTION"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P11_SAM_SLOT_UNLOCK_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P11_PEAK_POPULATION_UNLOCK_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P11_FREE_SAM_NETWORK_VALUE" },
    ],
  },
  {
    traitId: "P12",
    mode: "GENERIC",
    themes: ["AMPHIBIOUS", "MOBILITY", "NAVAL_PROJECTION"],
    affordances: ["PROJECT_FROM_SEA", "CREATE_SECOND_FRONT"],
    cautions: [],
    synergyTags: ["AMPHIBIOUS_LANDING"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P13",
    mode: "GENERIC",
    themes: ["FORTIFICATION", "POSITIONAL_CONTROL", "FORCE_PRESERVATION"],
    affordances: ["HOLD_GROUND", "EXPLOIT_TERRAIN"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "DEFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P14",
    mode: "GENERIC",
    themes: ["ECONOMIC_COMPOUNDING", "SPECIALIZATION", "EXPANSION"],
    affordances: ["SCALE_ECONOMY", "EXPLOIT_TERRAIN"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P15",
    mode: "GENERIC",
    themes: ["DECISIVE_FORCE", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    affordances: ["CREATE_BREAKTHROUGH", "EXPLOIT_TERRAIN"],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "OFFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P16",
    mode: "GENERIC",
    themes: ["EXPANSION", "POSITIONAL_CONTROL"],
    affordances: [],
    cautions: [],
    synergyTags: ["FALLOUT"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P17",
    mode: "EXTENDED",
    themes: ["ECONOMIC_COMPOUNDING", "INFRASTRUCTURE", "SPECIALIZATION"],
    affordances: ["BUILD_HIGH_LEVEL_INFRASTRUCTURE"],
    cautions: [],
    synergyTags: ["ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P17_STRUCTURE_COUNT_UPGRADE_ECONOMY" },
      { evaluator: "FORECAST", hookId: "P17_UPGRADE_SEQUENCE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "P17_BUILD_VS_UPGRADE_SEQUENCE_VALUE" },
      { domain: "UPGRADE", phase: "EVALUATE_CANDIDATES", hookId: "P17_COMPOUNDING_UPGRADE_VALUE" },
    ],
  },
  {
    traitId: "P18",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "DECISIVE_FORCE", "POSITIONAL_CONTROL"],
    affordances: ["CREATE_BREAKTHROUGH"],
    cautions: [],
    synergyTags: ["DEFENSE", "OFFENSE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P18_FORT_SOURCE_ATTACK_OPPORTUNITY" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P18_FORT_SOURCE_LANE_VALUE" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P18_OFFENSIVE_FORT_PLACEMENT_VALUE" },
    ],
  },
  {
    traitId: "P19",
    mode: "EXTENDED",
    themes: ["DECISIVE_FORCE", "DISTRIBUTED_PLAY", "EXPANSION"],
    affordances: ["CREATE_BREAKTHROUGH"],
    cautions: ["SPLIT_FRONT_RISK"],
    synergyTags: ["OFFENSE"],
    signalSupport: [
      { evaluator: "TERRITORY", hookId: "P19_CONTACT_COUNT_POSITION_VALUE" },
      { evaluator: "OPPORTUNITY", hookId: "P19_NEW_CONTACT_OFFENSE_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P19_CONTACT_CHANGE_OFFENSE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "EXPANSION", phase: "EVALUATE_CANDIDATES", hookId: "P19_CONTACT_CREATING_EXPANSION_VALUE" },
    ],
  },
  {
    traitId: "P20",
    mode: "GENERIC",
    themes: ["DETERRENCE", "ESCALATION", "INFRASTRUCTURE"],
    affordances: [],
    cautions: [],
    synergyTags: ["MISSILE_LAUNCHER", "STRATEGIC_WEAPON"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P21",
    mode: "EXTENDED",
    themes: ["INFRASTRUCTURE", "ECONOMIC_COMPOUNDING", "SPECIALIZATION"],
    affordances: [],
    cautions: ["HIGH_LIQUIDITY_NEED"],
    synergyTags: ["ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P21_FIRST_PURCHASE_SAVINGS_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P21_FIRST_PURCHASE_LIQUIDITY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "P21_FIRST_PURCHASE_OPPORTUNITY_COST" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P21_FIRST_PURCHASE_STRUCTURE_VALUE" },
    ],
  },
  {
    traitId: "P22",
    mode: "GENERIC",
    themes: ["NAVAL_PROJECTION", "SPECIALIZATION", "FORCE_PRESERVATION"],
    affordances: ["PROJECT_FROM_SEA"],
    cautions: ["REQUIRES_VETERANCY"],
    synergyTags: ["NAVAL", "WARSHIP"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P23",
    mode: "EXTENDED",
    themes: ["NAVAL_PROJECTION", "SPECIALIZATION", "FORCE_PRESERVATION", "DECISIVE_FORCE"],
    affordances: ["PROJECT_FROM_SEA", "FIGHT_FROM_RANGE", "PRESERVE_FORCE"],
    cautions: ["EXPENSIVE_FAILURE"],
    synergyTags: ["NAVAL", "WARSHIP"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P23_FLAGSHIP_LOSS_THREAT" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "ENRICH_INPUT", hookId: "P23_SINGLE_WARSHIP_CAP_SEMANTICS" },
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P23_FLAGSHIP_THEATER_VALUE" },
    ],
  },
  {
    traitId: "P24",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "ECONOMIC_COMPOUNDING", "INFRASTRUCTURE", "POSITIONAL_CONTROL"],
    affordances: ["SCALE_ECONOMY"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["ECONOMY", "DEFENSE"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P24_FORT_AREA_EVENT_YIELD" },
      { evaluator: "FORECAST", hookId: "P24_FORT_ECONOMY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P24_ECONOMIC_FORT_PLACEMENT_VALUE" },
    ],
  },
  {
    traitId: "P25",
    mode: "GENERIC",
    themes: ["DECISIVE_FORCE", "ESCALATION", "DETERRENCE", "SPECIALIZATION", "TERRITORIAL_SHAPING"],
    affordances: ["DENY_AREA", "SHAPE_TERRITORY", "FORCE_ENEMY_RESPONSE"],
    cautions: ["HIGH_UPFRONT_COST"],
    synergyTags: ["STRATEGIC_WEAPON"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P26",
    mode: "EXTENDED",
    themes: ["DECISIVE_FORCE", "ESCALATION", "DETERRENCE", "SPECIALIZATION"],
    affordances: ["FORCE_ENEMY_RESPONSE", "SHAPE_TERRITORY"],
    cautions: ["HIGH_LIQUIDITY_NEED", "EXPENSIVE_FAILURE"],
    synergyTags: ["STRATEGIC_WEAPON"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P26_ONE_SHOT_MIRV_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P26_MIRV_RESERVATION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "STRATEGIC_WEAPONS", phase: "ENRICH_INPUT", hookId: "P26_SINGLE_USE_MIRV_SEMANTICS" },
      { domain: "STRATEGIC_WEAPONS", phase: "EVALUATE_CANDIDATES", hookId: "P26_ONE_SHOT_MIRV_VALUE" },
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "P26_MIRV_LIQUIDITY_RESERVE_VALUE" },
    ],
  },
  {
    traitId: "P27",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "POSITIONAL_CONTROL", "NAVAL_PROJECTION", "SPECIALIZATION"],
    affordances: ["DENY_AREA", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: ["COAST_DEPENDENCE"],
    synergyTags: ["SAM_INTERCEPTION", "NAVAL", "DEFENSE"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P27_SAM_ANTI_SHIP_COVERAGE" },
      { evaluator: "OPPORTUNITY", hookId: "P27_SHIP_DENIAL_OPPORTUNITY" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P27_COASTAL_SAM_PLACEMENT_VALUE" },
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P27_ANTI_SHIP_SAM_DEFENSE_VALUE" },
    ],
  },
  {
    traitId: "P28",
    mode: "EXTENDED",
    themes: ["RAIDING", "ATTRITION", "GROWTH", "NAVAL_PROJECTION"],
    affordances: [],
    cautions: [],
    synergyTags: ["NAVAL", "AMPHIBIOUS_LANDING"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P28_TRANSPORT_POPULATION_BOUNTY" },
      { evaluator: "FORECAST", hookId: "P28_CAPTURED_POPULATION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P28_TRANSPORT_TARGET_VALUE" },
    ],
  },
  {
    traitId: "P29",
    mode: "EXTENDED",
    themes: ["NAVAL_PROJECTION", "DETERRENCE", "ESCALATION", "MOBILITY", "SPECIALIZATION"],
    affordances: ["LAUNCH_FROM_MOBILE_PLATFORM", "PROJECT_FROM_SEA"],
    cautions: ["REQUIRES_VETERANCY", "EXPENSIVE_FAILURE"],
    synergyTags: ["WARSHIP", "NAVAL", "MISSILE_LAUNCHER", "STRATEGIC_WEAPON"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P29_MOBILE_LAUNCH_POSITION_OPPORTUNITY" },
      { evaluator: "THREAT", hookId: "P29_LAUNCHER_WARSHIP_EXPOSURE" },
      { evaluator: "FORECAST", hookId: "P29_MOBILE_LAUNCH_PATH_FORECAST" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P29_LAUNCHER_WARSHIP_POSITION_VALUE" },
      { domain: "STRATEGIC_WEAPONS", phase: "ENRICH_INPUT", hookId: "P29_WARSHIP_LAUNCHER_SEMANTICS" },
      { domain: "STRATEGIC_WEAPONS", phase: "EVALUATE_CANDIDATES", hookId: "P29_MOBILE_LAUNCH_PLATFORM_VALUE" },
    ],
  },
  {
    traitId: "P30",
    mode: "EXTENDED",
    themes: ["RAIDING", "MOBILITY", "NAVAL_PROJECTION", "ECONOMIC_COMPOUNDING", "SPECIALIZATION"],
    affordances: ["SCALE_ECONOMY"],
    cautions: [],
    synergyTags: ["WARSHIP", "NAVAL", "TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P30_PIRACY_TARGET_OPPORTUNITY" },
      { evaluator: "THREAT", hookId: "P30_HOSTILE_WARSHIP_THREAT" },
      { evaluator: "FORECAST", hookId: "P30_PIRACY_FFY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "ENRICH_INPUT", hookId: "P30_PIRACY_ONLY_WARSHIP_SEMANTICS" },
      { domain: "NAVAL", phase: "AUGMENT_CANDIDATES", hookId: "P30_FAST_PIRACY_PATROLS" },
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P30_PIRACY_ROUTE_VALUE" },
    ],
  },
  {
    traitId: "P31",
    mode: "EXTENDED",
    themes: ["NAVAL_PROJECTION", "FORCE_PRESERVATION", "FORTIFICATION", "INFRASTRUCTURE"],
    affordances: ["PRESERVE_FORCE", "PROJECT_FROM_SEA"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE", "COAST_DEPENDENCE"],
    synergyTags: ["WARSHIP", "NAVAL", "DEFENSE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P31_PORT_REPAIR_SUSTAIN_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P31_PORT_REPAIR_COMBAT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P31_REPAIR_FIELD_POSITION_VALUE" },
      { domain: "RETREAT", phase: "EVALUATE_CANDIDATES", hookId: "P31_PORT_REPAIR_RETREAT_VALUE" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P31_NAVAL_REPAIR_PORT_PLACEMENT_VALUE" },
    ],
  },
  {
    traitId: "P32",
    mode: "EXTENDED",
    themes: ["AMPHIBIOUS", "FORCE_PRESERVATION", "NAVAL_PROJECTION", "INFRASTRUCTURE"],
    affordances: ["PRESERVE_FORCE", "PROJECT_FROM_SEA", "CREATE_SECOND_FRONT"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE", "COAST_DEPENDENCE"],
    synergyTags: ["AMPHIBIOUS_LANDING"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P32_ARMORED_TRANSPORT_SURVIVABILITY" },
      { evaluator: "FORECAST", hookId: "P32_PORT_EMBARKATION_TRANSIT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "AMPHIBIOUS", phase: "ENRICH_INPUT", hookId: "P32_PORT_ONLY_ARMORED_TRANSPORT_SEMANTICS" },
      { domain: "AMPHIBIOUS", phase: "EVALUATE_CANDIDATES", hookId: "P32_ARMORED_TRANSPORT_ROUTE_VALUE" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P32_TRANSPORT_PORT_ACCESS_VALUE" },
    ],
  },
  {
    traitId: "P33",
    mode: "EXTENDED",
    themes: ["GROWTH", "INDUSTRIALIZATION", "INFRASTRUCTURE", "ECONOMIC_COMPOUNDING"],
    affordances: ["SCALE_GROWTH", "SCALE_INDUSTRY", "BUILD_HIGH_LEVEL_INFRASTRUCTURE"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["TRAIN_ECONOMY", "INDUSTRIAL_ECONOMY", "POPULATION_GROWTH", "ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P33_TRAIN_CITY_POPULATION_ENGINE" },
      { evaluator: "FORECAST", hookId: "P33_TRAIN_POPULATION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P33_TRAIN_CITY_NETWORK_VALUE" },
      { domain: "UPGRADE", phase: "EVALUATE_CANDIDATES", hookId: "P33_CITY_LEVEL_POPULATION_VALUE" },
    ],
  },
  {
    traitId: "P34",
    mode: "EXTENDED",
    themes: ["RAIDING", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING", "EXPANSION"],
    affordances: ["RAID_INFRASTRUCTURE", "SCALE_INDUSTRY", "SCALE_ECONOMY"],
    cautions: [],
    synergyTags: ["INDUSTRIAL_ECONOMY", "ECONOMY", "OFFENSE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P34_CONQUERED_FACTORY_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P34_FACTORY_CAPTURE_PRODUCTION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P34_FACTORY_CAPTURE_TARGET_VALUE" },
    ],
  },
  {
    traitId: "P35",
    mode: "EXTENDED",
    themes: ["SACRIFICE", "TERRITORIAL_SHAPING", "POSITIONAL_CONTROL", "ATTRITION"],
    affordances: ["DENY_AREA", "SHAPE_TERRITORY"],
    cautions: ["REQUIRES_GIVING_GROUND", "SELF_GEOMETRY_RISK"],
    synergyTags: ["FALLOUT", "TERRITORY_NEUTRALIZATION", "DEFENSE"],
    signalSupport: [
      { evaluator: "TERRITORY", hookId: "P35_RELINQUISH_FALLOUT_POSITION_VALUE" },
      { evaluator: "OPPORTUNITY", hookId: "P35_FALLOUT_DENIAL_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P35_RELINQUISH_FALLOUT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "RETREAT", phase: "AUGMENT_CANDIDATES", hookId: "P35_FALLOUT_RELINQUISH_PLANS" },
      { domain: "RETREAT", phase: "EVALUATE_CANDIDATES", hookId: "P35_FALLOUT_RELINQUISH_VALUE" },
    ],
  },
  {
    traitId: "P36",
    mode: "GENERIC",
    themes: ["EXPANSION", "GROWTH", "FORCE_PRESERVATION"],
    affordances: ["EXPAND_CHEAPLY", "EXPAND_WITH_LOW_POPULATION", "PRESERVE_FORCE"],
    cautions: [],
    synergyTags: ["NEUTRAL_EXPANSION"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "P37",
    mode: "EXTENDED",
    themes: ["AMPHIBIOUS", "FORTIFICATION", "NAVAL_PROJECTION", "POSITIONAL_CONTROL"],
    affordances: ["FORTIFY_BEACHHEAD", "CREATE_SECOND_FRONT", "PROJECT_FROM_SEA", "HOLD_GROUND"],
    cautions: ["HIGH_UPFRONT_COST", "EXPENSIVE_FAILURE", "COAST_DEPENDENCE"],
    synergyTags: ["AMPHIBIOUS_LANDING", "FORT_CREATION", "DEFENSE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P37_FORTIFIED_LANDING_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P37_LANDING_FORT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "AMPHIBIOUS", phase: "EVALUATE_CANDIDATES", hookId: "P37_FORTIFIED_BEACHHEAD_VALUE" },
    ],
  },
  {
    traitId: "P38",
    mode: "EXTENDED",
    themes: ["FORCE_PRESERVATION", "ATTRITION", "SACRIFICE"],
    affordances: ["PRESERVE_FORCE", "TRADE_GROUND_FOR_CASUALTIES", "LURE_OVEREXTENSION"],
    cautions: [],
    synergyTags: ["DEFENDER_SURVIVAL", "DEFENSE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P38_ELASTIC_DEFENSE_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P38_DEFENDER_SURVIVAL_FORECAST" },
    ],
    plannerSupport: [
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P38_DEFENDED_CELL_TRADE_VALUE" },
      { domain: "RETREAT", phase: "EVALUATE_CANDIDATES", hookId: "P38_TERRITORY_TRADE_RETREAT_VALUE" },
    ],
  },
  {
    traitId: "P39",
    mode: "EXTENDED",
    themes: ["DISTRIBUTED_PLAY", "POSITIONAL_CONTROL", "EXPANSION", "SPECIALIZATION"],
    affordances: ["DISTRIBUTE_START", "MULTI_THEATER_ACCESS"],
    cautions: ["SPLIT_FRONT_RISK", "ISOLATED_CORE_RISK"],
    synergyTags: ["MULTI_SPAWN", "INITIAL_TERRITORY"],
    signalSupport: [
      { evaluator: "TERRITORY", hookId: "P39_SPLIT_CORE_POSITION_VALUE" },
      { evaluator: "THREAT", hookId: "P39_SPLIT_CORE_ISOLATION_THREAT" },
      { evaluator: "FORECAST", hookId: "P39_SPLIT_SPAWN_FORECAST" },
    ],
    plannerSupport: [
      { domain: "SPAWN", phase: "ENRICH_INPUT", hookId: "P39_TWO_ORIGIN_SEMANTICS" },
      { domain: "SPAWN", phase: "AUGMENT_CANDIDATES", hookId: "P39_SPLIT_SPAWN_CANDIDATES" },
      { domain: "SPAWN", phase: "EVALUATE_CANDIDATES", hookId: "P39_SPLIT_SPAWN_PAIR_VALUE" },
    ],
  },
  {
    traitId: "P40",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "DETERRENCE", "SPECIALIZATION", "POSITIONAL_CONTROL"],
    affordances: ["INTERCEPT_OVER_LARGE_AREA", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: ["LOW_THROUGHPUT", "BAITABLE_DEFENSE", "LONG_RELOAD"],
    synergyTags: ["SAM_INTERCEPTION", "SINGLE_CHARGE_DEFENSE", "DEFENSE"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P40_SINGLE_CHARGE_SAM_THREAT" },
      { evaluator: "FORECAST", hookId: "P40_INTERCEPTION_CHARGE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P40_GIANT_SAM_PLACEMENT_VALUE" },
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P40_SINGLE_CHARGE_DEFENSE_VALUE" },
    ],
  },
] as const;

const TRAIT_SUPPORT_P41_P50 = [
  {
    traitId: "P41",
    mode: "EXTENDED",
    themes: ["INFRASTRUCTURE", "GROWTH", "ECONOMIC_COMPOUNDING", "SPECIALIZATION"],
    affordances: ["BUILD_HIGH_LEVEL_INFRASTRUCTURE", "SCALE_GROWTH"],
    cautions: ["HIGH_UPFRONT_COST"],
    synergyTags: ["CITY_PURCHASE", "POPULATION_GROWTH", "ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P41_LEVEL5_CITY_PURCHASE_VALUE" },
      { evaluator: "FORECAST", hookId: "P41_LEVEL5_CITY_COMPLETION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "ENRICH_INPUT", hookId: "P41_LEVEL5_CITY_BUILD_RESULT_SEMANTICS" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P41_LEVEL5_CITY_BUILD_VALUE" },
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "P41_LEVEL5_CITY_LIQUIDITY_VALUE" },
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
      { evaluator: "ECONOMY", hookId: "P42_POPULATION_FUNDED_WARSHIP_ECONOMY" },
      { evaluator: "FORECAST", hookId: "P42_PERMANENT_POPULATION_COST_FORECAST" },
    ],
    plannerSupport: [
      { domain: "SPENDING", phase: "ENRICH_INPUT", hookId: "P42_POPULATION_PURCHASE_SEMANTICS" },
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "P42_POPULATION_VS_WARSHIP_VALUE" },
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P42_SHORT_RANGE_POPULATION_WARSHIP_VALUE" },
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
      { evaluator: "OPPORTUNITY", hookId: "P43_HEAVY_ARTILLERY_RANGE_OPPORTUNITY" },
      { evaluator: "THREAT", hookId: "P43_HEAVY_ARTILLERY_CLOSE_THREATS" },
      { evaluator: "FORECAST", hookId: "P43_HEAVY_ARTILLERY_RELOAD_FORECAST" },
    ],
    plannerSupport: [
      { domain: "ARMOR", phase: "ENRICH_INPUT", hookId: "P43_HEAVY_ARTILLERY_UNIT_SEMANTICS" },
      { domain: "ARMOR", phase: "AUGMENT_CANDIDATES", hookId: "P43_HEAVY_ARTILLERY_STANDOFF_PLANS" },
      { domain: "ARMOR", phase: "EVALUATE_CANDIDATES", hookId: "P43_HEAVY_ARTILLERY_POSITION_VALUE" },
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
      { evaluator: "TERRITORY", hookId: "P44_RADIOACTIVE_TERRITORY_VALUE" },
      { evaluator: "OPPORTUNITY", hookId: "P44_RADIOACTIVE_TARGET_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P44_RADIOACTIVE_TERRITORY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "ARMOR", phase: "EVALUATE_CANDIDATES", hookId: "P44_RADIOACTIVE_POPULATION_ATTACK_VALUE" },
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
      { evaluator: "TERRITORY", hookId: "P45_FOREST_CONCEALMENT_POSITION_VALUE" },
      { evaluator: "THREAT", hookId: "P45_CONCEALED_STATE_EXPOSURE_THREAT" },
      { evaluator: "FORECAST", hookId: "P45_FOREST_INFORMATION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P45_CONCEALED_FOREST_DEFENSE_VALUE" },
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P45_CONCEALED_FOREST_STAGING_VALUE" },
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
      { evaluator: "TERRITORY", hookId: "P46_TUNDRA_STRUCTURE_POSITION_VALUE" },
      { evaluator: "OPPORTUNITY", hookId: "P46_TUNDRA_BUILD_OPPORTUNITY" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "AUGMENT_CANDIDATES", hookId: "P46_TUNDRA_STRUCTURE_CANDIDATES" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P46_TUNDRA_STRUCTURE_VALUE" },
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
      { evaluator: "OPPORTUNITY", hookId: "P47_MARSH_CAPTURE_ATTRITION_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P47_MARSH_CAPTURE_POPULATION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P47_MARSH_ATTRITION_DEFENSE_VALUE" },
      { domain: "RETREAT", phase: "EVALUATE_CANDIDATES", hookId: "P47_MARSH_TERRITORY_TRADE_VALUE" },
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
      { evaluator: "TERRITORY", hookId: "P48_SHALLOW_WATER_CAPACITY_VALUE" },
      { evaluator: "ECONOMY", hookId: "P48_SHALLOW_WATER_POPULATION_ECONOMY" },
      { evaluator: "FORECAST", hookId: "P48_SHALLOW_WATER_CAPACITY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "EXPANSION", phase: "EVALUATE_CANDIDATES", hookId: "P48_SHALLOW_WATER_EXPANSION_VALUE" },
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
      { evaluator: "THREAT", hookId: "P49_COUNTERINTELLIGENCE_COVERAGE_THREAT" },
      { evaluator: "OPPORTUNITY", hookId: "P49_BLACKOUT_POSITION_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P49_BLACKOUT_INFORMATION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "OBSERVATION", phase: "ENRICH_INPUT", hookId: "P49_COUNTERINTELLIGENCE_POST_SEMANTICS" },
      { domain: "OBSERVATION", phase: "AUGMENT_CANDIDATES", hookId: "P49_BLACKOUT_PLACEMENT_CANDIDATES" },
      { domain: "OBSERVATION", phase: "EVALUATE_CANDIDATES", hookId: "P49_BLACKOUT_PLACEMENT_VALUE" },
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
      { evaluator: "OPPORTUNITY", hookId: "P50_FORT_GENERAL_SUPPORT_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P50_FORT_GENERAL_SUPPORT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P50_FORT_AREA_OFFENSE_VALUE" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P50_GENERAL_SUPPORT_FORT_PLACEMENT_VALUE" },
    ],
  },
] as const;

const TRAIT_SUPPORT_P51_N06 = [
  {
    traitId: "P51",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "INFRASTRUCTURE", "POSITIONAL_CONTROL", "FORCE_PRESERVATION"],
    affordances: ["HOLD_GROUND", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: [],
    synergyTags: ["OFFENSE", "DEFENSE"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P51_COMMAND_DEFENSE_COVERAGE_THREAT" },
      { evaluator: "FORECAST", hookId: "P51_COMMAND_GENERAL_SUPPORT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P51_COMMAND_DUAL_SUPPORT_PLACEMENT_VALUE" },
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P51_COMMAND_DEFENSIVE_SUPPORT_VALUE" },
    ],
  },
  {
    traitId: "P52",
    mode: "EXTENDED",
    themes: ["ECONOMIC_COMPOUNDING", "EXPANSION", "SPECIALIZATION"],
    affordances: ["SCALE_ECONOMY", "EXPAND_WITH_LOW_POPULATION"],
    cautions: [],
    synergyTags: ["ECONOMY", "POPULATION_GROWTH", "NEUTRAL_EXPANSION"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P52_EMPTY_CAPACITY_PASSIVE_FFY" },
      { evaluator: "FORECAST", hookId: "P52_POPULATION_CAPACITY_GAP_FORECAST" },
    ],
    plannerSupport: [
      { domain: "EXPANSION", phase: "EVALUATE_CANDIDATES", hookId: "P52_CAPACITY_ACQUISITION_FFY_VALUE" },
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "P52_POPULATION_EXPENDITURE_INCOME_TRADEOFF" },
    ],
  },
  {
    traitId: "P53",
    mode: "EXTENDED",
    themes: ["ECONOMIC_COMPOUNDING", "DETERRENCE", "INFRASTRUCTURE", "SPECIALIZATION"],
    affordances: ["SCALE_ECONOMY", "BUILD_HIGH_LEVEL_INFRASTRUCTURE"],
    cautions: ["INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["ECONOMY", "MISSILE_LAUNCHER", "STRATEGIC_WEAPON"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P53_READY_SILO_CHARGE_INCOME" },
      { evaluator: "FORECAST", hookId: "P53_CHARGE_SPEND_INCOME_DOWNTIME_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P53_SILO_ECONOMY_PLACEMENT_VALUE" },
      { domain: "UPGRADE", phase: "EVALUATE_CANDIDATES", hookId: "P53_SILO_CHARGE_CAPACITY_UPGRADE_VALUE" },
      { domain: "STRATEGIC_WEAPONS", phase: "EVALUATE_CANDIDATES", hookId: "P53_READY_CHARGE_INCOME_OPPORTUNITY_COST" },
    ],
  },
  {
    traitId: "P54",
    mode: "EXTENDED",
    themes: ["EXPANSION", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    affordances: [],
    cautions: ["OVEREXTENSION_RISK", "SELF_GEOMETRY_RISK"],
    synergyTags: ["INITIAL_TERRITORY"],
    signalSupport: [
      { evaluator: "TERRITORY", hookId: "P54_STAR_FOOTPRINT_POSITION_VALUE" },
      { evaluator: "FORECAST", hookId: "P54_STAR_FOOTPRINT_EXPOSURE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "SPAWN", phase: "ENRICH_INPUT", hookId: "P54_STAR_FOOTPRINT_SEMANTICS" },
      { domain: "SPAWN", phase: "EVALUATE_CANDIDATES", hookId: "P54_STAR_SPAWN_POSITION_VALUE" },
    ],
  },
  { traitId: "N01", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["POPULATION_GROWTH"], signalSupport: [], plannerSupport: [] },
  { traitId: "N02", mode: "GENERIC", themes: [], affordances: [], cautions: ["TERRAIN_DEPENDENCE"], synergyTags: ["TERRAIN_SPECIALIZATION", "OFFENSE"], signalSupport: [], plannerSupport: [] },
  { traitId: "N03", mode: "GENERIC", themes: [], affordances: [], cautions: ["TERRAIN_DEPENDENCE"], synergyTags: ["TERRAIN_SPECIALIZATION", "DEFENSE"], signalSupport: [], plannerSupport: [] },
  { traitId: "N04", mode: "GENERIC", themes: [], affordances: [], cautions: ["TERRAIN_DEPENDENCE"], synergyTags: ["TERRAIN_SPECIALIZATION", "ECONOMY"], signalSupport: [], plannerSupport: [] },
  {
    traitId: "N05",
    mode: "EXTENDED",
    themes: [],
    affordances: [],
    cautions: ["SELF_GEOMETRY_RISK"],
    synergyTags: ["FALLOUT"],
    signalSupport: [
      { evaluator: "TERRITORY", hookId: "N05_UNCAPTURABLE_FALLOUT_GEOMETRY" },
      { evaluator: "THREAT", hookId: "N05_FALLOUT_BARRIER_THREAT" },
      { evaluator: "FORECAST", hookId: "N05_FALLOUT_OWNERSHIP_BARRIER_FORECAST" },
    ],
    plannerSupport: [
      { domain: "EXPANSION", phase: "ENRICH_INPUT", hookId: "N05_FALLOUT_CAPTURE_PROHIBITION_SEMANTICS" },
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "N05_FALLOUT_DEPENDENT_PLAN_REJECTION" },
    ],
  },
  { traitId: "N06", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["ECONOMY"], signalSupport: [], plannerSupport: [] },
] as const;

const TRAIT_SUPPORT_N07_N16 = [
  {
    traitId: "N07",
    mode: "EXTENDED",
    themes: ["SPECIALIZATION", "INFRASTRUCTURE", "POSITIONAL_CONTROL"],
    affordances: [],
    cautions: ["EXPENSIVE_FAILURE"],
    synergyTags: ["ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "N07_STRUCTURE_TYPE_SLOT_SCARCITY" },
      { evaluator: "THREAT", hookId: "N07_UNIQUE_STRUCTURE_LOSS_THREAT" },
      { evaluator: "FORECAST", hookId: "N07_ONE_PER_TYPE_OWNERSHIP_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "ENRICH_INPUT", hookId: "N07_ONE_PER_TYPE_OWNERSHIP_SEMANTICS" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "N07_UNIQUE_STRUCTURE_PLACEMENT_VALUE" },
      { domain: "SPENDING", phase: "EVALUATE_CANDIDATES", hookId: "N07_STRUCTURE_TYPE_SLOT_OPPORTUNITY_COST" },
    ],
  },
  { traitId: "N08", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["DEFENSE"], signalSupport: [], plannerSupport: [] },
  { traitId: "N09", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["INDUSTRIAL_ECONOMY", "TRAIN_ECONOMY", "ECONOMY"], signalSupport: [], plannerSupport: [] },
  { traitId: "N10", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["DEFENSE"], signalSupport: [], plannerSupport: [] },
  {
    traitId: "N11",
    mode: "EXTENDED",
    themes: [],
    affordances: [],
    cautions: ["SELF_GEOMETRY_RISK", "INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["SAM_INTERCEPTION", "ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "N11_SAM_AREA_ZERO_YIELD_ECONOMY" },
      { evaluator: "FORECAST", hookId: "N11_SAM_COVERAGE_ECONOMY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "N11_SAM_ECONOMIC_EXCLUSION_PLACEMENT_VALUE" },
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "N11_SAM_DEFENSE_VS_ECONOMY_TRADEOFF" },
    ],
  },
  { traitId: "N12", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["NAVAL", "WARSHIP"], signalSupport: [], plannerSupport: [] },
  { traitId: "N13", mode: "GENERIC", themes: [], affordances: [], cautions: [], synergyTags: ["AMPHIBIOUS_LANDING"], signalSupport: [], plannerSupport: [] },
  {
    traitId: "N14",
    mode: "EXTENDED",
    themes: ["FORCE_PRESERVATION"],
    affordances: [],
    cautions: ["EXPENSIVE_FAILURE"],
    synergyTags: ["TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "N14_TRADE_CAPTURE_PENALTY_ECONOMY" },
      { evaluator: "THREAT", hookId: "N14_HOSTILE_TRADE_CAPTURE_THREAT" },
      { evaluator: "FORECAST", hookId: "N14_TRADE_CAPTURE_PENALTY_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "N14_RISK_ADJUSTED_TRADE_NETWORK_VALUE" },
    ],
  },
  { traitId: "N15", mode: "GENERIC", themes: [], affordances: [], cautions: ["HIGH_UPFRONT_COST"], synergyTags: ["AMPHIBIOUS_LANDING", "ECONOMY"], signalSupport: [], plannerSupport: [] },
  {
    traitId: "N16",
    mode: "EXTENDED",
    themes: ["TRADE", "SACRIFICE", "SPECIALIZATION"],
    affordances: [],
    cautions: [],
    synergyTags: ["TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "N16_INVERTED_TRADE_OUTCOME_VALUE" },
      { evaluator: "OPPORTUNITY", hookId: "N16_HOSTILE_CAPTURE_RECOVERY_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "N16_TRADE_OUTCOME_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "ENRICH_INPUT", hookId: "N16_INVERTED_TRADE_SEMANTICS" },
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "N16_INVERTED_TRADE_NETWORK_VALUE" },
    ],
  },
] as const;

const TRAIT_SUPPORT_N17_N18 = [
  {
    traitId: "N17",
    mode: "EXTENDED",
    themes: ["RAIDING", "TERRITORIAL_SHAPING", "SPECIALIZATION"],
    affordances: ["RAID_INFRASTRUCTURE"],
    cautions: [],
    synergyTags: ["OFFENSE", "ECONOMY"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "N17_STRUCTURE_DESTRUCTION_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "N17_CONQUEST_STRUCTURE_DESTRUCTION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "ENRICH_INPUT", hookId: "N17_STRUCTURE_RAZE_SEMANTICS" },
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "N17_STRUCTURE_DENIAL_TARGET_VALUE" },
    ],
  },
  {
    traitId: "N18",
    mode: "GENERIC",
    themes: ["SPECIALIZATION"],
    affordances: [],
    cautions: ["SETUP_TIME"],
    synergyTags: ["NEUTRAL_EXPANSION", "OFFENSE", "FALLOUT"],
    signalSupport: [],
    plannerSupport: [],
  },
] as const;

export const OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT = [
  ...TRAIT_SUPPORT_P01_P40,
  ...TRAIT_SUPPORT_P41_P50,
  ...TRAIT_SUPPORT_P51_N06,
  ...TRAIT_SUPPORT_N07_N16,
  ...TRAIT_SUPPORT_N17_N18,
] as const;

export const OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT = [
  {
    id: "TRAIN_POPULATION_ENGINE_ACCELERATION",
    match: { allTraitIds: ["P07", "P33"] },
    addsThemes: ["GROWTH", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING"],
    addsAffordances: ["SCALE_GROWTH", "SCALE_INDUSTRY"],
    signalSupport: [
      { evaluator: "ECONOMY", hookId: "P07_P33_RAIL_DEMOGRAPHIC_SYNERGY" },
      { evaluator: "FORECAST", hookId: "P07_P33_TRAIN_POPULATION_THROUGHPUT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P07_P33_TRAIN_CITY_THROUGHPUT_VALUE" },
    ],
  },
  {
    id: "CONQUEST_FACTORY_SNOWBALL",
    match: { allTraitIds: ["P05", "P34"] },
    addsThemes: ["RAIDING", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING"],
    addsAffordances: ["RAID_INFRASTRUCTURE", "SCALE_INDUSTRY"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P05_P34_FACTORY_CONQUEST_SNOWBALL" },
      { evaluator: "FORECAST", hookId: "P05_P34_FACTORY_CAPTURE_COMBINED_FORECAST" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P05_P34_FACTORY_CAPTURE_COMBINED_VALUE" },
    ],
  },
  {
    id: "CONQUEST_ONLY_INDUSTRY",
    match: { allTraitIds: ["P34", "N09"] },
    addsThemes: ["RAIDING", "INDUSTRIALIZATION", "SPECIALIZATION"],
    addsAffordances: ["RAID_INFRASTRUCTURE"],
    addsCautions: ["INFRASTRUCTURE_DEPENDENCE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P34_N09_CONQUEST_ONLY_FACTORY_OPPORTUNITY" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P34_N09_FACTORY_ACQUISITION_PRIORITY" },
    ],
  },
  {
    id: "REVERSIBLE_SCORCHED_EARTH",
    match: { allTraitIds: ["P16", "P35"] },
    addsThemes: ["TERRITORIAL_SHAPING", "SACRIFICE", "POSITIONAL_CONTROL"],
    addsAffordances: ["DENY_AREA", "SHAPE_TERRITORY"],
    signalSupport: [
      { evaluator: "FORECAST", hookId: "P16_P35_REACQUISITION_ADVANTAGE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "RETREAT", phase: "EVALUATE_CANDIDATES", hookId: "P16_P35_REVERSIBLE_SCORCHED_EARTH_VALUE" },
    ],
  },
  {
    id: "RADIOACTIVE_FALLOUT_ADVANCE",
    match: { allTraitIds: ["P16", "P44"] },
    addsThemes: ["TERRITORIAL_SHAPING", "EXPANSION", "POSITIONAL_CONTROL"],
    addsAffordances: ["SHAPE_TERRITORY"],
    signalSupport: [
      { evaluator: "FORECAST", hookId: "P16_P44_FALLOUT_FOLLOWUP_ADVANCE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P16_P44_RADIOACTIVE_ADVANCE_VALUE" },
    ],
  },
  {
    id: "FALLOUT_ACQUISITION_INVERSION",
    match: { allTraitIds: ["P16", "N18"] },
    addsThemes: ["EXPANSION", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    addsAffordances: ["EXPLOIT_TERRAIN"],
    signalSupport: [
      { evaluator: "TERRITORY", hookId: "P16_N18_FALLOUT_ACQUISITION_VALUE" },
      { evaluator: "FORECAST", hookId: "P16_N18_RELATIVE_ACQUISITION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "EXPANSION", phase: "EVALUATE_CANDIDATES", hookId: "P16_N18_FALLOUT_EXPANSION_VALUE" },
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P16_N18_FALLOUT_CAPTURE_VALUE" },
    ],
  },
  {
    id: "VETERAN_MOBILE_MIRV_PLATFORM",
    match: { allTraitIds: ["P22", "P29"] },
    addsThemes: ["NAVAL_PROJECTION", "DETERRENCE", "SPECIALIZATION"],
    addsAffordances: ["LAUNCH_FROM_MOBILE_PLATFORM"],
    signalSupport: [
      { evaluator: "FORECAST", hookId: "P22_P29_RANK5_MOBILE_MIRV_FORECAST" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P22_P29_VETERAN_LAUNCHER_PROGRESSION_VALUE" },
      { domain: "STRATEGIC_WEAPONS", phase: "EVALUATE_CANDIDATES", hookId: "P22_P29_MOBILE_MIRV_PLATFORM_VALUE" },
    ],
  },
  {
    id: "RADIOACTIVE_HEAVY_ARTILLERY",
    match: { allTraitIds: ["P43", "P44"] },
    addsThemes: ["SIEGE", "TERRITORIAL_SHAPING", "POSITIONAL_CONTROL"],
    addsAffordances: ["ERODE_TERRITORY_AT_RANGE"],
    signalSupport: [
      { evaluator: "OPPORTUNITY", hookId: "P43_P44_STANDOFF_FALLOUT_OPPORTUNITY" },
      { evaluator: "FORECAST", hookId: "P43_P44_STANDOFF_TERRITORY_EROSION_FORECAST" },
    ],
    plannerSupport: [
      { domain: "ARMOR", phase: "AUGMENT_CANDIDATES", hookId: "P43_P44_STANDOFF_FALLOUT_BOMBARDMENT" },
      { domain: "ARMOR", phase: "EVALUATE_CANDIDATES", hookId: "P43_P44_STANDOFF_FALLOUT_VALUE" },
    ],
  },
  {
    id: "POPULATION_SCALED_GIANT_SAM_NETWORK",
    match: { allTraitIds: ["P11", "P40"] },
    addsThemes: ["FORTIFICATION", "DETERRENCE", "POSITIONAL_CONTROL"],
    addsAffordances: ["INTERCEPT_OVER_LARGE_AREA", "PROTECT_HIGH_VALUE_ASSET"],
    signalSupport: [
      { evaluator: "FORECAST", hookId: "P11_P40_GIANT_SAM_NETWORK_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P11_P40_DISTRIBUTED_SINGLE_CHARGE_NETWORK_VALUE" },
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P11_P40_GIANT_SAM_COVERAGE_PORTFOLIO_VALUE" },
    ],
  },
  {
    id: "ELITE_SINGLE_FLAGSHIP_PROGRESSION",
    match: { allTraitIds: ["P22", "P23"] },
    addsThemes: ["DECISIVE_FORCE", "FORCE_PRESERVATION", "SPECIALIZATION"],
    addsAffordances: ["PRESERVE_FORCE", "PROJECT_FROM_SEA"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P22_P23_VETERAN_FLAGSHIP_LOSS_THREAT" },
    ],
    plannerSupport: [
      { domain: "NAVAL", phase: "EVALUATE_CANDIDATES", hookId: "P22_P23_ELITE_FLAGSHIP_PROGRESSION_VALUE" },
    ],
  },
  {
    id: "DUAL_GENERAL_SUPPORT_NETWORK",
    match: { allTraitIds: ["P50", "P51"] },
    addsThemes: ["INFRASTRUCTURE", "POSITIONAL_CONTROL", "FORTIFICATION"],
    addsAffordances: ["HOLD_GROUND", "CREATE_BREAKTHROUGH", "PROTECT_HIGH_VALUE_ASSET"],
    signalSupport: [
      { evaluator: "FORECAST", hookId: "P50_P51_DUAL_SUPPORT_COVERAGE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "INFRASTRUCTURE", phase: "EVALUATE_CANDIDATES", hookId: "P50_P51_GENERAL_SUPPORT_NETWORK_VALUE" },
      { domain: "LAND_WAR", phase: "EVALUATE_CANDIDATES", hookId: "P50_P51_DUAL_SUPPORT_FRONT_VALUE" },
    ],
  },
  {
    id: "LAYERED_COUNTERINTELLIGENCE",
    match: { allTraitIds: ["P45", "P49"] },
    addsThemes: ["INFORMATION", "POSITIONAL_CONTROL", "FORCE_PRESERVATION"],
    addsAffordances: ["GAIN_INFORMATION_ADVANTAGE", "PROTECT_HIGH_VALUE_ASSET"],
    signalSupport: [
      { evaluator: "THREAT", hookId: "P45_P49_LAYERED_EXPOSURE_THREAT" },
      { evaluator: "FORECAST", hookId: "P45_P49_LAYERED_CONCEALMENT_FORECAST" },
    ],
    plannerSupport: [
      { domain: "OBSERVATION", phase: "EVALUATE_CANDIDATES", hookId: "P45_P49_LAYERED_BLACKOUT_POSITION_VALUE" },
      { domain: "DEFENSE", phase: "EVALUATE_CANDIDATES", hookId: "P45_P49_CONCEALED_ASSET_NETWORK_VALUE" },
    ],
  },
  {
    id: "SPLIT_STAR_START",
    match: { allTraitIds: ["P39", "P54"] },
    addsThemes: ["DISTRIBUTED_PLAY", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    addsAffordances: ["DISTRIBUTE_START", "MULTI_THEATER_ACCESS"],
    signalSupport: [
      { evaluator: "FORECAST", hookId: "P39_P54_SPLIT_STAR_EXPOSURE_FORECAST" },
    ],
    plannerSupport: [
      { domain: "SPAWN", phase: "ENRICH_INPUT", hookId: "P39_P54_SPLIT_STAR_SPAWN_SEMANTICS" },
      { domain: "SPAWN", phase: "EVALUATE_CANDIDATES", hookId: "P39_P54_SPLIT_STAR_PAIR_VALUE" },
    ],
  },
] as const;

export const OFFICIAL_AI_ORIGIN_SUPPORT_SUPPRESSIONS = [
  {
    id: "HYDROGEN_ONLY_SUPPRESSES_ONE_SHOT_MIRV",
    match: { allTraitIds: ["P25", "P26"] },
    suppresses: [{ traitId: "P26", wholeTraitSupport: true }],
  },
  {
    id: "NO_FALLOUT_CAPTURE_SUPPRESSES_FALLOUT_RESISTANCE_BYPASS",
    match: { allTraitIds: ["P16", "N05"] },
    suppresses: [{ traitId: "P16", wholeTraitSupport: true }],
  },
  {
    id: "NO_UPGRADES_SUPPRESSES_UPGRADE_DISCOUNT",
    match: { allTraitIds: ["P17", "N06"] },
    suppresses: [{ traitId: "P17", wholeTraitSupport: true }],
  },
  {
    id: "NO_WARSHIPS_SUPPRESSES_WARSHIP_DEPENDENT_SUPPORT",
    match: { allTraitIds: ["N12"] },
    suppresses: [
      { traitId: "P22", wholeTraitSupport: true },
      { traitId: "P23", wholeTraitSupport: true },
      { traitId: "P29", wholeTraitSupport: true },
      { traitId: "P30", wholeTraitSupport: true },
      { traitId: "P31", wholeTraitSupport: true },
      { traitId: "P42", wholeTraitSupport: true },
    ],
  },
  {
    id: "RAZED_SPOILS_SUPPRESS_CAPTURE_REWARD_SUPPORT",
    match: { allTraitIds: ["N17"] },
    suppresses: [
      { traitId: "P05", wholeTraitSupport: true },
      { traitId: "P34", wholeTraitSupport: true },
    ],
  },
  {
    id: "INVERTED_TRADE_CANCELS_FIRST_CAPTURE_PENALTY",
    match: { allTraitIds: ["N14", "N16"] },
    suppresses: [{ traitId: "N14", wholeTraitSupport: true }],
  },
  {
    id: "NO_UPGRADES_REMOVES_SILO_UPGRADE_PLANNING",
    match: { allTraitIds: ["N06", "P53"] },
    suppresses: [
      { traitId: "P53", plannerHookIds: ["P53_SILO_CHARGE_CAPACITY_UPGRADE_VALUE"] },
    ],
  },
] as const;
