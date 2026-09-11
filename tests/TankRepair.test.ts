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
import type { TankOperationalState } from "../src/simulation/Tanks";

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
  readonly arrivalTick: number;
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
      repairArrivalTick: tank.arrivalTick,
    });
  }

  return createProspectiveMatchState(state, {
    mobileUnits: collection.mobileUnits,
    nextMobileUnitOrdinal: collection.nextMobileUnitOrdinal,
    tankOperationalStates: operational,
  });
}

function healthByUnitId(state: MatchState): ReadonlyMap<string, bigint> {
  return new Map(
    state.tankOperationalStates.map((entry) => [
      entry.unitId,
      entry.health.numerator / entry.health.denominator,
    ]),
  );
}

describe("Tank Factory repair service", () => {
  it("uses stable (repairArrivalTick, unitId) queue order under completed-level capacity", () => {
    const sameArrival = repairFixture({
      width: 3,
      factoryLevel: 1,
      tanks: [
        { cellId: 1, health: 500n, arrivalTick: 0 },
        { cellId: 2, health: 500n, arrivalTick: 0 },
      ],
    });
    const sameArrivalIds = sameArrival.tankOperationalStates.map((entry) => entry.unitId);
    const sameArrivalResult = advanceTankRepairPhase(sameArrival);
    expect(healthByUnitId(sameArrivalResult)).toEqual(
      new Map([
        [sameArrivalIds[0]!, 510n],
        [sameArrivalIds[1]!, 500n],
      ]),
    );

    const earlierArrival = repairFixture({
      width: 3,
      factoryLevel: 1,
      tick: 2,
      tanks: [
        { cellId: 1, health: 500n, arrivalTick: 2 },
        { cellId: 2, health: 500n, arrivalTick: 1 },
      ],
    });
    const earlierArrivalIds = earlierArrival.tankOperationalStates.map(
      (entry) => entry.unitId,
    );
    const earlierArrivalResult = advanceTankRepairPhase(earlierArrival);
    expect(healthByUnitId(earlierArrivalResult)).toEqual(
      new Map([
        [earlierArrivalIds[0]!, 500n],
        [earlierArrivalIds[1]!, 510n],
      ]),
    );
  });

  it("uses P34 captured-Factory radius 8 and rate 150 HP/s without changing level capacity", () => {
    const state = repairFixture({
      width: 10,
      factoryLevel: 2,
      capturedFactory: true,
      traits: ["P34"],
      tanks: [
        { cellId: 8, health: 500n, arrivalTick: 0 },
        { cellId: 9, health: 500n, arrivalTick: 0 },
      ],
    });
    const ids = state.tankOperationalStates.map((entry) => entry.unitId);
    const result = advanceTankRepairPhase(state);
    expect(healthByUnitId(result)).toEqual(
      new Map([
        [ids[0]!, 515n],
        [ids[1]!, 500n],
      ]),
    );
  });

  it("composes Factory repair Echoes, clamps at max health, and clears repair state without moving the anchor", () => {
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
      width: 7,
      factoryLevel: 2,
      additional,
      tanks: [
        { cellId: 6, health: 900n, arrivalTick: 0, anchorCellId: 4 },
        { cellId: 5, health: 995n, arrivalTick: 0, anchorCellId: 3 },
      ],
    });
    const ids = state.tankOperationalStates.map((entry) => entry.unitId);
    const result = advanceTankRepairPhase(state);
    const byId = new Map(result.tankOperationalStates.map((entry) => [entry.unitId, entry]));

    expect(byId.get(ids[0]!)?.health).toEqual({ numerator: 912n, denominator: 1n });
    expect(byId.get(ids[0]!)).toMatchObject({
      operatingAnchorCellId: 4,
      repairFactoryId: "alpha-factory",
      repairArrivalTick: 0,
    });

    expect(byId.get(ids[1]!)?.health).toEqual({ numerator: 1_000n, denominator: 1n });
    expect(byId.get(ids[1]!)).toMatchObject({ operatingAnchorCellId: 3 });
    expect(byId.get(ids[1]!)).not.toHaveProperty("repairFactoryId");
    expect(byId.get(ids[1]!)).not.toHaveProperty("repairArrivalTick");
  });
});
