import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import {
  advanceTankProductionPhase,
  tankCellTraversalTiming,
  tankOperatingLeashContains,
  tankPurchaseCost,
  tankTerrainMovementTiming,
  tankWeaponRangeContains,
  tryStartTankProduction,
} from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function rulesWithTraitsAndAdditional(
  traits: readonly OriginTraitId[],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function rulesWithTraits(traits: readonly OriginTraitId[]) {
  return rulesWithTraitsAndAdditional(traits);
}

function productionFixture(
  ffy: number,
  options: {
    readonly traits?: readonly OriginTraitId[];
    readonly capturedFactory?: boolean;
    readonly initialOwners?: readonly (string | null)[];
  } = {},
) {
  const alphaRules = rulesWithTraits(options.traits ?? []);
  const state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-production-red",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: options.initialOwners ?? ["alpha", "alpha", "alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-factory",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 1,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules: alphaRules },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );

  const withFactoryProvenance = options.capturedFactory
    ? createProspectiveMatchState(state, {
        structures: state.structures.map((structure) =>
          structure.id === "alpha-factory"
            ? { ...structure, acquisitionPath: "CAPTURE_TRANSFER" as const }
            : structure,
        ),
      })
    : state;

  return createProspectiveMatchState(withFactoryProvenance, {
    factions: withFactoryProvenance.factions.map((faction) =>
      faction.id === "alpha" ? { ...faction, ffy } : faction,
    ),
  });
}

function movementFixture(
  traits: readonly OriginTraitId[] = [],
  tankMovementEchoBasisPoints?: number,
) {
  const additional: RuleContribution[] = [];
  if (tankMovementEchoBasisPoints !== undefined) {
    additional.push({
      axis: "UNIT_MOVEMENT_SPEED",
      scope: { kind: "UNIT", unit: "TANK" },
      stage: "ECHO_PERCENT",
      operator: "ADD_PERCENT",
      sourceKind: "ECHO",
      sourceId: "echo:test-tank-movement",
      valueUnit: "BASIS_POINTS",
      value: tankMovementEchoBasisPoints,
    });
  }
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-movement-red",
      width: 1,
      height: 1,
      terrain: ["PLAINS"],
      initialOwners: ["alpha"],
      factions: [
        { id: "alpha", rules: rulesWithTraitsAndAdditional(traits, additional) },
      ],
    }),
  );
}

function corridorFixture() {
  const state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-corridor-red",
      width: 5,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "ally", "beta", null, "inactive"],
      factions: [
        { id: "alpha", fixedTeamId: "team-a", rules: emptyRules() },
        { id: "ally", fixedTeamId: "team-a", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
        { id: "inactive", rules: emptyRules() },
      ],
    }),
  );
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === "inactive"
        ? { ...faction, status: "DEFEATED" as const }
        : faction,
    ),
  });
}

function expectExactTankSpeed(
  timing: ReturnType<typeof tankTerrainMovementTiming>,
  numerator: bigint,
  denominator: bigint,
) {
  expect(timing).toBeDefined();
  if (timing === undefined) throw new Error("expected traversable Tank terrain");
  expect(Number.isSafeInteger(timing.movementWorkPerTick)).toBe(true);
  expect(timing.movementWorkPerTick).toBeGreaterThan(0);
  expect(Number.isSafeInteger(timing.edgeWeight)).toBe(true);
  expect(timing.edgeWeight).toBeGreaterThan(0);
  expect(BigInt(timing.movementWorkPerTick) * 10n * denominator).toBe(
    BigInt(timing.edgeWeight) * numerator,
  );
}

function runProductionPhases(state: ReturnType<typeof productionFixture>, count: number) {
  let current = state;
  for (let tick = 0; tick < count; tick += 1) {
    current = advanceTankProductionPhase(current);
  }
  return current;
}

