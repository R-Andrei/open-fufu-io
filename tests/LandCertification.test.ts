import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import {
  canonicalCellSelectorKey,
  canonicalSpatialPolicyKey,
} from "../src/simulation/LandOperations";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

interface TestFaction {
  readonly id: string;
  readonly traits?: readonly OriginTraitId[];
  readonly fixedTeamId?: string;
}

function runtime(options: {
  readonly seed: string;
  readonly width?: number;
  readonly height?: number;
  readonly terrain: readonly string[];
  readonly owners: readonly (string | null)[];
  readonly fallout?: readonly boolean[];
  readonly factions: readonly TestFaction[];
}): MatchRuntime {
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed: options.seed,
      width: options.width ?? options.terrain.length,
      height: options.height ?? 1,
      terrain: options.terrain,
      initialOwners: options.owners,
      ...(options.fallout === undefined ? {} : { initialFallout: options.fallout }),
      factions: options.factions.map((faction) => ({
        id: faction.id,
        rules: rules(faction.traits),
        ...(faction.fixedTeamId === undefined ? {} : { fixedTeamId: faction.fixedTeamId }),
      })),
    }),
  );
}

function progressFor(match: MatchRuntime, cellId: number, factionId: string): number {
  return match.snapshot().captureProgress.find(
    (entry) => entry.cellId === cellId && entry.claimantFactionId === factionId,
  )?.progressMicros ?? 0;
}

function tickUntil(match: MatchRuntime, predicate: () => boolean, maximumTicks = 100): void {
  for (let index = 0; index < maximumTicks; index += 1) {
    if (predicate()) return;
    match.tick();
  }
  if (!predicate()) throw new Error("certification micro-simulation did not reach expected state");
}

function setDirectives(match: MatchRuntime, factionId: string, set: readonly any[]) {
  return match.runControllerRound(
    new InProcessTestControllerHost({
      [factionId]: () => ({ directives: { set } }),
    }),
  );
}

function grantAndTick(match: MatchRuntime, grants: Readonly<Record<string, number>>): void {
  for (const [factionId, amount] of Object.entries(grants)) {
    match.acceptAction({ type: "GRANT_POPULATION", factionId, amount });
  }
  match.tick();
}

function attack(
  key: string,
  population: number,
  targetFactionId: string,
  sourceIds: readonly number[],
  targetIds: readonly number[],
) {
  return {
    kind: "LAND_OPERATION" as const,
    key,
    operation: "ATTACK" as const,
    population,
    targetFactionId,
    source: { kind: "CELLS" as const, ids: sourceIds },
    target: { kind: "CELLS" as const, ids: targetIds },
  };
}

