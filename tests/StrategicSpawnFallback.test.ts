import type {
  ControllerLimitsView,
  MechanicsApi,
  RulesView,
  SelfFactionView,
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

const PROFILE: SpawnProfileView = Object.freeze({
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

function contextForFaction(id: string): StrategicSpawnBaseContextInput {
  const me: SelfFactionView = Object.freeze({
    id,
    displayName: id.toUpperCase(),
    status: "ACTIVE",
    isMinorFaction: false,
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
      neutralSettlementHalfResidual: 0,
    }),
    ffy: 0,
  });

  return Object.freeze({
    game: Object.freeze({
      matchId: "strategic-fallback-certification",
      tick: 0,
      decisionNumber: 0,
      ticksPerSecond: 10,
      decisionEveryTicks: 1,
      mapId: "synthetic",
      mapVersion: "1",
      rulesetVersion: "test",
      controllerApiVersion: "1",
      spawnMode: "STRATEGIC",
    }),
    me,
    cells: Object.freeze({}) as StrategicSpawnBaseContextInput["cells"],
    segments: Object.freeze({}) as StrategicSpawnBaseContextInput["segments"],
    rules: Object.freeze({ version: "test", values: Object.freeze({}) }) as RulesView,
    mechanics: Object.freeze({}) as MechanicsApi,
    random: Object.freeze({ next: () => 0.25, keyed: () => 0.5 }),
    limits: LIMITS,
    profile: PROFILE,
  });
}

describe("#107 Strategic Spawn structural Phase-3 fallback", () => {
  it("uses the canonical global fallback when a missing chooseOrigins hook has no legal in-region seed", async () => {
    const width = 1_000;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    terrain[900] = "TEST";
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "strategic-missing-origin-global-fallback",
        width,
        height: 1,
        terrain,
        factions: [
          {
            id: "alpha",
            rules: compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([])),
          },
        ],
      }),
    );
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [0] }),
        reconsiderInfluence: () => ({ centers: [0] }),
      },
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction,
    });

    expect(result.evidence.factions[0]?.phase3).toMatchObject({
      fallbackReason: "HOOK_MISSING",
    });
    expect(result.evidence.factions[0]?.phase3.submittedOrigins).toBeUndefined();
    expect(result.initialization.factions[0]?.origins[0]).toMatchObject({
      originSlot: 0,
      resolvedExactOrigin: 900,
      source: "STRATEGIC_SUBMISSION",
      resolutionReason: "ORIGIN_GLOBAL_FALLBACK",
    });
    expect(result.evidence.factions[0]?.origins[0]?.diagnostics).toEqual(
      expect.arrayContaining(["ORIGIN_GLOBAL_FALLBACK"]),
    );
  });
});
