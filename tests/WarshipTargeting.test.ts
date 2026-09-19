import { describe, expect, it } from "vitest";

import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
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
import { tryLaunchTradeVoyage } from "../src/simulation/TradeShips";
import {
  planWarshipPursuitRoute,
  selectWarshipAutonomousTarget,
} from "../src/simulation/WarshipTargeting";
import { projectWarshipTargetObservation } from "../src/simulation/VisibilityState";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function fixture(
  width: number,
  terrain: readonly string[],
  alphaTraits: readonly OriginTraitId[] = [],
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-targeting-red",
      width,
      height: 1,
      terrain,
      initialOwners: Array.from({ length: width }, () => null),
      factions: [
        { id: "alpha", rules: rulesWithTraits(alphaTraits) },
        { id: "beta", rules: rulesWithTraits() },
      ],
    }),
  );
}

function addUnit(
  state: MatchState,
  input: Readonly<{
    ownerId: string;
    type: "WARSHIP" | "TRANSPORT_SHIP";
    cellId: number;
    operatingAnchorCellId?: number;
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
      type: input.type,
      movementClass: "NAVAL",
      cellId: input.cellId,

    },
  );
  const createdUnit =
    input.strategicDestinationCellId === undefined
      ? created.unit
      : setMobileUnitStrategicDestination(
          state.map,
          created.unit,
          input.strategicDestinationCellId,
        );
  const next = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits.map((unit) =>
      unit.id === createdUnit.id ? createdUnit : unit,
    ),
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    warshipOperationalStates:
      input.type === "WARSHIP"
        ? [
            ...state.warshipOperationalStates,
            {
              unitId: created.unit.id,
              health: { numerator: 1_000n, denominator: 1n },
              operatingAnchorCellId:
                input.operatingAnchorCellId ?? input.cellId,
              attackReadyAtTick: state.tick,
              nextProjectileOrdinal: 0,
              roamingOrdinal: 0,
            },
          ]
        : state.warshipOperationalStates,
  });
  return Object.freeze({
    state: next,
    unit:
      next.mobileUnits.find((unit) => unit.id === created.unit.id) ??
      created.unit,
  });
}

function port(
  id: string,
  ownerId: string,
  cellId: number,
  outputCellId: number,
) {
  return {
    id,
    ownerId,
    type: "PORT" as const,
    cellId,
    outputCellId,
    completedLevel: 1 as const,
    active: true,
    acquisitionPath: "GRANT" as const,
  };
}

function p30TradeFixture() {
  const width = 31;
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-p30-trade-red",
      width,
      height: 2,
      terrain: [
        ...Array.from({ length: width }, () => "DEEP_WATER" as const),
        ...Array.from({ length: width }, () => "PLAINS" as const),
      ],
      initialOwners: Array.from(
        { length: width * 2 },
        (_, cellId) =>
          cellId === 31
            ? "alpha"
            : cellId === 51
              ? "beta"
              : cellId === 61
                ? "gamma"
                : null,
      ),
      factions: [
        { id: "alpha", rules: rulesWithTraits(["P30"]) },
        { id: "beta", rules: rulesWithTraits() },
        { id: "gamma", rules: rulesWithTraits() },
      ],
    }),
  );
  let state = createProspectiveMatchState(base, {
    structures: [
      port("port-alpha", "alpha", 31, 0),
      port("port-beta", "beta", 51, 20),
      port("port-gamma", "gamma", 61, 30),
    ],
  });
  const launched = tryLaunchTradeVoyage(state, {
    ownerId: "beta",
    sourcePortId: "port-beta",
    destinationPortId: "port-gamma",
  });
  if (!launched.ok) throw new Error("expected Trade Ship launch");
  state = launched.state;
  const observer = addUnit(state, {
    ownerId: "alpha",
    type: "WARSHIP",
    cellId: 10,
  });
  state = observer.state;
  const hostileWarship = addUnit(state, {
    ownerId: "beta",
    type: "WARSHIP",
    cellId: 9,
  });
  return Object.freeze({
    state: hostileWarship.state,
    observer: observer.unit,
    hostileWarship: hostileWarship.unit,
    tradeShip: launched.unit,
  });
}

