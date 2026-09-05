import {
  ORIGIN_RULE_MANIFEST,
  ORIGIN_RULE_MANIFEST_BY_ID,
  RULE_COMPONENT,
  originRuleContributions,
} from "../src/core/rules/OriginRuleManifest";
import {
  reduceComponentSetRule,
  reducePermissionRule,
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

  it("projects P01 and P02 onto spawn-quota and growth-profile axes", () => {
    const p01 = originRuleContributions(["P01"]);
    expect(
      reduceScalarRule(
        1000,
        ruleAxis("INITIAL_TERRITORY_QUOTA"),
        p01,
      ),
    ).toBe(1150);

    const p02 = originRuleContributions(["P02"]);
    expect(p02).toEqual([
      expect.objectContaining({
        axis: "POPULATION_GROWTH_UTILIZATION_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        value: "ORIGIN_P02_30_70",
      }),
    ]);
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

  it("represents P03 and P16 as selective component suppression", () => {
    const p03 = originRuleContributions(["P03"]);
    expect(
      reduceComponentSetRule(
        [],
        ruleAxis("LAND_PRESSURE_SUPPRESSED_COMPONENTS"),
        p03,
      ),
    ).toEqual([RULE_COMPONENT.HOSTILE_FORT_DEFENSIVE_PRESSURE]);

    const p16 = originRuleContributions(["P16"]);
    expect(
      reduceComponentSetRule(
        [],
        ruleAxis("ACQUISITION_SUPPRESSED_COMPONENTS"),
        p16,
      ),
    ).toEqual([RULE_COMPONENT.FALLOUT_ACQUISITION_RESISTANCE]);
  });

  it("keeps N05 Fallout prohibition independent from P16 resistance suppression", () => {
    const contributions = originRuleContributions(["P16", "N05"]);
    const permission = selectApplicableRuleContributions(
      "FALLOUT_ACQUISITION_PERMISSION",
      { kind: "GLOBAL" },
      contributions,
    );
    expect(
      reducePermissionRule(
        true,
        ruleAxis("FALLOUT_ACQUISITION_PERMISSION"),
        permission,
      ),
    ).toBe(false);
  });

  it("uses event-location terrain conditions for P14 and N04", () => {
    expect(originRuleContributions(["P14"])).toEqual([
      expect.objectContaining({
        axis: "FFY_EVENT_YIELD",
        value: 3300,
        condition: { kind: "EVENT_TERRAIN_IS", terrain: "DESERT" },
      }),
    ]);
    expect(originRuleContributions(["N04"])).toEqual([
      expect.objectContaining({
        axis: "FFY_EVENT_YIELD",
        value: -5000,
        condition: { kind: "EVENT_TERRAIN_IS", terrain: "MOUNTAIN" },
      }),
    ]);
  });

  it("does not pretend custom lifecycle traits are ordinary scalar modifiers", () => {
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("P07")?.classification).toBe("CUSTOM");
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("P44")?.classification).toBe("CUSTOM");
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("N14")?.classification).toBe("CUSTOM");
    expect(ORIGIN_RULE_MANIFEST_BY_ID.get("P37")?.classification).toBe("MIXED");
  });
});
