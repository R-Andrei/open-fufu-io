import { describe, expect, it } from "vitest";

import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { createHomingCombatProjectile } from "../src/simulation/CombatProjectiles";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createMobileUnit,
  setMobileUnitStrategicDestination,
  type MobileUnitState,
} from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function fixture(
  width: number,
  height = 1,
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-tick-order-red",
      width,
      height,
      terrain: Array.from(
        { length: width * height },
        () => "DEEP_WATER" as const,
      ),
      initialOwners: Array.from({ length: width * height }, () => null),
      factions: [
        { id: "alpha", rules: rules() },
        { id: "beta", rules: rules() },
        { id: "gamma", rules: rules() },
      ],
    }),
  );
}

function addWarship(
  state: MatchState,
  input: Readonly<{
    ownerId: string;
    cellId: number;
    health?: bigint;
    strategicDestinationCellId?: number;
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
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: input.cellId,
    },
  );
  const unit =
    input.strategicDestinationCellId === undefined
      ? created.unit
      : setMobileUnitStrategicDestination(
          state.map,
          created.unit,
          input.strategicDestinationCellId,
        );
  const next = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits.map((candidate) =>
      candidate.id === unit.id ? unit : candidate,
    ),
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    warshipOperationalStates: [
      ...state.warshipOperationalStates,
      Object.freeze({
        unitId: unit.id,
        health: Object.freeze({
          numerator: input.health ?? 1_000n,
          denominator: 1n,
        }),
        operatingAnchorCellId: input.cellId,
        attackReadyAtTick: state.tick,
        nextProjectileOrdinal: 0,
        roamingOrdinal: 0,
      }),
    ],
  });
  return Object.freeze({
    state: next,
    unit:
      next.mobileUnits.find((candidate) => candidate.id === unit.id) ?? unit,
  });
}

describe("TickEngine Warship combat/projectile ordering", () => {
  it("commits shared movement before Warship firing and leaves the newly spawned projectile stationary for its spawn tick", () => {
    let state = fixture(132);
    const source = addWarship(state, {
      ownerId: "alpha",
      cellId: 0,
      strategicDestinationCellId: 20,
    });
    state = source.state;
    const target = addWarship(state, {
      ownerId: "beta",
      cellId: 131,
    });
    state = target.state;

    const advanced = new TickEngine().advance(state, []);

    const movedSource = advanced.mobileUnits.find(
      (unit) => unit.id === source.unit.id,
    );
    expect(movedSource?.cellId).toBe(1);

    const shot = advanced.combatProjectiles.find(
      (projectile) => projectile.sourceUnitId === source.unit.id,
    );
    expect(shot).toMatchObject({
      sourceUnitId: source.unit.id,
      sourceOwnerId: "alpha",
      targetUnitId: target.unit.id,
      projectileOrdinal: 0,
      profileId: "WARSHIP_NAVAL_GUN",
      position: { x: 1, y: 0 },
      speedCellsPerSecond: 75,
      damage: { numerator: 250n, denominator: 1n },
      createdTick: 1,
    });
  });

  it("advances pre-existing projectiles toward the target's current post-movement position", () => {
    let state = fixture(20, 2);
    const target = addWarship(state, {
      ownerId: "beta",
      cellId: 10,
      strategicDestinationCellId: 30,
    });
    state = target.state;
    const oldShot = createHomingCombatProjectile({
      sourceUnitId: "old-source",
      sourceOwnerId: "gamma",
      targetUnitId: target.unit.id,
      projectileOrdinal: 0,
      profileId: "WARSHIP_NAVAL_GUN",
      position: { x: 0, y: 0 },
      speedCellsPerSecond: 75,
      damage: { numerator: 100n, denominator: 1n },
      createdTick: 0,
    });
    state = createProspectiveMatchState(state, {
      combatProjectiles: [oldShot],
    });

    const advanced = new TickEngine().advance(state, []);

    expect(
      advanced.mobileUnits.find((unit) => unit.id === target.unit.id)?.cellId,
    ).toBe(30);
    const movedShot = advanced.combatProjectiles.find(
      (projectile) => projectile.sourceUnitId === "old-source",
    );
    expect(movedShot).toBeDefined();
    expect(movedShot?.createdTick).toBe(0);
    expect(movedShot?.position.x).toBeGreaterThan(7);
    expect(movedShot?.position.y).toBeGreaterThan(0);
  });

  it("admits a Warship shot from the frozen post-movement snapshot before an older projectile destroys that source later in the tick", () => {
    let state = fixture(20);
    const alpha = addWarship(state, {
      ownerId: "alpha",
      cellId: 0,
      health: 250n,
    });
    state = alpha.state;
    const beta = addWarship(state, {
      ownerId: "beta",
      cellId: 10,
    });
    state = beta.state;

    const oldShot = createHomingCombatProjectile({
      sourceUnitId: "older-beta-shot",
      sourceOwnerId: "beta",
      targetUnitId: alpha.unit.id,
      projectileOrdinal: 7,
      profileId: "WARSHIP_NAVAL_GUN",
      position: { x: 7, y: 0 },
      speedCellsPerSecond: 75,
      damage: { numerator: 250n, denominator: 1n },
      createdTick: 0,
    });
    state = createProspectiveMatchState(state, {
      combatProjectiles: [oldShot],
    });

    const advanced = new TickEngine().advance(state, []);

    expect(
      advanced.mobileUnits.some((unit) => unit.id === alpha.unit.id),
    ).toBe(false);
    expect(
      advanced.warshipOperationalStates.some(
        (operational) => operational.unitId === alpha.unit.id,
      ),
    ).toBe(false);
    expect(
      advanced.combatProjectiles.some(
        (projectile) =>
          projectile.sourceUnitId === "older-beta-shot" &&
          projectile.projectileOrdinal === 7,
      ),
    ).toBe(false);

    const admittedShot = advanced.combatProjectiles.find(
      (projectile) =>
        projectile.sourceUnitId === alpha.unit.id &&
        projectile.projectileOrdinal === 0,
    );
    expect(admittedShot).toMatchObject({
      sourceUnitId: alpha.unit.id,
      sourceOwnerId: "alpha",
      targetUnitId: beta.unit.id,
      projectileOrdinal: 0,
      profileId: "WARSHIP_NAVAL_GUN",
      position: { x: 0, y: 0 },
      createdTick: 1,
    });
  });
});
