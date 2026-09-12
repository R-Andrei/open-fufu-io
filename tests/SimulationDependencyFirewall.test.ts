import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  resolveHostilityGraceFromEvents,
  type HostilityStateLike,
} from "../src/simulation/HostilityState";
import {
  tryApplyPersistentDirectiveChangesWithEvents,
  type LandFactionStateLike,
  type LandOperationState,
} from "../src/simulation/LandOperations";
import type { PopulationState } from "../src/simulation/Population";
import {
  createFactionCapitulatedEvent,
  createPersistentDirectedHostilitySourceEndedEvent,
} from "../src/simulation/SimulationEvents";

const FORBIDDEN_LEGACY_IMPORT_TOKENS = [
  "GameImpl",
  "PlayerImpl",
  "UnitImpl",
  "AttackImpl",
  "AttackExecution",
  "ExecutionManager",
  "GameRunner",
] as const;

function typescriptFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...typescriptFiles(path));
    } else if (extname(entry.name) === ".ts") {
      result.push(path);
    }
  }
  return result.sort();
}

function attackOperation(
  id: string,
  controllerKey: string,
  ownerId: string,
  targetFactionId: string,
): LandOperationState {
  return Object.freeze({
    id,
    controllerKey,
    kind: "ATTACK" as const,
    ownerId,
    targetFactionId,
    committedPopulation: 1,
    source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
    target: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([1]) }),
  });
}

function population(options: {
  readonly available?: number;
  readonly offensive?: number;
  readonly counter?: number;
} = {}): PopulationState {
  const available = options.available ?? 0;
  const committedOffensive = options.offensive ?? 0;
  const committedCounterResponse = options.counter ?? 0;
  const total = available + committedOffensive + committedCounterResponse;
  return Object.freeze({
    total,
    available,
    committedOffensive,
    committedCounterResponse,
    aboardTransports: 0,
    peakTotal: total,
    neutralSettlementHalfResidual: 0,
  });
}

const testRules = Object.freeze({}) as LandFactionStateLike["rules"];

function hostilityState(options: {
  readonly factions?: HostilityStateLike["factions"];
  readonly operations?: readonly LandOperationState[];
} = {}): HostilityStateLike {
  return Object.freeze({
    tick: 4,
    factions:
      options.factions ??
      Object.freeze([
        Object.freeze({ id: "alpha", status: "ACTIVE" as const }),
        Object.freeze({ id: "beta", status: "ACTIVE" as const }),
      ]),
    operations: options.operations ?? Object.freeze([]),
    hostilityGrace: Object.freeze([]),
  });
}

