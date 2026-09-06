import {
  originRuleContributions,
  originRuleProfileInput,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import type { RuleContribution } from "../src/core/rules/RuleComposition";

describe("canonical rule normalization", () => {
  it("mathematically reduces same-slot additive percentages while retaining provenance", () => {
    const profile = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P23", "P42"]),
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
    const profile = compileRuleProfile(RULE_AXIS_REGISTRY, contributions);
    expect(profile.normalizedRules).toHaveLength(1);
    expect(profile.normalizedRules[0]?.value).toEqual({
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
    const forward = compileRuleProfile(RULE_AXIS_REGISTRY, contributions);
    const reverse = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      [...contributions].reverse(),
    );
    expect(forward.normalizedRules[0]?.value).toEqual({
      kind: "SUM",
      value: 750,
    });
    expect(forward.canonicalSerialization).toBe(reverse.canonicalSerialization);
  });

  it("canonicalizes set-valued operands by sorting and deduplicating", () => {
    const contribution: RuleContribution = {
      axis: "UNIT_ATTACK_CAPABILITIES",
      scope: { kind: "UNIT", unit: "WARSHIP" },
      stage: "CAPABILITY_REPLACE",
      operator: "REPLACE_CAPABILITIES",
      sourceKind: "ORIGIN",
      sourceId: "set-test",
      valueUnit: "CAPABILITY_SET",
      value: [
        "ATTACK_SHIPS",
        "NAVAL_GUNFIRE_AGAINST_SHIPS",
        "ATTACK_SHIPS",
      ],
    };
    const profile = compileRuleProfile(RULE_AXIS_REGISTRY, [contribution]);
    expect(profile.contributions[0]?.value).toEqual([
      "ATTACK_SHIPS",
      "NAVAL_GUNFIRE_AGAINST_SHIPS",
    ]);
  });

  it("is byte-identical under complete-profile permutations", () => {
    const input = originRuleProfileInput([
      "P09",
      "P11",
      "P17",
      "P19",
      "N10",
    ]);
    const forward = compileRuleProfile(RULE_AXIS_REGISTRY, input);
    const reverse = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [...input.contributions].reverse(),
      dynamicProviders: [...(input.dynamicProviders ?? [])].reverse(),
      customDomains: [...(input.customDomains ?? [])].reverse(),
    });
    expect(forward.canonicalSerialization).toBe(reverse.canonicalSerialization);
    expect(forward.dynamicProviders).toHaveLength(3);
  });

  it("keeps wildcard and specific scopes as separate normalized terms", () => {
    const contributions = originRuleContributions(["P09"]);
    const extra: RuleContribution = {
      axis: "STRUCTURE_BUILD_COST",
      scope: { kind: "STRUCTURE", structure: "ALL" },
      stage: "ECHO_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ECHO",
      sourceId: "echo:all",
      valueUnit: "BASIS_POINTS",
      value: -200,
    };
    const profile = compileRuleProfile(RULE_AXIS_REGISTRY, [
      ...contributions,
      extra,
    ]);
    expect(
      profile.normalizedRules.filter(
        (record) => record.axis === "STRUCTURE_BUILD_COST",
      ),
    ).toHaveLength(2);
  });
});
