// Open Fufu Official-AI Baseline and character configuration.
//
// DESIGN-TIME SOURCE OF TRUTH.
// This file owns the exact concrete CharacterProfile mappings used by the
// Difficulty-0 Baseline and the 20 Official character presets.
//
// Difficulty, display/source metadata, Echo rewards, and allowed-Origin pools
// remain owned by OFFICIAL_AI_PRESETS.md and are intentionally not duplicated
// here. Gameplay mechanics and Origin mechanics remain owned by their own
// canonical rule/configuration sources.
//
// Character batches are appended to this single file. Do not create range or
// batch shards.

export const OFFICIAL_AI_BASELINE_CHARACTER_PROFILE = {
  id: "BASELINE_D0",

  evaluators: {
    territory: "LOCAL",
    economy: "BUDGET",
    opponent: "NONE",
    forecast: "IMMEDIATE",
    threat: "IMMEDIATE",
    opportunity: "OBVIOUS",
  },

  planners: {
    expansion: "NEAREST",
    landWar: "DIRECT",
    defense: "EVEN",
    counterResponse: "SIMPLE",
    retreat: "EMERGENCY",
    spending: "BASIC",
    infrastructure: "USEFUL",
    upgrade: "AFFORDABLE",
    armor: "LOCAL",
    naval: "LOCAL",
    amphibious: "BASIC",
    strategicWeapons: "OBVIOUS_TARGET",
    observation: "COVERAGE",
    team: "BASIC",
    spawn: "SAFE",
    spawnReconsider: "STATIC",
  },

  doctrine: {
    defaultJudgment: "ACCEPT",

    goalKinds: {
      SURVIVE: "REQUIRE",
      STABILIZE: "PREFER",
      DEFEND: "PREFER",
      REPEL: "PREFER",
      SACRIFICE: "DISLIKE",
    },

    motives: {
      SURVIVAL: "PREFER",
      PRESERVATION: "PREFER",
    },

    resourceAttitudes: {
      POPULATION: "CONSERVE",
      FFY: "SPEND",
      TERRITORY: "TRADE",
      INFRASTRUCTURE: "CONSERVE",
      ARMOR: "CONSERVE",
      NAVAL_ASSETS: "CONSERVE",
      STRATEGIC_WEAPON_CHARGES: "SPEND",
      ALLY_POSITION: "TRADE",
    },

    conditionalRules: [],
    customHooks: [],
  },

  goalGenerator: {
    ruleSets: [
      "CORE_SURVIVAL",
      "CORE_EXPANSION",
      "CORE_ECONOMY",
      "CORE_INFRASTRUCTURE",
      "CORE_DEFENSE",
      "CORE_COUNTER_RESPONSE",
      "CORE_LAND_WAR",
      "CORE_ARMOR",
      "CORE_NAVAL",
      "CORE_AMPHIBIOUS",
      "CORE_STRATEGIC_WEAPONS",
      "CORE_OBSERVATION",
      "CORE_TEAM_SUPPORT",
    ],
    customRules: [],
  },

  arbiter: {
    kind: "SIMPLE_PRIORITY",
    maxPrimary: 1,
    maxSecondary: 0,
    maxBackground: 1,
    defaultResourcePosture: "BALANCED",
    customRules: [],
    customHooks: [],
  },

  persistence: {
    kind: "REACTIVE",
    temperament: "FLEXIBLE",
    rules: [],
    hooks: [],
  },

  expression: {
    defaultLeeway: "STRICT",
    rules: [],
    hooks: [],
  },

  // Baseline receives the complete generic Origin literacy supplied by the
  // selected OriginStrategicProfile, but has no character-specific Origin
  // preferences or overrides. Low-tier evaluators/planners still bound what it
  // can understand and exploit strategically.
  originAdaptation: {},

  // Baseline is intentionally not a character. Fidelity therefore checks for
  // the absence of a strong authored personality rather than for a fictional
  // identity.
  fidelity: {
    rules: [],
    customChecks: ["BASELINE_GENERIC_NO_CHARACTER_SIGNATURE"],
  },
} as const;

export const OFFICIAL_AI_CHARACTER_CONFIGURATIONS = [
  OFFICIAL_AI_BASELINE_CHARACTER_PROFILE,
] as const;
