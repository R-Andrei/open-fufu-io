import {
  GLOBAL_RULE_SCOPE,
  composePressure,
  reduceCapRule,
  reduceCapabilitySetRule,
  reducePermissionRule,
  reduceScalarRule,
  selectApplicableRuleContributions,
  selectStructuralTransform,
  serializeRuleContributions,
  validateRuleAxisRegistry,
  validateRuleContributions,
  type RuleContribution,
  type RuleScope,
} from "../src/core/rules/RuleComposition";
import {
  RULE_AXIS_REGISTRY,
  ruleAxis,
} from "../src/core/rules/RuleAxisRegistry";

const unitScope = (unit: "WARSHIP" | "TANK"): RuleScope => ({
  kind: "UNIT",
  unit,
});
const structureScope = (
  structure: "ALL" | "FORT" | "CITY",
): RuleScope => ({ kind: "STRUCTURE", structure });

const percent = (
  axis: keyof typeof RULE_AXIS_REGISTRY,
  scope: RuleScope,
  sourceKind: "ORIGIN" | "ECHO",
  sourceId: string,
  value: number,
): RuleContribution => ({
  axis,
  scope,
  stage: sourceKind === "ORIGIN" ? "ORIGIN_PERCENT" : "ECHO_PERCENT",
  operator: "ADD_PERCENT",
  sourceKind,
  sourceId,
  valueUnit: "BASIS_POINTS",
  value,
});

describe("rule composition registry", () => {
  it("has an acyclic semantic-stage graph", () => {
    expect(validateRuleAxisRegistry(RULE_AXIS_REGISTRY)).toEqual([]);
  });

  it("distinguishes axis result units from modifier operand units", () => {
    const invalid: RuleContribution = {
      axis: "UNIT_ATTACK_RANGE",
      scope: unitScope("WARSHIP"),
      stage: "ORIGIN_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      sourceId: "wrong-unit",
      valueUnit: "CELLS",
      value: 2000,
    };
    expect(
      validateRuleContributions([invalid], RULE_AXIS_REGISTRY).map(
        (issue) => issue.code,
      ),
    ).toContain("VALUE_UNIT_MISMATCH");
  });

  it("rejects unknown axes, wrong scope kinds and structural singleton collisions", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "NOT_REAL",
        scope: GLOBAL_RULE_SCOPE,
        stage: "ORIGIN_PERCENT",
        operator: "ADD_PERCENT",
        sourceKind: "ORIGIN",
        sourceId: "fake",
        valueUnit: "BASIS_POINTS",
        value: 100,
      },
      {
        axis: "UNIT_ATTACK_RANGE",
        scope: structureScope("FORT"),
        stage: "ORIGIN_PERCENT",
        operator: "ADD_PERCENT",
        sourceKind: "ORIGIN",
        sourceId: "wrong-scope",
        valueUnit: "BASIS_POINTS",
        value: 100,
      },
      {
        axis: "UNIT_CHASSIS_PROFILE",
        scope: unitScope("TANK"),
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "transform-a",
        valueUnit: "PROFILE_ID",
        value: "HEAVY_ARTILLERY",
      },
      {
        axis: "UNIT_CHASSIS_PROFILE",
        scope: unitScope("TANK"),
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "transform-b",
        valueUnit: "PROFILE_ID",
        value: "AMPHIBIOUS_TANK",
      },
    ];
    const codes = validateRuleContributions(
      contributions,
      RULE_AXIS_REGISTRY,
    ).map((issue) => issue.code);
    expect(codes).toContain("UNKNOWN_AXIS");
    expect(codes).toContain("SCOPE_KIND_MISMATCH");
    expect(codes).toContain("SINGLETON_CONFLICT");
  });
});

