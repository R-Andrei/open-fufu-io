import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import {
  advanceMobileUnits,
  createMobileUnit,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { TickEngine } from "../src/simulation/TickEngine";
import * as TradeShipsModule from "../src/simulation/TradeShips";
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


type TestMatchState = ReturnType<typeof createInitialMatchState>;

function requiredTradeFunction<T extends (...args: any[]) => any>(name: string): T {
  const value = (TradeShipsModule as unknown as Record<string, unknown>)[name];
  if (typeof value !== "function") throw new TypeError(`${name} is not a function`);
  return value as T;
}

function threePortState(
  seed: string,
  options: Readonly<{
    alphaTraits?: readonly OriginTraitId[];
    betaTraits?: readonly OriginTraitId[];
    gammaTraits?: readonly OriginTraitId[];
    betaActive?: boolean;
    betaPortTerrain?: "PLAINS" | "DESERT";
    includeAlphaFort?: boolean;
  }> = {},
): TestMatchState {
  const width = 31;
  const terrain = [
    ...Array.from({ length: width }, () => "DEEP_WATER" as const),
    ...Array.from({ length: width }, (_, x) =>
      x === 20 && options.betaPortTerrain === "DESERT"
        ? ("DESERT" as const)
        : ("PLAINS" as const),
    ),
  ];
  const ownership = Array.from({ length: width * 2 }, () => null as string | null);
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
        { id: "alpha", rules: rulesWith(options.alphaTraits ?? []) },
        { id: "beta", rules: rulesWith(options.betaTraits ?? []) },
        { id: "gamma", rules: rulesWith(options.gammaTraits ?? []) },
      ],
    }),
  );
  return createProspectiveMatchState(base, {
    structures: [
      port("port-alpha", "alpha", 31, 0),
      ...(options.includeAlphaFort
        ? [
            {
              id: "fort-alpha",
              ownerId: "alpha",
              type: "FORT" as const,
              cellId: 41,
              completedLevel: 1 as const,
              active: true,
              acquisitionPath: "GRANT" as const,
            },
          ]
        : []),
      port("port-beta", "beta", 51, 20, options.betaActive ?? true),
      port("port-gamma", "gamma", 61, 30),
    ],
  });
}

function withFactionFfy(
  state: TestMatchState,
  factionId: string,
  ffy: number,
): TestMatchState {
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === factionId ? { ...faction, ffy } : faction,
    ),
  });
}

