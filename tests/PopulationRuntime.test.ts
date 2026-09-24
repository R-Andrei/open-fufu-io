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
    { controllerReferenceNamespace: seed },
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
  const seed = options.seed ?? "economy-runtime";
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
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
    { controllerReferenceNamespace: seed },
  );
}

function factionFfy(match: MatchRuntime, factionId = "alpha"): number | undefined {
  const faction = match.snapshot().factions.find((entry) => entry.id === factionId) as
    | { readonly ffy?: number }
    | undefined;
  return faction?.ffy;
}

function populationState(match: MatchRuntime, factionId = "alpha") {
  const faction = match.snapshot().factions.find((entry) => entry.id === factionId);
  if (faction === undefined) throw new Error(`missing faction ${factionId}`);
  return faction.population;
}

function growthResidualUnits(match: MatchRuntime, factionId = "alpha"): number {
  return (
    populationState(match, factionId) as {
      readonly growthResidualUnits?: number;
    }
  ).growthResidualUnits ?? 0;
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
      { controllerReferenceNamespace: original.spec.seed },
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

describe("ordinary Population growth integration through MatchRuntime", () => {
  it("persists deterministic fractional growth and emits only complete Population", () => {
    const match = economyRuntime({
      seed: "population-growth-fractional",
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "FOREST"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });

    for (let tick = 0; tick < 124; tick += 1) match.tick();

    expect(populationState(match)).toMatchObject({
      total: 0,
      available: 0,
      peakTotal: 0,
    });
    expect(growthResidualUnits(match)).toBe(992_000_000);

    match.tick();

    expect(populationState(match)).toMatchObject({
      total: 1,
      available: 1,
      peakTotal: 1,
    });
    expect(growthResidualUnits(match)).toBe(0);
  });

  it("keeps zero growth at zero Capacity and at/exceeding Capacity", () => {
    const zeroCapacity = economyRuntime({
      seed: "population-growth-zero-capacity",
      width: 1,
      height: 1,
      terrain: ["TUNDRA"],
      initialOwners: ["alpha"],
    });
    for (let tick = 0; tick < 200; tick += 1) zeroCapacity.tick();
    expect(populationState(zeroCapacity).total).toBe(0);
    expect(growthResidualUnits(zeroCapacity)).toBe(0);

    const atCapacity = economyRuntime({
      seed: "population-growth-at-capacity",
      width: 1,
      height: 1,
      terrain: ["FOREST"],
      initialOwners: ["alpha"],
    });
    atCapacity.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 1,
    });
    atCapacity.tick();
    expect(populationState(atCapacity).total).toBe(1);
    expect(growthResidualUnits(atCapacity)).toBe(0);
  });

  it("accrues ordinary growth only for ACTIVE factions", () => {
    const match = economyRuntime({
      seed: "population-growth-status",
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "FOREST"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });

    match.acceptAction({ type: "CAPITULATE_FACTION", factionId: "alpha" });
    for (let tick = 0; tick < 125; tick += 1) match.tick();

    expect(match.snapshot().factions[0]?.status).toBe("CAPITULATED");
    expect(populationState(match).total).toBe(0);
    expect(growthResidualUnits(match)).toBe(0);
  });

  it("uses the exact ordinary and P02 utilization profiles before finite materialization", () => {
    const ordinary = economyRuntime({
      seed: "population-growth-ordinary-profile",
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "FOREST"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });
    ordinary.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 4,
    });
    ordinary.tick();

    const p02 = economyRuntime({
      seed: "population-growth-p02-profile",
      alphaRules: rulesWith(["P02"]),
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "FOREST"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });
    p02.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 4,
    });
    p02.tick();

    // Capacity 16 => base 0.4 Pop/s. At u=1/4, ordinary U=0.79;
    // P02 remaps to ordinary u=1/3 => U=0.92.
    expect(growthResidualUnits(ordinary)).toBe(31_600_000);
    expect(growthResidualUnits(p02)).toBe(36_800_000);
  });

  it("uses P48 population-bearing Shallow Water in growth Capacity", () => {
    const withoutP48 = economyRuntime({
      seed: "population-growth-shallow-baseline",
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "SHALLOW_WATER"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });
    withoutP48.tick();
    expect(growthResidualUnits(withoutP48)).toBe(0);

    const withP48 = economyRuntime({
      seed: "population-growth-shallow-p48",
      alphaRules: rulesWith(["P48"]),
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "SHALLOW_WATER"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });
    withP48.tick();

    // Capacity 16 => base 0.4 Pop/s, zero-utilization U=0.20.
    expect(growthResidualUnits(withP48)).toBe(8_000_000);
  });

  it("composes Plains share, completed City contribution, and global Growth Echo", () => {
    const growthEcho = echoRuleContribution(
      "population.growth",
      "BENEFICIAL",
      500,
      "echo:test-population-growth",
    );
    const match = economyRuntime({
      seed: "population-growth-explicit-modifiers",
      alphaRules: rulesWith([], [growthEcho]),
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "PLAINS"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
      initialStructureGrants: [
        {
          structureId: "alpha-city",
          ownerId: "alpha",
          type: "CITY",
          cellId: 0,
          level: 1,
        },
      ],
    });

    match.tick();

    // Base tick growth = 0.008 Pop. Explicit baseline multiplier is
    // 1 + 6% Plains share + 1% completed L1 City = 1.07, then the
    // global +5% Growth Echo scales the combined result => 1.1235.
    expect(growthResidualUnits(match)).toBe(8_988_000);
  });

  it("serializes and regenerates the same fractional residual and fingerprint", () => {
    const original = economyRuntime({
      seed: "population-growth-replay",
      width: 16,
      height: 1,
      terrain: Array.from({ length: 16 }, () => "FOREST"),
      initialOwners: Array.from({ length: 16 }, () => "alpha"),
    });
    for (let tick = 0; tick < 37; tick += 1) original.tick();

    expect(growthResidualUnits(original)).toBe(296_000_000);

    const regenerated = MatchRuntime.regenerate(
      original.spec,
      original.acceptedInputs(),
      original.snapshot().tick,
      { controllerReferenceNamespace: original.spec.seed },
    );

    expect(growthResidualUnits(regenerated)).toBe(296_000_000);
    expect(regenerated.snapshot()).toEqual(original.snapshot());
    expect(regenerated.stateFingerprint()).toBe(original.stateFingerprint());
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

  it("adds Echo and contextual Desert-share yield before each global passive source finalizes", () => {
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
    expect(factionFfy(match)).toBe(25_468);
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
    for (let index = 0; index < 3; index += 1) original.tick();

    const regenerated = MatchRuntime.regenerate(
      original.spec,
      original.acceptedInputs(),
      original.snapshot().tick,
      { controllerReferenceNamespace: original.spec.seed },
    );
    expect(factionFfy(original)).toBe(25_900);
    expect(regenerated.snapshot()).toEqual(original.snapshot());
    expect(regenerated.stateFingerprint()).toBe(original.stateFingerprint());
  });
});
