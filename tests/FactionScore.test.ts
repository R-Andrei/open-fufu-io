import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { calculateFactionScore } from "../src/simulation/Economy";
import { settleFactoryTrainEconomicEvents } from "../src/simulation/FactoryTrainRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
} from "../src/simulation/MatchState";
import { createUnitDestroyedEvent } from "../src/simulation/SimulationEvents";
import { TickEngine } from "../src/simulation/TickEngine";
import { createTrainDispatchEconomicSnapshot } from "../src/simulation/TrainService";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function scoreState(initialOwners: readonly (string | null)[]) {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "faction-score-red",
      width: initialOwners.length,
      height: 1,
      terrain: initialOwners.map(() => "PLAINS"),
      initialOwners,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function serializedFaction(state: ReturnType<typeof scoreState>, factionId: string) {
  const parsed = JSON.parse(canonicalMatchStateSerialization(state)) as {
    readonly factions: readonly Record<string, unknown>[];
  };
  return parsed.factions.find((faction) => faction.id === factionId);
}

describe("authoritative faction strength score", () => {
  it("scores an all-domain reference-baseline faction at exactly 1000", () => {
    const state = scoreState(["alpha", "beta"]);

    expect(calculateFactionScore(state, "alpha")).toBe(1000);
  });

  it("applies square-root diminishing returns to territory before composition", () => {
    const state = scoreState(["alpha", "alpha", "alpha", "beta"]);

    // T = 3 * 2 / 4 = 1.5, while E = P = 1 at tick 0.
    // floor(300 * sqrt(1.5) + 250 + 450) = 1067.
    expect(calculateFactionScore(state, "alpha")).toBe(1067);
  });

  it("persists finalized ordinary positive FFY earnings and keeps a baseline earner at score 1000", () => {
    const initial = scoreState(["alpha", "beta"]);
    const initialAlpha = initial.factions.find((faction) => faction.id === "alpha")!;

    expect(initialAlpha).toHaveProperty("lifetimeGrossPositiveFfyEarned", 0);
    expect(serializedFaction(initial, "alpha")).toHaveProperty(
      "lifetimeGrossPositiveFfyEarned",
      0,
    );

    const advanced = new TickEngine().advance(initial, []);
    const advancedAlpha = advanced.factions.find(
      (faction) => faction.id === "alpha",
    )!;

    expect(advanced.tick).toBe(1);
    expect(advancedAlpha.ffy).toBe(25_100);
    expect(advancedAlpha).toHaveProperty("lifetimeGrossPositiveFfyEarned", 100);
    expect(serializedFaction(advanced, "alpha")).toHaveProperty(
      "lifetimeGrossPositiveFfyEarned",
      100,
    );
    expect(calculateFactionScore(advanced, "alpha")).toBe(1000);
  });

  it("accrues finalized non-passive ordinary FFY awards into lifetime economy", () => {
    const base = scoreState(["alpha", "beta"]);
    const servicesAtInterception = Object.freeze([
      Object.freeze({
        trainId: "train-a",
        factoryId: "factory-a",
        loopSnapshotId: "train-a",
        isPrimary: true,
        dispatchSnapshot: createTrainDispatchEconomicSnapshot(
          "factory-a",
          "alpha",
          1,
        ),
        resumeAtTick: null,
      }),
    ]);
    const destruction = createUnitDestroyedEvent({
      id: "destroy-train-score-accounting",
      tick: base.tick,
      unit: {
        unitId: "train-a",
        ownerId: "alpha",
        unitType: "TRAIN",
        cellId: 1,
      },
      causes: [
        {
          kind: "UNIT_ATTACK",
          attackEventId: "tank-attack-score-accounting",
          attacker: {
            unitId: "tank-beta",
            ownerId: "beta",
            unitType: "TANK",
            cellId: 1,
          },
        },
      ],
    });
    const betaBefore = base.factions.find((faction) => faction.id === "beta")!;

    const update = settleFactoryTrainEconomicEvents(
      base,
      servicesAtInterception,
      [destruction],
      () => false,
    );
    const betaAfter = update?.factions.find((faction) => faction.id === "beta");

    expect(update).not.toBeNull();
    expect(betaAfter?.ffy).toBe(betaBefore.ffy + 10_000);
    expect(betaAfter?.lifetimeGrossPositiveFfyEarned).toBe(
      betaBefore.lifetimeGrossPositiveFfyEarned + 10_000,
    );
  });
});