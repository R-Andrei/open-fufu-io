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
  setMobileUnitStrategicDestination,
} from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function pursuitFixture(): Readonly<{
  state: MatchState;
  alphaUnitId: string;
  betaUnitId: string;
}> {
  const width = 40;
  const height = 3;
  const cellCount = width * height;
  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-pursuit-red",
      width,
      height,
      terrain: Array.from({ length: cellCount }, () => "PLAINS" as const),
      initialOwners: Array.from({ length: cellCount }, () => "alpha"),
      initialStructureGrants: [
        {
          structureId: "alpha-observation",
          ownerId: "alpha",
          type: "OBSERVATION_POST",
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
      cellId: 0,
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
      cellId: width + 31,
    },
  );
  state = createProspectiveMatchState(state, {
    mobileUnits: beta.mobileUnits,
    nextMobileUnitOrdinal: beta.nextMobileUnitOrdinal,
    tankOperationalStates: [
      {
        unitId: alpha.unit.id,
        health: { numerator: 1_000n, denominator: 1n },
        operatingAnchorCellId: alpha.unit.cellId,
        eligibleFromTick: 1,
        attackReadyAtTick: 1_000,
      },
      {
        unitId: beta.unit.id,
        health: { numerator: 1_000n, denominator: 1n },
        operatingAnchorCellId: beta.unit.cellId,
        eligibleFromTick: 1_000,
        attackReadyAtTick: 1_000,
      },
    ],
  });
  return Object.freeze({
    state,
    alphaUnitId: alpha.unit.id,
    betaUnitId: beta.unit.id,
  });
}

function strategicTravelFixture(
  blocked: boolean,
): Readonly<{
  state: MatchState;
  unitId: string;
  destinationCellId: number;
}> {
  const destinationCellId = blocked ? 4 : 2;
  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: blocked ? "tank-strategic-frontier-red" : "tank-strategic-arrival-red",
      width: 5,
      height: 1,
      terrain: [
        "PLAINS",
        "PLAINS",
        blocked ? "MOUNTAIN" : "PLAINS",
        "PLAINS",
        "PLAINS",
      ],
      initialOwners: ["alpha", "alpha", "alpha", "alpha", "alpha"],
      factions: [{ id: "alpha", rules: emptyRules() }],
    }),
  );
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    },
  );
  const ordered = setMobileUnitStrategicDestination(
    state.map,
    created.unit,
    destinationCellId,
  );
  state = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits.map((unit) =>
      unit.id === ordered.id ? ordered : unit,
    ),
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    tankOperationalStates: [
      {
        unitId: ordered.id,
        health: { numerator: 1_000n, denominator: 1n },
        operatingAnchorCellId: ordered.cellId,
        eligibleFromTick: 1,
        attackReadyAtTick: 1_000,
      },
    ],
  });
  return Object.freeze({ state, unitId: ordered.id, destinationCellId });
}

function unitById(state: MatchState, unitId: string) {
  const unit = state.mobileUnits.find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`missing unit ${unitId}`);
  return unit;
}

function operationalById(state: MatchState, unitId: string) {
  const operational = state.tankOperationalStates.find(
    (candidate) => candidate.unitId === unitId,
  );
  if (operational === undefined) {
    throw new Error(`missing Tank operational state ${unitId}`);
  }
  return operational;
}

