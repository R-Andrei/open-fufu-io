import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  resolveFfyEconomicStage,
  type PositiveFfyEventInput,
} from "../src/simulation/Economy";
import {
  createUnitDestroyedEvent,
  type UnitDestroyedEvent,
} from "../src/simulation/SimulationEvents";
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

interface TrainDestroyedEconomicService {
  readonly trainId: string;
  readonly dispatchSnapshot: TrainService.TrainDispatchEconomicSnapshot;
}

interface TrainDestroyedEconomicResolution {
  readonly trainId: string;
  readonly raiderOwnerId: string;
  readonly economic: TrainInterceptionEconomicOutcome;
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

function resolveDestroyedInterception(
  services: readonly TrainDestroyedEconomicService[],
  destructionEvent: UnitDestroyedEvent,
  input: {
    readonly raiderEventId: string;
    readonly pendingStationEvent?: PositiveFfyEventInput | null;
  },
): TrainDestroyedEconomicResolution | null {
  const candidate = (
    TrainService as unknown as Record<string, unknown>
  ).resolveTrainDestroyedEconomicOutcome;
  if (typeof candidate !== "function") {
    throw new Error(
      "missing TrainService capability resolveTrainDestroyedEconomicOutcome",
    );
  }
  return (
    candidate as (
      services: readonly TrainDestroyedEconomicService[],
      destructionEvent: UnitDestroyedEvent,
      input: {
        readonly raiderEventId: string;
        readonly pendingStationEvent?: PositiveFfyEventInput | null;
      },
    ) => TrainDestroyedEconomicResolution | null
  )(services, destructionEvent, input);
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

  it("consumes UNIT_DESTROYED by trainId and credits exactly one lowest-unitId Tank cause", () => {
    const snapshot = TrainService.createTrainDispatchEconomicSnapshot(
      "factory-a",
      "train-owner",
      1,
      { numerator: 3n, denominator: 2n },
    );
    const services = Object.freeze([
      Object.freeze({
        trainId: "other-train",
        dispatchSnapshot: TrainService.createTrainDispatchEconomicSnapshot(
          "factory-b",
          "other-owner",
          2,
        ),
      }),
      Object.freeze({
        trainId: "train-target",
        dispatchSnapshot: snapshot,
      }),
    ]);
    const pending = TrainService.createTrainStationFfyEvent(snapshot, {
      eventId: "train:station:same-tick",
    });
    const causes = [
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack-z",
        attacker: {
          unitId: "tank-z",
          ownerId: "raider-z",
          unitType: "TANK" as const,
          cellId: 8,
        },
      },
      {
        kind: "UNIT_ATTACK" as const,
        attackEventId: "attack-a",
        attacker: {
          unitId: "tank-a",
          ownerId: "raider-a",
          unitType: "TANK" as const,
          cellId: 6,
        },
      },
    ];
    const destruction = createUnitDestroyedEvent({
      id: "destroy-train",
      tick: 42,
      unit: {
        unitId: "train-target",
        ownerId: "train-owner",
        unitType: "TRAIN",
        cellId: 7,
      },
      causes,
    });

    const resolution = resolveDestroyedInterception(services, destruction, {
      raiderEventId: "train:interception:destroyed",
      pendingStationEvent: pending,
    });

    expect(resolution).toMatchObject({
      trainId: "train-target",
      raiderOwnerId: "raider-a",
      economic: {
        canceledStationEventId: "train:station:same-tick",
        pendingStationEvent: null,
        raiderEvent: {
          id: "train:interception:destroyed",
          family: "MILITARY_CONQUEST",
          baseValue: { numerator: 15_000n, denominator: 1n },
        },
      },
    });

    const reversed = createUnitDestroyedEvent({
      id: "destroy-train-reversed",
      tick: 42,
      unit: destruction.payload.unit,
      causes: [...causes].reverse(),
    });
    expect(
      resolveDestroyedInterception(services, reversed, {
        raiderEventId: "train:interception:destroyed-reversed",
        pendingStationEvent: pending,
      })?.raiderOwnerId,
    ).toBe("raider-a");
  });

  it("ignores destruction facts that are not matching Tank-on-Train interceptions", () => {
    const snapshot = TrainService.createTrainDispatchEconomicSnapshot(
      "factory-a",
      "train-owner",
      1,
    );
    const services = Object.freeze([
      Object.freeze({ trainId: "train-target", dispatchSnapshot: snapshot }),
    ]);
    const tankCause = {
      kind: "UNIT_ATTACK" as const,
      attackEventId: "tank-attack",
      attacker: {
        unitId: "tank-a",
        ownerId: "raider-a",
        unitType: "TANK" as const,
        cellId: 6,
      },
    };

    const nonTrain = createUnitDestroyedEvent({
      id: "destroy-warship",
      tick: 42,
      unit: {
        unitId: "train-target",
        ownerId: "train-owner",
        unitType: "WARSHIP",
        cellId: 7,
      },
      causes: [tankCause],
    });
    expect(
      resolveDestroyedInterception(services, nonTrain, {
        raiderEventId: "ignored-warship",
      }),
    ).toBeNull();

    const unknownTrain = createUnitDestroyedEvent({
      id: "destroy-unknown-train",
      tick: 42,
      unit: {
        unitId: "train-missing",
        ownerId: "train-owner",
        unitType: "TRAIN",
        cellId: 7,
      },
      causes: [tankCause],
    });
    expect(
      resolveDestroyedInterception(services, unknownTrain, {
        raiderEventId: "ignored-unknown-train",
      }),
    ).toBeNull();

    const artilleryCause = createUnitDestroyedEvent({
      id: "destroy-train-artillery",
      tick: 42,
      unit: {
        unitId: "train-target",
        ownerId: "train-owner",
        unitType: "TRAIN",
        cellId: 7,
      },
      causes: [
        {
          kind: "UNIT_ATTACK",
          attackEventId: "artillery-attack",
          attacker: {
            unitId: "artillery-a",
            ownerId: "artillery-owner",
            unitType: "HEAVY_ARTILLERY",
            cellId: 9,
          },
        },
      ],
    });
    expect(
      resolveDestroyedInterception(services, artilleryCause, {
        raiderEventId: "ignored-artillery",
      }),
    ).toBeNull();
  });
});
