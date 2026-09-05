import {
  composePressure,
  reduceCapRule,
  reduceCapabilitySetRule,
  reducePermissionRule,
  reduceScalarRule,
  selectStructuralTransform,
  serializeRuleContributions,
  validateRuleAxisRegistry,
  validateRuleContributions,
  type RuleContribution,
} from "../src/core/rules/RuleComposition";
import {
  RULE_AXIS_REGISTRY,
  ruleAxis,
} from "../src/core/rules/RuleAxisRegistry";

const originPercent = (
  axis: keyof typeof RULE_AXIS_REGISTRY,
  sourceId: string,
  unit: RuleContribution["unit"],
  value: number,
): RuleContribution => ({
  axis,
  stage: "ORIGIN_PERCENT",
  operator: "ADD_PERCENT",
  sourceKind: "ORIGIN",
  sourceId,
  unit,
  value,
});

const echoPercent = (
  axis: keyof typeof RULE_AXIS_REGISTRY,
  sourceId: string,
  unit: RuleContribution["unit"],
  value: number,
): RuleContribution => ({
  axis,
  stage: "ECHO_PERCENT",
  operator: "ADD_PERCENT",
  sourceKind: "ECHO",
  sourceId,
  unit,
  value,
});

describe("rule composition registry", () => {
  it("has a valid semantic-stage dependency graph", () => {
    expect(validateRuleAxisRegistry(RULE_AXIS_REGISTRY)).toEqual([]);
  });

  it("rejects unknown axes, wrong units and unresolved singleton transforms", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "NOT_REAL",
        stage: "ORIGIN_PERCENT",
        operator: "ADD_PERCENT",
        sourceKind: "ORIGIN",
        sourceId: "fake",
        unit: "CELLS",
        value: 100,
      },
      {
        axis: "WARSHIP_NAVAL_GUN_RANGE",
        stage: "ORIGIN_PERCENT",
        operator: "ADD_PERCENT",
        sourceKind: "ORIGIN",
        sourceId: "wrong-unit",
        unit: "FFY",
        value: 100,
      },
      {
        axis: "TANK_CHASSIS_PROFILE",
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "transform-a",
        unit: "PROFILE_ID",
        value: "HEAVY_ARTILLERY",
      },
      {
        axis: "TANK_CHASSIS_PROFILE",
        stage: "STRUCTURAL_PROFILE",
        operator: "STRUCTURAL_TRANSFORM",
        sourceKind: "ORIGIN",
        sourceId: "transform-b",
        unit: "PROFILE_ID",
        value: "AMPHIBIOUS_TANK",
      },
    ];

    const codes = validateRuleContributions(
      contributions,
      RULE_AXIS_REGISTRY,
    ).map((issue) => issue.code);
    expect(codes).toContain("UNKNOWN_AXIS");
    expect(codes).toContain("UNIT_MISMATCH");
    expect(codes).toContain("SINGLETON_CONFLICT");
  });
});