describe("#88 final land certification", () => {
  it("normalizes the full canonical selector-key surface without erasing ordered DIFFERENCE", () => {
    const left = {
      kind: "INTERSECTION" as const,
      selectors: [
        { kind: "CELLS" as const, ids: [5, 3, 3] },
        {
          kind: "INTERSECTION" as const,
          selectors: [
            { kind: "TERRAIN" as const, terrain: "MARSH" as const },
            { kind: "OWNER" as const, factionId: "alpha" },
          ],
        },
      ],
    };
    const reordered = {
      kind: "INTERSECTION" as const,
      selectors: [
        { kind: "OWNER" as const, factionId: "alpha" },
        { kind: "TERRAIN" as const, terrain: "MARSH" as const },
        { kind: "CELLS" as const, ids: [3, 5] },
      ],
    };
    expect(canonicalCellSelectorKey(left)).toBe(canonicalCellSelectorKey(reordered));

    const difference = canonicalCellSelectorKey({
      kind: "DIFFERENCE",
      left: { kind: "OWNER", factionId: "alpha" },
      right: { kind: "FALLOUT", value: true },
    });
    const reversedDifference = canonicalCellSelectorKey({
      kind: "DIFFERENCE",
      left: { kind: "FALLOUT", value: true },
      right: { kind: "OWNER", factionId: "alpha" },
    });
    expect(difference).not.toBe(reversedDifference);

    expect(
      canonicalCellSelectorKey({
        kind: "STRUCTURE_FIELD",
        field: "DEFENSIVE_PRESSURE",
        referenceFactionId: "alpha",
        affiliation: "SELF_OR_FIXED_TEAMMATE",
      }),
    ).toBe(
      JSON.stringify({
        kind: "STRUCTURE_FIELD",
        field: "DEFENSIVE_PRESSURE",
        referenceFactionId: "alpha",
        affiliation: "SELF_OR_FIXED_TEAMMATE",
      }),
    );
    expect(
      canonicalCellSelectorKey({
        kind: "STRUCTURE_FIELD_INSTANCE",
        structureId: "fort-1",
        field: "DEFENSIVE_PRESSURE",
      }),
    ).toBe(
      JSON.stringify({
        kind: "STRUCTURE_FIELD_INSTANCE",
        structureId: "fort-1",
        field: "DEFENSIVE_PRESSURE",
      }),
    );

    for (const selector of [
      { kind: "OWNER" as const, factionId: "alpha" },
      { kind: "SEGMENT" as const, segmentId: 7 },
      { kind: "TERRAIN" as const, terrain: "PLAINS" as const },
      { kind: "FALLOUT" as const, value: false },
      { kind: "POPULATION_BEARING" as const, value: true },
      { kind: "CONQUERABLE" as const, value: true },
      { kind: "COAST" as const, value: false },
      { kind: "SHORELINE" as const, value: true },
      { kind: "CIRCLE" as const, center: 4, radius: 2.5 },
    ]) {
      expect(canonicalCellSelectorKey(selector)).toContain(`\"kind\":\"${selector.kind}\"`);
    }
  });

  it("treats SpatialPolicy rule order as non-semantic for canonical identity and mechanics", () => {
    const generic = { selector: { kind: "OWNER" as const, factionId: "beta" }, weight: 2 };
    const specific = { selector: { kind: "CELLS" as const, ids: [2] }, weight: 5 };
    const first = { defaultWeight: 1, rules: [generic, specific] };
    const second = { defaultWeight: 1, rules: [specific, generic] };
    expect(canonicalSpatialPolicyKey(first)).toBe(canonicalSpatialPolicyKey(second));

    const make = (seed: string, policy: typeof first) => {
      const match = runtime({
        seed,
        terrain: ["TEST", "TEST", "TEST"],
        owners: ["beta", "alpha", "beta"],
        factions: [{ id: "alpha" }, { id: "beta" }],
      });
      grantAndTick(match, { alpha: 1 });
      const receipts = setDirectives(match, "alpha", [
        {
          ...attack("attack", 1, "beta", [1], [0, 2]),
          engagementPriority: policy,
        },
      ]);
      expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(true);
      match.tick();
      return match;
    };

    const a = make("policy-order-a", first);
    const b = make("policy-order-b", second);
    expect(progressFor(a, 2, "alpha")).toBeGreaterThan(0);
    expect(progressFor(a, 0, "alpha")).toBe(0);
    expect(progressFor(b, 2, "alpha")).toBe(progressFor(a, 2, "alpha"));
    expect(progressFor(b, 0, "alpha")).toBe(0);
  });

  it("rejects impossible owned-Fallout initial state and clears Fallout on successful acquisition", () => {
    expect(() =>
      runtime({
        seed: "owned-fallout-invalid",
        terrain: ["PLAINS"],
        owners: ["alpha"],
        fallout: [true],
        factions: [{ id: "alpha" }, { id: "beta" }],
      }),
    ).toThrow(/Fallout.*neutral|neutral.*Fallout/i);

    const match = runtime({
      seed: "fallout-clears-on-acquisition",
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", null],
      fallout: [false, true],
      factions: [{ id: "alpha" }, { id: "beta" }],
    });
    grantAndTick(match, { alpha: 1 });
    setDirectives(match, "alpha", [
      {
        kind: "LAND_OPERATION" as const,
        key: "expand",
        operation: "NEUTRAL_EXPANSION" as const,
        population: 1,
        source: { kind: "CELLS" as const, ids: [0] },
        target: { kind: "CELLS" as const, ids: [1] },
      },
    ]);
    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
    expect(match.snapshot().fallout[1]).toBe(false);
  });

  it("charges one winning-offense Population for every successful hostile capture even when undefended and zero-Capacity", () => {
    for (const terrain of ["TUNDRA", "SHALLOW_WATER"] as const) {
      const match = runtime({
        seed: `hostile-capture-cost-${terrain}`,
        terrain: ["PLAINS", terrain],
        owners: ["alpha", "beta"],
        factions: [{ id: "alpha" }, { id: "beta" }],
      });
      grantAndTick(match, { alpha: 2 });
      setDirectives(match, "alpha", [attack("attack", 2, "beta", [0], [1])]);
      tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
      expect(
        match.snapshot().factions.find((entry) => entry.id === "alpha")!.population,
      ).toMatchObject({ total: 1, committedOffensive: 1 });
      expect(
        match.snapshot().factions.find((entry) => entry.id === "beta")!.population.total,
      ).toBe(0);
    }
  });

  it("uses P48 owner-effective population-bearing classification in land selectors without retroactive settlement cost", () => {
    const p48 = runtime({
      seed: "p48-pop-bearing-selector",
      terrain: ["SHALLOW_WATER", "PLAINS"],
      owners: ["alpha", null],
      factions: [{ id: "alpha", traits: ["P48"] }, { id: "beta" }],
    });
    grantAndTick(p48, { alpha: 1 });
    setDirectives(p48, "alpha", [
      {
        kind: "LAND_OPERATION" as const,
        key: "expand",
        operation: "NEUTRAL_EXPANSION" as const,
        population: 1,
        source: { kind: "POPULATION_BEARING" as const, value: true },
        target: { kind: "CELLS" as const, ids: [1] },
      },
    ]);
    p48.tick();
    expect(progressFor(p48, 1, "alpha")).toBeGreaterThan(0);

    const baseline = runtime({
      seed: "baseline-pop-bearing-selector",
      terrain: ["SHALLOW_WATER", "PLAINS"],
      owners: ["alpha", null],
      factions: [{ id: "alpha" }, { id: "beta" }],
    });
    grantAndTick(baseline, { alpha: 1 });
    setDirectives(baseline, "alpha", [
      {
        kind: "LAND_OPERATION" as const,
        key: "expand",
        operation: "NEUTRAL_EXPANSION" as const,
        population: 1,
        source: { kind: "POPULATION_BEARING" as const, value: true },
        target: { kind: "CELLS" as const, ids: [1] },
      },
    ]);
    baseline.tick();
    expect(progressFor(baseline, 1, "alpha")).toBe(0);

    const shallowTarget = runtime({
      seed: "p48-no-retroactive-shallow-cost",
      terrain: ["PLAINS", "SHALLOW_WATER"],
      owners: ["alpha", null],
      factions: [{ id: "alpha", traits: ["P48", "P36"] }, { id: "beta" }],
    });
    grantAndTick(shallowTarget, { alpha: 1 });
    setDirectives(shallowTarget, "alpha", [
      {
        kind: "LAND_OPERATION" as const,
        key: "expand",
        operation: "NEUTRAL_EXPANSION" as const,
        population: 1,
        source: { kind: "CELLS" as const, ids: [0] },
        target: { kind: "CELLS" as const, ids: [1] },
      },
    ]);
    tickUntil(shallowTarget, () => shallowTarget.snapshot().ownership[1] === "alpha");
    expect(
      shallowTarget.snapshot().factions.find((entry) => entry.id === "alpha")!.population,
    ).toMatchObject({ total: 1, committedOffensive: 1, neutralSettlementHalfResidual: 0 });
  });

  it("counts an active fixed teammate as one P19 Territorial Contact and removes it when inactive", () => {
    const match = runtime({
      seed: "p19-fixed-teammate-contact",
      terrain: ["TEST", "TEST", "TEST"],
      owners: ["gamma", "alpha", "beta"],
      factions: [
        { id: "alpha", traits: ["P19"], fixedTeamId: "red" },
        { id: "gamma", fixedTeamId: "red" },
        { id: "beta", fixedTeamId: "blue" },
      ],
    });
    grantAndTick(match, { alpha: 1, beta: 1 });
    setDirectives(match, "alpha", [attack("attack", 1, "beta", [1], [2])]);
    match.tick();
    const withTeammate = progressFor(match, 2, "alpha");
    expect(withTeammate).toBe(4_762);
    match.acceptAction({ type: "CAPITULATE_FACTION", factionId: "gamma" });
    match.tick();
    expect(progressFor(match, 2, "alpha") - withTeammate).toBe(2_439);
  });

  it("keeps P36 residual accounting through operation end/recreation and closes the pair from aggregate neutral commitment", () => {
    const match = runtime({
      seed: "p36-recreation-residual",
      terrain: ["TEST", "TEST", "TEST"],
      owners: ["alpha", null, null],
      factions: [{ id: "alpha", traits: ["P36"] }, { id: "beta" }],
    });
    grantAndTick(match, { alpha: 1 });
    setDirectives(match, "alpha", [
      {
        kind: "LAND_OPERATION" as const,
        key: "first",
        operation: "NEUTRAL_EXPANSION" as const,
        population: 1,
        source: { kind: "OWNER" as const, factionId: "alpha" },
        target: { kind: "OWNER" as const },
      },
    ]);
    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
    expect(
      match.snapshot().factions.find((entry) => entry.id === "alpha")!.population.neutralSettlementHalfResidual,
    ).toBe(1);

    const ended = match.runControllerRound(
      new InProcessTestControllerHost({ alpha: () => ({ directives: { end: ["first"] } }) }),
    );
    expect(ended.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(true);
    match.tick();
    setDirectives(match, "alpha", [
      {
        kind: "LAND_OPERATION" as const,
        key: "recreated",
        operation: "NEUTRAL_EXPANSION" as const,
        population: 1,
        source: { kind: "OWNER" as const, factionId: "alpha" },
        target: { kind: "OWNER" as const },
      },
    ]);
    tickUntil(match, () => match.snapshot().ownership[2] === "alpha");
    expect(
      match.snapshot().factions.find((entry) => entry.id === "alpha")!.population,
    ).toMatchObject({ total: 0, committedOffensive: 0, neutralSettlementHalfResidual: 0 });
  });

  it("aggregates P47 same-tick requests, pays qualifying winning commitments before Available, and clamps exhaustion", () => {
    const match = runtime({
      seed: "p47-aggregate-payment",
      width: 2,
      height: 2,
      terrain: ["PLAINS", "MARSH", "PLAINS", "MARSH"],
      owners: ["alpha", "beta", "alpha", "beta"],
      factions: [{ id: "alpha" }, { id: "beta", traits: ["P47", "P38"] }],
    });
    grantAndTick(match, { alpha: 6, beta: 2 });
    setDirectives(match, "alpha", [
      attack("left", 2, "beta", [0], [1]),
      attack("right", 2, "beta", [2], [3]),
    ]);
    tickUntil(
      match,
      () => match.snapshot().ownership[1] === "alpha" && match.snapshot().ownership[3] === "alpha",
    );
    expect(
      match.snapshot().factions.find((entry) => entry.id === "alpha")!.population,
    ).toMatchObject({ total: 2, available: 2, committedOffensive: 0 });
    expect(
      match.snapshot().factions.find((entry) => entry.id === "beta")!.population,
    ).toMatchObject({ total: 2, available: 2 });

    const exhausted = runtime({
      seed: "p47-exhaustion",
      terrain: ["PLAINS", "MARSH"],
      owners: ["alpha", "beta"],
      factions: [{ id: "alpha" }, { id: "beta", traits: ["P47"] }],
    });
    grantAndTick(exhausted, { alpha: 1 });
    setDirectives(exhausted, "alpha", [attack("attack", 1, "beta", [0], [1])]);
    tickUntil(exhausted, () => exhausted.snapshot().ownership[1] === "alpha");
    expect(
      exhausted.snapshot().factions.find((entry) => entry.id === "alpha")!.population.total,
    ).toBe(0);
  });

  it("does not apply P47 to a Marsh holder without P47 and does not let P38 suppress P47", () => {
    const make = (seed: string, betaTraits: readonly OriginTraitId[]) => {
      const match = runtime({
        seed,
        terrain: ["PLAINS", "MARSH"],
        owners: ["alpha", "beta"],
        factions: [{ id: "alpha" }, { id: "beta", traits: betaTraits }],
      });
      grantAndTick(match, { alpha: 3, beta: 1 });
      setDirectives(match, "alpha", [attack("attack", 2, "beta", [0], [1])]);
      tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
      return match.snapshot().factions.find((entry) => entry.id === "alpha")!.population.total;
    };

    expect(make("marsh-no-p47", [])).toBe(2);
    expect(make("marsh-p47-p38", ["P47", "P38"])).toBe(1);
  });

  it("locks proportional automatic-defense quotas, largest remainder, and stable-cell ties", () => {
    const unequal = (seed: string, betaPopulation: number) => {
      const match = runtime({
        seed,
        width: 7,
        height: 2,
        terrain: Array.from({ length: 14 }, () => "TEST"),
        owners: [
          "alpha", "beta", "beta", "beta", null, "gamma", "beta",
          "alpha", "beta", "beta", "beta", null, "gamma", null,
        ],
        factions: [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }],
      });
      grantAndTick(match, { alpha: 6, beta: betaPopulation, gamma: 2 });
      const receipts = match.runControllerRound(
        new InProcessTestControllerHost({
          alpha: () => ({ directives: { set: [attack("large-front", 6, "beta", [0, 7], [1, 8])] } }),
          gamma: () => ({ directives: { set: [attack("small-front", 2, "beta", [5, 12], [6])] } }),
        }),
      );
      expect(receipts.every((entry) => entry.receipt.accepted)).toBe(true);
      match.tick();
      return match;
    };

    const oneSlot = unequal("defense-largest-remainder", 1);
    expect(progressFor(oneSlot, 1, "alpha")).toBeLessThan(progressFor(oneSlot, 6, "gamma"));
    expect(progressFor(oneSlot, 8, "alpha")).toBe(100_000);

    const twoSlots = unequal("defense-proportional-2-1", 2);
    const alphaProgress = [1, 8].map((cellId) => progressFor(twoSlots, cellId, "alpha"));
    expect(alphaProgress.filter((value) => value < 100_000)).toHaveLength(1);
    expect(progressFor(twoSlots, 6, "gamma")).toBeLessThan(100_000);

    const tie = runtime({
      seed: "defense-equal-remainder-stable-cell",
      terrain: ["TEST", "TEST", "TEST", "TEST", "TEST"],
      owners: ["alpha", "beta", null, "beta", "gamma"],
      factions: [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }],
    });
    grantAndTick(tie, { alpha: 2, beta: 1, gamma: 2 });
    const tieReceipts = tie.runControllerRound(
      new InProcessTestControllerHost({
        alpha: () => ({ directives: { set: [attack("left", 2, "beta", [0], [1])] } }),
        gamma: () => ({ directives: { set: [attack("right", 2, "beta", [4], [3])] } }),
      }),
    );
    expect(tieReceipts.every((entry) => entry.receipt.accepted)).toBe(true);
    tie.tick();
    expect(progressFor(tie, 1, "alpha")).toBeLessThan(progressFor(tie, 3, "gamma"));
    expect(progressFor(tie, 3, "gamma")).toBe(100_000);
  });
});
