import {
  type FfyFamilyScopeId,
  type RuleConditions,
  type RuleContribution,
  type RuleScope,
  type StructureScopeId,
  type TerrainScopeId,
  type UnitScopeId,
  type WeaponScopeId,
} from "./RuleComposition";
import type { RuleAxisId } from "./RuleAxisRegistry";

export type EchoPolarity = "BENEFICIAL" | "HARMFUL";
export type EchoBeneficialDirection = "INCREASE" | "DECREASE";

export interface EchoRuleKeyDefinition {
  readonly id: string;
  readonly axis: RuleAxisId;
  readonly scope: RuleScope;
  readonly conditions?: RuleConditions;
  /** Whether a beneficial roll raises or lowers the materialized value. */
  readonly beneficialDirection: EchoBeneficialDirection;
}

const definitions: EchoRuleKeyDefinition[] = [];

function add(
  id: string,
  axis: RuleAxisId,
  scope: RuleScope,
  beneficialDirection: EchoBeneficialDirection = "INCREASE",
  conditions?: RuleConditions,
): void {
  definitions.push({
    id,
    axis,
    scope,
    beneficialDirection,
    ...(conditions === undefined ? {} : { conditions }),
  });
}

const global = { kind: "GLOBAL" } as const;
const terrain = (value: TerrainScopeId): RuleScope => ({
  kind: "TERRAIN",
  terrain: value,
});
const structure = (value: StructureScopeId): RuleScope => ({
  kind: "STRUCTURE",
  structure: value,
});
const unit = (value: UnitScopeId): RuleScope => ({ kind: "UNIT", unit: value });
const weapon = (value: WeaponScopeId): RuleScope => ({
  kind: "WEAPON",
  weapon: value,
});
const ffy = (value: FfyFamilyScopeId): RuleScope => ({
  kind: "FFY_FAMILY",
  family: value,
});
const WARHEAD_PROJECTILE_CONDITIONS = Object.freeze([
  { kind: "PROJECTILE_IS_WARHEAD" } as const,
]) satisfies RuleConditions;

add("population.growth", "POPULATION_GROWTH", global);
add("population.starting", "STARTING_POPULATION_FRACTION", global);
add("neutral.settlement_progress", "NEUTRAL_SETTLEMENT_PROGRESS", global);
add("land.offensive_pressure", "GLOBAL_OFFENSIVE_PRESSURE", global);
add("land.defensive_pressure", "GLOBAL_DEFENSIVE_PRESSURE", global);
add("land.counter_response", "COUNTER_RESPONSE_EFFECTIVENESS", global);

const TERRAIN_SCOPES = [
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
  "SHALLOW_WATER",
] as const satisfies readonly TerrainScopeId[];
for (const value of TERRAIN_SCOPES) {
  add(
    `terrain.${value}.offensive_pressure`,
    "TERRAIN_OFFENSIVE_PRESSURE",
    terrain(value),
  );
  add(
    `terrain.${value}.defensive_pressure`,
    "TERRAIN_DEFENSIVE_PRESSURE",
    terrain(value),
  );
  add(
    `terrain.${value}.acquisition_speed`,
    "TERRAIN_ACQUISITION_SPEED",
    terrain(value),
  );
}

add("ffy.all", "FFY_EVENT_YIELD", ffy("ALL"));
add("ffy.military_conquest", "FFY_EVENT_YIELD", ffy("MILITARY_CONQUEST"));
add("ffy.naval_trade", "FFY_EVENT_YIELD", ffy("NAVAL_TRADE"));
add("ffy.industrial", "FFY_EVENT_YIELD", ffy("INDUSTRIAL"));

const STRUCTURE_SCOPES = [
  "ALL",
  "CITY",
  "FORT",
  "PORT",
  "FACTORY",
  "MISSILE_SILO",
  "SAM_LAUNCHER",
  "OBSERVATION_POST",
  "COMMAND_POST",
] as const satisfies readonly StructureScopeId[];
for (const value of STRUCTURE_SCOPES) {
  add(
    `structure.${value}.build_cost`,
    "STRUCTURE_BUILD_COST",
    structure(value),
    "DECREASE",
  );
  add(
    `structure.${value}.upgrade_cost`,
    "STRUCTURE_UPGRADE_COST",
    structure(value),
    "DECREASE",
  );
  add(
    `structure.${value}.construction_time`,
    "STRUCTURE_CONSTRUCTION_TIME",
    structure(value),
    "DECREASE",
  );
}

