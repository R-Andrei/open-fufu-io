import { describe, expect, it } from "vitest";

import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createMobileUnit,
  type MobileUnitState,
} from "../src/simulation/MobileUnits";
import { resolveWarshipGunfireDecisions } from "../src/simulation/WarshipCombat";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function fixture(
  width = 32,
  alphaTraits: readonly OriginTraitId[] = [],
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-gunfire-red",
      width,
      height: 1,
      terrain: Array.from({ length: width }, () => "DEEP_WATER" as const),
      initialOwners: Array.from({ length: width }, () => null),
      factions: [
        { id: "alpha", rules: rulesWithTraits(alphaTraits) },
        { id: "beta", rules: rulesWithTraits() },
      ],
    }),
  );
}

function addNavalUnit(
  state: MatchState,
  input: Readonly<{
    ownerId: string;
    type: "WARSHIP" | "TRANSPORT_SHIP";
    cellId: number;
    health?: bigint;
  }>,
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: input.ownerId,
      type: input.type,
      movementClass: "NAVAL",
      cellId: input.cellId,
    },
  );
  const next = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    warshipOperationalStates:
      input.type === "WARSHIP"
        ? [
            ...state.warshipOperationalStates,
            {
              unitId: created.unit.id,
              health: {
                numerator: input.health ?? 1_000n,
                denominator: 1n,
              },
              operatingAnchorCellId: input.cellId,
              attackReadyAtTick: state.tick,
              nextProjectileOrdinal: 0,
              roamingOrdinal: 0,
            },
          ]
        : state.warshipOperationalStates,
  });
  return Object.freeze({ state: next, unit: created.unit });
}

function advanceWithoutRuntime(state: MatchState, ticks: number): MatchState {
  let current = state;
  for (let index = 0; index < ticks; index += 1) {
    current = createAdvancedMatchState(current, {});
  }
  return current;
}

function operational(state: MatchState, unitId: string) {
  return state.warshipOperationalStates.find((entry) => entry.unitId === unitId);
}

describe("Warship post-movement gunfire decisions", () => {
  it("spawns a physical projectile without applying hidden firing-time damage", () => {
    let state = fixture();
    const alpha = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 2,
    });
    state = alpha.state;
    const beta = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 7,
    });
    state = beta.state;

    const resolved = resolveWarshipGunfireDecisions(state);
    expect(resolved.combatProjectiles).toEqual([
      {
        sourceUnitId: alpha.unit.id,
        sourceOwnerId: "alpha",
        targetUnitId: beta.unit.id,
        projectileOrdinal: 0,
        profileId: "WARSHIP_NAVAL_GUN",
        position: { x: 2, y: 0 },
        speedCellsPerSecond: 75,
        damage: { numerator: 250n, denominator: 1n },
        createdTick: state.tick,
      },
      {
        sourceUnitId: beta.unit.id,
        sourceOwnerId: "beta",
        targetUnitId: alpha.unit.id,
        projectileOrdinal: 0,
        profileId: "WARSHIP_NAVAL_GUN",
        position: { x: 7, y: 0 },
        speedCellsPerSecond: 75,
        damage: { numerator: 250n, denominator: 1n },
        createdTick: state.tick,
      },
    ]);
    expect(operational(resolved, alpha.unit.id)?.health).toEqual({
      numerator: 1_000n,
      denominator: 1n,
    });
    expect(operational(resolved, beta.unit.id)?.health).toEqual({
      numerator: 1_000n,
      denominator: 1n,
    });
    expect(operational(resolved, alpha.unit.id)?.attackReadyAtTick).toBe(20);
    expect(operational(resolved, alpha.unit.id)?.nextProjectileOrdinal).toBe(1);
  });

  it("reacquires from current state on every ready firing decision instead of retaining the prior target", () => {
    let state = fixture();
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const first = addNavalUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 5,
    });
    state = first.state;
    const second = addNavalUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 10,
    });
    state = second.state;

    state = resolveWarshipGunfireDecisions(state);
    expect(state.combatProjectiles[0]?.targetUnitId).toBe(first.unit.id);

    state = advanceWithoutRuntime(state, 20);
    state = createProspectiveMatchState(state, {
      mobileUnits: state.mobileUnits.map((unit) =>
        unit.id === first.unit.id
          ? { ...unit, cellId: 15 }
          : unit.id === second.unit.id
            ? { ...unit, cellId: 4 }
            : unit,
      ),
    });
    state = resolveWarshipGunfireDecisions(state);

    const sourceProjectiles = state.combatProjectiles.filter(
      (projectile) => projectile.sourceUnitId === source.unit.id,
    );
    expect(sourceProjectiles.map((projectile) => projectile.targetUnitId)).toEqual([
      first.unit.id,
      second.unit.id,
    ]);
    expect(sourceProjectiles.map((projectile) => projectile.projectileOrdinal)).toEqual([
      0,
      1,
    ]);
  });

  it("does not fire merely because an out-of-range target has a reachable pursuit position", () => {
    let state = fixture(142);
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 140,
    });
    state = createProspectiveMatchState(target.state, {
      directReveals: [
        {
          viewerFactionId: "alpha",
          sourceKind: "UNIT",
          sourceId: target.unit.id,
          expiryExclusiveTick: state.tick + 10,
        },
      ],
    });

    const resolved = resolveWarshipGunfireDecisions(state);
    expect(
      resolved.combatProjectiles.some(
        (projectile) => projectile.sourceUnitId === source.unit.id,
      ),
    ).toBe(false);
    expect(operational(resolved, source.unit.id)?.attackReadyAtTick).toBe(0);
  });

  it("applies P23 effective range and damage to the firing-time projectile snapshot", () => {
    let state = fixture(202, ["P23"]);
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 200,
    });
    state = target.state;

    const resolved = resolveWarshipGunfireDecisions(state);
    const shot = resolved.combatProjectiles.find(
      (projectile) => projectile.sourceUnitId === source.unit.id,
    );
    expect(shot?.targetUnitId).toBe(target.unit.id);
    expect(shot?.damage).toEqual({ numerator: 500n, denominator: 1n });
  });

  it("respects P30 naval-gunfire removal while leaving the Warship ready", () => {
    let state = fixture(16, ["P30"]);
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 5,
    });
    state = target.state;

    const resolved = resolveWarshipGunfireDecisions(state);
    expect(
      resolved.combatProjectiles.some(
        (projectile) => projectile.sourceUnitId === source.unit.id,
      ),
    ).toBe(false);
    expect(operational(resolved, source.unit.id)?.attackReadyAtTick).toBe(0);
    expect(operational(resolved, source.unit.id)?.nextProjectileOrdinal).toBe(0);
  });

  it("does not fire again before the 2-second 10 Hz cooldown expires", () => {
    let state = fixture(16);
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 5,
    });
    state = target.state;

    state = resolveWarshipGunfireDecisions(state);
    state = advanceWithoutRuntime(state, 19);
    const early = resolveWarshipGunfireDecisions(state);
    expect(
      early.combatProjectiles.filter(
        (projectile) => projectile.sourceUnitId === source.unit.id,
      ),
    ).toHaveLength(1);

    state = createAdvancedMatchState(early, {});
    const ready = resolveWarshipGunfireDecisions(state);
    expect(
      ready.combatProjectiles.filter(
        (projectile) => projectile.sourceUnitId === source.unit.id,
      ),
    ).toHaveLength(2);
    expect(operational(ready, source.unit.id)?.nextProjectileOrdinal).toBe(2);
    expect(operational(ready, source.unit.id)?.attackReadyAtTick).toBe(40);
  });
});