describe("canonical #43 numeric cases", () => {
  it("adds P09 and N10 on the same Origin Fort-area stage", () => {
    const contributions = [
      originPercent("FORT_COVERAGE_AREA", "P09", "AREA", 1000),
      originPercent("FORT_COVERAGE_AREA", "N10", "AREA", -2500),
    ];
    expect(
      reduceScalarRule(100, ruleAxis("FORT_COVERAGE_AREA"), contributions),
    ).toBeCloseTo(85);
  });

  it("adds P23 and P42 before projecting Warship naval-gun range", () => {
    const contributions = [
      originPercent("WARSHIP_NAVAL_GUN_RANGE", "P23", "CELLS", 2000),
      originPercent("WARSHIP_NAVAL_GUN_RANGE", "P42", "CELLS", -3300),
    ];
    expect(
      reduceScalarRule(
        130,
        ruleAxis("WARSHIP_NAVAL_GUN_RANGE"),
        contributions,
      ),
    ).toBeCloseTo(113.1);
  });

  it("interprets P09 Fort pressure as a relative +9%, not percentage points", () => {
    const p09 = [
      originPercent(
        "FORT_DEFENSIVE_PRESSURE",
        "P09",
        "BASIS_POINTS",
        900,
      ),
    ];
    const baselines = [1000, 1500, 2000, 2500, 3000];
    expect(
      baselines.map((baseline) =>
        reduceScalarRule(
          baseline,
          ruleAxis("FORT_DEFENSIVE_PRESSURE"),
          p09,
        ),
      ),
    ).toEqual([1090, 1635, 2180, 2725, 3270]);
  });

  it("applies Origin and Echo percentage stages sequentially", () => {
    const contributions = [
      originPercent("WARSHIP_NAVAL_GUN_RANGE", "P23", "CELLS", 2000),
      originPercent("WARSHIP_NAVAL_GUN_RANGE", "P42", "CELLS", -3300),
      echoPercent("WARSHIP_NAVAL_GUN_RANGE", "echo:range", "CELLS", 300),
    ];
    expect(
      reduceScalarRule(
        130,
        ruleAxis("WARSHIP_NAVAL_GUN_RANGE"),
        contributions,
      ),
    ).toBeCloseTo(116.493);
  });

  it("sums flat Transport embark costs", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "TRANSPORT_EMBARK_COST",
        stage: "ORIGIN_FLAT",
        operator: "ADD_FLAT",
        sourceKind: "ORIGIN",
        sourceId: "P37",
        unit: "FFY",
        value: 250,
      },
      {
        axis: "TRANSPORT_EMBARK_COST",
        stage: "ORIGIN_FLAT",
        operator: "ADD_FLAT",
        sourceKind: "ORIGIN",
        sourceId: "N15",
        unit: "FFY",
        value: 500,
      },
    ];
    expect(
      reduceScalarRule(0, ruleAxis("TRANSPORT_EMBARK_COST"), contributions),
    ).toBe(750);
  });
});