describe("typed scopes", () => {
  it("lets ALL and specific structure modifiers compose on a requested Fort", () => {
    const all = percent(
      "STRUCTURE_BUILD_COST",
      structureScope("ALL"),
      "ECHO",
      "echo:all-build",
      -400,
    );
    const fort = percent(
      "STRUCTURE_BUILD_COST",
      structureScope("FORT"),
      "ECHO",
      "echo:fort-build",
      -500,
    );
    const forFort = selectApplicableRuleContributions(
      "STRUCTURE_BUILD_COST",
      structureScope("FORT"),
      [all, fort],
    );
    const forCity = selectApplicableRuleContributions(
      "STRUCTURE_BUILD_COST",
      structureScope("CITY"),
      [all, fort],
    );
    expect(
      reduceScalarRule(1000, ruleAxis("STRUCTURE_BUILD_COST"), forFort),
    ).toBeCloseTo(910);
    expect(
      reduceScalarRule(1000, ruleAxis("STRUCTURE_BUILD_COST"), forCity),
    ).toBeCloseTo(960);
  });
});

describe("canonical numeric composition cases", () => {
  it("adds P09 and N10 on the same Origin Fort-area stage", () => {
    const contributions = [
      percent(
        "STRUCTURE_FIELD_COVERAGE_AREA",
        structureScope("FORT"),
        "ORIGIN",
        "P09",
        1000,
      ),
      percent(
        "STRUCTURE_FIELD_COVERAGE_AREA",
        structureScope("FORT"),
        "ORIGIN",
        "N10",
        -2500,
      ),
    ];
    expect(
      reduceScalarRule(
        100,
        ruleAxis("STRUCTURE_FIELD_COVERAGE_AREA"),
        contributions,
      ),
    ).toBeCloseTo(85);
  });

  it("adds P23 and P42 before projecting Warship attack range", () => {
    const contributions = [
      percent("UNIT_ATTACK_RANGE", unitScope("WARSHIP"), "ORIGIN", "P23", 2000),
      percent("UNIT_ATTACK_RANGE", unitScope("WARSHIP"), "ORIGIN", "P42", -3300),
    ];
    expect(
      reduceScalarRule(130, ruleAxis("UNIT_ATTACK_RANGE"), contributions),
    ).toBeCloseTo(113.1);
  });

  it("interprets P09 Fort pressure as a relative +9%", () => {
    const p09 = [
      percent(
        "STRUCTURE_PRESSURE_MAGNITUDE",
        structureScope("FORT"),
        "ORIGIN",
        "P09",
        900,
      ),
    ];
    expect(
      [1000, 1500, 2000, 2500, 3000].map((base) =>
        reduceScalarRule(
          base,
          ruleAxis("STRUCTURE_PRESSURE_MAGNITUDE"),
          p09,
        ),
      ),
    ).toEqual([1090, 1635, 2180, 2725, 3270]);
  });

  it("applies Origin and Echo stages sequentially", () => {
    const contributions = [
      percent("UNIT_ATTACK_RANGE", unitScope("WARSHIP"), "ORIGIN", "P23", 2000),
      percent("UNIT_ATTACK_RANGE", unitScope("WARSHIP"), "ORIGIN", "P42", -3300),
      percent("UNIT_ATTACK_RANGE", unitScope("WARSHIP"), "ECHO", "echo:range", 300),
    ];
    expect(
      reduceScalarRule(130, ruleAxis("UNIT_ATTACK_RANGE"), contributions),
    ).toBeCloseTo(116.493);
  });

  it("sums P37 and N15 flat Transport embark costs", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "TRANSPORT_EMBARK_COST",
        scope: GLOBAL_RULE_SCOPE,
        stage: "ORIGIN_FLAT",
        operator: "ADD_FLAT",
        sourceKind: "ORIGIN",
        sourceId: "P37",
        valueUnit: "FFY",
        value: 250,
      },
      {
        axis: "TRANSPORT_EMBARK_COST",
        scope: GLOBAL_RULE_SCOPE,
        stage: "ORIGIN_FLAT",
        operator: "ADD_FLAT",
        sourceKind: "ORIGIN",
        sourceId: "N15",
        valueUnit: "FFY",
        value: 500,
      },
    ];
    expect(
      reduceScalarRule(0, ruleAxis("TRANSPORT_EMBARK_COST"), contributions),
    ).toBe(750);
  });
});

