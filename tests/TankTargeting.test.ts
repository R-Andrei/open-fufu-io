import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createMobileUnit,
  type MobileUnitState,
} from "../src/simulation/MobileUnits";
import { materializePersistentStructureState } from "../src/simulation/Structures";
import { selectTankAutonomousUnitTarget } from "../src/simulation/TankTargeting";
import { projectTankTargetObservation } from "../src/simulation/VisibilityState";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function targetFixture(
  width: number,
  height: number,
  terrain: readonly string[],
  ownership: readonly (string | null)[],
  alphaTraits: readonly OriginTraitId[] = [],
  betaTraits: readonly OriginTraitId[] = [],
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-targeting-red",
      width,
      height,
      terrain,
      initialOwners: ownership,
      factions: [
        { id: "alpha", rules: rulesWithTraits(alphaTraits) },
        { id: "beta", rules: rulesWithTraits(betaTraits) },
      ],
    }),
  );
}

function withAtWar(state: MatchState): MatchState {
  return createProspectiveMatchState(state, {
    hostilityGrace: [
      {
        sideA: { kind: "FACTION", id: "alpha" },
        sideB: { kind: "FACTION", id: "beta" },
        expiresAtTickExclusive: state.tick + 600,
      },
    ],
  });
}

function addUnit(
  state: MatchState,
  input: {
    readonly ownerId: string;
    readonly type: "TANK" | "HEAVY_ARTILLERY" | "WARSHIP" | "TRAIN";
    readonly movementClass: "TANK" | "HEAVY_ARTILLERY" | "NAVAL" | "RAIL";
    readonly cellId: number;
  },
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    input,
  );
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    }),
  });
}

function addTankObserver(
  state: MatchState,
  input: Readonly<{
    ownerId: string;
    type: "TANK" | "HEAVY_ARTILLERY";
    cellId: number;
    eligibleFromTick?: number;
  }>,
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
  const created = addUnit(state, {
    ownerId: input.ownerId,
    type: input.type,
    movementClass: input.type,
    cellId: input.cellId,
  });
  const eligibleFromTick = input.eligibleFromTick ?? created.state.tick;
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(created.state, {
      tankOperationalStates: [
        ...created.state.tankOperationalStates,
        Object.freeze({
          unitId: created.unit.id,
          health: Object.freeze({ numerator: 1_000n, denominator: 1n }),
          operatingAnchorCellId: input.cellId,
          eligibleFromTick,
          attackReadyAtTick: eligibleFromTick,
        }),
      ],
    }),
  });
}

function select(
  state: MatchState,
  chassisType: "TANK" | "HEAVY_ARTILLERY",
  currentCellId: number,
  operatingAnchorCellId: number,
  observedUnitIds: readonly string[],
  observedCellIds: readonly number[] = [],
) {
  return selectTankAutonomousUnitTarget(state, {
    ownerId: "alpha",
    chassisType,
    currentCellId,
    operatingAnchorCellId,
    observedUnitIds,
    observedCellIds,
  });
}

