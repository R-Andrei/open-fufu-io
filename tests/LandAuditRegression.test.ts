import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import { matchStateAtWar } from "../src/simulation/HostilityState";
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
  const width = options.width ?? options.terrain.length;
  const height = options.height ?? 1;
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed: options.seed,
      width,
      height,
      terrain: options.terrain,
      initialOwners: options.owners,
      ...(options.fallout === undefined
        ? {}
        : { initialFallout: options.fallout }),
      factions: options.factions.map((faction) => ({
        id: faction.id,
        rules: rules(faction.traits),
        ...(faction.fixedTeamId === undefined
          ? {}
          : { fixedTeamId: faction.fixedTeamId }),
      })),
    }),
  );
}

function tickUntil(
  match: MatchRuntime,
  predicate: () => boolean,
  maximumTicks = 80,
): void {
  for (let index = 0; index < maximumTicks; index += 1) {
    if (predicate()) return;
    match.tick();
  }
  if (!predicate()) throw new Error("audit micro-simulation did not reach expected state");
}

function setLandOperation(
  match: MatchRuntime,
  factionId: string,
  directive: {
    readonly key: string;
    readonly operation: "ATTACK" | "NEUTRAL_EXPANSION";
    readonly population: number;
    readonly targetFactionId?: string;
    readonly source: { readonly kind: "CELLS"; readonly ids: readonly number[] } | { readonly kind: "OWNER"; readonly factionId?: string };
    readonly target: { readonly kind: "CELLS"; readonly ids: readonly number[] } | { readonly kind: "OWNER"; readonly factionId?: string };
  },
) {
  return match.runControllerRound(
    new InProcessTestControllerHost({
      [factionId]: () => ({
        directives: {
          set: [
            {
              kind: "LAND_OPERATION" as const,
              ...directive,
            },
          ],
        },
      }),
    }),
  );
}

function progressFor(match: MatchRuntime, cellId: number, factionId: string): number {
  return (
    match.snapshot().captureProgress.find(
      (entry) =>
        entry.cellId === cellId && entry.claimantFactionId === factionId,
    )?.progressMicros ?? 0
  );
}

function counterResidual(
  attackerPopulation: number,
  responderPopulation: number,
  responderTraits: readonly OriginTraitId[] = [],
) {
  const match = runtime({
    seed: `counter-${attackerPopulation}-${responderPopulation}-${responderTraits.join("-")}`,
    terrain: ["TEST", "TEST", "TEST"],
    owners: ["alpha", null, "beta"],
    factions: [
      { id: "alpha" },
      { id: "beta", traits: responderTraits },
    ],
  });
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "alpha",
    amount: attackerPopulation,
  });
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "beta",
    amount: responderPopulation,
  });
  match.tick();

  const attackReceipts = setLandOperation(match, "alpha", {
    key: "attack",
    operation: "ATTACK",
    population: attackerPopulation,
    targetFactionId: "beta",
    source: { kind: "OWNER", factionId: "alpha" },
    target: { kind: "OWNER", factionId: "beta" },
  });
  expect(
    attackReceipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
  ).toBe(true);
  match.tick();

  const incoming = match.snapshot().operations.find(
    (operation) => operation.kind === "ATTACK" && operation.ownerId === "alpha",
  );
  expect(incoming).toBeDefined();

  const responseReceipts = match.runControllerRound(
    new InProcessTestControllerHost({
      beta() {
        return {
          directives: {
            set: [
              {
                kind: "COUNTER_RESPONSE",
                key: "counter",
                incomingOperationId: incoming!.id,
                population: responderPopulation,
              },
            ],
          },
        };
      },
    }),
  );
  expect(
    responseReceipts.find((entry) => entry.factionId === "beta")?.receipt.accepted,
  ).toBe(true);
  match.tick();

  return match.snapshot().counterResponseResiduals.find(
    (entry) =>
      entry.attackerFactionId === "alpha" && entry.responderFactionId === "beta",
  );
}

