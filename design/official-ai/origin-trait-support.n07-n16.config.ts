// Open Fufu Official-AI Origin trait support configuration, N07-N16.
//
// DESIGN-TIME SOURCE OF TRUTH.
// Mechanical values remain authoritative in the Origin/game rules. This file
// contains only AI support metadata and registered support-hook identities.

export const OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT_N07_N16 = [
  {
    traitId: "N07",
    mode: "EXTENDED",
    themes: ["SPECIALIZATION", "INFRASTRUCTURE", "POSITIONAL_CONTROL"],
    affordances: [],
    cautions: ["EXPENSIVE_FAILURE"],
    synergyTags: ["ECONOMY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "N07_STRUCTURE_TYPE_SLOT_SCARCITY",
      },
      {
        evaluator: "THREAT",
        hookId: "N07_UNIQUE_STRUCTURE_LOSS_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "N07_ONE_PER_TYPE_OWNERSHIP_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "ENRICH_INPUT",
        hookId: "N07_ONE_PER_TYPE_OWNERSHIP_SEMANTICS",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N07_UNIQUE_STRUCTURE_PLACEMENT_VALUE",
      },
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N07_STRUCTURE_TYPE_SLOT_OPPORTUNITY_COST",
      },
    ],
  },
  {
    traitId: "N08",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["DEFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N09",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["INDUSTRIAL_ECONOMY", "TRAIN_ECONOMY", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N10",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["DEFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N11",
    mode: "EXTENDED",
    themes: [],
    affordances: [],
    cautions: ["SELF_GEOMETRY_RISK", "INFRASTRUCTURE_DEPENDENCE"],
    synergyTags: ["SAM_INTERCEPTION", "ECONOMY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "N11_SAM_AREA_ZERO_YIELD_ECONOMY",
      },
      {
        evaluator: "FORECAST",
        hookId: "N11_SAM_COVERAGE_ECONOMY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N11_SAM_ECONOMIC_EXCLUSION_PLACEMENT_VALUE",
      },
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N11_SAM_DEFENSE_VS_ECONOMY_TRADEOFF",
      },
    ],
  },
  {
    traitId: "N12",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["NAVAL", "WARSHIP"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N13",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["AMPHIBIOUS_LANDING"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N14",
    mode: "EXTENDED",
    themes: ["FORCE_PRESERVATION"],
    affordances: [],
    cautions: ["EXPENSIVE_FAILURE"],
    synergyTags: ["TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "N14_TRADE_CAPTURE_PENALTY_ECONOMY",
      },
      {
        evaluator: "THREAT",
        hookId: "N14_HOSTILE_TRADE_CAPTURE_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "N14_TRADE_CAPTURE_PENALTY_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N14_RISK_ADJUSTED_TRADE_NETWORK_VALUE",
      },
    ],
  },
  {
    traitId: "N15",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: ["HIGH_UPFRONT_COST"],
    synergyTags: ["AMPHIBIOUS_LANDING", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N16",
    mode: "EXTENDED",
    themes: ["TRADE", "SACRIFICE", "SPECIALIZATION"],
    affordances: [],
    cautions: [],
    synergyTags: ["TRADE_ECONOMY", "ECONOMY"],
    signalSupport: [
      {
        evaluator: "ECONOMY",
        hookId: "N16_INVERTED_TRADE_OUTCOME_VALUE",
      },
      {
        evaluator: "OPPORTUNITY",
        hookId: "N16_HOSTILE_CAPTURE_RECOVERY_OPPORTUNITY",
      },
      {
        evaluator: "FORECAST",
        hookId: "N16_TRADE_OUTCOME_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "ENRICH_INPUT",
        hookId: "N16_INVERTED_TRADE_SEMANTICS",
      },
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N16_INVERTED_TRADE_NETWORK_VALUE",
      },
    ],
  },
] as const;
