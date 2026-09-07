import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
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
import {
  STRUCTURE_RADIAL_FIELD_VERSION,
  serializeStructureRadialFieldProfile,
  structureRadialFieldContainsOffset,
  structureRadialFieldFromAreaFactor,
  structureRadialFieldFromRangeFactor,
} from "../src/core/rules/StructureFieldGeometry";
import {
  fortDefensivePressureQualifiesDefender,
  samLauncherInterceptionQualifiesProjectile,
} from "../src/core/rules/StructureFieldQualification";

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

  it("applies a content-legal +4% Fort coverage Echo after the Origin area stage", () => {
    const origin = originRuleProfileInput(["P09", "N10"]);
    const compiled = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [
        ...origin.contributions,
        echoRuleContribution(
          "fort.coverage_area",
          "BENEFICIAL",
          400,
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
    expect(areaFactor).toEqual({ numerator: 221n, denominator: 250n });

    const profile = structureRadialFieldFromAreaFactor(
      30,
      areaFactor.numerator,
      areaFactor.denominator,
    );
    expect(serializeStructureRadialFieldProfile(profile)).toEqual({
      version: STRUCTURE_RADIAL_FIELD_VERSION,
      empty: false,
      squaredRadiusNumerator: "3978",
      squaredRadiusDenominator: "5",
    });
    expect(structureRadialFieldContainsOffset(profile, 27, 8)).toBe(true);
    expect(structureRadialFieldContainsOffset(profile, 28, 4)).toBe(false);
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

  it("projects compiled P40 range distinctly from area scaling at every SAM Launcher level", () => {
    const compiled = profileWith(["P40"]);
    const rangeFactor = materializeCompiledScalarScaleFactor(
      compiled,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_INTERCEPTION_RANGE",
      { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
      baseState,
    );
    expect(rangeFactor).toEqual({ numerator: 3n, denominator: 2n });

    const serialized = [70, 80, 90, 100, 105].map((radius) =>
      serializeStructureRadialFieldProfile(
        structureRadialFieldFromRangeFactor(
          radius,
          rangeFactor.numerator,
          rangeFactor.denominator,
        ),
      ),
    );
    expect(
      serialized.map((entry) => [
        entry.squaredRadiusNumerator,
        entry.squaredRadiusDenominator,
      ]),
    ).toEqual([
      ["11025", "1"],
      ["14400", "1"],
      ["18225", "1"],
      ["22500", "1"],
      ["99225", "4"],
    ]);

    const level1 = structureRadialFieldFromRangeFactor(
      70,
      rangeFactor.numerator,
      rangeFactor.denominator,
    );
    expect(structureRadialFieldContainsOffset(level1, 105, 0)).toBe(true);
    expect(structureRadialFieldContainsOffset(level1, 105, 1)).toBe(false);
  });

  it("applies a content-legal +3% SAM Launcher range Echo after P40 without rounding", () => {
    const origin = originRuleProfileInput(["P40"]);
    const compiled = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [
        ...origin.contributions,
        echoRuleContribution(
          "sam.interception_range",
          "BENEFICIAL",
          300,
          "echo:test-sam-interception-range",
        ),
      ],
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
    const rangeFactor = materializeCompiledScalarScaleFactor(
      compiled,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_INTERCEPTION_RANGE",
      { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
      baseState,
    );
    expect(rangeFactor).toEqual({ numerator: 309n, denominator: 200n });

    const profile = structureRadialFieldFromRangeFactor(
      70,
      rangeFactor.numerator,
      rangeFactor.denominator,
    );
    expect(serializeStructureRadialFieldProfile(profile)).toEqual({
      version: STRUCTURE_RADIAL_FIELD_VERSION,
      empty: false,
      squaredRadiusNumerator: "4678569",
      squaredRadiusDenominator: "400",
    });
    expect(structureRadialFieldContainsOffset(profile, 108, 5)).toBe(true);
    expect(structureRadialFieldContainsOffset(profile, 108, 6)).toBe(false);
  });

  it("treats an explicitly zero effective field as empty", () => {
    const zero = structureRadialFieldFromAreaFactor(30, 0n, 1n);
    expect(zero.empty).toBe(true);
    expect(structureRadialFieldContainsOffset(zero, 0, 0)).toBe(false);
  });

  it("rejects invalid negative and zero-denominator effective factors", () => {
    expect(() => structureRadialFieldFromAreaFactor(30, -1n, 1n)).toThrow(
      "Structure-field factor numerator cannot be negative",
    );
    expect(() => structureRadialFieldFromRangeFactor(70, 1n, 0n)).toThrow(
      "Structure-field factor denominator must be positive",
    );
  });
});

describe("structure-field qualification", () => {
  it("keeps baseline Fort defensive pressure owner-only", () => {
    expect(
      fortDefensivePressureQualifiesDefender("faction-a", "faction-a"),
    ).toBe(true);
    expect(
      fortDefensivePressureQualifiesDefender("faction-a", "faction-b"),
    ).toBe(false);
  });

  it("derives SAM Launcher interception from immutable faction/team identity", () => {
    const launcherOwner = {
      factionId: "faction-a",
      fixedTeamId: "team-a",
    } as const;
    const teammateProjectile = {
      factionId: "faction-b",
      fixedTeamId: "team-a",
    } as const;
    const enemyProjectile = {
      factionId: "faction-c",
      fixedTeamId: "team-b",
    } as const;

    expect(
      samLauncherInterceptionQualifiesProjectile(launcherOwner, launcherOwner),
    ).toBe(false);
    expect(
      samLauncherInterceptionQualifiesProjectile(
        launcherOwner,
        teammateProjectile,
      ),
    ).toBe(false);
    expect(
      samLauncherInterceptionQualifiesProjectile(
        launcherOwner,
        enemyProjectile,
      ),
    ).toBe(true);
  });

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
      {
        kind: "EVENT_INSIDE_FIELD",
        field: "SAM_LAUNCHER",
        affiliation: "SELF",
      },
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
      conditions: [{ kind: "EVENT_INSIDE_FIELD", field: "FORT" } as never],
    };
    expect(
      validateRuleContributions([legacy], RULE_AXIS_REGISTRY).map(
        (issue) => issue.code,
      ),
    ).toContain("INVALID_CONDITION");
  });

  it("rejects legacy SAM as a structure-field ID under rule-composition v3", () => {
    const legacySam: RuleContribution = {
      axis: "FFY_EVENT_YIELD",
      scope: { kind: "FFY_FAMILY", family: "ALL" },
      stage: "TERMINAL",
      operator: "HARD_ZERO",
      sourceKind: "ORIGIN",
      sourceId: "legacy-sam-field-id",
      valueUnit: "NONE",
      conditions: [
        {
          kind: "EVENT_INSIDE_FIELD",
          field: "SAM",
          affiliation: "SELF",
        } as never,
      ],
    };
    expect(
      validateRuleContributions([legacySam], RULE_AXIS_REGISTRY).map(
        (issue) => issue.code,
      ),
    ).toContain("INVALID_CONDITION");
  });

  it("binds affiliation and canonical field IDs into rule-composition version 3 serialization", () => {
    const n11 = ORIGIN_RULE_MANIFEST_BY_ID.get("N11")?.contributions ?? [];
    const serialized = JSON.parse(serializeRuleContributions(n11));
    expect(serialized.version).toBe("3");
    expect(serialized.contributions[0].conditions).toEqual([
      {
        affiliation: "SELF",
        field: "SAM_LAUNCHER",
        kind: "EVENT_INSIDE_FIELD",
      },
    ]);
  });
});
