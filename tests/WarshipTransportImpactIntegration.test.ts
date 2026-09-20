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
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { createPopulationState } from "../src/simulation/Population";
import {
  resolveTransportEndpointRoute,
  tryMaterializeTransportAtResolvedRoute,
} from "../src/simulation/Transports";
import * as WarshipCombat from "../src/simulation/WarshipCombat";

function rules(traits: readonly string[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function fixture(seed: string, betaTraits: readonly string[] = []): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 5,
      height: 3,
      terrain: [
        "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
        "SHALLOW_WATER", "DEEP_WATER", "DEEP_WATER", "DEEP_WATER", "SHALLOW_WATER",
        "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
      ],
      initialOwners: [
        "beta", "beta", "beta", "beta", "beta",
        null, null, null, null, null,
        "beta", "beta", "beta", "beta", "beta",
      ],
      factions: [
        { id: "alpha", rules: rules() },
        { id: "beta", rules: rules(betaTraits) },
        { id: "gamma", rules: rules() },
      ],
    }),
  );
}

function commitTransportPopulation(
  state: MatchState,
  amount: number,
): MatchState {
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === "beta"
        ? Object.freeze({
            ...faction,
            population: createPopulationState({
              total: amount,
              available: 0,
              committedOffensive: 0,
              committedCounterResponse: 0,
              aboardTransports: amount,
              peakTotal: amount,
              neutralSettlementHalfResidual: 0,
            }),
          })
        : faction,
    ),
  });
}

function addTransport(
  state: MatchState,
  carriedPopulation: number,
): Readonly<{ state: MatchState; unitId: string }> {
  const committed = commitTransportPopulation(state, carriedPopulation);
  const route = resolveTransportEndpointRoute(committed.map, {
    sourceCellId: 0,
    targetCellId: 14,
    embarkCoastCellIds: [0],
    landingCoastCellIds: [14],
  });
  expect(route.status).toBe("FOUND");
  if (route.status !== "FOUND") throw new Error("expected Transport route");
  const materialized = tryMaterializeTransportAtResolvedRoute(committed, {
    ownerId: "beta",
    route: route.route,
    carriedPopulation,
  });
  expect(materialized.ok).toBe(true);
  if (!materialized.ok) throw new Error("expected Transport materialization");
  return Object.freeze({
    state: materialized.state,
    unitId: materialized.unit.id,
  });
}

function addWarship(
  state: MatchState,
  ownerId: string,
  cellId: number,
  health = 250n,
): Readonly<{ state: MatchState; unitId: string }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId,
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId,
    },
  );
  const next = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    warshipOperationalStates: [
      ...state.warshipOperationalStates,
      {
        unitId: created.unit.id,
        health: { numerator: health, denominator: 1n },
        operatingAnchorCellId: cellId,
        attackReadyAtTick: state.tick,
        nextProjectileOrdinal: 0,
        roamingOrdinal: 0,
      },
    ],
  });
  return Object.freeze({ state: next, unitId: created.unit.id });
}

function impact(
  sourceUnitId: string,
  sourceOwnerId: string,
  targetUnitId: string,
  projectileOrdinal: number,
  profileId = "WARSHIP_NAVAL_GUN",
): HomingCombatProjectileImpact {
  return Object.freeze({
    sourceUnitId,
    sourceOwnerId,
    targetUnitId,
    projectileOrdinal,
    profileId,
    damage: Object.freeze({ numerator: 250n, denominator: 1n }),
  });
}

type Resolution = Readonly<{
  state: MatchState;
  events: readonly Readonly<{
    kind: string;
    payload: any;
  }>[];
  unresolvedImpacts: readonly HomingCombatProjectileImpact[];
}>;

function resolve(
  state: MatchState,
  impacts: readonly HomingCombatProjectileImpact[],
): Resolution {
  const fn = (WarshipCombat as unknown as {
    resolveWarshipNavalProjectileImpacts?: (
      current: MatchState,
      arriving: readonly HomingCombatProjectileImpact[],
    ) => Resolution;
  }).resolveWarshipNavalProjectileImpacts;
  if (fn === undefined) {
    throw new TypeError("resolveWarshipNavalProjectileImpacts is not implemented");
  }
  return fn(state, impacts);
}

