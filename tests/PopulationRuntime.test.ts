import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import type { StructureGrantRequest } from "../src/simulation/Structures";

function rulesWith(
  traitIds: readonly OriginTraitId[] = [],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function runtime(seed = "population-runtime") {
  const rules = rulesWith();
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

function economyRuntime(options: {
  readonly seed?: string;
  readonly alphaRules?: ReturnType<typeof rulesWith>;
  readonly width?: number;
  readonly height?: number;
  readonly terrain?: readonly string[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialStructureGrants?: readonly StructureGrantRequest[];
} = {}) {
  const emptyRules = rulesWith();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed: options.seed ?? "economy-runtime",
      width: options.width,
      height: options.height,
      terrain: options.terrain,
      initialOwners: options.initialOwners,
      initialStructureGrants: options.initialStructureGrants,
      factions: [
        { id: "alpha", rules: options.alphaRules ?? emptyRules },
        { id: "beta", rules: emptyRules },
      ],
    }),
  );
}

function factionFfy(match: MatchRuntime, factionId = "alpha"): number | undefined {
  const faction = match.snapshot().factions.find((entry) => entry.id === factionId) as
    | { readonly ffy?: number }
    | undefined;
  return faction?.ffy;
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

describe("FFY economy integration through MatchRuntime", () => {
  it("initializes every faction with the canonical 25,000 authoritative FFY", () => {
    const match = economyRuntime();

    expect(factionFfy(match, "alpha")).toBe(25_000);
    expect(factionFfy(match, "beta")).toBe(25_000);
  });

  it("accrues baseline passive FFY at exactly 100 FFY per 10 Hz tick", () => {
    const match = economyRuntime();

    match.tick();
    expect(factionFfy(match)).toBe(25_100);
    for (let index = 0; index < 9; index += 1) match.tick();
    expect(factionFfy(match)).toBe(26_000);
  });

  it("samples accepted same-tick status and Population before passive earning", () => {
    const populationMatch = economyRuntime({
      alphaRules: rulesWith(["P52"]),
      width: 5_000,
      height: 1,
      terrain: Array.from({ length: 5_000 }, () => "PLAINS"),
      initialOwners: Array.from({ length: 5_000 }, () => "alpha"),
    });
    populationMatch.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 2_500,
    });
    populationMatch.tick();
    expect(factionFfy(populationMatch)).toBe(25_101);

    const capitulated = economyRuntime();
    capitulated.acceptAction({ type: "CAPITULATE_FACTION", factionId: "alpha" });
    capitulated.tick();
    expect(capitulated.snapshot().factions[0]?.status).toBe("CAPITULATED");
    expect(factionFfy(capitulated)).toBe(25_000);
  });

  it("implements P52 as an independent exact passive source with no fractional carry", () => {
    const exact = economyRuntime({
      alphaRules: rulesWith(["P52"]),
      width: 2_500,
      height: 1,
      terrain: Array.from({ length: 2_500 }, () => "PLAINS"),
      initialOwners: Array.from({ length: 2_500 }, () => "alpha"),
    });
    exact.tick();
    expect(factionFfy(exact)).toBe(25_101);

    const fractional = economyRuntime({
      alphaRules: rulesWith(["P52"]),
      width: 2_499,
      height: 1,
      terrain: Array.from({ length: 2_499 }, () => "PLAINS"),
      initialOwners: Array.from({ length: 2_499 }, () => "alpha"),
    });
    for (let index = 0; index < 10; index += 1) fractional.tick();
    expect(factionFfy(fractional)).toBe(26_000);
  });

  it("implements P53 from READY charges on owned active persistent Missile Silos", () => {
    const match = economyRuntime({
      alphaRules: rulesWith(["P53"]),
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-silo",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 0,
          level: 1,
        },
      ],
    });

    match.tick();
    expect(factionFfy(match)).toBe(25_300);
  });

  it("applies Echo then contextual Desert-share yield to each global passive source", () => {
    const echo = echoRuleContribution(
      "ffy.all",
      "BENEFICIAL",
      5_000,
      "echo:test-ffy-all",
    );
    const match = economyRuntime({
      alphaRules: rulesWith(["P53"], [echo]),
      width: 2,
      height: 1,
      terrain: ["DESERT", "DESERT"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-silo",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 0,
          level: 1,
        },
      ],
    });

    match.tick();
    expect(factionFfy(match)).toBe(25_477);
  });

  it("uses P48 population-bearing Shallow Water in both P52 Capacity and Desert-share denominator", () => {
    const terrain = [
      ...Array.from({ length: 1_250 }, () => "DESERT"),
      ...Array.from({ length: 1_250 }, () => "SHALLOW_WATER"),
    ];
    const match = economyRuntime({
      alphaRules: rulesWith(["P48", "P52"]),
      width: 2_500,
      height: 1,
      terrain,
      initialOwners: Array.from({ length: 2_500 }, () => "alpha"),
    });

    match.tick();
    expect(factionFfy(match)).toBe(25_104);
  });

  it("regenerates identical FFY state and fingerprint from the same bound inputs", () => {
    const original = economyRuntime({
      seed: "ffy-replay-proof",
      alphaRules: rulesWith(["P53"]),
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-silo",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 0,
          level: 1,
        },
      ],
    });
    original.tick(3);

    const regenerated = MatchRuntime.regenerate(
      original.spec,
      original.acceptedInputs(),
      original.snapshot().tick,
    );
    expect(factionFfy(original)).toBe(25_900);
    expect(regenerated.snapshot()).toEqual(original.snapshot());
    expect(regenerated.stateFingerprint()).toBe(original.stateFingerprint());
  });
});
