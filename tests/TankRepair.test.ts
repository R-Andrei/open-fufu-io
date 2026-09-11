import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import {
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { advanceTankRepairPhase } from "../src/simulation/TankRepair";
import type { TankExactHealth, TankOperationalState } from "../src/simulation/Tanks";

function rules(
  traits: readonly OriginTraitId[] = [],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

interface TankSeed {
  readonly cellId: number;
  readonly health: bigint;
  readonly arrivalTick?: number;
  readonly anchorCellId?: number;
}

function repairFixture(options: {
  readonly width: number;
  readonly factoryLevel: 1 | 2 | 3 | 4 | 5;
  readonly capturedFactory?: boolean;
  readonly traits?: readonly OriginTraitId[];
  readonly additional?: readonly RuleContribution[];
  readonly tick?: number;
  readonly tanks: readonly TankSeed[];
}): MatchState {
  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-repair-red",
      width: options.width,
      height: 1,
      terrain: Array.from({ length: options.width }, () => "PLAINS"),
      initialOwners: Array.from({ length: options.width }, () => "alpha"),
      initialStructureGrants: [
        {
          structureId: "alpha-factory",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          level: options.factoryLevel,
        },
      ],
      factions: [
        {
          id: "alpha",
          rules: rules(options.traits, options.additional),
        },
      ],
    }),
  );

  if (options.capturedFactory) {
    state = createProspectiveMatchState(state, {
      structures: state.structures.map((structure) =>
        structure.id === "alpha-factory"
          ? { ...structure, acquisitionPath: "CAPTURE_TRANSFER" as const }
          : structure,
      ),
    });
  }

  for (let tick = 0; tick < (options.tick ?? 0); tick += 1) {
    state = createAdvancedMatchState(state, {});
  }

  let collection = {
    mobileUnits: state.mobileUnits,
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  };
  const operational: TankOperationalState[] = [];

  for (const tank of options.tanks) {
    const created = createMobileUnit(
      state.map,
      ["alpha"],
      collection,
      {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId: tank.cellId,
      },
    );
    collection = {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    };
    operational.push({
      unitId: created.unit.id,
      health: { numerator: tank.health, denominator: 1n },
      operatingAnchorCellId: tank.anchorCellId ?? tank.cellId,
      eligibleFromTick: 0,
      attackReadyAtTick: 0,
      repairFactoryId: "alpha-factory",
      ...(tank.arrivalTick === undefined
        ? {}
        : { repairArrivalTick: tank.arrivalTick }),
    });
  }

  return createProspectiveMatchState(state, {
    mobileUnits: collection.mobileUnits,
    nextMobileUnitOrdinal: collection.nextMobileUnitOrdinal,
    tankOperationalStates: operational,
  });
}

function healthByUnitId(state: MatchState): ReadonlyMap<string, TankExactHealth> {
  return new Map(
    state.tankOperationalStates.map((entry) => [entry.unitId, entry.health]),
  );
}

function expectHealth(
  health: TankExactHealth | undefined,
  numerator: bigint,
  denominator = 1n,
): void {
  expect(health).toEqual({ numerator, denominator });
}