describe("Warship naval projectile impact integration", () => {
  it("consumes a baseline Transport impact as physical impact plus exactly one NAVAL_GUNFIRE destruction", () => {
    const target = addTransport(
      fixture("warship-transport-fragile-impact-red"),
      30,
    );
    const arriving = impact("alpha-warship", "alpha", target.unitId, 4);

    const resolved = resolve(target.state, [arriving]);

    expect(resolved.unresolvedImpacts).toEqual([]);
    expect(resolved.events.map((event) => event.kind)).toEqual([
      "PROJECTILE_IMPACT_RESOLVED",
      "UNIT_DESTROYED",
    ]);
    expect(resolved.events[0]?.payload).toMatchObject({
      projectile: {
        sourceUnitId: "alpha-warship",
        sourceOwnerId: "alpha",
        projectileOrdinal: 4,
        profileId: "WARSHIP_NAVAL_GUN",
      },
      target: {
        unitId: target.unitId,
        ownerId: "beta",
        unitType: "TRANSPORT_SHIP",
      },
    });
    expect(resolved.events[1]?.payload).toMatchObject({
      unit: {
        unitId: target.unitId,
        ownerId: "beta",
        unitType: "TRANSPORT_SHIP",
      },
      causes: [
        {
          kind: "PROJECTILE_IMPACT",
          projectile: {
            sourceUnitId: "alpha-warship",
            sourceOwnerId: "alpha",
            projectileOrdinal: 4,
          },
        },
      ],
    });
    expect(resolved.state.transportDestructionResults).toEqual([
      {
        transportId: target.unitId,
        previousOwnerFactionId: "beta",
        destructionTick: target.state.tick,
        carriedPopulationAtDestruction: 30,
        creditedDestroyerFactionId: "alpha",
        causeClass: "NAVAL_GUNFIRE",
      },
    ]);
  });

  it("applies ordered impacts through P32 health and credits the first projectile that becomes lethal", () => {
    const target = addTransport(
      fixture("warship-transport-p32-impact-red", ["P32"]),
      40,
    );
    const impacts = [
      impact("source-b", "gamma", target.unitId, 0),
      impact("source-a", "alpha", target.unitId, 1),
    ] as const;

    const resolved = resolve(target.state, impacts);

    expect(resolved.events.map((event) => event.kind)).toEqual([
      "PROJECTILE_IMPACT_RESOLVED",
      "PROJECTILE_IMPACT_RESOLVED",
      "UNIT_DESTROYED",
    ]);
    expect(
      resolved.events
        .filter((event) => event.kind === "PROJECTILE_IMPACT_RESOLVED")
        .map((event) => event.payload.projectile.sourceUnitId),
    ).toEqual(["source-a", "source-b"]);
    expect(resolved.state.transportDestructionResults).toEqual([
      expect.objectContaining({
        transportId: target.unitId,
        creditedDestroyerFactionId: "gamma",
        causeClass: "NAVAL_GUNFIRE",
      }),
    ]);
  });

  it("suppresses later same-tick projectiles once a fragile Transport is already destroyed", () => {
    const target = addTransport(
      fixture("warship-transport-first-lethal-red"),
      25,
    );
    const resolved = resolve(target.state, [
      impact("source-b", "gamma", target.unitId, 0),
      impact("source-a", "alpha", target.unitId, 0),
    ]);

    expect(resolved.events.map((event) => event.kind)).toEqual([
      "PROJECTILE_IMPACT_RESOLVED",
      "UNIT_DESTROYED",
    ]);
    expect(resolved.state.transportDestructionResults).toEqual([
      expect.objectContaining({
        creditedDestroyerFactionId: "alpha",
      }),
    ]);
  });

  it("preserves global stable projectile ordering across mixed Transport and Warship impacts independent of input order", () => {
    const transport = addTransport(
      fixture("warship-mixed-naval-impact-order-red"),
      10,
    );
    const warship = addWarship(transport.state, "beta", 7, 250n);
    const impacts = [
      impact("source-b", "gamma", warship.unitId, 0),
      impact("source-a", "alpha", transport.unitId, 0),
    ] as const;

    const forward = resolve(warship.state, impacts);
    const reversed = resolve(warship.state, [...impacts].reverse());

    expect(reversed).toEqual(forward);
    expect(
      forward.events
        .filter((event) => event.kind === "PROJECTILE_IMPACT_RESOLVED")
        .map((event) => event.payload.projectile.sourceUnitId),
    ).toEqual(["source-a", "source-b"]);
    expect(
      forward.state.mobileUnits.some((unit) => unit.id === transport.unitId),
    ).toBe(false);
    expect(
      forward.state.mobileUnits.some((unit) => unit.id === warship.unitId),
    ).toBe(false);
  });

  it("leaves non-Warship projectile profiles unresolved for their future generic owner", () => {
    const warship = addWarship(
      fixture("warship-foreign-projectile-profile-red"),
      "beta",
      7,
      250n,
    );
    const foreign = impact(
      "future-tank",
      "alpha",
      warship.unitId,
      0,
      "TANK_ANTI_ARMOR",
    );

    const resolved = resolve(warship.state, [foreign]);

    expect(resolved.state).toBe(warship.state);
    expect(resolved.events).toEqual([]);
    expect(resolved.unresolvedImpacts).toEqual([foreign]);
  });

});
