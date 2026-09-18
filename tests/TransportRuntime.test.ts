import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  advanceMobileUnits,
  assignMobileUnitRoute,
  createMobileUnit,
} from "../src/simulation/MobileUnits";
import {
  applySuccessfulTransportLandingConsequences,
  resolveTransportEndpointRoute,
  resolveTransportEndpointRouteForState,
  tryMaterializeTransportAtResolvedRoute,
} from "../src/simulation/Transports";

function transportRules(withP37 = false) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [],
    ...(withP37
      ? {
          customDomains: [
            {
              sourceKind: "ORIGIN" as const,
              sourceId: "P37",
              domain: "LANDING_FORT_GRANT",
            },
          ],
        }
      : {}),
  });
}

function transportFixture(seed: string, withP37 = false) {
  const rules = transportRules(withP37);
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

function twoLaneTransportFixture(seed: string) {
  const rules = transportRules();
  return createInitialMatchState(createMicroSimulationSpec({
    seed,
    width: 5,
    height: 4,
    terrain: [
      "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
      "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER",
      "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER", "DEEP_WATER", "SHALLOW_WATER",
      "PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS",
    ],
    initialOwners: [
      "alpha", "alpha", "alpha", "alpha", "alpha",
      null, null, null, null, null,
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

function addUnit(
  state: ReturnType<typeof transportFixture> | ReturnType<typeof twoLaneTransportFixture>,
  type: "TRADE_SHIP" | "TRANSPORT_SHIP" | "TANK",
  movementClass: "NAVAL" | "TRANSPORT" | "TANK",
  cellId: number,
) {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    { ownerId: "alpha", type, movementClass, cellId },
  );
  return createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
  });
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

describe("Transport endpoint stability with physical occupancy", () => {
  it("keeps the statically selected endpoint when that embark cell is temporarily occupied", () => {
    const state = transportFixture("transport-endpoint-occupancy-red");
    const blockedState = addUnit(state, "TRADE_SHIP", "NAVAL", 5);

    const resolved = resolveTransportEndpointRouteForState(blockedState, {
      sourceCellId: 0,
      targetCellId: 14,
      embarkCoastCellIds: [0, 1],
      landingCoastCellIds: [14],
    });
    expect(resolved).toMatchObject({
      status: "FOUND",
      route: {
        sourceCellId: 0,
        targetCellId: 14,
        embarkCellId: 5,
        landingCellId: 9,
      },
    });
    if (resolved.status !== "FOUND") {
      throw new Error("expected stable Transport endpoint route");
    }

    expect(
      tryMaterializeTransportAtResolvedRoute(blockedState, {
        ownerId: "alpha",
        route: resolved.route,
      }),
    ).toMatchObject({
      ok: false,
      failure: { code: "EMBARK_BLOCKED" },
    });
  });

  it("does not turn a statically valid endpoint pair into no-solution because its candidate cells are occupied", () => {
    const state = transportFixture("transport-endpoint-no-oracle-red");
    const firstBlocked = addUnit(state, "TRADE_SHIP", "NAVAL", 5);
    const fullyBlocked = addUnit(firstBlocked, "TRADE_SHIP", "NAVAL", 6);

    expect(resolveTransportEndpointRouteForState(fullyBlocked, {
      sourceCellId: 0,
      targetCellId: 14,
      embarkCoastCellIds: [0, 1],
      landingCoastCellIds: [14],
    })).toMatchObject({
      status: "FOUND",
      route: {
        sourceCellId: 0,
        targetCellId: 14,
        embarkCellId: 5,
        landingCellId: 9,
      },
    });
  });

  it("routes around occupied water cells when another lawful Transport path exists", () => {
    const state = twoLaneTransportFixture("transport-path-occupancy-red");
    const blockedState = addUnit(state, "TRADE_SHIP", "NAVAL", 7);
    const resolved = resolveTransportEndpointRouteForState(blockedState, {
      sourceCellId: 0,
      targetCellId: 19,
      embarkCoastCellIds: [0],
      landingCoastCellIds: [19],
    });

    expect(resolved.status).toBe("FOUND");
    if (resolved.status !== "FOUND") throw new Error("expected occupancy-aware route");
    expect(resolved.route.embarkCellId).toBe(5);
    expect(resolved.route.landingCellId).toBe(14);
    expect(resolved.route.path.cells).not.toContain(7);
  });

  it("uses canonical same-tick physical contention for Transport movement", () => {
    const state = transportFixture("transport-same-tick-contention-proof");
    const first = createMobileUnit(
      state.map,
      state.factions.map((faction) => faction.id),
      state,
      { ownerId: "alpha", type: "TRANSPORT_SHIP", movementClass: "TRANSPORT", cellId: 5 },
    );
    const second = createMobileUnit(
      state.map,
      state.factions.map((faction) => faction.id),
      first,
      { ownerId: "alpha", type: "TRANSPORT_SHIP", movementClass: "TRANSPORT", cellId: 7 },
    );
    const routed = second.mobileUnits.map((unit) =>
      unit.cellId === 5
        ? assignMobileUnitRoute(state.map, unit, { cells: [5, 6], edgeWeights: [1] })
        : assignMobileUnitRoute(state.map, unit, { cells: [7, 6], edgeWeights: [1] }),
    );
    const work = Object.fromEntries(routed.map((unit) => [unit.id, 1]));
    const advanced = advanceMobileUnits(routed, work);

    expect(advanced.map((unit) => unit.cellId).sort((a, b) => a - b)).toEqual([5, 7]);
    expect(advanced.every((unit) => unit.type === "TRANSPORT_SHIP")).toBe(true);
  });
});

describe("P37 successful Transport landing consequences", () => {
  it("terminates the Transport before granting an ordinary level-1 Fort at the authored landing target", () => {
    const state = transportFixture("transport-p37-fort-grant-red", true);
    const route = resolvedRoute(state);
    const materialized = tryMaterializeTransportAtResolvedRoute(state, {
      ownerId: "alpha",
      route,
    });
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) throw new Error("expected P37 Transport materialization");

    const finalized = applySuccessfulTransportLandingConsequences(materialized.state, {
      transportId: materialized.unit.id,
      fortStructureId: "p37-fort-success",
    });

    expect(finalized.status).toBe("FORT_GRANTED");
    expect(finalized.state.ownership[14]).toBe("alpha");
    expect(finalized.state.mobileUnits.some((unit) => unit.id === materialized.unit.id)).toBe(false);
    expect(finalized.state.structures).toContainEqual(expect.objectContaining({
      id: "p37-fort-success",
      ownerId: "alpha",
      type: "FORT",
      cellId: 14,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    }));
  });

  it("keeps the successful landing and terminated Transport when ordinary Fort admission fails", () => {
    const state = transportFixture("transport-p37-skip-grant-red", true);
    const blockedLanding = addUnit(state, "TANK", "TANK", 14);
    const route = resolvedRoute(blockedLanding);
    const materialized = tryMaterializeTransportAtResolvedRoute(blockedLanding, {
      ownerId: "alpha",
      route,
    });
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) throw new Error("expected blocked-target P37 Transport materialization");
    const blocker = materialized.state.mobileUnits.find((unit) => unit.cellId === 14);
    expect(blocker).toBeDefined();

    const finalized = applySuccessfulTransportLandingConsequences(materialized.state, {
      transportId: materialized.unit.id,
      fortStructureId: "p37-fort-blocked",
    });

    expect(finalized.status).toBe("SKIP_GRANT_KEEP_LANDING");
    expect(finalized.state.ownership[14]).toBe("alpha");
    expect(finalized.state.mobileUnits.some((unit) => unit.id === materialized.unit.id)).toBe(false);
    expect(finalized.state.mobileUnits.some((unit) => unit.id === blocker?.id)).toBe(true);
    expect(finalized.state.structures.some((structure) => structure.id === "p37-fort-blocked")).toBe(false);
  });
});
