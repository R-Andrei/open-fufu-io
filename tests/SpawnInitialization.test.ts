import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import type { MatchSpec } from "../src/simulation/MatchSpec";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

type SpawnMode = "STRATEGIC" | "RANDOM" | "FIXED";
type SpawnSource =
  | "STRATEGIC_SUBMISSION"
  | "RANDOM_RESOLUTION"
  | "FIXED_CONFIGURATION";

interface TestResolvedOrigin {
  readonly originSlot: number;
  readonly resolvedExactOrigin: number;
  readonly source: SpawnSource;
  readonly resolutionReason?: string;
}

interface TestSpawnInitializationInput {
  readonly spawnMode: SpawnMode;
  readonly spawnResolverVersion: "1";
  readonly factions: readonly {
    readonly factionId: string;
    readonly origins: readonly TestResolvedOrigin[];
  }[];
}

interface TestSpawnFootprintSnapshot {
  readonly footprintSlot: number;
  readonly populationBearingQuota: number;
  readonly shapeProfile: "COMPACT" | "STAR";
  readonly shapeTemplateId?: string;
  readonly shapeTemplateSha256?: string;
  readonly cellIds: readonly number[];
  readonly cellSetSha256: string;
}

interface TestSpawnFactionSnapshot {
  readonly factionId: string;
  readonly effectiveSpawnProfile: {
    readonly exactOriginCount: number;
    readonly initialTerritoryPopulationBearingQuota: number;
    readonly footprintShapeProfile: "COMPACT" | "STAR";
  };
  readonly origins: readonly TestResolvedOrigin[];
  readonly footprints: readonly TestSpawnFootprintSnapshot[];
  readonly singularEffects: readonly {
    readonly effectId: string;
    readonly domain: string;
    readonly result: "GRANTED" | "REJECTED";
    readonly cellId?: number;
  }[];
}

interface TestSpawnSnapshot {
  readonly spawnMode: SpawnMode;
  readonly spawnResolverVersion: "1";
  readonly stableTie32Id: "FNV1A32_LENPREFIX_V1";
  readonly factions: readonly TestSpawnFactionSnapshot[];
}

type SpawnAwareState = ReturnType<MatchRuntime["snapshot"]> & {
  readonly phase?: "INITIALIZING" | "ACTIVE";
  readonly spawnSnapshot?: TestSpawnSnapshot;
  readonly spawnImmunityEndsAtTickExclusive?: number;
};

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function fixedSpawnInput(
  factions: readonly {
    readonly factionId: string;
    readonly origins: readonly number[];
  }[],
): TestSpawnInitializationInput {
  return Object.freeze({
    spawnMode: "FIXED" as const,
    spawnResolverVersion: "1" as const,
    factions: Object.freeze(
      factions.map((faction) =>
        Object.freeze({
          factionId: faction.factionId,
          origins: Object.freeze(
            faction.origins.map((cellId, originSlot) =>
              Object.freeze({
                originSlot,
                resolvedExactOrigin: cellId,
                source: "FIXED_CONFIGURATION" as const,
              }),
            ),
          ),
        }),
      ),
    ),
  });
}

function withSpawnInitialization(
  spec: MatchSpec,
  spawnInitialization: TestSpawnInitializationInput,
): MatchSpec {
  return Object.freeze({
    ...spec,
    spawnInitialization,
  }) as MatchSpec;
}

function ownerCount(state: SpawnAwareState, factionId: string): number {
  return state.ownership.filter((ownerId) => ownerId === factionId).length;
}

function factionSnapshot(state: SpawnAwareState, factionId: string) {
  return state.spawnSnapshot?.factions.find(
    (faction) => faction.factionId === factionId,
  );
}

function cellId(width: number, x: number, y: number): number {
  return y * width + x;
}

function attackController() {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        directives: {
          set: [
            {
              kind: "LAND_OPERATION" as const,
              key: "spawn-immunity-attack",
              operation: "ATTACK" as const,
              population: 10,
              targetFactionId: "beta",
              source: { kind: "OWNER" as const, factionId: "alpha" },
              target: { kind: "OWNER" as const, factionId: "beta" },
            },
          ],
        },
      };
    },
  });
}

