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
] as const;

export const OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT = [] as const;
