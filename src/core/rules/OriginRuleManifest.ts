import {
  GLOBAL_RULE_SCOPE,
  type RuleCondition,
  type RuleContribution,
  type RuleScope,
  type RuleStageId,
} from "./RuleComposition";
import type { RuleAxisId } from "./RuleAxisRegistry";

export type OriginTraitRuleClass =
  | "DECLARATIVE"
  | "DYNAMIC"
  | "MIXED"
  | "CUSTOM";
export type OriginTraitId = `P${string}` | `N${string}`;

export const RULE_COMPONENT = {
  HOSTILE_FORT_DEFENSIVE_PRESSURE: "HOSTILE_FORT_DEFENSIVE_PRESSURE",
  FALLOUT_ACQUISITION_RESISTANCE: "FALLOUT_ACQUISITION_RESISTANCE",
} as const;

export type OriginCustomRuleDomain =
  | "POPULATION_GROWTH_PROFILE_ANCHORS"
  | "STRUCTURE_CAPTURE_FFY_EVENT"
  | "FACTORY_DISPATCH_SCHEDULER"
  | "SAM_SLOT_ENTITLEMENT"
  | "STARTING_STRUCTURE_GRANT"
  | "FIRST_STRUCTURE_PURCHASE_ZERO_FFY"
  | "MIRV_USE_ENTITLEMENT"
  | "TRANSPORT_DESTRUCTION_POPULATION_TRANSFER"
  | "WARSHIP_STRATEGIC_LAUNCHER"
  | "WARSHIP_OPERATIONAL_DURING_PORT_REPAIR"
  | "TRAIN_CITY_POPULATION_GRANT"
  | "CONQUERED_FACTORY_EFFECT"
  | "RELINQUISHMENT_FALLOUT"
  | "SETTLEMENT_RESIDUAL_ACCOUNTING"
  | "LANDING_FORT_GRANT"
  | "AUTOMATIC_DEFENDER_SURVIVAL"
  | "DIRECT_LEVEL5_CITY_PURCHASE"
  | "RADIOACTIVE_ATTACK_AFTERSHOCK"
  | "FOREST_CONCEALMENT"
  | "MARSH_CAPTURE_POPULATION_PENALTY"
  | "MIRRORED_STRUCTURE_PRESSURE_FIELD"
  | "PASSIVE_FFY_SOURCE"
  | "TRANSPORT_LANDING_CASUALTY"
  | "TRADE_CAPTURE_VALUE"
  | "STRUCTURE_CAPTURE_DISPOSITION";

export type RuleStateDependency =
  | "OWNED_PERSISTENT_STRUCTURE_COUNT"
  | "TERRITORIAL_CONTACT_COUNT";

export type DynamicRuleFormula =
  | {
      readonly kind: "RATIONAL_POWER";
      readonly numerator: 99;
      readonly denominator: 100;
    }
  | {
      readonly kind: "PERCENT_BP_PER_COUNT";
      readonly bpPerUnit: 500;
    };

export interface DynamicRuleProvider {
  readonly id: string;
  readonly axis: RuleAxisId;
  readonly scope: RuleScope;
  readonly stage: RuleStageId;
  readonly operator: "MULTIPLY" | "ADD_PERCENT";
  readonly sourceKind: "ORIGIN";
  readonly sourceId: OriginTraitId;
  readonly valueUnit: "BASIS_POINTS";
  readonly dependency: RuleStateDependency;
  readonly formula: DynamicRuleFormula;
}

export type DynamicRuleResolvedValue =
  | {
      readonly kind: "RATIONAL";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "BASIS_POINTS"; readonly value: number };

export interface OriginTraitRuleManifestEntry {
  readonly id: OriginTraitId;
  readonly classification: OriginTraitRuleClass;
  readonly contributions: readonly RuleContribution[];
  readonly dynamicProviders: readonly DynamicRuleProvider[];
  readonly customDomains: readonly OriginCustomRuleDomain[];
  /** Boundary note only; trait mechanics remain canonical in the Origin catalogue. */
  readonly note?: string;
}

