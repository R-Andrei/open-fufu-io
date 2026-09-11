import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
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
import * as SimulationEvents from "../src/simulation/SimulationEvents";
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

type CellOwnershipChangedEventLike = Readonly<{
  id: string;
  tick: number;
  kind: "CELL_OWNERSHIP_CHANGED";
  payload: Readonly<{
    cellId: number;
    previousOwnerId: string | null;
    nextOwnerId: string | null;
  }>;
}>;

type CreateCellOwnershipChangedEventLike = (input: {
  readonly id: string;
  readonly tick: number;
  readonly cellId: number;
  readonly previousOwnerId: string | null;
  readonly nextOwnerId: string | null;
}) => CellOwnershipChangedEventLike;

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function manualOwnershipEvent(
  overrides: Partial<{
    id: string;
    tick: number;
    cellId: number;
    previousOwnerId: string | null;
    nextOwnerId: string | null;
  }> = {},
): CellOwnershipChangedEventLike {
  return Object.freeze({
    id: overrides.id ?? "ownership-change",
    tick: overrides.tick ?? 1,
    kind: "CELL_OWNERSHIP_CHANGED" as const,
    payload: Object.freeze({
      cellId: overrides.cellId ?? 0,
      previousOwnerId: overrides.previousOwnerId ?? "beta",
      nextOwnerId: overrides.nextOwnerId ?? "alpha",
    }),
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
      width: 3,
      height: 1,
      terrain: ["TEST", "TEST", "TEST"],
      initialOwners: ["alpha", null, null],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "alpha",
    amount: 2,
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
                key: "capture-two",
                operation: "NEUTRAL_EXPANSION",
                population: 1,
                source: { kind: "CELLS", ids: [0] },
                target: { kind: "CELLS", ids: [2] },
              },
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
    }),
  );
  expect(
    receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
  ).toBe(true);
  match.tick();
  const snapshot = match.snapshot() as MatchState;
  expect(snapshot.ownership).toEqual(["alpha", null, null]);
  return createProspectiveMatchState(snapshot, {
    captureProgress: [
      {
        cellId: 2,
        claimantFactionId: "alpha",
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
  readonly events: readonly CellOwnershipChangedEventLike[];
};

const resolveStructureLifecycleFromEvents =
  resolvePersistentStructureLifecycleTick as unknown as (
    state: MatchState,
    events: readonly CellOwnershipChangedEventLike[],
    currentTick: number,
  ) => ReturnType<typeof resolvePersistentStructureLifecycleTick>;

describe("deterministic simulation events", () => {
  it("materializes an immutable lifecycle-safe resolved attack fact", () => {
    const event = SimulationEvents.createUnitAttackResolvedEvent({
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

    const event = SimulationEvents.createUnitDestroyedEvent({
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
    const factory = (
      SimulationEvents as unknown as Record<string, unknown>
    ).createCellOwnershipChangedEvent;
    expect(typeof factory).toBe("function");
    const create = factory as CreateCellOwnershipChangedEventLike;

    const event = create({
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
      create({
        id: "to-neutral",
        tick: 10,
        cellId: 4,
        previousOwnerId: "alpha",
        nextOwnerId: null,
      }).payload.nextOwnerId,
    ).toBeNull();
    expect(() =>
      create({
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

    expect(Array.isArray(first.events)).toBe(true);
    expect(first.events).toEqual(second.events);
    expect(first.events.map((event) => event.payload.cellId)).toEqual([1, 2]);
    expect(first.events.every((event) => event.tick === transitionTick)).toBe(true);
    expect(new Set(first.events.map((event) => event.id)).size).toBe(2);
    expect(first.ownership).toEqual(["alpha", "alpha", "alpha"]);
  });

  it("makes persistent-structure capture depend on the explicit ownership event batch", () => {
    const postLand = postLandStructureState();

    const withoutEvent = resolveStructureLifecycleFromEvents(postLand, [], 1);
    expect(withoutEvent).toEqual([
      expect.objectContaining({
        id: "captured-city",
        ownerId: "beta",
        acquisitionPath: "GRANT",
      }),
    ]);

    const withEvent = resolveStructureLifecycleFromEvents(
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
      resolveStructureLifecycleFromEvents(postLand, [event, event], 1),
    ).toThrow(/duplicate/i);
    expect(() =>
      resolveStructureLifecycleFromEvents(
        postLand,
        [manualOwnershipEvent({ tick: 2 })],
        1,
      ),
    ).toThrow(/tick/i);
    expect(() =>
      resolveStructureLifecycleFromEvents(
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
    const resolved = resolveStructureLifecycleFromEvents(
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
});