describe("Warship autonomous observation and target selection", () => {
  it("supplies inclusive local observation out to the effective 130-cell gun range", () => {
    let state = fixture(132, Array.from({ length: 132 }, () => "DEEP_WATER"));
    const observer = addUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = observer.state;
    const edge = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 130,
    });
    state = edge.state;
    const outside = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 131,
    });
    state = outside.state;

    const observation = projectWarshipTargetObservation(state, "alpha");
    expect(observation.observedUnitIds).toContain(edge.unit.id);
    expect(observation.observedUnitIds).not.toContain(outside.unit.id);
  });

  it("keeps P30 Warship observation while disabling naval gunfire target classes", () => {
    const trade = p30TradeFixture();
    const observation = projectWarshipTargetObservation(trade.state, "alpha");
    expect(observation.observedUnitIds).toContain(trade.hostileWarship.id);
    expect(observation.observedUnitIds).toContain(trade.tradeShip.id);

    expect(
      selectWarshipAutonomousTarget(trade.state, {
        unitId: trade.observer.id,
        observedUnitIds: [
          trade.hostileWarship.id,
          trade.tradeShip.id,
        ],
      }),
    ).toEqual({
      targetClass: "TRADE_SHIP",
      unitId: trade.tradeShip.id,
    });
  });

  it("prioritizes hostile Transport over a much nearer hostile Warship", () => {
    let state = fixture(121, Array.from({ length: 121 }, () => "DEEP_WATER"));
    const observer = addUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
    });
    state = observer.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      cellId: 1,
    });
    state = warship.state;
    const transport = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 100,
    });
    state = transport.state;

    expect(
      selectWarshipAutonomousTarget(state, {
        unitId: observer.unit.id,
        observedUnitIds: [warship.unit.id, transport.unit.id],
      }),
    ).toEqual({
      targetClass: "TRANSPORT_SHIP",
      unitId: transport.unit.id,
    });
  });

  it("uses squared Euclidean distance then stable unit ID independent of enumeration order", () => {
    let state = fixture(21, Array.from({ length: 21 }, () => "DEEP_WATER"));
    const observer = addUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 10,
    });
    state = observer.state;
    const first = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 9,
    });
    state = first.state;
    const second = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 11,
    });
    state = second.state;
    const expected = [first.unit.id, second.unit.id].sort()[0]!;

    const reversed = createProspectiveMatchState(state, {
      mobileUnits: [...state.mobileUnits].reverse(),
    });
    expect(
      selectWarshipAutonomousTarget(reversed, {
        unitId: observer.unit.id,
        observedUnitIds: [second.unit.id, first.unit.id],
      }),
    ).toEqual({
      targetClass: "TRANSPORT_SHIP",
      unitId: expected,
    });
  });

  it("enforces the settled 100-cell anchor leash but lifts it during active strategic travel", () => {
    let state = fixture(151, Array.from({ length: 151 }, () => "DEEP_WATER"));
    const observer = addUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 90,
      operatingAnchorCellId: 0,
    });
    state = observer.state;
    const target = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 101,
    });
    state = target.state;

    expect(
      selectWarshipAutonomousTarget(state, {
        unitId: observer.unit.id,
        observedUnitIds: [target.unit.id],
      }),
    ).toBeUndefined();

    const travelling = createProspectiveMatchState(state, {
      mobileUnits: state.mobileUnits.map((unit) =>
        unit.id === observer.unit.id
          ? { ...unit, strategicDestinationCellId: 150 }
          : unit,
      ),
    });
    expect(
      selectWarshipAutonomousTarget(travelling, {
        unitId: observer.unit.id,
        observedUnitIds: [target.unit.id],
      }),
    ).toEqual({
      targetClass: "TRANSPORT_SHIP",
      unitId: target.unit.id,
    });
  });

  it("plans least-time Deep-Water pursuit to the nearest inclusive engagement cell", () => {
    let state = fixture(151, Array.from({ length: 151 }, () => "DEEP_WATER"));
    const observer = addUnit(state, {
      ownerId: "alpha",
      type: "WARSHIP",
      cellId: 0,
      operatingAnchorCellId: 0,
      strategicDestinationCellId: 150,
    });
    state = observer.state;
    const target = addUnit(state, {
      ownerId: "beta",
      type: "TRANSPORT_SHIP",
      cellId: 140,
    });
    state = target.state;

    const plan = planWarshipPursuitRoute(
      state,
      { unitId: observer.unit.id },
      { targetClass: "TRANSPORT_SHIP", unitId: target.unit.id },
    );
    expect(plan?.destinationCellId).toBe(10);
    expect(plan?.cells[0]).toBe(0);
    expect(plan?.cells.at(-1)).toBe(10);
  });
});
