import { describe, expect, it } from "vitest";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  advanceHomingCombatProjectiles,
  createHomingCombatProjectile,
} from "../src/simulation/CombatProjectiles";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function baselineRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([]));
}

function projectile(
  sourceUnitId: string,
  projectileOrdinal: number,
  targetUnitId = "target",
) {
  return createHomingCombatProjectile({
    sourceUnitId,
    sourceOwnerId: "alpha",
    targetUnitId,
    projectileOrdinal,
    profileId: "WARSHIP_NAVAL_GUN",
    position: { x: 0, y: 0 },
    speedCellsPerSecond: 75,
    damage: { numerator: 250n, denominator: 1n },
    createdTick: 0,
  });
}

describe("generic target-bound homing combat projectiles", () => {
  it("binds stable source/target/profile/damage state and serializes it canonically", () => {
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "projectile-state",
        width: 2,
        height: 1,
        terrain: ["DEEP_WATER", "DEEP_WATER"],
        factions: [
          { id: "alpha", rules: baselineRules() },
          { id: "beta", rules: baselineRules() },
        ],
      }),
    );
    const shot = projectile("unit:000000000000000001", 7, "unit:000000000000000002");
    const withProjectile = createProspectiveMatchState(state, {
      combatProjectiles: [shot],
    });

    expect(withProjectile.combatProjectiles).toEqual([shot]);
    expect(JSON.parse(canonicalMatchStateSerialization(withProjectile)).combatProjectiles).toEqual([
      {
        sourceUnitId: "unit:000000000000000001",
        sourceOwnerId: "alpha",
        targetUnitId: "unit:000000000000000002",
        projectileOrdinal: 7,
        profileId: "WARSHIP_NAVAL_GUN",
        position: { x: 0, y: 0 },
        speedCellsPerSecond: 75,
        damage: { numerator: "250", denominator: "1" },
        createdTick: 0,
      },
    ]);
  });

  it("does not move on its creation tick and then travels at 75 cells/s on the 10 Hz lattice", () => {
    const shot = projectile("source", 0);

    const creationTick = advanceHomingCombatProjectiles([shot], {
      tick: 0,
      ticksPerSecond: 10,
      targetPosition: (unitId) =>
        unitId === "target" ? { x: 15, y: 0 } : undefined,
    });
    expect(creationTick.projectiles).toEqual([shot]);
    expect(creationTick.impacts).toEqual([]);

    const firstTravelTick = advanceHomingCombatProjectiles(creationTick.projectiles, {
      tick: 1,
      ticksPerSecond: 10,
      targetPosition: (unitId) =>
        unitId === "target" ? { x: 15, y: 0 } : undefined,
    });
    expect(firstTravelTick.impacts).toEqual([]);
    expect(firstTravelTick.projectiles[0]?.position).toEqual({ x: 7.5, y: 0 });

    const impactTick = advanceHomingCombatProjectiles(firstTravelTick.projectiles, {
      tick: 2,
      ticksPerSecond: 10,
      targetPosition: (unitId) =>
        unitId === "target" ? { x: 15, y: 0 } : undefined,
    });
    expect(impactTick.projectiles).toEqual([]);
    expect(impactTick.impacts).toHaveLength(1);
    expect(impactTick.impacts[0]?.targetUnitId).toBe("target");
  });

  it("homes toward the designated target's current position instead of retaining a launch trajectory", () => {
    const shot = projectile("source", 0);
    const first = advanceHomingCombatProjectiles([shot], {
      tick: 1,
      ticksPerSecond: 10,
      targetPosition: () => ({ x: 15, y: 0 }),
    });
    expect(first.projectiles[0]?.position).toEqual({ x: 7.5, y: 0 });

    const turned = advanceHomingCombatProjectiles(first.projectiles, {
      tick: 2,
      ticksPerSecond: 10,
      targetPosition: () => ({ x: 7.5, y: 15 }),
    });
    expect(turned.projectiles[0]?.position).toEqual({ x: 7.5, y: 7.5 });
  });

  it("removes a projectile harmlessly when its designated target no longer exists", () => {
    const resolved = advanceHomingCombatProjectiles([projectile("source", 0)], {
      tick: 1,
      ticksPerSecond: 10,
      targetPosition: () => undefined,
    });
    expect(resolved.projectiles).toEqual([]);
    expect(resolved.impacts).toEqual([]);
  });

  it("does not depend on the firing source remaining alive after launch", () => {
    const resolved = advanceHomingCombatProjectiles([projectile("destroyed-source", 0)], {
      tick: 1,
      ticksPerSecond: 10,
      targetPosition: () => ({ x: 15, y: 0 }),
    });
    expect(resolved.projectiles[0]?.position).toEqual({ x: 7.5, y: 0 });
  });

  it("resolves same-tick impacts by stable source identity then projectile ordinal", () => {
    const shots = [
      projectile("source-b", 0, "target-b"),
      projectile("source-a", 2, "target-a2"),
      projectile("source-a", 1, "target-a1"),
    ].map((shot) =>
      createHomingCombatProjectile({
        ...shot,
        position: { x: 0, y: 0 },
        createdTick: 0,
      }),
    );

    const resolved = advanceHomingCombatProjectiles(shots, {
      tick: 1,
      ticksPerSecond: 10,
      targetPosition: () => ({ x: 1, y: 0 }),
    });
    expect(
      resolved.impacts.map((impact) => [
        impact.sourceUnitId,
        impact.projectileOrdinal,
        impact.targetUnitId,
      ]),
    ).toEqual([
      ["source-a", 1, "target-a1"],
      ["source-a", 2, "target-a2"],
      ["source-b", 0, "target-b"],
    ]);
  });
});
