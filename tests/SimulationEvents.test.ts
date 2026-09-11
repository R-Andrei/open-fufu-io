import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import { resolveLandTick } from "../src/simulation/LandOperations";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createCellOwnershipChangedEvent,
  createUnitAttackResolvedEvent,
  createUnitDestroyedEvent,
  type CellOwnershipChangedEvent,
} from "../src/simulation/SimulationEvents";
import {
  materializePersistentStructureState,
  resolvePersistentStructureLifecycleTick,
} from "../src/simulation/Structures";

const train = Object.freeze({
  unitId: "unit:train",
  ownerId: "red",
  unitType: "TRAIN" as const,
  cellId: 7,
});
const blueTank = Object.freeze({
  unitId: "unit:0004",
  ownerId: "blue",
  unitType: "TANK" as const,
  cellId: 1,
});
const greenTank = Object.freeze({
  unitId: "unit:0009",
  ownerId: "green",
  unitType: "TANK" as const,
  cellId: 2,
});

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function originRules(ids: readonly ("N07" | "N17")[]) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(ids));
}

function manualOwnershipEvent(
  overrides: Partial<{
    id: string;
    tick: number;
    cellId: number;
    previousOwnerId: string | null;
    nextOwnerId: string | null;
  }> = {},
): CellOwnershipChangedEvent {
  return createCellOwnershipChangedEvent({
    id: overrides.id ?? "ownership-change",
    tick: overrides.tick ?? 1,
    cellId: overrides.cellId ?? 0,
    previousOwnerId: overrides.previousOwnerId ?? "beta",
    nextOwnerId: overrides.nextOwnerId ?? "alpha",
  });
}