describe("terminal and non-scalar rules", () => {
  it("keeps N08 Fort pressure at hard zero after P09 and Echo specialization", () => {
    const contributions: RuleContribution[] = [
      percent(
        "STRUCTURE_PRESSURE_MAGNITUDE",
        structureScope("FORT"),
        "ORIGIN",
        "P09",
        900,
      ),
      percent(
        "STRUCTURE_PRESSURE_MAGNITUDE",
        structureScope("FORT"),
        "ECHO",
        "echo:fort-pressure",
        400,
      ),
      {
        axis: "STRUCTURE_PRESSURE_MAGNITUDE",
        scope: structureScope("FORT"),
        stage: "TERMINAL",
        operator: "HARD_ZERO",
        sourceKind: "ORIGIN",
        sourceId: "N08",
        valueUnit: "NONE",
      },
    ];
    expect(
      reduceScalarRule(
        3000,
        ruleAxis("STRUCTURE_PRESSURE_MAGNITUDE"),
        contributions,
      ),
    ).toBe(0);
  });

  it("keeps N12 build prohibition separate from P42 zero FFY cost", () => {
    const n12: RuleContribution = {
      axis: "UNIT_BUILD_PERMISSION",
      scope: unitScope("WARSHIP"),
      stage: "PERMISSION",
      operator: "PROHIBIT",
      sourceKind: "ORIGIN",
      sourceId: "N12",
      valueUnit: "NONE",
    };
    const p42: RuleContribution = {
      axis: "UNIT_PURCHASE_FFY_COST",
      scope: unitScope("WARSHIP"),
      stage: "TERMINAL",
      operator: "HARD_ZERO",
      sourceKind: "ORIGIN",
      sourceId: "P42",
      valueUnit: "NONE",
    };
    expect(
      reducePermissionRule(true, ruleAxis("UNIT_BUILD_PERMISSION"), [n12]),
    ).toBe(false);
    expect(
      reduceScalarRule(250_000, ruleAxis("UNIT_PURCHASE_FFY_COST"), [p42]),
    ).toBe(0);
  });

  it("lets a prohibition win over an ordinary permission", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "STRUCTURE_BUILD_PERMISSION",
        scope: { kind: "STRUCTURE", structure: "FACTORY" },
        stage: "PERMISSION",
        operator: "ALLOW",
        sourceKind: "RULESET_TRANSFORM",
        sourceId: "allow-example",
        valueUnit: "NONE",
      },
      {
        axis: "STRUCTURE_BUILD_PERMISSION",
        scope: { kind: "STRUCTURE", structure: "FACTORY" },
        stage: "PERMISSION",
        operator: "PROHIBIT",
        sourceKind: "ORIGIN",
        sourceId: "N09",
        valueUnit: "NONE",
      },
    ];
    expect(
      reducePermissionRule(
        true,
        ruleAxis("STRUCTURE_BUILD_PERMISSION"),
        contributions,
      ),
    ).toBe(false);
  });

  it("treats P04 as a terminal final override", () => {
    const contributions: RuleContribution[] = [
      percent(
        "COUNTER_RESPONSE_EFFECTIVENESS",
        GLOBAL_RULE_SCOPE,
        "ECHO",
        "echo:response",
        500,
      ),
      {
        axis: "COUNTER_RESPONSE_EFFECTIVENESS",
        scope: GLOBAL_RULE_SCOPE,
        stage: "FINAL_OVERRIDE",
        operator: "FINAL_OVERRIDE",
        sourceKind: "ORIGIN",
        sourceId: "P04",
        valueUnit: "RATIO",
        value: 1,
      },
    ];
    expect(
      reduceScalarRule(
        1.3,
        ruleAxis("COUNTER_RESPONSE_EFFECTIVENESS"),
        contributions,
      ),
    ).toBe(1);
  });

  it("supports P23 ownership cap without priority numbers", () => {
    const p23: RuleContribution = {
      axis: "UNIT_OWNERSHIP_CAP",
      scope: unitScope("WARSHIP"),
      stage: "ORIGIN_CAP",
      operator: "CAP_LIMIT",
      sourceKind: "ORIGIN",
      sourceId: "P23",
      valueUnit: "COUNT",
      value: 1,
    };
    expect(
      reduceCapRule(
        Number.MAX_SAFE_INTEGER,
        ruleAxis("UNIT_OWNERSHIP_CAP"),
        [p23],
      ),
    ).toBe(1);
  });

  it("models P30 capability removal independently of numeric stats", () => {
    const p30: RuleContribution = {
      axis: "UNIT_ATTACK_CAPABILITIES",
      scope: unitScope("WARSHIP"),
      stage: "CAPABILITY_REMOVE",
      operator: "REMOVE_CAPABILITY",
      sourceKind: "ORIGIN",
      sourceId: "P30",
      valueUnit: "CAPABILITY_SET",
      value: "NAVAL_GUNFIRE_AGAINST_SHIPS",
    };
    expect(
      reduceCapabilitySetRule(
        ["NAVAL_GUNFIRE_AGAINST_SHIPS", "CAPTURE_TRADE_SHIP"],
        ruleAxis("UNIT_ATTACK_CAPABILITIES"),
        [p30],
      ),
    ).toEqual(["CAPTURE_TRADE_SHIP"]);
  });

  it("accepts one P43 structural chassis transform", () => {
    const p43: RuleContribution = {
      axis: "UNIT_CHASSIS_PROFILE",
      scope: unitScope("TANK"),
      stage: "STRUCTURAL_PROFILE",
      operator: "STRUCTURAL_TRANSFORM",
      sourceKind: "ORIGIN",
      sourceId: "P43",
      valueUnit: "PROFILE_ID",
      value: "HEAVY_ARTILLERY",
    };
    expect(
      selectStructuralTransform(ruleAxis("UNIT_CHASSIS_PROFILE"), [p43]),
    ).toBe("HEAVY_ARTILLERY");
  });
});

