import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  STRUCTURE_RADIAL_FIELD_VERSION,
  serializeStructureRadialFieldProfile,
  structureRadialFieldContainsOffset,
  structureRadialFieldFromAreaFactor,
  structureRadialFieldFromRangeFactor,
} from "../src/core/rules/StructureFieldGeometry";
import {
  ORIGIN_RULE_MANIFEST_BY_ID,
  originRuleProfileInput,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  serializeRuleContributions,
  validateRuleContributions,
  type RuleContribution,
} from "../src/core/rules/RuleComposition";
import {
  materializeCompiledScalarScaleFactor,
  type RuleDynamicState,
} from "../src/core/rules/RuleMaterialization";

const baseState: RuleDynamicState = {
  ownedPersistentStructureCount: 0,
  territorialContactCount: 0,
  peakTotalPopulation: 0,
};

function profileWith(traitIds: readonly ("P09" | "P40" | "N10")[]) {
  return compileRuleProfile(
    RULE_AXIS_REGISTRY,
    originRuleProfileInput(traitIds),
  );
}

describe("STRUCTURE_RADIAL_FIELD_V1", () => {
  it("projects compiled P09 + N10 Fort area exactly without a radius rounding step", () => {
    const compiled = profileWith(["P09", "N10"]);
    const areaFactor = materializeCompiledScalarScaleFactor(
      compiled,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_FIELD_COVERAGE_AREA",
      { kind: "STRUCTURE", structure: "FORT" },
      baseState,
    );
    expect(areaFactor).toEqual({ numerator: 17n, denominator: 20n });

    const profile = structureRadialFieldFromAreaFactor(
      30,
      areaFactor.numerator,
      areaFactor.denominator,
    );
    expect(serializeStructureRadialFieldProfile(profile)).toEqual({
      version: STRUCTURE_RADIAL_FIELD_VERSION,
      empty: false,
      squaredRadiusNumerator: "765",
      squaredRadiusDenominator: "1",
    });
    expect(structureRadialFieldContainsOffset(profile, 27, 6)).toBe(true);
    expect(structureRadialFieldContainsOffset(profile, 27, 7)).toBe(false);
  });

  it("applies Fort coverage Echo specialization after the Origin area stage", () => {
    const origin = originRuleProfileInput(["P09", "N10"]);
    const compiled = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [
        ...origin.contributions,
        echoRuleContribution(
          "fort.coverage_area",
          "BENEFICIAL",
          1000,
          "echo:test-fort-coverage",
        ),
      ],
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
    const areaFactor = materializeCompiledScalarScaleFactor(
      compiled,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_FIELD_COVERAGE_AREA",
      { kind: "STRUCTURE", structure: "FORT" },
      baseState,
    );
    expect(areaFactor).toEqual({ numerator: 187n, denominator: 200n });

    const profile = structureRadialFieldFromAreaFactor(
      30,
      areaFactor.numerator,
      areaFactor.denominator,
    );
    expect(serializeStructureRadialFieldProfile(profile)).toEqual({
      version: STRUCTURE_RADIAL_FIELD_VERSION,
      empty: false,
      squaredRadiusNumerator: "1683",
      squaredRadiusDenominator: "2",
    });
    expect(structureRadialFieldContainsOffset(profile, 29, 0)).toBe(true);
    expect(structureRadialFieldContainsOffset(profile, 29, 1)).toBe(false);
  });

  it("projects the same P09 + N10 area factor exactly at every Fort level", () => {
    const serialized = [30, 35, 40, 45, 50].map((radius) =>
      serializeStructureRadialFieldProfile(
        structureRadialFieldFromAreaFactor(radius, 17n, 20n),
      ),
    );
    expect(
      serialized.map((entry) => [
        entry.squaredRadiusNumerator,
        entry.squaredRadiusDenominator,
      ]),
    ).toEqual([
      ["765", "1"],
      ["4165", "4"],
      ["1360", "1"],
      ["6885", "4"],
      ["2125", "1"],
    ]);
  });

  it("projects compiled P40 range distinctly from area scaling", () => {
    const compiled = profileWith(["P40"]);
    const rangeFactor = materializeCompiledScalarScaleFactor(
      compiled,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_INTERCEPTION_RANGE",
      { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
      baseState,
    );
    expect(rangeFactor).toEqual({ numerator: 3n, denominator: 2n });

    const p40Sam = structureRadialFieldFromRangeFactor(
      70,
      rangeFactor.numerator,
      rangeFactor.denominator,
    );
    expect(serializeStructureRadialFieldProfile(p40Sam)).toEqual({
      version: STRUCTURE_RADIAL_FIELD_VERSION,
      empty: false,
      squaredRadiusNumerator: "11025",
      squaredRadiusDenominator: "1",
    });
    expect(structureRadialFieldContainsOffset(p40Sam, 105, 0)).toBe(true);
    expect(structureRadialFieldContainsOffset(p40Sam, 105, 1)).toBe(false);
  });

  it("treats an explicitly zero effective field as empty", () => {
    const zero = structureRadialFieldFromAreaFactor(30, 0n, 1n);
    expect(zero.empty).toBe(true);
    expect(structureRadialFieldContainsOffset(zero, 0, 0)).toBe(false);
  });
});

describe("structure-field qualification conditions", () => {
  it("encodes the canonical P18/P24/N11 affiliations explicitly", () => {
    expect(
      ORIGIN_RULE_MANIFEST_BY_ID.get("P18")?.contributions[0]?.conditions,
    ).toEqual([
      {
        kind: "SOURCE_INSIDE_FIELD",
        field: "FORT",
        affiliation: "SELF_OR_FIXED_TEAMMATE",
      },
    ]);
    expect(
      ORIGIN_RULE_MANIFEST_BY_ID.get("P24")?.contributions[0]?.conditions,
    ).toEqual([
      { kind: "EVENT_INSIDE_FIELD", field: "FORT", affiliation: "SELF" },
    ]);
    expect(
      ORIGIN_RULE_MANIFEST_BY_ID.get("N11")?.contributions[0]?.conditions,
    ).toEqual([
      { kind: "EVENT_INSIDE_FIELD", field: "SAM", affiliation: "SELF" },
    ]);
  });

  it("rejects a legacy field condition that omits affiliation", () => {
    const legacy: RuleContribution = {
      axis: "FFY_EVENT_YIELD",
      scope: { kind: "FFY_FAMILY", family: "ALL" },
      stage: "ORIGIN_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ORIGIN",
      sourceId: "legacy-field-condition",
      valueUnit: "BASIS_POINTS",
      value: 100,
      conditions: [
        { kind: "EVENT_INSIDE_FIELD", field: "FORT" } as never,
      ],
    };
    expect(
      validateRuleContributions([legacy], RULE_AXIS_REGISTRY).map(
        (issue) => issue.code,
      ),
    ).toContain("INVALID_CONDITION");
  });

  it("binds affiliation into rule-composition version 2 serialization", () => {
    const p24 = ORIGIN_RULE_MANIFEST_BY_ID.get("P24")?.contributions ?? [];
    const serialized = JSON.parse(serializeRuleContributions(p24));
    expect(serialized.version).toBe("2");
    expect(serialized.contributions[0].conditions).toEqual([
      { affiliation: "SELF", field: "FORT", kind: "EVENT_INSIDE_FIELD" },
    ]);
  });
});
