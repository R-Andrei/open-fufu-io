import {
  GLOBAL_RULE_SCOPE,
  type RuleCondition,
  type RuleContribution,
  type RuleScope,
} from "./RuleComposition";
import type { RuleAxisId } from "./RuleAxisRegistry";

export type OriginTraitRuleClass = "DECLARATIVE" | "MIXED" | "CUSTOM";
export type OriginTraitId = `P${string}` | `N${string}`;

export interface OriginTraitRuleManifestEntry {
  readonly id: OriginTraitId;
  readonly classification: OriginTraitRuleClass;
  readonly contributions: readonly RuleContribution[];
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

function traitIds(prefix: "P" | "N", count: number): OriginTraitId[] {
  return Array.from(
    { length: count },
    (_, index) =>
      `${prefix}${String(index + 1).padStart(2, "0")}` as OriginTraitId,
  );
}

const entries = new Map<OriginTraitId, OriginTraitRuleManifestEntry>();
for (const id of [...traitIds("P", 54), ...traitIds("N", 18)]) {
  entries.set(id, {
    id,
    classification: "CUSTOM",
    contributions: [],
    note: "Lifecycle/structural mechanic or not yet expressible as an ordinary static contribution.",
  });
}

function define(
  id: OriginTraitId,
  classification: OriginTraitRuleClass,
  contributions: readonly RuleContribution[],
  note?: string,
): void {
  entries.set(id, {
    id,
    classification,
    contributions,
    ...(note === undefined ? {} : { note }),
  });
}

define("P01", "DECLARATIVE", [
  pct("P01", "INITIAL_TERRITORY_QUOTA", scope.global, 1500),
]);
define(
  "P02",
  "MIXED",
  [
    structural(
      "P02",
      "POPULATION_GROWTH_UTILIZATION_PROFILE",
      scope.global,
      "ORIGIN_P02_30_70",
    ),
  ],
  "The profile replacement is declarative; exact 30–70% curve anchors remain a Population-mechanics closure dependency.",
);
define("P04", "DECLARATIVE", [
  contribution(
    "P04",
    "COUNTER_RESPONSE_EFFECTIVENESS",
    scope.global,
    "FINAL_OVERRIDE",
    "FINAL_OVERRIDE",
    "RATIO",
    1,
  ),
]);
define("P06", "DECLARATIVE", [
  pct("P06", "UNIT_MOVEMENT_SPEED", scope.unit("TRADE_SHIP"), 2500),
]);
define("P08", "DECLARATIVE", [
  replace(
    "P08",
    "EXTERNAL_TRADE_WARTIME_MULTIPLIER",
    scope.global,
    "RATIO",
    1,
  ),
]);
define("P09", "DECLARATIVE", [
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
]);
define(
  "P10",
  "DECLARATIVE",
  [pct("P10", "WEAPON_PROJECTILE_SPEED", scope.weapon("ALL"), 10_000)],
  "Projectile-family/stage membership remains owned by the strategic-weapon subsystem.",
);
define(
  "P11",
  "MIXED",
  [hardZero("P11", "STRUCTURE_BUILD_COST", scope.structure("SAM_LAUNCHER"))],
  "Peak-Population SAM-slot entitlement remains lifecycle state.",
);
define("P12", "DECLARATIVE", [
  pct("P12", "UNIT_MOVEMENT_SPEED", scope.unit("TRANSPORT_SHIP"), 2500),
]);
define("P13", "DECLARATIVE", [
  pct(
    "P13",
    "TERRAIN_DEFENSIVE_PRESSURE",
    scope.terrain("MOUNTAIN"),
    3300,
  ),
]);
define("P15", "DECLARATIVE", [
  pct(
    "P15",
    "TERRAIN_OFFENSIVE_PRESSURE",
    scope.terrain("HIGHLAND"),
    3300,
  ),
]);
define("P18", "DECLARATIVE", [
  pct(
    "P18",
    "GLOBAL_OFFENSIVE_PRESSURE",
    scope.global,
    10_000,
    { kind: "SOURCE_INSIDE_FIELD", field: "FORT" },
  ),
]);
define("P22", "DECLARATIVE", [
  addCap("P22", "UNIT_MAX_RANK", scope.unit("WARSHIP"), 2),
]);
define("P23", "DECLARATIVE", [
  pct("P23", "UNIT_ATTACK_RANGE", scope.unit("WARSHIP"), 2000),
  pct("P23", "UNIT_DAMAGE", scope.unit("WARSHIP"), 2000),
  pct("P23", "UNIT_MOVEMENT_SPEED", scope.unit("WARSHIP"), 2000),
  limit("P23", "UNIT_OWNERSHIP_CAP", scope.unit("WARSHIP"), 1),
]);
define("P24", "DECLARATIVE", [
  pct("P24", "FFY_EVENT_YIELD", scope.ffy("ALL"), 2000, {
    kind: "EVENT_INSIDE_FIELD",
    field: "FORT",
  }),
]);
define("P25", "DECLARATIVE", [
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
]);
define("P30", "DECLARATIVE", [
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
]);
define("P31", "DECLARATIVE", [
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
]);
define("P32", "DECLARATIVE", [
  structural(
    "P32",
    "UNIT_CHASSIS_PROFILE",
    scope.unit("TRANSPORT_SHIP"),
    "ARMORED_PORT_TRANSPORT",
  ),
]);
define(
  "P36",
  "MIXED",
  [
    replace(
      "P36",
      "NEUTRAL_SETTLEMENT_POPULATION_COST",
      scope.global,
      "POPULATION",
      0.5,
    ),
  ],
  "Fractional debit residual accounting remains lifecycle state.",
);
define(
  "P37",
  "MIXED",
  [
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
  "Landing Fort grant remains a lifecycle mechanic.",
);
define("P39", "DECLARATIVE", [
  structural("P39", "SPAWN_PROFILE", scope.global, "SPLIT_TWO"),
]);
define("P40", "DECLARATIVE", [
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
]);
define("P42", "DECLARATIVE", [
  hardZero("P42", "UNIT_PURCHASE_FFY_COST", scope.unit("WARSHIP")),
  replace(
    "P42",
    "UNIT_PURCHASE_POPULATION_COST",
    scope.unit("WARSHIP"),
    "POPULATION",
    2000,
  ),
  pct("P42", "UNIT_ATTACK_RANGE", scope.unit("WARSHIP"), -3300),
]);
define("P43", "DECLARATIVE", [
  structural(
    "P43",
    "UNIT_CHASSIS_PROFILE",
    scope.unit("TANK"),
    "HEAVY_ARTILLERY",
  ),
]);
define("P46", "DECLARATIVE", [
  permission(
    "P46",
    "STRUCTURE_BUILD_PERMISSION",
    scope.structure("ALL"),
    "ALLOW",
    { kind: "BUILD_TERRAIN_IS", terrain: "TUNDRA" },
  ),
]);
define("P48", "DECLARATIVE", [
  permission(
    "P48",
    "TERRAIN_POPULATION_BEARING_PERMISSION",
    scope.terrain("SHALLOW_WATER"),
    "ALLOW",
  ),
]);
define("P49", "DECLARATIVE", [
  structural(
    "P49",
    "STRUCTURE_EFFECT_PROFILE",
    scope.structure("OBSERVATION_POST"),
    "ENEMY_BLACKOUT",
  ),
]);
define("P54", "DECLARATIVE", [
  structural("P54", "SPAWN_FOOTPRINT_PROFILE", scope.global, "STAR"),
]);

define("N01", "DECLARATIVE", [
  pct(
    "N01",
    "CITY_GROWTH_CONTRIBUTION",
    scope.structure("CITY"),
    -2000,
  ),
]);
define("N02", "DECLARATIVE", [
  pct(
    "N02",
    "TERRAIN_OFFENSIVE_PRESSURE",
    scope.terrain("PLAINS"),
    -2500,
  ),
]);
define("N03", "DECLARATIVE", [
  pct(
    "N03",
    "TERRAIN_DEFENSIVE_PRESSURE",
    scope.terrain("DESERT"),
    -3300,
  ),
]);
define("N05", "DECLARATIVE", [
  permission(
    "N05",
    "FALLOUT_ACQUISITION_PERMISSION",
    scope.global,
    "PROHIBIT",
  ),
]);
define("N06", "DECLARATIVE", [
  permission(
    "N06",
    "STRUCTURE_UPGRADE_PERMISSION",
    scope.structure("ALL"),
    "PROHIBIT",
  ),
]);
define("N07", "DECLARATIVE", [
  limit("N07", "STRUCTURE_OWNERSHIP_CAP", scope.structure("ALL"), 1),
]);
define("N08", "DECLARATIVE", [
  hardZero(
    "N08",
    "STRUCTURE_PRESSURE_MAGNITUDE",
    scope.structure("FORT"),
  ),
]);
define("N09", "DECLARATIVE", [
  permission(
    "N09",
    "STRUCTURE_BUILD_PERMISSION",
    scope.structure("FACTORY"),
    "PROHIBIT",
  ),
]);
define("N10", "DECLARATIVE", [
  pct(
    "N10",
    "STRUCTURE_FIELD_COVERAGE_AREA",
    scope.structure("FORT"),
    -2500,
  ),
]);
define("N11", "DECLARATIVE", [
  hardZero("N11", "FFY_EVENT_YIELD", scope.ffy("ALL"), {
    kind: "EVENT_INSIDE_FIELD",
    field: "SAM",
  }),
]);
define("N12", "DECLARATIVE", [
  permission(
    "N12",
    "UNIT_BUILD_PERMISSION",
    scope.unit("WARSHIP"),
    "PROHIBIT",
  ),
]);
define(
  "N13",
  "MIXED",
  [
    replace(
      "N13",
      "TRANSPORT_LANDING_SURVIVAL_FRACTION",
      scope.global,
      "RATIO",
      0.5,
    ),
  ],
  "Landing lifecycle point and rounding remain subsystem-owned.",
);
define("N15", "DECLARATIVE", [
  contribution(
    "N15",
    "TRANSPORT_EMBARK_COST",
    scope.global,
    "ORIGIN_FLAT",
    "ADD_FLAT",
    "FFY",
    500,
  ),
]);
define("N18", "DECLARATIVE", [
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
]);

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
