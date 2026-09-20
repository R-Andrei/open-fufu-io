import { describe, expect, it } from "vitest";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { matchStateAtWar } from "../src/simulation/HostilityState";
import {
  canonicalMatchStateSerialization,
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit, type MobileUnitState } from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";
import { tryLaunchTradeVoyage } from "../src/simulation/TradeShips";
import * as WarshipCombat from "../src/simulation/WarshipCombat";

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([]));
}

function port(id: string, ownerId: string, cellId: number, outputCellId: number) {
  return Object.freeze({
    id,
    ownerId,
    type: "PORT" as const,
    cellId,
    outputCellId,
    completedLevel: 1 as const,
    active: true,
    acquisitionPath: "GRANT" as const,
  });
}

function fixture(seed: string): MatchState {
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
      seed,
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
      port("port-alpha", "alpha", 31, 0),
      port("port-beta", "beta", 51, 20),
      port("port-gamma", "gamma", 61, 30),
    ],
  });
}

function launch(state: MatchState) {
  const launched = tryLaunchTradeVoyage(state, {
    ownerId: "alpha",
    sourcePortId: "port-alpha",
    destinationPortId: "port-gamma",
  });
  expect(launched.ok).toBe(true);
  if (!launched.ok) throw new Error("expected Trade Ship launch");
  return launched;
}

function addWarship(
  state: MatchState,
  ownerId: string,
  cellId: number,
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
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
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        ...state.warshipOperationalStates,
        Object.freeze({
          unitId: created.unit.id,
          health: Object.freeze({ numerator: 1_000n, denominator: 1n }),
          operatingAnchorCellId: cellId,
          attackReadyAtTick: state.tick,
          nextProjectileOrdinal: 0,
          roamingOrdinal: 0,
        }),
      ],
    }),
  });
}

function capturePhase(
  admissionState: MatchState,
  currentState: MatchState = admissionState,
): MatchState {
  const fn = (WarshipCombat as unknown as {
    resolveWarshipTradeShipCaptureDecisions?: (
      admissionState: MatchState,
      currentState?: MatchState,
    ) => MatchState;
  }).resolveWarshipTradeShipCaptureDecisions;
  if (fn === undefined) {
    throw new TypeError(
      "resolveWarshipTradeShipCaptureDecisions is not implemented",
    );
  }
  return fn(admissionState, currentState);
}

function captureFacts(state: MatchState): readonly any[] {
  return (
    state as unknown as {
      readonly warshipTradeShipCaptureFacts?: readonly any[];
    }
  ).warshipTradeShipCaptureFacts ?? [];
}