function postLandStructureState(options: { readonly remainingTicks?: number } = {}) {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "simulation-event-structure-consumer",
      width: 1,
      height: 1,
      terrain: ["PLAINS"],
      initialOwners: ["beta"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const structure =
    options.remainingTicks === undefined
      ? materializePersistentStructureState({
          id: "captured-city",
          ownerId: "beta",
          type: "CITY",
          cellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        })
      : materializePersistentStructureState({
          id: "captured-city",
          ownerId: "beta",
          type: "CITY",
          cellId: 0,
          active: false,
          construction: {
            targetLevel: 1,
            remainingTicks: options.remainingTicks,
          },
          acquisitionPath: "PURCHASE_BUILD",
        });
  const preLand = createProspectiveMatchState(base, {
    structures: [structure],
  });
  return createProspectiveMatchState(preLand, {
    ownership: ["alpha"],
  });
}

function readyParallelNeutralCaptures(): MatchState {
  const match = new MatchRuntime(
    createMicroSimulationSpec({
      seed: "simulation-event-land-producer",
      width: 4,
      height: 1,
      terrain: ["TEST", "TEST", "TEST", "TEST"],
      initialOwners: ["alpha", null, null, "beta"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "alpha",
    amount: 1,
  });
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "beta",
    amount: 1,
  });
  match.tick();
  const receipts = match.runControllerRound(
    new InProcessTestControllerHost({
      alpha() {
        return {
          directives: {
            set: [
              {
                kind: "LAND_OPERATION",
                key: "capture-one",
                operation: "NEUTRAL_EXPANSION",
                population: 1,
                source: { kind: "CELLS", ids: [0] },
                target: { kind: "CELLS", ids: [1] },
              },
            ],
          },
        };
      },
      beta() {
        return {
          directives: {
            set: [
              {
                kind: "LAND_OPERATION",
                key: "capture-two",
                operation: "NEUTRAL_EXPANSION",
                population: 1,
                source: { kind: "CELLS", ids: [3] },
                target: { kind: "CELLS", ids: [2] },
              },
            ],
          },
        };
      },
    }),
  );
  expect(receipts.every((entry) => entry.receipt.accepted)).toBe(true);
  match.tick();
  const snapshot = match.snapshot() as MatchState;
  expect(snapshot.ownership).toEqual(["alpha", null, null, "beta"]);
  return createProspectiveMatchState(snapshot, {
    captureProgress: [
      {
        cellId: 2,
        claimantFactionId: "beta",
        progressMicros: 999_999,
      },
      {
        cellId: 1,
        claimantFactionId: "alpha",
        progressMicros: 999_999,
      },
    ],
  });
}

const resolveLandTickWithEvents = resolveLandTick as unknown as (
  state: MatchState,
  transitionTick: number,
) => {
  readonly ownership: readonly (string | null)[];
  readonly events: readonly CellOwnershipChangedEvent[];
};

const resolvePersistentStructureLifecycleFromEvents =
  resolvePersistentStructureLifecycleTick as unknown as (
    state: MatchState,
    events: readonly CellOwnershipChangedEvent[],
    currentTick: number,
  ) => ReturnType<typeof resolvePersistentStructureLifecycleTick>;

describe("deterministic simulation events", () => {
  it("materializes an immutable lifecycle-safe resolved attack fact", () => {
    const event = createUnitAttackResolvedEvent({
      id: "opaque attack id",
      tick: 42,
      attacker: blueTank,
      target: train,
    });

    expect(event).toEqual({
      id: "opaque attack id",
      tick: 42,
      kind: "UNIT_ATTACK_RESOLVED",
      payload: {
        attacker: blueTank,
        target: train,
      },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event.payload.attacker)).toBe(true);
    expect(Object.isFrozen(event.payload.target)).toBe(true);
  });

  it("preserves every destruction cause in canonical order without universal credit or consumer payload", () => {
    const causes = [
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack:z",
        attacker: greenTank,
      },
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack:b",
        attacker: blueTank,
      },
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack:a",
        attacker: blueTank,
      },
    ];

    const event = createUnitDestroyedEvent({
      id: "opaque destruction id",
      tick: 42,
      unit: train,
      causes,
    });

    expect(event.kind).toBe("UNIT_DESTROYED");
    expect(
      event.payload.causes.map((cause) => [
        cause.attacker.unitId,
        cause.attackEventId,
      ]),
    ).toEqual([
      ["unit:0004", "attack:a"],
      ["unit:0004", "attack:b"],
      ["unit:0009", "attack:z"],
    ]);
    expect(causes.map((cause) => cause.attackEventId)).toEqual([
      "attack:z",
      "attack:b",
      "attack:a",
    ]);

    expect(Object.keys(event.payload).sort()).toEqual(["causes", "unit"]);
    expect(event.payload).not.toHaveProperty("killer");
    expect(event.payload).not.toHaveProperty("creditedOwnerId");
    expect(event.payload).not.toHaveProperty("baseCargoFfy");
    expect(event.payload).not.toHaveProperty("atWar");

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event.payload.unit)).toBe(true);
    expect(Object.isFrozen(event.payload.causes)).toBe(true);
    expect(event.payload.causes.every(Object.isFrozen)).toBe(true);
    expect(
      event.payload.causes.every((cause) => Object.isFrozen(cause.attacker)),
    ).toBe(true);
  });

  it("materializes immutable cell-ownership facts and rejects no-op ownership", () => {
    const event = createCellOwnershipChangedEvent({
      id: "opaque ownership id",
      tick: 9,
      cellId: 4,
      previousOwnerId: "beta",
      nextOwnerId: "alpha",
    });
    expect(event).toEqual({
      id: "opaque ownership id",
      tick: 9,
      kind: "CELL_OWNERSHIP_CHANGED",
      payload: {
        cellId: 4,
        previousOwnerId: "beta",
        nextOwnerId: "alpha",
      },
    });
    expect(Object.keys(event.payload).sort()).toEqual([
      "cellId",
      "nextOwnerId",
      "previousOwnerId",
    ]);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);

    expect(
      createCellOwnershipChangedEvent({
        id: "to-neutral",
        tick: 10,
        cellId: 4,
        previousOwnerId: "alpha",
        nextOwnerId: null,
      }).payload.nextOwnerId,
    ).toBeNull();
    expect(() =>
      createCellOwnershipChangedEvent({
        id: "no-change",
        tick: 10,
        cellId: 4,
        previousOwnerId: "alpha",
        nextOwnerId: "alpha",
      }),
    ).toThrow(/distinct|change/i);
  });

  it("emits deterministic ordered ownership facts from land resolution", () => {
    const ready = readyParallelNeutralCaptures();
    const transitionTick = ready.tick + 1;
    const reversed = Object.freeze({
      ...ready,
      operations: Object.freeze([...ready.operations].reverse()),
      captureProgress: Object.freeze([...ready.captureProgress].reverse()),
    }) as MatchState;

    const first = resolveLandTickWithEvents(ready, transitionTick);
    const second = resolveLandTickWithEvents(reversed, transitionTick);

    expect(first.events).toEqual(second.events);
    expect(first.events.map((event) => event.payload.cellId)).toEqual([1, 2]);
    expect(first.events.every((event) => event.tick === transitionTick)).toBe(true);
    expect(new Set(first.events.map((event) => event.id)).size).toBe(2);
    expect(first.ownership).toEqual(["alpha", "alpha", "beta", "beta"]);
  });

  it("makes persistent-structure capture depend on the explicit ownership event batch", () => {
    const postLand = postLandStructureState();

    const withoutEvent = resolvePersistentStructureLifecycleFromEvents(
      postLand,
      [],
      1,
    );
    expect(withoutEvent).toEqual([
      expect.objectContaining({
        id: "captured-city",
        ownerId: "beta",
        acquisitionPath: "GRANT",
      }),
    ]);

    const withEvent = resolvePersistentStructureLifecycleFromEvents(
      postLand,
      [manualOwnershipEvent()],
      1,
    );
    expect(withEvent).toEqual([
      expect.objectContaining({
        id: "captured-city",
        ownerId: "alpha",
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ]);
  });

  it("rejects duplicate, stale-tick, and current-ownership-mismatched cell facts", () => {
    const postLand = postLandStructureState();
    const event = manualOwnershipEvent();

    expect(() =>
      resolvePersistentStructureLifecycleFromEvents(postLand, [event, event], 1),
    ).toThrow(/duplicate/i);
    expect(() =>
      resolvePersistentStructureLifecycleFromEvents(
        postLand,
        [manualOwnershipEvent({ tick: 2 })],
        1,
      ),
    ).toThrow(/tick/i);
    expect(() =>
      resolvePersistentStructureLifecycleFromEvents(
        postLand,
        [
          manualOwnershipEvent({
            previousOwnerId: "alpha",
            nextOwnerId: "beta",
          }),
        ],
        1,
      ),
    ).toThrow(/ownership|owner/i);
  });

  it("applies capture disposition before same-tick construction progress", () => {
    const postLand = postLandStructureState({ remainingTicks: 1 });
    const resolved = resolvePersistentStructureLifecycleFromEvents(
      postLand,
      [manualOwnershipEvent()],
      1,
    );

    expect(resolved).toEqual([
      expect.objectContaining({
        id: "captured-city",
        ownerId: "alpha",
        completedLevel: 1,
        active: true,
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ]);
    expect(resolved[0]?.construction).toBeUndefined();
  });

  it("preserves captured-upgrade state through event routing before lifecycle progress", () => {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "simulation-event-captured-upgrade",
        width: 1,
        height: 1,
        terrain: ["PLAINS"],
        initialOwners: ["beta"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const preLand = createProspectiveMatchState(base, {
      structures: [
        materializePersistentStructureState({
          id: "fort-upgrade",
          ownerId: "beta",
          type: "FORT",
          cellId: 0,
          completedLevel: 1,
          active: true,
          construction: { targetLevel: 2, remainingTicks: 2 },
          acquisitionPath: "PURCHASE_BUILD",
        }),
      ],
    });
    const postLand = createProspectiveMatchState(preLand, {
      ownership: ["alpha"],
    });

    const resolved = resolvePersistentStructureLifecycleFromEvents(
      postLand,
      [manualOwnershipEvent()],
      1,
    );
    expect(resolved).toEqual([
      expect.objectContaining({
        id: "fort-upgrade",
        ownerId: "alpha",
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 1 },
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ]);
  });

  it("preserves N17 destruction and N07 deterministic admission through event routing", () => {
    const n17Base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "simulation-event-n17-capture",
        width: 1,
        height: 1,
        terrain: ["PLAINS"],
        initialOwners: ["beta"],
        factions: [
          { id: "alpha", rules: originRules(["N17"]) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const n17PreLand = createProspectiveMatchState(n17Base, {
      structures: [
        materializePersistentStructureState({
          id: "factory-cut",
          ownerId: "beta",
          type: "FACTORY",
          cellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
      ],
    });
    const n17PostLand = createProspectiveMatchState(n17PreLand, {
      ownership: ["alpha"],
    });
    expect(
      resolvePersistentStructureLifecycleFromEvents(
        n17PostLand,
        [manualOwnershipEvent()],
        1,
      ),
    ).toEqual([]);

    const n07Base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "simulation-event-n07-capture",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta", "gamma"],
        factions: [
          { id: "alpha", rules: originRules(["N07"]) },
          { id: "beta", rules: emptyRules() },
          { id: "gamma", rules: emptyRules() },
        ],
      }),
    );
    const n07PreLand = createProspectiveMatchState(n07Base, {
      structures: [
        materializePersistentStructureState({
          id: "factory-z",
          ownerId: "beta",
          type: "FACTORY",
          cellId: 1,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
        materializePersistentStructureState({
          id: "factory-a",
          ownerId: "gamma",
          type: "FACTORY",
          cellId: 2,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
      ],
    });
    const n07PostLand = createProspectiveMatchState(n07PreLand, {
      ownership: ["alpha", "alpha", "alpha"],
    });
    const n07Resolved = resolvePersistentStructureLifecycleFromEvents(
      n07PostLand,
      [
        createCellOwnershipChangedEvent({
          id: "capture-cell-1",
          tick: 1,
          cellId: 1,
          previousOwnerId: "beta",
          nextOwnerId: "alpha",
        }),
        createCellOwnershipChangedEvent({
          id: "capture-cell-2",
          tick: 1,
          cellId: 2,
          previousOwnerId: "gamma",
          nextOwnerId: "alpha",
        }),
      ],
      1,
    );
    expect(n07Resolved).toEqual([
      expect.objectContaining({
        id: "factory-z",
        cellId: 1,
        ownerId: "alpha",
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ]);
  });

  it("rejects out-of-range ownership facts and keeps structures unchanged on neutralization", () => {
    const postLand = postLandStructureState();
    expect(() =>
      resolvePersistentStructureLifecycleFromEvents(
        postLand,
        [
          createCellOwnershipChangedEvent({
            id: "outside-raster",
            tick: 1,
            cellId: 1,
            previousOwnerId: "beta",
            nextOwnerId: "alpha",
          }),
        ],
        1,
      ),
    ).toThrow(/outside/i);

    const neutralBase = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "simulation-event-neutralization",
        width: 1,
        height: 1,
        terrain: ["PLAINS"],
        initialOwners: ["beta"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const neutralPreLand = createProspectiveMatchState(neutralBase, {
      structures: [
        materializePersistentStructureState({
          id: "neutralized-city",
          ownerId: "beta",
          type: "CITY",
          cellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
      ],
    });
    const neutralPostLand = createProspectiveMatchState(neutralPreLand, {
      ownership: [null],
    });
    const resolved = resolvePersistentStructureLifecycleFromEvents(
      neutralPostLand,
      [
        createCellOwnershipChangedEvent({
          id: "neutralize-cell-0",
          tick: 1,
          cellId: 0,
          previousOwnerId: "beta",
          nextOwnerId: null,
        }),
      ],
      1,
    );
    expect(resolved).toEqual([
      expect.objectContaining({
        id: "neutralized-city",
        ownerId: "beta",
        acquisitionPath: "GRANT",
      }),
    ]);
  });
});