const scope = {
  global: GLOBAL_RULE_SCOPE,
  terrain: (
    terrain:
      | "PLAINS"
      | "HIGHLAND"
      | "MOUNTAIN"
      | "DESERT"
      | "FOREST"
      | "TUNDRA"
      | "MARSH"
      | "SHALLOW_WATER",
  ): RuleScope => ({ kind: "TERRAIN", terrain }),
  structure: (
    structure:
      | "ALL"
      | "CITY"
      | "FORT"
      | "PORT"
      | "FACTORY"
      | "MISSILE_SILO"
      | "SAM_LAUNCHER"
      | "OBSERVATION_POST"
      | "COMMAND_POST",
  ): RuleScope => ({ kind: "STRUCTURE", structure }),
  unit: (
    unit:
      | "ALL"
      | "TANK"
      | "HEAVY_ARTILLERY"
      | "WARSHIP"
      | "TRANSPORT_SHIP"
      | "TRADE_SHIP"
      | "TRAIN",
  ): RuleScope => ({ kind: "UNIT", unit }),
  weapon: (
    weapon: "ALL" | "ATOM_BOMB" | "HYDROGEN_BOMB" | "MIRV",
  ): RuleScope => ({ kind: "WEAPON", weapon }),
  ffy: (
    family:
      | "ALL"
      | "MILITARY_CONQUEST"
      | "NAVAL_TRADE"
      | "INDUSTRIAL"
      | "PIRACY",
  ): RuleScope => ({ kind: "FFY_FAMILY", family }),
};

function contribution(
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  stage: RuleContribution["stage"],
  operator: RuleContribution["operator"],
  valueUnit: RuleContribution["valueUnit"],
  value?: RuleContribution["value"],
  condition?: RuleCondition,
): RuleContribution {
  return {
    axis,
    scope: target,
    stage,
    operator,
    sourceKind: "ORIGIN",
    sourceId: id,
    valueUnit,
    ...(value === undefined ? {} : { value }),
    ...(condition === undefined ? {} : { condition }),
  };
}

const pct = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  bp: number,
  condition?: RuleCondition,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "ORIGIN_PERCENT",
    "ADD_PERCENT",
    "BASIS_POINTS",
    bp,
    condition,
  );

const scalar = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  bp: number,
  condition?: RuleCondition,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "ORIGIN_SCALAR",
    "MULTIPLY",
    "BASIS_POINTS",
    bp,
    condition,
  );

const replace = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  valueUnit: RuleContribution["valueUnit"],
  value: number,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "BASE_REPLACEMENT",
    "REPLACE_BASE",
    valueUnit,
    value,
  );

const hardZero = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  condition?: RuleCondition,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "TERMINAL",
    "HARD_ZERO",
    "NONE",
    undefined,
    condition,
  );

const permission = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  operator: "ALLOW" | "PROHIBIT",
  condition?: RuleCondition,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "PERMISSION",
    operator,
    "NONE",
    undefined,
    condition,
  );

const limit = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  value: number,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "ORIGIN_CAP",
    "CAP_LIMIT",
    "COUNT",
    value,
  );

const addCap = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  value: number,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "ORIGIN_CAP",
    "ADD_CAP",
    "COUNT",
    value,
  );

const suppress = (
  id: OriginTraitId,
  axis: RuleAxisId,
  component: string,
): RuleContribution =>
  contribution(
    id,
    axis,
    scope.global,
    "COMPONENT_SUPPRESSION",
    "SUPPRESS_COMPONENT",
    "COMPONENT_SET",
    component,
  );

const structural = (
  id: OriginTraitId,
  axis: RuleAxisId,
  target: RuleScope,
  profile: string,
): RuleContribution =>
  contribution(
    id,
    axis,
    target,
    "STRUCTURAL_PROFILE",
    "STRUCTURAL_TRANSFORM",
    "PROFILE_ID",
    profile,
  );

const dynamic = (
  id: OriginTraitId,
  providerId: string,
  axis: RuleAxisId,
  target: RuleScope,
  stage: "ORIGIN_SCALAR" | "CONTEXTUAL_PERCENT",
  operator: "MULTIPLY" | "ADD_PERCENT",
  dependency: RuleStateDependency,
  formula: DynamicRuleFormula,
): DynamicRuleProvider => ({
  id: providerId,
  axis,
  scope: target,
  stage,
  operator,
  sourceKind: "ORIGIN",
  sourceId: id,
  valueUnit: "BASIS_POINTS",
  dependency,
  formula,
});

