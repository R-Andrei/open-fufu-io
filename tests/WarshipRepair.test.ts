import { describe, expect, it } from "vitest";

import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createMobileUnit,
  setMobileUnitStrategicDestination,
} from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";
import * as WarshipRepair from "../src/simulation/WarshipRepair";

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(
    RULE_AXIS_REGISTRY,
    originRuleProfileInput(traits),
  );
}

interface WarshipSeed {
  readonly cellId: number;
  readonly health: bigint;
  readonly repairPortId?: string;
  readonly repairArrivalTick?: number;
  readonly strategicDestinationCellId?: number;
}

function fixture(options: Readonly<{
  seed: string;
  width: number;
  portLevel?: 1 | 2 | 3 | 4 | 5;
  traits?: readonly OriginTraitId[];
  warships: readonly WarshipSeed[];
}>): MatchState {
  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: options.seed,
      width: options.width,
      height: 1,
      terrain: [
        "PLAINS",
        ...Array.from(
          { length: options.width - 1 },
          () => "DEEP_WATER" as const,
        ),
      ],
      initialOwners: [
        "alpha",
        ...Array.from({ length: options.width - 1 }, () => null),
      ],
      initialStructureGrants: [
        {
          structureId: "alpha-port",
          ownerId: "alpha",
          type: "PORT",
          cellId: 0,
          level: options.portLevel ?? 1,
        },
      ],
      factions: [
        { id: "alpha", rules: rules(options.traits) },
        { id: "beta", rules: rules() },
      ],
    }),
  );

  let collection = {
    mobileUnits: state.mobileUnits,
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  };
  const operational: any[] = [];
  for (const seed of options.warships) {
    const created = createMobileUnit(
      state.map,
      state.factions.map((faction) => faction.id),
      collection,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: seed.cellId,
      },
    );
    let unit = created.unit;
    if (seed.strategicDestinationCellId !== undefined) {
      unit = setMobileUnitStrategicDestination(
        state.map,
        unit,
        seed.strategicDestinationCellId,
      );
    }
    collection = {
      mobileUnits: created.mobileUnits.map((candidate) =>
        candidate.id === unit.id ? unit : candidate,
      ),
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    };
    operational.push({
      unitId: unit.id,
      health: { numerator: seed.health, denominator: 1n },
      rank: 1,
      navalXp: 0,
      operatingAnchorCellId: unit.cellId,
      attackReadyAtTick: state.tick,
      nextProjectileOrdinal: 0,
      roamingOrdinal: 0,
      ...(seed.repairPortId === undefined
        ? {}
        : { repairPortId: seed.repairPortId }),
      ...(seed.repairArrivalTick === undefined
        ? {}
        : { repairArrivalTick: seed.repairArrivalTick }),
    });
  }

  return createProspectiveMatchState(state, {
    mobileUnits: collection.mobileUnits,
    nextMobileUnitOrdinal: collection.nextMobileUnitOrdinal,
    warshipOperationalStates: operational,
  });
}

function intent(state: MatchState): MatchState {
  const fn = (WarshipRepair as unknown as {
    advanceWarshipRepairIntentPhase?: (current: MatchState) => MatchState;
  }).advanceWarshipRepairIntentPhase;
  if (fn === undefined) {
    throw new TypeError("advanceWarshipRepairIntentPhase is not implemented");
  }
  return fn(state);
}

function service(state: MatchState): MatchState {
  const fn = (WarshipRepair as unknown as {
    advanceWarshipRepairPhase?: (current: MatchState) => MatchState;
  }).advanceWarshipRepairPhase;
  if (fn === undefined) {
    throw new TypeError("advanceWarshipRepairPhase is not implemented");
  }
  return fn(state);
}

function addEnemyWarship(state: MatchState, cellId: number): MatchState {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId,
    },
  );
  return createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    warshipOperationalStates: [
      ...state.warshipOperationalStates,
      {
        unitId: created.unit.id,
        health: { numerator: 1_000n, denominator: 1n },
        rank: 1,
        navalXp: 0,
        operatingAnchorCellId: cellId,
        attackReadyAtTick: state.tick,
        nextProjectileOrdinal: 0,
        roamingOrdinal: 0,
      },
    ],
  });
}

