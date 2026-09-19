import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { advanceMobileUnits } from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { TickEngine } from "../src/simulation/TickEngine";
import {
  prepareTradeShipRuntimePhase,
  tradeShipMovementWorkByUnitId,
  tryLaunchTradeVoyage,
} from "../src/simulation/TradeShips";

function rulesWith(traitIds: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traitIds));
}

function emptyRules() {
  return rulesWith();
}

function port(
  id: string,
  ownerId: string,
  cellId: number,
  outputCellId: number,
  active = true,
) {
  return {
    id,
    ownerId,
    type: "PORT" as const,
    cellId,
    outputCellId,
    completedLevel: 1 as const,
    active,
    acquisitionPath: "GRANT" as const,
  };
}

function advanceTickCount<T extends { readonly tick: number }>(
  state: T,
  count: number,
  advance: (value: T) => T,
): T {
  let current = state;
  for (let index = 0; index < count; index += 1) current = advance(current);
  return current;
}

describe("authoritative Trade Ship voyage state", () => {
  it("launches on the shortest lawful delivery route and serializes the immutable economic snapshot", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-voyage-launch-snapshot",
        width: 10,
        height: 1,
        terrain: [
          "PLAINS",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "PLAINS",
          "DEEP_WATER",
        ],
        initialOwners: [
          "alpha",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "beta",
          null,
        ],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const withPorts = createProspectiveMatchState(base, {
      structures: [
        {
          id: "port-alpha",
          ownerId: "alpha",
          type: "PORT",
          cellId: 0,
          outputCellId: 1,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
        {
          id: "port-beta",
          ownerId: "beta",
          type: "PORT",
          cellId: 8,
          outputCellId: 9,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
      ],
    });

    const launched = tryLaunchTradeVoyage(withPorts, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });

    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    expect(launched.unit).toMatchObject({
      ownerId: "alpha",
      type: "TRADE_SHIP",
      movementClass: "NAVAL",
      cellId: 1,
      route: {
        destinationCellId: 3,
        cells: [1, 2, 3],
        edgeWeights: [1, 1],
        nextCellIndex: 1,
        edgeProgress: 0,
      },
    });

    expect(launched.state.tradeVoyages).toEqual([
      {
        unitId: launched.unit.id,
        economicSnapshot: {
          originalOwnerId: "alpha",
          sourcePortId: "port-alpha",
          launchDestinationPortId: "port-beta",
          valuationCellId: 8,
          plannedRouteLengthCells: 2,
          rawCargoFfy: 300,
          ownerSuccessValueFfy: 300,
        },
        firstHostileCaptureResolved: false,
      },
    ]);

    expect(JSON.parse(canonicalMatchStateSerialization(launched.state)).tradeVoyages).toEqual([
      {
        unitId: launched.unit.id,
        economicSnapshot: {
          originalOwnerId: "alpha",
          sourcePortId: "port-alpha",
          launchDestinationPortId: "port-beta",
          valuationCellId: 8,
          plannedRouteLengthCells: 2,
          rawCargoFfy: 300,
          ownerSuccessValueFfy: 300,
        },
        firstHostileCaptureResolved: false,
      },
    ]);
  });

  it("serializes one deterministic ownership-epoch scheduler and never dispatches immediately when eligibility first appears", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-port-scheduler-epoch",
        width: 13,
        height: 1,
        terrain: [
          "PLAINS",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "PLAINS",
        ],
        initialOwners: [
          "alpha",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "alpha",
        ],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const onlyAlpha = createProspectiveMatchState(base, {
      structures: [port("port-alpha", "alpha", 0, 1)],
    });
    const firstTick = createAdvancedMatchState(onlyAlpha, {});
    const noDestination = createProspectiveMatchState(
      firstTick,
      prepareTradeShipRuntimePhase(firstTick, onlyAlpha),
    );
    expect(noDestination.mobileUnits).toHaveLength(0);
    expect(noDestination.tradePortSchedulers).toEqual([
      {
        portId: "port-alpha",
        ownerId: "alpha",
        nextAttemptOrdinal: 0,
        nextAttemptTick: null,
        nextDestinationSelectionOrdinal: 0,
        destinationHistory: [],
      },
    ]);

    const eligibleTick = createAdvancedMatchState(noDestination, {
      structures: [
        port("port-alpha", "alpha", 0, 1),
        port("port-beta", "beta", 12, 11),
      ],
    });
    const newlyEligible = createProspectiveMatchState(
      eligibleTick,
      prepareTradeShipRuntimePhase(eligibleTick, noDestination),
    );
    expect(newlyEligible.mobileUnits).toHaveLength(0);

    const alphaScheduler = newlyEligible.tradePortSchedulers.find(
      (entry) => entry.portId === "port-alpha",
    );
    expect(alphaScheduler).toBeDefined();
    expect(alphaScheduler?.nextAttemptOrdinal).toBe(1);
    expect(alphaScheduler?.nextAttemptTick).toBeGreaterThanOrEqual(
      eligibleTick.tick + 200,
    );
    expect(alphaScheduler?.nextAttemptTick).toBeLessThanOrEqual(
      eligibleTick.tick + 300,
    );

    const serialized = JSON.parse(canonicalMatchStateSerialization(newlyEligible));
    expect(serialized.tradePortSchedulers).toEqual(newlyEligible.tradePortSchedulers);
  });

  it("dispatches to the least-recently-selected reachable foreign Port, reschedules once, and resets the scheduler epoch on ownership transfer", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-destination-history",
        width: 23,
        height: 2,
        terrain: [
          ...Array.from({ length: 23 }, () => "DEEP_WATER" as const),
          ...Array.from({ length: 23 }, () => "PLAINS" as const),
        ],
        initialOwners: Array.from({ length: 46 }, (_, cellId) =>
          cellId === 23 ? "alpha" : cellId === 33 ? "beta" : cellId === 44 ? "gamma" : null,
        ),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
          { id: "gamma", rules },
        ],
      }),
    );
    const previous = createProspectiveMatchState(base, {
      structures: [
        port("port-alpha", "alpha", 23, 0),
        port("port-beta", "beta", 33, 10),
        port("port-gamma", "gamma", 44, 21),
      ],
    });
    const current = createAdvancedMatchState(previous, {
      tradePortSchedulers: [
        {
          portId: "port-alpha",
          ownerId: "alpha",
          nextAttemptOrdinal: 7,
          nextAttemptTick: 1,
          nextDestinationSelectionOrdinal: 4,
          destinationHistory: [
            { destinationPortId: "port-beta", lastSelectedOrdinal: 3 },
          ],
        },
      ],
    } as never);
    const dispatched = createProspectiveMatchState(
      current,
      prepareTradeShipRuntimePhase(current, previous),
    );

    const alphaVoyage = dispatched.tradeVoyages.find(
      (voyage) => voyage.economicSnapshot.originalOwnerId === "alpha",
    );
    expect(alphaVoyage?.economicSnapshot.launchDestinationPortId).toBe("port-gamma");
    const alphaScheduler = dispatched.tradePortSchedulers.find(
      (entry) => entry.portId === "port-alpha",
    );
    expect(alphaScheduler?.nextAttemptOrdinal).toBe(8);
    expect(alphaScheduler?.nextAttemptTick).toBeGreaterThanOrEqual(201);
    expect(alphaScheduler?.nextAttemptTick).toBeLessThanOrEqual(301);
    expect(alphaScheduler?.destinationHistory).toEqual([
      { destinationPortId: "port-beta", lastSelectedOrdinal: 3 },
      { destinationPortId: "port-gamma", lastSelectedOrdinal: 4 },
    ]);
    expect(alphaScheduler?.nextDestinationSelectionOrdinal).toBe(5);

    const transferred = createAdvancedMatchState(dispatched, {
      structures: dispatched.structures.map((structure) =>
        structure.id === "port-alpha"
          ? { ...structure, ownerId: "beta" }
          : structure,
      ),
      mobileUnits: [],
      tradeVoyages: [],
    });
    const reset = createProspectiveMatchState(
      transferred,
      prepareTradeShipRuntimePhase(transferred, dispatched),
    );
    expect(
      reset.tradePortSchedulers.find((entry) => entry.portId === "port-alpha"),
    ).toMatchObject({
      portId: "port-alpha",
      ownerId: "beta",
      nextAttemptOrdinal: 1,
      nextDestinationSelectionOrdinal: 0,
      destinationHistory: [],
    });
  });

  it("moves ordinary Trade Ships at exactly 10 cells/s baseline and 12.5 cells/s with P06 through shared arbitration", () => {
    function launchedFor(traitIds: readonly OriginTraitId[]) {
      const alphaRules = rulesWith(traitIds);
      const betaRules = emptyRules();
      const base = createInitialMatchState(
        createMicroSimulationSpec({
          seed: `trade-speed-${traitIds.join("-") || "baseline"}`,
          width: 16,
          height: 1,
          terrain: [
            "PLAINS",
            ...Array.from({ length: 14 }, () => "DEEP_WATER" as const),
            "PLAINS",
          ],
          initialOwners: Array.from({ length: 16 }, (_, cellId) =>
            cellId === 0 ? "alpha" : cellId === 15 ? "beta" : null,
          ),
          factions: [
            { id: "alpha", rules: alphaRules },
            { id: "beta", rules: betaRules },
          ],
        }),
      );
      const state = createProspectiveMatchState(base, {
        structures: [
          port("port-alpha", "alpha", 0, 1),
          port("port-beta", "beta", 15, 14),
        ],
      });
      const launched = tryLaunchTradeVoyage(state, {
        ownerId: "alpha",
        sourcePortId: "port-alpha",
        destinationPortId: "port-beta",
      });
      expect(launched.ok).toBe(true);
      if (!launched.ok) throw new Error("expected Trade voyage launch");
      return launched.state;
    }

    function moveFourTicks(state: ReturnType<typeof launchedFor>) {
      let current = state;
      for (let tick = 0; tick < 4; tick += 1) {
        current = createProspectiveMatchState(current, {
          mobileUnits: advanceMobileUnits(
            current.mobileUnits,
            tradeShipMovementWorkByUnitId(current),
          ),
        });
      }
      return current;
    }

    const baseline = moveFourTicks(launchedFor([]));
    const p06 = moveFourTicks(launchedFor(["P06"]));
    expect(baseline.mobileUnits[0]?.cellId).toBe(5);
    expect(p06.mobileUnits[0]?.cellId).toBe(6);
  });

  it("integrates scheduler reconciliation and Trade movement into TickEngine", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-tick-engine-runtime",
        width: 16,
        height: 1,
        terrain: [
          "PLAINS",
          ...Array.from({ length: 14 }, () => "DEEP_WATER" as const),
          "PLAINS",
        ],
        initialOwners: Array.from({ length: 16 }, (_, cellId) =>
          cellId === 0 ? "alpha" : cellId === 15 ? "beta" : null,
        ),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const withPorts = createProspectiveMatchState(base, {
      structures: [
        port("port-alpha", "alpha", 0, 1),
        port("port-beta", "beta", 15, 14),
      ],
    });
    const launched = tryLaunchTradeVoyage(withPorts, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    const advanced = new TickEngine().advance(launched.state, []);
    expect(
      advanced.mobileUnits.find((unit) => unit.id === launched.unit.id)?.cellId,
    ).toBe(2);
    expect(
      advanced.tradePortSchedulers.find((entry) => entry.portId === "port-alpha")
        ?.nextAttemptTick,
    ).toEqual(expect.any(Number));
  });

});
