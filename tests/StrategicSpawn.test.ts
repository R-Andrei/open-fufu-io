import type {
  ControllerLimitsView,
  MechanicsApi,
  RulesView,
  SelfFactionView,
  SpawnBaseContext,
  SpawnProfileView,
} from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import { createInitialMatchState } from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  resolveStrategicSpawn,
  type StrategicSpawnBaseContextInput,
} from "../src/simulation/StrategicSpawn";

const ORDINARY_PROFILE: SpawnProfileView = Object.freeze({
  influenceSlotCount: 1,
  exactOriginCount: 1,
  influenceAreaCells: Object.freeze([160_000]),
  initialTerritoryPopulationBearingCells: 1_000,
  footprintShape: "COMPACT",
});

const LIMITS: ControllerLimitsView = Object.freeze({
  persistentMemoryBytes: 131_072,
  serializedDecisionBytes: 262_144,
  queriesPerDecision: 128,
  materializedCellsPerDecision: 25_000,
  directiveUpdatesPerDecision: 128,
  commandsPerDecision: 64,
  policyRulesPerDecision: 256,
  debugItemsPerDecision: 256,
  logBytesPerDecision: 8_192,
  eventsPerDecision: 512,
  teamSignalPayloadBytes: 1_024,
});

const RULES_VIEW: RulesView = Object.freeze({ version: "test", values: Object.freeze({}) });
const MECHANICS = Object.freeze({}) as MechanicsApi;
const CELLS = Object.freeze({}) as StrategicSpawnBaseContextInput["cells"];
const RANDOM = Object.freeze({ next: () => 0.25, keyed: () => 0.5 });

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([]));
}

function selfView(id: string): SelfFactionView {
  return Object.freeze({
    id,
    displayName: id.toUpperCase(),
    status: "ACTIVE" as const,
    isMinorFaction: false as const,
    origin: Object.freeze({
      id: `origin-${id}`,
      displayName: `Origin ${id}`,
      version: "1",
      positiveTraitIds: Object.freeze([]),
      negativeTraitIds: Object.freeze([]),
    }),
    effectiveModifiers: Object.freeze({ values: Object.freeze({}) }),
    populationState: Object.freeze({
      total: 0,
      available: 0,
      committedOffense: 0,
      committedCounterResponse: 0,
      aboardTransports: 0,
      capacity: 0,
      growthPerSecond: 0,
      utilization: 0,
      neutralSettlementHalfResidual: 0 as const,
    }),
    ffy: 0,
  });
}

function baseContext(id: string): StrategicSpawnBaseContextInput {
  return Object.freeze({
    game: Object.freeze({
      matchId: "strategic-test",
      tick: 0,
      decisionNumber: 0,
      ticksPerSecond: 10,
      decisionEveryTicks: 1,
      mapId: "synthetic",
      mapVersion: "1",
      rulesetVersion: "test",
      controllerApiVersion: "1",
      spawnMode: "STRATEGIC" as const,
    }),
    me: selfView(id),
    cells: CELLS,
    rules: RULES_VIEW,
    mechanics: MECHANICS,
    random: RANDOM,
    limits: LIMITS,
    profile: ORDINARY_PROFILE,
  });
}

describe("#107 Strategic Spawn coordinator", () => {
  it("runs the ordinary three hidden phases and emits the resolved shared handoff", async () => {
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "strategic-ordinary-three-phase",
        width: 220,
        height: 1,
        factions: [
          { id: "alpha", rules: rules() },
          { id: "beta", rules: rules() },
        ],
      }),
    );

    const phase1Seen: Record<string, unknown> = {};
    const phase2Seen: Record<string, unknown> = {};
    const phase3Seen: Record<string, unknown> = {};
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence(context) {
          phase1Seen.alpha = context;
          return { centers: [20] };
        },
        reconsiderInfluence(context) {
          phase2Seen.alpha = context;
          return { centers: [25] };
        },
        chooseOrigins(context) {
          phase3Seen.alpha = context;
          expect(context.spawn.isValidOriginChoice(25, 0)).toBe(true);
          expect(context.spawn.validateOriginChoices([25])).toEqual({ valid: true });
          expect(context.spawn.validateOriginChoices([])).toEqual({
            valid: false,
            code: "WRONG_ORIGIN_COUNT",
          });
          return { origins: [25] };
        },
      },
      beta: {
        chooseInfluence(context) {
          phase1Seen.beta = context;
          return { centers: [150] };
        },
        reconsiderInfluence(context) {
          phase2Seen.beta = context;
          return { centers: [155] };
        },
        chooseOrigins(context) {
          phase3Seen.beta = context;
          return { origins: [155] };
        },
      },
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: baseContext,
    });

    const phase1Alpha = phase1Seen.alpha as SpawnBaseContext & { phase: string };
    const phase2Alpha = phase2Seen.alpha as SpawnBaseContext & {
      phase: string;
      revealedFactions: readonly { id: string; displayName: string; influenceCenters: readonly number[] }[];
    };
    const phase3Alpha = phase3Seen.alpha as SpawnBaseContext & {
      phase: string;
      revealedFactions: readonly { id: string; displayName: string; influenceCenters: readonly number[] }[];
    };

    expect(phase1Alpha.phase).toBe("INFLUENCE");
    expect(phase1Alpha.participants.map((entry) => entry.id)).toEqual(["alpha", "beta"]);
    expect(phase1Alpha.participants.map((entry) => entry.startingPopulation)).toEqual([500, 500]);
    expect("revealedFactions" in phase1Alpha).toBe(false);

    expect(phase2Alpha.phase).toBe("RECONSIDER");
    expect(phase2Alpha.revealedFactions).toEqual([
      { id: "alpha", displayName: "ALPHA", influenceCenters: [20] },
      { id: "beta", displayName: "BETA", influenceCenters: [150] },
    ]);

    expect(phase3Alpha.phase).toBe("ORIGIN");
    expect(phase3Alpha.revealedFactions).toEqual([
      { id: "alpha", displayName: "ALPHA", influenceCenters: [25] },
      { id: "beta", displayName: "BETA", influenceCenters: [155] },
    ]);
    expect(Object.keys(phase1Seen).sort()).toEqual(["alpha", "beta"]);
    expect(Object.keys(phase2Seen).sort()).toEqual(["alpha", "beta"]);
    expect(Object.keys(phase3Seen).sort()).toEqual(["alpha", "beta"]);

    expect(result.initialization).toEqual({
      spawnMode: "STRATEGIC",
      spawnResolverVersion: "1",
      factions: [
        {
          factionId: "alpha",
          origins: [
            {
              originSlot: 0,
              resolvedExactOrigin: 25,
              source: "STRATEGIC_SUBMISSION",
            },
          ],
        },
        {
          factionId: "beta",
          origins: [
            {
              originSlot: 0,
              resolvedExactOrigin: 155,
              source: "STRATEGIC_SUBMISSION",
            },
          ],
        },
      ],
    });
  });
});
