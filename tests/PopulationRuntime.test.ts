import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function runtime(seed = "population-runtime") {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
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

describe("Population integration through MatchRuntime", () => {
  it("initializes canonical zero Population inside the authoritative faction state", () => {
    expect(runtime().snapshot().factions[0]?.population).toEqual({
      total: 0,
      available: 0,
      committedOffensive: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 0,
      neutralSettlementHalfResidual: 0,
    });
  });

  it("validates accounting against already-pending same-tick inputs", () => {
    const match = runtime();

    match.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 5,
    });
    match.acceptAction({
      type: "REPARTITION_POPULATION",
      factionId: "alpha",
      from: "AVAILABLE",
      to: "OFFENSIVE",
      amount: 4,
    });

    expect(() =>
      match.acceptAction({
        type: "REMOVE_POPULATION",
        factionId: "alpha",
        from: "AVAILABLE",
        amount: 2,
      }),
    ).toThrow(/insufficient available Population/i);
    expect(match.acceptedInputs()).toHaveLength(2);

    match.tick();
    expect(match.snapshot().factions[0]?.population).toEqual({
      total: 5,
      available: 1,
      committedOffensive: 4,
      committedCounterResponse: 0,
      aboardTransports: 0,
      peakTotal: 5,
      neutralSettlementHalfResidual: 0,
    });
  });

  it("regenerates equivalent Population state from representative accounting inputs", () => {
    const original = runtime("population-replay-proof");

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
      original.spec,
      original.acceptedInputs(),
      original.snapshot().tick,
    );
    expect(regenerated.snapshot()).toEqual(original.snapshot());
    expect(regenerated.stateFingerprint()).toBe(original.stateFingerprint());
    expect(regenerated.acceptedInputs()).toEqual(original.acceptedInputs());
  });

  it("rejects illegal Population inputs before they enter the accepted log", () => {
    const match = runtime();

    expect(() =>
      match.acceptAction({
        type: "GRANT_POPULATION",
        factionId: "alpha",
        amount: -1,
      }),
    ).toThrow(/non-negative safe integer/i);
    expect(() =>
      match.acceptAction({
        type: "TRANSFER_POPULATION",
        sourceFactionId: "alpha",
        recipientFactionId: "alpha",
        sourceBucket: "AVAILABLE",
        amount: 0,
      }),
    ).toThrow(/distinct factions/i);
    expect(match.acceptedInputs()).toEqual([]);
  });
});
