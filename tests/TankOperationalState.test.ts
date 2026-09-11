import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  advanceTankProductionPhase,
  tryStartTankProduction,
} from "../src/simulation/Tanks";

type TankOperationalStateProbe = Readonly<{
  unitId: string;
  health: Readonly<{ numerator: bigint; denominator: bigint }>;
  operatingAnchorCellId: number;
  eligibleFromTick: number;
  attackReadyAtTick: number;
}>;

type MatchStateWithTankOperationalStates = MatchState &
  Readonly<{
    tankOperationalStates?: readonly TankOperationalStateProbe[];
  }>;

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
});