describe("Tank autonomous target arbitration", () => {
  it("uses Tank-derived chassis -> Warship -> Train class priority before proximity", () => {
    let state = targetFixture(
      50,
      1,
      Array.from({ length: 50 }, () => "PLAINS"),
      Array.from({ length: 50 }, () => "alpha"),
    );
    const tank = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = tank.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 5,
    });
    state = warship.state;
    const train = addUnit(state, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 4,
    });
    state = train.state;

    expect(
      select(state, "TANK", 0, 0, [tank.unit.id, warship.unit.id, train.unit.id]),
    ).toEqual({ targetClass: "TANK_CHASSIS", unitId: tank.unit.id });
  });

  it("ignores an unobserved higher-priority unit", () => {
    let state = targetFixture(
      50,
      1,
      Array.from({ length: 50 }, () => "PLAINS"),
      Array.from({ length: 50 }, () => "alpha"),
    );
    const tank = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = tank.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 5,
    });
    state = warship.state;

    expect(select(state, "TANK", 0, 0, [warship.unit.id])).toEqual({
      targetClass: "WARSHIP",
      unitId: warship.unit.id,
    });
  });

  it("chooses lower traversal time to any legal firing position within one class", () => {
    const width = 41;
    const height = 41;
    const terrain = Array.from({ length: width * height }, (_, cellId) => {
      const y = Math.floor(cellId / width);
      return y >= 1 && y <= 10 ? "MARSH" : "PLAINS";
    });
    let state = targetFixture(
      width,
      height,
      terrain,
      Array.from({ length: width * height }, () => "alpha"),
    );
    const slower = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40 * width,
    });
    state = slower.state;
    const faster = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = faster.state;

    expect(select(state, "TANK", 0, 0, [slower.unit.id, faster.unit.id])).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: faster.unit.id,
    });
  });

  it("breaks equal traversal-time ties by stable unit identity", () => {
    const width = 41;
    const height = 41;
    let state = targetFixture(
      width,
      height,
      Array.from({ length: width * height }, () => "PLAINS"),
      Array.from({ length: width * height }, () => "alpha"),
    );
    const first = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40 * width,
    });
    state = first.state;
    const second = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = second.state;

    expect(select(state, "TANK", 0, 0, [second.unit.id, first.unit.id])).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: first.unit.id,
    });
  });

  it("rejects a target outside the exact 100-cell operating leash", () => {
    let state = targetFixture(
      102,
      1,
      Array.from({ length: 102 }, () => "PLAINS"),
      Array.from({ length: 102 }, () => "alpha"),
    );
    const target = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 101,
    });
    state = target.state;

    expect(select(state, "TANK", 0, 0, [target.unit.id])).toBeUndefined();
  });

  it("disables P43 Train raiding while retaining Warship anti-armor targeting and range", () => {
    const ownership = Array.from<(string | null)>({ length: 41 }, (_, index) =>
      index === 0 ? "alpha" : null,
    );
    let state = targetFixture(
      41,
      1,
      Array.from({ length: 41 }, () => "PLAINS"),
      ownership,
      ["P43"],
    );
    const train = addUnit(state, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 20,
    });
    state = train.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 40,
    });
    state = warship.state;

    expect(select(state, "HEAVY_ARTILLERY", 0, 0, [train.unit.id])).toBeUndefined();
    expect(
      select(state, "HEAVY_ARTILLERY", 0, 0, [train.unit.id, warship.unit.id]),
    ).toEqual({ targetClass: "WARSHIP", unitId: warship.unit.id });
  });

  it("requires both current atWar and lawful cell observation for Population targeting", () => {
    const peace = targetFixture(
      2,
      1,
      ["PLAINS", "PLAINS"],
      ["alpha", "beta"],
    );

    expect(select(peace, "TANK", 0, 0, [], [1])).toBeUndefined();

    const war = withAtWar(peace);
    expect(select(war, "TANK", 0, 0, [], [])).toBeUndefined();
    expect(select(war, "TANK", 0, 0, [], [1])).toEqual({
      targetClass: "POPULATION",
      cellId: 1,
    });
  });

  it("breaks equal Population traversal-time ties by ascending cellId", () => {
    const state = withAtWar(
      targetFixture(
        3,
        1,
        ["PLAINS", "PLAINS", "PLAINS"],
        ["beta", "alpha", "beta"],
      ),
    );

    expect(select(state, "TANK", 1, 1, [], [2, 0])).toEqual({
      targetClass: "POPULATION",
      cellId: 0,
    });
  });

  it("uses the target owner's effective P48 Shallow-Water population-bearing permission", () => {
    const ordinary = withAtWar(
      targetFixture(
        2,
        1,
        ["PLAINS", "SHALLOW_WATER"],
        ["alpha", "beta"],
      ),
    );
    expect(select(ordinary, "TANK", 0, 0, [], [1])).toBeUndefined();

    const blessed = withAtWar(
      targetFixture(
        2,
        1,
        ["PLAINS", "SHALLOW_WATER"],
        ["alpha", "beta"],
        [],
        ["P48"],
      ),
    );
    expect(select(blessed, "TANK", 0, 0, [], [1])).toEqual({
      targetClass: "POPULATION",
      cellId: 1,
    });
  });

  it("places Population after Train and lets P43 fall through when Train raiding is disabled", () => {
    const terrain = ["PLAINS", "PLAINS", "PLAINS"];
    const ownership = ["alpha", "beta", "beta"];

    let baseline = withAtWar(targetFixture(3, 1, terrain, ownership));
    const baselineTrain = addUnit(baseline, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 1,
    });
    baseline = baselineTrain.state;
    expect(select(baseline, "TANK", 0, 0, [baselineTrain.unit.id], [2])).toEqual({
      targetClass: "TRAIN",
      unitId: baselineTrain.unit.id,
    });

    let artillery = withAtWar(
      targetFixture(3, 1, terrain, ownership, ["P43"]),
    );
    const artilleryTrain = addUnit(artillery, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 1,
    });
    artillery = artilleryTrain.state;
    expect(
      select(artillery, "HEAVY_ARTILLERY", 0, 0, [artilleryTrain.unit.id], [2]),
    ).toEqual({
      targetClass: "POPULATION",
      cellId: 2,
    });
  });
});