describe("simulation dependency firewall", () => {
  it("does not import broad inherited OpenFront runtime/domain objects", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const violations: string[] = [];

    for (const path of typescriptFiles(simulationRoot)) {
      const source = readFileSync(path, "utf8");
      const importDeclarations =
        source.match(/import[\s\S]*?from\s+["'][^"']+["'];?/g) ?? [];
      for (const declaration of importDeclarations) {
        for (const token of FORBIDDEN_LEGACY_IMPORT_TOKENS) {
          if (declaration.includes(token)) {
            violations.push(`${path}: ${token}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("routes hostility grace through canonical lifecycle events rather than snapshot reconciliation", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const events = readFileSync(join(simulationRoot, "SimulationEvents.ts"), "utf8");
    const land = readFileSync(join(simulationRoot, "LandOperations.ts"), "utf8");
    const hostility = readFileSync(join(simulationRoot, "HostilityState.ts"), "utf8");
    const tickEngine = readFileSync(join(simulationRoot, "TickEngine.ts"), "utf8");

    expect(events).toContain("PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED");
    expect(events).toContain("FACTION_CAPITULATED");
    expect(events).toContain(
      "createPersistentDirectedHostilitySourceEndedEvent",
    );
    expect(events).toContain("createFactionCapitulatedEvent");
    expect(land).toContain("tryApplyPersistentDirectiveChangesWithEvents");
    expect(hostility).toContain("resolveHostilityGraceFromEvents");
    expect(tickEngine).toContain("resolveHostilityGraceFromEvents");
    expect(tickEngine).not.toContain("reconcileHostilityGrace(");
  });

  it("materializes minimal immutable hostility lifecycle facts", () => {
    const ended = createPersistentDirectedHostilitySourceEndedEvent({
      id: "opaque-ended-source",
      tick: 5,
      sourceSide: { kind: "FACTION", id: "alpha" },
      targetSide: { kind: "FIXED_TEAM", id: "blue" },
    });
    expect(ended).toEqual({
      id: "opaque-ended-source",
      tick: 5,
      kind: "PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED",
      payload: {
        sourceSide: { kind: "FACTION", id: "alpha" },
        targetSide: { kind: "FIXED_TEAM", id: "blue" },
      },
    });
    expect(Object.keys(ended.payload).sort()).toEqual([
      "sourceSide",
      "targetSide",
    ]);
    expect(ended.payload).not.toHaveProperty("atWar");
    expect(ended.payload).not.toHaveProperty("expiresAtTickExclusive");
    expect(Object.isFrozen(ended)).toBe(true);
    expect(Object.isFrozen(ended.payload)).toBe(true);
    expect(Object.isFrozen(ended.payload.sourceSide)).toBe(true);
    expect(Object.isFrozen(ended.payload.targetSide)).toBe(true);
    expect(() =>
      createPersistentDirectedHostilitySourceEndedEvent({
        id: "same-side",
        tick: 5,
        sourceSide: { kind: "FACTION", id: "alpha" },
        targetSide: { kind: "FACTION", id: "alpha" },
      }),
    ).toThrow(/distinct|side/i);

    const capitulated = createFactionCapitulatedEvent({
      id: "opaque-capitulation",
      tick: 5,
      factionId: "alpha",
    });
    expect(capitulated).toEqual({
      id: "opaque-capitulation",
      tick: 5,
      kind: "FACTION_CAPITULATED",
      payload: { factionId: "alpha" },
    });
    expect(Object.keys(capitulated.payload)).toEqual(["factionId"]);
    expect(Object.isFrozen(capitulated)).toBe(true);
    expect(Object.isFrozen(capitulated.payload)).toBe(true);
  });

  it("starts grace only after the last current source and rejects duplicate or stale delivery", () => {
    const event = createPersistentDirectedHostilitySourceEndedEvent({
      id: "ended-alpha-beta",
      tick: 5,
      sourceSide: { kind: "FACTION", id: "alpha" },
      targetSide: { kind: "FACTION", id: "beta" },
    });

    expect(resolveHostilityGraceFromEvents(hostilityState(), [event], 5)).toEqual([
      {
        sideA: { kind: "FACTION", id: "alpha" },
        sideB: { kind: "FACTION", id: "beta" },
        expiresAtTickExclusive: 605,
      },
    ]);

    expect(
      resolveHostilityGraceFromEvents(
        hostilityState({
          operations: Object.freeze([
            attackOperation("another-attack", "another-key", "alpha", "beta"),
          ]),
        }),
        [event],
        5,
      ),
    ).toEqual([]);

    expect(() =>
      resolveHostilityGraceFromEvents(hostilityState(), [event, event], 5),
    ).toThrow(/duplicate/i);
    expect(() =>
      resolveHostilityGraceFromEvents(
        hostilityState(),
        [
          createPersistentDirectedHostilitySourceEndedEvent({
            id: "stale-ended-alpha-beta",
            tick: 4,
            sourceSide: { kind: "FACTION", id: "alpha" },
            targetSide: { kind: "FACTION", id: "beta" },
          }),
        ],
        5,
      ),
    ).toThrow(/tick/i);
  });

  it("preserves ended COUNTER_RESPONSE side identity after its incoming ATTACK disappears", () => {
    const factions = Object.freeze([
      Object.freeze({
        id: "alpha",
        status: "ACTIVE" as const,
        rules: testRules,
        population: population({ offensive: 1 }),
      }),
      Object.freeze({
        id: "beta",
        status: "ACTIVE" as const,
        rules: testRules,
        population: population({ counter: 1 }),
      }),
    ]);
    const attack = attackOperation(
      "attack-alpha-beta",
      "alpha-attack",
      "alpha",
      "beta",
    );
    const counter = Object.freeze({
      id: "counter-beta-alpha",
      controllerKey: "beta-counter",
      kind: "COUNTER_RESPONSE" as const,
      ownerId: "beta",
      incomingOperationId: attack.id,
      committedPopulation: 1,
    });
    const state = Object.freeze({
      factions,
      operations: Object.freeze([attack, counter]),
      defensePriorities: Object.freeze([]),
    });

    const applied = tryApplyPersistentDirectiveChangesWithEvents(
      state,
      "alpha",
      { end: ["alpha-attack"] },
      { transitionTick: 5, acceptedInputSequence: 7 },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.operations).toEqual([counter]);
    expect(applied.events).toHaveLength(2);
    expect(applied.events.map((event) => event.payload)).toEqual([
      {
        sourceSide: { kind: "FACTION", id: "alpha" },
        targetSide: { kind: "FACTION", id: "beta" },
      },
      {
        sourceSide: { kind: "FACTION", id: "beta" },
        targetSide: { kind: "FACTION", id: "alpha" },
      },
    ]);
    expect(new Set(applied.events.map((event) => event.id)).size).toBe(2);
    expect(applied.events.every((event) => event.tick === 5)).toBe(true);

    const repeated = tryApplyPersistentDirectiveChangesWithEvents(
      state,
      "alpha",
      { end: ["alpha-attack"] },
      { transitionTick: 5, acceptedInputSequence: 7 },
    );
    expect(repeated).toEqual(applied);

    const differentSequence = tryApplyPersistentDirectiveChangesWithEvents(
      state,
      "alpha",
      { end: ["alpha-attack"] },
      { transitionTick: 5, acceptedInputSequence: 8 },
    );
    expect(differentSequence.ok).toBe(true);
    if (!differentSequence.ok) return;
    expect(differentSequence.events.map((event) => event.id)).not.toEqual(
      applied.events.map((event) => event.id),
    );
  });

  it("derives capitulation consequences from current team state without embedding policy in the fact", () => {
    const teamState = hostilityState({
      factions: Object.freeze([
        Object.freeze({
          id: "alpha",
          status: "CAPITULATED" as const,
          fixedTeamId: "red",
        }),
        Object.freeze({
          id: "bravo",
          status: "ACTIVE" as const,
          fixedTeamId: "red",
        }),
        Object.freeze({
          id: "charlie",
          status: "ACTIVE" as const,
          fixedTeamId: "blue",
        }),
      ]),
      operations: Object.freeze([
        attackOperation("alpha-attack", "alpha-key", "alpha", "charlie"),
      ]),
    });
    const teamEvent = createFactionCapitulatedEvent({
      id: "capitulated-alpha-team",
      tick: 5,
      factionId: "alpha",
    });
    expect(resolveHostilityGraceFromEvents(teamState, [teamEvent], 5)).toEqual([
      {
        sideA: { kind: "FIXED_TEAM", id: "blue" },
        sideB: { kind: "FIXED_TEAM", id: "red" },
        expiresAtTickExclusive: 605,
      },
    ]);

    const finalSideState = hostilityState({
      factions: Object.freeze([
        Object.freeze({ id: "alpha", status: "CAPITULATED" as const }),
        Object.freeze({ id: "beta", status: "ACTIVE" as const }),
      ]),
      operations: Object.freeze([
        attackOperation("alpha-attack", "alpha-key", "alpha", "beta"),
      ]),
    });
    const finalSideEvent = createFactionCapitulatedEvent({
      id: "capitulated-alpha-final",
      tick: 5,
      factionId: "alpha",
    });
    expect(
      resolveHostilityGraceFromEvents(finalSideState, [finalSideEvent], 5),
    ).toEqual([]);
  });
});