function traitIds(prefix: "P" | "N", count: number): OriginTraitId[] {
  return Array.from(
    { length: count },
    (_, index) =>
      `${prefix}${String(index + 1).padStart(2, "0")}` as OriginTraitId,
  );
}

export const EXPECTED_ORIGIN_TRAIT_IDS = Object.freeze([
  ...traitIds("P", 54),
  ...traitIds("N", 18),
]);

const entries = new Map<OriginTraitId, OriginTraitRuleManifestEntry>();

function define(
  id: OriginTraitId,
  classification: OriginTraitRuleClass,
  options: {
    readonly contributions?: readonly RuleContribution[];
    readonly dynamicProviders?: readonly DynamicRuleProvider[];
    readonly customDomains?: readonly OriginCustomRuleDomain[];
    readonly note?: string;
  } = {},
): void {
  if (entries.has(id)) throw new Error(`Duplicate Origin manifest entry ${id}`);
  const contributions = options.contributions ?? [];
  const dynamicProviders = options.dynamicProviders ?? [];
  const customDomains = options.customDomains ?? [];
  if (
    classification === "DECLARATIVE" &&
    (dynamicProviders.length > 0 || customDomains.length > 0)
  ) {
    throw new Error(`${id} is DECLARATIVE but declares dynamic/custom behavior`);
  }
  if (classification === "DYNAMIC" && dynamicProviders.length === 0) {
    throw new Error(`${id} is DYNAMIC but declares no dynamic provider`);
  }
  if (classification === "CUSTOM" && customDomains.length === 0) {
    throw new Error(`${id} is CUSTOM but declares no custom domain`);
  }
  entries.set(id, {
    id,
    classification,
    contributions,
    dynamicProviders,
    customDomains,
    ...(options.note === undefined ? {} : { note: options.note }),
  });
}

function custom(
  id: OriginTraitId,
  domain: OriginCustomRuleDomain | readonly OriginCustomRuleDomain[],
  note: string,
): void {
  define(id, "CUSTOM", {
    customDomains: Array.isArray(domain) ? domain : [domain],
    note,
  });
}