add("city.growth_contribution", "CITY_GROWTH_CONTRIBUTION", structure("CITY"));
add("fort.coverage_area", "STRUCTURE_FIELD_COVERAGE_AREA", structure("FORT"));
add("fort.defensive_pressure", "STRUCTURE_PRESSURE_MAGNITUDE", structure("FORT"));
add("factory.repair_radius", "STRUCTURE_REPAIR_RADIUS", structure("FACTORY"));
add("factory.repair_rate", "STRUCTURE_REPAIR_RATE", structure("FACTORY"));
add("port.repair_radius", "STRUCTURE_REPAIR_RADIUS", structure("PORT"));
add("port.repair_rate", "STRUCTURE_REPAIR_RATE", structure("PORT"));
add(
  "observation.radius",
  "STRUCTURE_OBSERVATION_RADIUS",
  structure("OBSERVATION_POST"),
);
add(
  "command.coverage_area",
  "STRUCTURE_FIELD_COVERAGE_AREA",
  structure("COMMAND_POST"),
);
add(
  "command.pressure",
  "STRUCTURE_PRESSURE_MAGNITUDE",
  structure("COMMAND_POST"),
);
add(
  "sam.interception_range",
  "STRUCTURE_INTERCEPTION_RANGE",
  structure("SAM_LAUNCHER"),
);
add(
  "sam.recharge_time",
  "STRUCTURE_RECHARGE_TIME",
  structure("SAM_LAUNCHER"),
  "DECREASE",
);
add(
  "silo.recharge_time",
  "STRUCTURE_RECHARGE_TIME",
  structure("MISSILE_SILO"),
  "DECREASE",
);

for (const value of ["WARSHIP", "TANK"] as const satisfies readonly UnitScopeId[]) {
  add(
    `unit.${value}.purchase_cost`,
    "UNIT_PURCHASE_FFY_COST",
    unit(value),
    "DECREASE",
  );
  add(`unit.${value}.movement_speed`, "UNIT_MOVEMENT_SPEED", unit(value));
  add(`unit.${value}.attack_range`, "UNIT_ATTACK_RANGE", unit(value));
  add(`unit.${value}.damage`, "UNIT_DAMAGE", unit(value));
  add(`unit.${value}.max_health`, "UNIT_MAX_HEALTH", unit(value));
}

for (const value of [
  "ALL",
  "ATOM_BOMB",
  "HYDROGEN_BOMB",
  "MIRV",
] as const satisfies readonly WeaponScopeId[]) {
  add(
    `weapon.${value}.projectile_speed`,
    "WEAPON_PROJECTILE_SPEED",
    weapon(value),
    "INCREASE",
    WARHEAD_PROJECTILE_CONDITIONS,
  );
}
for (const value of [
  "ATOM_BOMB",
  "HYDROGEN_BOMB",
  "MIRV",
] as const satisfies readonly WeaponScopeId[]) {
  add(
    `weapon.${value}.purchase_cost`,
    "WEAPON_PURCHASE_FFY_COST",
    weapon(value),
    "DECREASE",
  );
}
for (const value of [
  "ATOM_BOMB",
  "HYDROGEN_BOMB",
] as const satisfies readonly WeaponScopeId[]) {
  add(`weapon.${value}.blast_area`, "WEAPON_BLAST_AREA", weapon(value));
}

export const ECHO_RULE_KEY_DEFINITIONS = Object.freeze(definitions);

export const ECHO_RULE_KEY_BY_ID: ReadonlyMap<string, EchoRuleKeyDefinition> =
  new Map(
    ECHO_RULE_KEY_DEFINITIONS.map((definition) => [definition.id, definition]),
  );

export function echoRuleContribution(
  keyId: string,
  polarity: EchoPolarity,
  magnitudeBp: number,
  sourceId: string,
): RuleContribution {
  const definition = ECHO_RULE_KEY_BY_ID.get(keyId);
  if (definition === undefined) throw new Error(`Unknown Echo rule key: ${keyId}`);
  if (!Number.isInteger(magnitudeBp) || magnitudeBp < 0) {
    throw new Error("Echo magnitude must be a non-negative integer basis-point value");
  }
  const beneficialSign = definition.beneficialDirection === "INCREASE" ? 1 : -1;
  const polaritySign = polarity === "BENEFICIAL" ? 1 : -1;
  return {
    axis: definition.axis,
    scope: definition.scope,
    stage: "ECHO_PERCENT",
    operator: "ADD_PERCENT",
    sourceKind: "ECHO",
    sourceId,
    valueUnit: "BASIS_POINTS",
    value: magnitudeBp * beneficialSign * polaritySign,
    ...(definition.conditions === undefined
      ? {}
      : { conditions: definition.conditions }),
  };
}
