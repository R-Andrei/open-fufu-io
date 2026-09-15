import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { settleFactoryTrainEconomicEvents } from "../src/simulation/FactoryTrainRuntime";
import { calculateFactionScore } from "../src/simulation/FactionScore";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createUnitDestroyedEvent } from "../src/simulation/SimulationEvents";
import { tryPurchaseStructureUpgrade } from "../src/simulation/StructuresCore";
import {
  advanceTankProductionPhase,
  tryStartTankProduction,
} from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";
import { createTrainDispatchEconomicSnapshot } from "../src/simulation/TrainService";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function rulesWithTraits(traits: readonly OriginTraitId[]) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function scoreState(initialOwners: readonly (string | null)[]) {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "faction-score-red",
      width: initialOwners.length,
      height: 1,
      terrain: initialOwners.map(() => "PLAINS"),
      initialOwners,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function tankProductionScoreState(
  ffy: number,
  traits: readonly OriginTraitId[] = [],
) {
  const initial = createInitialMatchState(
    createMicroSimulationSpec({
      seed: `faction-score-tank-job-${traits.join("-") || "baseline"}`,
      width: 20,
      height: 1,
      terrain: Array.from({ length: 20 }, () => "PLAINS" as const),
      initialOwners: [
        ...Array.from({ length: 10 }, () => "alpha"),
        ...Array.from({ length: 10 }, () => "beta"),
      ],
      initialStructureGrants: [
        {
          structureId: "alpha-factory",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules: rulesWithTraits(traits) },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  return createProspectiveMatchState(initial, {
    factions: initial.factions.map((faction) =>
      faction.id === "alpha" ? { ...faction, ffy } : faction,
    ),
  });
}

function serializedFaction(state: ReturnType<typeof scoreState>, factionId: string) {
  const parsed = JSON.parse(canonicalMatchStateSerialization(state)) as {
    readonly factions: readonly Record<string, unknown>[];
  };
  return parsed.factions.find((faction) => faction.id === factionId);
}

describe("authoritative faction strength score", () => {
  it("scores an all-domain reference-baseline faction at exactly 1000", () => {
    const state = scoreState(["alpha", "beta"]);

    expect(calculateFactionScore(state, "alpha")).toBe(1000);
  });

  it("applies square-root diminishing returns to territory before composition", () => {
    const state = scoreState(["alpha", "alpha", "alpha", "beta"]);

    // T = 3 * 2 / 4 = 1.5, while E = P = 1 at tick 0.
    // floor(300 * sqrt(1.5) + 250 + 450) = 1067.
    expect(calculateFactionScore(state, "alpha")).toBe(1067);
  });

  it("persists finalized ordinary positive FFY earnings and keeps a baseline earner at score 1000", () => {
    const initial = scoreState(["alpha", "beta"]);
    const initialAlpha = initial.factions.find((faction) => faction.id === "alpha")!;

    expect(initialAlpha).toHaveProperty("lifetimeGrossPositiveFfyEarned", 0);
    expect(serializedFaction(initial, "alpha")).toHaveProperty(
      "lifetimeGrossPositiveFfyEarned",
      0,
    );

    const advanced = new TickEngine().advance(initial, []);
    const advancedAlpha = advanced.factions.find(
      (faction) => faction.id === "alpha",
    )!;

    expect(advanced.tick).toBe(1);
    expect(advancedAlpha.ffy).toBe(25_100);
    expect(advancedAlpha).toHaveProperty("lifetimeGrossPositiveFfyEarned", 100);
    expect(serializedFaction(advanced, "alpha")).toHaveProperty(
      "lifetimeGrossPositiveFfyEarned",
      100,
    );
    expect(calculateFactionScore(advanced, "alpha")).toBe(1000);
  });

  it("accrues finalized non-passive ordinary FFY awards into lifetime economy", () => {
    const base = scoreState(["alpha", "beta"]);
    const servicesAtInterception = Object.freeze([
      Object.freeze({
        trainId: "train-a",
        factoryId: "factory-a",
        loopSnapshotId: "train-a",
        isPrimary: true,
        dispatchSnapshot: createTrainDispatchEconomicSnapshot(
          "factory-a",
          "alpha",
          1,
        ),
        resumeAtTick: null,
      }),
    ]);
    const destruction = createUnitDestroyedEvent({
      id: "destroy-train-score-accounting",
      tick: base.tick,
      unit: {
        unitId: "train-a",
        ownerId: "alpha",
        unitType: "TRAIN",
        cellId: 1,
      },
      causes: [
        {
          kind: "UNIT_ATTACK",
          attackEventId: "tank-attack-score-accounting",
          attacker: {
            unitId: "tank-beta",
            ownerId: "beta",
            unitType: "TANK",
            cellId: 1,
          },
        },
      ],
    });
    const betaBefore = base.factions.find((faction) => faction.id === "beta")!;

    const update = settleFactoryTrainEconomicEvents(
      base,
      servicesAtInterception,
      [destruction],
      () => false,
    );
    const betaAfter = update?.factions.find((faction) => faction.id === "beta");

    expect(update).not.toBeNull();
    expect(betaAfter?.ffy).toBe(betaBefore.ffy + 10_000);
    expect(betaAfter?.lifetimeGrossPositiveFfyEarned).toBe(
      betaBefore.lifetimeGrossPositiveFfyEarned + 10_000,
    );
  });

  it("values granted structures at cumulative ordinary baseline replacement capital", () => {
    const rules = emptyRules();
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "faction-score-structure-replacement",
        width: 20,
        height: 1,
        terrain: Array.from({ length: 20 }, () => "PLAINS" as const),
        initialOwners: [
          ...Array.from({ length: 10 }, () => "alpha"),
          ...Array.from({ length: 10 }, () => "beta"),
        ],
        initialStructureGrants: [
          {
            structureId: "alpha-city",
            ownerId: "alpha",
            type: "CITY",
            cellId: 0,
            level: 3,
          },
        ],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );

    expect(state.structures).toContainEqual(
      expect.objectContaining({
        id: "alpha-city",
        ownerId: "alpha",
        type: "CITY",
        completedLevel: 3,
      }),
    );
    // A granted L3 City paid 0 FFY, but its baseline replacement state is
    // 100k + 200k + 400k = 700k. T=E=1 and P=(25k+700k)/25k=29.
    // floor(300 + 250 + 450 * sqrt(29)) = 2973.
    expect(calculateFactionScore(state, "alpha")).toBe(2973);
  });

  it("values committed structure upgrades at cumulative target-level replacement capital", () => {
    const rules = emptyRules();
    const initial = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "faction-score-committed-structure-upgrade",
        width: 20,
        height: 1,
        terrain: Array.from({ length: 20 }, () => "PLAINS" as const),
        initialOwners: [
          ...Array.from({ length: 10 }, () => "alpha"),
          ...Array.from({ length: 10 }, () => "beta"),
        ],
        initialStructureGrants: [
          {
            structureId: "alpha-city",
            ownerId: "alpha",
            type: "CITY",
            cellId: 0,
            level: 2,
          },
        ],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const funded = Object.freeze({
      ...initial,
      factions: Object.freeze(
        initial.factions.map((faction) =>
          faction.id === "alpha"
            ? Object.freeze({ ...faction, ffy: 1_000_000 })
            : faction,
        ),
      ),
    });
    const purchase = tryPurchaseStructureUpgrade(funded, {
      structureId: "alpha-city",
      ownerId: "alpha",
    });

    expect(purchase.ok).toBe(true);
    if (!purchase.ok) return;
    const state = Object.freeze({
      ...funded,
      factions: purchase.factions,
      structures: purchase.structures,
    });
    expect(state.factions.find((faction) => faction.id === "alpha")?.ffy).toBe(
      600_000,
    );
    expect(state.structures).toContainEqual(
      expect.objectContaining({
        id: "alpha-city",
        completedLevel: 2,
        construction: expect.objectContaining({ targetLevel: 3 }),
      }),
    );

    // The accepted upgrade converts 400k liquid FFY into committed L3 capital.
    // Replacement capital therefore uses target L3: 100k + 200k + 400k = 700k.
    // T=E=1 and P=(600k+700k)/25k=52.
    // floor(300 + 250 + 450 * sqrt(52)) = 3794.
    expect(calculateFactionScore(state, "alpha")).toBe(3794);
  });

  it.each([
    {
      label: "baseline Tank",
      traits: [] as OriginTraitId[],
      fundedFfy: 500_000,
      expectedCost: 250_000,
      expectedChassis: "TANK" as const,
      expectedScore: 2844,
    },
    {
      label: "P43 Heavy Artillery",
      traits: ["P43"] as OriginTraitId[],
      fundedFfy: 750_000,
      expectedCost: 375_000,
      expectedChassis: "HEAVY_ARTILLERY" as const,
      expectedScore: 3250,
    },
  ])(
    "keeps $label replacement value through paid production and deployment",
    ({ traits, fundedFfy, expectedCost, expectedChassis, expectedScore }) => {
      const funded = tankProductionScoreState(fundedFfy, traits);
      expect(calculateFactionScore(funded, "alpha")).toBe(expectedScore);

      const purchase = tryStartTankProduction(funded, {
        ownerId: "alpha",
        factoryId: "alpha-factory",
        strategicDestinationCellId: 1,
      });

      expect(purchase.ok).toBe(true);
      if (!purchase.ok) return;
      expect(purchase.cost).toBe(expectedCost);
      expect(purchase.job).toMatchObject({
        ownerId: "alpha",
        chassisType: expectedChassis,
        state: "BUILDING",
      });
      expect(
        purchase.state.factions.find((faction) => faction.id === "alpha")?.ffy,
      ).toBe(fundedFfy - expectedCost);

      // The accepted purchase converts liquid FFY into already-paid committed
      // chassis capital, so Current Power must not fall while the job is building.
      expect(calculateFactionScore(purchase.state, "alpha")).toBe(expectedScore);

      const buildSteps =
        purchase.job.state === "BUILDING" ? purchase.job.remainingTicks : 0;
      expect(buildSteps).toBeGreaterThan(0);
      let deployed = purchase.state;
      for (let step = 0; step < buildSteps; step += 1) {
        deployed = advanceTankProductionPhase(deployed);
      }

      expect(
        deployed.tankProductionJobs.some((job) => job.ownerId === "alpha"),
      ).toBe(false);
      expect(deployed.mobileUnits).toContainEqual(
        expect.objectContaining({
          ownerId: "alpha",
          type: expectedChassis,
        }),
      );

      // Deployment changes lifecycle representation, not replacement capital.
      expect(calculateFactionScore(deployed, "alpha")).toBe(expectedScore);
    },
  );
});