describe("Tank Factory two-tier repair service", () => {
  it.each([
    [1, 1n],
    [2, 2n],
    [3, 3n],
    [4, 4n],
    [5, 5n],
  ] as const)(
    "applies L%i broad-field repair while an assigned chassis remains mobile",
    (factoryLevel, expectedPerTick) => {
      const state = repairFixture({
        width: 16,
        factoryLevel,
        tanks: [{ cellId: 15, health: 500n }],
      });
      const unitId = state.tankOperationalStates[0]!.unitId;
      const result = advanceTankRepairPhase(state);
      expectHealth(healthByUnitId(result).get(unitId), 500n + expectedPerTick);
      expect(result.tankOperationalStates[0]).not.toHaveProperty(
        "repairArrivalTick",
      );
    },
  );

  it("uses the inclusive L1 broad radius 20 and excludes cell 21", () => {
    const state = repairFixture({
      width: 22,
      factoryLevel: 1,
      tanks: [
        { cellId: 20, health: 500n },
        { cellId: 21, health: 500n },
      ],
    });
    const ids = state.tankOperationalStates.map((entry) => entry.unitId);
    const result = advanceTankRepairPhase(state);
    expectHealth(healthByUnitId(result).get(ids[0]!), 501n);
    expectHealth(healthByUnitId(result).get(ids[1]!), 500n);
  });

  it.each([
    [1, 10n, 1n],
    [2, 55n, 4n],
    [3, 35n, 2n],
    [4, 85n, 4n],
    [5, 25n, 1n],
  ] as const)(
    "applies the L%i fast-service rate inside the fixed 10-cell field",
    (factoryLevel, incrementNumerator, incrementDenominator) => {
      const state = repairFixture({
        width: 11,
        factoryLevel,
        tanks: [{ cellId: 10, health: 500n, arrivalTick: 0 }],
      });
      const unitId = state.tankOperationalStates[0]!.unitId;
      const result = advanceTankRepairPhase(state);
      const expectedNumerator = 500n * incrementDenominator + incrementNumerator;
      expectHealth(
        healthByUnitId(result).get(unitId),
        expectedNumerator,
        incrementDenominator,
      );
    },
  );

  it("keeps fast-service capacity fixed at one and gives waiting chassis broad repair without stacking", () => {
    const state = repairFixture({
      width: 3,
      factoryLevel: 5,
      tanks: [
        { cellId: 1, health: 500n, arrivalTick: 0 },
        { cellId: 2, health: 500n, arrivalTick: 0 },
      ],
    });
    const ids = state.tankOperationalStates.map((entry) => entry.unitId);
    const result = advanceTankRepairPhase(state);
    expectHealth(healthByUnitId(result).get(ids[0]!), 525n);
    expectHealth(healthByUnitId(result).get(ids[1]!), 505n);
  });

  it("uses stable (repairArrivalTick, unitId) ordering for the one fast-service slot", () => {
    const state = repairFixture({
      width: 3,
      factoryLevel: 2,
      tick: 2,
      tanks: [
        { cellId: 1, health: 500n, arrivalTick: 2 },
        { cellId: 2, health: 500n, arrivalTick: 1 },
      ],
    });
    const ids = state.tankOperationalStates.map((entry) => entry.unitId);
    const result = advanceTankRepairPhase(state);
    expectHealth(healthByUnitId(result).get(ids[0]!), 502n);
    expectHealth(healthByUnitId(result).get(ids[1]!), 2_055n, 4n);
  });

  it("composes P34 and repair Echoes on broad radius plus both rates while keeping fast radius fixed", () => {
    const additional = [
      echoRuleContribution(
        "factory.repair_radius",
        "BENEFICIAL",
        2_000,
        "echo:test-repair-radius",
      ),
      echoRuleContribution(
        "factory.repair_rate",
        "BENEFICIAL",
        2_000,
        "echo:test-repair-rate",
      ),
    ];
    const state = repairFixture({
      width: 38,
      factoryLevel: 1,
      capturedFactory: true,
      traits: ["P34"],
      additional,
      tanks: [
        { cellId: 10, health: 500n, arrivalTick: 0 },
        { cellId: 9, health: 500n, arrivalTick: 0 },
        { cellId: 36, health: 500n },
        { cellId: 37, health: 500n },
      ],
    });
    const ids = state.tankOperationalStates.map((entry) => entry.unitId);
    const result = advanceTankRepairPhase(state);
    const byId = healthByUnitId(result);

    // Fast: 100 HP/s * 1.20 Echo * 1.50 P34 = 180 HP/s = 18 HP/tick.
    expectHealth(byId.get(ids[0]!), 518n);
    // Waiting in the fast field gets broad only: 10 * 1.20 * 1.50 = 18 HP/s = 1.8/tick.
    expectHealth(byId.get(ids[1]!), 2_509n, 5n);
    // Broad radius: 20 * 1.20 * 1.50 = 36 cells, inclusive.
    expectHealth(byId.get(ids[2]!), 2_509n, 5n);
    expectHealth(byId.get(ids[3]!), 500n);
  });

  it("clamps fast repair at max health, clears repair state, and preserves the operating anchor", () => {
    const state = repairFixture({
      width: 2,
      factoryLevel: 2,
      tanks: [
        { cellId: 1, health: 995n, arrivalTick: 0, anchorCellId: 0 },
      ],
    });
    const unitId = state.tankOperationalStates[0]!.unitId;
    const result = advanceTankRepairPhase(state);
    const repaired = result.tankOperationalStates.find(
      (entry) => entry.unitId === unitId,
    );

    expectHealth(repaired?.health, 1_000n);
    expect(repaired).toMatchObject({ operatingAnchorCellId: 0 });
    expect(repaired).not.toHaveProperty("repairFactoryId");
    expect(repaired).not.toHaveProperty("repairArrivalTick");
  });
});