describe("shared deterministic pre-match Spawn initialization", () => {
  it("materializes ordinary Fixed starts atomically, freezes replay evidence, and regenerates identically", () => {
    const width = 100;
    const height = 100;
    const spec = withSpawnInitialization(
      createMicroSimulationSpec({
        seed: "spawn-fixed-ordinary",
        width,
        height,
        factions: [
          { id: "alpha", rules: rules() },
          { id: "beta", rules: rules() },
        ],
      }),
      fixedSpawnInput([
        { factionId: "alpha", origins: [cellId(width, 10, 10)] },
        { factionId: "beta", origins: [cellId(width, 90, 90)] },
      ]),
    );

    const runtime = new MatchRuntime(spec);
    const state = runtime.snapshot() as SpawnAwareState;

    expect(state.phase).toBe("ACTIVE");
    expect(ownerCount(state, "alpha")).toBe(1_000);
    expect(ownerCount(state, "beta")).toBe(1_000);
    expect(state.factions.find((faction) => faction.id === "alpha")?.population).toMatchObject({
      total: 500,
      available: 500,
      peakTotal: 500,
    });
    expect(state.factions.find((faction) => faction.id === "beta")?.population).toMatchObject({
      total: 500,
      available: 500,
      peakTotal: 500,
    });
    expect(state.spawnImmunityEndsAtTickExclusive).toBe(50);
    expect(state.spawnSnapshot).toMatchObject({
      spawnMode: "FIXED",
      spawnResolverVersion: "1",
      stableTie32Id: "FNV1A32_LENPREFIX_V1",
    });

    for (const factionId of ["alpha", "beta"] as const) {
      const snapshot = factionSnapshot(state, factionId);
      expect(snapshot?.effectiveSpawnProfile).toEqual({
        exactOriginCount: 1,
        initialTerritoryPopulationBearingQuota: 1_000,
        footprintShapeProfile: "COMPACT",
      });
      expect(snapshot?.footprints).toHaveLength(1);
      expect(snapshot?.footprints[0]?.populationBearingQuota).toBe(1_000);
      expect(snapshot?.footprints[0]?.cellIds).toHaveLength(1_000);
      expect(snapshot?.footprints[0]?.cellSetSha256).toMatch(/^[0-9a-f]{64}$/);
    }

    const regenerated = MatchRuntime.regenerate(spec, [], 0);
    expect(regenerated.snapshot()).toEqual(runtime.snapshot());
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
  });

  it("blocks hostile targeting for five seconds of match time but permits it after immunity expires", () => {
    const width = 100;
    const runtime = new MatchRuntime(
      withSpawnInitialization(
        createMicroSimulationSpec({
          seed: "spawn-immunity",
          width,
          height: 100,
          factions: [
            { id: "alpha", rules: rules() },
            { id: "beta", rules: rules() },
          ],
        }),
        fixedSpawnInput([
          { factionId: "alpha", origins: [cellId(width, 10, 10)] },
          { factionId: "beta", origins: [cellId(width, 90, 90)] },
        ]),
      ),
    );

    const blocked = runtime.runControllerRound(attackController());
    expect(blocked.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
      false,
    );
    expect(runtime.acceptedInputs()).toEqual([]);

    for (let tick = 0; tick < 50; tick += 1) runtime.tick();
    expect(runtime.snapshot().tick).toBe(50);

    const allowed = runtime.runControllerRound(attackController());
    expect(allowed.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
      true,
    );
  });

  it("composes P01, P39, P20, and P54 through the shared lifecycle without duplicating singular grants", () => {
    const width = 140;
    const height = 100;
    const primary = cellId(width, 20, 20);
    const secondary = cellId(width, 20, 80);
    const betaOrigin = cellId(width, 120, 50);
    const spawn = fixedSpawnInput([
      { factionId: "alpha", origins: [primary, secondary] },
      { factionId: "beta", origins: [betaOrigin] },
    ]);

    const starSpec = withSpawnInitialization(
      createMicroSimulationSpec({
        seed: "spawn-origin-composition",
        width,
        height,
        factions: [
          { id: "alpha", rules: rules(["P01", "P20", "P39", "P54"]) },
          { id: "beta", rules: rules() },
        ],
      }),
      spawn,
    );
    const compactSpec = withSpawnInitialization(
      createMicroSimulationSpec({
        seed: "spawn-origin-composition",
        width,
        height,
        factions: [
          { id: "alpha", rules: rules(["P01", "P20", "P39"]) },
          { id: "beta", rules: rules() },
        ],
      }),
      spawn,
    );

    const starRuntime = new MatchRuntime(starSpec);
    const starState = starRuntime.snapshot() as SpawnAwareState;
    const alpha = factionSnapshot(starState, "alpha");

    expect(ownerCount(starState, "alpha")).toBe(1_150);
    expect(starState.factions.find((faction) => faction.id === "alpha")?.population).toMatchObject({
      total: 575,
      available: 575,
    });
    expect(alpha?.effectiveSpawnProfile).toEqual({
      exactOriginCount: 2,
      initialTerritoryPopulationBearingQuota: 1_150,
      footprintShapeProfile: "STAR",
    });
    expect(alpha?.footprints.map((footprint) => footprint.populationBearingQuota)).toEqual([
      575,
      575,
    ]);
    expect(alpha?.footprints.every((footprint) => footprint.shapeProfile === "STAR")).toBe(
      true,
    );
    expect(alpha?.footprints.every((footprint) => footprint.shapeTemplateId === "P54_STAR_V1")).toBe(
      true,
    );
    expect(
      alpha?.footprints.every(
        (footprint) =>
          footprint.shapeTemplateSha256 ===
          "52318cc016a674164fc4861468e29b24b177b8fc35287337a55a11d1b6773440",
      ),
    ).toBe(true);

    const alphaSilos = starState.structures.filter(
      (structure) => structure.ownerId === "alpha" && structure.type === "MISSILE_SILO",
    );
    expect(alphaSilos).toHaveLength(1);
    expect(alphaSilos[0]).toMatchObject({
      cellId: primary,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    expect(alpha?.singularEffects).toEqual([
      expect.objectContaining({
        effectId: "P20",
        domain: "STARTING_STRUCTURE_GRANT",
        result: "GRANTED",
        cellId: primary,
      }),
    ]);

    const compactAlpha = factionSnapshot(
      new MatchRuntime(compactSpec).snapshot() as SpawnAwareState,
      "alpha",
    );
    expect(compactAlpha?.footprints[0]?.cellIds).not.toEqual(alpha?.footprints[0]?.cellIds);
    expect(compactAlpha?.footprints[1]?.cellIds).not.toEqual(alpha?.footprints[1]?.cellIds);
  });

  it("uses P48 faction-relative Shallow-Water population-bearing permission while filling quota", () => {
    const width = 120;
    const height = 40;
    const terrain = Array.from({ length: width * height }, () => "IMPASSABLE");

    for (let y = 0; y < 30; y += 1) {
      for (let x = 0; x < 40; x += 1) terrain[cellId(width, x, y)] = "SHALLOW_WATER";
      for (let x = 80; x < 120; x += 1) terrain[cellId(width, x, y)] = "TEST";
    }
    const alphaOrigin = cellId(width, 10, 10);
    const betaOrigin = cellId(width, 90, 10);
    terrain[alphaOrigin] = "PLAINS";

    const input = fixedSpawnInput([
      { factionId: "alpha", origins: [alphaOrigin] },
      { factionId: "beta", origins: [betaOrigin] },
    ]);
    const withP48 = withSpawnInitialization(
      createMicroSimulationSpec({
        seed: "spawn-p48",
        width,
        height,
        terrain,
        factions: [
          { id: "alpha", rules: rules(["P48"]) },
          { id: "beta", rules: rules() },
        ],
      }),
      input,
    );
    const withoutP48 = withSpawnInitialization(
      createMicroSimulationSpec({
        seed: "spawn-p48",
        width,
        height,
        terrain,
        factions: [
          { id: "alpha", rules: rules() },
          { id: "beta", rules: rules() },
        ],
      }),
      input,
    );

    const state = new MatchRuntime(withP48).snapshot() as SpawnAwareState;
    expect(ownerCount(state, "alpha")).toBe(1_000);
    expect(
      state.ownership.filter(
        (ownerId, index) => ownerId === "alpha" && terrain[index] === "SHALLOW_WATER",
      ),
    ).toHaveLength(999);
    expect(state.factions.find((faction) => faction.id === "alpha")?.population.total).toBe(
      500,
    );

    expect(() => new MatchRuntime(withoutP48)).toThrow(/FOOTPRINT_QUOTA_UNFILLABLE/);
  });

  it("rejects an unfillable resolved configuration before any partial match can become active", () => {
    const width = 160;
    const height = 20;
    const terrain = Array.from({ length: width * height }, () => "IMPASSABLE");

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < 40; x += 1) terrain[cellId(width, x, y)] = "TEST";
      for (let x = 120; x < 160; x += 1) terrain[cellId(width, x, y)] = "TEST";
    }

    const spec = withSpawnInitialization(
      createMicroSimulationSpec({
        seed: "spawn-unfillable",
        width,
        height,
        terrain,
        factions: [
          { id: "alpha", rules: rules() },
          { id: "beta", rules: rules() },
        ],
      }),
      fixedSpawnInput([
        { factionId: "alpha", origins: [cellId(width, 10, 10)] },
        { factionId: "beta", origins: [cellId(width, 130, 10)] },
      ]),
    );

    expect(() => new MatchRuntime(spec)).toThrow(/FOOTPRINT_QUOTA_UNFILLABLE/);
  });
});
