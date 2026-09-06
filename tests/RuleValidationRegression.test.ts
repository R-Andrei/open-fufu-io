import {
  validateRuleContributions,
  type DynamicRuleProvider,
  type RuleCondition,
  type RuleContribution,
} from "../src/core/rules/RuleComposition";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  compileRuleProfile,
  ruleConditionSetIsSatisfiable,
  ruleConditionSetsMayOverlap,
  validateRuleProfile,
} from "../src/core/rules/RuleCompiler";

const tankScope = { kind: "UNIT", unit: "TANK" } as const;
const fortScope = { kind: "STRUCTURE", structure: "FORT" } as const;

function structuralContribution(
  sourceId: string,
  profile: string,
  conditions?: readonly RuleCondition[],
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
    ...(conditions === undefined ? {} : { conditions }),
  };
}

function canonicalDynamicProvider(): DynamicRuleProvider {
  return {
    id: "dynamic:test",
    axis: "GLOBAL_OFFENSIVE_PRESSURE",
    scope: { kind: "GLOBAL" },
    stage: "CONTEXTUAL_PERCENT",
    operator: "ADD_PERCENT",
    sourceKind: "ORIGIN",
    sourceId: "P19",
    dependency: "TERRITORIAL_CONTACT_COUNT",
    formula: { kind: "BASIS_POINTS_PER_COUNT", bpPerUnit: 500 },
    operandKind: "BASIS_POINTS",
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

  it("accepts legitimate situational and scenario provenance", () => {
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
  it("rejects invalid and non-exact deserialized scopes", () => {
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
    const extraScopeField = {
      axis: "GLOBAL_OFFENSIVE_PRESSURE",
      scope: { kind: "GLOBAL", junk: "must-not-hash" },
      stage: "ORIGIN_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      sourceId: "extra-scope",
      valueUnit: "BASIS_POINTS",
      value: 100,
    } as unknown as RuleContribution;
    const codes = validateRuleContributions(
      [invalidScope, extraScopeField],
      RULE_AXIS_REGISTRY,
    ).map((issue) => issue.code);
    expect(codes.filter((code) => code === "INVALID_SCOPE_VALUE")).toHaveLength(2);
  });

  it("rejects invalid, wildcard, and non-exact condition payloads", () => {
    const base = {
      axis: "GLOBAL_OFFENSIVE_PRESSURE",
      scope: { kind: "GLOBAL" },
      stage: "CONTEXTUAL_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      valueUnit: "BASIS_POINTS",
      value: 100,
    } as const;
    const invalidTerrain = {
      ...base,
      sourceId: "bad-terrain",
      conditions: [{ kind: "EVENT_TERRAIN_IS", terrain: "LAVA" }],
    } as unknown as RuleContribution;
    const wildcardUnit = {
      ...base,
      sourceId: "wildcard-unit",
      conditions: [{ kind: "TARGET_UNIT_IS", unit: "ALL" }],
    } as unknown as RuleContribution;
    const extraConditionField = {
      ...base,
      sourceId: "extra-condition",
      conditions: [{ kind: "TARGET_HAS_FALLOUT", junk: true }],
    } as unknown as RuleContribution;
    const codes = validateRuleContributions(
      [invalidTerrain, wildcardUnit, extraConditionField],
      RULE_AXIS_REGISTRY,
    ).map((issue) => issue.code);
    expect(codes.filter((code) => code === "INVALID_CONDITION")).toHaveLength(3);
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

describe("dynamic-provider compile-time validation", () => {
  it("accepts the canonical P11/P17/P19 providers", () => {
    expect(
      validateRuleProfile(
        RULE_AXIS_REGISTRY,
        originRuleProfileInput(["P11", "P17", "P19"]),
      ),
    ).toEqual([]);
  });

  it("rejects a non-object provider payload without throwing", () => {
    const malformed = null as unknown as DynamicRuleProvider;
    expect(() =>
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [malformed],
      }),
    ).not.toThrow();
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [malformed],
      }).map((issue) => issue.code),
    ).toContain("INVALID_DYNAMIC_PROVIDER_SHAPE");
  });

  it("rejects unknown state dependencies", () => {
    const provider = {
      ...canonicalDynamicProvider(),
      dependency: "CURRENT_MOON_PHASE",
    } as unknown as DynamicRuleProvider;
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [provider],
      }).map((issue) => issue.code),
    ).toContain("INVALID_DYNAMIC_DEPENDENCY");
  });

  it("rejects formula/result-kind disagreement", () => {
    const provider = {
      ...canonicalDynamicProvider(),
      formula: { kind: "RATIONAL_POWER", numerator: 99, denominator: 100 },
      operandKind: "BASIS_POINTS",
    } as DynamicRuleProvider;
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [provider],
      }).map((issue) => issue.code),
    ).toContain("DYNAMIC_OPERAND_KIND_MISMATCH");
  });

  it("rejects invalid dynamic formula parameters before runtime evaluation", () => {
    const zeroDenominator = {
      ...canonicalDynamicProvider(),
      operator: "MULTIPLY",
      stage: "ORIGIN_SCALAR",
      axis: "STRUCTURE_UPGRADE_COST",
      scope: { kind: "STRUCTURE", structure: "ALL" },
      dependency: "OWNED_PERSISTENT_STRUCTURE_COUNT",
      formula: { kind: "RATIONAL_POWER", numerator: 99, denominator: 0 },
      operandKind: "RATIONAL",
    } as DynamicRuleProvider;
    const zeroStep = {
      ...canonicalDynamicProvider(),
      operator: "CAP_LIMIT",
      stage: "ORIGIN_CAP",
      axis: "STRUCTURE_OWNERSHIP_CAP",
      scope: { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
      dependency: "PEAK_TOTAL_POPULATION",
      formula: { kind: "FLOOR_COUNT_PER_UNITS", unitsPerStep: 0 },
      operandKind: "INTEGER",
    } as DynamicRuleProvider;
    const fractionalRate = {
      ...canonicalDynamicProvider(),
      formula: { kind: "BASIS_POINTS_PER_COUNT", bpPerUnit: 0.5 },
    } as DynamicRuleProvider;
    const codes = validateRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [],
      dynamicProviders: [zeroDenominator, zeroStep, fractionalRate],
    }).map((issue) => issue.code);
    expect(codes.filter((code) => code === "INVALID_DYNAMIC_FORMULA")).toHaveLength(3);
  });

  it("rejects non-exact provider and formula shapes", () => {
    const extraProviderField = {
      ...canonicalDynamicProvider(),
      priority: 999,
    } as unknown as DynamicRuleProvider;
    const extraFormulaField = {
      ...canonicalDynamicProvider(),
      formula: {
        kind: "BASIS_POINTS_PER_COUNT",
        bpPerUnit: 500,
        hiddenMultiplier: 2,
      },
    } as unknown as DynamicRuleProvider;

    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [extraProviderField],
      }).map((issue) => issue.code),
    ).toContain("INVALID_DYNAMIC_PROVIDER_SHAPE");
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [extraFormulaField],
      }).map((issue) => issue.code),
    ).toContain("INVALID_DYNAMIC_FORMULA");
  });
});

