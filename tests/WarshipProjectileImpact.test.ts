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
import { createPopulationState } from "../src/simulation/Population";
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
  profileId = "WARSHIP_NAVAL_GUN",
): HomingCombatProjectileImpact {
  return Object.freeze({
    sourceUnitId,
    sourceOwnerId,
    targetUnitId,
    projectileOrdinal,
    profileId,
    damage: Object.freeze({ numerator: damage, denominator: 1n }),
  });
}

function health(state: MatchState, unitId: string) {
  return state.warshipOperationalStates.find((entry) => entry.unitId === unitId)
    ?.health;
}

function addTransportTarget(
  state: MatchState,
  input: Readonly<{
    ownerId: string;
    cellId: number;
    carriedPopulation: number;
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
      type: "TRANSPORT_SHIP",
      movementClass: "TRANSPORT",
      cellId: input.cellId,
    },
  );
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      factions: state.factions.map((faction) =>
        faction.id === input.ownerId
          ? Object.freeze({
              ...faction,
              population: createPopulationState({
                total: input.carriedPopulation,
                available: 0,
                committedOffensive: 0,
                committedCounterResponse: 0,
                aboardTransports: input.carriedPopulation,
                peakTotal: input.carriedPopulation,
                neutralSettlementHalfResidual: 0,
              }),
            })
          : faction,
      ),
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      transportOperationalStates: [
        ...state.transportOperationalStates,
        Object.freeze({
          unitId: created.unit.id,
          carriedPopulation: input.carriedPopulation,
          ...(input.health === undefined
            ? {}
            : {
                health: Object.freeze({
                  numerator: input.health,
                  denominator: 1n,
                }),
              }),
        }),
      ],
    }),
  });
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

  it("destroys an ordinary fragile Transport through the Transport owner and emits canonical projectile facts", () => {
    let state = fixture();
    const source = addNavalUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = source.state;
    const transport = addTransportTarget(state, {
      ownerId: "beta",
      cellId: 2,
      carriedPopulation: 30,
    });
    state = transport.state;

    const resolved = resolveWarshipProjectileImpacts(state, [
      impact(source.unit.id, "alpha", transport.unit.id, 4),
    ]);

    expect(resolved.unresolvedImpacts).toEqual([]);
    expect(resolved.events.map((event) => event.kind)).toEqual([
      "PROJECTILE_IMPACT_RESOLVED",
      "UNIT_DESTROYED",
    ]);
    expect(
      resolved.state.mobileUnits.some((unit) => unit.id === transport.unit.id),
    ).toBe(false);
    expect(resolved.state.transportOperationalStates).toEqual([]);
    expect(resolved.state.transportDestructionResults).toEqual([
      {
        transportId: transport.unit.id,
        previousOwnerFactionId: "beta",
        destructionTick: state.tick,
        carriedPopulationAtDestruction: 30,
        creditedDestroyerFactionId: "alpha",
        causeClass: "NAVAL_GUNFIRE",
      },
    ]);
    expect(
      resolved.state.factions.find((faction) => faction.id === "beta")?.population,
    ).toMatchObject({
      total: 0,
      aboardTransports: 0,
    });
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

    const destroyed = resolved.events.find(
      (event) => event.kind === "UNIT_DESTROYED",
    );
    expect(destroyed?.payload).toMatchObject({
      unit: {
        unitId: transport.unit.id,
        ownerId: "beta",
        unitType: "TRANSPORT_SHIP",
        cellId: 2,
      },
      causes: [
        {
          kind: "PROJECTILE_IMPACT",
          projectile: {
            sourceUnitId: source.unit.id,
            sourceOwnerId: "alpha",
            projectileOrdinal: 4,
            profileId: "WARSHIP_NAVAL_GUN",
          },
        },
      ],
    });
  });

  it("applies ordered Warship-gun impacts through P32 Transport health and credits only the lethal transition", () => {
    let state = fixture();
    const transport = addTransportTarget(state, {
      ownerId: "beta",
      cellId: 2,
      carriedPopulation: 40,
      health: 500n,
    });
    state = transport.state;

    const resolved = resolveWarshipProjectileImpacts(state, [
      impact("source-c", "gamma", transport.unit.id, 0),
      impact("source-b", "alpha", transport.unit.id, 0),
      impact("source-a", "gamma", transport.unit.id, 0),
    ]);

    expect(resolved.unresolvedImpacts).toEqual([]);
    expect(
      resolved.events.filter(
        (event) => event.kind === "PROJECTILE_IMPACT_RESOLVED",
      ),
    ).toHaveLength(2);
    expect(resolved.state.transportDestructionResults).toEqual([
      {
        transportId: transport.unit.id,
        previousOwnerFactionId: "beta",
        destructionTick: state.tick,
        carriedPopulationAtDestruction: 40,
        creditedDestroyerFactionId: "alpha",
        causeClass: "NAVAL_GUNFIRE",
      },
    ]);
    const destroyed = resolved.events.find(
      (event) => event.kind === "UNIT_DESTROYED",
    );
    expect(destroyed?.payload.causes).toMatchObject([
      {
        kind: "PROJECTILE_IMPACT",
        projectile: {
          sourceUnitId: "source-b",
          sourceOwnerId: "alpha",
          projectileOrdinal: 0,
          profileId: "WARSHIP_NAVAL_GUN",
        },
      },
    ]);
    expect(
      resolved.events.some(
        (event) =>
          event.kind === "PROJECTILE_IMPACT_RESOLVED" &&
          event.payload.projectile.sourceUnitId === "source-c",
      ),
    ).toBe(false);
  });

  it("leaves non-Warship projectile profiles unresolved instead of claiming future generic projectile ownership", () => {
    let state = fixture();
    const target = addNavalUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 1,
    });
    state = target.state;
    const foreign = impact(
      "future-tank",
      "alpha",
      target.unit.id,
      0,
      250n,
      "TANK_ANTI_ARMOR",
    );

    const resolved = resolveWarshipProjectileImpacts(state, [foreign]);
    expect(resolved.state).toBe(state);
    expect(resolved.events).toEqual([]);
    expect(resolved.unresolvedImpacts).toEqual([foreign]);
  });
});
