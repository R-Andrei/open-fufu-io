import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
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