describe("condition-conjunction validation", () => {
  it("recognizes a contradiction across two different conjunctions", () => {
    expect(
      ruleConditionSetsMayOverlap(
        [
          {
            kind: "STRUCTURE_ACQUISITION_PATH_IS",
            path: "CAPTURE_TRANSFER",
          },
          { kind: "TARGET_UNIT_IS", unit: "TANK" },
        ],
        [
          {
            kind: "STRUCTURE_ACQUISITION_PATH_IS",
            path: "CAPTURE_TRANSFER",
          },
          { kind: "TARGET_UNIT_IS", unit: "HEAVY_ARTILLERY" },
        ],
      ),
    ).toBe(false);
  });

  it("rejects internally contradictory condition conjunctions", () => {
    expect(
      ruleConditionSetIsSatisfiable([
        { kind: "TARGET_HAS_FALLOUT" },
        { kind: "TARGET_LACKS_FALLOUT" },
      ]),
    ).toBe(false);
    expect(
      ruleConditionSetIsSatisfiable([
        { kind: "TARGET_UNIT_IS", unit: "TANK" },
        { kind: "TARGET_UNIT_IS", unit: "WARSHIP" },
      ]),
    ).toBe(false);
    expect(
      ruleConditionSetIsSatisfiable([
        {
          kind: "STRUCTURE_ACQUISITION_PATH_IS",
          path: "PURCHASE_BUILD",
        },
        {
          kind: "STRUCTURE_ACQUISITION_PATH_IS",
          path: "CAPTURE_TRANSFER",
        },
      ]),
    ).toBe(false);
    expect(
      ruleConditionSetIsSatisfiable([
        {
          kind: "STRUCTURE_ACQUISITION_PATH_IS",
          path: "CAPTURE_TRANSFER",
        },
        { kind: "TARGET_UNIT_IS", unit: "TANK" },
      ]),
    ).toBe(true);
  });

  it("rejects an impossible static rule during profile compilation", () => {
    const impossible: RuleContribution = {
      axis: "GLOBAL_OFFENSIVE_PRESSURE",
      scope: { kind: "GLOBAL" },
      stage: "CONTEXTUAL_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      sourceId: "impossible-static",
      valueUnit: "BASIS_POINTS",
      value: 100,
      conditions: [
        { kind: "TARGET_HAS_FALLOUT" },
        { kind: "TARGET_LACKS_FALLOUT" },
      ],
    };
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, [impossible]).map(
        (issue) => issue.code,
      ),
    ).toContain("UNSATISFIABLE_CONDITION_SET");
    expect(() => compileRuleProfile(RULE_AXIS_REGISTRY, [impossible])).toThrow();
  });

  it("rejects an impossible dynamic provider during profile compilation", () => {
    const impossible: DynamicRuleProvider = {
      ...canonicalDynamicProvider(),
      conditions: [
        { kind: "TARGET_UNIT_IS", unit: "TANK" },
        { kind: "TARGET_UNIT_IS", unit: "WARSHIP" },
      ],
    };
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, {
        contributions: [],
        dynamicProviders: [impossible],
      }).map((issue) => issue.code),
    ).toContain("UNSATISFIABLE_CONDITION_SET");
  });

  it("allows singleton transforms whose conjunctions are provably exclusive", () => {
    const built = structuralContribution("origin:built", "BUILT_PROFILE", [
      {
        kind: "STRUCTURE_ACQUISITION_PATH_IS",
        path: "PURCHASE_BUILD",
      },
    ]);
    const captured = structuralContribution("origin:captured", "CAPTURED_PROFILE", [
      {
        kind: "STRUCTURE_ACQUISITION_PATH_IS",
        path: "CAPTURE_TRANSFER",
      },
    ]);
    expect(validateRuleProfile(RULE_AXIS_REGISTRY, [built, captured])).toEqual([]);
    expect(() =>
      compileRuleProfile(RULE_AXIS_REGISTRY, [built, captured]),
    ).not.toThrow();
  });

  it("rejects singleton transforms whose conjunctions can overlap", () => {
    const captured = structuralContribution("origin:captured", "CAPTURED_PROFILE", [
      {
        kind: "STRUCTURE_ACQUISITION_PATH_IS",
        path: "CAPTURE_TRANSFER",
      },
    ]);
    const unconditional = structuralContribution(
      "origin:any-provenance",
      "ANY_PROFILE",
    );
    expect(
      validateRuleProfile(RULE_AXIS_REGISTRY, [captured, unconditional]).map(
        (issue) => issue.code,
      ),
    ).toContain("OVERLAPPING_SINGLETON_CONFLICT");
  });
});
