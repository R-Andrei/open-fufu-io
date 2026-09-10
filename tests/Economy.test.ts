import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type {
  RuleCondition,
  RuleContribution,
} from "../src/core/rules/RuleComposition";
import * as Economy from "../src/simulation/Economy";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

interface ExactInput {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface PositiveEventInput {
  readonly id: string;
  readonly family: "ALL" | "MILITARY_CONQUEST" | "NAVAL_TRADE" | "INDUSTRIAL";
  readonly specialization?: "PIRACY";
  readonly baseValue: ExactInput;
  readonly structuralMultiplier?: ExactInput;
  readonly conditionApplies?: (condition: RuleCondition) => boolean;
}

interface EconomicStageInput {
  readonly balance: number;
  readonly rules: ReturnType<typeof rulesWith>;
  readonly ruleDynamicState: {
    readonly ownedPersistentStructureCount: number;
    readonly territorialContactCount: number;
    readonly peakTotalPopulation: number;
  };
  readonly positiveEvents: readonly PositiveEventInput[];
  readonly signedFacts: readonly {
    readonly id: string;
    readonly components: readonly ExactInput[];
  }[];
}

interface EconomicStageResult {
  readonly balance: number;
  readonly finalizedSignedDelta: number;
  readonly positiveEvents: readonly {
    readonly id: string;
    readonly family: PositiveEventInput["family"];
    readonly award: number;
  }[];
  readonly signedFacts: readonly { readonly id: string }[];
}

interface DebitResult {
  readonly ok: boolean;
  readonly cost: number;
  readonly balance: number;
  readonly reason?: "INSUFFICIENT_FFY";
}

function exact(numerator: bigint | number, denominator: bigint | number = 1): ExactInput {
  return Object.freeze({
    numerator: BigInt(numerator),
    denominator: BigInt(denominator),
  });
}

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

function requiredFunction<T extends (...args: any[]) => any>(name: string): T {
  const value = (Economy as unknown as Record<string, unknown>)[name];
  if (typeof value !== "function") {
    throw new Error(`missing economy capability ${name}`);
  }
  return value as T;
}

function resolveStage(input: EconomicStageInput): EconomicStageResult {
  return requiredFunction<(input: EconomicStageInput) => EconomicStageResult>(
    "resolveFfyEconomicStage",
  )(input);
}

function debit(balance: number, cost: ExactInput): DebitResult {
  return requiredFunction<(balance: number, cost: ExactInput) => DebitResult>(
    "tryDebitFfy",
  )(balance, cost);
}

const RULE_STATE = Object.freeze({
  ownedPersistentStructureCount: 0,
  territorialContactCount: 0,
  peakTotalPopulation: 0,
});

describe("authoritative FFY event, signed-consequence, and payment substrate", () => {
  it("adds All-FFY Echo and Desert-share percentages before passive finalization", () => {
    const rules = rulesWith(
      ["P53"],
      [echoRuleContribution("ffy.all", "BENEFICIAL", 5_000, "echo:passive-all")],
    );
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "ffy-additive-passive",
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
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules: rulesWith() },
        ],
      }),
    );

    match.tick();
    expect(match.snapshot().factions[0]?.ffy).toBe(25_468);
  });

  it("preserves event identity and adds eligible All + family yield percentages before one floor", () => {
    const rules = rulesWith([], [
      echoRuleContribution("ffy.all", "BENEFICIAL", 2_000, "echo:all"),
      echoRuleContribution(
        "ffy.military_conquest",
        "BENEFICIAL",
        3_000,
        "echo:military",
      ),
    ]);

    const result = resolveStage({
      balance: 100,
      rules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [
        {
          id: "capture:7",
          family: "MILITARY_CONQUEST",
          baseValue: exact(101),
        },
      ],
      signedFacts: [],
    });

    expect(result.positiveEvents).toEqual([
      { id: "capture:7", family: "MILITARY_CONQUEST", award: 151 },
    ]);
    expect(result.balance).toBe(251);
  });

  it("composes Naval/trade piracy events from All + Naval/trade + PIRACY yield scopes", () => {
    const rules = rulesWith(["P30"], [
      echoRuleContribution("ffy.all", "BENEFICIAL", 2_000, "echo:all"),
      echoRuleContribution(
        "ffy.naval_trade",
        "BENEFICIAL",
        3_000,
        "echo:naval",
      ),
    ]);

    const result = resolveStage({
      balance: 0,
      rules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [
        {
          id: "captured-cargo:7",
          family: "NAVAL_TRADE",
          specialization: "PIRACY",
          baseValue: exact(100),
        },
      ],
      signedFacts: [],
    });

    // (100 × (1 + 0.20 + 0.30)) × 3.0 = 450.
    expect(result.positiveEvents[0]?.award).toBe(450);
    expect(result.balance).toBe(450);
  });

  it("keeps structural/event arithmetic exact until all ordinary percentages have been added", () => {
    const rules = rulesWith(
      ["P14"],
      [echoRuleContribution("ffy.all", "BENEFICIAL", 10_000, "echo:all")],
    );

    const result = resolveStage({
      balance: 0,
      rules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [
        {
          id: "fractional-structure",
          family: "ALL",
          baseValue: exact(1),
          structuralMultiplier: exact(1, 2),
          conditionApplies: (condition) =>
            condition.kind === "EVENT_TERRAIN_IS" &&
            condition.terrain === "DESERT",
        },
      ],
      signedFacts: [],
    });

    // 1 × 1/2 × (1 + 1.00 + 0.33) = 1.165 -> floor once = 1.
    expect(result.positiveEvents[0]?.award).toBe(1);
    expect(result.balance).toBe(1);
  });

  it("clamps a negative ordinary yield to zero and applies an eligible hard-zero terminal", () => {
    const negativeRules = rulesWith([], [
      echoRuleContribution("ffy.all", "HARMFUL", 15_000, "echo:harmful"),
    ]);
    const negative = resolveStage({
      balance: 7,
      rules: negativeRules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [
        { id: "negative-yield", family: "ALL", baseValue: exact(100) },
      ],
      signedFacts: [],
    });
    expect(negative.positiveEvents[0]?.award).toBe(0);
    expect(negative.balance).toBe(7);

    const hardZeroRules = rulesWith(["N11"]);
    const hardZero = resolveStage({
      balance: 7,
      rules: hardZeroRules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [
        {
          id: "sam-zero",
          family: "ALL",
          baseValue: exact(100),
          conditionApplies: (condition) =>
            condition.kind === "EVENT_INSIDE_FIELD" &&
            condition.field === "SAM_LAUNCHER" &&
            condition.affiliation === "SELF",
        },
      ],
      signedFacts: [],
    });
    expect(hardZero.positiveEvents[0]?.award).toBe(0);
    expect(hardZero.balance).toBe(7);
  });

  it("nets signed components per fact and facts per tick exactly, after positive events, independent of order", () => {
    const rules = rulesWith();
    const signedFacts = [
      { id: "half-a", components: [exact(7, 4), exact(-5, 4)] },
      { id: "half-b", components: [exact(1, 2)] },
      { id: "loss", components: [exact(-13)] },
    ] as const;

    const forward = resolveStage({
      balance: 10,
      rules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [{ id: "income", family: "ALL", baseValue: exact(5) }],
      signedFacts,
    });
    const reversed = resolveStage({
      balance: 10,
      rules,
      ruleDynamicState: RULE_STATE,
      positiveEvents: [{ id: "income", family: "ALL", baseValue: exact(5) }],
      signedFacts: [...signedFacts].reverse().map((fact) => ({
        ...fact,
        components: [...fact.components].reverse(),
      })),
    });

    expect(forward.finalizedSignedDelta).toBe(-12);
    expect(forward.balance).toBe(3);
    expect(forward.signedFacts.map((fact) => fact.id)).toEqual([
      "half-a",
      "half-b",
      "loss",
    ]);
    expect(reversed).toEqual(forward);
  });

  it("applies the non-negative balance floor once after same-tick signed aggregation", () => {
    const result = resolveStage({
      balance: 1,
      rules: rulesWith(),
      ruleDynamicState: RULE_STATE,
      positiveEvents: [],
      signedFacts: [
        { id: "large-loss", components: [exact(-3)] },
        { id: "same-tick-credit", components: [exact(1)] },
      ],
    });

    expect(result.finalizedSignedDelta).toBe(-2);
    expect(result.balance).toBe(0);
  });

  it("ceils a positive cost once and enforces cost-1 / cost / cost+1 affordability without mutation on rejection", () => {
    const cost = exact(101, 10); // exact 10.1 -> finalized cost 11

    expect(debit(10, cost)).toEqual({
      ok: false,
      cost: 11,
      balance: 10,
      reason: "INSUFFICIENT_FFY",
    });
    expect(debit(11, cost)).toEqual({ ok: true, cost: 11, balance: 0 });
    expect(debit(12, cost)).toEqual({ ok: true, cost: 11, balance: 1 });
    expect(debit(12, exact(0))).toEqual({ ok: true, cost: 0, balance: 12 });
  });

  it("rejects malformed balances, costs, and positive-event amounts at their economy boundary", () => {
    expect(() => debit(Number.NaN, exact(1))).toThrow(/FFY balance/i);
    expect(() => debit(10, exact(-1))).toThrow(/cost.*non-negative/i);
    expect(() => debit(10, exact(1, 0))).toThrow(/denominator/i);

    expect(() =>
      resolveStage({
        balance: 0,
        rules: rulesWith(),
        ruleDynamicState: RULE_STATE,
        positiveEvents: [
          { id: "invalid", family: "ALL", baseValue: exact(-1) },
        ],
        signedFacts: [],
      }),
    ).toThrow(/positive.*non-negative/i);
  });
});
