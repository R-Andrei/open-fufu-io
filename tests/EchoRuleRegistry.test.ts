import {
  ECHO_RULE_KEY_BY_ID,
  ECHO_RULE_KEY_DEFINITIONS,
  echoRuleContribution,
  type EchoRuleKeyDefinition,
} from "../src/core/rules/EchoRuleRegistry";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  validateRuleContributions,
  type RuleScope,
} from "../src/core/rules/RuleComposition";

function scopeKey(scope: RuleScope): string {
  switch (scope.kind) {
    case "GLOBAL":
      return "GLOBAL";
    case "TERRAIN":
      return `TERRAIN:${scope.terrain}`;
    case "STRUCTURE":
      return `STRUCTURE:${scope.structure}`;
    case "UNIT":
      return `UNIT:${scope.unit}`;
    case "WEAPON":
      return `WEAPON:${scope.weapon}`;
    case "FFY_FAMILY":
      return `FFY:${scope.family}`;
  }
}

function descriptor(entry: EchoRuleKeyDefinition): string {
  return [entry.id, entry.axis, scopeKey(entry.scope), entry.beneficialDirection].join(
    "|",
  );
}

function expectedEchoDescriptors(): readonly string[] {
  const expected: string[] = [
    "population.growth|POPULATION_GROWTH|GLOBAL|INCREASE",
    "population.starting|STARTING_POPULATION_FRACTION|GLOBAL|INCREASE",
    "neutral.settlement_progress|NEUTRAL_SETTLEMENT_PROGRESS|GLOBAL|INCREASE",
    "land.offensive_pressure|GLOBAL_OFFENSIVE_PRESSURE|GLOBAL|INCREASE",
    "land.defensive_pressure|GLOBAL_DEFENSIVE_PRESSURE|GLOBAL|INCREASE",
    "land.counter_response|COUNTER_RESPONSE_EFFECTIVENESS|GLOBAL|INCREASE",
  ];

  for (const terrain of [
    "PLAINS",
    "HIGHLAND",
    "MOUNTAIN",
    "DESERT",
    "FOREST",
    "TUNDRA",
    "MARSH",
    "SHALLOW_WATER",
  ] as const) {
    expected.push(
      `terrain.${terrain}.offensive_pressure|TERRAIN_OFFENSIVE_PRESSURE|TERRAIN:${terrain}|INCREASE`,
      `terrain.${terrain}.defensive_pressure|TERRAIN_DEFENSIVE_PRESSURE|TERRAIN:${terrain}|INCREASE`,
      `terrain.${terrain}.acquisition_speed|TERRAIN_ACQUISITION_SPEED|TERRAIN:${terrain}|INCREASE`,
    );
  }

  expected.push(
    "ffy.all|FFY_EVENT_YIELD|FFY:ALL|INCREASE",
    "ffy.military_conquest|FFY_EVENT_YIELD|FFY:MILITARY_CONQUEST|INCREASE",
    "ffy.naval_trade|FFY_EVENT_YIELD|FFY:NAVAL_TRADE|INCREASE",
    "ffy.industrial|FFY_EVENT_YIELD|FFY:INDUSTRIAL|INCREASE",
  );

  for (const structure of [
    "ALL",
    "CITY",
    "FORT",
    "PORT",
    "FACTORY",
    "MISSILE_SILO",
    "SAM_LAUNCHER",
    "OBSERVATION_POST",
    "COMMAND_POST",
  ] as const) {
    expected.push(
      `structure.${structure}.build_cost|STRUCTURE_BUILD_COST|STRUCTURE:${structure}|DECREASE`,
      `structure.${structure}.upgrade_cost|STRUCTURE_UPGRADE_COST|STRUCTURE:${structure}|DECREASE`,
      `structure.${structure}.construction_time|STRUCTURE_CONSTRUCTION_TIME|STRUCTURE:${structure}|DECREASE`,
    );
  }

  expected.push(
    "city.growth_contribution|CITY_GROWTH_CONTRIBUTION|STRUCTURE:CITY|INCREASE",
    "fort.coverage_area|STRUCTURE_FIELD_COVERAGE_AREA|STRUCTURE:FORT|INCREASE",
    "fort.defensive_pressure|STRUCTURE_PRESSURE_MAGNITUDE|STRUCTURE:FORT|INCREASE",
    "factory.repair_radius|STRUCTURE_REPAIR_RADIUS|STRUCTURE:FACTORY|INCREASE",
    "factory.repair_rate|STRUCTURE_REPAIR_RATE|STRUCTURE:FACTORY|INCREASE",
    "port.repair_radius|STRUCTURE_REPAIR_RADIUS|STRUCTURE:PORT|INCREASE",
    "port.repair_rate|STRUCTURE_REPAIR_RATE|STRUCTURE:PORT|INCREASE",
    "observation.radius|STRUCTURE_OBSERVATION_RADIUS|STRUCTURE:OBSERVATION_POST|INCREASE",
    "command.coverage_area|STRUCTURE_FIELD_COVERAGE_AREA|STRUCTURE:COMMAND_POST|INCREASE",
    "command.pressure|STRUCTURE_PRESSURE_MAGNITUDE|STRUCTURE:COMMAND_POST|INCREASE",
    "sam.interception_range|STRUCTURE_INTERCEPTION_RANGE|STRUCTURE:SAM_LAUNCHER|INCREASE",
    "sam.recharge_time|STRUCTURE_RECHARGE_TIME|STRUCTURE:SAM_LAUNCHER|DECREASE",
    "silo.recharge_time|STRUCTURE_RECHARGE_TIME|STRUCTURE:MISSILE_SILO|DECREASE",
  );

  for (const unit of ["WARSHIP", "TANK"] as const) {
    expected.push(
      `unit.${unit}.purchase_cost|UNIT_PURCHASE_FFY_COST|UNIT:${unit}|DECREASE`,
      `unit.${unit}.movement_speed|UNIT_MOVEMENT_SPEED|UNIT:${unit}|INCREASE`,
      `unit.${unit}.attack_range|UNIT_ATTACK_RANGE|UNIT:${unit}|INCREASE`,
      `unit.${unit}.damage|UNIT_DAMAGE|UNIT:${unit}|INCREASE`,
      `unit.${unit}.max_health|UNIT_MAX_HEALTH|UNIT:${unit}|INCREASE`,
    );
  }

  for (const weapon of ["ALL", "ATOM_BOMB", "HYDROGEN_BOMB", "MIRV"] as const) {
    expected.push(
      `weapon.${weapon}.projectile_speed|WEAPON_PROJECTILE_SPEED|WEAPON:${weapon}|INCREASE`,
    );
  }
  for (const weapon of ["ATOM_BOMB", "HYDROGEN_BOMB", "MIRV"] as const) {
    expected.push(
      `weapon.${weapon}.purchase_cost|WEAPON_PURCHASE_FFY_COST|WEAPON:${weapon}|DECREASE`,
    );
  }
  for (const weapon of ["ATOM_BOMB", "HYDROGEN_BOMB"] as const) {
    expected.push(
      `weapon.${weapon}.blast_area|WEAPON_BLAST_AREA|WEAPON:${weapon}|INCREASE`,
    );
  }

  return expected;
}