define("P01", "DECLARATIVE", {
  contributions: [pct("P01", "INITIAL_TERRITORY_QUOTA", scope.global, 1500)],
});
define("P02", "MIXED", {
  contributions: [
    structural(
      "P02",
      "POPULATION_GROWTH_UTILIZATION_PROFILE",
      scope.global,
      "ORIGIN_P02_30_70",
    ),
  ],
  customDomains: ["POPULATION_GROWTH_PROFILE_ANCHORS"],
  note: "The replacement profile is typed here; exact 30–70% curve anchors remain Population-mechanics-owned.",
});
define("P03", "DECLARATIVE", {
  contributions: [
    suppress(
      "P03",
      "LAND_PRESSURE_SUPPRESSED_COMPONENTS",
      RULE_COMPONENT.HOSTILE_FORT_DEFENSIVE_PRESSURE,
    ),
  ],
});
define("P04", "DECLARATIVE", {
  contributions: [
    contribution(
      "P04",
      "COUNTER_RESPONSE_EFFECTIVENESS",
      scope.global,
      "FINAL_OVERRIDE",
      "FINAL_OVERRIDE",
      "RATIO",
      1,
    ),
  ],
});
custom(
  "P05",
  "STRUCTURE_CAPTURE_FFY_EVENT",
  "Successful qualifying structure transfer creates a Military/conquest FFY event; event base value/location remain FFY-owner inputs.",
);
define("P06", "DECLARATIVE", {
  contributions: [
    pct("P06", "UNIT_MOVEMENT_SPEED", scope.unit("TRADE_SHIP"), 2500),
  ],
});
custom(
  "P07",
  "FACTORY_DISPATCH_SCHEDULER",
  "Every fourth ordinary primary Factory Train dispatch creates a bonus Train.",
);
define("P08", "DECLARATIVE", {
  contributions: [
    replace(
      "P08",
      "EXTERNAL_TRADE_WARTIME_MULTIPLIER",
      scope.global,
      "RATIO",
      1,
    ),
  ],
});
define("P09", "DECLARATIVE", {
  contributions: [
    pct(
      "P09",
      "STRUCTURE_FIELD_COVERAGE_AREA",
      scope.structure("FORT"),
      1000,
    ),
    pct(
      "P09",
      "STRUCTURE_PRESSURE_MAGNITUDE",
      scope.structure("FORT"),
      900,
    ),
    pct("P09", "STRUCTURE_BUILD_COST", scope.structure("FORT"), -800),
    pct("P09", "STRUCTURE_UPGRADE_COST", scope.structure("FORT"), -800),
  ],
});
define("P10", "DECLARATIVE", {
  contributions: [
    pct("P10", "WEAPON_PROJECTILE_SPEED", scope.weapon("ALL"), 10_000),
  ],
  note: "Projectile-family/stage membership remains owned by the strategic-weapon subsystem.",
});
define("P11", "MIXED", {
  contributions: [
    hardZero("P11", "STRUCTURE_BUILD_COST", scope.structure("SAM_LAUNCHER")),
  ],
  customDomains: ["SAM_SLOT_ENTITLEMENT"],
  note: "Peak-Population SAM-slot entitlement remains lifecycle state.",
});
define("P12", "DECLARATIVE", {
  contributions: [
    pct("P12", "UNIT_MOVEMENT_SPEED", scope.unit("TRANSPORT_SHIP"), 2500),
  ],
});
define("P13", "DECLARATIVE", {
  contributions: [
    pct(
      "P13",
      "TERRAIN_DEFENSIVE_PRESSURE",
      scope.terrain("MOUNTAIN"),
      3300,
    ),
  ],
});
define("P14", "DECLARATIVE", {
  contributions: [
    pct("P14", "FFY_EVENT_YIELD", scope.ffy("ALL"), 3300, {
      kind: "EVENT_TERRAIN_IS",
      terrain: "DESERT",
    }),
  ],
});
define("P15", "DECLARATIVE", {
  contributions: [
    pct(
      "P15",
      "TERRAIN_OFFENSIVE_PRESSURE",
      scope.terrain("HIGHLAND"),
      3300,
    ),
  ],
});
define("P16", "DECLARATIVE", {
  contributions: [
    suppress(
      "P16",
      "ACQUISITION_SUPPRESSED_COMPONENTS",
      RULE_COMPONENT.FALLOUT_ACQUISITION_RESISTANCE,
    ),
  ],
});
define("P17", "DYNAMIC", {
  dynamicProviders: [
    dynamic(
      "P17",
      "P17_UPGRADE_DISCOUNT",
      "STRUCTURE_UPGRADE_COST",
      scope.structure("ALL"),
      "ORIGIN_SCALAR",
      "MULTIPLY",
      "OWNED_PERSISTENT_STRUCTURE_COUNT",
      { kind: "RATIONAL_POWER", numerator: 99, denominator: 100 },
    ),
  ],
  note: "Dynamic multiplier is exactly (99/100)^S where S is current owned persistent-structure count.",
});
define("P18", "DECLARATIVE", {
  contributions: [
    pct(
      "P18",
      "GLOBAL_OFFENSIVE_PRESSURE",
      scope.global,
      10_000,
      { kind: "SOURCE_INSIDE_FIELD", field: "FORT" },
    ),
  ],
});
define("P19", "DYNAMIC", {
  dynamicProviders: [
    dynamic(
      "P19",
      "P19_CONTACT_OFFENSE",
      "GLOBAL_OFFENSIVE_PRESSURE",
      scope.global,
      "CONTEXTUAL_PERCENT",
      "ADD_PERCENT",
      "TERRITORIAL_CONTACT_COUNT",
      { kind: "PERCENT_BP_PER_COUNT", bpPerUnit: 500 },
    ),
  ],
  note: "Dynamic contextual contribution is +500 bp per distinct active other faction with Territorial Contact.",
});
custom(
  "P20",
  "STARTING_STRUCTURE_GRANT",
  "One free starting Missile Silo; Strategic Spawn owns exact placement/order and strategic weapons own initial charge readiness.",
);
custom(
  "P21",
  "FIRST_STRUCTURE_PURCHASE_ZERO_FFY",
  "First successful purchase per persistent-structure type consumes zero FFY after ordinary legality and affordability.",
);
define("P22", "DECLARATIVE", {
  contributions: [addCap("P22", "UNIT_MAX_RANK", scope.unit("WARSHIP"), 2)],
});
define("P23", "DECLARATIVE", {
  contributions: [
    pct("P23", "UNIT_ATTACK_RANGE", scope.unit("WARSHIP"), 2000),
    pct("P23", "UNIT_DAMAGE", scope.unit("WARSHIP"), 2000),
    pct("P23", "UNIT_MOVEMENT_SPEED", scope.unit("WARSHIP"), 2000),
    limit("P23", "UNIT_OWNERSHIP_CAP", scope.unit("WARSHIP"), 1),
  ],
});
define("P24", "DECLARATIVE", {
  contributions: [
    pct("P24", "FFY_EVENT_YIELD", scope.ffy("ALL"), 2000, {
      kind: "EVENT_INSIDE_FIELD",
      field: "FORT",
    }),
  ],
});
define("P25", "DECLARATIVE", {
  contributions: [
    permission(
      "P25",
      "WEAPON_USE_PERMISSION",
      scope.weapon("ATOM_BOMB"),
      "PROHIBIT",
    ),
    permission(
      "P25",
      "WEAPON_USE_PERMISSION",
      scope.weapon("MIRV"),
      "PROHIBIT",
    ),
    pct("P25", "WEAPON_BLAST_AREA", scope.weapon("HYDROGEN_BOMB"), 5000),
    pct(
      "P25",
      "WEAPON_PURCHASE_FFY_COST",
      scope.weapon("HYDROGEN_BOMB"),
      5000,
    ),
  ],
});
custom(
  "P26",
  "MIRV_USE_ENTITLEMENT",
  "At most one successful MIRV; ordinary legality/affordability remain and the successful use consumes zero FFY.",
);
define("P27", "DECLARATIVE", {
  contributions: [
    contribution(
      "P27",
      "STRUCTURE_ATTACK_CAPABILITIES",
      scope.structure("SAM_LAUNCHER"),
      "CAPABILITY_ADD",
      "ADD_CAPABILITY",
      "CAPABILITY_SET",
      "ATTACK_SHIPS",
    ),
  ],
  note: "Exact anti-ship target selection, damage, cadence, charge arbitration, and priority remain SAM-owner mechanics.",
});
custom(
  "P28",
  "TRANSPORT_DESTRUCTION_POPULATION_TRANSFER",
  "Qualifying Transport destruction transfers carried Population; attribution/recipient/order remain amphibious-owner semantics.",
);
custom(
  "P29",
  "WARSHIP_STRATEGIC_LAUNCHER",
  "Warship becomes a strategic launcher with effective Silo level max(1, rank); charge/readiness lifecycle remains strategic-weapon-owned.",
);
define("P30", "DECLARATIVE", {
  contributions: [
    pct("P30", "UNIT_MOVEMENT_SPEED", scope.unit("WARSHIP"), 5000),
    scalar("P30", "FFY_EVENT_YIELD", scope.ffy("PIRACY"), 30_000),
    contribution(
      "P30",
      "UNIT_ATTACK_CAPABILITIES",
      scope.unit("WARSHIP"),
      "CAPABILITY_REMOVE",
      "REMOVE_CAPABILITY",
      "CAPABILITY_SET",
      "NAVAL_GUNFIRE_AGAINST_SHIPS",
    ),
  ],
});
define("P31", "MIXED", {
  contributions: [
    scalar(
      "P31",
      "STRUCTURE_REPAIR_RADIUS",
      scope.structure("PORT"),
      20_000,
      { kind: "TARGET_UNIT_IS", unit: "WARSHIP" },
    ),
    scalar(
      "P31",
      "STRUCTURE_REPAIR_RATE",
      scope.structure("PORT"),
      15_000,
      { kind: "TARGET_UNIT_IS", unit: "WARSHIP" },
    ),
  ],
  customDomains: ["WARSHIP_OPERATIONAL_DURING_PORT_REPAIR"],
  note: "Numeric Port repair specialization is declarative; remaining operational while repaired is an explicit non-scalar behavior.",
});
define("P32", "DECLARATIVE", {
  contributions: [
    structural(
      "P32",
      "UNIT_CHASSIS_PROFILE",
      scope.unit("TRANSPORT_SHIP"),
      "ARMORED_PORT_TRANSPORT",
    ),
  ],
});
custom(
  "P33",
  "TRAIN_CITY_POPULATION_GRANT",
  "Qualifying Train event at an owned City grants 20 × completed City level Available Population, Capacity-capped.",
);
custom(
  "P34",
  "CONQUERED_FACTORY_EFFECT",
  "Successfully transferred conquered Factories operate at 2× ordinary Factory effect while owned; transformed effect set remains Factory-owner semantics.",
);
custom(
  "P35",
  "RELINQUISHMENT_FALLOUT",
  "Deliberate relinquishment creates neutral Fallout until the next successful capture.",
);
define("P36", "MIXED", {
  contributions: [
    replace(
      "P36",
      "NEUTRAL_SETTLEMENT_POPULATION_COST",
      scope.global,
      "POPULATION",
      0.5,
    ),
  ],
  customDomains: ["SETTLEMENT_RESIDUAL_ACCOUNTING"],
  note: "Fractional debit residual accounting remains lifecycle state.",
});
define("P37", "MIXED", {
  contributions: [
    contribution(
      "P37",
      "TRANSPORT_EMBARK_COST",
      scope.global,
      "ORIGIN_FLAT",
      "ADD_FLAT",
      "FFY",
      250,
    ),
  ],
  customDomains: ["LANDING_FORT_GRANT"],
  note: "Successful landing additionally attempts one exact-cell active completed L1 Fort grant through canonical structure admission.",
});
custom(
  "P38",
  "AUTOMATIC_DEFENDER_SURVIVAL",
  "Automatic defender survives a successful capture of the defended cell and remains/returns Available.",
);
define("P39", "DECLARATIVE", {
  contributions: [
    structural("P39", "SPAWN_PROFILE", scope.global, "SPLIT_TWO"),
  ],
});
define("P40", "DECLARATIVE", {
  contributions: [
    pct(
      "P40",
      "STRUCTURE_INTERCEPTION_RANGE",
      scope.structure("SAM_LAUNCHER"),
      5000,
    ),
    limit(
      "P40",
      "STRUCTURE_CHARGE_CAPACITY",
      scope.structure("SAM_LAUNCHER"),
      1,
    ),
    scalar(
      "P40",
      "STRUCTURE_RECHARGE_TIME",
      scope.structure("SAM_LAUNCHER"),
      20_000,
    ),
  ],
});
custom(
  "P41",
  "DIRECT_LEVEL5_CITY_PURCHASE",
  "Purchased Cities are one direct-L5 transaction at 95% cumulative ordinary cost with the canonical City build duration.",
);
define("P42", "DECLARATIVE", {
  contributions: [
    hardZero("P42", "UNIT_PURCHASE_FFY_COST", scope.unit("WARSHIP")),
    replace(
      "P42",
      "UNIT_PURCHASE_POPULATION_COST",
      scope.unit("WARSHIP"),
      "POPULATION",
      2000,
    ),
    pct("P42", "UNIT_ATTACK_RANGE", scope.unit("WARSHIP"), -3300),
  ],
});
define("P43", "DECLARATIVE", {
  contributions: [
    structural(
      "P43",
      "UNIT_CHASSIS_PROFILE",
      scope.unit("TANK"),
      "HEAVY_ARTILLERY",
    ),
  ],
});
custom(
  "P44",
  "RADIOACTIVE_ATTACK_AFTERSHOCK",
  "Successful Tank-chassis Population attack neutralizes a deterministic nearby footprint and applies Fallout.",
);
custom(
  "P45",
  "FOREST_CONCEALMENT",
  "Forest-owned concealment filter; exact tactical manifestation/boundary projection remains visibility-owner semantics.",
);
define("P46", "DECLARATIVE", {
  contributions: [
    permission(
      "P46",
      "STRUCTURE_BUILD_PERMISSION",
      scope.structure("ALL"),
      "ALLOW",
      { kind: "BUILD_TERRAIN_IS", terrain: "TUNDRA" },
    ),
  ],
});
custom(
  "P47",
  "MARSH_CAPTURE_POPULATION_PENALTY",
  "Enemy successfully capturing holder-owned Marsh loses one additional Population after ordinary capture.",
);
define("P48", "DECLARATIVE", {
  contributions: [
    permission(
      "P48",
      "TERRAIN_POPULATION_BEARING_PERMISSION",
      scope.terrain("SHALLOW_WATER"),
      "ALLOW",
    ),
  ],
});
define("P49", "DECLARATIVE", {
  contributions: [
    structural(
      "P49",
      "STRUCTURE_EFFECT_PROFILE",
      scope.structure("OBSERVATION_POST"),
      "ENEMY_BLACKOUT",
    ),
  ],
});
custom(
  "P50",
  "MIRRORED_STRUCTURE_PRESSURE_FIELD",
  "Fort also projects offense equal to its effective defensive magnitude; cross-type overlap uses the named complement reducer.",
);
custom(
  "P51",
  "MIRRORED_STRUCTURE_PRESSURE_FIELD",
  "Command Post also projects defense equal to its effective offensive magnitude; cross-type overlap uses the named complement reducer.",
);
custom(
  "P52",
  "PASSIVE_FFY_SOURCE",
  "Adds passive all/general FFY source max(0, Capacity - TotalPopulation) / 250.",
);
custom(
  "P53",
  "PASSIVE_FFY_SOURCE",
  "Adds 2,000 FFY/s per ready persistent Silo charge, excluding P29/SAM charges.",
);
define("P54", "DECLARATIVE", {
  contributions: [
    structural("P54", "SPAWN_FOOTPRINT_PROFILE", scope.global, "STAR"),
  ],
});