describe("Tank lawful target observation projection", () => {
  it("uses only eligible Tank-derived local observation and the exact baseline range boundary", () => {
    let state = targetFixture(
      32,
      1,
      Array.from({ length: 32 }, () => "PLAINS"),
      ["alpha", ...Array.from({ length: 31 }, () => "beta")],
    );
    const observer = addTankObserver(state, {
      ownerId: "alpha",
      type: "TANK",
      cellId: 0,
    });
    state = observer.state;
    const inRange = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 30,
    });
    state = inRange.state;
    const outOfRange = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 31,
    });
    state = outOfRange.state;

    const observation = projectTankTargetObservation(state, "alpha");
    expect(observation.observedUnitIds).toContain(inRange.unit.id);
    expect(observation.observedUnitIds).not.toContain(outOfRange.unit.id);
    expect(observation.observedCellIds).toContain(30);
    expect(observation.observedCellIds).not.toContain(31);
    expect(observation.observedUnitIds).toEqual(
      [...observation.observedUnitIds].sort(),
    );
    expect(observation.observedCellIds).toEqual(
      [...observation.observedCellIds].sort((left, right) => left - right),
    );

    const inactiveObserverState = createProspectiveMatchState(state, {
      tankOperationalStates: state.tankOperationalStates.map((entry) =>
        entry.unitId === observer.unit.id
          ? { ...entry, eligibleFromTick: state.tick + 1 }
          : entry,
      ),
    });
    const inactiveObservation = projectTankTargetObservation(
      inactiveObserverState,
      "alpha",
    );
    expect(inactiveObservation.observedUnitIds).not.toContain(inRange.unit.id);
    expect(inactiveObservation.observedCellIds).not.toContain(30);
  });

  it("uses the transformed Heavy-Artillery weapon range for local observation", () => {
    let state = targetFixture(
      47,
      1,
      Array.from({ length: 47 }, () => "PLAINS"),
      ["alpha", ...Array.from({ length: 46 }, () => "beta")],
      ["P43"],
    );
    const observer = addTankObserver(state, {
      ownerId: "alpha",
      type: "HEAVY_ARTILLERY",
      cellId: 0,
    });
    state = observer.state;
    const inRange = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 45,
    });
    state = inRange.state;
    const outOfRange = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 46,
    });
    state = outOfRange.state;

    const observation = projectTankTargetObservation(state, "alpha");
    expect(observation.observedUnitIds).toContain(inRange.unit.id);
    expect(observation.observedUnitIds).not.toContain(outOfRange.unit.id);
    expect(observation.observedCellIds).toContain(45);
    expect(observation.observedCellIds).not.toContain(46);
  });

  it("lets P45 conceal ordinary local observation while direct reveal exposes only the source", () => {
    const terrain = [
      ...Array.from({ length: 30 }, () => "PLAINS"),
      "FOREST",
      "PLAINS",
    ];
    let state = targetFixture(
      32,
      1,
      terrain,
      ["alpha", ...Array.from({ length: 31 }, () => "beta")],
      [],
      ["P45"],
    );
    const observer = addTankObserver(state, {
      ownerId: "alpha",
      type: "TANK",
      cellId: 0,
    });
    state = observer.state;
    const concealed = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 30,
    });
    state = concealed.state;

    const ordinary = projectTankTargetObservation(state, "alpha");
    expect(ordinary.observedUnitIds).not.toContain(concealed.unit.id);
    expect(ordinary.observedCellIds).not.toContain(30);

    const revealedState = createProspectiveMatchState(state, {
      directReveals: [
        {
          viewerFactionId: "alpha",
          sourceKind: "UNIT",
          sourceId: concealed.unit.id,
          expiryExclusiveTick: state.tick + 1,
        },
      ],
    });
    const revealed = projectTankTargetObservation(revealedState, "alpha");
    expect(revealed.observedUnitIds).toContain(concealed.unit.id);
    expect(revealed.observedCellIds).not.toContain(30);

    const expiredState = createProspectiveMatchState(state, {
      directReveals: [
        {
          viewerFactionId: "alpha",
          sourceKind: "UNIT",
          sourceId: concealed.unit.id,
          expiryExclusiveTick: state.tick,
        },
      ],
    });
    expect(
      projectTankTargetObservation(expiredState, "alpha").observedUnitIds,
    ).not.toContain(concealed.unit.id);
  });

  it("uses ordinary Observation Posts but lets enemy P49 blackout suppress them", () => {
    let state = targetFixture(
      70,
      1,
      Array.from({ length: 70 }, () => "PLAINS"),
      ["alpha", "alpha", ...Array.from({ length: 68 }, () => "beta")],
      [],
      ["P49"],
    );
    const observer = addTankObserver(state, {
      ownerId: "alpha",
      type: "TANK",
      cellId: 0,
    });
    state = observer.state;
    const target = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 35,
    });
    state = target.state;
    const alphaPost = materializePersistentStructureState({
      id: "alpha-observer",
      ownerId: "alpha",
      type: "OBSERVATION_POST",
      cellId: 1,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    state = createProspectiveMatchState(state, { structures: [alphaPost] });

    const ordinary = projectTankTargetObservation(state, "alpha");
    expect(ordinary.observedUnitIds).toContain(target.unit.id);
    expect(ordinary.observedCellIds).toContain(35);

    const betaBlackout = materializePersistentStructureState({
      id: "beta-blackout",
      ownerId: "beta",
      type: "OBSERVATION_POST",
      cellId: 50,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    state = createProspectiveMatchState(state, {
      structures: [alphaPost, betaBlackout],
    });
    const blackedOut = projectTankTargetObservation(state, "alpha");
    expect(blackedOut.observedUnitIds).not.toContain(target.unit.id);
    expect(blackedOut.observedCellIds).not.toContain(35);

    const revealedState = createProspectiveMatchState(state, {
      directReveals: [
        {
          viewerFactionId: "alpha",
          sourceKind: "UNIT",
          sourceId: target.unit.id,
          expiryExclusiveTick: state.tick + 1,
        },
      ],
    });
    const revealed = projectTankTargetObservation(revealedState, "alpha");
    expect(revealed.observedUnitIds).toContain(target.unit.id);
    expect(revealed.observedCellIds).not.toContain(35);
  });
});