describe("Echo rule registry", () => {
  it("matches the independent canonical 93-key projection exactly", () => {
    const expected = [...expectedEchoDescriptors()].sort();
    const actual = ECHO_RULE_KEY_DEFINITIONS.map(descriptor).sort();
    expect(expected).toHaveLength(93);
    expect(new Set(expected).size).toBe(93);
    expect(actual).toEqual(expected);
    expect(ECHO_RULE_KEY_BY_ID.size).toBe(93);
  });

  it("maps every key to a registered axis and valid Echo contribution", () => {
    for (const definition of ECHO_RULE_KEY_DEFINITIONS) {
      expect(RULE_AXIS_REGISTRY[definition.axis]).toBeDefined();
      const contribution = echoRuleContribution(
        definition.id,
        "BENEFICIAL",
        100,
        `test:${definition.id}`,
      );
      expect(validateRuleContributions([contribution], RULE_AXIS_REGISTRY)).toEqual(
        [],
      );
    }
  });

  it("uses mathematical sign independently from beneficial/harmful polarity", () => {
    expect(
      echoRuleContribution(
        "unit.WARSHIP.movement_speed",
        "BENEFICIAL",
        300,
        "speed-up",
      ).value,
    ).toBe(300);
    expect(
      echoRuleContribution(
        "unit.WARSHIP.movement_speed",
        "HARMFUL",
        300,
        "speed-down",
      ).value,
    ).toBe(-300);
    expect(
      echoRuleContribution(
        "unit.WARSHIP.purchase_cost",
        "BENEFICIAL",
        300,
        "cost-down",
      ).value,
    ).toBe(-300);
    expect(
      echoRuleContribution(
        "unit.WARSHIP.purchase_cost",
        "HARMFUL",
        300,
        "cost-up",
      ).value,
    ).toBe(300);
  });

  it("keeps all-scope and specific-scope keys distinct", () => {
    expect(ECHO_RULE_KEY_BY_ID.get("structure.ALL.build_cost")?.scope).toEqual({
      kind: "STRUCTURE",
      structure: "ALL",
    });
    expect(ECHO_RULE_KEY_BY_ID.get("structure.FORT.build_cost")?.scope).toEqual({
      kind: "STRUCTURE",
      structure: "FORT",
    });
    expect(ECHO_RULE_KEY_BY_ID.get("weapon.ALL.projectile_speed")?.scope).toEqual({
      kind: "WEAPON",
      weapon: "ALL",
    });
  });
});
