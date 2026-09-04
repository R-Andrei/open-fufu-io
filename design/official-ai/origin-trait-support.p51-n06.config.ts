// Open Fufu Official-AI Origin trait support configuration, P51-P54 + N01-N06.
//
// DESIGN-TIME SOURCE OF TRUTH.
// Mechanical values remain authoritative in the Origin/game rules. This file
// contains only AI support metadata and registered support-hook identities.

export const OFFICIAL_AI_ORIGIN_TRAIT_SUPPORT_P51_N06 = [
  {
    traitId: "P51",
    mode: "EXTENDED",
    themes: ["FORTIFICATION", "INFRASTRUCTURE", "POSITIONAL_CONTROL", "FORCE_PRESERVATION"],
    affordances: ["HOLD_GROUND", "PROTECT_HIGH_VALUE_ASSET"],
    cautions: [],
    synergyTags: ["OFFENSE", "DEFENSE"],
    signalSupport: [
      {
        evaluator: "THREAT",
        hookId: "P51_COMMAND_DEFENSE_COVERAGE_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "P51_COMMAND_GENERAL_SUPPORT_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P51_COMMAND_DUAL_SUPPORT_PLACEMENT_VALUE",
      },
      {
        domain: "DEFENSE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P51_COMMAND_DEFENSIVE_SUPPORT_VALUE",
      },
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
      {
        evaluator: "ECONOMY",
        hookId: "P52_EMPTY_CAPACITY_PASSIVE_FFY",
      },
      {
        evaluator: "FORECAST",
        hookId: "P52_POPULATION_CAPACITY_GAP_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "EXPANSION",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P52_CAPACITY_ACQUISITION_FFY_VALUE",
      },
      {
        domain: "SPENDING",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P52_POPULATION_EXPENDITURE_INCOME_TRADEOFF",
      },
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
      {
        evaluator: "ECONOMY",
        hookId: "P53_READY_SILO_CHARGE_INCOME",
      },
      {
        evaluator: "FORECAST",
        hookId: "P53_CHARGE_SPEND_INCOME_DOWNTIME_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "INFRASTRUCTURE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P53_SILO_ECONOMY_PLACEMENT_VALUE",
      },
      {
        domain: "UPGRADE",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P53_SILO_CHARGE_CAPACITY_UPGRADE_VALUE",
      },
      {
        domain: "STRATEGIC_WEAPONS",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P53_READY_CHARGE_INCOME_OPPORTUNITY_COST",
      },
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
      {
        evaluator: "TERRITORY",
        hookId: "P54_STAR_FOOTPRINT_POSITION_VALUE",
      },
      {
        evaluator: "FORECAST",
        hookId: "P54_STAR_FOOTPRINT_EXPOSURE_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "SPAWN",
        phase: "ENRICH_INPUT",
        hookId: "P54_STAR_FOOTPRINT_SEMANTICS",
      },
      {
        domain: "SPAWN",
        phase: "EVALUATE_CANDIDATES",
        hookId: "P54_STAR_SPAWN_POSITION_VALUE",
      },
    ],
  },
  {
    traitId: "N01",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["POPULATION_GROWTH"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N02",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "OFFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N03",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "DEFENSE"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N04",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: ["TERRAIN_DEPENDENCE"],
    synergyTags: ["TERRAIN_SPECIALIZATION", "ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
  {
    traitId: "N05",
    mode: "EXTENDED",
    themes: [],
    affordances: [],
    cautions: ["SELF_GEOMETRY_RISK"],
    synergyTags: ["FALLOUT"],
    signalSupport: [
      {
        evaluator: "TERRITORY",
        hookId: "N05_UNCAPTURABLE_FALLOUT_GEOMETRY",
      },
      {
        evaluator: "THREAT",
        hookId: "N05_FALLOUT_BARRIER_THREAT",
      },
      {
        evaluator: "FORECAST",
        hookId: "N05_FALLOUT_OWNERSHIP_BARRIER_FORECAST",
      },
    ],
    plannerSupport: [
      {
        domain: "EXPANSION",
        phase: "ENRICH_INPUT",
        hookId: "N05_FALLOUT_CAPTURE_PROHIBITION_SEMANTICS",
      },
      {
        domain: "LAND_WAR",
        phase: "EVALUATE_CANDIDATES",
        hookId: "N05_FALLOUT_DEPENDENT_PLAN_REJECTION",
      },
    ],
  },
  {
    traitId: "N06",
    mode: "GENERIC",
    themes: [],
    affordances: [],
    cautions: [],
    synergyTags: ["ECONOMY"],
    signalSupport: [],
    plannerSupport: [],
  },
] as const;
