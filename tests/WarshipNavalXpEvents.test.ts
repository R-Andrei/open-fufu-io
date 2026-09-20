import { describe, expect, it } from "vitest";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import type { HomingCombatProjectileImpact } from "../src/simulation/CombatProjectiles";
import {
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { tryLaunchTradeVoyage } from "../src/simulation/TradeShips";
import {
  resolveWarshipNavalProjectileImpacts,
  resolveWarshipTradeShipCaptureDecisions,
} from "../src/simulation/WarshipCombat";

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([]));
}

function navalFixture(
  fixedTeams = false,
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: fixedTeams
        ? "warship-xp-allied-red"
        : "warship-xp-combat-red",
      width: 8,
      height: 1,
      terrain: Array.from({ length: 8 }, () => "DEEP_WATER" as const),
      initialOwners: Array.from({ length: 8 }, () => null),
      factions: [
        {
          id: "alpha",
          ...(fixedTeams ? { fixedTeamId: "team-one" } : {}),
          rules: rules(),
        },
        {
          id: "beta",
          ...(fixedTeams ? { fixedTeamId: "team-one" } : {}),
          rules: rules(),
        },
      ],
    }),
  );
}

function addWarship(
  state: MatchState,
  ownerId: string,
  cellId: number,
  health = 1_000n,
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
  return Object.freeze({
    unitId: created.unit.id,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        ...state.warshipOperationalStates,
        Object.freeze({
          unitId: created.unit.id,
          health: Object.freeze({ numerator: health, denominator: 1n }),
          rank: 1,
          navalXp: 0,
          operatingAnchorCellId: cellId,
          attackReadyAtTick: state.tick,
          nextProjectileOrdinal: 0,
          roamingOrdinal: 0,
        }),
      ],
    }),
  });
}

function addTransport(
  state: MatchState,
  ownerId: string,
  cellId: number,
): Readonly<{ state: MatchState; unitId: string }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId,
      type: "TRANSPORT_SHIP",
      movementClass: "TRANSPORT",
      cellId,
    },
  );
  return Object.freeze({
    unitId: created.unit.id,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      transportOperationalStates: [
        ...state.transportOperationalStates,
        Object.freeze({
          unitId: created.unit.id,
          carriedPopulation: 0,
        }),
      ],
    }),
  });
}

function impact(
  sourceUnitId: string,
  sourceOwnerId: string,
  targetUnitId: string,
  projectileOrdinal: number,
): HomingCombatProjectileImpact {
  return Object.freeze({
    sourceUnitId,
    sourceOwnerId,
    targetUnitId,
    projectileOrdinal,
    profileId: "WARSHIP_NAVAL_GUN",
    damage: Object.freeze({ numerator: 250n, denominator: 1n }),
  });
}

function progression(state: MatchState, unitId: string) {
  const operational = state.warshipOperationalStates.find(
    (entry) => entry.unitId === unitId,
  );
  return operational === undefined
    ? undefined
    : Object.freeze({
        rank: operational.rank,
        navalXp: operational.navalXp,
        health: operational.health,
      });
}

