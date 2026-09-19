import { describe, expect, it } from "vitest";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createPopulationState } from "../src/simulation/Population";
import * as Transports from "../src/simulation/Transports";
import {
  applySuccessfulTransportLandingConsequences,
  resolveTransportEndpointRoute,
  tryMaterializeTransportAtResolvedRoute,
} from "../src/simulation/Transports";

function rules(traitIds: readonly string[] = []) {
  return compileRuleProfile(
    RULE_AXIS_REGISTRY,
    originRuleProfileInput(traitIds),
  );
}

function fixture(
  seed: string,
  betaTraits: readonly string[] = [],
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 5,
      height: 3,
      terrain: [
        "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
        "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER",
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
      ],
    }),
  );
}

function commitTransportPopulation(
  state: MatchState,
  ownerId: string,
  amount: number,
): MatchState {
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === ownerId
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

function resolvedRoute(state: MatchState) {
  const resolved = resolveTransportEndpointRoute(state.map, {
    sourceCellId: 0,
    targetCellId: 14,
    embarkCoastCellIds: [0],
    landingCoastCellIds: [14],
  });
  expect(resolved.status).toBe("FOUND");
  if (resolved.status !== "FOUND") {
    throw new Error("expected Transport endpoint route");
  }
  return resolved.route;
}

function materialize(
  state: MatchState,
  carriedPopulation = 30,
) {
  const committed = commitTransportPopulation(state, "beta", carriedPopulation);
  const result = tryMaterializeTransportAtResolvedRoute(committed, {
    ownerId: "beta",
    route: resolvedRoute(committed),
    carriedPopulation,
  } as never);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected Transport materialization");
  return result;
}

type DamageResolution = Readonly<{
  state: MatchState;
  destructionResult: Readonly<{
    transportId: string;
    previousOwnerFactionId: string;
    destructionTick: number;
    carriedPopulationAtDestruction: number;
    creditedDestroyerFactionId?: string;
    causeClass:
      | "NAVAL_GUNFIRE"
      | "SAM_ANTI_SHIP"
      | "STRATEGIC_BLAST"
      | "OTHER_HOSTILE_EFFECT"
      | "UNATTRIBUTED";
  }> | null;
}>;

function applyDamage(
  state: MatchState,
  transportId: string,
  amount = 250n,
): DamageResolution {
  const fn = (Transports as unknown as {
    applyTransportDamage?: (
      current: MatchState,
      input: Readonly<{
        transportId: string;
        damage: Readonly<{ numerator: bigint; denominator: bigint }>;
        causeClass: "NAVAL_GUNFIRE";
        creditedDestroyerFactionId: string;
      }>,
    ) => DamageResolution;
  }).applyTransportDamage;
  if (fn === undefined) {
    throw new TypeError("applyTransportDamage is not implemented");
  }
  return fn(state, {
    transportId,
    damage: Object.freeze({ numerator: amount, denominator: 1n }),
    causeClass: "NAVAL_GUNFIRE",
    creditedDestroyerFactionId: "alpha",
  });
}

function transportRuntime(state: MatchState, unitId: string) {
  return (
    state as MatchState & {
      readonly transportOperationalStates?: readonly Readonly<{
        unitId: string;
        carriedPopulation: number;
        health?: Readonly<{ numerator: bigint; denominator: bigint }>;
      }>[];
    }
  ).transportOperationalStates?.find((entry) => entry.unitId === unitId);
}

function destructionResults(state: MatchState) {
  return (
    state as MatchState & {
      readonly transportDestructionResults?: readonly unknown[];
    }
  ).transportDestructionResults;
}

describe("Transport operational payload and destruction runtime", () => {
  it("binds already-committed carried Population to the physical Transport and canonical serialization", () => {
    const result = materialize(fixture("transport-payload-state-red"), 30);
    expect(transportRuntime(result.state, result.unit.id)).toEqual({
      unitId: result.unit.id,
      carriedPopulation: 30,
    });

    const serialized = JSON.parse(canonicalMatchStateSerialization(result.state));
    expect(serialized.transportOperationalStates).toEqual([
      {
        unitId: result.unit.id,
        carriedPopulation: 30,
      },
    ]);
    expect(serialized.transportDestructionResults).toEqual([]);
  });

  it("materializes only P32 Transports with the canonical 500 HP health pool", () => {
    const baseline = materialize(fixture("transport-baseline-fragile-red"), 20);
    expect(transportRuntime(baseline.state, baseline.unit.id)?.health).toBeUndefined();

    const armored = materialize(
      fixture("transport-p32-health-red", ["P32"]),
      20,
    );
    expect(transportRuntime(armored.state, armored.unit.id)?.health).toEqual({
      numerator: 500n,
      denominator: 1n,
    });
  });

  it("destroys an ordinary fragile Transport on one damage effect and freezes the canonical result while removing its aboard Population exactly once", () => {
    const materialized = materialize(
      fixture("transport-fragile-destruction-red"),
      30,
    );
    const resolved = applyDamage(
      materialized.state,
      materialized.unit.id,
    );

    expect(resolved.destructionResult).toEqual({
      transportId: materialized.unit.id,
      previousOwnerFactionId: "beta",
      destructionTick: materialized.state.tick,
      carriedPopulationAtDestruction: 30,
      creditedDestroyerFactionId: "alpha",
      causeClass: "NAVAL_GUNFIRE",
    });
    expect(
      resolved.state.mobileUnits.some((unit) => unit.id === materialized.unit.id),
    ).toBe(false);
    expect(transportRuntime(resolved.state, materialized.unit.id)).toBeUndefined();
    expect(destructionResults(resolved.state)).toEqual([
      resolved.destructionResult,
    ]);
    expect(
      resolved.state.factions.find((faction) => faction.id === "beta")?.population,
    ).toMatchObject({
      total: 0,
      aboardTransports: 0,
    });

    const serialized = JSON.parse(
      canonicalMatchStateSerialization(resolved.state),
    );
    expect(serialized.transportDestructionResults).toEqual([
      resolved.destructionResult,
    ]);
  });

  it("applies damage through P32 health and destroys only on the first lethal transition", () => {
    const materialized = materialize(
      fixture("transport-p32-damage-red", ["P32"]),
      40,
    );

    const first = applyDamage(materialized.state, materialized.unit.id);
    expect(first.destructionResult).toBeNull();
    expect(transportRuntime(first.state, materialized.unit.id)?.health).toEqual({
      numerator: 250n,
      denominator: 1n,
    });
    expect(
      first.state.factions.find((faction) => faction.id === "beta")?.population,
    ).toMatchObject({
      total: 40,
      aboardTransports: 40,
    });

    const second = applyDamage(first.state, materialized.unit.id);
    expect(second.destructionResult).toEqual({
      transportId: materialized.unit.id,
      previousOwnerFactionId: "beta",
      destructionTick: materialized.state.tick,
      carriedPopulationAtDestruction: 40,
      creditedDestroyerFactionId: "alpha",
      causeClass: "NAVAL_GUNFIRE",
    });
    expect(
      second.state.factions.find((faction) => faction.id === "beta")?.population,
    ).toMatchObject({
      total: 0,
      aboardTransports: 0,
    });
  });

  it("does not create another result or debit Population when a later effect observes the already-destroyed Transport", () => {
    const materialized = materialize(
      fixture("transport-destroyed-exactly-once-red"),
      25,
    );
    const first = applyDamage(materialized.state, materialized.unit.id);
    const repeated = applyDamage(first.state, materialized.unit.id);

    expect(repeated.state).toBe(first.state);
    expect(repeated.destructionResult).toBeNull();
    expect(destructionResults(repeated.state)).toEqual([
      first.destructionResult,
    ]);
    expect(
      repeated.state.factions.find((faction) => faction.id === "beta")?.population,
    ).toMatchObject({
      total: 0,
      aboardTransports: 0,
    });
  });

  it("cleans per-vessel operational state on successful landing without fabricating a Transport destruction result", () => {
    const materialized = materialize(
      fixture("transport-landing-not-destruction-red"),
      15,
    );
    const landed = applySuccessfulTransportLandingConsequences(
      materialized.state,
      {
        transportId: materialized.unit.id,
        fortStructureId: "unused-fort-id",
      },
    );

    expect(landed.status).toBe("LANDED");
    expect(
      landed.state.mobileUnits.some((unit) => unit.id === materialized.unit.id),
    ).toBe(false);
    expect(transportRuntime(landed.state, materialized.unit.id)).toBeUndefined();
    expect(destructionResults(landed.state)).toEqual([]);
  });
});
