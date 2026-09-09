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
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import {
  InProcessTestControllerHost,
  type ControllerHost,
} from "../src/simulation/ControllerRuntime";
import {
  createInitialMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { materializeSpawnInitialization } from "../src/simulation/SpawnInitialization";
import {
  compareSpawnUtf8,
  SPAWN_STABLE_TIE32_ID,
  stableTie32,
} from "../src/simulation/SpawnSemantics";
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

const P39_PROFILE: SpawnProfileView = Object.freeze({
  influenceSlotCount: 2,
  exactOriginCount: 2,
  influenceAreaCells: Object.freeze([80_000, 80_000]),
  initialTerritoryPopulationBearingCells: 1_000,
  footprintShape: "COMPACT",
});

const P39_STAR_PROFILE: SpawnProfileView = Object.freeze({
  influenceSlotCount: 2,
  exactOriginCount: 2,
  influenceAreaCells: Object.freeze([80_000, 80_000]),
  initialTerritoryPopulationBearingCells: 1_000,
  footprintShape: "STAR",
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

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
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

function baseContext(
  id: string,
  profile: SpawnProfileView = ORDINARY_PROFILE,
): StrategicSpawnBaseContextInput {
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
    profile,
  });
}

function spawnState(options: {
  readonly seed: string;
  readonly width: number;
  readonly height?: number;
  readonly terrain?: readonly string[];
  readonly factions: readonly {
    readonly id: string;
    readonly traits?: readonly OriginTraitId[];
  }[];
}): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: options.seed,
      width: options.width,
      height: options.height ?? 1,
      ...(options.terrain === undefined ? {} : { terrain: options.terrain }),
      factions: options.factions.map((faction) => ({
        id: faction.id,
        rules: rules(faction.traits),
      })),
    }),
  );
}

function cellId(width: number, x: number, y: number): number {
  return y * width + x;
}

function defaultInfluenceCenter(
  seed: string,
  factionId: string,
  slot: number,
  candidates: readonly number[],
): number {
  return [...candidates].sort((left, right) => {
    const tie =
      stableTie32("default-influence-center", "1", seed, factionId, slot, left) -
      stableTie32("default-influence-center", "1", seed, factionId, slot, right);
    return tie === 0 ? left - right : tie;
  })[0]!;
}