function oneNeutralProgress(
  traits: readonly OriginTraitId[],
  fallout: boolean,
): number {
  const match = runtime({
    seed: `fallout-${traits.join("-")}-${fallout}`,
    terrain: ["TEST", "TEST"],
    owners: ["alpha", null],
    fallout: [false, fallout],
    factions: [{ id: "alpha", traits }, { id: "beta" }],
  });
  match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 1 });
  match.tick();
  const receipts = setLandOperation(match, "alpha", {
    key: "expand",
    operation: "NEUTRAL_EXPANSION",
    population: 1,
    source: { kind: "CELLS", ids: [0] },
    target: { kind: "CELLS", ids: [1] },
  });
  expect(
    receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
  ).toBe(true);
  match.tick();
  return progressFor(match, 1, "alpha");
}

describe("#88 audit regressions", () => {
  it("decays stored progress while an active lane has no positive effective advantage", () => {
    const match = runtime({
      seed: "active-stall-decay",
      terrain: ["TEST", "TEST"],
      owners: ["alpha", "beta"],
      factions: [{ id: "alpha" }, { id: "beta" }],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 1 });
    match.tick();
    setLandOperation(match, "alpha", {
      key: "attack",
      operation: "ATTACK",
      population: 2,
      targetFactionId: "beta",
      source: { kind: "CELLS", ids: [0] },
      target: { kind: "CELLS", ids: [1] },
    });
    match.tick();
    match.tick();
    match.tick();
    const before = progressFor(match, 1, "alpha");
    expect(before).toBeGreaterThan(50_000);

    const receipts = setLandOperation(match, "alpha", {
      key: "attack",
      operation: "ATTACK",
      population: 1,
      targetFactionId: "beta",
      source: { kind: "CELLS", ids: [0] },
      target: { kind: "CELLS", ids: [1] },
    });
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
    ).toBe(true);
    match.tick();
    expect(progressFor(match, 1, "alpha")).toBe(before - 50_000);
  });

  it("applies P04 to response-side imbalance effectiveness without changing attack-side semantics", () => {
    const responderLarger = counterResidual(100, 200, ["P04"]);
    expect(responderLarger).toMatchObject({
      attackingLossMicros: 500_000,
      respondingLossMicros: 488_889,
    });

    const attackerLarger = counterResidual(200, 100, ["P04"]);
    expect(attackerLarger).toMatchObject({
      attackingLossMicros: 500_000,
      respondingLossMicros: 511_111,
    });
  });

  it("removes capitulated factions from P19 Territorial Contact offense immediately", () => {
    const match = runtime({
      seed: "p19-active-contact",
      terrain: ["TEST", "TEST", "TEST"],
      owners: ["gamma", "alpha", "beta"],
      factions: [
        { id: "alpha", traits: ["P19"] },
        { id: "beta" },
        { id: "gamma" },
      ],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 1 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 1 });
    match.tick();
    setLandOperation(match, "alpha", {
      key: "attack",
      operation: "ATTACK",
      population: 1,
      targetFactionId: "beta",
      source: { kind: "CELLS", ids: [1] },
      target: { kind: "CELLS", ids: [2] },
    });
    match.tick();
    const withTwoContacts = progressFor(match, 2, "alpha");
    expect(withTwoContacts).toBe(4_762);

    match.acceptAction({ type: "CAPITULATE_FACTION", factionId: "gamma" });
    match.tick();
    expect(progressFor(match, 2, "alpha") - withTwoContacts).toBe(2_439);
  });

  it("materializes ordinary Fallout resistance plus P16/N05/N18 interactions", () => {
    expect(oneNeutralProgress([], false)).toBe(100_000);
    expect(oneNeutralProgress([], true)).toBe(50_000);
    expect(oneNeutralProgress(["P16"], true)).toBe(100_000);
    expect(oneNeutralProgress(["N05"], true)).toBe(0);
    expect(oneNeutralProgress(["N18"], false)).toBe(50_000);
    expect(oneNeutralProgress(["N18"], true)).toBe(50_000);
    expect(oneNeutralProgress(["P16", "N18"], true)).toBe(100_000);
  });

  it("rejects same-fixed-team attacks and normalizes enemy war state across the team", () => {
    const match = runtime({
      seed: "fixed-team-hostility",
      terrain: ["TEST", "TEST", "TEST"],
      owners: ["alpha", "bravo", "charlie"],
      factions: [
        { id: "alpha", fixedTeamId: "red" },
        { id: "bravo", fixedTeamId: "red" },
        { id: "charlie", fixedTeamId: "blue" },
      ],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.tick();

    const allied = setLandOperation(match, "alpha", {
      key: "allied-attack",
      operation: "ATTACK",
      population: 1,
      targetFactionId: "bravo",
      source: { kind: "OWNER", factionId: "alpha" },
      target: { kind: "OWNER", factionId: "bravo" },
    });
    expect(allied.find((entry) => entry.factionId === "alpha")?.receipt).toMatchObject({
      accepted: false,
      failure: { code: "INVALID_TARGET" },
    });
    expect(match.snapshot().operations).toEqual([]);
    match.tick();

    const enemy = setLandOperation(match, "alpha", {
      key: "enemy-attack",
      operation: "ATTACK",
      population: 1,
      targetFactionId: "charlie",
      source: { kind: "OWNER", factionId: "alpha" },
      target: { kind: "OWNER", factionId: "charlie" },
    });
    expect(
      enemy.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
    ).toBe(true);
    match.tick();
    expect(matchStateAtWar(match.snapshot(), "alpha", "charlie")).toBe(true);
    expect(matchStateAtWar(match.snapshot(), "bravo", "charlie")).toBe(true);
    expect(matchStateAtWar(match.snapshot(), "alpha", "bravo")).toBe(false);

    const regenerated = MatchRuntime.regenerate(
      match.spec,
      match.acceptedInputs(),
      match.snapshot().tick,
    );
    expect(regenerated.stateFingerprint()).toBe(match.stateFingerprint());
  });

  it("apportions scarce automatic defenders across disconnected threatened fronts before cell priority", () => {
    const match = runtime({
      seed: "scarce-defense-fronts",
      width: 5,
      height: 2,
      terrain: Array.from({ length: 10 }, () => "TEST"),
      owners: [
        "alpha", "beta", "beta", "beta", "gamma",
        "alpha", "beta", "beta", "beta", "gamma",
      ],
      factions: [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "gamma", amount: 2 });
    match.tick();

    const receipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION",
                  key: "alpha-front",
                  operation: "ATTACK",
                  population: 2,
                  targetFactionId: "beta",
                  source: { kind: "CELLS", ids: [0, 5] },
                  target: { kind: "CELLS", ids: [1, 6] },
                },
              ],
            },
          };
        },
        gamma() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION",
                  key: "gamma-front",
                  operation: "ATTACK",
                  population: 2,
                  targetFactionId: "beta",
                  source: { kind: "CELLS", ids: [4, 9] },
                  target: { kind: "CELLS", ids: [3, 8] },
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
                  kind: "DEFENSE_PRIORITY",
                  key: "favor-alpha-front",
                  priority: {
                    defaultWeight: 1,
                    rules: [
                      {
                        selector: { kind: "CELLS", ids: [1, 6] },
                        weight: 100,
                      },
                    ],
                  },
                },
              ],
            },
          };
        },
      }),
    );
    expect(receipts.every((entry) => entry.receipt.accepted)).toBe(true);
    match.tick();

    const positiveClaims = match.snapshot().captureProgress.filter(
      (entry) => entry.progressMicros > 0,
    );
    expect(
      positiveClaims.filter((entry) => entry.claimantFactionId === "alpha"),
    ).toHaveLength(1);
    expect(
      positiveClaims.filter((entry) => entry.claimantFactionId === "gamma"),
    ).toHaveLength(1);
  });

  it("keeps P36 faction-level results invariant under equivalent operation splitting", () => {
    const make = (split: boolean) => {
      const match = runtime({
        seed: split ? "p36-split" : "p36-aggregate",
        width: 2,
        height: 2,
        terrain: ["TEST", "TEST", "TEST", "TEST"],
        owners: ["alpha", null, "alpha", null],
        factions: [{ id: "alpha", traits: ["P36"] }, { id: "beta" }],
      });
      match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
      match.tick();
      const receipts = match.runControllerRound(
        new InProcessTestControllerHost({
          alpha() {
            return {
              directives: {
                set: split
                  ? [
                      {
                        kind: "LAND_OPERATION" as const,
                        key: "left",
                        operation: "NEUTRAL_EXPANSION" as const,
                        population: 1,
                        source: { kind: "CELLS" as const, ids: [0] },
                        target: { kind: "CELLS" as const, ids: [1] },
                      },
                      {
                        kind: "LAND_OPERATION" as const,
                        key: "right",
                        operation: "NEUTRAL_EXPANSION" as const,
                        population: 1,
                        source: { kind: "CELLS" as const, ids: [2] },
                        target: { kind: "CELLS" as const, ids: [3] },
                      },
                    ]
                  : [
                      {
                        kind: "LAND_OPERATION" as const,
                        key: "aggregate",
                        operation: "NEUTRAL_EXPANSION" as const,
                        population: 2,
                        source: { kind: "OWNER" as const, factionId: "alpha" },
                        target: { kind: "OWNER" as const },
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
      tickUntil(
        match,
        () => match.snapshot().ownership[1] === "alpha" && match.snapshot().ownership[3] === "alpha",
      );
      return match;
    };

    const aggregate = make(false);
    const split = make(true);
    expect(split.snapshot().ownership).toEqual(aggregate.snapshot().ownership);
    const aggregatePopulation = aggregate.snapshot().factions.find(
      (entry) => entry.id === "alpha",
    )!.population;
    const splitPopulation = split.snapshot().factions.find(
      (entry) => entry.id === "alpha",
    )!.population;
    expect({
      total: splitPopulation.total,
      available: splitPopulation.available,
      committedOffensive: splitPopulation.committedOffensive,
      residual: splitPopulation.neutralSettlementHalfResidual,
    }).toEqual({
      total: aggregatePopulation.total,
      available: aggregatePopulation.available,
      committedOffensive: aggregatePopulation.committedOffensive,
      residual: aggregatePopulation.neutralSettlementHalfResidual,
    });
  });

  it("resolves one winner in same-cell multi-faction contention without charging the unsuccessful claimant", () => {
    const match = runtime({
      seed: "three-way-contention",
      terrain: ["TEST", "TEST", "TEST"],
      owners: ["alpha", "beta", "gamma"],
      factions: [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 1 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "gamma", amount: 2 });
    match.tick();
    const receipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION",
                  key: "alpha-attack",
                  operation: "ATTACK",
                  population: 2,
                  targetFactionId: "beta",
                  source: { kind: "CELLS", ids: [0] },
                  target: { kind: "CELLS", ids: [1] },
                },
              ],
            },
          };
        },
        gamma() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION",
                  key: "gamma-attack",
                  operation: "ATTACK",
                  population: 2,
                  targetFactionId: "beta",
                  source: { kind: "CELLS", ids: [2] },
                  target: { kind: "CELLS", ids: [1] },
                },
              ],
            },
          };
        },
      }),
    );
    expect(receipts.every((entry) => entry.receipt.accepted)).toBe(true);
    tickUntil(match, () => match.snapshot().ownership[1] !== "beta");

    expect(match.snapshot().ownership[1]).toBe("alpha");
    expect(
      match.snapshot().factions.find((entry) => entry.id === "gamma")?.population,
    ).toMatchObject({ total: 2, committedOffensive: 2 });
  });

  it("returns surviving offensive commitment to Available when an operation ends", () => {
    const match = runtime({
      seed: "operation-release",
      terrain: ["TEST", "TEST", "TEST"],
      owners: ["alpha", null, "beta"],
      factions: [{ id: "alpha" }, { id: "beta" }],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 3 });
    match.tick();
    setLandOperation(match, "alpha", {
      key: "attack",
      operation: "ATTACK",
      population: 3,
      targetFactionId: "beta",
      source: { kind: "OWNER", factionId: "alpha" },
      target: { kind: "OWNER", factionId: "beta" },
    });
    match.tick();
    expect(
      match.snapshot().factions.find((entry) => entry.id === "alpha")?.population,
    ).toMatchObject({ available: 0, committedOffensive: 3 });

    const receipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return { directives: { end: ["attack"] } };
        },
      }),
    );
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
    ).toBe(true);
    match.tick();
    expect(
      match.snapshot().factions.find((entry) => entry.id === "alpha")?.population,
    ).toMatchObject({ available: 3, committedOffensive: 0 });
  });
});
