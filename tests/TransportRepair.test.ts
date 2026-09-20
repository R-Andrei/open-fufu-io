import { describe, expect, it } from "vitest";

import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  canonicalMatchStateSerialization,
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  createMobileUnit,
  setMobileUnitStrategicDestination,
} from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";
import * as TransportRepair from "../src/simulation/TransportRepair";

function rules(
  traits: readonly OriginTraitId[] = [],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

interface TransportSeed {
  readonly cellId: number;
  readonly routeDestinationCellId?: number;
  readonly strategicDestinationCellId?: number;
  readonly health?: bigint;
  readonly repairPortId?: string;
  readonly repairArrivalTick?: number;
  readonly repairResumeRoute?: Readonly<{
    readonly interruptionCellId: number;
    readonly destinationCellId: number;
    readonly cells: readonly number[];
    readonly edgeWeights: readonly number[];
  }>;
}

function ascendingCells(from: number, to: number): readonly number[] {
  if (from > to) throw new Error("fixture route must be ascending");
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function fixture(options: Readonly<{
  seed: string;
  width?: number;
  portLevel?: 1 | 2 | 3 | 4 | 5;
  traits?: readonly OriginTraitId[];
  additional?: readonly RuleContribution[];
  transport: TransportSeed;
}>): MatchState {
  const width = options.width ?? 30;
  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: options.seed,
      width,
      height: 1,
      terrain: [
        "PLAINS",
        ...Array.from({ length: width - 1 }, () => "DEEP_WATER" as const),
      ],
      initialOwners: [
        "alpha",
        ...Array.from({ length: width - 1 }, () => null),
      ],
      initialStructureGrants: [
        {
          structureId: "alpha-port",
          ownerId: "alpha",
          type: "PORT",
          cellId: 0,
          level: options.portLevel ?? 1,
        },
      ],
      factions: [
        {
          id: "alpha",
          rules: rules(options.traits ?? ["P32"], options.additional),
        },
        { id: "beta", rules: rules() },
      ],
    }),
  );

  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId: "alpha",
      type: "TRANSPORT_SHIP",
      movementClass: "TRANSPORT",
      cellId: options.transport.cellId,
    },
  );
  let unit = created.unit;
  if (options.transport.strategicDestinationCellId !== undefined) {
    unit = setMobileUnitStrategicDestination(
      state.map,
      unit,
      options.transport.strategicDestinationCellId,
    );
  }
  if (options.transport.routeDestinationCellId !== undefined) {
    const cells = ascendingCells(
      options.transport.cellId,
      options.transport.routeDestinationCellId,
    );
    unit = assignMobileUnitRoute(state.map, unit, {
      cells,
      edgeWeights: Array.from({ length: cells.length - 1 }, () => 1),
    });
  }

  const operational = {
    unitId: unit.id,
    carriedPopulation: 0,
    ...(options.transport.health === undefined
      ? {}
      : {
          health: {
            numerator: options.transport.health,
            denominator: 1n,
          },
        }),
    ...(options.transport.repairPortId === undefined
      ? {}
      : { repairPortId: options.transport.repairPortId }),
    ...(options.transport.repairArrivalTick === undefined
      ? {}
      : { repairArrivalTick: options.transport.repairArrivalTick }),
    ...(options.transport.repairResumeRoute === undefined
      ? {}
      : { repairResumeRoute: options.transport.repairResumeRoute }),
  };

  state = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits.map((candidate) =>
      candidate.id === unit.id ? unit : candidate,
    ),
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    transportOperationalStates: [operational] as any,
  });
  return state;
}

function intent(state: MatchState): MatchState {
  const fn = (TransportRepair as unknown as {
    advanceTransportRepairIntentPhase?: (current: MatchState) => MatchState;
  }).advanceTransportRepairIntentPhase;
  if (fn === undefined) {
    throw new TypeError("advanceTransportRepairIntentPhase is not implemented");
  }
  return fn(state);
}

function service(state: MatchState): MatchState {
  const fn = (TransportRepair as unknown as {
    advanceTransportRepairPhase?: (current: MatchState) => MatchState;
  }).advanceTransportRepairPhase;
  if (fn === undefined) {
    throw new TypeError("advanceTransportRepairPhase is not implemented");
  }
  return fn(state);
}

