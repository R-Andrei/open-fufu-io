// Open Fufu Official-AI Origin trait support configuration.
//
// DESIGN-TIME SOURCE OF TRUTH.
// This file is intentionally outside runtime `src/` until the Official-AI
// implementation phase. It is valid TypeScript and should migrate cleanly
// into implementation code once the runtime types/registries exist.
//
// Mechanical values remain authoritative in the Origin/game rules. This file
// contains only AI support metadata and registered support-hook identities.

export const OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT = [
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P05_STRUCTURE_CAPTURE_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P05_STRUCTURE_CAPTURE_FFY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P05_STRUCTURE_CAPTURE_TARGET_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P11_SAM_SLOT_UNLOCK_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P11_PEAK_POPULATION_UNLOCK_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P11_FREE_SAM_NETWORK_VALUE",
      },
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
      {
        evaluator: "ECONOMY",
        hookId: "P17_STRUCTURE_COUNT_UPGRADE_ECONOMY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P17_UPGRADE_SEQUENCE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P17_BUILD_VS_UPGRADE_SEQUENCE_VALUE",
      },
      {
        domain: "UPGRADE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P17_COMPOUNDING_UPGRADE_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P18_FORT_SOURCE_ATTACK_OPPORTUNITY",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P18_FORT_SOURCE_LANE_VALUE",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P18_OFFENSIVE_FORT_PLACEMENT_VALUE",
      },
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
      {
        evaluator: "TERRITORY",
        hookId: "P19_CONTACT_COUNT_POSITION_VALUE",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "P19_NEW_CONTACT_OFFENSE_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P19_CONTACT_CHANGE_OFFENSE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "EXPANSION",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P19_CONTACT_CREATING_EXPANSION_VALUE",
      },
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
      {
        evaluator: "ECONOMY",
        hookId: "P21_FIRST_PURCHASE_SAVINGS_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P21_FIRST_PURCHASE_LIQUIDITY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P21_FIRST_PURCHASE_OPPORTUNITY_COST",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P21_FIRST_PURCHASE_STRUCTURE_VALUE",
      },
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
      {
        evaluator: "THREAT",
        hookId: "P23_FLAGSHIP_LOSS_THREAT",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "ENRICH_INPUT",
        hookId: "P23_SINGLE_WARSHIP_CAP_SEMANTICS",
      },
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P23_FLAGSHIP_THEATER_VALUE",
      },
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
      {
        evaluator: "ECONOMY",
        hookId: "P24_FORT_AREA_EVENT_YIELD",
      },
      {
        evaluator: "FORECAST",
        hookId: "P24_FORT_ECONOMY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P24_ECONOMIC_FORT_PLACEMENT_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P26_ONE_SHOT_MIRV_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P26_MIRV_RESERVATION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "STRATEGIC_WEAPONS",
        phase: "ENRICH_INPUT",
        hookId: "P26_SINGLE_USE_MIRV_SEMANTICS",
      },
      {
        domain: "STRATEGIC_WEAPONS",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P26_ONE_SHOT_MIRV_VALUE",
      },
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P26_MIRV_LIQUIDITY_RESERVE_VALUE",
      },
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
      {
        evaluator: "THREAT",
        hookId: "P27_SAM_ANTI_SHIP_COVERAGE",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "P27_SHIP_DENIAL_OPPORTUNITY",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P27_COASTAL_SAM_PLACEMENT_VALUE",
      },
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P27_ANTI_SHIP_SAM_DEFENSE_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P28_TRANSPORT_POPULATION_BOUNTY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P28_CAPTURED_POPULATION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P28_TRANSPORT_TARGET_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P29_MOBILE_LAUNCH_POSITION_OPPORTUNITY",
      },
      {
        evaluator: "THREAT",
        hookId: "P29_LAUNCHER_WARSHIP_EXPOSURE",
      },
      {
        evaluator: "FORECAST",
        hookId: "P29_MOBILE_LAUNCH_PATH_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P29_LAUNCHER_WARSHIP_POSITION_VALUE",
      },
      {
        domain: "STRATEGIC_WEAPONS",
        phase: "ENRICH_INPUT",
        hookId: "P29_WARSHIP_LAUNCHER_SEMANTICS",
      },
      {
        domain: "STRATEGIC_WEAPONS",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P29_MOBILE_LAUNCH_PLATFORM_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P30_PIRACY_TARGET_OPPORTUNITY",
      },
      {
        evaluator: "THREAT",
        hookId: "P30_HOSTILE_WARSHIP_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "P30_PIRACY_FFY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "ENRICH_INPUT",
        hookId: "P30_PIRACY_ONLY_WARSHIP_SEMANTICS",
      },
      {
        domain: "NAVAL",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P30_FAST_PIRACY_PATROLS",
      },
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P30_PIRACY_ROUTE_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P31_PORT_REPAIR_SUSTAIN_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P31_PORT_REPAIR_COMBAT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P31_REPAIR_FIELD_POSITION_VALUE",
      },
      {
        domain: "RETREAT",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P31_PORT_REPAIR_RETREAT_VALUE",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P31_NAVAL_REPAIR_PORT_PLACEMENT_VALUE",
      },
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
      {
        evaluator: "THREAT",
        hookId: "P32_ARMORED_TRANSPORT_SURVIVABILITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P32_PORT_EMBARKATION_TRANSIT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "AMPHIBIOUS",
        phase: "ENRICH_INPUT",
        hookId: "P32_PORT_ONLY_ARMORED_TRANSPORT_SEMANTICS",
      },
      {
        domain: "AMPHIBIOUS",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P32_ARMORED_TRANSPORT_ROUTE_VALUE",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P32_TRANSPORT_PORT_ACCESS_VALUE",
      },
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
      {
        evaluator: "ECONOMY",
        hookId: "P33_TRAIN_CITY_POPULATION_ENGINE",
      },
      {
        evaluator: "FORECAST",
        hookId: "P33_TRAIN_POPULATION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P33_TRAIN_CITY_NETWORK_VALUE",
      },
      {
        domain: "UPGRADE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P33_CITY_LEVEL_POPULATION_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P34_CONQUERED_FACTORY_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P34_FACTORY_CAPTURE_PRODUCTION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P34_FACTORY_CAPTURE_TARGET_VALUE",
      },
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
      {
        evaluator: "TERRITORY",
        hookId: "P35_RELINQUISH_FALLOUT_POSITION_VALUE",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "P35_FALLOUT_DENIAL_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P35_RELINQUISH_FALLOUT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "RETREAT",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P35_FALLOUT_RELINQUISH_PLANS",
      },
      {
        domain: "RETREAT",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P35_FALLOUT_RELINQUISH_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P37_FORTIFIED_LANDING_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P37_LANDING_FORT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "AMPHIBIOUS",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P37_FORTIFIED_BEACHHEAD_VALUE",
      },
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
      {
        evaluator: "OPPORTUNITY",
        hookId: "P38_ELASTIC_DEFENSE_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P38_DEFENDER_SURVIVAL_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P38_DEFENDED_CELL_TRADE_VALUE",
      },
      {
        domain: "RETREAT",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P38_TERRITORY_TRADE_RETREAT_VALUE",
      },
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
      {
        evaluator: "TERRITORY",
        hookId: "P39_SPLIT_CORE_POSITION_VALUE",
      },
      {
        evaluator: "THREAT",
        hookId: "P39_SPLIT_CORE_ISOLATION_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "P39_SPLIT_SPAWN_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "SPAWN",
        phase: "ENRICH_INPUT",
        hookId: "P39_TWO_ORIGIN_SEMANTICS",
      },
      {
        domain: "SPAWN",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P39_SPLIT_SPAWN_CANDIDATES",
      },
      {
        domain: "SPAWN",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P39_SPLIT_SPAWN_PAIR_VALUE",
      },
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
      {
        evaluator: "THREAT",
        hookId: "P40_SINGLE_CHARGE_SAM_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "P40_INTERCEPTION_CHARGE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P40_GIANT_SAM_PLACEMENT_VALUE",
      },
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P40_SINGLE_CHARGE_DEFENSE_VALUE",
      },
    ],
  },
] as const;

export const OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT = [] as const;
