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
  advanceWarshipProductionPhase,
  tryStartWarshipProduction,
} from "../src/simulation/Warships";
import * as WarshipRuntime from "../src/simulation/Warships";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function fixture(traits: readonly OriginTraitId[] = []): MatchState {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-progression-integration-red",
      width: 2,
      height: 1,
      terrain: ["DEEP_WATER", "PLAINS"],
      initialOwners: [null, "alpha"],
      factions: [{ id: "alpha", rules: rulesWithTraits(traits) }],
    }),
  );
  return createProspectiveMatchState(base, {
    factions: base.factions.map((faction) =>
      Object.freeze({ ...faction, ffy: 500_000 }),
    ),
    structures: [
      {
        id: "port-alpha",
        ownerId: "alpha",
        type: "PORT",
        cellId: 1,
        outputCellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
  });
}

function deployedWarship(traits: readonly OriginTraitId[] = []): MatchState {
  const accepted = tryStartWarshipProduction(fixture(traits), {
    ownerId: "alpha",
    portId: "port-alpha",
    strategicDestinationCellId: 0,
  });
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) throw new Error("expected Warship production admission");
  let state = accepted.state;
  for (let tick = 0; tick < 50; tick += 1) {
    state = advanceWarshipProductionPhase(state);
  }
  expect(state.mobileUnits).toHaveLength(1);
  return state;
}

function integrationApi() {
  const api = WarshipRuntime as unknown as {
    applyWarshipNavalXp?: (
      state: MatchState,
      unitId: string,
      awardedXp: number,
    ) => MatchState;
    warshipEffectiveRankCap?: (state: MatchState, ownerId: string) => number;
    warshipEffectiveMaxHealth?: (
      state: MatchState,
      ownerId: string,
      rank: number,
    ) => Readonly<{ numerator: bigint; denominator: bigint }>;
    warshipEffectiveGunDamage?: (
      state: MatchState,
      ownerId: string,
      rank?: number,
    ) => Readonly<{ numerator: bigint; denominator: bigint }>;
  };
  if (
    api.applyWarshipNavalXp === undefined ||
    api.warshipEffectiveRankCap === undefined ||
    api.warshipEffectiveMaxHealth === undefined
  ) {
    throw new TypeError("Warship progression integration is not implemented");
  }
  return api as Required<typeof api>;
}

describe("Warship progression integration", () => {
  it("deploys rank 1 / zero XP as canonical serialized Warship state", () => {
    const state = deployedWarship();
    const unitId = state.mobileUnits[0]!.id;
    expect(state.warshipOperationalStates).toEqual([
      expect.objectContaining({
        unitId,
        rank: 1,
        navalXp: 0,
      }),
    ]);

    const serialized = JSON.parse(canonicalMatchStateSerialization(state)) as {
      warshipOperationalStates: readonly {
        unitId: string;
        rank?: number;
        navalXp?: number;
      }[];
    };
    expect(serialized.warshipOperationalStates).toEqual([
      expect.objectContaining({ unitId, rank: 1, navalXp: 0 }),
    ]);
  });

  it("uses ordinary cap 3, preserves exact health percentage, and applies rank health/damage", () => {
    const api = integrationApi();
    const deployed = deployedWarship();
    const unitId = deployed.mobileUnits[0]!.id;
    const damaged = createProspectiveMatchState(deployed, {
      warshipOperationalStates: deployed.warshipOperationalStates.map(
        (operational) =>
          operational.unitId === unitId
            ? Object.freeze({
                ...operational,
                health: Object.freeze({ numerator: 333n, denominator: 1n }),
              })
            : operational,
      ),
    });

    expect(api.warshipEffectiveRankCap(damaged, "alpha")).toBe(3);
    const ranked = api.applyWarshipNavalXp(damaged, unitId, 100);
    expect(ranked.warshipOperationalStates).toEqual([
      expect.objectContaining({
        unitId,
        rank: 2,
        navalXp: 0,
        health: { numerator: 1_998n, denominator: 5n },
      }),
    ]);
    expect(api.warshipEffectiveMaxHealth(ranked, "alpha", 2)).toEqual({
      numerator: 1_200n,
      denominator: 1n,
    });
    expect(api.warshipEffectiveGunDamage(ranked, "alpha", 2)).toEqual({
      numerator: 300n,
      denominator: 1n,
    });
  });

  it("composes P22 through UNIT_MAX_RANK to cap at rank 5", () => {
    const api = integrationApi();
    const deployed = deployedWarship(["P22"]);
    const unitId = deployed.mobileUnits[0]!.id;

    expect(api.warshipEffectiveRankCap(deployed, "alpha")).toBe(5);
    const ranked = api.applyWarshipNavalXp(deployed, unitId, 450);
    expect(ranked.warshipOperationalStates).toEqual([
      expect.objectContaining({
        unitId,
        rank: 5,
        navalXp: 0,
        health: { numerator: 1_800n, denominator: 1n },
      }),
    ]);
  });
});