describe("Tank autonomous pursuit", () => {
  it("pursues a retained target through the lowest-cellId equal-time firing position without resetting route progress", () => {
    const fixture = pursuitFixture();
    const engine = new TickEngine();

    const tick1 = engine.advance(fixture.state, []);
    const alpha1 = unitById(tick1, fixture.alphaUnitId);
    const alphaOperational1 = operationalById(tick1, fixture.alphaUnitId);
    expect(alphaOperational1.retainedTarget).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: fixture.betaUnitId,
    });
    expect(alpha1.cellId).toBe(0);
    expect(alpha1.route?.destinationCellId).toBe(2);
    expect(alpha1.route?.edgeProgress).toBeGreaterThan(0);

    const tick2 = engine.advance(tick1, []);
    const alpha2 = unitById(tick2, fixture.alphaUnitId);
    expect(alpha2.cellId).toBe(1);
    expect(alpha2.route?.destinationCellId).toBe(2);

    const tick3 = engine.advance(tick2, []);
    const alpha3 = unitById(tick3, fixture.alphaUnitId);
    expect(alpha3.cellId).toBe(1);
    expect(alpha3.route?.destinationCellId).toBe(2);
    expect(alpha3.route?.edgeProgress).toBeGreaterThan(0);

    const tick4 = engine.advance(tick3, []);
    const alpha4 = unitById(tick4, fixture.alphaUnitId);
    const alphaOperational4 = operationalById(tick4, fixture.alphaUnitId);
    expect(alpha4.cellId).toBe(2);
    expect(alpha4.route).toBeUndefined();
    expect(alphaOperational4.retainedTarget).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: fixture.betaUnitId,
    });
  });
});

describe("Tank strategic movement", () => {
  it("moves toward a reachable strategic destination and changes the operating anchor only on actual arrival", () => {
    const fixture = strategicTravelFixture(false);
    const engine = new TickEngine();

    const tick1 = engine.advance(fixture.state, []);
    const unit1 = unitById(tick1, fixture.unitId);
    expect(unit1.cellId).toBe(0);
    expect(unit1.strategicDestinationCellId).toBe(fixture.destinationCellId);
    expect(unit1.route?.destinationCellId).toBe(fixture.destinationCellId);
    expect(unit1.route?.edgeProgress).toBeGreaterThan(0);
    expect(operationalById(tick1, fixture.unitId).operatingAnchorCellId).toBe(0);

    const tick2 = engine.advance(tick1, []);
    expect(unitById(tick2, fixture.unitId).cellId).toBe(1);
    expect(operationalById(tick2, fixture.unitId).operatingAnchorCellId).toBe(0);

    const tick3 = engine.advance(tick2, []);
    expect(unitById(tick3, fixture.unitId).cellId).toBe(1);
    expect(operationalById(tick3, fixture.unitId).operatingAnchorCellId).toBe(0);

    const tick4 = engine.advance(tick3, []);
    const arrived = unitById(tick4, fixture.unitId);
    expect(arrived.cellId).toBe(fixture.destinationCellId);
    expect(arrived.route).toBeUndefined();
    expect(arrived.strategicDestinationCellId).toBe(fixture.destinationCellId);
    expect(operationalById(tick4, fixture.unitId).operatingAnchorCellId).toBe(
      fixture.destinationCellId,
    );
  });

  it("routes to the closest reachable frontier without replacing the real destination or moving the anchor", () => {
    const fixture = strategicTravelFixture(true);
    const engine = new TickEngine();

    const tick1 = engine.advance(fixture.state, []);
    const moving = unitById(tick1, fixture.unitId);
    expect(moving.cellId).toBe(0);
    expect(moving.strategicDestinationCellId).toBe(fixture.destinationCellId);
    expect(moving.route?.destinationCellId).toBe(1);
    expect(moving.route?.edgeProgress).toBeGreaterThan(0);
    expect(operationalById(tick1, fixture.unitId).operatingAnchorCellId).toBe(0);

    const tick2 = engine.advance(tick1, []);
    const frontier = unitById(tick2, fixture.unitId);
    expect(frontier.cellId).toBe(1);
    expect(frontier.route).toBeUndefined();
    expect(frontier.strategicDestinationCellId).toBe(fixture.destinationCellId);
    expect(operationalById(tick2, fixture.unitId).operatingAnchorCellId).toBe(0);

    const tick3 = engine.advance(tick2, []);
    const retried = unitById(tick3, fixture.unitId);
    expect(retried.cellId).toBe(1);
    expect(retried.route).toBeUndefined();
    expect(retried.strategicDestinationCellId).toBe(fixture.destinationCellId);
    expect(operationalById(tick3, fixture.unitId).operatingAnchorCellId).toBe(0);
  });
});