function resolvedOrigins(
  initialization: Awaited<ReturnType<typeof resolveStrategicSpawn>>["initialization"],
): Record<string, readonly number[]> {
  return Object.fromEntries(
    initialization.factions.map((faction) => [
      faction.factionId,
      faction.origins.map((origin) => origin.resolvedExactOrigin),
    ]),
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("#107 Strategic Spawn coordinator", () => {
  it("runs the ordinary three hidden phases and emits the resolved shared handoff", async () => {
    const state = spawnState({
      seed: "strategic-ordinary-three-phase",
      width: 220,
      factions: [{ id: "alpha" }, { id: "beta" }],
    });

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

  it.each([
    {
      label: "missing",
      expectedReason: "HOOK_MISSING",
      host: () => new InProcessTestControllerHost({ alpha: {} }),
    },
    {
      label: "runtime-faulting",
      expectedReason: "HOOK_RUNTIME_FAULT",
      host: () =>
        new InProcessTestControllerHost({
          alpha: {
            chooseInfluence() {
              throw new Error("phase1");
            },
            reconsiderInfluence() {
              throw new Error("phase2");
            },
            chooseOrigins() {
              throw new Error("phase3");
            },
          },
        }),
    },
    {
      label: "malformed",
      expectedReason: "HOOK_MALFORMED",
      host: () =>
        new InProcessTestControllerHost({
          alpha: {
            chooseInfluence: () => ({ centers: [] }) as never,
            reconsiderInfluence: () => ({ centers: [Number.NaN] }),
            chooseOrigins: () => ({ origins: [] }) as never,
          },
        }),
    },
  ])("uses canonical whole-hook defaults for $label Spawn hooks", async ({ expectedReason, host }) => {
    const seed = `strategic-default-${expectedReason}`;
    const width = 121;
    const legalSeeds = [10, 60, 110] as const;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    for (const candidate of legalSeeds) terrain[candidate] = "TEST";
    const state = spawnState({
      seed,
      width,
      terrain,
      factions: [{ id: "alpha" }],
    });
    const expectedCenter = defaultInfluenceCenter(seed, "alpha", 0, legalSeeds);

    const result = await resolveStrategicSpawn({
      state,
      host: host(),
      contextForFaction: baseContext,
    });

    expect(resolvedOrigins(result.initialization)).toEqual({ alpha: [expectedCenter] });
    expect(result.evidence).toMatchObject({
      spawnResolverVersion: "1",
      stableTie32Id: SPAWN_STABLE_TIE32_ID,
      factions: [
        {
          factionId: "alpha",
          phase1: {
            resolvedInfluenceCenters: [expectedCenter],
            fallbackReason: expectedReason,
          },
          phase2: {
            resolvedInfluenceCenters: [expectedCenter],
            fallbackReason: expectedReason,
          },
          phase3: {
            resolvedRequestedOrigins: [expectedCenter],
            fallbackReason: expectedReason,
          },
        },
      ],
    });
  });

  it("resolves simultaneous origin conflicts independently of faction enumeration and async completion order", async () => {
    const makeRun = async (
      factionOrder: readonly string[],
      delays: Readonly<Record<string, number>>,
    ) => {
      const completedPhase1 = new Set<string>();
      const completedPhase2 = new Set<string>();
      const host: ControllerHost = {
        invoke() {
          return { ok: true };
        },
        async chooseInfluence(factionId) {
          await delay(delays[factionId] ?? 0);
          completedPhase1.add(factionId);
          return { ok: true, output: { centers: [150] } };
        },
        async reconsiderInfluence(factionId) {
          if (completedPhase1.size !== factionOrder.length) {
            throw new Error("Phase 2 began before the complete Phase-1 barrier");
          }
          await delay(delays[factionId] ?? 0);
          completedPhase2.add(factionId);
          return { ok: true, output: { centers: [150] } };
        },
        async chooseOrigins(factionId) {
          if (completedPhase2.size !== factionOrder.length) {
            throw new Error("Phase 3 began before the complete Phase-2 barrier");
          }
          await delay(delays[factionId] ?? 0);
          return { ok: true, output: { origins: [150] } };
        },
      };
      return resolveStrategicSpawn({
        state: spawnState({
          seed: "strategic-global-priority",
          width: 500,
          factions: factionOrder.map((id) => ({ id })),
        }),
        host,
        contextForFaction: baseContext,
      });
    };

    const forward = await makeRun(["alpha", "beta", "gamma"], {
      alpha: 12,
      beta: 4,
      gamma: 0,
    });
    const reversed = await makeRun(["gamma", "beta", "alpha"], {
      alpha: 0,
      beta: 4,
      gamma: 12,
    });

    expect(reversed.initialization).toEqual(forward.initialization);
    expect(reversed.evidence).toEqual(forward.evidence);

    const priorityWinner = ["alpha", "beta", "gamma"].sort((left, right) => {
      const delta =
        stableTie32("exact-origin-priority", "1", "strategic-global-priority", left, 0) -
        stableTie32("exact-origin-priority", "1", "strategic-global-priority", right, 0);
      return delta === 0 ? compareSpawnUtf8(left, right) : delta;
    })[0]!;
    const origins = resolvedOrigins(forward.initialization);
    expect(origins[priorityWinner]).toEqual([150]);

    const resolved = Object.values(origins).flat();
    for (let left = 0; left < resolved.length; left += 1) {
      for (let right = left + 1; right < resolved.length; right += 1) {
        expect(Math.abs(resolved[left]! - resolved[right]!)).toBeGreaterThanOrEqual(50);
      }
    }
  });

  it("preserves a valid P39 sibling request while repairing only the semantic-invalid slot", async () => {
    const state = spawnState({
      seed: "strategic-p39-repair",
      width: 800,
      factions: [{ id: "alpha", traits: ["P39"] }],
    });
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [100, 200] }),
        reconsiderInfluence: () => ({ centers: [100, 200] }),
        chooseOrigins(context) {
          expect(context.spawn.validateOriginChoices([100, 700])).toEqual({
            valid: false,
            code: "OUTSIDE_INFLUENCE",
            slotIndex: 1,
          });
          return { origins: [100, 700] };
        },
      },
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: (id) => baseContext(id, P39_PROFILE),
    });
    const alpha = result.initialization.factions[0]!;

    expect(alpha.origins.map((origin) => origin.originSlot)).toEqual([0, 1]);
    expect(alpha.origins[0]).toMatchObject({
      originSlot: 0,
      resolvedExactOrigin: 100,
      source: "STRATEGIC_SUBMISSION",
    });
    expect(alpha.origins[1]).toMatchObject({
      originSlot: 1,
      source: "STRATEGIC_SUBMISSION",
      resolutionReason: "ORIGIN_IN_REGION_FALLBACK",
    });
    expect(alpha.origins[1]?.resolvedExactOrigin).not.toBe(700);
    expect((alpha.origins[1]?.resolvedExactOrigin ?? 0) - 200).toBeLessThanOrEqual(283);
    expect(result.evidence.factions[0]?.phase3).toMatchObject({
      submittedOrigins: [100, 700],
      resolvedRequestedOrigins: [100, 700],
    });
    expect(result.evidence.factions[0]?.origins[1]?.diagnostics).toEqual(
      expect.arrayContaining(["ORIGIN_OUTSIDE_INFLUENCE", "ORIGIN_IN_REGION_FALLBACK"]),
    );
  });

  it("uses deterministic distinct multi-slot influence defaults for P39", async () => {
    const seed = "strategic-p39-default-influence";
    const width = 801;
    const legalSeeds = [20, 400, 780] as const;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    for (const candidate of legalSeeds) terrain[candidate] = "TEST";
    const state = spawnState({
      seed,
      width,
      terrain,
      factions: [{ id: "alpha", traits: ["P39"] }],
    });
    const first = defaultInfluenceCenter(seed, "alpha", 0, legalSeeds);
    const second = defaultInfluenceCenter(
      seed,
      "alpha",
      1,
      legalSeeds.filter((cell) => cell !== first),
    );

    const run = () =>
      resolveStrategicSpawn({
        state,
        host: new InProcessTestControllerHost({ alpha: {} }),
        contextForFaction: (id) => baseContext(id, P39_PROFILE),
      });
    const firstRun = await run();
    const secondRun = await run();

    expect(firstRun).toEqual(secondRun);
    expect(first).not.toBe(second);
    expect(firstRun.evidence.factions[0]?.phase1).toMatchObject({
      resolvedInfluenceCenters: [first, second],
      fallbackReason: "HOOK_MISSING",
    });
    expect(firstRun.evidence.factions[0]?.phase2).toMatchObject({
      resolvedInfluenceCenters: [first, second],
      fallbackReason: "HOOK_MISSING",
    });
    expect(firstRun.initialization.factions[0]?.origins).toEqual([
      {
        originSlot: 0,
        resolvedExactOrigin: first,
        source: "STRATEGIC_SUBMISSION",
      },
      {
        originSlot: 1,
        resolvedExactOrigin: second,
        source: "STRATEGIC_SUBMISSION",
      },
    ]);
  });

  it("keeps P39 duplicate requests structurally intact and repairs only the seeded-priority loser", async () => {
    const seed = "strategic-p39-duplicate";
    const state = spawnState({
      seed,
      width: 600,
      factions: [{ id: "alpha", traits: ["P39"] }],
    });
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [250, 250] }),
        reconsiderInfluence: () => ({ centers: [250, 250] }),
        chooseOrigins: () => ({ origins: [250, 250] }),
      },
    });
    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: (id) => baseContext(id, P39_PROFILE),
    });
    const winnerSlot = [0, 1].sort((left, right) => {
      const delta =
        stableTie32("exact-origin-priority", "1", seed, "alpha", left) -
        stableTie32("exact-origin-priority", "1", seed, "alpha", right);
      return delta === 0 ? left - right : delta;
    })[0]!;
    const loserSlot = winnerSlot === 0 ? 1 : 0;
    const origins = result.initialization.factions[0]!.origins;

    expect(result.evidence.factions[0]?.phase3).toMatchObject({
      submittedOrigins: [250, 250],
      resolvedRequestedOrigins: [250, 250],
    });
    expect(origins[winnerSlot]).toMatchObject({
      originSlot: winnerSlot,
      resolvedExactOrigin: 250,
      source: "STRATEGIC_SUBMISSION",
    });
    expect(origins[loserSlot]).toMatchObject({
      originSlot: loserSlot,
      source: "STRATEGIC_SUBMISSION",
      resolutionReason: "ORIGIN_IN_REGION_FALLBACK",
    });
    expect(origins[loserSlot]?.resolvedExactOrigin).not.toBe(250);
    expect(result.evidence.factions[0]?.origins[loserSlot]?.diagnostics).toEqual(
      expect.arrayContaining(["ORIGIN_DUPLICATE_OWN_SLOT", "ORIGIN_IN_REGION_FALLBACK"]),
    );
  });

  it("allows an offshore or spawn-ineligible influence center when its region contains a legal exact origin", async () => {
    const width = 600;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    terrain[350] = "TEST";
    const state = spawnState({
      seed: "strategic-offshore-influence",
      width,
      terrain,
      factions: [{ id: "alpha" }],
    });
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [0] }),
        reconsiderInfluence: () => ({ centers: [0] }),
        chooseOrigins(context) {
          expect(context.spawn.isValidOriginChoice(350, 0)).toBe(true);
          return { origins: [350] };
        },
      },
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: baseContext,
    });

    expect(result.evidence.factions[0]?.phase1).toMatchObject({
      submittedInfluenceCenters: [0],
      resolvedInfluenceCenters: [0],
    });
    expect(result.initialization.factions[0]?.origins[0]).toEqual({
      originSlot: 0,
      resolvedExactOrigin: 350,
      source: "STRATEGIC_SUBMISSION",
    });
  });

  it("preserves P39 plus P54 stable slots through the shared transformed-profile handoff", async () => {
    const width = 120;
    const state = spawnState({
      seed: "strategic-p39-p54-handoff",
      width,
      height: 120,
      factions: [{ id: "alpha", traits: ["P39", "P54"] }],
    });
    const primary = cellId(width, 25, 25);
    const secondary = cellId(width, 95, 95);
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [primary, secondary] }),
        reconsiderInfluence: () => ({ centers: [primary, secondary] }),
        chooseOrigins: () => ({ origins: [primary, secondary] }),
      },
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: (id) => baseContext(id, P39_STAR_PROFILE),
    });
    expect(result.initialization.factions[0]?.origins).toEqual([
      {
        originSlot: 0,
        resolvedExactOrigin: primary,
        source: "STRATEGIC_SUBMISSION",
      },
      {
        originSlot: 1,
        resolvedExactOrigin: secondary,
        source: "STRATEGIC_SUBMISSION",
      },
    ]);

    const materialized = materializeSpawnInitialization(state, result.initialization);
    const snapshot = materialized.snapshot.factions[0]!;
    expect(snapshot.effectiveSpawnProfile).toMatchObject({
      exactOriginCount: 2,
      footprintShapeProfile: "STAR",
    });
    expect(
      snapshot.footprints.map((footprint) => ({
        footprintSlot: footprint.footprintSlot,
        shapeProfile: footprint.shapeProfile,
      })),
    ).toEqual([
      { footprintSlot: 0, shapeProfile: "STAR" },
      { footprintSlot: 1, shapeProfile: "STAR" },
    ]);
    expect(materialized.state.factions[0]?.population.total).toBe(500);
  });

  it("uses the canonical global emergency fallback and fails deterministically when no legal seed exists", async () => {
    const width = 1_000;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    terrain[900] = "TEST";
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [0] }),
        reconsiderInfluence: () => ({ centers: [0] }),
        chooseOrigins: () => ({ origins: [0] }),
      },
    });
    const state = spawnState({
      seed: "strategic-global-fallback",
      width,
      terrain,
      factions: [{ id: "alpha" }],
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: baseContext,
    });
    expect(result.initialization.factions[0]?.origins[0]).toMatchObject({
      resolvedExactOrigin: 900,
      resolutionReason: "ORIGIN_GLOBAL_FALLBACK",
    });
    expect(result.evidence.factions[0]?.origins[0]?.diagnostics).toEqual(
      expect.arrayContaining(["ORIGIN_ILLEGAL_TERRAIN", "ORIGIN_GLOBAL_FALLBACK"]),
    );

    const impossible = spawnState({
      seed: "strategic-global-unfillable",
      width,
      terrain: Array.from({ length: width }, () => "IMPASSABLE"),
      factions: [{ id: "alpha" }],
    });
    await expect(
      resolveStrategicSpawn({
        state: impossible,
        host,
        contextForFaction: baseContext,
      }),
    ).rejects.toThrow(/^ORIGIN_GLOBAL_UNFILLABLE$/);
  });

  it("does not materialize start state before returning the shared Spawn handoff", async () => {
    const width = 100;
    const state = spawnState({
      seed: "strategic-shared-handoff",
      width,
      height: 100,
      factions: [{ id: "alpha" }, { id: "beta" }],
    });
    const alphaOrigin = cellId(width, 10, 10);
    const betaOrigin = cellId(width, 90, 90);
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence: () => ({ centers: [alphaOrigin] }),
        reconsiderInfluence: () => ({ centers: [alphaOrigin] }),
        chooseOrigins: () => ({ origins: [alphaOrigin] }),
      },
      beta: {
        chooseInfluence: () => ({ centers: [betaOrigin] }),
        reconsiderInfluence: () => ({ centers: [betaOrigin] }),
        chooseOrigins: () => ({ origins: [betaOrigin] }),
      },
    });

    const result = await resolveStrategicSpawn({
      state,
      host,
      contextForFaction: baseContext,
    });

    expect(state.ownership.every((owner) => owner === null)).toBe(true);
    expect(state.factions.every((faction) => faction.population.total === 0)).toBe(true);

    const materialized = materializeSpawnInitialization(state, result.initialization);
    expect(materialized.snapshot.spawnMode).toBe("STRATEGIC");
    expect(
      materialized.state.ownership.filter((owner) => owner === "alpha"),
    ).toHaveLength(1_000);
    expect(
      materialized.state.ownership.filter((owner) => owner === "beta"),
    ).toHaveLength(1_000);
    expect(materialized.state.factions.map((faction) => faction.population.total)).toEqual([
      500,
      500,
    ]);
  });
});