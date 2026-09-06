import {
  evaluateDynamicRuleProvider,
  rationalToFiniteNumber,
  type RuleContribution,
} from "../src/core/rules/RuleComposition";
import {
  originDynamicRuleProviders,
  originRuleProfileInput,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  materializeCompiledCapRule,
  materializeCompiledScalarRule,
  type RuleDynamicState,
} from "../src/core/rules/RuleMaterialization";

const baseState: RuleDynamicState = {
  ownedPersistentStructureCount: 0,
  territorialContactCount: 0,
  peakTotalPopulation: 0,
};

function profileWith(
  traitIds: Parameters<typeof originRuleProfileInput>[0],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

describe("compiled static + dynamic materialization", () => {
  it("composes P11's dynamic SAM entitlement with N07 through MIN", () => {
    const profile = profileWith(["P11", "N07"]);
    expect(
      materializeCompiledCapRule(
        Number.MAX_SAFE_INTEGER,
        profile,
        RULE_AXIS_REGISTRY,
        "STRUCTURE_OWNERSHIP_CAP",
        { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
        { ...baseState, peakTotalPopulation: 75_000 },
      ),
    ).toBe(1);
  });

  it("applies exact P17 before a later Structure Upgrade Echo", () => {
    const echo: RuleContribution = {
      axis: "STRUCTURE_UPGRADE_COST",
      scope: { kind: "STRUCTURE", structure: "ALL" },
      stage: "ECHO_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ECHO",
      sourceId: "echo:test-upgrade-cost",
      valueUnit: "BASIS_POINTS",
      value: -500,
    };
    const profile = profileWith(["P17"], [echo]);
    expect(
      materializeCompiledScalarRule(
        100_000,
        profile,
        RULE_AXIS_REGISTRY,
        "STRUCTURE_UPGRADE_COST",
        { kind: "STRUCTURE", structure: "CITY" },
        { ...baseState, ownedPersistentStructureCount: 3 },
      ),
    ).toBeCloseTo(92_178.405);
  });

  it("adds P19 and another same-stage contextual percentage once", () => {
    const situational: RuleContribution = {
      axis: "GLOBAL_OFFENSIVE_PRESSURE",
      scope: { kind: "GLOBAL" },
      stage: "CONTEXTUAL_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "SITUATIONAL",
      sourceId: "situation:test-offense",
      valueUnit: "BASIS_POINTS",
      value: 500,
    };
    const profile = profileWith(["P19"], [situational]);
    expect(
      materializeCompiledScalarRule(
        1,
        profile,
        RULE_AXIS_REGISTRY,
        "GLOBAL_OFFENSIVE_PRESSURE",
        { kind: "GLOBAL" },
        { ...baseState, territorialContactCount: 3 },
      ),
    ).toBeCloseTo(1.2);
  });

  it("materializes large exact P17 rationals without numerator/denominator overflow", () => {
    const profile = profileWith(["P17"]);
    const result = materializeCompiledScalarRule(
      100_000,
      profile,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_UPGRADE_COST",
      { kind: "STRUCTURE", structure: "CITY" },
      { ...baseState, ownedPersistentStructureCount: 1000 },
    );
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeCloseTo(100_000 * Math.pow(0.99, 1000), 8);
  });

  it("converts an evaluated large exact rational directly to a finite number", () => {
    const provider = originDynamicRuleProviders(["P17"])[0];
    expect(provider).toBeDefined();
    const resolved = evaluateDynamicRuleProvider(provider!, 1000);
    expect(resolved.kind).toBe("RATIONAL");
    if (resolved.kind !== "RATIONAL") throw new Error("Expected rational P17");
    const ratio = rationalToFiniteNumber(
      BigInt(resolved.numerator),
      BigInt(resolved.denominator),
    );
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeCloseTo(Math.pow(0.99, 1000), 12);
  });
});