describe("Warship hostile Trade Ship capture runtime", () => {
  it("captures at the inclusive 5-cell boundary and does not capture at 6 cells", () => {
    const launchedAtFive = launch(fixture("warship-capture-range-five-red"));
    const atFive = addWarship(launchedAtFive.state, "beta", 5);
    const captured = capturePhase(atFive.state);
    expect(
      captured.mobileUnits.find((unit) => unit.id === launchedAtFive.unit.id)
        ?.ownerId,
    ).toBe("beta");
    expect(captureFacts(captured)).toHaveLength(1);

    const launchedAtSix = launch(fixture("warship-capture-range-six-red"));
    const atSix = addWarship(launchedAtSix.state, "beta", 6);
    const unchanged = capturePhase(atSix.state);
    expect(
      unchanged.mobileUnits.find((unit) => unit.id === launchedAtSix.unit.id)
        ?.ownerId,
    ).toBe("alpha");
    expect(captureFacts(unchanged)).toEqual([]);
  });

  it("TickEngine commits capture from the frozen post-movement snapshot without creating atWar", () => {
    const launched = launch(fixture("warship-capture-tick-no-war-red"));
    const source = addWarship(launched.state, "beta", 5);
    expect(matchStateAtWar(source.state, "alpha", "beta")).toBe(false);
    const operationsBefore = source.state.operations;
    const graceBefore = source.state.hostilityGrace;

    const advanced = new TickEngine().advance(source.state, []);

    expect(
      advanced.mobileUnits.find((unit) => unit.id === launched.unit.id)?.ownerId,
    ).toBe("beta");
    expect(matchStateAtWar(advanced, "alpha", "beta")).toBe(false);
    expect(advanced.operations).toEqual(operationsBefore);
    expect(advanced.hostilityGrace).toEqual(graceBefore);
    expect(captureFacts(advanced)).toEqual([
      {
        id: JSON.stringify([
          "WARSHIP_TRADE_SHIP_CAPTURE",
          1,
          source.unit.id,
          launched.unit.id,
        ]),
        tick: 1,
        capturingWarshipId: source.unit.id,
        capturingFactionId: "beta",
        tradeShipId: launched.unit.id,
        originalOwnerId: "alpha",
        previousHolderId: "alpha",
        nextHolderId: "beta",
        firstHostileCapture: true,
      },
    ]);
  });

  it("orders competing same-phase admissions by stable Warship ID and permits one transition per Trade Ship independent of container order", () => {
    const launched = launch(fixture("warship-capture-contention-red"));
    const lowerId = addWarship(launched.state, "beta", 5);
    const higherId = addWarship(lowerId.state, "beta", 4);
    const reordered = createProspectiveMatchState(higherId.state, {
      mobileUnits: [...higherId.state.mobileUnits].reverse(),
      warshipOperationalStates: [
        ...higherId.state.warshipOperationalStates,
      ].reverse(),
    });

    const resolved = capturePhase(reordered);

    expect(
      resolved.mobileUnits.find((unit) => unit.id === launched.unit.id)?.ownerId,
    ).toBe("beta");
    expect(captureFacts(resolved)).toHaveLength(1);
    expect(captureFacts(resolved)[0]).toMatchObject({
      capturingWarshipId: lowerId.unit.id,
      tradeShipId: launched.unit.id,
      previousHolderId: "alpha",
      nextHolderId: "beta",
    });
    expect(captureFacts(resolved)[0]?.capturingWarshipId).not.toBe(
      higherId.unit.id,
    );
  });

  it("reveals a successful capturing Warship to the immediately attacked holder for exactly 150 ticks and not to third parties", () => {
    const launched = launch(fixture("warship-capture-direct-reveal-red"));
    const beta = addWarship(launched.state, "beta", 5);

    const advanced = new TickEngine().advance(beta.state, []);

    expect(
      advanced.directReveals.filter(
        (record) =>
          record.sourceKind === "UNIT" &&
          record.sourceId === beta.unit.id,
      ),
    ).toEqual([
      {
        viewerFactionId: "alpha",
        sourceKind: "UNIT",
        sourceId: beta.unit.id,
        expiryExclusiveTick: 151,
      },
    ]);
  });

  it("attributes recapture direct reveal to the immediately previous holder rather than the original owner", () => {
    const launched = launch(fixture("warship-recapture-direct-reveal-red"));
    const beta = addWarship(launched.state, "beta", 5);
    const first = capturePhase(beta.state);
    const nextTick = createAdvancedMatchState(first, {
      mobileUnits: first.mobileUnits.filter((unit) => unit.id !== beta.unit.id),
      warshipOperationalStates: first.warshipOperationalStates.filter(
        (operational) => operational.unitId !== beta.unit.id,
      ),
      directReveals: [],
    });
    const gamma = addWarship(nextTick, "gamma", 4);

    const advanced = new TickEngine().advance(gamma.state, []);

    expect(
      advanced.directReveals.filter(
        (record) =>
          record.sourceKind === "UNIT" &&
          record.sourceId === gamma.unit.id,
      ),
    ).toEqual([
      {
        viewerFactionId: "beta",
        sourceKind: "UNIT",
        sourceId: gamma.unit.id,
        expiryExclusiveTick: 152,
      },
    ]);
  });

  it("records a later hostile recapture as a distinct stable fact and serializes both occurrences", () => {
    const launched = launch(fixture("warship-capture-recapture-red"));
    const beta = addWarship(launched.state, "beta", 5);
    const first = capturePhase(beta.state);
    const nextTick = createAdvancedMatchState(first, {
      mobileUnits: first.mobileUnits.filter((unit) => unit.id !== beta.unit.id),
      warshipOperationalStates: first.warshipOperationalStates.filter(
        (operational) => operational.unitId !== beta.unit.id,
      ),
    });
    const gamma = addWarship(nextTick, "gamma", 4);

    const second = capturePhase(gamma.state);

    expect(
      second.mobileUnits.find((unit) => unit.id === launched.unit.id)?.ownerId,
    ).toBe("gamma");
    expect(captureFacts(second)).toEqual([
      {
        id: JSON.stringify([
          "WARSHIP_TRADE_SHIP_CAPTURE",
          0,
          beta.unit.id,
          launched.unit.id,
        ]),
        tick: 0,
        capturingWarshipId: beta.unit.id,
        capturingFactionId: "beta",
        tradeShipId: launched.unit.id,
        originalOwnerId: "alpha",
        previousHolderId: "alpha",
        nextHolderId: "beta",
        firstHostileCapture: true,
      },
      {
        id: JSON.stringify([
          "WARSHIP_TRADE_SHIP_CAPTURE",
          1,
          gamma.unit.id,
          launched.unit.id,
        ]),
        tick: 1,
        capturingWarshipId: gamma.unit.id,
        capturingFactionId: "gamma",
        tradeShipId: launched.unit.id,
        originalOwnerId: "alpha",
        previousHolderId: "beta",
        nextHolderId: "gamma",
        firstHostileCapture: false,
      },
    ]);
    expect(
      JSON.parse(canonicalMatchStateSerialization(second))
        .warshipTradeShipCaptureFacts,
    ).toEqual(captureFacts(second));
  });
});
