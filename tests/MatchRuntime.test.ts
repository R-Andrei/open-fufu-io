import type {
  ControllerMemory,
  SpawnInfluenceContext,
  SpawnOriginContext,
  SpawnReconsiderContext,
} from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  InProcessTestControllerHost,
  type LawfulControllerObservation,
  type LawfulInProcessControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { tryMaterializeStructureGrant } from "../src/simulation/Structures";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function twoFactionRuntime(seed = "controller-runtime") {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function ordinaryObservation(): LawfulControllerObservation {
  return Object.freeze({
    tick: 0,
    decisionNumber: 0,
    me: Object.freeze({
      id: "alpha",
      status: "ACTIVE" as const,
      population: Object.freeze({
        total: 0,
        available: 0,
        committedOffense: 0,
        committedCounterResponse: 0,
        aboardTransports: 0,
        neutralSettlementHalfResidual: 0,
      }),
    }),
    factions: Object.freeze([{ id: "alpha", status: "ACTIVE" as const }]),
  });
}

describe("authoritative MatchRuntime walking skeleton", () => {
  it("constructs a tiny deterministic match with two faction-local effective-rule profiles", () => {
    const alphaRules = emptyRules();
    const betaRules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "walking-skeleton",
      width: 3,
      height: 2,
      factions: [
        { id: "alpha", rules: alphaRules },
        { id: "beta", rules: betaRules },
      ],
    });

    const runtime = new MatchRuntime(spec);
    const state = runtime.snapshot();

    expect(state.tick).toBe(0);
    expect(state.map).toEqual({
      width: 3,
      height: 2,
      terrain: ["TEST", "TEST", "TEST", "TEST", "TEST", "TEST"],
    });
    expect(state.factions.map((faction) => faction.id)).toEqual(["alpha", "beta"]);
    expect(state.factions.map((faction) => faction.status)).toEqual([
      "ACTIVE",
      "ACTIVE",
    ]);
    expect(state.factions[0]?.rules).toBe(alphaRules);
    expect(state.factions[1]?.rules).toBe(betaRules);
  });

  it("applies pending accepted inputs for validation without advancing simulation time", () => {
    const rules = emptyRules();
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "prospective-input-state",
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );

    const preview = new TickEngine().applyAcceptedInputs(state, [
      {
        tick: 1,
        sequence: 0,
        action: { type: "GRANT_POPULATION", factionId: "alpha", amount: 3 },
      },
    ]);

    expect(preview.tick).toBe(0);
    expect(preview.factions[0]?.population.available).toBe(3);
    expect(state.tick).toBe(0);
    expect(state.factions[0]?.population.available).toBe(0);
  });

  it("accepts a deterministic foundation action and applies it on the next tick", () => {
    const runtime = twoFactionRuntime();

    const accepted = runtime.acceptAction({
      type: "SET_TEST_MARKER",
      factionId: "beta",
      value: 17,
    });

    expect(accepted).toEqual({
      tick: 1,
      sequence: 0,
      action: { type: "SET_TEST_MARKER", factionId: "beta", value: 17 },
    });
    expect(runtime.snapshot().factions[1]?.testMarker).toBe(0);

    runtime.tick();

    expect(runtime.snapshot().tick).toBe(1);
    expect(runtime.snapshot().factions[1]?.testMarker).toBe(17);
  });

  it("projects immutable requester-lawful controller observations without foundation-private fields", () => {
    const runtime = twoFactionRuntime();
    runtime.acceptAction({
      type: "SET_TEST_MARKER",
      factionId: "beta",
      value: 73,
    });
    runtime.tick();

    let alphaObservation: LawfulInProcessControllerObservation | undefined;
    runtime.runControllerRound(
      new InProcessTestControllerHost({
        alpha(observation) {
          alphaObservation = observation;
        },
      }),
    );

    expect(alphaObservation).toMatchObject({
      tick: 1,
      decisionNumber: 0,
      me: {
        id: "alpha",
        status: "ACTIVE",
        population: {
          total: 0,
          available: 0,
          committedOffense: 0,
          committedCounterResponse: 0,
          aboardTransports: 0,
          neutralSettlementHalfResidual: 0,
        },
      },
      factions: [
        { id: "alpha", status: "ACTIVE" },
        { id: "beta", status: "ACTIVE" },
      ],
    });
    expect(alphaObservation?.map?.cellCount).toBe(4);
    expect(alphaObservation?.cells?.owner(0)).toBeNull();
    expect(alphaObservation?.segments?.cellIds(0)).toBeUndefined();
    expect(Object.isFrozen(alphaObservation)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.me)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.me.population)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.factions)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.factions[0])).toBe(true);
    expect(Object.isFrozen(alphaObservation?.map)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.cells)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.segments)).toBe(true);
    expect(JSON.stringify(alphaObservation)).not.toContain("testMarker");
    expect(JSON.stringify(alphaObservation)).not.toContain("canonicalSerialization");
    expect(JSON.stringify(alphaObservation)).not.toContain("rules");
  });

  it("invokes simultaneous controllers from the same frozen snapshot in stable faction order", () => {
    const first = twoFactionRuntime("simultaneous-a");
    const second = twoFactionRuntime("simultaneous-a");
    const firstSeen: string[] = [];
    const secondSeen: string[] = [];

    const controllers = {
      beta(observation: LawfulControllerObservation) {
        secondSeen.push(`beta:${observation.factions.map((f) => f.status).join(",")}`);
        return { commands: [{ kind: "CAPITULATE" as const, key: "beta-out" }] };
      },
      alpha(observation: LawfulControllerObservation) {
        firstSeen.push(`alpha:${observation.factions.map((f) => f.status).join(",")}`);
        return { commands: [{ kind: "CAPITULATE" as const, key: "alpha-out" }] };
      },
    };

    first.runControllerRound(new InProcessTestControllerHost(controllers));
    second.runControllerRound(
      new InProcessTestControllerHost({ alpha: controllers.alpha, beta: controllers.beta }),
    );

    expect(first.acceptedInputs()).toEqual(second.acceptedInputs());
    expect(first.acceptedInputs().map((input) => input.action)).toEqual([
      { type: "CAPITULATE_FACTION", factionId: "alpha" },
      { type: "CAPITULATE_FACTION", factionId: "beta" },
    ]);
    expect(firstSeen).toEqual([
      "alpha:ACTIVE,ACTIVE",
      "alpha:ACTIVE,ACTIVE",
    ]);
    expect(secondSeen).toEqual([
      "beta:ACTIVE,ACTIVE",
      "beta:ACTIVE,ACTIVE",
    ]);

    first.tick();
    second.tick();
    expect(first.stateFingerprint()).toBe(second.stateFingerprint());
    expect(first.snapshot().factions.map((faction) => faction.status)).toEqual([
      "CAPITULATED",
      "CAPITULATED",
    ]);
  });

  it("rejects an illegal mixed proposal atomically without recording partial authoritative input", () => {
    const runtime = twoFactionRuntime();
    const receipts = runtime.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            commands: [
              { kind: "CAPITULATE", key: "valid-first" },
              {
                kind: "BUILD_STRUCTURE",
                key: "unsupported-second",
                structure: "CITY",
                cellId: 0,
              },
            ],
          };
        },
      }),
    );

    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt).toEqual({
      decisionNumber: 0,
      accepted: false,
      failure: { code: "CELL_NOT_OWNED", key: "unsupported-second" },
      faultCount: 0,
      faulted: false,
    });
    expect(runtime.acceptedInputs()).toEqual([]);

    runtime.tick();
    expect(runtime.snapshot().factions[0]?.status).toBe("ACTIVE");
  });

  it("materializes accepted controller commands before replay recording and regenerates exactly", () => {
    const runtime = twoFactionRuntime("controller-replay");
    const decision = {
      commands: [{ kind: "CAPITULATE" as const, key: "leave" }],
    };
    runtime.runControllerRound(
      new InProcessTestControllerHost({ alpha: () => decision }),
    );

    decision.commands[0].key = "mutated-after-return";
    expect(runtime.acceptedInputs()).toEqual([
      {
        tick: 1,
        sequence: 0,
        action: { type: "CAPITULATE_FACTION", factionId: "alpha" },
      },
    ]);

    runtime.tick();
    const regenerated = MatchRuntime.regenerate(
      runtime.spec,
      runtime.acceptedInputs(),
      runtime.snapshot().tick,
    );
    expect(regenerated.snapshot()).toEqual(runtime.snapshot());
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
  });

  it("surfaces the previous decision receipt on the next eligible controller observation", () => {
    const runtime = twoFactionRuntime();
    runtime.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            commands: [
              {
                kind: "BUILD_STRUCTURE",
                key: "unsupported",
                structure: "CITY",
                cellId: 0,
              },
            ],
          };
        },
      }),
    );
    runtime.tick();

    let seen: LawfulControllerObservation | undefined;
    runtime.runControllerRound(
      new InProcessTestControllerHost({
        alpha(observation) {
          seen = observation;
        },
      }),
    );

    expect(seen?.lastDecision).toEqual({
      decisionNumber: 0,
      accepted: false,
      failure: { code: "CELL_NOT_OWNED", key: "unsupported" },
      faultCount: 0,
      faulted: false,
    });
  });

  it("regenerates an equivalent fresh runtime from MatchSpec plus accepted inputs", () => {
    const rules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "replay-proof",
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });
    const original = new MatchRuntime(spec);

    original.acceptAction({ type: "SET_TEST_MARKER", factionId: "alpha", value: 4 });
    original.acceptAction({ type: "SET_TEST_MARKER", factionId: "beta", value: 9 });
    original.tick();
    original.tick();

    const regenerated = MatchRuntime.regenerate(
      spec,
      original.acceptedInputs(),
      original.snapshot().tick,
    );

    expect(regenerated.snapshot()).toEqual(original.snapshot());
    expect(regenerated.stateFingerprint()).toBe(original.stateFingerprint());
    expect(regenerated.acceptedInputs()).toEqual(original.acceptedInputs());
  });

  it("rejects malformed skeleton specs and invalid accepted actions", () => {
    const rules = emptyRules();

    expect(
      () =>
        new MatchRuntime(
          createMicroSimulationSpec({ factions: [{ id: "only", rules }] }),
        ),
    ).toThrow(/at least two factions/i);

    const runtime = twoFactionRuntime();

    expect(() =>
      runtime.acceptAction({
        type: "SET_TEST_MARKER",
        factionId: "missing",
        value: 1,
      }),
    ).toThrow(/unknown faction/i);
    expect(() =>
      runtime.acceptAction({
        type: "SET_TEST_MARKER",
        factionId: "alpha",
        value: Number.NaN,
      }),
    ).toThrow(/finite integer/i);
  });

  it("executes all Strategic Spawn hooks through the same immutable host memory boundary", () => {
    const seen: Array<{
      hook: string;
      memory: ControllerMemory;
      contextFrozen: boolean;
      memoryFrozen: boolean;
    }> = [];

    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence(context: SpawnInfluenceContext) {
          seen.push({
            hook: context.phase,
            memory: { ...context.memory },
            contextFrozen: Object.isFrozen(context),
            memoryFrozen: Object.isFrozen(context.memory),
          });
          return {
            centers: [11],
            memory: { phase: "influence", discardedLater: true },
          };
        },
        reconsiderInfluence(context: SpawnReconsiderContext) {
          seen.push({
            hook: context.phase,
            memory: { ...context.memory },
            contextFrozen: Object.isFrozen(context),
            memoryFrozen: Object.isFrozen(context.memory),
          });
          return { centers: [12], memory: { phase: "reconsider" } };
        },
        chooseOrigins(context: SpawnOriginContext) {
          seen.push({
            hook: context.phase,
            memory: { ...context.memory },
            contextFrozen: Object.isFrozen(context),
            memoryFrozen: Object.isFrozen(context.memory),
          });
          return { origins: [13] };
        },
        decide(
          observation: LawfulControllerObservation & {
            readonly memory: Readonly<ControllerMemory>;
          },
        ) {
          seen.push({
            hook: "DECIDE",
            memory: { ...observation.memory },
            contextFrozen: Object.isFrozen(observation),
            memoryFrozen: Object.isFrozen(observation.memory),
          });
          return { commands: [], memory: { phase: "decide" } };
        },
      },
    });

    const influence = host.chooseInfluence(
      "alpha",
      {
        phase: "INFLUENCE",
        memory: { callerSupplied: "must-not-win" },
      } as unknown as SpawnInfluenceContext,
    );
    const reconsider = host.reconsiderInfluence(
      "alpha",
      {
        phase: "RECONSIDER",
        memory: { callerSupplied: "must-not-win" },
        currentInfluenceCenters: [11],
        revealedFactions: [],
      } as unknown as SpawnReconsiderContext,
    );
    const origins = host.chooseOrigins(
      "alpha",
      {
        phase: "ORIGIN",
        memory: { callerSupplied: "must-not-win" },
        influenceCenters: [12],
        revealedFactions: [],
        spawn: {},
      } as unknown as SpawnOriginContext,
    );
    const decision = host.invoke("alpha", ordinaryObservation());

    expect(influence).toEqual({
      ok: true,
      output: {
        centers: [11],
        memory: { phase: "influence", discardedLater: true },
      },
    });
    expect(reconsider).toEqual({
      ok: true,
      output: { centers: [12], memory: { phase: "reconsider" } },
    });
    expect(origins).toEqual({ ok: true, output: { origins: [13] } });
    expect(decision).toEqual({
      ok: true,
      output: { commands: [], memory: { phase: "decide" } },
    });
    expect(seen).toEqual([
      {
        hook: "INFLUENCE",
        memory: {},
        contextFrozen: true,
        memoryFrozen: true,
      },
      {
        hook: "RECONSIDER",
        memory: { phase: "influence", discardedLater: true },
        contextFrozen: true,
        memoryFrozen: true,
      },
      {
        hook: "ORIGIN",
        memory: { phase: "reconsider" },
        contextFrozen: true,
        memoryFrozen: true,
      },
      {
        hook: "DECIDE",
        memory: { phase: "reconsider" },
        contextFrozen: true,
        memoryFrozen: true,
      },
    ]);
    expect(Object.isFrozen(influence)).toBe(true);
    expect(Object.isFrozen(reconsider)).toBe(true);
    expect(Object.isFrozen(origins)).toBe(true);
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it("normalizes Spawn hook faults and invalid memory while preserving prior committed memory", () => {
    let decideMemory: ControllerMemory | undefined;
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence() {
          return { centers: [11], memory: { stable: 1 } };
        },
        reconsiderInfluence() {
          throw new Error("controller failure");
        },
        chooseOrigins() {
          return { origins: [13], memory: { invalid: Number.NaN } };
        },
        decide(
          observation: LawfulControllerObservation & {
            readonly memory: Readonly<ControllerMemory>;
          },
        ) {
          decideMemory = { ...observation.memory };
          return { commands: [] };
        },
      },
    });

    expect(
      host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as unknown as SpawnInfluenceContext,
      ),
    ).toEqual({
      ok: true,
      output: { centers: [11], memory: { stable: 1 } },
    });
    expect(
      host.reconsiderInfluence(
        "alpha",
        {
          phase: "RECONSIDER",
          memory: {},
          currentInfluenceCenters: [11],
          revealedFactions: [],
        } as unknown as SpawnReconsiderContext,
      ),
    ).toEqual({ ok: false, fault: { code: "RUNTIME_ERROR" } });
    expect(
      host.chooseOrigins(
        "alpha",
        {
          phase: "ORIGIN",
          memory: {},
          influenceCenters: [11],
          revealedFactions: [],
          spawn: {},
        } as unknown as SpawnOriginContext,
      ),
    ).toEqual({ ok: false, fault: { code: "RUNTIME_ERROR" } });

    expect(host.invoke("alpha", ordinaryObservation())).toEqual({
      ok: true,
      output: { commands: [] },
    });
    expect(decideMemory).toEqual({ stable: 1 });
  });
});

