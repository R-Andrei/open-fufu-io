import {
  ECHO_RULE_KEY_BY_ID,
  ECHO_RULE_KEY_DEFINITIONS,
  echoRuleContribution,
} from "../src/core/rules/EchoRuleRegistry";
import {
  RULE_AXIS_REGISTRY,
} from "../src/core/rules/RuleAxisRegistry";
import { validateRuleContributions } from "../src/core/rules/RuleComposition";

describe("Echo rule registry", () => {
  it("contains exactly the 93 concrete V1 stat/scope keys", () => {
    expect(ECHO_RULE_KEY_DEFINITIONS).toHaveLength(93);
    expect(ECHO_RULE_KEY_BY_ID.size).toBe(93);
    expect(new Set(ECHO_RULE_KEY_DEFINITIONS.map((entry) => entry.id)).size).toBe(
      93,
    );
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
