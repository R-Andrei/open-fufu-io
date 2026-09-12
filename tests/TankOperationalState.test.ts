import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
  type MatchStateUpdate,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import {
  advanceTankProductionPhase,
  tryStartTankProduction,
} from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";

type TankRetainedTargetProbe =
  | Readonly<{
      targetClass: "TANK_CHASSIS" | "WARSHIP" | "TRAIN";
      unitId: string;
    }>
  | Readonly<{
      targetClass: "POPULATION";
      cellId: number;
    }>;

type TankOperationalStateProbe = Readonly<{
  unitId: string;
  health: Readonly<{ numerator: bigint; denominator: bigint }>;
  operatingAnchorCellId: number;
  eligibleFromTick: number;
  attackReadyAtTick: number;
  retainedTarget?: TankRetainedTargetProbe;
  repairFactoryId?: string;
  repairArrivalTick?: number;
}>;

type DirectRevealProbe = Readonly<{
  viewerFactionId: string;
  sourceKind: "UNIT" | "STRUCTURE" | "OPERATION";
  sourceId: string;
  expiryExclusiveTick: number;
}>;

type MatchStateWithTankOperationalStates = MatchState &
  Readonly<{
    tankOperationalStates?: readonly TankOperationalStateProbe[];
    directReveals?: readonly DirectRevealProbe[];
  }>;

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function rulesWithFractionalHealthEcho() {
  const contribution: RuleContribution = {
    axis: "UNIT_MAX_HEALTH",
    scope: { kind: "UNIT", unit: "TANK" },
    stage: "ECHO_PERCENT",
    operator: "ADD_PERCENT",
    sourceKind: "ECHO",
    sourceId: "echo:test-tank-health-exactness",
    valueUnit: "BASIS_POINTS",
    value: 1,
  };
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [contribution],
  });
}

function fixture(): MatchState {
  const state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-operational-state-red",
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "alpha"],
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
        { id: "alpha", rules: rulesWithFractionalHealthEcho() },
      ],
    }),
  );
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) => ({ ...faction, ffy: 250_000 })),
  });
}

function completeBaselineTank(state: MatchState): MatchState {
  const accepted = tryStartTankProduction(state, {
    ownerId: "alpha",
    factoryId: "alpha-factory",
  });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) throw new Error("expected Tank production admission");

  let working = accepted.state;
  for (let tick = 0; tick < 50; tick += 1) {
    working = advanceTankProductionPhase(working);
  }
  return working;
}

function autonomousIntentFixture(alphaHealth: bigint): Readonly<{
  state: MatchState;
  alphaUnitId: string;
  betaUnitId: string;
  alternateBetaUnitId: string;
}> {
  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-autonomous-intent-red",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "alpha", "alpha"],
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
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const ownerIds = state.factions.map((faction) => faction.id);
  const alpha = createMobileUnit(
    state.map,
    ownerIds,
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 1,
    },
  );
  state = createProspectiveMatchState(state, {
    mobileUnits: alpha.mobileUnits,
    nextMobileUnitOrdinal: alpha.nextMobileUnitOrdinal,
  });
  const beta = createMobileUnit(
    state.map,
    ownerIds,
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 2,
    },
  );
  state = createProspectiveMatchState(state, {
    mobileUnits: beta.mobileUnits,
    nextMobileUnitOrdinal: beta.nextMobileUnitOrdinal,
  });
  const alternateBeta = createMobileUnit(
    state.map,
    ownerIds,
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 3,
    },
  );
  state = createProspectiveMatchState(state, {
    mobileUnits: alternateBeta.mobileUnits,
    nextMobileUnitOrdinal: alternateBeta.nextMobileUnitOrdinal,
    tankOperationalStates: [
      {
        unitId: alpha.unit.id,
        health: { numerator: alphaHealth, denominator: 1n },
        operatingAnchorCellId: alpha.unit.cellId,
        eligibleFromTick: 1,
        attackReadyAtTick: 1,
      },
      {
        unitId: beta.unit.id,
        health: { numerator: 1_000n, denominator: 1n },
        operatingAnchorCellId: beta.unit.cellId,
        eligibleFromTick: 1,
        attackReadyAtTick: 1,
      },
      {
        unitId: alternateBeta.unit.id,
        health: { numerator: 1_000n, denominator: 1n },
        operatingAnchorCellId: alternateBeta.unit.cellId,
        eligibleFromTick: 1,
        attackReadyAtTick: 1,
      },
    ],
  });
  return Object.freeze({
    state,
    alphaUnitId: alpha.unit.id,
    betaUnitId: beta.unit.id,
    alternateBetaUnitId: alternateBeta.unit.id,
  });
}

