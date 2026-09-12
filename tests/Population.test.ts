import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { materializeCompiledCapRule } from "../src/core/rules/RuleMaterialization";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createPopulationState,
  grantPopulation,
  populationRuleDynamicState,
  removePopulation,
  repartitionPopulation,
  transferPopulation,
} from "../src/simulation/Population";
import {
  resolveTankPopulationShot,
  resolveTankPopulationShotBatch,
} from "../src/simulation/Tanks";

const validState = {
  total: 10,
  available: 4,
  committedOffensive: 2,
  committedCounterResponse: 3,
  aboardTransports: 1,
  peakTotal: 12,
  neutralSettlementHalfResidual: 1 as const,
};

function tankPopulationShotFixture(options: {
  readonly traits?: readonly OriginTraitId[];
  readonly damageEchoBasisPoints?: number;
  readonly targetPopulation?: Parameters<typeof createPopulationState>[0];
} = {}) {
  const additional: RuleContribution[] = [];
  if (options.damageEchoBasisPoints !== undefined) {
    additional.push({
      axis: "UNIT_DAMAGE",
      scope: { kind: "UNIT", unit: "TANK" },
      stage: "ECHO_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ECHO",
      sourceId: "echo:test-tank-damage",
      valueUnit: "BASIS_POINTS",
      value: options.damageEchoBasisPoints,
    });
  }
  const origin = originRuleProfileInput(options.traits ?? []);
  const alphaRules = compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
  const state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-population-shot-red",
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta", "beta"],
      factions: [
        { id: "alpha", rules: alphaRules },
        {
          id: "beta",
          rules: compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] }),
        },
      ],
    }),
  );
  const targetPopulation = createPopulationState(
    options.targetPopulation ?? {
      total: 2_000,
      available: 2_000,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 2_000,
      neutralSettlementHalfResidual: 0,
    },
  );
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === "beta"
        ? { ...faction, population: targetPopulation }
        : faction,
    ),
  });
}