describe("component-aware pressure composition", () => {
  it("uses strongest same-type field and Fort/Command complement composition", () => {
    expect(
      composePressure({
        basePressure: 1,
        structureFields: [
          { fieldType: "FORT", component: "FORT_A", bonusBp: 1000 },
          { fieldType: "FORT", component: "FORT_B", bonusBp: 3000 },
          {
            fieldType: "COMMAND_POST",
            component: "COMMAND_A",
            bonusBp: 1500,
          },
        ],
      }),
    ).toBeCloseTo(1.405);
  });

  it("suppresses Fort provenance without suppressing Command defense", () => {
    expect(
      composePressure({
        basePressure: 1,
        terrainPercentBp: [3300],
        structureFields: [
          {
            fieldType: "FORT",
            component: "HOSTILE_FORT_DEFENSE",
            bonusBp: 3000,
          },
          {
            fieldType: "COMMAND_POST",
            component: "COMMAND_DEFENSE",
            bonusBp: 1500,
          },
        ],
        suppressedComponents: new Set(["HOSTILE_FORT_DEFENSE"]),
      }),
    ).toBeCloseTo(1.5295);
  });
});

describe("canonical serialization", () => {
  it("is invariant to contribution input order", () => {
    const a = percent(
      "UNIT_ATTACK_RANGE",
      unitScope("WARSHIP"),
      "ORIGIN",
      "P23",
      2000,
    );
    const b = percent(
      "UNIT_ATTACK_RANGE",
      unitScope("WARSHIP"),
      "ORIGIN",
      "P42",
      -3300,
    );
    const c = percent(
      "UNIT_ATTACK_RANGE",
      unitScope("WARSHIP"),
      "ECHO",
      "echo:range",
      300,
    );
    expect(serializeRuleContributions([a, b, c])).toBe(
      serializeRuleContributions([c, a, b]),
    );
  });
});
