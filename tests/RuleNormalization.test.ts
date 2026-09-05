import { originRuleContributions } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  normalizeRuleContributions,
  serializeNormalizedRuleRecords,
} from "../src/core/rules/RuleNormalization";
import type { RuleContribution } from "../src/core/rules/RuleComposition";

describe("canonical rule normalization", () => {
  it("mathematically reduces same-slot additive percentages while retaining provenance", () => {
    const profile = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleContributions(["P23", "P42"]),
    );
    const range = profile.normalizedRules.find(
      (record) =>
        record.axis === "UNIT_ATTACK_RANGE" &&
        record.scope.kind === "UNIT" &&
        record.scope.unit === "WARSHIP" &&
        record.stage === "ORIGIN_PERCENT",
    );

    expect(range?.value).toEqual({ kind: "SUM", value: -1300 });
    expect(range?.provenance).toEqual([
      { sourceKind: "ORIGIN", sourceId: "P23" },
      { sourceKind: "ORIGIN", sourceId: "P42" },
    ]);
  });

  it("normalizes multiplicative factors as one exact reduced rational", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "UNIT_MOVEMENT_SPEED",
        scope: { kind: "UNIT", unit: "WARSHIP" },
        stage: "ORIGIN_SCALAR",
        operator: "MULTIPLY",
        sourceKind: "ORIGIN",
        sourceId: "A",
        valueUnit: "BASIS_POINTS",
        value: 15_000,
      },
      {
        axis: "UNIT_MOVEMENT_SPEED",
        scope: { kind: "UNIT", unit: "WARSHIP" },
        stage: "ORIGIN_SCALAR",
        operator: "MULTIPLY",
        sourceKind: "ORIGIN",
        sourceId: "B",
        valueUnit: "BASIS_POINTS",
        value: 8_000,
      },
    ];

    const normalized = normalizeRuleContributions(
      RULE_AXIS_REGISTRY,
      contributions,
    );
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.value).toEqual({
      kind: "PRODUCT",
      numerator: "6",
      denominator: "5",
    });
  });

  it("uses exact safe-integer SUM normalization independent of source ordering", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "TRANSPORT_EMBARK_COST",
        scope: { kind: "GLOBAL" },
        stage: "ORIGIN_FLAT",
        operator: "ADD_FLAT",
        sourceKind: "ORIGIN",
        sourceId: "z-source",
        valueUnit: "FFY",
        value: 250,
      },
      {
        axis: "TRANSPORT_EMBARK_COST",
        scope: { kind: "GLOBAL" },
        stage: "ORIGIN_FLAT",
        operator: "ADD_FLAT",
        sourceKind: "ORIGIN",
        sourceId: "a-source",
        valueUnit: "FFY",
        value: 500,
      },
    ];
    const forward = normalizeRuleContributions(
      RULE_AXIS_REGISTRY,
      contributions,
    );
    const reverse = normalizeRuleContributions(
      RULE_AXIS_REGISTRY,
      [...contributions].reverse(),
    );
    expect(forward[0]?.value).toEqual({ kind: "SUM", value: 750 });
    expect(serializeNormalizedRuleRecords(forward)).toBe(
      serializeNormalizedRuleRecords(reverse),
    );
  });

  it("is byte-identical under contribution permutations after reduction", () => {
    const contributions = originRuleContributions([
      "P09",
      "N10",
      "P23",
      "P42",
    ]);
    const forward = normalizeRuleContributions(
      RULE_AXIS_REGISTRY,
      contributions,
    );
    const reverse = normalizeRuleContributions(
      RULE_AXIS_REGISTRY,
      [...contributions].reverse(),
    );
    expect(serializeNormalizedRuleRecords(forward)).toBe(
      serializeNormalizedRuleRecords(reverse),
    );
  });

  it("keeps wildcard and specific scopes as separate normalized terms", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "STRUCTURE_BUILD_COST",
        scope: { kind: "STRUCTURE", structure: "ALL" },
        stage: "ECHO_PERCENT",
        operator: "ADD_PERCENT",
        sourceKind: "ECHO",
        sourceId: "echo:all",
        valueUnit: "BASIS_POINTS",
        value: -200,
      },
      {
        axis: "STRUCTURE_BUILD_COST",
        scope: { kind: "STRUCTURE", structure: "FORT" },
        stage: "ECHO_PERCENT",
        operator: "ADD_PERCENT",
        sourceKind: "ECHO",
        sourceId: "echo:fort",
        valueUnit: "BASIS_POINTS",
        value: -300,
      },
    ];
    expect(
      normalizeRuleContributions(RULE_AXIS_REGISTRY, contributions),
    ).toHaveLength(2);
  });
});