describe("authoritative Population accounting", () => {
  it("accepts only canonical whole-integer partition states", () => {
    expect(createPopulationState(validState)).toEqual(validState);

    expect(() => createPopulationState({ ...validState, total: 11 })).toThrow(
      /partition/i,
    );
    expect(() => createPopulationState({ ...validState, available: -1 })).toThrow(
      /non-negative safe integer/i,
    );
    expect(() => createPopulationState({ ...validState, available: 1.5 })).toThrow(
      /non-negative safe integer/i,
    );
    expect(() => createPopulationState({ ...validState, peakTotal: 9 })).toThrow(
      /peak/i,
    );
    expect(() =>
      createPopulationState({
        ...validState,
        neutralSettlementHalfResidual: 2 as 0 | 1,
      }),
    ).toThrow(/neutral settlement half residual/i);
  });

  it("repartitions Population without changing Total or Peak", () => {
    const moved = repartitionPopulation(
      createPopulationState(validState),
      "AVAILABLE",
      "OFFENSIVE",
      3,
    );

    expect(moved).toEqual({
      ...validState,
      available: 1,
      committedOffensive: 5,
    });
    expect(() =>
      repartitionPopulation(moved, "AVAILABLE", "TRANSPORT", 2),
    ).toThrow(/insufficient available Population/i);
  });

  it("removes a one-shot amount from both its named bucket and Total while preserving Peak", () => {
    const result = removePopulation(
      createPopulationState(validState),
      "COUNTER_RESPONSE",
      2,
    );

    expect(result).toEqual({
      ...validState,
      total: 8,
      committedCounterResponse: 1,
    });
    expect(result.peakTotal).toBe(12);
    expect(() => removePopulation(result, "COUNTER_RESPONSE", 2)).toThrow(
      /insufficient counter-response Population/i,
    );
  });

  it("credits direct grants to Available Population and raises Peak without a Capacity clamp", () => {
    const result = grantPopulation(createPopulationState(validState), 7);

    expect(result).toEqual({
      ...validState,
      total: 17,
      available: 11,
      peakTotal: 17,
    });

    const maxed = createPopulationState({
      total: Number.MAX_SAFE_INTEGER,
      available: Number.MAX_SAFE_INTEGER,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: Number.MAX_SAFE_INTEGER,
      neutralSettlementHalfResidual: 0,
    });
    expect(() => grantPopulation(maxed, 1)).toThrow(/safe-integer range/i);
  });

  it("applies a conserved transfer as one frozen source debit plus one Available receipt", () => {
    const source = createPopulationState({
      total: 8,
      available: 2,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 6,
      peakTotal: 10,
      neutralSettlementHalfResidual: 0,
    });
    const recipient = createPopulationState({
      total: 5,
      available: 5,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 5,
      neutralSettlementHalfResidual: 1,
    });

    const result = transferPopulation(source, recipient, "TRANSPORT", 4);

    expect(result.source).toEqual({
      ...source,
      total: 4,
      aboardTransports: 2,
    });
    expect(result.recipient).toEqual({
      ...recipient,
      total: 9,
      available: 9,
      peakTotal: 9,
    });
    expect(result.source.total + result.recipient.total).toBe(
      source.total + recipient.total,
    );
  });

  it("projects Peak Total Population into the existing dynamic effective-rule surface", () => {
    const origin = originRuleProfileInput(["P11"]);
    const profile = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: origin.contributions,
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
    const population = grantPopulation(
      createPopulationState({
        total: 20_000,
        available: 20_000,
        committedOffensive: 0,
        committedCounterResponse: 0,
        aboardTransports: 0,
        peakTotal: 20_000,
        neutralSettlementHalfResidual: 0,
      }),
      35_000,
    );

    expect(
      materializeCompiledCapRule(
        Number.MAX_SAFE_INTEGER,
        profile,
        RULE_AXIS_REGISTRY,
        "STRUCTURE_OWNERSHIP_CAP",
        { kind: "STRUCTURE", structure: "SAM_LAUNCHER" },
        {
          ownedPersistentStructureCount: 0,
          territorialContactCount: 0,
          ...populationRuleDynamicState(population),
        },
      ),
    ).toBe(2);

    const afterLoss = removePopulation(population, "AVAILABLE", 40_000);
    expect(populationRuleDynamicState(afterLoss).peakTotalPopulation).toBe(55_000);
  });

  it("resolves baseline Tank and P43 Population damage for one admitted shot", () => {
    const baseline = resolveTankPopulationShot(tankPopulationShotFixture(), {
      attackerOwnerId: "alpha",
      chassisType: "TANK",
      targetFactionId: "beta",
    });
    expect(baseline.finalDamage).toBe(250);
    expect(baseline.casualties).toBe(250);

    const artillery = resolveTankPopulationShot(
      tankPopulationShotFixture({ traits: ["P43"] }),
      {
        attackerOwnerId: "alpha",
        chassisType: "HEAVY_ARTILLERY",
        targetFactionId: "beta",
      },
    );
    expect(artillery.finalDamage).toBe(1_000);
    expect(artillery.casualties).toBe(1_000);
  });

  it("applies Tank damage modifiers after the chassis baseline and floors once per shot", () => {
    const result = resolveTankPopulationShot(
      tankPopulationShotFixture({
        traits: ["P43"],
        damageEchoBasisPoints: 333,
      }),
      {
        attackerOwnerId: "alpha",
        chassisType: "HEAVY_ARTILLERY",
        targetFactionId: "beta",
      },
    );

    expect(result.finalDamage).toBe(1_033);
    expect(result.casualties).toBe(1_033);
  });

  it("clamps one shot to Available Population and preserves every committed bucket", () => {
    const targetPopulation = {
      total: 190,
      available: 100,
      committedOffensive: 20,
      committedCounterResponse: 30,
      aboardTransports: 40,
      peakTotal: 250,
      neutralSettlementHalfResidual: 1 as const,
    };
    const result = resolveTankPopulationShot(
      tankPopulationShotFixture({ targetPopulation }),
      {
        attackerOwnerId: "alpha",
        chassisType: "TANK",
        targetFactionId: "beta",
      },
    );

    expect(result.finalDamage).toBe(250);
    expect(result.casualties).toBe(100);
    expect(result.targetPopulation).toEqual({
      ...targetPopulation,
      total: 90,
      available: 0,
    });

    const committedOnly = {
      total: 90,
      available: 0,
      committedOffensive: 20,
      committedCounterResponse: 30,
      aboardTransports: 40,
      peakTotal: 250,
      neutralSettlementHalfResidual: 1 as const,
    };
    const noAvailable = resolveTankPopulationShot(
      tankPopulationShotFixture({ targetPopulation: committedOnly }),
      {
        attackerOwnerId: "alpha",
        chassisType: "TANK",
        targetFactionId: "beta",
      },
    );
    expect(noAvailable.casualties).toBe(0);
    expect(noAvailable.targetPopulation).toEqual(committedOnly);
  });

  it("aggregates simultaneous Tank Population overkill once per target faction without assigning casualties to attackers", () => {
    const targetPopulation = {
      total: 390,
      available: 300,
      committedOffensive: 20,
      committedCounterResponse: 30,
      aboardTransports: 40,
      peakTotal: 500,
      neutralSettlementHalfResidual: 1 as const,
    };
    const state = tankPopulationShotFixture({ targetPopulation });
    const result = resolveTankPopulationShotBatch(state, [
      {
        attackerUnitId: "tank-b",
        attackerOwnerId: "alpha",
        chassisType: "TANK",
        targetFactionId: "beta",
        targetCellId: 2,
      },
      {
        attackerUnitId: "tank-a",
        attackerOwnerId: "alpha",
        chassisType: "TANK",
        targetFactionId: "beta",
        targetCellId: 1,
      },
    ]);

    expect(result.targets).toEqual([
      {
        targetFactionId: "beta",
        totalDamage: 500,
        casualties: 300,
        targetPopulation: {
          ...targetPopulation,
          total: 90,
          available: 0,
        },
      },
    ]);
    expect(result.successfulShots).toEqual([
      {
        attackerUnitId: "tank-a",
        targetFactionId: "beta",
        targetCellId: 1,
        finalDamage: 250,
      },
      {
        attackerUnitId: "tank-b",
        targetFactionId: "beta",
        targetCellId: 2,
        finalDamage: 250,
      },
    ]);
    expect(
      result.successfulShots.some((shot) => "casualties" in shot),
    ).toBe(false);
  });

  it("keeps simultaneous Population-shot aggregation invariant to admitted-shot enumeration order", () => {
    const state = tankPopulationShotFixture({
      targetPopulation: {
        total: 300,
        available: 300,
        committedOffensive: 0,
        committedCounterResponse: 0,
        aboardTransports: 0,
        peakTotal: 300,
        neutralSettlementHalfResidual: 0,
      },
    });
    const shots = [
      {
        attackerUnitId: "tank-z",
        attackerOwnerId: "alpha",
        chassisType: "TANK" as const,
        targetFactionId: "beta",
        targetCellId: 2,
      },
      {
        attackerUnitId: "tank-a",
        attackerOwnerId: "alpha",
        chassisType: "TANK" as const,
        targetFactionId: "beta",
        targetCellId: 1,
      },
    ];

    const forward = resolveTankPopulationShotBatch(state, shots);
    const reversed = resolveTankPopulationShotBatch(state, [...shots].reverse());

    expect(reversed).toEqual(forward);
    expect(forward.targets[0]?.casualties).toBe(300);
    expect(forward.successfulShots.map((shot) => shot.attackerUnitId)).toEqual([
      "tank-a",
      "tank-z",
    ]);
  });
});
