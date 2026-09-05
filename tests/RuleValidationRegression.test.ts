import {
  validateRuleContributions,
  type RuleContribution,
} from "../src/core/rules/RuleComposition";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  compileRuleProfile,
  validateRuleProfile,
} from "../src/core/rules/RuleCompiler";

const tankScope = { kind: "UNIT", unit: "TANK" } as const;
const fortScope = { kind: "STRUCTURE", structure: "FORT" } as const;

function structuralContribution(
  sourceId: string,
  profile: string,
  condition?: RuleContribution["condition"],
): RuleContribution {
  return {
    axis: "STRUCTURE_EFFECT_PROFILE",
    scope: fortScope,
    stage: "STRUCTURAL_PROFILE",
    operator: "STRUCTURAL_TRANSFORM",
    sourceKind: "ORIGIN",
    sourceId,
    valueUnit: "PROFILE_ID",
    value: profile,
    ...(condition === undefined ? {} : { condition }),
  };
}

describe("rule-stage provenance validation", () => {
  it("rejects an Echo contribution authored into an Origin semantic stage", () => {
    const invalid: RuleContribution = {
      axis: "UNIT_ATTACK_RANGE",
      scope: tankScope,
      stage: "ORIGIN_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ECHO",
      sourceId: "echo:wrong-stage",
      valueUnit: "BASIS_POINTS",
      value: 500,
    };

    expect(
      validateRuleContributions([invalid], RULE_AXIS_REGISTRY).map(
        (issue) => issue.code,
      ),
    ).toContain("SOURCE_KIND_NOT_ALLOWED_IN_STAGE");
  });

  it("accepts legitimate situational and scenario provenance on stages that admit them", () => {
    const situational: RuleContribution = {
      axis: "GLOBAL_OFFENSIVE_PRESSURE",
      scope: { kind: "GLOBAL" },
      stage: "CONTEXTUAL_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "SITUATIONAL",
      sourceId: "weather:test",
      valueUnit: "BASIS_POINTS",
      value: 250,
    };
    const scenario: RuleContribution = {
      axis: "COUNTER_RESPONSE_EFFECTIVENESS",
      scope: { kind: "GLOBAL" },
      stage: "FINAL_OVERRIDE",
      operator: "FINAL_OVERRIDE",
      sourceKind: "SCENARIO",
      sourceId: "scenario:test",
      valueUnit: "RATIO",
      value: 0.8,
    };

    expect(
      validateRuleContributions(
        [situational, scenario],
        RULE_AXIS_REGISTRY,
      ),
    ).toEqual([]);
  });
});

describe("runtime payload validation", () => {
  it("rejects invalid deserialized scope and condition payloads", () => {
    const invalidScope = {
      axis: "UNIT_ATTACK_RANGE",
      scope: { kind: "UNIT", unit: "NOT_A_UNIT" },
      stage: "ORIGIN_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      sourceId: "bad-scope",
      valueUnit: "BASIS_POINTS",
      value: 100,
    } as unknown as RuleContribution;
    const invalidCondition = {
      axis: "FFY_EVENT_YIELD",
      scope: { kind: "FFY_FAMILY", family: "ALL" },
      stage: "ORIGIN_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      sourceId: "bad-condition",
      valueUnit: "BASIS_POINTS",
      value: 100,
      condition: { kind: "EVENT_TERRAIN_IS", terrain: "LAVA" },
    } as unknown as RuleContribution;

    const codes = validateRuleContributions(
      [invalidScope, invalidCondition],
      RULE_AXIS_REGISTRY,
    ).map((issue) => issue.code);
    expect(codes).toContain("INVALID_SCOPE_VALUE");
    expect(codes).toContain("INVALID_CONDITION");
  });

  it("rejects unregistered capability IDs and fractional V1 flat operands", () => {
    const badCapability = {
      axis: "STRUCTURE_ATTACK_CAPABILITIES",
      scope: { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
      stage: "CAPABILITY_ADD",
      operator: "ADD_CAPABILITY",
      sourceKind: "ORIGIN",
      sourceId: "bad-capability",
      valueUnit: "CAPABILITY_SET",
      value: "DO_MAGIC",
    } as RuleContribution;
    const fractionalFlat: RuleContribution = {
      axis: "TRANSPORT_EMBARK_COST",
      scope: { kind: "GLOBAL" },
      stage: "ORIGIN_FLAT",
      operator: "ADD_FLAT",
      sourceKind: "ORIGIN",
      sourceId: "fractional-flat",
      valueUnit: "FFY",
      value: 0.5,
    };

    const codes = validateRuleContributions(
      [badCapability, fractionalFlat],
      RULE_AXIS_REGISTRY,
    ).map((issue) => issue.code);
    expect(codes).toContain("INVALID_CAPABILITY_VALUE");
    expect(codes).toContain("NON_INTEGER_FLAT_VALUE");
  });
});

describe("condition-aware singleton validation", () => {
  it("allows singleton transforms whose typed conditions are provably exclusive", () => {
    const built = structuralContribution("origin:built", "BUILT_PROFILE", {
      kind: "STRUCTURE_PROVENANCE_IS",
      provenance: "BUILT",
    });
    const captured = structuralContribution(
      "origin:captured",
      "CAPTURED_PROFILE",
      {
        kind: "STRUCTURE_PROVENANCE_IS",
        provenance: "CAPTURED",
      },
    );

    expect(validateRuleProfile(RULE_AXIS_REGISTRY, [built, captured])).toEqual(
      [],
    );
    expect(() =>
      compileRuleProfile(RULE_AXIS_REGISTRY, [built, captured]),
    ).not.toThrow();
  });

  it("rejects singleton transforms whose conditions can overlap", () => {
    const built = structuralContribution("origin:built", "BUILT_PROFILE", {
      kind: "STRUCTURE_PROVENANCE_IS",
      provenance: "BUILT",
    });
    const unconditional = structuralContribution(
      "origin:any-provenance",
      "ANY_PROFILE",
    );

    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, [built, unconditional]).map(
        (issue) => issue.code,
      ),
    ).toContain("OVERLAPPING_SINGLETON_CONFLICT");
  });
});
