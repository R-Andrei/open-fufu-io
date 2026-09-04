// Open Fufu Official-AI Origin trait support configuration, N17-N18.
//
// DESIGN-TIME SOURCE OF TRUTH.
// Mechanical values remain authoritative in the Origin/game rules. This file
// contains only AI support metadata and registered support-hook identities.

export const OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT_N17_N18 = [
  {
    traitId: "N17",
    mode: "EXTENDED",
    themes: ["RAIDING", "TERRITORIAL_SHAPING", "SPECIALIZATION"],
    affordances: ["RAID_INFRASTRUCTURE"],
    cautions: [],
    synergyTags: ["OFFENSE", "ECONOMY"],
    signalSupport: [
      {
        evaluator: "OPPORTUNITY",
        hookId: "N17_STRUCTURE_DESTRUCTION_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "N17_CONQUEST_STRUCTURE_DESTRUCTION_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "LAND_WAR",
        phase: "ENRICH_INPUT",
        hookId: "N17_STRUCTURE_RAZE_SEMANTICS",
      },
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N17_STRUCTURE_DENIAL_TARGET_VALUE",
      },
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
