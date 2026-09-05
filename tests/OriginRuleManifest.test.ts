import {
  ORIGIN_RULE_MANIFEST,
  ORIGIN_RULE_MANIFEST_BY_ID,
  originRuleContributions,
} from "../src/core/rules/OriginRuleManifest";
import {
  reduceScalarRule,
  selectApplicableRuleContributions,
  validateRuleContributions,
} from "../src/core/rules/RuleComposition";
import {
  RULE_AXIS_REGISTRY,
  ruleAxis,
} from "../src/core/rules/RuleAxisRegistry";

describe("Origin rule manifest", () => {
  it("classifies every current P01-P54 and N01-N18 trait exactly once", () => {
    expect(ORIGIN_RULE_MANIFEST).toHaveLength(72);
    expect(ORIGIN_RULE_MANIFEST_BY_ID.size).toBe(72);
    for (let index = 1; index <= 54; index += 1) {
      expect(
        ORIGIN_RULE_MANIFEST_BY_ID.has(
          `P${String(index).padStart(2, "0")}`,
        ),
      ).toBe(true);
    }
    for (let index = 1; index <= 18; index += 1) {
      expect(
        ORIGIN_RULE_MANIFEST_BY_ID.has(
          `N${String(index).padStart(2, "0")}`,
        ),
      ).toBe(true);
    }
  });

  it("keeps every machine-readable contribution valid against the axis registry", () => {
    for (const entry of ORIGIN_RULE_MANIFEST) {
      expect(
        validateRuleContributions(entry.contributions, RULE_AXIS_REGISTRY),
      ).toEqual([]);
    }
  });

  it("compiles P09 + N10 through the shared Fort coverage axis", () => {
    const contributions = originRuleContributions(["P09", "N10"]);
    const applicable = selectApplicableRuleContributions(
      "STRUCTURE_FIELD_COVERAGE_AREA",
      { kind: "STRUCTURE", structure: "FORT" },
      contributions,
    );
    expect(
      reduceScalarRule(
        100,
        ruleAxis("STRUCTURE_FIELD_COVERAGE_AREA"),
        applicable,
      ),
    ).toBeCloseTo(85);
  });

  it("compiles P23 + P42 through the shared Warship attack-range axis", () => {
    const contributions = originRuleContributions(["P23", "P42"]);
    const applicable = selectApplicableRuleContributions(
      "UNIT_ATTACK_RANGE",
      { kind: "UNIT", unit: "WARSHIP" },
      contributions,
    );
    expect(
      reduceScalarRule(130, ruleAxis("UNIT_ATTACK_RANGE"), applicable),
    ).toBeCloseTo(113.1);
  });

  it("does not pretend custom lifecycle traits are ordinary scalar modifiers", () => {
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("P07")?.classification).toBe("CUSTOM");
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("P44")?.classification).toBe("CUSTOM");
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("N14")?.classification).toBe("CUSTOM");
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("P37")?.classification).toBe("MIXED");
  });
});
