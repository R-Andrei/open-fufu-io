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
import {
  InProcessTestControllerHost,
  projectLawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
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

const P39_PROFILE: SpawnProfileView = Object.freeze({
  influenceSlotCount: 2,
  exactOriginCount: 2,
  influenceAreaCells: Object.freeze([80_000, 80_000]),
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

function contextForFaction(
  id: string,
  profile: SpawnProfileView = PROFILE,
): StrategicSpawnBaseContextInput {
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
    profile,
  });
}

function cellId(width: number, x: number, y: number): number {
  return y * width + x;
}

describe("#107 Strategic Spawn certification regressions", () => {
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

  it("preserves committed memory through all Strategic hooks and the first normal decide", async () => {
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "strategic-memory-continuity",
        width: 200,
        height: 1,
        factions: [
          {
            id: "alpha",
            rules: compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([])),
          },
        ],
      }),
    );
    let normalDecideCalls = 0;
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence(context) {
          expect(context.memory).toEqual({});
          return { centers: [100], memory: { phase: "influence" } };
        },
        reconsiderInfluence(context) {
          expect(context.memory).toEqual({ phase: "influence" });
          return { centers: [100], memory: { phase: "reconsider" } };
        },
        chooseOrigins(context) {
          expect(context.memory).toEqual({ phase: "reconsider" });
          return { origins: [100], memory: { phase: "origin" } };
        },
        decide(observation) {
          normalDecideCalls += 1;
          expect(observation.memory).toEqual({ phase: "origin" });
          return { commands: [] };
        },
      },
    });

    await resolveStrategicSpawn({ state, host, contextForFaction });

    expect(
      host.invoke(
        "alpha",
        projectLawfulControllerObservation(state, "alpha", 0),
      ),
    ).toEqual({ ok: true, output: { commands: [] } });
    expect(normalDecideCalls).toBe(1);
  });

  it("enforces the ordinary and P39 influence-region squared-distance boundaries", async () => {
    const ordinaryWidth = 500;
    const ordinaryState = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "strategic-ordinary-influence-boundary",
        width: ordinaryWidth,
        height: 402,
        factions: [
          {
            id: "alpha",
            rules: compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([])),
          },
        ],
      }),
    );
    const ordinaryInside = cellId(ordinaryWidth, 69, 394); // d^2 = 159,997
    const ordinaryBoundary = cellId(ordinaryWidth, 0, 400); // d^2 = 160,000
    const ordinaryOutside = cellId(ordinaryWidth, 1, 400); // d^2 = 160,001
    const ordinaryHost = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [0] }),
        reconsiderInfluence: () => ({ centers: [0] }),
        chooseOrigins(context) {
          expect(context.spawn.isValidOriginChoice(ordinaryInside, 0)).toBe(true);
          expect(context.spawn.isValidOriginChoice(ordinaryBoundary, 0)).toBe(true);
          expect(context.spawn.isValidOriginChoice(ordinaryOutside, 0)).toBe(false);
          return { origins: [ordinaryBoundary] };
        },
      },
    });
    const ordinary = await resolveStrategicSpawn({
      state: ordinaryState,
      host: ordinaryHost,
      contextForFaction,
    });
    expect(ordinary.initialization.factions[0]?.origins[0]?.resolvedExactOrigin).toBe(
      ordinaryBoundary,
    );

    const splitWidth = 500;
    const splitState = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "strategic-p39-influence-boundary",
        width: splitWidth,
        height: 500,
        factions: [
          {
            id: "alpha",
            rules: compileRuleProfile(
              RULE_AXIS_REGISTRY,
              originRuleProfileInput(["P39"]),
            ),
          },
        ],
      }),
    );
    const splitInside = cellId(splitWidth, 166, 229); // d^2 = 79,997
    const splitBoundary = cellId(splitWidth, 40, 280); // d^2 = 80,000
    const splitOutside = cellId(splitWidth, 81, 271); // d^2 = 80,002
    const splitSecondary = cellId(splitWidth, 499, 499);
    const splitHost = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [0, splitSecondary] }),
        reconsiderInfluence: () => ({ centers: [0, splitSecondary] }),
        chooseOrigins(context) {
          expect(context.spawn.isValidOriginChoice(splitInside, 0)).toBe(true);
          expect(context.spawn.isValidOriginChoice(splitBoundary, 0)).toBe(true);
          expect(context.spawn.isValidOriginChoice(splitOutside, 0)).toBe(false);
          return { origins: [splitBoundary, splitSecondary] };
        },
      },
    });
    const split = await resolveStrategicSpawn({
      state: splitState,
      host: splitHost,
      contextForFaction: (id) => contextForFaction(id, P39_PROFILE),
    });
    expect(split.initialization.factions[0]?.origins.map((origin) => origin.originSlot)).toEqual([
      0,
      1,
    ]);
    expect(split.initialization.factions[0]?.origins[0]?.resolvedExactOrigin).toBe(
      splitBoundary,
    );
  });
});