define("N01", "DECLARATIVE", {
  contributions: [
    pct(
      "N01",
      "CITY_GROWTH_CONTRIBUTION",
      scope.structure("CITY"),
      -2000,
    ),
  ],
});
define("N02", "DECLARATIVE", {
  contributions: [
    pct(
      "N02",
      "TERRAIN_OFFENSIVE_PRESSURE",
      scope.terrain("PLAINS"),
      -2500,
    ),
  ],
});
define("N03", "DECLARATIVE", {
  contributions: [
    pct(
      "N03",
      "TERRAIN_DEFENSIVE_PRESSURE",
      scope.terrain("DESERT"),
      -3300,
    ),
  ],
});
define("N04", "DECLARATIVE", {
  contributions: [
    pct("N04", "FFY_EVENT_YIELD", scope.ffy("ALL"), -5000, {
      kind: "EVENT_TERRAIN_IS",
      terrain: "MOUNTAIN",
    }),
  ],
});
define("N05", "DECLARATIVE", {
  contributions: [
    permission(
      "N05",
      "FALLOUT_ACQUISITION_PERMISSION",
      scope.global,
      "PROHIBIT",
    ),
  ],
});
define("N06", "DECLARATIVE", {
  contributions: [
    permission(
      "N06",
      "STRUCTURE_UPGRADE_PERMISSION",
      scope.structure("ALL"),
      "PROHIBIT",
    ),
  ],
});
define("N07", "DECLARATIVE", {
  contributions: [
    limit("N07", "STRUCTURE_OWNERSHIP_CAP", scope.structure("ALL"), 1),
  ],
});
define("N08", "DECLARATIVE", {
  contributions: [
    hardZero(
      "N08",
      "STRUCTURE_PRESSURE_MAGNITUDE",
      scope.structure("FORT"),
    ),
  ],
});
define("N09", "DECLARATIVE", {
  contributions: [
    permission(
      "N09",
      "STRUCTURE_BUILD_PERMISSION",
      scope.structure("FACTORY"),
      "PROHIBIT",
    ),
  ],
});
define("N10", "DECLARATIVE", {
  contributions: [
    pct(
      "N10",
      "STRUCTURE_FIELD_COVERAGE_AREA",
      scope.structure("FORT"),
      -2500,
    ),
  ],
});
define("N11", "DECLARATIVE", {
  contributions: [
    hardZero("N11", "FFY_EVENT_YIELD", scope.ffy("ALL"), {
      kind: "EVENT_INSIDE_FIELD",
      field: "SAM",
    }),
  ],
});
define("N12", "DECLARATIVE", {
  contributions: [
    permission(
      "N12",
      "UNIT_BUILD_PERMISSION",
      scope.unit("WARSHIP"),
      "PROHIBIT",
    ),
  ],
});
define("N13", "MIXED", {
  contributions: [
    replace(
      "N13",
      "TRANSPORT_LANDING_SURVIVAL_FRACTION",
      scope.global,
      "RATIO",
      0.5,
    ),
  ],
  customDomains: ["TRANSPORT_LANDING_CASUALTY"],
  note: "Landing lifecycle point and deterministic half-Population rounding remain amphibious-owner semantics.",
});
custom(
  "N14",
  "TRADE_CAPTURE_VALUE",
  "First hostile Trade capture applies original-owner -Vowner once; canonical voyage Vowner snapshot remains FFY-owner semantics.",
);
define("N15", "DECLARATIVE", {
  contributions: [
    contribution(
      "N15",
      "TRANSPORT_EMBARK_COST",
      scope.global,
      "ORIGIN_FLAT",
      "ADD_FLAT",
      "FFY",
      500,
    ),
  ],
});
custom(
  "N16",
  "TRADE_CAPTURE_VALUE",
  "Trade success/capture inverts owner Vowner payout/loss; canonical voyage Vowner snapshot remains FFY-owner semantics.",
);
custom(
  "N17",
  "STRUCTURE_CAPTURE_DISPOSITION",
  "Enemy structure that would transfer on territorial capture is resolved as destroyed instead.",
);
define("N18", "DECLARATIVE", {
  contributions: [
    contribution(
      "N18",
      "ACQUISITION_PROGRESS",
      scope.global,
      "CONTEXTUAL_SCALAR",
      "MULTIPLY",
      "BASIS_POINTS",
      5000,
      { kind: "TARGET_LACKS_FALLOUT" },
    ),
  ],
});

