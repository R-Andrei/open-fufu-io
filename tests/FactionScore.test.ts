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
import { createMobileUnit } from "../src/simulation/MobileUnits";
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

  it("keeps the first deployed Warship's baseline replacement capital in Current Power", () => {
    const rules = emptyRules();
    const initial = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "faction-score-deployed-warship",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "DEEP_WATER"],
        initialOwners: ["alpha", "beta", null],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const funded = createProspectiveMatchState(initial, {
      factions: initial.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 500_000 } : faction,
      ),
    });
    const fundedScore = calculateFactionScore(funded, "alpha");
    const deployedWarship = createMobileUnit(
      funded.map,
      funded.factions.map((faction) => faction.id),
      {
        mobileUnits: funded.mobileUnits,
        nextMobileUnitOrdinal: funded.nextMobileUnitOrdinal,
      },
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 2,
      },
    );
    const deployed = createProspectiveMatchState(funded, {
      factions: funded.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 250_000 } : faction,
      ),
      mobileUnits: deployedWarship.mobileUnits,
      nextMobileUnitOrdinal: deployedWarship.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        {
          unitId: deployedWarship.unit.id,
          health: { numerator: 1_000n, denominator: 1n },
          attackReadyAtTick: funded.tick,
          nextProjectileOrdinal: 0,
          roamingOrdinal: 0,
          rank: 1,
          navalXp: 0,
          operatingAnchorCellId: deployedWarship.unit.cellId,
        },
      ],
    });

    expect(deployedWarship.unit).toMatchObject({
      ownerId: "alpha",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 2,
    });

    // Canonical first-Warship baseline replacement cost is 250k. Converting
    // 250k liquid FFY into that deployed physical asset must preserve power.
    expect(calculateFactionScore(deployed, "alpha")).toBe(fundedScore);
  });

  it("reuses one territory aggregation across score reads of an unchanged ownership snapshot", () => {
    const state = scoreState([
      ...Array.from({ length: 10 }, () => "alpha"),
      ...Array.from({ length: 10 }, () => "beta"),
    ]);
    let terrainReads = 0;
    const instrumentedMap: typeof state.map = Object.freeze({
      ...state.map,
      source: state.map.source,
      cellCount: state.map.cellCount,
      rail: state.map.rail,
      isValidCellId: state.map.isValidCellId,
      cellIdAt: state.map.cellIdAt,
      positionOf: state.map.positionOf,
      terrainAt: (cellId: number) => {
        terrainReads += 1;
        return state.map.terrainAt(cellId);
      },
      cardinalNeighbors: state.map.cardinalNeighbors,
    });
    const instrumentedState = Object.freeze({ ...state, map: instrumentedMap });

    expect(calculateFactionScore(instrumentedState, "alpha")).toBe(1000);
    const readsAfterFirstScore = terrainReads;

    expect(calculateFactionScore(instrumentedState, "beta")).toBe(1000);
    expect(calculateFactionScore(instrumentedState, "alpha")).toBe(1000);

    expect(terrainReads).toBe(readsAfterFirstScore);
  });

  it.each(["CAPITULATED", "DEFEATED"] as const)(
    "returns zero for %s factions while preserving historical economy state",
    (status) => {
      const active = scoreState(["alpha", "beta"]);
      const terminal = createProspectiveMatchState(active, {
        factions: active.factions.map((faction) =>
          faction.id === "alpha"
            ? {
                ...faction,
                status,
                ffy: 500_000,
                lifetimeGrossPositiveFfyEarned: 123_456,
              }
            : faction,
        ),
      });
      const alpha = terminal.factions.find((faction) => faction.id === "alpha")!;

      expect(alpha.lifetimeGrossPositiveFfyEarned).toBe(123_456);
      expect(calculateFactionScore(terminal, "alpha")).toBe(0);
    },
  );

  it("excludes Train, Trade Ship, and Transport Ship state from Current Power", () => {
    const rules = emptyRules();
    const initial = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "faction-score-excluded-mobile-capital",
        width: 6,
        height: 1,
        terrain: [
          "PLAINS",
          "PLAINS",
          "DEEP_WATER",
          "DEEP_WATER",
          "PLAINS",
          "PLAINS",
        ],
        initialOwners: ["alpha", "beta", null, null, "alpha", "beta"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const funded = createProspectiveMatchState(initial, {
      factions: initial.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 500_000 } : faction,
      ),
    });
    const baselineScore = calculateFactionScore(funded, "alpha");
    let collection = {
      mobileUnits: funded.mobileUnits,
      nextMobileUnitOrdinal: funded.nextMobileUnitOrdinal,
    };

    for (const input of [
      {
        ownerId: "alpha",
        type: "TRAIN" as const,
        movementClass: "RAIL" as const,
        cellId: 0,
      },
      {
        ownerId: "alpha",
        type: "TRADE_SHIP" as const,
        movementClass: "NAVAL" as const,
        cellId: 2,
      },
      {
        ownerId: "alpha",
        type: "TRANSPORT_SHIP" as const,
        movementClass: "TRANSPORT" as const,
        cellId: 3,
      },
    ]) {
      const created = createMobileUnit(
        funded.map,
        funded.factions.map((faction) => faction.id),
        collection,
        input,
      );
      collection = {
        mobileUnits: created.mobileUnits,
        nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      };
    }

    const withExcludedUnits = createProspectiveMatchState(funded, collection);
    expect(calculateFactionScore(withExcludedUnits, "alpha")).toBe(baselineScore);
  });
});