describe("terminal rules and typed non-scalar axes", () => {
  it("keeps N08 Fort pressure at hard zero after P09 and Echo specialization", () => {
    const contributions: RuleContribution[] = [
      originPercent(
        "FORT_DEFENSIVE_PRESSURE",
        "P09",
        "BASIS_POINTS",
        900,
      ),
      echoPercent(
        "FORT_DEFENSIVE_PRESSURE",
        "echo:fort-pressure",
        "BASIS_POINTS",
        400,
      ),
      {
        axis: "FORT_DEFENSIVE_PRESSURE",
        stage: "TERMINAL",
        operator: "HARD_ZERO",
        sourceKind: "ORIGIN",
        sourceId: "N08",
        unit: "BASIS_POINTS",
      },
    ];
    expect(
      reduceScalarRule(
        3000,
        ruleAxis("FORT_DEFENSIVE_PRESSURE"),
        contributions,
      ),
    ).toBe(0);
  });

  it("keeps hard build prohibitions separate from cost transformations", () => {
    const n12: RuleContribution = {
      axis: "WARSHIP_BUILD_PERMISSION",
      stage: "PERMISSION",
      operator: "PROHIBIT",
      sourceKind: "ORIGIN",
      sourceId: "N12",
      unit: "BOOLEAN",
    };
    const p42Cost: RuleContribution = {
      axis: "WARSHIP_PURCHASE_FFY_COST",
      stage: "TERMINAL",
      operator: "HARD_ZERO",
      sourceKind: "ORIGIN",
      sourceId: "P42",
      unit: "FFY",
    };
    expect(
      reducePermissionRule(true, ruleAxis("WARSHIP_BUILD_PERMISSION"), [n12]),
    ).toBe(false);
    expect(
      reduceScalarRule(250_000, ruleAxis("WARSHIP_PURCHASE_FFY_COST"), [
        p42Cost,
      ]),
    ).toBe(0);
  });

  it("lets prohibition win when allow and prohibit meet on one permission axis", () => {
    const contributions: RuleContribution[] = [
      {
        axis: "FACTORY_BUILD_PERMISSION",
        stage: "PERMISSION",
        operator: "ALLOW",
        sourceKind: "RULESET_TRANSFORM",
        sourceId: "allow-example",
        unit: "BOOLEAN",
      },
      {
        axis: "FACTORY_BUILD_PERMISSION",
        stage: "PERMISSION",
        operator: "PROHIBIT",
        sourceKind: "ORIGIN",
        sourceId: "N09",
        unit: "BOOLEAN",
      },
    ];
    expect(
      reducePermissionRule(
        true,
        ruleAxis("FACTORY_BUILD_PERMISSION"),
        contributions,
      ),
    ).toBe(false);
  });

  it("treats P04 fixed response effectiveness as a terminal final override", () => {
    const contributions: RuleContribution[] = [
      echoPercent(
        "COUNTER_RESPONSE_EFFECTIVENESS",
        "echo:response",
        "RATIO",
        500,
      ),
      {
        axis: "COUNTER_RESPONSE_EFFECTIVENESS",
        stage: "FINAL_OVERRIDE",
        operator: "FINAL_OVERRIDE",
        sourceKind: "ORIGIN",
        sourceId: "P04",
        unit: "RATIO",
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

  it("supports hard ownership caps without using arbitrary priority", () => {
    const p23: RuleContribution = {
      axis: "WARSHIP_OWNERSHIP_CAP",
      stage: "ORIGIN_CAP",
      operator: "CAP_LIMIT",
      sourceKind: "ORIGIN",
      sourceId: "P23",
      unit: "COUNT",
      value: 1,
    };
    expect(
      reduceCapRule(
        Number.MAX_SAFE_INTEGER,
        ruleAxis("WARSHIP_OWNERSHIP_CAP"),
        [p23],
      ),
    ).toBe(1);
  });

  it("models capability removal independently from numeric damage/range", () => {
    const p30: RuleContribution = {
      axis: "WARSHIP_ATTACK_CAPABILITIES",
      stage: "CAPABILITY_REMOVE",
      operator: "REMOVE_CAPABILITY",
      sourceKind: "ORIGIN",
      sourceId: "P30",
      unit: "CAPABILITY_SET",
      value: "NAVAL_GUNFIRE_AGAINST_SHIPS",
    };
    expect(
      reduceCapabilitySetRule(
        ["NAVAL_GUNFIRE_AGAINST_SHIPS", "CAPTURE_TRADE_SHIP"],
        ruleAxis("WARSHIP_ATTACK_CAPABILITIES"),
        [p30],
      ),
    ).toEqual(["CAPTURE_TRADE_SHIP"]);
  });

  it("accepts one structural transform and rejects implicit transform ordering", () => {
    const p43: RuleContribution = {
      axis: "TANK_CHASSIS_PROFILE",
      stage: "STRUCTURAL_PROFILE",
      operator: "STRUCTURAL_TRANSFORM",
      sourceKind: "ORIGIN",
      sourceId: "P43",
      unit: "PROFILE_ID",
      value: "HEAVY_ARTILLERY",
    };
    expect(
      selectStructuralTransform(ruleAxis("TANK_CHASSIS_PROFILE"), [p43]),
    ).toBe("HEAVY_ARTILLERY");
  });
});

describe("component-aware pressure composition", () => {
  it("uses strongest same-type field and complement composition across Fort/Command", () => {
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

  it("can suppress the Fort component without suppressing Command defense", () => {
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
    const a = originPercent("WARSHIP_NAVAL_GUN_RANGE", "P23", "CELLS", 2000);
    const b = originPercent("WARSHIP_NAVAL_GUN_RANGE", "P42", "CELLS", -3300);
    const c = echoPercent(
      "WARSHIP_NAVAL_GUN_RANGE",
      "echo:range",
      "CELLS",
      300,
    );
    expect(serializeRuleContributions([a, b, c])).toBe(
      serializeRuleContributions([c, a, b]),
    );
  });
});
