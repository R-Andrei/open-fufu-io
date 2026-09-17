import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import {
  resolveTransportEndpointRoute,
  tryMaterializeTransportAtResolvedRoute,
} from "../src/simulation/Transports";

function transportFixture(seed: string) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(createMicroSimulationSpec({
    seed,
    width: 5,
    height: 3,
    terrain: [
      "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
      "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER",
      "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
    ],
    initialOwners: [
      "alpha", "alpha", "alpha", "alpha", "alpha",
      null, null, null, null, null,
      "alpha", "alpha", "alpha", "alpha", "alpha",
    ],
    factions: [{ id: "alpha", rules }],
  }));
}

function resolvedRoute(
  state: ReturnType<typeof transportFixture>,
  embarkCoastCellIds: readonly number[] = [0],
) {
  const resolved = resolveTransportEndpointRoute(state.map, {
    sourceCellId: 0,
    targetCellId: 14,
    embarkCoastCellIds,
    landingCoastCellIds: [14],
  });
  expect(resolved.status).toBe("FOUND");
  if (resolved.status !== "FOUND") {
    throw new Error("expected Transport endpoint route");
  }
  return resolved.route;
}

describe("Transport runtime endpoint materialization", () => {
  it("persists authored strategic target independently from resolved physical endpoints", () => {
    const state = transportFixture("transport-runtime-persisted-endpoints-red");
    const route = resolvedRoute(state);
    expect(route).toMatchObject({
      sourceCellId: 0,
      targetCellId: 14,
      embarkCellId: 5,
      landingCellId: 9,
      path: {
        cells: [5, 6, 7, 8, 9],
        totalWeight: 4,
      },
      objectiveWeight: 6,
    });

    const materialized = tryMaterializeTransportAtResolvedRoute(state, {
      ownerId: "alpha",
      route,
    });
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) throw new Error("expected Transport materialization");
    expect(materialized.unit).toMatchObject({
      ownerId: "alpha",
      type: "TRANSPORT_SHIP",
      movementClass: "TRANSPORT",
      cellId: 5,
      strategicDestinationCellId: 14,
      route: {
        destinationCellId: 9,
        cells: [5, 6, 7, 8, 9],
      },
    });

    const serialized = JSON.parse(
      canonicalMatchStateSerialization(materialized.state),
    ) as {
      readonly mobileUnits: readonly {
        readonly type: string;
        readonly cellId: number;
        readonly strategicDestinationCellId?: number;
        readonly route?: {
          readonly destinationCellId: number;
          readonly cells: readonly number[];
        };
      }[];
    };
    expect(serialized.mobileUnits[0]).toMatchObject({
      type: "TRANSPORT_SHIP",
      cellId: 5,
      strategicDestinationCellId: 14,
      route: {
        destinationCellId: 9,
        cells: [5, 6, 7, 8, 9],
      },
    });
  });

  it("waits on occupied resolved embark and retries the same endpoint without rerouting", () => {
    const state = transportFixture("transport-runtime-blocked-embark-red");
    const route = resolvedRoute(state, [0, 1]);
    expect(route.embarkCellId).toBe(5);

    const blocker = createMobileUnit(
      state.map,
      state.factions.map((faction) => faction.id),
      state,
      {
        ownerId: "alpha",
        type: "TRADE_SHIP",
        movementClass: "NAVAL",
        cellId: 5,
      },
    );
    const blockedState = createProspectiveMatchState(state, {
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
    });

    const rejected = tryMaterializeTransportAtResolvedRoute(blockedState, {
      ownerId: "alpha",
      route,
    });
    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "EMBARK_BLOCKED" },
    });
    expect(rejected.state).toBe(blockedState);
    expect(
      rejected.state.mobileUnits.some((unit) => unit.type === "TRANSPORT_SHIP"),
    ).toBe(false);
    expect(rejected.state.mobileUnits.some((unit) => unit.cellId === 6)).toBe(false);

    const cleared = createProspectiveMatchState(blockedState, { mobileUnits: [] });
    const retried = tryMaterializeTransportAtResolvedRoute(cleared, {
      ownerId: "alpha",
      route,
    });
    expect(retried.ok).toBe(true);
    if (!retried.ok) throw new Error("expected blocked Transport retry to launch");
    expect(retried.unit.cellId).toBe(5);
    expect(retried.unit.strategicDestinationCellId).toBe(14);
    expect(retried.unit.route?.destinationCellId).toBe(9);
  });
});
