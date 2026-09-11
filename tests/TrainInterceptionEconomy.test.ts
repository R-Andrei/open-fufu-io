import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  resolveFfyEconomicStage,
  type PositiveFfyEventInput,
} from "../src/simulation/Economy";
import * as TrainService from "../src/simulation/TrainService";

const RULE_STATE = Object.freeze({
  ownedPersistentStructureCount: 0,
  territorialContactCount: 0,
  peakTotalPopulation: 0,
});

interface TrainInterceptionEconomicOutcome {
  readonly canceledStationEventId: string | null;
  readonly pendingStationEvent: PositiveFfyEventInput | null;
  readonly raiderEvent: PositiveFfyEventInput;
}

function resolveInterception(
  snapshot: TrainService.TrainDispatchEconomicSnapshot,
  input: {
    readonly raiderEventId: string;
    readonly pendingStationEvent?: PositiveFfyEventInput | null;
  },
): TrainInterceptionEconomicOutcome {
  const candidate = (
    TrainService as unknown as Record<string, unknown>
  ).resolveTrainInterceptionEconomicOutcome;
  if (typeof candidate !== "function") {
    throw new Error(
      "missing TrainService capability resolveTrainInterceptionEconomicOutcome",
    );
  }
  return (
    candidate as (
      snapshot: TrainService.TrainDispatchEconomicSnapshot,
      input: {
        readonly raiderEventId: string;
        readonly pendingStationEvent?: PositiveFfyEventInput | null;
      },
    ) => TrainInterceptionEconomicOutcome
  )(snapshot, input);
}

function raiderRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [
      echoRuleContribution("ffy.all", "BENEFICIAL", 2_000, "echo:all"),
      echoRuleContribution(
        "ffy.military_conquest",
        "BENEFICIAL",
        3_000,
        "echo:military",
      ),
    ],
  });
}

describe("Factory Train interception economic consequence", () => {
  it("cancels the same-tick pending Industrial event and awards the raider the exact pending base cargo through Military/conquest yield", () => {
    const snapshot = TrainService.createTrainDispatchEconomicSnapshot(
      "factory-a",
      "train-owner",
      1,
      { numerator: 3n, denominator: 2n },
    );
    const pending = TrainService.createTrainStationFfyEvent(snapshot, {
      eventId: "train:station:pending",
    });

    const outcome = resolveInterception(snapshot, {
      raiderEventId: "train:interception:raider",
      pendingStationEvent: pending,
    });

    expect(outcome.canceledStationEventId).toBe("train:station:pending");
    expect(outcome.pendingStationEvent).toBeNull();
    expect(outcome.raiderEvent).toMatchObject({
      id: "train:interception:raider",
      family: "MILITARY_CONQUEST",
      baseValue: { numerator: 15_000n, denominator: 1n },
    });

    const raider = resolveFfyEconomicStage({
      balance: 0,
      rules: raiderRules(),
      ruleDynamicState: RULE_STATE,
      positiveEvents: [outcome.raiderEvent],
      signedFacts: [],
    });
    expect(raider.positiveEvents).toEqual([
      {
        id: "train:interception:raider",
        family: "MILITARY_CONQUEST",
        award: 22_500,
      },
    ]);
    expect(raider.balance).toBe(22_500);
  });

  it("never claws back prior Train payouts and can resolve carried cargo even when no new station event exists", () => {
    const snapshot = TrainService.createTrainDispatchEconomicSnapshot(
      "factory-a",
      "train-owner",
      2,
    );

    const outcome = resolveInterception(snapshot, {
      raiderEventId: "train:interception:between-stations",
      pendingStationEvent: null,
    });

    expect(outcome.canceledStationEventId).toBeNull();
    expect(outcome.pendingStationEvent).toBeNull();
    expect(outcome.raiderEvent).toMatchObject({
      family: "MILITARY_CONQUEST",
      baseValue: { numerator: 11_250n, denominator: 1n },
    });

    const alreadySettledTrainOwner = resolveFfyEconomicStage({
      balance: 7_500,
      rules: compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] }),
      ruleDynamicState: RULE_STATE,
      positiveEvents: [],
      signedFacts: [],
    });
    expect(alreadySettledTrainOwner.balance).toBe(7_500);
  });
});
