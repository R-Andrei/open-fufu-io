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
] as const;

export const OFFICIAL_AI_ORIGIN_COMBINATION_SUPPORT = [] as const;
