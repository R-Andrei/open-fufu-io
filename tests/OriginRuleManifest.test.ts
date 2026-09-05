import {
  EXPECTED_ORIGIN_TRAIT_IDS,
  ORIGIN_RULE_MANIFEST,
  ORIGIN_RULE_MANIFEST_BY_ID,
  RULE_COMPONENT,
  evaluateDynamicRuleProvider,
  originDynamicRuleProviders,
  originRuleContributions,
} from "../src/core/rules/OriginRuleManifest";
import {
  reduceCapabilitySetRule,
  reduceComponentSetRule,
  reducePermissionRule,
  reduceScalarRule,
  selectRuleContributionsForScope,
  validateRuleContributions,
  type RuleContribution,
} from "../src/core/rules/RuleComposition";
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

  it("keeps dynamic providers on registered axes/stages with valid materialized operand shapes", () => {
    for (const entry of ORIGIN_RULE_MANIFEST) {
      for (const provider of entry.dynamicProviders) {
        const definition = RULE_AXIS_REGISTRY[provider.axis];
        expect(definition).toBeDefined();
        expect(definition?.scopeKind).toBe(provider.scope.kind);
        expect(
          definition?.stages.some(
            (stage) =>
              stage.id === provider.stage &&
              stage.allowedOperators.includes(provider.operator),
          ),
        ).toBe(true);

        const resolved = evaluateDynamicRuleProvider(provider, 1);
        const value =
          resolved.kind === "BASIS_POINTS" ? resolved.value : 10_000;
        const contribution: RuleContribution = {
          axis: provider.axis,
          scope: provider.scope,
          stage: provider.stage,
          operator: provider.operator,
          sourceKind: provider.sourceKind,
          sourceId: provider.sourceId,
          valueUnit: provider.valueUnit,
          value,
        };
        expect(
          validateRuleContributions([contribution], RULE_AXIS_REGISTRY),
        ).toEqual([]);
      }
    }
  });

  it("projects P01 and P02 onto spawn-quota and growth-profile axes", () => {
    const p01 = originRuleContributions(["P01"]);
    expect(
      reduceScalarRule(1000, ruleAxis("INITIAL_TERRITORY_QUOTA"), p01),
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

  it("represents P17 and P19 as closed typed dynamic providers", () => {
    const p17 = originDynamicRuleProviders(["P17"]);
    expect(p17).toHaveLength(1);
    expect(p17[0]).toEqual(
      expect.objectContaining({
        axis: "STRUCTURE_UPGRADE_COST",
        stage: "ORIGIN_SCALAR",
        dependency: "OWNED_PERSISTENT_STRUCTURE_COUNT",
      }),
    );
    expect(evaluateDynamicRuleProvider(p17[0]!, 3)).toEqual({
      kind: "RATIONAL",
      numerator: "970299",
      denominator: "1000000",
    });

    const p19 = originDynamicRuleProviders(["P19"]);
    expect(p19).toHaveLength(1);
    expect(p19[0]).toEqual(
      expect.objectContaining({
        axis: "GLOBAL_OFFENSIVE_PRESSURE",
        stage: "CONTEXTUAL_PERCENT",
        dependency: "TERRITORIAL_CONTACT_COUNT",
      }),
    );
    expect(evaluateDynamicRuleProvider(p19[0]!, 3)).toEqual({
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

  it("marks P31 MIXED because operational-during-repair remains non-scalar", () => {
    const p31 = ORIGIN_RULE_MANIFEST_BY_ID.get("P31");
    expect(p31?.classification).toBe("MIXED");
    expect(p31?.customDomains).toContain(
      "WARSHIP_OPERATIONAL_DURING_PORT_REPAIR",
    );
    expect(p31?.contributions).toHaveLength(2);
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

  it("compiles P23 + P42 through the shared Warship attack-range axis", () => {
    const contributions = originRuleContributions(["P23", "P42"]);
    const applicable = selectRuleContributionsForScope(
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
    const permission = selectRuleContributionsForScope(
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
});
