import { describe, expect, it } from "vitest";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import type { HomingCombatProjectileImpact } from "../src/simulation/CombatProjectiles";
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
import {
  resolveWarshipProjectileImpacts,
} from "../src/simulation/WarshipCombat";
import { resolveDirectRevealsFromPhysicalEvents } from "../src/simulation/VisibilityState";

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([]));
}

function fixture(): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-projectile-impact-red",
      width: 8,
      height: 1,
      terrain: Array.from({ length: 8 }, () => "DEEP_WATER" as const),
      initialOwners: Array.from({ length: 8 }, () => null),
      factions: [
        { id: "alpha", rules: rules() },
        { id: "beta", rules: rules() },
        { id: "gamma", rules: rules() },
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
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
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
                rank: 1,
                navalXp: 0,
                operatingAnchorCellId: created.unit.cellId,
                attackReadyAtTick: state.tick,
                nextProjectileOrdinal: 0,
                roamingOrdinal: 0,
              },
            ]
          : state.warshipOperationalStates,
    }),
  });
}

function impact(
  sourceUnitId: string,
  sourceOwnerId: string,
  targetUnitId: string,
  projectileOrdinal: number,
  damage = 250n,
): HomingCombatProjectileImpact {
  return Object.freeze({
    sourceUnitId,
    sourceOwnerId,
    targetUnitId,
    projectileOrdinal,
    profileId: "WARSHIP_NAVAL_GUN",
    damage: Object.freeze({ numerator: damage, denominator: 1n }),
  });
}

function health(state: MatchState, unitId: string) {
  return state.warshipOperationalStates.find((entry) => entry.unitId === unitId)
    ?.health;
}

describe("Warship projectile impact resolution", () => {
  it("applies exact nonlethal projectile damage only at impact", () => {
    let state = fixture();
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 1,
    });
    state = target.state;

    const resolved = resolveWarshipProjectileImpacts(state, [
      impact(source.unit.id, "alpha", target.unit.id, 0),
    ]);

    expect(health(resolved.state, target.unit.id)).toEqual({
      numerator: 750n,
      denominator: 1n,
    });
    expect(
      resolved.state.mobileUnits.some((unit) => unit.id === target.unit.id),
    ).toBe(true);
    expect(resolved.unresolvedImpacts).toEqual([]);
    expect(resolved.events.map((event) => event.kind)).toEqual([
      "PROJECTILE_IMPACT_RESOLVED",
    ]);
  });

  it("destroys a Warship when impact leaves zero HP and freezes projectile-native credit", () => {
    let state = fixture();
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 1,
      health: 250n,
    });
    state = target.state;

    const resolved = resolveWarshipProjectileImpacts(state, [
      impact("destroyed-source-warship", "alpha", target.unit.id, 7),
    ]);

    expect(
      resolved.state.mobileUnits.some((unit) => unit.id === target.unit.id),
    ).toBe(false);
    expect(health(resolved.state, target.unit.id)).toBeUndefined();
    expect(resolved.events.map((event) => event.kind)).toEqual([
      "PROJECTILE_IMPACT_RESOLVED",
      "UNIT_DESTROYED",
    ]);

    const destroyed = resolved.events.find(
      (event) => event.kind === "UNIT_DESTROYED",
    );
    expect(destroyed?.payload).toMatchObject({
      unit: {
        unitId: target.unit.id,
        ownerId: "beta",
        unitType: "WARSHIP",
        cellId: 1,
      },
      causes: [
        {
          kind: "PROJECTILE_IMPACT",
          projectile: {
            sourceUnitId: "destroyed-source-warship",
            sourceOwnerId: "alpha",
            projectileOrdinal: 7,
            profileId: "WARSHIP_NAVAL_GUN",
          },
        },
      ],
    });
  });

  it("orders same-tick impacts by stable projectile identity and credits the first lethal transition only", () => {
    let state = fixture();
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 2,
      health: 400n,
    });
    state = target.state;

    const impacts = [
      impact("source-c", "gamma", target.unit.id, 0),
      impact("source-b", "gamma", target.unit.id, 0),
      impact("source-a", "alpha", target.unit.id, 1),
    ] as const;
    const forward = resolveWarshipProjectileImpacts(state, impacts);
    const reversed = resolveWarshipProjectileImpacts(state, [...impacts].reverse());

    expect(reversed).toEqual(forward);
    expect(
      forward.events.filter(
        (event) => event.kind === "PROJECTILE_IMPACT_RESOLVED",
      ),
    ).toHaveLength(2);
    const destroyed = forward.events.find(
      (event) => event.kind === "UNIT_DESTROYED",
    );
    expect(destroyed?.payload.causes).toMatchObject([
      {
        kind: "PROJECTILE_IMPACT",
        projectile: {
          sourceUnitId: "source-b",
          sourceOwnerId: "gamma",
          projectileOrdinal: 0,
          profileId: "WARSHIP_NAVAL_GUN",
        },
      },
    ]);
    expect(
      forward.events.some(
        (event) =>
          event.kind === "PROJECTILE_IMPACT_RESOLVED" &&
          event.payload.projectile.sourceUnitId === "source-c",
      ),
    ).toBe(false);
  });

  it("credits an in-flight projectile after its source Warship has already been removed without creating a reveal ghost", () => {
    let state = fixture();
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 1,
      health: 250n,
    });
    state = target.state;

    const resolved = resolveWarshipProjectileImpacts(state, [
      impact("already-destroyed-source", "alpha", target.unit.id, 3),
    ]);
    expect(
      resolveDirectRevealsFromPhysicalEvents(
        resolved.state,
        resolved.events,
        state.tick,
      ),
    ).toEqual([]);
    const destroyed = resolved.events.find(
      (event) => event.kind === "UNIT_DESTROYED",
    );
    expect(destroyed?.payload.causes).toMatchObject([
      {
        kind: "PROJECTILE_IMPACT",
        projectile: {
          sourceUnitId: "already-destroyed-source",
          sourceOwnerId: "alpha",
        },
      },
    ]);
  });

  it("refreshes direct reveal for a still-existing projectile source only when impact resolves", () => {
    let state = fixture();
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 1,
    });
    state = target.state;

    const resolved = resolveWarshipProjectileImpacts(state, [
      impact(source.unit.id, "alpha", target.unit.id, 0),
    ]);
    expect(
      resolveDirectRevealsFromPhysicalEvents(
        resolved.state,
        resolved.events,
        state.tick,
      ),
    ).toEqual([
      {
        viewerFactionId: "beta",
        sourceKind: "UNIT",
        sourceId: source.unit.id,
        expiryExclusiveTick: 150,
      },
    ]);
  });

  it("leaves live Transport impacts unresolved for the Transport destruction owner", () => {
    let state = fixture();
    const transport = addNavalUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 2,
    });
    state = transport.state;
    const arriving = impact("source-warship", "alpha", transport.unit.id, 4);

    const resolved = resolveWarshipProjectileImpacts(state, [arriving]);
    expect(resolved.state).toBe(state);
    expect(resolved.events).toEqual([]);
    expect(resolved.unresolvedImpacts).toEqual([arriving]);
  });
});
