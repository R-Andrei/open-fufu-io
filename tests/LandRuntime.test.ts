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
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, origin);
}

function landRuntime(options: {
  readonly seed: string;
  readonly terrain: readonly string[];
  readonly owners: readonly (string | null)[];
  readonly alphaTraits?: readonly OriginTraitId[];
  readonly betaTraits?: readonly OriginTraitId[];
}) {
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed: options.seed,
      width: options.terrain.length,
      height: 1,
      terrain: options.terrain,
      initialOwners: options.owners,
      factions: [
        { id: "alpha", rules: rules(options.alphaTraits) },
        { id: "beta", rules: rules(options.betaTraits) },
      ],
    }),
  );
}

function tickUntil(
  match: MatchRuntime,
  predicate: () => boolean,
  maximumTicks = 60,
): void {
  for (let index = 0; index < maximumTicks; index += 1) {
    if (predicate()) return;
    match.tick();
  }
  if (!predicate()) throw new Error("land micro-simulation did not reach expected state");
}

function setAttack(match: MatchRuntime, population: number): void {
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
                population,
                targetFactionId: "beta",
                source: { kind: "OWNER", factionId: "alpha" },
                target: { kind: "OWNER", factionId: "beta" },
              },
            ],
          },
        };
      },
    }),
  );
  expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
    true,
  );
}

describe("land operations through authoritative MatchRuntime", () => {
  it("commits offense, captures through frozen adjacent frontage, settles casualties, and replays exactly", () => {
    const match = landRuntime({
      seed: "hostile-capture",
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", "beta"],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 1 });
    match.tick();

    setAttack(match, 2);
    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");

    expect(match.snapshot().factions.find((entry) => entry.id === "alpha")?.population).toMatchObject({
      total: 1,
      available: 0,
      committedOffensive: 1,
    });
    expect(match.snapshot().factions.find((entry) => entry.id === "beta")?.population).toMatchObject({
      total: 0,
      available: 0,
    });

    const regenerated = MatchRuntime.regenerate(
      match.spec,
      match.acceptedInputs(),
      match.snapshot().tick,
    );
    expect(regenerated.snapshot()).toEqual(match.snapshot());
    expect(regenerated.stateFingerprint()).toBe(match.stateFingerprint());
  });

  it("rejects a directive bundle atomically when aggregate Population commitment overdraws Available", () => {
    const match = landRuntime({
      seed: "atomic-overcommit",
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", null],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 1 });
    match.tick();
    const acceptedBefore = match.acceptedInputs().length;

    const receipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION",
                  key: "one",
                  operation: "NEUTRAL_EXPANSION",
                  population: 1,
                  source: { kind: "OWNER", factionId: "alpha" },
                  target: { kind: "OWNER" },
                },
                {
                  kind: "LAND_OPERATION",
                  key: "two",
                  operation: "NEUTRAL_EXPANSION",
                  population: 1,
                  source: { kind: "OWNER", factionId: "alpha" },
                  target: { kind: "OWNER" },
                },
              ],
            },
          };
        },
      }),
    );

    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt).toMatchObject({
      accepted: false,
      failure: { code: "INSUFFICIENT_AVAILABLE_POPULATION" },
    });
    expect(match.acceptedInputs()).toHaveLength(acceptedBefore);
    expect(match.snapshot().operations).toEqual([]);
  });

  it("persists P36's faction residual and never chain-settles from a newly captured cell in the same tick", () => {
    const match = landRuntime({
      seed: "p36-no-chain",
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      owners: ["alpha", null, null],
      alphaTraits: ["P36"],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 1 });
    match.tick();
    match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            directives: {
              set: [
                {
                  kind: "LAND_OPERATION",
                  key: "expand",
                  operation: "NEUTRAL_EXPANSION",
                  population: 1,
                  source: { kind: "OWNER", factionId: "alpha" },
                  target: { kind: "OWNER" },
                },
              ],
            },
          };
        },
      }),
    );

    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
    expect(match.snapshot().ownership[2]).toBeNull();
    expect(
      match.snapshot().factions.find((entry) => entry.id === "alpha")?.population
        .neutralSettlementHalfResidual,
    ).toBe(1);

    tickUntil(match, () => match.snapshot().ownership[2] === "alpha");
    expect(match.snapshot().factions.find((entry) => entry.id === "alpha")?.population).toMatchObject({
      total: 0,
      committedOffensive: 0,
      neutralSettlementHalfResidual: 0,
    });
  });

  it("keeps a P38 automatic defender alive while preserving the attacker's ordinary capture casualty", () => {
    const match = landRuntime({
      seed: "p38-survival",
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", "beta"],
      betaTraits: ["P38"],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 1 });
    match.tick();
    setAttack(match, 2);

    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
    expect(match.snapshot().factions.find((entry) => entry.id === "beta")?.population).toMatchObject({
      total: 1,
      available: 1,
    });
    expect(match.snapshot().factions.find((entry) => entry.id === "alpha")?.population.total).toBe(1);
  });

  it("charges P47 Marsh attrition after an otherwise casualty-free hostile capture", () => {
    const match = landRuntime({
      seed: "p47-marsh",
      terrain: ["PLAINS", "MARSH"],
      owners: ["alpha", "beta"],
      betaTraits: ["P47"],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 1 });
    match.tick();
    setAttack(match, 1);

    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");
    expect(match.snapshot().factions.find((entry) => entry.id === "alpha")?.population).toMatchObject({
      total: 0,
      committedOffensive: 0,
    });
  });

  it("carries fractional counter-response casualties deterministically until whole Population is lost", () => {
    const match = landRuntime({
      seed: "counter-response",
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", "beta"],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 100 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 100 });
    match.tick();
    setAttack(match, 100);
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
                  key: "beta-counter",
                  incomingOperationId: incoming!.id,
                  population: 100,
                },
              ],
            },
          };
        },
      }),
    );
    expect(responseReceipts.find((entry) => entry.factionId === "beta")?.receipt.accepted).toBe(true);

    match.tick();
    match.tick();
    expect(match.snapshot().factions.find((entry) => entry.id === "alpha")?.population.total).toBe(99);
    expect(match.snapshot().factions.find((entry) => entry.id === "beta")?.population.total).toBe(99);
  });

  it("creates symmetric atWar from an attack and preserves exact post-source grace", () => {
    const match = landRuntime({
      seed: "attack-hostility-grace",
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", "beta"],
    });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 1 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 1 });
    match.tick();

    setAttack(match, 1);
    match.tick();
    expect(matchStateAtWar(match.snapshot(), "alpha", "beta")).toBe(true);
    expect(matchStateAtWar(match.snapshot(), "beta", "alpha")).toBe(true);

    const endReceipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return { directives: { end: ["alpha-attack"] } };
        },
      }),
    );
    expect(endReceipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(true);
    match.tick();

    const grace = match.snapshot().hostilityGrace[0];
    expect(grace).toBeDefined();
    expect(grace!.expiresAtTickExclusive).toBe(match.snapshot().tick + 600);
    expect(matchStateAtWar(match.snapshot(), "alpha", "beta")).toBe(true);

    while (match.snapshot().tick + 1 < grace!.expiresAtTickExclusive) match.tick();
    expect(matchStateAtWar(match.snapshot(), "alpha", "beta")).toBe(true);
    match.tick();
    expect(match.snapshot().tick).toBe(grace!.expiresAtTickExclusive);
    expect(matchStateAtWar(match.snapshot(), "alpha", "beta")).toBe(false);
  });
});