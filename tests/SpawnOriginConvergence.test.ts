import type {
  ControllerLimitsView,
  MapApi,
  MechanicsApi,
  RulesView,
  SelfFactionView,
  SpawnProfileView,
  TerrainType,
} from "../src/core/controller/ControllerApi";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  InProcessTestControllerHost,
  type ControllerHost,
} from "../src/simulation/ControllerRuntime";
import {
  mapArtifactHash,
  materializeMapArtifact,
  type MapArtifactBinding,
  type MapArtifactPackage,
  type MapArtifactResolver,
} from "../src/simulation/MapArtifact";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import {
  createPreSpawnMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import type {
  ArtifactMapSpec,
  MatchFactionSpec,
  MatchSpec,
  SpawnInitializationInput,
} from "../src/simulation/MatchSpec";
import {
  resolveFixedSpawnInitialization,
  resolveRandomSpawnInitialization,
  type FixedSpawnConfiguration,
} from "../src/simulation/SpawnModeResolution";
import { materializeEffectiveSpawnProfile } from "../src/simulation/SpawnSemantics";
import {
  resolveStrategicSpawn,
  type StrategicSpawnBaseContextInput,
} from "../src/simulation/StrategicSpawn";

const WIDTH = 2_400;
const HEIGHT = 2_000;
const CELL_COUNT = WIDTH * HEIGHT;
const UTF8 = new TextEncoder();

const ALPHA_PRIMARY = cellId(120, 120);
const ALPHA_SECONDARY = cellId(120, 320);
const BETA_PRIMARY = cellId(940, 540);

const ALPHA_TRAITS = Object.freeze([
  "P01",
  "P20",
  "P39",
  "P48",
  "P54",
] as const satisfies readonly OriginTraitId[]);
const BETA_TRAITS = Object.freeze(["P48"] as const satisfies readonly OriginTraitId[]);

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

function cellId(x: number, y: number): number {
  return y * WIDTH + x;
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported canonical fixture value: ${typeof value}`);
}

function encodeUint32(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

function paintRect(
  terrain: Uint8Array,
  x0: number,
  y0: number,
  width: number,
  height: number,
  code: number,
): void {
  for (let y = y0; y < y0 + height; y += 1) {
    const row = y * WIDTH;
    for (let x = x0; x < x0 + width; x += 1) terrain[row + x] = code;
  }
}

function buildArtifactFixture(): {
  readonly binding: ArtifactMapSpec;
  readonly package: MapArtifactPackage;
  readonly resolver: MapArtifactResolver;
} {
  const terrain = new Uint8Array(CELL_COUNT);
  terrain.fill(9);

  paintRect(terrain, 80, 80, 80, 80, 0);
  paintRect(terrain, 80, 280, 80, 80, 0);
  paintRect(terrain, 900, 500, 80, 80, 0);
  paintRect(terrain, 105, 105, 31, 31, 7);
  terrain[ALPHA_PRIMARY] = 0;

  const terrainCounts = new Uint32Array(10);
  for (const code of terrain) terrainCounts[code] = terrainCounts[code]! + 1;

  const membership = new Uint8Array(CELL_COUNT * 2);
  const metadataValues = [0, CELL_COUNT, ...terrainCounts];
  const metadata = encodeUint32(metadataValues);
  const adjacencyOffsets = encodeUint32([0, 0]);
  const adjacency = new Uint8Array(0);

  const manifest = {
    format: "OPEN_FUFU_MAP",
    formatVersion: 2,
    mapId: "spawn-origin-convergence",
    mapVersion: "1",
    width: WIDTH,
    height: HEIGHT,
    segmentGeneratorVersion: 1,
    segmentCount: 1,
    sections: [
      { id: "terrain", encoding: "TERRAIN_U8_V1", path: "terrain.bin" },
      {
        id: "segmentMembership",
        encoding: "SEGMENT_MEMBERSHIP_U16LE_V1",
        path: "segments/membership.bin",
      },
      {
        id: "segmentMetadata",
        encoding: "SEGMENT_METADATA_U32LE_V1",
        path: "segments/metadata.bin",
      },
      {
        id: "segmentAdjacencyOffsets",
        encoding: "SEGMENT_ADJACENCY_OFFSETS_U32LE_V1",
        path: "segments/adjacency-offsets.bin",
      },
      {
        id: "segmentAdjacency",
        encoding: "SEGMENT_ADJACENCY_U16LE_V1",
        path: "segments/adjacency.bin",
      },
    ],
  } as const;

  const files = Object.freeze([
    { path: "manifest.json", bytes: UTF8.encode(canonicalJson(manifest)) },
    { path: "terrain.bin", bytes: terrain },
    { path: "segments/membership.bin", bytes: membership },
    { path: "segments/metadata.bin", bytes: metadata },
    { path: "segments/adjacency-offsets.bin", bytes: adjacencyOffsets },
    { path: "segments/adjacency.bin", bytes: adjacency },
  ]);
  const artifactPackage: MapArtifactPackage = Object.freeze({ files });
  const mapHash = mapArtifactHash(files);
  const binding: ArtifactMapSpec = Object.freeze({
    kind: "ARTIFACT",
    mapId: manifest.mapId,
    mapVersion: manifest.mapVersion,
    mapHash,
  });
  const resolver: MapArtifactResolver = Object.freeze({
    resolve(requested: MapArtifactBinding) {
      return requested.mapId === binding.mapId &&
        requested.mapVersion === binding.mapVersion &&
        requested.mapHash === binding.mapHash
        ? artifactPackage
        : undefined;
    },
  });
  return Object.freeze({ binding, package: artifactPackage, resolver });
}

const ARTIFACT = buildArtifactFixture();

function rules(traits: readonly OriginTraitId[]) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function factions(): readonly MatchFactionSpec[] {
  return Object.freeze([
    Object.freeze({ id: "alpha", rules: rules(ALPHA_TRAITS) }),
    Object.freeze({ id: "beta", rules: rules(BETA_TRAITS) }),
  ]);
}

function createPreState(seed: string, factionSpecs: readonly MatchFactionSpec[]): MatchState {
  const map = materializeMapArtifact(ARTIFACT.binding, ARTIFACT.package);
  return createPreSpawnMatchState(
    Object.freeze({ seed, map: ARTIFACT.binding, factions: factionSpecs }),
    map,
  );
}

function fixedConfiguration(): FixedSpawnConfiguration {
  return Object.freeze({
    factions: Object.freeze([
      Object.freeze({
        factionId: "alpha",
        origins: Object.freeze([ALPHA_PRIMARY, ALPHA_SECONDARY]),
      }),
      Object.freeze({ factionId: "beta", origins: Object.freeze([BETA_PRIMARY]) }),
    ]),
  });
}

function matchSpec(
  seed: string,
  factionSpecs: readonly MatchFactionSpec[],
  input: SpawnInitializationInput,
): MatchSpec {
  return Object.freeze({
    seed,
    map: ARTIFACT.binding,
    factions: factionSpecs,
    initialization: Object.freeze({ kind: "SPAWN" as const, input }),
  });
}

function ownerCount(state: MatchState, factionId: string): number {
  let count = 0;
  for (const ownerId of state.ownership) if (ownerId === factionId) count += 1;
  return count;
}

function spawnProfile(state: MatchState, factionId: string): SpawnProfileView {
  const faction = state.factions.find((entry) => entry.id === factionId);
  if (faction === undefined) throw new Error(`missing faction ${factionId}`);
  const profile = materializeEffectiveSpawnProfile(faction.rules);
  return Object.freeze({
    influenceSlotCount: profile.exactOriginCount,
    exactOriginCount: profile.exactOriginCount,
    influenceAreaCells:
      profile.exactOriginCount === 2
        ? Object.freeze([80_000, 80_000])
        : Object.freeze([160_000]),
    initialTerritoryPopulationBearingCells:
      profile.initialTerritoryPopulationBearingQuota,
    footprintShape: profile.footprintShapeProfile,
  });
}

function mapApi(state: MatchState): MapApi {
  return Object.freeze({
    width: state.map.width,
    height: state.map.height,
    cellCount: state.map.cellCount,
    isValidCellId(id) {
      return state.map.isValidCellId(id);
    },
    cellIdAt(x, y) {
      return state.map.cellIdAt(x, y);
    },
    positionOf(id) {
      return state.map.isValidCellId(id) ? state.map.positionOf(id) : undefined;
    },
    terrainAt(id) {
      return state.map.isValidCellId(id)
        ? (state.map.terrainAt(id) as TerrainType)
        : undefined;
    },
    segmentIdOf(id) {
      return state.map.isValidCellId(id) ? state.map.segments?.segmentIdOf(id) : undefined;
    },
    cardinalNeighbors(id) {
      return state.map.isValidCellId(id) ? state.map.cardinalNeighbors(id) : undefined;
    },
  });
}

function selfView(
  state: MatchState,
  factionId: string,
  traits: readonly OriginTraitId[],
): SelfFactionView {
  const faction = state.factions.find((entry) => entry.id === factionId);
  if (faction === undefined) throw new Error(`missing faction ${factionId}`);
  return Object.freeze({
    id: factionId,
    displayName: factionId.toUpperCase(),
    status: "ACTIVE" as const,
    isMinorFaction: false as const,
    origin: Object.freeze({
      id: `origin-${factionId}`,
      displayName: `Origin ${factionId}`,
      version: "1",
      positiveTraitIds: Object.freeze(traits.filter((trait) => trait.startsWith("P"))),
      negativeTraitIds: Object.freeze(traits.filter((trait) => trait.startsWith("N"))),
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

function strategicBaseContext(
  state: MatchState,
  factionId: string,
): StrategicSpawnBaseContextInput {
  const traits = factionId === "alpha" ? ALPHA_TRAITS : BETA_TRAITS;
  const faction = state.factions.find((entry) => entry.id === factionId)!;
  const rulesView: RulesView = Object.freeze({
    version: faction.rules.version,
    values: Object.freeze({}),
  });
  return Object.freeze({
    game: Object.freeze({
      matchId: "spawn-origin-convergence",
      tick: 0,
      decisionNumber: 0,
      ticksPerSecond: 10,
      decisionEveryTicks: 1,
      mapId: ARTIFACT.binding.mapId,
      mapVersion: ARTIFACT.binding.mapVersion,
      rulesetVersion: faction.rules.version,
      controllerApiVersion: "1",
      spawnMode: "STRATEGIC" as const,
    }),
    me: selfView(state, factionId, traits),
    map: mapApi(state),
    cells: Object.freeze({}) as StrategicSpawnBaseContextInput["cells"],
    segments: Object.freeze({}) as StrategicSpawnBaseContextInput["segments"],
    rules: rulesView,
    mechanics: Object.freeze({}) as MechanicsApi,
    random: Object.freeze({ next: () => 0.25, keyed: () => 0.5 }),
    limits: LIMITS,
    profile: spawnProfile(state, factionId),
  });
}

function assertActiveSpawn(runtime: MatchRuntime, mode: SpawnInitializationInput["spawnMode"]): void {
  expect(runtime.snapshot()).toMatchObject({
    phase: "ACTIVE",
    spawnSnapshot: { spawnMode: mode, spawnResolverVersion: "1" },
  });
  expect(ownerCount(runtime.snapshot(), "alpha")).toBe(1_150);
  expect(ownerCount(runtime.snapshot(), "beta")).toBe(1_000);
}

describe("#108 Spawn/Origin normal-start convergence", () => {
  it(
    "converges all Spawn providers through one artifact-backed start, lawful first query, land flow, and replay",
    async () => {
      const seed = "spawn-origin-convergence";
      const factionSpecs = factions();
      const preState = createPreState(seed, factionSpecs);

      expect(preState.map.source).toBe("ARTIFACT");
      expect(preState.map.formatVersion).toBe(2);
      expect(preState.map.segments?.segmentCount).toBe(1);
      expect(preState.ownership.every((ownerId) => ownerId === null)).toBe(true);
      expect(preState.factions.every((faction) => faction.population.total === 0)).toBe(true);
      expect(preState.structures).toEqual([]);

      const fixedInput = resolveFixedSpawnInitialization(preState, fixedConfiguration());
      const randomInput = resolveRandomSpawnInitialization(preState);

      const strategicHost = new InProcessTestControllerHost({
        alpha: {
          chooseInfluence() {
            return { centers: [ALPHA_PRIMARY, ALPHA_SECONDARY] };
          },
          reconsiderInfluence() {
            return { centers: [ALPHA_PRIMARY, ALPHA_SECONDARY] };
          },
          chooseOrigins() {
            return { origins: [ALPHA_PRIMARY, ALPHA_SECONDARY] };
          },
        },
        beta: {
          chooseInfluence() {
            return { centers: [BETA_PRIMARY] };
          },
          reconsiderInfluence() {
            return { centers: [BETA_PRIMARY] };
          },
          chooseOrigins() {
            return { origins: [BETA_PRIMARY] };
          },
        },
      });
      const strategic = await resolveStrategicSpawn({
        state: preState,
        host: strategicHost,
        contextForFaction: (factionId) => strategicBaseContext(preState, factionId),
      });

      expect(preState.ownership.every((ownerId) => ownerId === null)).toBe(true);
      expect(preState.factions.every((faction) => faction.population.total === 0)).toBe(true);
      expect(preState.structures).toEqual([]);

      for (const [mode, input] of [
        ["RANDOM", randomInput],
        ["STRATEGIC", strategic.initialization],
      ] as const) {
        const runtime = new MatchRuntime(matchSpec(seed, factionSpecs, input), {
          mapArtifacts: ARTIFACT.resolver,
        });
        assertActiveSpawn(runtime, mode);
      }

      const fixedSpec = matchSpec(seed, factionSpecs, fixedInput);
      const fixed = new MatchRuntime(fixedSpec, { mapArtifacts: ARTIFACT.resolver });
      assertActiveSpawn(fixed, "FIXED");

      const alphaSpawn = fixed.snapshot().spawnSnapshot!.factions.find(
        (faction) => faction.factionId === "alpha",
      )!;
      expect(alphaSpawn.effectiveSpawnProfile).toMatchObject({
        exactOriginCount: 2,
        initialTerritoryPopulationBearingQuota: 1_150,
        footprintShapeProfile: "STAR",
      });
      expect(alphaSpawn.origins.map((origin) => origin.resolvedExactOrigin)).toEqual([
        ALPHA_PRIMARY,
        ALPHA_SECONDARY,
      ]);
      expect(alphaSpawn.footprints.map((footprint) => footprint.populationBearingClaimed)).toEqual([
        575,
        575,
      ]);
      const alphaFootprintCells = alphaSpawn.footprints.flatMap((footprint) => footprint.cellIds);
      expect(
        alphaFootprintCells.some(
          (id) => fixed.snapshot().map.terrainAt(id) === "SHALLOW_WATER",
        ),
      ).toBe(true);
      expect(fixed.snapshot().structures).toEqual([
        expect.objectContaining({
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: ALPHA_PRIMARY,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
      ]);

      let firstQueryObserved = false;
      const controllerHost: ControllerHost = {
        async invoke(factionId, observation, querySession) {
          if (factionId !== "alpha") return Object.freeze({ ok: true as const });
          expect(observation.tick).toBe(0);
          expect(observation.cells).toBeUndefined();
          expect(observation.me.population).toMatchObject({
            total: 575,
            available: 575,
          });
          expect(querySession).toBeDefined();

          const own = await querySession!.cells.query(
            { kind: "OWNER", factionId: "alpha" },
            1,
          );
          const neutralTarget = {
            kind: "INTERSECTION" as const,
            selectors: Object.freeze([
              Object.freeze({ kind: "OWNER" as const }),
              Object.freeze({ kind: "CONQUERABLE" as const, value: true }),
            ]),
          };
          const neutral = await querySession!.cells.query(neutralTarget, 1);
          const segment = await querySession!.segments.get(0);
          expect(own.items[0]).toMatchObject({ ownerId: "alpha", segmentId: 0 });
          expect(neutral.items[0]).toMatchObject({ segmentId: 0 });
          expect(segment).toMatchObject({ id: 0, cellCount: CELL_COUNT });
          firstQueryObserved = true;

          return Object.freeze({
            ok: true as const,
            output: Object.freeze({
              directives: Object.freeze({
                set: Object.freeze([
                  Object.freeze({
                    kind: "LAND_OPERATION" as const,
                    key: "opening-expansion",
                    operation: "NEUTRAL_EXPANSION" as const,
                    population: 10,
                    source: Object.freeze({ kind: "OWNER" as const, factionId: "alpha" }),
                    target: neutralTarget,
                  }),
                ]),
              }),
            }),
          });
        },
        chooseInfluence() {
          return Object.freeze({ ok: true as const });
        },
        reconsiderInfluence() {
          return Object.freeze({ ok: true as const });
        },
        chooseOrigins() {
          return Object.freeze({ ok: true as const });
        },
      };

      const receipts = await fixed.runControllerRound(controllerHost);
      expect(firstQueryObserved).toBe(true);
      expect(
        receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
      ).toBe(true);
      expect(fixed.acceptedInputs()).toEqual([
        expect.objectContaining({
          tick: 1,
          action: expect.objectContaining({
            type: "APPLY_PERSISTENT_DIRECTIVES",
            factionId: "alpha",
            changes: expect.objectContaining({
              set: [
                expect.objectContaining({
                  kind: "LAND_OPERATION",
                  key: "opening-expansion",
                  operation: "NEUTRAL_EXPANSION",
                  population: 10,
                }),
              ],
            }),
          }),
        }),
      ]);

      const initialAlphaCells = ownerCount(fixed.snapshot(), "alpha");
      for (
        let index = 0;
        index < 60 && ownerCount(fixed.snapshot(), "alpha") === initialAlphaCells;
        index += 1
      ) {
        fixed.tick();
      }
      expect(ownerCount(fixed.snapshot(), "alpha")).toBeGreaterThan(initialAlphaCells);

      const regenerated = MatchRuntime.regenerate(
        fixedSpec,
        fixed.acceptedInputs(),
        fixed.snapshot().tick,
        { mapArtifacts: ARTIFACT.resolver },
      );
      expect(regenerated.snapshot().spawnSnapshot).toEqual(fixed.snapshot().spawnSnapshot);
      expect(regenerated.snapshot()).toEqual(fixed.snapshot());
      expect(regenerated.stateFingerprint()).toBe(fixed.stateFingerprint());

      expect(() =>
        resolveFixedSpawnInitialization(
          preState,
          Object.freeze({
            factions: Object.freeze([
              Object.freeze({ factionId: "alpha", origins: Object.freeze([ALPHA_PRIMARY]) }),
              Object.freeze({ factionId: "beta", origins: Object.freeze([BETA_PRIMARY]) }),
            ]),
          }),
        ),
      ).toThrow(/alpha.*1 origins.*expected 2/i);
      expect(preState.ownership.every((ownerId) => ownerId === null)).toBe(true);
      expect(preState.factions.every((faction) => faction.population.total === 0)).toBe(true);
      expect(preState.structures).toEqual([]);
    },
    120_000,
  );
});