function moveTradeUnitToRouteEnd(
  state: TestMatchState,
  unitId: string,
): TestMatchState {
  return createProspectiveMatchState(state, {
    mobileUnits: advanceMobileUnits(
      state.mobileUnits,
      Object.freeze({ [unitId]: 100_000 }),
    ),
  });
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
        sourcePortOwnershipEpochOrdinal: 0,
        routingMode: "ORDINARY",
        destinationPortId: "port-beta",
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
        sourcePortOwnershipEpochOrdinal: 0,
        routingMode: "ORDINARY",
        destinationPortId: "port-beta",
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
        ownershipEpochOrdinal: 0,
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
          ownershipEpochOrdinal: 4,
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
      ownershipEpochOrdinal: 5,
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


  it("includes launch-time terrain and owned-field event conditions in Vowner without applying piracy or wartime stages", () => {
    const state = threePortState("trade-vowner-context", {
      alphaTraits: ["P14", "P24"],
      betaPortTerrain: "DESERT",
      includeAlphaFort: true,
    });
    const launched = tryLaunchTradeVoyage(state, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    const snapshot = launched.state.tradeVoyages[0]?.economicSnapshot;
    expect(snapshot?.plannedRouteLengthCells).toBe(16);
    expect(snapshot?.rawCargoFfy).toBe(2_400);
    expect(snapshot?.ownerSuccessValueFfy).toBe(3_672);
  });

  it("retains the launching ownership epoch across source-Port transfer and updates only that retired history on ordinary reroute", () => {
    const width = 41;
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-retired-source-epoch",
        width,
        height: 2,
        terrain: [
          ...Array.from({ length: width }, () => "DEEP_WATER" as const),
          ...Array.from({ length: width }, () => "PLAINS" as const),
        ],
        initialOwners: Array.from({ length: width * 2 }, (_, cellId) =>
          cellId === 41
            ? "alpha"
            : cellId === 55
              ? "beta"
              : cellId === 68
                ? "gamma"
                : cellId === 81
                  ? "delta"
                  : null,
        ),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
          { id: "gamma", rules },
          { id: "delta", rules },
        ],
      }),
    );
    const before = createProspectiveMatchState(base, {
      structures: [
        port("port-alpha", "alpha", 41, 0),
        port("port-beta", "beta", 55, 14),
        port("port-gamma", "gamma", 68, 27),
        port("port-delta", "delta", 81, 40),
      ],
      tradePortSchedulers: [
        {
          portId: "port-alpha",
          ownerId: "alpha",
          ownershipEpochOrdinal: 4,
          nextAttemptOrdinal: 8,
          nextAttemptTick: 999,
          nextDestinationSelectionOrdinal: 6,
          destinationHistory: [
            { destinationPortId: "port-beta", lastSelectedOrdinal: 0 },
            { destinationPortId: "port-delta", lastSelectedOrdinal: 2 },
            { destinationPortId: "port-gamma", lastSelectedOrdinal: 5 },
          ],
        },
      ],
    } as never);
    const launched = tryLaunchTradeVoyage(before, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");
    expect((launched.state.tradeVoyages[0] as any)?.sourcePortOwnershipEpochOrdinal).toBe(4);

    const transferred = createAdvancedMatchState(launched.state, {
      structures: launched.state.structures.map((structure) => {
        if (structure.id === "port-alpha") return { ...structure, ownerId: "beta" };
        if (structure.id === "port-beta") return { ...structure, active: false };
        return structure;
      }),
    });
    const reconciled = createProspectiveMatchState(
      transferred,
      prepareTradeShipRuntimePhase(transferred, launched.state),
    );
    const voyage = (reconciled.tradeVoyages[0] as any);
    expect(voyage.routingMode).toBe("ORDINARY");
    expect(voyage.destinationPortId).toBe("port-alpha");

    const retired = (reconciled as any).tradeRetiredPortEpochs;
    expect(retired).toEqual([
      {
        portId: "port-alpha",
        ownerId: "alpha",
        ownershipEpochOrdinal: 4,
        nextDestinationSelectionOrdinal: 7,
        destinationHistory: [
          { destinationPortId: "port-alpha", lastSelectedOrdinal: 6 },
          { destinationPortId: "port-beta", lastSelectedOrdinal: 0 },
          { destinationPortId: "port-delta", lastSelectedOrdinal: 2 },
          { destinationPortId: "port-gamma", lastSelectedOrdinal: 5 },
        ],
      },
    ]);
    expect(
      reconciled.tradePortSchedulers.find((entry) => entry.portId === "port-alpha"),
    ).toMatchObject({
      ownerId: "beta",
      ownershipEpochOrdinal: 5,
      nextDestinationSelectionOrdinal: 0,
      destinationHistory: [],
    });
  });

  it("routes a new voyage around current physical occupancy when a legal Deep-Water bypass exists", () => {
    const width = 7;
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-launch-occupancy-bypass",
        width,
        height: 4,
        terrain: [
          ...Array.from({ length: width * 3 }, () => "DEEP_WATER" as const),
          ...Array.from({ length: width }, () => "PLAINS" as const),
        ],
        initialOwners: Array.from({ length: width * 4 }, (_, cellId) =>
          cellId === 21 ? "alpha" : cellId === 27 ? "beta" : null,
        ),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const withPorts = createProspectiveMatchState(base, {
      structures: [
        port("port-alpha", "alpha", 21, 14),
        port("port-beta", "beta", 27, 20),
      ],
    });
    const blocker = createMobileUnit(
      withPorts.map,
      withPorts.factions.map((faction) => faction.id),
      {
        mobileUnits: withPorts.mobileUnits,
        nextMobileUnitOrdinal: withPorts.nextMobileUnitOrdinal,
      },
      {
        ownerId: "beta",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 15,
      },
    );
    const occupied = createProspectiveMatchState(withPorts, {
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
    });

    const launched = tryLaunchTradeVoyage(occupied, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    expect(launched.unit.route?.cells).toEqual([14, 7, 8, 9]);
    expect(launched.state.tradeVoyages[0]?.economicSnapshot).toMatchObject({
      plannedRouteLengthCells: 3,
      rawCargoFfy: 450,
    });
  });

  it("replans an in-flight voyage around newly occupied remaining route cells when a legal bypass exists", () => {
    const width = 7;
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-inflight-occupancy-bypass",
        width,
        height: 4,
        terrain: [
          ...Array.from({ length: width * 3 }, () => "DEEP_WATER" as const),
          ...Array.from({ length: width }, () => "PLAINS" as const),
        ],
        initialOwners: Array.from({ length: width * 4 }, (_, cellId) =>
          cellId === 21 ? "alpha" : cellId === 27 ? "beta" : null,
        ),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const withPorts = createProspectiveMatchState(base, {
      structures: [
        port("port-alpha", "alpha", 21, 14),
        port("port-beta", "beta", 27, 20),
      ],
    });
    const launched = tryLaunchTradeVoyage(withPorts, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");
    expect(launched.unit.route?.cells).toEqual([14, 15, 16]);

    const blocker = createMobileUnit(
      launched.state.map,
      launched.state.factions.map((faction) => faction.id),
      {
        mobileUnits: launched.state.mobileUnits,
        nextMobileUnitOrdinal: launched.state.nextMobileUnitOrdinal,
      },
      {
        ownerId: "beta",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 15,
      },
    );
    const occupied = createProspectiveMatchState(launched.state, {
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
    });
    const reconciled = createProspectiveMatchState(
      occupied,
      prepareTradeShipRuntimePhase(occupied, launched.state),
    );
    const tradeUnit = reconciled.mobileUnits.find(
      (unit) => unit.id === launched.unit.id,
    );

    expect(tradeUnit?.route?.cells).toEqual([14, 7, 8, 9]);
    expect(reconciled.tradeVoyages[0]?.economicSnapshot).toMatchObject({
      plannedRouteLengthCells: 2,
      rawCargoFfy: 300,
    });
  });

  it("settles ordinary Trade at current wartime conditions and lets P08 replace the 0.5 wartime multiplier", () => {
    const settle = requiredTradeFunction<
      (state: TestMatchState, atWar: (left: string, right: string) => boolean) => TestMatchState
    >("settleTradeShipRuntimePhase");

    function completed(traits: readonly OriginTraitId[]) {
      const state = threePortState(`trade-wartime-${traits.join("-") || "baseline"}`, {
        alphaTraits: traits,
      });
      const launched = tryLaunchTradeVoyage(state, {
        ownerId: "alpha",
        sourcePortId: "port-alpha",
        destinationPortId: "port-beta",
      });
      expect(launched.ok).toBe(true);
      if (!launched.ok) throw new Error("expected Trade voyage launch");
      return moveTradeUnitToRouteEnd(launched.state, launched.unit.id);
    }

    const baseline = completed([]);
    const baselineAlpha = baseline.factions.find((faction) => faction.id === "alpha")!;
    const baselineSettled = settle(baseline, () => true);
    expect(
      baselineSettled.factions.find((faction) => faction.id === "alpha")!.ffy -
        baselineAlpha.ffy,
    ).toBe(1_200);
    expect(baselineSettled.tradeVoyages).toHaveLength(0);
    expect(baselineSettled.mobileUnits).toHaveLength(0);

    const p08 = completed(["P08"]);
    const p08Alpha = p08.factions.find((faction) => faction.id === "alpha")!;
    const p08Settled = settle(p08, () => true);
    expect(
      p08Settled.factions.find((faction) => faction.id === "alpha")!.ffy -
        p08Alpha.ffy,
    ).toBe(2_400);
  });

  it("replaces N16 uncaptured success with signed -Vowner and aggregates it with another same-tick signed Trade fact before the balance floor", () => {
    const settle = requiredTradeFunction<
      (state: TestMatchState, atWar: (left: string, right: string) => boolean) => TestMatchState
    >("settleTradeShipRuntimePhase");
    let state = withFactionFfy(
      threePortState("trade-n16-same-tick", { alphaTraits: ["N16"] }),
      "alpha",
      100,
    );
    const launched = tryLaunchTradeVoyage(state, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");
    state = moveTradeUnitToRouteEnd(launched.state, launched.unit.id);
    state = createProspectiveMatchState(state, {
      tradePendingSignedFacts: [
        {
          id: "trade:first-capture:other-voyage",
          ownerId: "alpha",
          componentsFfy: [2_400],
        },
      ],
    } as never);

    const settled = settle(state, () => false);
    expect(settled.factions.find((faction) => faction.id === "alpha")?.ffy).toBe(100);
    expect(settled.tradeVoyages).toHaveLength(0);
    expect((settled as any).tradePendingSignedFacts).toEqual([]);
  });

  it("nets N14 and N16 on one first-capture fact, exposes stable capture identity, and never repeats the first-capture adjustment on recapture", () => {
    const capture = requiredTradeFunction<
      (
        state: TestMatchState,
        request: { unitId: string; capturingFactionId: string },
      ) => any
    >("tryCaptureTradeShip");
    const settle = requiredTradeFunction<
      (state: TestMatchState, atWar: (left: string, right: string) => boolean) => TestMatchState
    >("settleTradeShipRuntimePhase");

    const state = threePortState("trade-capture-net", {
      alphaTraits: ["N14", "N16"],
    });
    const launched = tryLaunchTradeVoyage(state, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-gamma",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    const first = capture(launched.state, {
      unitId: launched.unit.id,
      capturingFactionId: "beta",
    });
    expect(first.ok).toBe(true);
    expect(first.capture).toEqual({
      unitId: launched.unit.id,
      originalOwnerId: "alpha",
      previousHolderId: "alpha",
      nextHolderId: "beta",
      firstHostileCapture: true,
    });
    expect(first.state.factions.find((faction: any) => faction.id === "alpha").ffy).toBe(25_000);
    expect(first.state.factions.find((faction: any) => faction.id === "beta").ffy).toBe(25_000);

    const second = capture(first.state, {
      unitId: launched.unit.id,
      capturingFactionId: "gamma",
    });
    expect(second.ok).toBe(true);
    expect(second.capture).toMatchObject({
      unitId: launched.unit.id,
      previousHolderId: "beta",
      nextHolderId: "gamma",
      firstHostileCapture: false,
    });
    expect((second.state.tradeVoyages[0] as any).firstHostileCaptureResolved).toBe(true);
    expect((second.state as any).tradePendingSignedFacts).toHaveLength(1);

    const settled = settle(second.state, () => false);
    expect(settled.factions.find((faction) => faction.id === "alpha")?.ffy).toBe(25_000);
    expect((settled as any).tradePendingSignedFacts).toEqual([]);
    expect(settled.tradeVoyages).toHaveLength(1);
  });

  it("rejects capture without a reachable holder Port, then keeps captured cargo physically in play through temporary no-Port state and resumes routing when service returns", () => {
    const capture = requiredTradeFunction<
      (
        state: TestMatchState,
        request: { unitId: string; capturingFactionId: string },
      ) => any
    >("tryCaptureTradeShip");

    const initial = threePortState("trade-capture-no-port", { betaActive: false });
    const launched = tryLaunchTradeVoyage(initial, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-gamma",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    const rejected = capture(launched.state, {
      unitId: launched.unit.id,
      capturingFactionId: "beta",
    });
    expect(rejected).toMatchObject({
      ok: false,
      failure: { code: "NO_REACHABLE_DELIVERY_PORT" },
    });
    expect(rejected.state).toBe(launched.state);

    const enabled = createAdvancedMatchState(launched.state, {
      structures: launched.state.structures.map((structure) =>
        structure.id === "port-beta" ? { ...structure, active: true } : structure,
      ),
    });
    const captured = capture(enabled, {
      unitId: launched.unit.id,
      capturingFactionId: "beta",
    });
    expect(captured.ok).toBe(true);

    const disabled = createAdvancedMatchState(captured.state, {
      structures: captured.state.structures.map((structure: any) =>
        structure.id === "port-beta" ? { ...structure, active: false } : structure,
      ),
    });
    const stalled = createProspectiveMatchState(
      disabled,
      prepareTradeShipRuntimePhase(disabled, captured.state),
    );
    const stalledUnit = stalled.mobileUnits.find((unit) => unit.id === launched.unit.id)!;
    expect(stalledUnit.ownerId).toBe("beta");
    expect(stalledUnit.route).toBeUndefined();
    expect((stalled.tradeVoyages[0] as any).destinationPortId).toBeNull();
    expect(stalled.tradeVoyages).toHaveLength(1);

    const reenabled = createAdvancedMatchState(stalled, {
      structures: stalled.structures.map((structure) =>
        structure.id === "port-beta" ? { ...structure, active: true } : structure,
      ),
    });
    const rerouted = createProspectiveMatchState(
      reenabled,
      prepareTradeShipRuntimePhase(reenabled, stalled),
    );
    expect((rerouted.tradeVoyages[0] as any).destinationPortId).toBe("port-beta");
    expect(
      rerouted.mobileUnits.find((unit) => unit.id === launched.unit.id)?.route,
    ).toBeDefined();
  });

  it("settles captured cargo exactly once from original rawCargo with P30 piracy and supports original-owner recovery", () => {
    const capture = requiredTradeFunction<
      (
        state: TestMatchState,
        request: { unitId: string; capturingFactionId: string },
      ) => any
    >("tryCaptureTradeShip");
    const settle = requiredTradeFunction<
      (state: TestMatchState, atWar: (left: string, right: string) => boolean) => TestMatchState
    >("settleTradeShipRuntimePhase");

    const pirateState = threePortState("trade-piracy-terminal", {
      betaTraits: ["P30"],
    });
    const pirateLaunch = tryLaunchTradeVoyage(pirateState, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-gamma",
    });
    expect(pirateLaunch.ok).toBe(true);
    if (!pirateLaunch.ok) throw new Error("expected Trade voyage launch");
    const rawCargo = pirateLaunch.state.tradeVoyages[0]!.economicSnapshot.rawCargoFfy;
    expect(rawCargo).toBe(3_900);

    const captured = capture(pirateLaunch.state, {
      unitId: pirateLaunch.unit.id,
      capturingFactionId: "beta",
    });
    expect(captured.ok).toBe(true);
    const betaBefore = captured.state.factions.find((faction: any) => faction.id === "beta").ffy;
    const delivered = moveTradeUnitToRouteEnd(captured.state, pirateLaunch.unit.id);
    const paid = settle(delivered, () => false);
    expect(
      paid.factions.find((faction) => faction.id === "beta")!.ffy - betaBefore,
    ).toBe(rawCargo * 3);
    expect(paid.tradeVoyages).toHaveLength(0);
    expect(paid.mobileUnits).toHaveLength(0);
    const paidAgain = settle(paid, () => false);
    expect(paidAgain.factions.find((faction) => faction.id === "beta")!.ffy).toBe(
      paid.factions.find((faction) => faction.id === "beta")!.ffy,
    );

    const recoveryState = threePortState("trade-recovery-terminal");
    const recoveryLaunch = tryLaunchTradeVoyage(recoveryState, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-gamma",
    });
    expect(recoveryLaunch.ok).toBe(true);
    if (!recoveryLaunch.ok) throw new Error("expected Trade voyage launch");
    const stolen = capture(recoveryLaunch.state, {
      unitId: recoveryLaunch.unit.id,
      capturingFactionId: "beta",
    });
    expect(stolen.ok).toBe(true);
    const stolenMoved = createProspectiveMatchState(stolen.state, {
      mobileUnits: advanceMobileUnits(
        stolen.state.mobileUnits,
        Object.freeze({ [recoveryLaunch.unit.id]: 5 }),
      ),
    });
    const recovered = capture(stolenMoved, {
      unitId: recoveryLaunch.unit.id,
      capturingFactionId: "alpha",
    });
    expect(recovered.ok).toBe(true);
    const alphaBefore = recovered.state.factions.find((faction: any) => faction.id === "alpha").ffy;
    const returned = moveTradeUnitToRouteEnd(recovered.state, recoveryLaunch.unit.id);
    const recoveryPaid = settle(returned, () => false);
    expect(
      recoveryPaid.factions.find((faction) => faction.id === "alpha")!.ffy -
        alphaBefore,
    ).toBe(recoveryLaunch.state.tradeVoyages[0]!.economicSnapshot.rawCargoFfy);
  });

  it("terminal destruction removes the physical cargo and blocks later payout without erasing an already-created first-capture signed fact", () => {
    const capture = requiredTradeFunction<
      (
        state: TestMatchState,
        request: { unitId: string; capturingFactionId: string },
      ) => any
    >("tryCaptureTradeShip");
    const destroy = requiredTradeFunction<
      (state: TestMatchState, request: { unitId: string }) => any
    >("terminateTradeShipAsDestroyed");
    const settle = requiredTradeFunction<
      (state: TestMatchState, atWar: (left: string, right: string) => boolean) => TestMatchState
    >("settleTradeShipRuntimePhase");

    const state = threePortState("trade-destruction-terminal", {
      alphaTraits: ["N14"],
    });
    const launched = tryLaunchTradeVoyage(state, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-gamma",
    });
    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");
    const raw = launched.state.tradeVoyages[0]!.economicSnapshot.rawCargoFfy;

    const captured = capture(launched.state, {
      unitId: launched.unit.id,
      capturingFactionId: "beta",
    });
    expect(captured.ok).toBe(true);
    const betaBefore = captured.state.factions.find((faction: any) => faction.id === "beta").ffy;
    const destroyed = destroy(captured.state, { unitId: launched.unit.id });
    expect(destroyed.ok).toBe(true);
    expect(destroyed.state.tradeVoyages).toHaveLength(0);
    expect(
      destroyed.state.mobileUnits.some((unit: any) => unit.id === launched.unit.id),
    ).toBe(false);

    const settled = settle(destroyed.state, () => false);
    expect(settled.factions.find((faction) => faction.id === "alpha")?.ffy).toBe(
      25_000 - raw,
    );
    expect(settled.factions.find((faction) => faction.id === "beta")?.ffy).toBe(
      betaBefore,
    );
  });

  it("settles ordinary Trade post-movement inside TickEngine and removes the completed voyage exactly once", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-tick-engine-terminal",
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

    const terminal = advanceTickCount(
      launched.state,
      9,
      (state) => new TickEngine().advance(state, []),
    );
    expect(terminal.tradeVoyages).toHaveLength(0);
    expect(
      terminal.mobileUnits.some((unit) => unit.id === launched.unit.id),
    ).toBe(false);
    expect(terminal.factions.find((faction) => faction.id === "alpha")?.ffy).toBe(
      27_250,
    );
  });

});
