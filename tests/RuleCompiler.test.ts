import {
  compileRuleProfile,
  ruleConditionsMayOverlap,
  ruleScopesOverlap,
  validateRuleProfile,
} from "../src/core/rules/RuleCompiler";
import { originRuleContributions } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleContribution } from "../src/core/rules/RuleComposition";

describe("rule profile compiler", () => {
  it("understands wildcard scope overlap", () => {
    expect(
      ruleScopesOverlap(
        { kind: "UNIT", unit: "ALL" },
        { kind: "UNIT", unit: "WARSHIP" },
      ),
    ).toBe(true);
    expect(
      ruleScopesOverlap(
        { kind: "UNIT", unit: "TANK" },
        { kind: "UNIT", unit: "WARSHIP" },
      ),
    ).toBe(false);
  });

  it("recognizes mutually exclusive typed conditions", () => {
    expect(
      ruleConditionsMayOverlap(
        { kind: "TARGET_HAS_FALLOUT" },
        { kind: "TARGET_LACKS_FALLOUT" },
      ),
    ).toBe(false);
    expect(
      ruleConditionsMayOverlap(
        { kind: "SOURCE_TERRAIN_IS", terrain: "PLAINS" },
        { kind: "SOURCE_TERRAIN_IS", terrain: "HIGHLAND" },
      ),
    ).toBe(false);
    expect(
      ruleConditionsMayOverlap(
        { kind: "EVENT_TERRAIN_IS", terrain: "DESERT" },
        { kind: "EVENT_TERRAIN_IS", terrain: "MOUNTAIN" },
      ),
    ).toBe(false);
    expect(
      ruleConditionsMayOverlap(
        { kind: "EVENT_INSIDE_FIELD", field: "FORT" },
        { kind: "EVENT_INSIDE_FIELD", field: "SAM" },
      ),
    ).toBe(true);
  });

  it("rejects overlapping structural singleton transformations instead of choosing by source order", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "UNIT_CHASSIS_PROFILE",
        scope: { kind: "UNIT", unit: "ALL" },
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "A",
        valueUnit: "PROFILE_ID",
        value: "PROFILE_A",
      },
      {
        axis: "UNIT_CHASSIS_PROFILE",
        scope: { kind: "UNIT", unit: "WARSHIP" },
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "B",
        valueUnit: "PROFILE_ID",
        value: "PROFILE_B",
      },
    ];
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, contributions).map(
        (issue) => issue.code,
      ),
    ).toContain("OVERLAPPING_SINGLETON_CONFLICT");
    expect(() => compileRuleProfile(RULE_AXIS_REGISTRY, contributions)).toThrow();
  });

  it("allows independent structural transformations on disjoint scopes", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "UNIT_CHASSIS_PROFILE",
        scope: { kind: "UNIT", unit: "TANK" },
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "A",
        valueUnit: "PROFILE_ID",
        value: "HEAVY_ARTILLERY",
      },
      {
        axis: "UNIT_CHASSIS_PROFILE",
        scope: { kind: "UNIT", unit: "TRANSPORT_SHIP" },
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "B",
        valueUnit: "PROFILE_ID",
        value: "ARMORED_PORT_TRANSPORT",
      },
    ];
    expect(validateRuleProfile(RULE_AXIS_REGISTRY, contributions)).toEqual([]);
  });

  it("produces byte-identical canonical serialization for contribution permutations", () => {
    const contributions = originRuleContributions(["P09", "N10", "P23", "P42"]);
    const forward = compileRuleProfile(RULE_AXIS_REGISTRY, contributions);
    const reverse = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      [...contributions].reverse(),
    );
    expect(forward.canonicalSerialization).toBe(reverse.canonicalSerialization);
  });
});