describe("baseline Tank lifecycle", () => {
  it("uses the exact active-chassis purchase-cost curve", () => {
    expect(tankPurchaseCost(0)).toBe(250_000);
    expect(tankPurchaseCost(1)).toBe(500_000);
    expect(tankPurchaseCost(2)).toBe(750_000);
    expect(tankPurchaseCost(3)).toBe(1_000_000);
    expect(tankPurchaseCost(4)).toBe(1_000_000);
  });

  it("uses an inclusive cell-center circle for weapon range", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 31,
      height: 2,
      terrain: Array.from({ length: 62 }, () => "PLAINS" as const),
    });

    expect(tankWeaponRangeContains(map, 0, 30, 30)).toBe(true);
    expect(tankWeaponRangeContains(map, 0, 61, 30)).toBe(false);
  });

  it.each([
    ["PLAINS", 5n, 1n],
    ["HIGHLAND", 4n, 1n],
    ["DESERT", 9n, 2n],
    ["FOREST", 13n, 4n],
    ["TUNDRA", 15n, 4n],
    ["MARSH", 5n, 2n],
  ] as const)(
    "uses the exact baseline Tank movement speed on %s",
    (terrain, numerator, denominator) => {
      expectExactTankSpeed(
        tankTerrainMovementTiming(movementFixture(), "alpha", "TANK", terrain),
        numerator,
        denominator,
      );
    },
  );

  it.each([
    "MOUNTAIN",
    "SHALLOW_WATER",
    "DEEP_WATER",
    "IMPASSABLE",
  ] as const)("blocks Tank traversal on %s", (terrain) => {
    expect(
      tankTerrainMovementTiming(movementFixture(), "alpha", "TANK", terrain),
    ).toBeUndefined();
  });

  it("applies P43 movement before a later Tank movement-speed Echo", () => {
    expectExactTankSpeed(
      tankTerrainMovementTiming(
        movementFixture(["P43"]),
        "alpha",
        "HEAVY_ARTILLERY",
        "PLAINS",
      ),
      5n,
      2n,
    );
    expectExactTankSpeed(
      tankTerrainMovementTiming(
        movementFixture(["P43"], 400),
        "alpha",
        "HEAVY_ARTILLERY",
        "PLAINS",
      ),
      13n,
      5n,
    );
  });

  it("allows owned, allied, and enemy active Tank corridor cells without requiring atWar", () => {
    const state = corridorFixture();

    expect(tankCellTraversalTiming(state, "alpha", "TANK", 0)).toBeDefined();
    expect(tankCellTraversalTiming(state, "alpha", "TANK", 1)).toBeDefined();
    expect(tankCellTraversalTiming(state, "alpha", "TANK", 2)).toBeDefined();
    expect(state.operations).toHaveLength(0);
    expect(state.hostilityGrace).toHaveLength(0);
  });

  it("does not treat neutral or inactive-faction territory as a Tank corridor", () => {
    const state = corridorFixture();

    expect(tankCellTraversalTiming(state, "alpha", "TANK", 3)).toBeUndefined();
    expect(tankCellTraversalTiming(state, "alpha", "TANK", 4)).toBeUndefined();
  });

  it("uses the exact inclusive 100-cell operating leash", () => {
    const width = 102;
    const height = 82;
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width,
      height,
      terrain: Array.from({ length: width * height }, () => "PLAINS" as const),
    });
    const anchor = 0;

    expect(tankOperatingLeashContains(map, anchor, 100)).toBe(true);
    expect(tankOperatingLeashContains(map, anchor, 101)).toBe(false);
    expect(tankOperatingLeashContains(map, anchor, 80 * width + 60)).toBe(true);
    expect(tankOperatingLeashContains(map, anchor, 81 * width + 60)).toBe(false);
  });

  it("atomically admits an affordable Factory build and rejects cost - 1 without mutation", () => {
    const affordable = productionFixture(250_000);
    const accepted = tryStartTankProduction(affordable, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Tank production admission");
    expect(accepted.cost).toBe(250_000);
    expect(
      accepted.state.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(0);
    expect(accepted.state.tankProductionJobs).toHaveLength(1);

    const unaffordable = productionFixture(249_999);
    const rejected = tryStartTankProduction(unaffordable, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });

    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error("expected Tank production rejection");
    expect(rejected.failure.code).toBe("INSUFFICIENT_FFY");
    expect(rejected.state).toBe(unaffordable);
    expect(rejected.state.tankProductionJobs).toHaveLength(0);
    expect(
      rejected.state.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(249_999);
  });

  it.each([
    {
      label: "baseline Tank",
      traits: [] as OriginTraitId[],
      capturedFactory: false,
      expectedTicks: 50,
      expectedChassis: "TANK" as const,
      expectedMovementClass: "TANK" as const,
    },
    {
      label: "P34 captured-Factory Tank",
      traits: ["P34"] as OriginTraitId[],
      capturedFactory: true,
      expectedTicks: 34,
      expectedChassis: "TANK" as const,
      expectedMovementClass: "TANK" as const,
    },
    {
      label: "P43 Heavy Artillery",
      traits: ["P43"] as OriginTraitId[],
      capturedFactory: false,
      expectedTicks: 100,
      expectedChassis: "HEAVY_ARTILLERY" as const,
      expectedMovementClass: "HEAVY_ARTILLERY" as const,
    },
    {
      label: "P34 + P43 captured-Factory Heavy Artillery",
      traits: ["P34", "P43"] as OriginTraitId[],
      capturedFactory: true,
      expectedTicks: 67,
      expectedChassis: "HEAVY_ARTILLERY" as const,
      expectedMovementClass: "HEAVY_ARTILLERY" as const,
    },
  ])(
    "progresses and deploys $label on the exact finalized build-tick boundary",
    ({
      traits,
      capturedFactory,
      expectedTicks,
      expectedChassis,
      expectedMovementClass,
    }) => {
      const initial = productionFixture(1_000_000, { traits, capturedFactory });
      const accepted = tryStartTankProduction(initial, {
        ownerId: "alpha",
        factoryId: "alpha-factory",
      });

      expect(accepted.ok).toBe(true);
      if (!accepted.ok) throw new Error("expected Tank production admission");
      expect(accepted.job).toMatchObject({
        state: "BUILDING",
        chassisType: expectedChassis,
        remainingTicks: expectedTicks,
      });

      const beforeCompletion = runProductionPhases(
        accepted.state,
        expectedTicks - 1,
      );
      expect(beforeCompletion.tankProductionJobs).toEqual([
        expect.objectContaining({
          state: "BUILDING",
          chassisType: expectedChassis,
          remainingTicks: 1,
        }),
      ]);
      expect(beforeCompletion.mobileUnits).toHaveLength(0);

      const completed = advanceTankProductionPhase(beforeCompletion);
      expect(completed.tankProductionJobs).toHaveLength(0);
      expect(completed.mobileUnits).toHaveLength(1);
      expect(completed.mobileUnits[0]).toMatchObject({
        ownerId: "alpha",
        type: expectedChassis,
        movementClass: expectedMovementClass,
        cellId: 0,
      });
    },
  );

  it("holds completed output when deployment is blocked and deploys it later without more build work", () => {
    const initial = productionFixture(250_000, {
      initialOwners: ["beta", "alpha", "beta", "beta"],
    });
    const accepted = tryStartTankProduction(initial, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Tank production admission");

    const blocked = runProductionPhases(accepted.state, 50);
    expect(blocked.mobileUnits).toHaveLength(0);
    expect(blocked.tankProductionJobs).toEqual([
      {
        factoryId: "alpha-factory",
        ownerId: "alpha",
        chassisType: "TANK",
        state: "WAITING_DEPLOYMENT",
      },
    ]);

    const opened = createProspectiveMatchState(blocked, {
      ownership: ["alpha", "alpha", "beta", "beta"],
    });
    const deployed = advanceTankProductionPhase(opened);

    expect(deployed.tankProductionJobs).toHaveLength(0);
    expect(deployed.mobileUnits).toHaveLength(1);
    expect(deployed.mobileUnits[0]).toMatchObject({
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
  });

  it("runs Tank production after structure lifecycle so paused work resumes on the Factory activation tick", () => {
    const accepted = tryStartTankProduction(productionFixture(250_000), {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Tank production admission");

    const temporarilyInactive = createProspectiveMatchState(accepted.state, {
      structures: accepted.state.structures.map((structure) =>
        structure.id === "alpha-factory"
          ? {
              ...structure,
              completedLevel: undefined,
              active: false,
              construction: { targetLevel: 1 as const, remainingTicks: 2 },
            }
          : structure,
      ),
    });
    const engine = new TickEngine();

    const paused = engine.advance(temporarilyInactive, []);
    expect(
      paused.structures.find((structure) => structure.id === "alpha-factory"),
    ).toMatchObject({
      active: false,
      construction: { targetLevel: 1, remainingTicks: 1 },
    });
    expect(paused.tankProductionJobs[0]).toMatchObject({
      state: "BUILDING",
      remainingTicks: 50,
    });

    const resumed = engine.advance(paused, []);
    expect(
      resumed.structures.find((structure) => structure.id === "alpha-factory"),
    ).toMatchObject({ active: true, completedLevel: 1 });
    expect(resumed.tankProductionJobs[0]).toMatchObject({
      state: "BUILDING",
      remainingTicks: 49,
    });
  });

  it("observes capture transfer before the final production phase and cancels the old owner's job without refund", () => {
    const accepted = tryStartTankProduction(productionFixture(250_000), {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Tank production admission");

    const capturedCell = createProspectiveMatchState(accepted.state, {
      ownership: accepted.state.ownership.map((ownerId, cellId) =>
        cellId === 1 ? "beta" : ownerId,
      ),
    });
    const advanced = new TickEngine().advance(capturedCell, []);

    expect(
      advanced.structures.find((structure) => structure.id === "alpha-factory"),
    ).toMatchObject({
      ownerId: "beta",
      acquisitionPath: "CAPTURE_TRANSFER",
    });
    expect(advanced.tankProductionJobs).toHaveLength(0);
    expect(
      advanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(100);
  });
});
