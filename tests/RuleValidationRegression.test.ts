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
});

describe("condition-aware singleton validation", () => {
  it("allows singleton transforms whose typed conditions are provably exclusive", () => {
    const built = structuralContribution("origin:built", "BUILT_PROFILE", {
      kind: "STRUCTURE_PROVENANCE_IS",
      provenance: "BUILT",
    });
    const captured = structuralContribution("origin:captured", "CAPTURED_PROFILE", {
      kind: "STRUCTURE_PROVENANCE_IS",
      provenance: "CAPTURED",
    });

    expect(validateRuleProfile(RULE_AXIS_REGISTRY, [built, captured])).toEqual([]);
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