describe("P32 Transport ordinary Port repair adapter", () => {
  it("enters repair retreat at and below exactly 50% of 500 HP, preserves the interrupted route, and serializes the assignment", () => {
    const above = intent(
      fixture({
        seed: "transport-repair-threshold-above-red",
        transport: {
          cellId: 15,
          health: 251n,
          routeDestinationCellId: 24,
          strategicDestinationCellId: 29,
        },
      }),
    );
    expect(above.transportOperationalStates[0]).not.toHaveProperty(
      "repairPortId",
    );
    expect(above.mobileUnits[0]?.route?.destinationCellId).toBe(24);

    for (const [seed, health] of [
      ["transport-repair-threshold-exact-red", 250n],
      ["transport-repair-threshold-below-red", 249n],
    ] as const) {
      const intended = intent(
        fixture({
          seed,
          transport: {
            cellId: 15,
            health,
            routeDestinationCellId: 24,
            strategicDestinationCellId: 29,
          },
        }),
      );
      expect(intended.transportOperationalStates[0]).toMatchObject({
        repairPortId: "alpha-port",
        repairResumeRoute: {
          interruptionCellId: 15,
          destinationCellId: 24,
          cells: ascendingCells(15, 24),
          edgeWeights: Array.from({ length: 9 }, () => 1),
        },
      });
      expect(intended.mobileUnits[0]?.route?.destinationCellId).not.toBe(24);

      const serialized = JSON.parse(
        canonicalMatchStateSerialization(intended),
      );
      expect(serialized.transportOperationalStates[0]).toMatchObject({
        repairPortId: "alpha-port",
        repairResumeRoute: {
          interruptionCellId: 15,
          destinationCellId: 24,
          cells: ascendingCells(15, 24),
          edgeWeights: Array.from({ length: 9 }, () => 1),
        },
      });
    }
  });

  it("does not send an ordinary fragile Transport into repair", () => {
    const state = intent(
      fixture({
        seed: "transport-repair-fragile-exclusion-red",
        traits: [],
        transport: {
          cellId: 15,
          routeDestinationCellId: 24,
          strategicDestinationCellId: 29,
        },
      }),
    );
    expect(state.transportOperationalStates[0]?.health).toBeUndefined();
    expect(state.transportOperationalStates[0]).not.toHaveProperty(
      "repairPortId",
    );
    expect(state.mobileUnits[0]?.route?.destinationCellId).toBe(24);
  });

  it("uses only the ordinary Port broad/fast profile even when the owner also has P31", () => {
    for (const traits of [["P32"], ["P32", "P31"]] as const) {
      const fast = fixture({
        seed: `transport-repair-fast-${traits.join("-")}-red`,
        traits,
        transport: {
          cellId: 5,
          health: 250n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
          strategicDestinationCellId: 29,
        },
      });
      expect(service(fast).transportOperationalStates[0]?.health).toEqual({
        numerator: 260n,
        denominator: 1n,
      });

      const broad = fixture({
        seed: `transport-repair-broad-${traits.join("-")}-red`,
        traits,
        transport: {
          cellId: 15,
          health: 250n,
          repairPortId: "alpha-port",
          strategicDestinationCellId: 29,
        },
      });
      expect(service(broad).transportOperationalStates[0]?.health).toEqual({
        numerator: 251n,
        denominator: 1n,
      });
    }
  });

  it("moves toward repair through shared physical movement while broad repair continues, then parks during fast service", () => {
    const travellingBase = fixture({
      seed: "transport-repair-travel-broad-red",
      transport: {
        cellId: 15,
        health: 249n,
        routeDestinationCellId: 24,
        strategicDestinationCellId: 29,
      },
    });
    const travellingId = travellingBase.mobileUnits[0]!.id;
    const travelling = new TickEngine().advance(travellingBase, []);
    expect(
      travelling.mobileUnits.find((unit) => unit.id === travellingId)?.cellId,
    ).toBe(14);
    expect(
      travelling.transportOperationalStates.find(
        (entry) => entry.unitId === travellingId,
      ),
    ).toMatchObject({
      health: { numerator: 250n, denominator: 1n },
      repairPortId: "alpha-port",
      repairResumeRoute: {
        interruptionCellId: 15,
        destinationCellId: 24,
      },
    });

    const parkedBase = fixture({
      seed: "transport-repair-fast-park-red",
      traits: ["P32", "P31"],
      transport: {
        cellId: 5,
        health: 250n,
        repairPortId: "alpha-port",
        repairArrivalTick: 0,
        strategicDestinationCellId: 29,
      },
    });
    const parkedId = parkedBase.mobileUnits[0]!.id;
    const parked = new TickEngine().advance(parkedBase, []);
    expect(
      parked.mobileUnits.find((unit) => unit.id === parkedId)?.cellId,
    ).toBe(5);
    expect(
      parked.transportOperationalStates.find(
        (entry) => entry.unitId === parkedId,
      )?.health,
    ).toEqual({ numerator: 260n, denominator: 1n });
  });

  it("clears repair state at full health and deterministically rejoins the exact retained amphibious route", () => {
    const state = fixture({
      seed: "transport-repair-resume-route-red",
      transport: {
        cellId: 5,
        health: 495n,
        repairPortId: "alpha-port",
        repairArrivalTick: 0,
        strategicDestinationCellId: 29,
        repairResumeRoute: {
          interruptionCellId: 15,
          destinationCellId: 24,
          cells: ascendingCells(15, 24),
          edgeWeights: Array.from({ length: 9 }, () => 1),
        },
      },
    });
    const repaired = service(state);
    expect(repaired.transportOperationalStates[0]?.health).toEqual({
      numerator: 500n,
      denominator: 1n,
    });
    expect(repaired.transportOperationalStates[0]).not.toHaveProperty(
      "repairPortId",
    );
    expect(repaired.transportOperationalStates[0]).not.toHaveProperty(
      "repairArrivalTick",
    );
    expect(repaired.transportOperationalStates[0]).not.toHaveProperty(
      "repairResumeRoute",
    );
    expect(repaired.mobileUnits[0]).toMatchObject({
      cellId: 5,
      strategicDestinationCellId: 29,
      route: {
        destinationCellId: 24,
        cells: ascendingCells(5, 24),
        edgeWeights: Array.from({ length: 19 }, () => 1),
      },
    });
  });

  it("shares one Port fast-service slot across a queued P32 Transport and Warship", () => {
    const transportState = fixture({
      seed: "transport-repair-shared-naval-fast-slot-red",
      traits: ["P32", "P31"],
      transport: {
        cellId: 5,
        health: 250n,
        repairPortId: "alpha-port",
        repairArrivalTick: 0,
        strategicDestinationCellId: 29,
      },
    });
    const transportId = transportState.mobileUnits[0]!.id;
    const created = createMobileUnit(
      transportState.map,
      transportState.factions.map((faction) => faction.id),
      transportState,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 6,
      },
    );
    const warshipId = created.unit.id;
    const contested = createProspectiveMatchState(transportState, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        {
          unitId: warshipId,
          health: { numerator: 500n, denominator: 1n },
          operatingAnchorCellId: 6,
          attackReadyAtTick: transportState.tick,
          nextProjectileOrdinal: 0,
          roamingOrdinal: 0,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
        },
      ],
    });

    const advanced = new TickEngine().advance(contested, []);
    expect(
      advanced.transportOperationalStates.find(
        (entry) => entry.unitId === transportId,
      )?.health,
    ).toEqual({ numerator: 260n, denominator: 1n });
    expect(
      advanced.warshipOperationalStates.find(
        (entry) => entry.unitId === warshipId,
      )?.health,
    ).toEqual({ numerator: 1003n, denominator: 2n });
  });


  it("keeps P31 Warship-only radii out of P32 repair while ordinary Port Echoes still compose", () => {
    const portEchoes = [
      echoRuleContribution(
        "port.repair_radius",
        "BENEFICIAL",
        5_000,
        "cert:p32-port-radius",
      ),
      echoRuleContribution(
        "port.repair_rate",
        "BENEFICIAL",
        5_000,
        "cert:p32-port-rate",
      ),
    ];

    const fastBoundary = intent(
      fixture({
        seed: "transport-repair-p31-fast-radius-exclusion-cert",
        width: 32,
        traits: ["P32", "P31"],
        additional: portEchoes,
        transport: {
          cellId: 15,
          health: 250n,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
        },
      }),
    );
    expect(fastBoundary.transportOperationalStates[0]).not.toHaveProperty(
      "repairArrivalTick",
    );
    expect(service(fastBoundary).transportOperationalStates[0]?.health).toEqual({
      numerator: 503n,
      denominator: 2n,
    });

    const broadBoundary = fixture({
      seed: "transport-repair-p31-broad-radius-exclusion-cert",
      width: 32,
      traits: ["P32", "P31"],
      additional: portEchoes,
      transport: {
        cellId: 30,
        health: 250n,
        repairPortId: "alpha-port",
      },
    });
    expect(service(broadBoundary).transportOperationalStates[0]?.health).toEqual({
      numerator: 503n,
      denominator: 2n,
    });

    const outsideOrdinaryBroad = fixture({
      seed: "transport-repair-p31-broad-radius-outside-cert",
      width: 32,
      traits: ["P32", "P31"],
      additional: portEchoes,
      transport: {
        cellId: 31,
        health: 250n,
        repairPortId: "alpha-port",
      },
    });
    expect(
      service(outsideOrdinaryBroad).transportOperationalStates[0]?.health,
    ).toEqual({
      numerator: 250n,
      denominator: 1n,
    });

    const ordinaryFast = fixture({
      seed: "transport-repair-port-echo-fast-cert",
      width: 32,
      traits: ["P32", "P31"],
      additional: portEchoes,
      transport: {
        cellId: 10,
        health: 250n,
        repairPortId: "alpha-port",
        repairArrivalTick: 0,
      },
    });
    expect(service(ordinaryFast).transportOperationalStates[0]?.health).toEqual({
      numerator: 265n,
      denominator: 1n,
    });
  });

  it("uses the effective P12 Transport movement profile during the repair detour", () => {
    const state = fixture({
      seed: "transport-repair-p12-detour-cert",
      traits: ["P32", "P12"],
      transport: {
        cellId: 15,
        health: 249n,
        routeDestinationCellId: 24,
        strategicDestinationCellId: 29,
      },
    });
    const unitId = state.mobileUnits[0]!.id;

    const advanced = new TickEngine().advance(state, []);
    expect(
      advanced.mobileUnits.find((unit) => unit.id === unitId),
    ).toMatchObject({
      cellId: 14,
      route: {
        destinationCellId: 10,
        edgeProgress: 1,
      },
    });
    expect(advanced.transportOperationalStates[0]).toMatchObject({
      health: { numerator: 250n, denominator: 1n },
      repairPortId: "alpha-port",
      repairResumeRoute: {
        interruptionCellId: 15,
        destinationCellId: 24,
      },
    });
  });

  it("preserves in-progress edge work through repair and resumes the exact remaining amphibious route state", () => {
    let state = fixture({
      seed: "transport-repair-partial-edge-resume-cert",
      portLevel: 5,
      transport: {
        cellId: 15,
        health: 250n,
        routeDestinationCellId: 24,
        strategicDestinationCellId: 29,
      },
    });
    const unitId = state.mobileUnits[0]!.id;
    const cells = ascendingCells(15, 24);
    const weighted = assignMobileUnitRoute(state.map, state.mobileUnits[0]!, {
      cells,
      edgeWeights: Array.from({ length: cells.length - 1 }, () => 4),
    });
    const progressed = advanceMobileUnit(weighted, 2).unit;
    state = createProspectiveMatchState(state, {
      mobileUnits: state.mobileUnits.map((unit) =>
        unit.id === unitId ? progressed : unit,
      ),
    });

    let current = intent(state);
    expect(current.transportOperationalStates[0]?.repairResumeRoute).toEqual({
      interruptionCellId: 15,
      destinationCellId: 24,
      cells,
      edgeWeights: [2, ...Array.from({ length: 8 }, () => 4)],
    });
    const serialized = JSON.parse(canonicalMatchStateSerialization(current));
    expect(
      serialized.transportOperationalStates[0]?.repairResumeRoute?.edgeWeights,
    ).toEqual([2, ...Array.from({ length: 8 }, () => 4)]);

    for (let step = 0; step < 30; step += 1) {
      if (
        current.transportOperationalStates[0]?.repairPortId === undefined
      ) {
        break;
      }
      current = new TickEngine().advance(current, []);
    }

    expect(current.transportOperationalStates[0]?.health).toEqual({
      numerator: 500n,
      denominator: 1n,
    });
    expect(current.transportOperationalStates[0]).not.toHaveProperty(
      "repairPortId",
    );
    expect(current.transportOperationalStates[0]).not.toHaveProperty(
      "repairResumeRoute",
    );
    expect(
      current.mobileUnits.find((unit) => unit.id === unitId),
    ).toMatchObject({
      cellId: 10,
      strategicDestinationCellId: 29,
      route: {
        destinationCellId: 24,
        cells: ascendingCells(10, 24),
        edgeWeights: [
          1,
          1,
          1,
          1,
          1,
          2,
          ...Array.from({ length: 8 }, () => 4),
        ],
        nextCellIndex: 1,
        edgeProgress: 0,
      },
    });
  });

  it("gives an earlier-arrived Warship the shared fast slot while the P32 Transport receives broad repair", () => {
    const transportState = fixture({
      seed: "transport-repair-shared-naval-arrival-order-cert",
      traits: ["P32", "P31"],
      transport: {
        cellId: 5,
        health: 250n,
        repairPortId: "alpha-port",
        repairArrivalTick: 1,
      },
    });
    const transportId = transportState.mobileUnits[0]!.id;
    const created = createMobileUnit(
      transportState.map,
      transportState.factions.map((faction) => faction.id),
      transportState,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 6,
      },
    );
    const warshipId = created.unit.id;
    const contested = createAdvancedMatchState(
      createProspectiveMatchState(transportState, {
        mobileUnits: created.mobileUnits,
        nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
        warshipOperationalStates: [
          {
            unitId: warshipId,
            health: { numerator: 500n, denominator: 1n },
            operatingAnchorCellId: 6,
            attackReadyAtTick: 0,
            nextProjectileOrdinal: 0,
            roamingOrdinal: 0,
            repairPortId: "alpha-port",
            repairArrivalTick: 0,
          },
        ],
      }),
      {},
    );

    const advanced = new TickEngine().advance(contested, []);
    expect(
      advanced.transportOperationalStates.find(
        (entry) => entry.unitId === transportId,
      )?.health,
    ).toEqual({ numerator: 251n, denominator: 1n });
    expect(
      advanced.warshipOperationalStates.find(
        (entry) => entry.unitId === warshipId,
      )?.health,
    ).toEqual({ numerator: 515n, denominator: 1n });
  });


  it("keeps an ordinary Warship combat-operational when a P32 Transport owns the shared fast-service slot", () => {
    let state = fixture({
      seed: "transport-repair-shared-slot-warship-combat-cert",
      traits: ["P32"],
      transport: {
        cellId: 5,
        health: 250n,
        repairPortId: "alpha-port",
        repairArrivalTick: 0,
      },
    });
    const transportId = state.mobileUnits[0]!.id;
    const ownerIds = state.factions.map((faction) => faction.id);

    const sourceCreated = createMobileUnit(
      state.map,
      ownerIds,
      state,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 6,
      },
    );
    const sourceId = sourceCreated.unit.id;

    const targetCreated = createMobileUnit(
      state.map,
      ownerIds,
      {
        mobileUnits: sourceCreated.mobileUnits,
        nextMobileUnitOrdinal: sourceCreated.nextMobileUnitOrdinal,
      },
      {
        ownerId: "beta",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 7,
      },
    );
    const targetId = targetCreated.unit.id;
    state = createProspectiveMatchState(state, {
      mobileUnits: targetCreated.mobileUnits,
      nextMobileUnitOrdinal: targetCreated.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        {
          unitId: sourceId,
          health: { numerator: 500n, denominator: 1n },
          operatingAnchorCellId: 6,
          attackReadyAtTick: 0,
          nextProjectileOrdinal: 0,
          roamingOrdinal: 0,
          repairPortId: "alpha-port",
          repairArrivalTick: 0,
        },
        {
          unitId: targetId,
          health: { numerator: 1_000n, denominator: 1n },
          operatingAnchorCellId: 7,
          attackReadyAtTick: 1_000,
          nextProjectileOrdinal: 0,
          roamingOrdinal: 0,
        },
      ],
    });

    const advanced = new TickEngine().advance(state, []);
    expect(
      advanced.transportOperationalStates.find(
        (entry) => entry.unitId === transportId,
      )?.health,
    ).toEqual({ numerator: 260n, denominator: 1n });
    expect(
      advanced.warshipOperationalStates.find(
        (entry) => entry.unitId === sourceId,
      ),
    ).toMatchObject({
      health: { numerator: 501n, denominator: 1n },
      attackReadyAtTick: 21,
    });
  });

});