describe("persistent structure grant foundation", () => {
  it("materializes a legal deterministic initialization GRANT as an active completed structure", () => {
    const rules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "initial-structure-grant",
      width: 2,
      height: 2,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "beta", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-silo",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 0,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });

    const runtime = new MatchRuntime(spec);

    expect(runtime.snapshot().structures).toEqual([
      {
        id: "alpha-silo",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
        completedLevel: 1,
        active: true,
        chargeSlots: [{ slotId: 0, state: "READY" }],
        acquisitionPath: "GRANT",
      },
    ]);
  });

  it("evaluates the N07 hard ownership cap before mutation", () => {
    const alphaRules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["N07"]),
    );
    const betaRules = emptyRules();
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "structure-cap",
        width: 2,
        height: 2,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "beta", "beta"],
        factions: [
          { id: "alpha", rules: alphaRules },
          { id: "beta", rules: betaRules },
        ],
      }),
    );

    const first = tryMaterializeStructureGrant(state, {
      structureId: "alpha-city-1",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      level: 1,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.failure.code);

    const withFirst = createProspectiveMatchState(state, {
      structures: first.structures,
    });
    const beforeSecond = withFirst.structures;
    const second = tryMaterializeStructureGrant(withFirst, {
      structureId: "alpha-city-2",
      ownerId: "alpha",
      type: "CITY",
      cellId: 1,
      level: 1,
    });

    expect(second).toEqual({
      ok: false,
      failure: { code: "OWNERSHIP_CAP" },
    });
    expect(withFirst.structures).toBe(beforeSecond);
    expect(withFirst.structures).toHaveLength(1);
  });

  it("rejects an occupied exact grant cell without partial mutation", () => {
    const rules = emptyRules();
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "structure-occupancy",
        width: 2,
        height: 2,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "beta", "beta"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const first = tryMaterializeStructureGrant(state, {
      structureId: "alpha-fort",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
      level: 1,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.failure.code);

    const withFirst = createProspectiveMatchState(state, {
      structures: first.structures,
    });
    const beforeSecond = withFirst.structures;
    const second = tryMaterializeStructureGrant(withFirst, {
      structureId: "alpha-city",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      level: 1,
    });

    expect(second).toEqual({
      ok: false,
      failure: { code: "CELL_OCCUPIED" },
    });
    expect(withFirst.structures).toBe(beforeSecond);
    expect(withFirst.structures).toEqual(first.structures);
  });

  it("fingerprints and regenerates initialization GRANT state exactly", () => {
    const rules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "structure-replay",
      width: 2,
      height: 2,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "beta", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-silo",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 0,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });
    const runtime = new MatchRuntime(spec);
    const regenerated = MatchRuntime.regenerate(spec, [], 0);

    expect(regenerated.snapshot()).toEqual(runtime.snapshot());
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
    expect(JSON.parse(runtime.stateFingerprint()).structures).toEqual([
      {
        id: "alpha-silo",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
        completedLevel: 1,
        active: true,
        chargeSlots: [{ slotId: 0, state: "READY" }],
        acquisitionPath: "GRANT",
      },
    ]);
  });
});