for (const id of EXPECTED_ORIGIN_TRAIT_IDS) {
  if (!entries.has(id)) {
    throw new Error(`Origin manifest is missing explicit entry ${id}`);
  }
}
for (const id of entries.keys()) {
  if (!EXPECTED_ORIGIN_TRAIT_IDS.includes(id)) {
    throw new Error(`Origin manifest contains unexpected entry ${id}`);
  }
}
if (entries.size !== EXPECTED_ORIGIN_TRAIT_IDS.length) {
  throw new Error(
    `Origin manifest roster mismatch: expected ${EXPECTED_ORIGIN_TRAIT_IDS.length}, received ${entries.size}`,
  );
}

export const ORIGIN_RULE_MANIFEST = Object.freeze(
  [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
);

export const ORIGIN_RULE_MANIFEST_BY_ID: ReadonlyMap<
  OriginTraitId,
  OriginTraitRuleManifestEntry
> = new Map(ORIGIN_RULE_MANIFEST.map((entry) => [entry.id, entry]));

export function originRuleContributions(
  traitIds: readonly OriginTraitId[],
): readonly RuleContribution[] {
  return traitIds.flatMap((id) => {
    const entry = ORIGIN_RULE_MANIFEST_BY_ID.get(id);
    if (entry === undefined) throw new Error(`Unknown Origin trait ID: ${id}`);
    return entry.contributions;
  });
}

export function originDynamicRuleProviders(
  traitIds: readonly OriginTraitId[],
): readonly DynamicRuleProvider[] {
  return traitIds.flatMap((id) => {
    const entry = ORIGIN_RULE_MANIFEST_BY_ID.get(id);
    if (entry === undefined) throw new Error(`Unknown Origin trait ID: ${id}`);
    return entry.dynamicProviders;
  });
}

function bigintPower(base: bigint, exponent: number): bigint {
  let result = 1n;
  for (let index = 0; index < exponent; index += 1) {
    result *= base;
  }
  return result;
}

export function evaluateDynamicRuleProvider(
  provider: DynamicRuleProvider,
  dependencyValue: number,
): DynamicRuleResolvedValue {
  if (!Number.isSafeInteger(dependencyValue) || dependencyValue < 0) {
    throw new Error(
      `${provider.id} requires a non-negative safe-integer dependency value`,
    );
  }
  switch (provider.formula.kind) {
    case "RATIONAL_POWER":
      return {
        kind: "RATIONAL",
        numerator: bigintPower(
          BigInt(provider.formula.numerator),
          dependencyValue,
        ).toString(),
        denominator: bigintPower(
          BigInt(provider.formula.denominator),
          dependencyValue,
        ).toString(),
      };
    case "PERCENT_BP_PER_COUNT": {
      const value = provider.formula.bpPerUnit * dependencyValue;
      if (!Number.isSafeInteger(value)) {
        throw new Error(`${provider.id} produced an unsafe basis-point value`);
      }
      return { kind: "BASIS_POINTS", value };
    }
  }
}
