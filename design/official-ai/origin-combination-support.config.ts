// Open Fufu Official-AI Origin combination/suppression support.
//
// DESIGN-TIME SOURCE OF TRUTH.
// Additive combination entries describe strategic possibilities that are more
// than the ordinary sum of their individual trait-support entries.
// Suppression entries remove AI-support semantics made impossible or exactly
// neutralized by another selected trait. They never change gameplay mechanics.

export const OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT = [
  {
    id: "TRAIN_POPULATION_ENGINE_ACCELERATION",
    match: { allTraitIds: ["P07", "P33"] },
    addsThemes: ["GROWTH", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING"],
    addsAffordances: ["SCALE_GROWTH", "SCALE_INDUSTRY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "P07_P33_RAIL_DEMOGRAPHIC_SYNERGY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P07_P33_TRAIN_POPULATION_THROUGHPUT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P07_P33_TRAIN_CITY_THROUGHPUT_VALUE",
      },
    ],
  },
  {
    id: "CONQUEST_FACTORY_SNOWBALL",
    match: { allTraitIds: ["P05", "P34"] },
    addsThemes: ["RAIDING", "INDUSTRIALIZATION", "ECONOMIC_COMPOUNDING"],
    addsAffordances: ["RAID_INFRASTRUCTURE", "SCALE_INDUSTRY"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "P05_P34_FACTORY_CONQUEST_SNOWBALL",
      },
      {
        evaluator: "FORECAST",
        hookId: "P05_P34_FACTORY_CAPTURE_COMBINED_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P05_P34_FACTORY_CAPTURE_COMBINED_VALUE",
      },
    ],
  },
  {
    id: "CONQUEST_ONLY_INDUSTRY",
    match: { allTraitIds: ["P34", "N09"] },
    addsThemes: ["RAIDING", "INDUSTRIALIZATION", "SPECIALIZATION"],
    addsAffordances: ["RAID_INFRASTRUCTURE"],
    addsCautions: ["INFRASTRUCTURE_DEPENDENCE"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "P34_N09_CONQUEST_ONLY_FACTORY_OPPORTUNITY",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P34_N09_FACTORY_ACQUISITION_PRIORITY",
      },
    ],
  },
  {
    id: "REVERSIBLE_SCORCHED_EARTH",
    match: { allTraitIds: ["P16", "P35"] },
    addsThemes: ["TERRITORIAL_SHAPING", "SACRIFICE", "POSITIONAL_CONTROL"],
    addsAffordances: ["DENY_AREA", "SHAPE_TERRITORY"],
    signalSupport: [
      {
        evaluator: "FORECAST",
        hookId: "P16_P35_REACQUISITION_ADVANTAGE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "RETREAT",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P16_P35_REVERSIBLE_SCORCHED_EARTH_VALUE",
      },
    ],
  },
  {
    id: "VETERAN_MOBILE_MIRV_PLATFORM",
    match: { allTraitIds: ["P22", "P29"] },
    addsThemes: ["NAVAL_PROJECTION", "DETERRENCE", "SPECIALIZATION"],
    addsAffordances: ["LAUNCH_FROM_MOBILE_PLATFORM"],
    signalSupport: [
      {
        evaluator: "FORECAST",
        hookId: "P22_P29_RANK5_MOBILE_MIRV_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P22_P29_VETERAN_LAUNCHER_PROGRESSION_VALUE",
      },
      {
        domain: "STRATEGIC_WEAPONS",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P22_P29_MOBILE_MIRV_PLATFORM_VALUE",
      },
    ],
  },
  {
    id: "RADIOACTIVE_HEAVY_ARTILLERY",
    match: { allTraitIds: ["P43", "P44"] },
    addsThemes: ["SIEGE", "TERRITORIAL_SHAPING", "POSITIONAL_CONTROL"],
    addsAffordances: ["ERODE_TERRITORY_AT_RANGE"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "P43_P44_STANDOFF_FALLOUT_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P43_P44_STANDOFF_TERRITORY_EROSION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "ARMOR",
        phase: "AUGMENT_CANDIDATES",
        hookId: "P43_P44_STANDOFF_FALLOUT_BOMBARDMENT",
      },
      {
        domain: "ARMOR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P43_P44_STANDOFF_FALLOUT_VALUE",
      },
    ],
  },
  {
    id: "POPULATION_SCALED_GIANT_SAM_NETWORK",
    match: { allTraitIds: ["P11", "P40"] },
    addsThemes: ["FORTIFICATION", "DETERRENCE", "POSITIONAL_CONTROL"],
    addsAffordances: ["INTERCEPT_OVER_LARGE_AREA", "PROTECT_HIGH_VALUE_ASSET"],
    signalSupport: [
      {
        evaluator: "FORECAST",
        hookId: "P11_P40_GIANT_SAM_NETWORK_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P11_P40_DISTRIBUTED_SINGLE_CHARGE_NETWORK_VALUE",
      },
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P11_P40_GIANT_SAM_COVERAGE_PORTFOLIO_VALUE",
      },
    ],
  },
  {
    id: "ELITE_SINGLE_FLAGSHIP_PROGRESSION",
    match: { allTraitIds: ["P22", "P23"] },
    addsThemes: ["DECISIVE_FORCE", "FORCE_PRESERVATION", "SPECIALIZATION"],
    addsAffordances: ["PRESERVE_FORCE", "PROJECT_FROM_SEA"],
    signalSupport: [
      {
        evaluator: "THREAT",
        hookId: "P22_P23_VETERAN_FLAGSHIP_LOSS_THREAT",
      },
    ],
    plannerSupport: [
      {
        domain: "NAVAL",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P22_P23_ELITE_FLAGSHIP_PROGRESSION_VALUE",
      },
    ],
  },
  {
    id: "DUAL_GENERAL_SUPPORT_NETWORK",
    match: { allTraitIds: ["P50", "P51"] },
    addsThemes: ["INFRASTRUCTURE", "POSITIONAL_CONTROL", "FORTIFICATION"],
    addsAffordances: ["HOLD_GROUND", "CREATE_BREAKTHROUGH", "PROTECT_HIGH_VALUE_ASSET"],
    signalSupport: [
      {
        evaluator: "FORECAST",
        hookId: "P50_P51_DUAL_SUPPORT_COVERAGE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P50_P51_GENERAL_SUPPORT_NETWORK_VALUE",
      },
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P50_P51_DUAL_SUPPORT_FRONT_VALUE",
      },
    ],
  },
  {
    id: "LAYERED_COUNTERINTELLIGENCE",
    match: { allTraitIds: ["P45", "P49"] },
    addsThemes: ["INFORMATION", "POSITIONAL_CONTROL", "FORCE_PRESERVATION"],
    addsAffordances: ["GAIN_INFORMATION_ADVANTAGE", "PROTECT_HIGH_VALUE_ASSET"],
    signalSupport: [
      {
        evaluator: "THREAT",
        hookId: "P45_P49_LAYERED_EXPOSURE_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "P45_P49_LAYERED_CONCEALMENT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "OBSERVATION",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P45_P49_LAYERED_BLACKOUT_POSITION_VALUE",
      },
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P45_P49_CONCEALED_ASSET_NETWORK_VALUE",
      },
    ],
  },
  {
    id: "SPLIT_STAR_START",
    match: { allTraitIds: ["P39", "P54"] },
    addsThemes: ["DISTRIBUTED_PLAY", "POSITIONAL_CONTROL", "SPECIALIZATION"],
    addsAffordances: ["DISTRIBUTE_START", "MULTI_THEATER_ACCESS"],
    signalSupport: [
      {
        evaluator: "FORECAST",
        hookId: "P39_P54_SPLIT_STAR_EXPOSURE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "SPAWN",
        phase: "ENRICH_INPUT",
        hookId: "P39_P54_SPLIT_STAR_SPAWN_SEMANTICS",
      },
      {
        domain: "SPAWN",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P39_P54_SPLIT_STAR_PAIR_VALUE",
      },
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
      {
        traitId: "P53",
        plannerHookIds: ["P53_SILO_CHARGE_CAPACITY_UPGRADE_VALUE"],
      },
    ],
  },
] as const;
