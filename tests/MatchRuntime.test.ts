import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  InProcessTestControllerHost,
  type LawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createInitialMatchState } from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
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

    let alphaObservation: LawfulControllerObservation | undefined;
    runtime.runControllerRound(
      new InProcessTestControllerHost({
        alpha(observation) {
          alphaObservation = observation;
        },
      }),
    );

    expect(alphaObservation).toEqual({
      tick: 1,
      decisionNumber: 0,
      me: { id: "alpha", status: "ACTIVE" },
      factions: [
        { id: "alpha", status: "ACTIVE" },
        { id: "beta", status: "ACTIVE" },
      ],
    });
    expect(Object.isFrozen(alphaObservation)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.factions)).toBe(true);
    expect(Object.isFrozen(alphaObservation?.factions[0])).toBe(true);
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
      failure: { code: "INVALID_COMMAND", key: "unsupported-second" },
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
      failure: { code: "INVALID_COMMAND", key: "unsupported" },
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
});