describe("Warship Port repair adapter", () => {
  it("enters automatic repair retreat at and below exactly 50% max health and persists the Port assignment", () => {
    const above = intent(
      fixture({
        seed: "warship-repair-threshold-above-red",
        width: 30,
        warships: [{ cellId: 15, health: 501n }],
      }),
    );
    expect(above.warshipOperationalStates[0]).not.toHaveProperty(
      "repairPortId",
    );

    for (const [seed, health] of [
      ["warship-repair-threshold-exact-red", 500n],
      ["warship-repair-threshold-below-red", 499n],
    ] as const) {
      const intended = intent(
        fixture({
          seed,
          width: 30,
          warships: [{ cellId: 15, health }],
        }),
      );
      expect(intended.warshipOperationalStates[0]).toMatchObject({
        repairPortId: "alpha-port",
      });
      const serialized = JSON.parse(
        canonicalMatchStateSerialization(intended),
      );
      expect(serialized.warshipOperationalStates[0]).toMatchObject({
        repairPortId: "alpha-port",
      });
    }
  });

  it("uses ordinary L1 fast service at 100 HP/s and P31 at 150 HP/s with doubled fast radius", () => {
    const ordinary = fixture({
      seed: "warship-repair-ordinary-rate-red",
      width: 24,
      warships: [
        {
          cellId: 5,
          health: 500n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
        },
      ],
    });
    expect(service(ordinary).warshipOperationalStates[0]?.health).toEqual({
      numerator: 510n,
      denominator: 1n,
    });

    const p31 = fixture({
      seed: "warship-repair-p31-rate-red",
      width: 24,
      traits: ["P31"],
      warships: [
        {
          cellId: 15,
          health: 500n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
        },
      ],
    });
    expect(service(p31).warshipOperationalStates[0]?.health).toEqual({
      numerator: 515n,
      denominator: 1n,
    });
  });

  it("parks ordinary fast service and suppresses firing, while P31 remains combat-operational but stationary", () => {
    const ordinaryBase = fixture({
      seed: "warship-repair-fast-activity-ordinary-red",
      width: 25,
      warships: [
        {
          cellId: 5,
          health: 500n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
          strategicDestinationCellId: 24,
        },
      ],
    });
    const ordinarySourceId = ordinaryBase.warshipOperationalStates[0]!.unitId;
    const ordinary = new TickEngine().advance(
      addEnemyWarship(ordinaryBase, 6),
      [],
    );
    expect(
      ordinary.mobileUnits.find((unit) => unit.id === ordinarySourceId)?.cellId,
    ).toBe(5);
    expect(
      ordinary.warshipOperationalStates.find(
        (entry) => entry.unitId === ordinarySourceId,
      ),
    ).toMatchObject({
      health: { numerator: 510n, denominator: 1n },
      attackReadyAtTick: 0,
    });
    expect(
      ordinary.combatProjectiles.some(
        (projectile) => projectile.sourceUnitId === ordinarySourceId,
      ),
    ).toBe(false);

    const p31Base = fixture({
      seed: "warship-repair-fast-activity-p31-red",
      width: 25,
      traits: ["P31"],
      warships: [
        {
          cellId: 5,
          health: 500n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
          strategicDestinationCellId: 24,
        },
      ],
    });
    const p31SourceId = p31Base.warshipOperationalStates[0]!.unitId;
    const p31 = new TickEngine().advance(addEnemyWarship(p31Base, 6), []);
    expect(
      p31.mobileUnits.find((unit) => unit.id === p31SourceId)?.cellId,
    ).toBe(5);
    expect(
      p31.warshipOperationalStates.find(
        (entry) => entry.unitId === p31SourceId,
      ),
    ).toMatchObject({
      health: { numerator: 515n, denominator: 1n },
      attackReadyAtTick: 21,
    });
    expect(
      p31.combatProjectiles.some(
        (projectile) => projectile.sourceUnitId === p31SourceId,
      ),
    ).toBe(true);
  });

  it("clears repair assignment at full health without erasing a retained strategic destination", () => {
    const state = fixture({
      seed: "warship-repair-resume-red",
      width: 25,
      portLevel: 5,
      warships: [
        {
          cellId: 5,
          health: 995n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
          strategicDestinationCellId: 24,
        },
      ],
    });
    const unitId = state.warshipOperationalStates[0]!.unitId;
    const repaired = service(state);
    expect(repaired.warshipOperationalStates[0]?.health).toEqual({
      numerator: 1_000n,
      denominator: 1n,
    });
    expect(repaired.warshipOperationalStates[0]).not.toHaveProperty(
      "repairPortId",
    );
    expect(repaired.warshipOperationalStates[0]).not.toHaveProperty(
      "repairArrivalTick",
    );
    expect(
      repaired.mobileUnits.find((unit) => unit.id === unitId)
        ?.strategicDestinationCellId,
    ).toBe(24);
  });
});