describe("Tank authoritative operational state", () => {
  it("creates one keyed state on deployment at exact full effective health and blocks action until the following tick", () => {
    const completed = completeBaselineTank(fixture());
    expect(completed.mobileUnits).toHaveLength(1);
    const unit = completed.mobileUnits[0]!;
    expect(unit).toMatchObject({
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });

    const operational = (completed as MatchStateWithTankOperationalStates)
      .tankOperationalStates;
    expect(operational).toEqual([
      {
        unitId: unit.id,
        health: { numerator: 10_001n, denominator: 10n },
        operatingAnchorCellId: 0,
        eligibleFromTick: completed.tick + 1,
        attackReadyAtTick: completed.tick + 1,
      },
    ]);

    expect(operational?.[0]).not.toHaveProperty("ownerId");
    expect(operational?.[0]).not.toHaveProperty("type");
    expect(operational?.[0]).not.toHaveProperty("cellId");
  });

  it("reconstructs keyed state deterministically and makes operational state fingerprint-relevant", () => {
    const completed = completeBaselineTank(fixture());
    const regenerated = completeBaselineTank(fixture());

    expect(regenerated.tankOperationalStates).toEqual(
      completed.tankOperationalStates,
    );

    const fingerprint = canonicalMatchStateSerialization(completed);
    expect(canonicalMatchStateSerialization(regenerated)).toBe(fingerprint);
    expect(
      (JSON.parse(fingerprint) as { tankOperationalStates?: unknown })
        .tankOperationalStates,
    ).toBeDefined();

    const operational = completed.tankOperationalStates[0]!;
    const damaged = createProspectiveMatchState(completed, {
      tankOperationalStates: [
        {
          ...operational,
          health: { numerator: 1_000n, denominator: 1n },
        },
      ],
    });
    expect(canonicalMatchStateSerialization(damaged)).not.toBe(fingerprint);
  });

  it("preserves sticky target and repair queue state as fingerprint-relevant authoritative state", () => {
    const completed = completeBaselineTank(fixture());
    const operational = completed.tankOperationalStates[0]!;
    const persistent: TankOperationalStateProbe = {
      ...operational,
      retainedTarget: { targetClass: "POPULATION", cellId: 2 },
      repairFactoryId: "alpha-factory",
      repairArrivalTick: completed.tick,
    };
    const withPersistentState = createProspectiveMatchState(completed, {
      tankOperationalStates: [persistent] as unknown as MatchState["tankOperationalStates"],
    });

    expect(
      (withPersistentState as MatchStateWithTankOperationalStates)
        .tankOperationalStates?.[0],
    ).toMatchObject({
      retainedTarget: { targetClass: "POPULATION", cellId: 2 },
      repairFactoryId: "alpha-factory",
      repairArrivalTick: completed.tick,
    });

    const fingerprint = canonicalMatchStateSerialization(withPersistentState);
    const serialized = JSON.parse(fingerprint) as {
      tankOperationalStates: readonly TankOperationalStateProbe[];
    };
    expect(serialized.tankOperationalStates[0]).toMatchObject({
      retainedTarget: { targetClass: "POPULATION", cellId: 2 },
      repairFactoryId: "alpha-factory",
      repairArrivalTick: completed.tick,
    });

    const changedTarget: TankOperationalStateProbe = {
      ...persistent,
      retainedTarget: { targetClass: "POPULATION", cellId: 1 },
    };
    const retargeted = createProspectiveMatchState(completed, {
      tankOperationalStates: [changedTarget] as unknown as MatchState["tankOperationalStates"],
    });
    expect(canonicalMatchStateSerialization(retargeted)).not.toBe(fingerprint);
  });

  it("stores direct reveals as deterministic fingerprint-relevant authoritative match state", () => {
    const initial = fixture() as MatchStateWithTankOperationalStates;
    expect(initial.directReveals).toEqual([]);

    const directReveals: readonly DirectRevealProbe[] = [
      {
        viewerFactionId: "charlie",
        sourceKind: "UNIT",
        sourceId: "tank-z",
        expiryExclusiveTick: 240,
      },
      {
        viewerFactionId: "alpha",
        sourceKind: "UNIT",
        sourceId: "tank-b",
        expiryExclusiveTick: 180,
      },
    ];
    const withReveals = createProspectiveMatchState(
      initial,
      { directReveals } as unknown as MatchStateUpdate,
    ) as MatchStateWithTankOperationalStates;

    expect(withReveals.directReveals).toEqual([
      {
        viewerFactionId: "alpha",
        sourceKind: "UNIT",
        sourceId: "tank-b",
        expiryExclusiveTick: 180,
      },
      {
        viewerFactionId: "charlie",
        sourceKind: "UNIT",
        sourceId: "tank-z",
        expiryExclusiveTick: 240,
      },
    ]);

    const serialized = JSON.parse(canonicalMatchStateSerialization(withReveals)) as {
      directReveals?: readonly DirectRevealProbe[];
    };
    expect(serialized.directReveals).toEqual(withReveals.directReveals);
    expect(canonicalMatchStateSerialization(withReveals)).not.toBe(
      canonicalMatchStateSerialization(initial),
    );
  });

  it("acquires a lawfully visible hostile Tank in TickEngine intent on the first eligible tick", () => {
    const fixture = autonomousIntentFixture(1_000n);
    const advanced = new TickEngine().advance(fixture.state, []);
    const alpha = advanced.tankOperationalStates.find(
      (operational) => operational.unitId === fixture.alphaUnitId,
    );

    expect(advanced.tick).toBe(1);
    expect(alpha?.repairFactoryId).toBeUndefined();
    expect(alpha?.retainedTarget).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: fixture.betaUnitId,
    });
  });

  it("gives exact-threshold Factory repair priority over same-tick target acquisition", () => {
    const fixture = autonomousIntentFixture(500n);
    const advanced = new TickEngine().advance(fixture.state, []);
    const alpha = advanced.tankOperationalStates.find(
      (operational) => operational.unitId === fixture.alphaUnitId,
    );

    expect(alpha?.repairFactoryId).toBe("alpha-factory");
    expect(alpha?.retainedTarget).toBeUndefined();
  });

  it("keeps a legal target sticky, then reacquires in the same intent phase when it ceases to exist", () => {
    const fixture = autonomousIntentFixture(1_000n);
    const engine = new TickEngine();
    const acquired = engine.advance(fixture.state, []);
    const retained = engine.advance(acquired, []);
    const retainedAlpha = retained.tankOperationalStates.find(
      (operational) => operational.unitId === fixture.alphaUnitId,
    );
    expect(retainedAlpha?.retainedTarget).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: fixture.betaUnitId,
    });

    const withoutRetainedTarget = createProspectiveMatchState(retained, {
      mobileUnits: retained.mobileUnits.filter(
        (unit) => unit.id !== fixture.betaUnitId,
      ),
      tankOperationalStates: retained.tankOperationalStates.filter(
        (operational) => operational.unitId !== fixture.betaUnitId,
      ),
    });
    const reacquired = engine.advance(withoutRetainedTarget, []);
    const reacquiredAlpha = reacquired.tankOperationalStates.find(
      (operational) => operational.unitId === fixture.alphaUnitId,
    );

    expect(reacquiredAlpha?.retainedTarget).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: fixture.alternateBetaUnitId,
    });
  });
});