function captureFixture(): MatchState {
  const width = 31;
  const terrain = [
    ...Array.from({ length: width }, () => "DEEP_WATER" as const),
    ...Array.from({ length: width }, () => "PLAINS" as const),
  ];
  const ownership = Array.from(
    { length: width * 2 },
    () => null as string | null,
  );
  ownership[31] = "alpha";
  ownership[51] = "beta";
  ownership[61] = "gamma";
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-xp-capture-red",
      width,
      height: 2,
      terrain,
      initialOwners: ownership,
      factions: [
        { id: "alpha", rules: rules() },
        { id: "beta", rules: rules() },
        { id: "gamma", rules: rules() },
      ],
    }),
  );
  return createProspectiveMatchState(base, {
    structures: [
      {
        id: "port-alpha",
        ownerId: "alpha",
        type: "PORT",
        cellId: 31,
        outputCellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
      {
        id: "port-beta",
        ownerId: "beta",
        type: "PORT",
        cellId: 51,
        outputCellId: 20,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
      {
        id: "port-gamma",
        ownerId: "gamma",
        type: "PORT",
        cellId: 61,
        outputCellId: 30,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
  });
}

describe("Warship Naval XP authoritative occurrence integration", () => {
  it("awards 100 XP exactly once for a hostile Warship destruction", () => {
    const source = addWarship(navalFixture(), "alpha", 0);
    const target = addWarship(source.state, "beta", 1, 250n);
    const arriving = impact(source.unitId, "alpha", target.unitId, 0);

    const first = resolveWarshipNavalProjectileImpacts(target.state, [arriving]);
    expect(first.unresolvedImpacts).toEqual([]);
    expect(progression(first.state, source.unitId)).toMatchObject({
      rank: 2,
      navalXp: 0,
    });

    const repeated = resolveWarshipNavalProjectileImpacts(first.state, [arriving]);
    expect(progression(repeated.state, source.unitId)).toEqual(
      progression(first.state, source.unitId),
    );
  });

  it("awards 10 XP for hostile Transport destruction and is independent of impact container order", () => {
    const build = () => {
      const source = addWarship(navalFixture(), "alpha", 0);
      const warship = addWarship(source.state, "beta", 1, 250n);
      const transport = addTransport(warship.state, "beta", 2);
      return { source, warship, transport };
    };

    const left = build();
    const leftResolved = resolveWarshipNavalProjectileImpacts(
      left.transport.state,
      [
        impact(left.source.unitId, "alpha", left.transport.unitId, 1),
        impact(left.source.unitId, "alpha", left.warship.unitId, 0),
      ],
    );

    const right = build();
    const rightResolved = resolveWarshipNavalProjectileImpacts(
      right.transport.state,
      [
        impact(right.source.unitId, "alpha", right.warship.unitId, 0),
        impact(right.source.unitId, "alpha", right.transport.unitId, 1),
      ].reverse(),
    );

    expect(progression(leftResolved.state, left.source.unitId)).toMatchObject({
      rank: 2,
      navalXp: 10,
    });
    expect(progression(rightResolved.state, right.source.unitId)).toEqual(
      progression(leftResolved.state, left.source.unitId),
    );

    const repeated = resolveWarshipNavalProjectileImpacts(leftResolved.state, [
      impact(left.source.unitId, "alpha", left.transport.unitId, 1),
    ]);
    expect(progression(repeated.state, left.source.unitId)).toEqual(
      progression(leftResolved.state, left.source.unitId),
    );
  });

  it("does not award Naval XP for a non-hostile allied destruction", () => {
    const source = addWarship(navalFixture(true), "alpha", 0);
    const target = addWarship(source.state, "beta", 1, 250n);

    const resolved = resolveWarshipNavalProjectileImpacts(target.state, [
      impact(source.unitId, "alpha", target.unitId, 0),
    ]);

    expect(progression(resolved.state, source.unitId)).toMatchObject({
      rank: 1,
      navalXp: 0,
    });
  });

  it("awards 4 XP for every successful hostile Trade Ship capture without duplicate reprocessing", () => {
    const launched = tryLaunchTradeVoyage(captureFixture(), {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-gamma",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade Ship launch");

    const beta = addWarship(launched.state, "beta", 5);
    const first = resolveWarshipTradeShipCaptureDecisions(beta.state);
    expect(progression(first, beta.unitId)).toMatchObject({
      rank: 1,
      navalXp: 4,
    });

    const repeated = resolveWarshipTradeShipCaptureDecisions(first);
    expect(progression(repeated, beta.unitId)).toEqual(
      progression(first, beta.unitId),
    );

    const nextTick = createAdvancedMatchState(repeated, {
      mobileUnits: repeated.mobileUnits.filter(
        (unit) => unit.id !== beta.unitId,
      ),
      warshipOperationalStates: repeated.warshipOperationalStates.filter(
        (operational) => operational.unitId !== beta.unitId,
      ),
    });
    const gamma = addWarship(nextTick, "gamma", 4);
    const recaptured = resolveWarshipTradeShipCaptureDecisions(gamma.state);
    expect(progression(recaptured, gamma.unitId)).toMatchObject({
      rank: 1,
      navalXp: 4,
    });
  });
});
