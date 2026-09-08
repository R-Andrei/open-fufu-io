import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
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
    expect(state.factions[0]?.rules).toBe(alphaRules);
    expect(state.factions[1]?.rules).toBe(betaRules);
    expect(state.factions[0]?.population).toEqual({
      total: 0,
      available: 0,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 0,
      neutralSettlementHalfResidual: 0,
    });
  });

  it("accepts a deterministic foundation action and applies it on the next tick", () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );

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

  it("validates Population accounting against already-pending same-tick inputs", () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );

    runtime.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 5,
    });
    runtime.acceptAction({
      type: "REPARTITION_POPULATION",
      factionId: "alpha",
      from: "AVAILABLE",
      to: "OFFENSIVE",
      amount: 4,
    });

    expect(() =>
      runtime.acceptAction({
        type: "REMOVE_POPULATION",
        factionId: "alpha",
        from: "AVAILABLE",
        amount: 2,
      }),
    ).toThrow(/insufficient available Population/i);
    expect(runtime.acceptedInputs()).toHaveLength(2);

    runtime.tick();

    expect(runtime.snapshot().factions[0]?.population).toEqual({
      total: 5,
      available: 1,
      committedOffensive: 4,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 5,
      neutralSettlementHalfResidual: 0,
    });
  });

  it("regenerates equivalent Population state from representative accepted accounting inputs", () => {
    const rules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "population-replay-proof",
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });
    const original = new MatchRuntime(spec);

    original.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 5,
    });
    original.acceptAction({
      type: "REPARTITION_POPULATION",
      factionId: "alpha",
      from: "AVAILABLE",
      to: "OFFENSIVE",
      amount: 4,
    });
    original.tick();

    original.acceptAction({
      type: "TRANSFER_POPULATION",
      sourceFactionId: "alpha",
      recipientFactionId: "beta",
      sourceBucket: "OFFENSIVE",
      amount: 3,
    });
    original.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "beta",
      amount: 2,
    });
    original.tick();

    original.acceptAction({
      type: "REMOVE_POPULATION",
      factionId: "beta",
      from: "AVAILABLE",
      amount: 1,
    });
    original.tick();

    expect(original.snapshot().factions[0]?.population).toEqual({
      total: 2,
      available: 1,
      committedOffensive: 1,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 5,
      neutralSettlementHalfResidual: 0,
    });
    expect(original.snapshot().factions[1]?.population).toEqual({
      total: 4,
      available: 4,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 5,
      neutralSettlementHalfResidual: 0,
    });

    const regenerated = MatchRuntime.regenerate(
      spec,
      original.acceptedInputs(),
      original.snapshot().tick,
    );

    expect(regenerated.snapshot()).toEqual(original.snapshot());
    expect(regenerated.stateFingerprint()).toBe(original.stateFingerprint());
    expect(regenerated.acceptedInputs()).toEqual(original.acceptedInputs());
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

    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );

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
    expect(() =>
      runtime.acceptAction({
        type: "GRANT_POPULATION",
        factionId: "alpha",
        amount: -1,
      }),
    ).toThrow(/non-negative safe integer/i);
    expect(() =>
      runtime.acceptAction({
        type: "TRANSFER_POPULATION",
        sourceFactionId: "alpha",
        recipientFactionId: "alpha",
        sourceBucket: "AVAILABLE",
        amount: 0,
      }),
    ).toThrow(/distinct factions/i);
  });
});
