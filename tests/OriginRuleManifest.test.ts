import {
  EXPECTED_ORIGIN_TRAIT_IDS,
  ORIGIN_RULE_MANIFEST,
  ORIGIN_RULE_MANIFEST_BY_ID,
  RULE_COMPONENT,
  evaluateDynamicRuleProvider,
  originDynamicRuleProviders,
  originRuleContributions,
  originRuleProfileInput,
} from "../src/core/rules/OriginRuleManifest";
import {
  reduceCapabilitySetRule,
  reduceComponentSetRule,
  reducePermissionRule,
  reduceScalarRule,
  selectRuleContributionsForScope,
  validateRuleContributions,
} from "../src/core/rules/RuleComposition";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  RULE_AXIS_REGISTRY,
  ruleAxis,
} from "../src/core/rules/RuleAxisRegistry";

describe("Origin rule manifest", () => {
  it("requires an explicit manifest entry for every current P01-P54 and N01-N18 trait", () => {
    expect(EXPECTED_ORIGIN_TRAIT_IDS).toHaveLength(72);
    expect(ORIGIN_RULE_MANIFEST).toHaveLength(72);
    expect(ORIGIN_RULE_MANIFEST_BY_ID.size).toBe(72);
    expect(ORIGIN_RULE_MANIFEST.map((entry) => entry.id)).toEqual(
      [...EXPECTED_ORIGIN_TRAIT_IDS].sort(),
    );

    for (const entry of ORIGIN_RULE_MANIFEST) {
      if (entry.classification === "CUSTOM") {
        expect(entry.customDomains.length).toBeGreaterThan(0);
        expect(entry.dynamicProviders).toEqual([]);
      }
      if (entry.classification === "DYNAMIC") {
        expect(entry.dynamicProviders.length).toBeGreaterThan(0);
      }
      if (entry.classification === "DECLARATIVE") {
        expect(entry.dynamicProviders).toEqual([]);
        expect(entry.customDomains).toEqual([]);
      }
    }
  });

  it("keeps every static contribution valid against the axis registry", () => {
    for (const entry of ORIGIN_RULE_MANIFEST) {
      expect(
        validateRuleContributions(entry.contributions, RULE_AXIS_REGISTRY),
      ).toEqual([]);
    }
  });

  it("compiles every single-trait complete profile including dynamic/custom declarations", () => {
    for (const id of EXPECTED_ORIGIN_TRAIT_IDS) {
      expect(() =>
        compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([id])),
      ).not.toThrow();
    }
  });

  it("projects every P09 Fort numeric hook, including upgrade cost", () => {
    const p09 = originRuleContributions(["P09"]);
    expect(p09).toHaveLength(4);
    const build = selectRuleContributionsForScope(
      "STRUCTURE_BUILD_COST",
      { kind: "STRUCTURE", structure: "FORT" },
      p09,
    );
    const upgrade = selectRuleContributionsForScope(
      "STRUCTURE_UPGRADE_COST",
      { kind: "STRUCTURE", structure: "FORT" },
      p09,
    );
    expect(
      reduceScalarRule(1000, ruleAxis("STRUCTURE_BUILD_COST"), build),
    ).toBe(920);
    expect(
      reduceScalarRule(1000, ruleAxis("STRUCTURE_UPGRADE_COST"), upgrade),
    ).toBe(920);
  });

  it("models P11 zero-cost SAM transactions plus the peak-Population cap provider", () => {
    const p11 = originRuleContributions(["P11"]);
    expect(
      reduceScalarRule(
        10_000,
        ruleAxis("STRUCTURE_BUILD_COST"),
        selectRuleContributionsForScope(
          "STRUCTURE_BUILD_COST",
          { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
          p11,
        ),
      ),
    ).toBe(0);
    expect(
      reduceScalarRule(
        10_000,
        ruleAxis("STRUCTURE_UPGRADE_COST"),
        selectRuleContributionsForScope(
          "STRUCTURE_UPGRADE_COST",
          { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
          p11,
        ),
      ),
    ).toBe(0);

    const provider = originDynamicRuleProviders(["P11"])[0];
    expect(provider).toEqual(
      expect.objectContaining({
        axis: "STRUCTURE_OWNERSHIP_CAP",
        stage: "ORIGIN_CAP",
        operator: "CAP_LIMIT",
        dependency: "PEAK_TOTAL_POPULATION",
        operandKind: "INTEGER",
      }),
    );
    expect(evaluateDynamicRuleProvider(provider!, 74_999)).toEqual({
      kind: "INTEGER",
      value: "2",
    });
    expect(evaluateDynamicRuleProvider(provider!, 75_000)).toEqual({
      kind: "INTEGER",
      value: "3",
    });
  });

  it("represents P17 and P19 as exact symbolic dynamic providers", () => {
    const p17 = originDynamicRuleProviders(["P17"])[0];
    expect(p17).toEqual(
      expect.objectContaining({
        axis: "STRUCTURE_UPGRADE_COST",
        stage: "ORIGIN_SCALAR",
        dependency: "OWNED_PERSISTENT_STRUCTURE_COUNT",
        operandKind: "RATIONAL",
      }),
    );
    expect(evaluateDynamicRuleProvider(p17!, 3)).toEqual({
      kind: "RATIONAL",
      numerator: "970299",
      denominator: "1000000",
    });

    const p19 = originDynamicRuleProviders(["P19"])[0];
    expect(p19).toEqual(
      expect.objectContaining({
        axis: "GLOBAL_OFFENSIVE_PRESSURE",
        stage: "CONTEXTUAL_PERCENT",
        dependency: "TERRITORIAL_CONTACT_COUNT",
        operandKind: "BASIS_POINTS",
      }),
    );
    expect(evaluateDynamicRuleProvider(p19!, 3)).toEqual({
      kind: "BASIS_POINTS",
      value: 1500,
    });
  });

  it("projects P27 onto a structure attack-capability surface", () => {
    const p27 = originRuleContributions(["P27"]);
    expect(
      reduceCapabilitySetRule(
        [],
        ruleAxis("STRUCTURE_ATTACK_CAPABILITIES"),
        p27,
      ),
    ).toEqual(["ATTACK_SHIPS"]);
  });

  it("places P31 Warship-only Port repair specialization after Echo", () => {
    const p31 = ORIGIN_RULE_MANIFEST_BY_ID.get("P31");
    expect(p31?.classification).toBe("MIXED");
    expect(p31?.customDomains).toEqual([
      "WARSHIP_OPERATIONAL_DURING_PORT_REPAIR",
    ]);
    expect(p31?.contributions).toEqual([
      expect.objectContaining({
        axis: "STRUCTURE_REPAIR_RADIUS",
        stage: "CONTEXTUAL_SCALAR",
        conditions: [{ kind: "TARGET_UNIT_IS", unit: "WARSHIP" }],
      }),
      expect.objectContaining({
        axis: "STRUCTURE_REPAIR_RATE",
        stage: "CONTEXTUAL_SCALAR",
        conditions: [{ kind: "TARGET_UNIT_IS", unit: "WARSHIP" }],
      }),
    ]);
  });

  it("projects P34 captured-Factory numeric effects with AND conditions", () => {
    const p34 = ORIGIN_RULE_MANIFEST_BY_ID.get("P34");
    expect(p34?.classification).toBe("MIXED");
    expect(p34?.customDomains).toEqual(["FACTORY_TRAIN_DISPATCH_SNAPSHOT"]);
    expect(p34?.contributions).toHaveLength(7);

    const tankRepair = p34?.contributions.find(
      (entry) =>
        entry.axis === "STRUCTURE_REPAIR_RATE" &&
        entry.conditions?.some(
          (condition) =>
            condition.kind === "TARGET_UNIT_IS" && condition.unit === "TANK",
        ),
    );
    expect(tankRepair).toEqual(
      expect.objectContaining({
        scope: { kind: "STRUCTURE", structure: "FACTORY" },
        stage: "CONTEXTUAL_SCALAR",
        value: 15_000,
      }),
    );
    expect(tankRepair?.conditions).toEqual(
      expect.arrayContaining([
        {
          kind: "STRUCTURE_ACQUISITION_PATH_IS",
          path: "CAPTURE_TRANSFER",
        },
        { kind: "TARGET_UNIT_IS", unit: "TANK" },
      ]),
    );
  });

  it("compiles P09 + N10 through the shared Fort coverage axis", () => {
    const contributions = originRuleContributions(["P09", "N10"]);
    const applicable = selectRuleContributionsForScope(
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

  it("represents P03 and P16 as selective component suppression", () => {
    expect(
      reduceComponentSetRule(
        [],
        ruleAxis("LAND_PRESSURE_SUPPRESSED_COMPONENTS"),
        originRuleContributions(["P03"]),
      ),
    ).toEqual([RULE_COMPONENT.HOSTILE_FORT_DEFENSIVE_PRESSURE]);
    expect(
      reduceComponentSetRule(
        [],
        ruleAxis("ACQUISITION_SUPPRESSED_COMPONENTS"),
        originRuleContributions(["P16"]),
      ),
    ).toEqual([RULE_COMPONENT.FALLOUT_ACQUISITION_RESISTANCE]);
  });

  it("keeps N05 Fallout prohibition independent from P16 suppression", () => {
    const contributions = originRuleContributions(["P16", "N05"]);
    expect(
      reducePermissionRule(
        true,
        ruleAxis("FALLOUT_ACQUISITION_PERMISSION"),
        selectRuleContributionsForScope(
          "FALLOUT_ACQUISITION_PERMISSION",
          { kind: "GLOBAL" },
          contributions,
        ),
      ),
    ).toBe(false);
  });
});
