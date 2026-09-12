import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import {
  createInitialMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import type {
  MatchSpec,
  SpawnInitializationInput,
} from "../src/simulation/MatchSpec";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { materializeSpawnInitialization } from "../src/simulation/SpawnInitialization";
import {
  compareSpawnUtf8,
  spawnTerrainBaseSpec,
  stableTie32,
} from "../src/simulation/SpawnSemantics";

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function cellId(width: number, x: number, y: number): number {
  return y * width + x;
}

function fixedSpawnInput(
  factions: readonly {
    readonly factionId: string;
    readonly origins: readonly number[];
  }[],
): SpawnInitializationInput {
  return Object.freeze({
    spawnMode: "FIXED" as const,
    spawnResolverVersion: "1" as const,
    factions: Object.freeze(
      factions.map((faction) =>
        Object.freeze({
          factionId: faction.factionId,
          origins: Object.freeze(
            faction.origins.map((resolvedExactOrigin, originSlot) =>
              Object.freeze({
                originSlot,
                resolvedExactOrigin,
                source: "FIXED_CONFIGURATION" as const,
              }),
            ),
          ),
        }),
      ),
    ),
  });
}

function spawnState(options: {
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly terrain?: readonly string[];
  readonly alphaTraits?: readonly OriginTraitId[];
}): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: options.seed,
      width: options.width,
      height: options.height,
      ...(options.terrain === undefined ? {} : { terrain: options.terrain }),
      factions: [
        { id: "alpha", rules: rules(options.alphaTraits) },
        { id: "beta", rules: rules() },
      ],
    }),
  );
}

function withCurrentSpawnInput(
  spec: MatchSpec,
  spawnInitialization: SpawnInitializationInput,
): MatchSpec {
  return Object.freeze({
    ...spec,
    initialization: Object.freeze({
      kind: "SPAWN" as const,
      input: spawnInitialization,
    }),
  });
}

function ownerCount(state: MatchState, factionId: string): number {
  return state.ownership.filter((ownerId) => ownerId === factionId).length;
}

function attackController() {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        directives: {
          set: [
            {
              kind: "LAND_OPERATION" as const,
              key: "immediate-opening-attack",
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

describe("reopened #104 Spawn hardening contracts", () => {
  it("matches resolver-v1 stableTie32 golden vectors and raw UTF-8 fallback ordering", () => {
    expect(
      stableTie32("exact-origin-priority", "1", "seed-0001", "F-A", 0),
    ).toBe(753_298_903);
    expect(
      stableTie32("spawn-footprint-cell", "1", "seed-0001", 12_345, "F-A", 0),
    ).toBe(1_594_207_403);
    expect(
      stableTie32("spawn-star-cell", "1", "seed-0001", "F-A", 0, 12_345),
    ).toBe(1_777_288_741);
    expect(
      stableTie32("spawn-compact-cell", "1", "seed-0001", "F-A", 0, 12_345),
    ).toBe(786_146_991);

    expect(compareSpawnUtf8("A", "B")).toBeLessThan(0);
    expect(compareSpawnUtf8("F", "F-A")).toBeLessThan(0);
    expect(compareSpawnUtf8("z", "é")).toBeLessThan(0);
  });

  it("resolves competing footprints identically when resolved faction input enumeration is reversed", () => {
    const width = 120;
    const height = 20;
    const state = spawnState({ seed: "footprint-input-order", width, height });
    const alphaOrigin = cellId(width, 35, 10);
    const betaOrigin = cellId(width, 85, 10);

    const forward = materializeSpawnInitialization(
      state,
      fixedSpawnInput([
        { factionId: "alpha", origins: [alphaOrigin] },
        { factionId: "beta", origins: [betaOrigin] },
      ]),
    );
    const reversed = materializeSpawnInitialization(
      state,
      fixedSpawnInput([
        { factionId: "beta", origins: [betaOrigin] },
        { factionId: "alpha", origins: [alphaOrigin] },
      ]),
    );

    expect(reversed.state).toEqual(forward.state);
    expect(reversed.snapshot).toEqual(forward.snapshot);
    expect(
      forward.snapshot.factions.some((faction) =>
        faction.footprints.some(
          (footprint) => footprint.contestsWon > 0 || footprint.contestsLost > 0,
        ),
      ),
    ).toBe(true);
  });

  it.each([
    ["TUNDRA", [] as readonly OriginTraitId[]],
    ["SHALLOW_WATER", [] as readonly OriginTraitId[]],
    ["SHALLOW_WATER", ["P48"] as readonly OriginTraitId[]],
  ])(
    "rejects %s as an exact Spawn seed without changing footprint ownability",
    (originTerrain, alphaTraits) => {
      const width = 100;
      const height = 100;
      const terrain = Array.from({ length: width * height }, () => "PLAINS");
      const alphaOrigin = cellId(width, 10, 10);
      const betaOrigin = cellId(width, 90, 90);
      terrain[alphaOrigin] = originTerrain;

      const state = spawnState({
        seed: `seed-legality-${originTerrain}-${alphaTraits.join("-")}`,
        width,
        height,
        terrain,
        alphaTraits,
      });
      const input = fixedSpawnInput([
        { factionId: "alpha", origins: [alphaOrigin] },
        { factionId: "beta", origins: [betaOrigin] },
      ]);

      expect(() => materializeSpawnInitialization(state, input)).toThrow(
        /ORIGIN_ILLEGAL_TERRAIN/,
      );
    },
  );

  it("exposes exact Spawn-seed eligibility separately from land ownability", () => {
    expect(spawnTerrainBaseSpec("PLAINS")).toMatchObject({
      conquerable: true,
      landTraversable: true,
      spawnEligible: true,
    });
    expect(spawnTerrainBaseSpec("TUNDRA")).toMatchObject({
      conquerable: true,
      landTraversable: true,
      spawnEligible: false,
    });
    expect(spawnTerrainBaseSpec("SHALLOW_WATER")).toMatchObject({
      conquerable: true,
      landTraversable: true,
      spawnEligible: false,
    });
  });

  it("rejects foreign exact origins 49 cells apart and accepts exactly 50", () => {
    const width = 200;
    const height = 100;
    const state = spawnState({ seed: "foreign-spacing", width, height });
    const alphaOrigin = cellId(width, 50, 50);

    expect(() =>
      materializeSpawnInitialization(
        state,
        fixedSpawnInput([
          { factionId: "alpha", origins: [alphaOrigin] },
          { factionId: "beta", origins: [cellId(width, 99, 50)] },
        ]),
      ),
    ).toThrow(/ORIGIN_FOREIGN_SPACING_CONFLICT/);

    const exactBoundary = materializeSpawnInitialization(
      state,
      fixedSpawnInput([
        { factionId: "alpha", origins: [alphaOrigin] },
        { factionId: "beta", origins: [cellId(width, 100, 50)] },
      ]),
    );
    expect(ownerCount(exactBoundary.state, "alpha")).toBe(1_000);
    expect(ownerCount(exactBoundary.state, "beta")).toBe(1_000);
  });

  it("keeps distinct same-faction P39 origins exempt from foreign 50-cell spacing", () => {
    const width = 200;
    const height = 100;
    const state = spawnState({
      seed: "p39-own-spacing",
      width,
      height,
      alphaTraits: ["P39"],
    });
    const initialized = materializeSpawnInitialization(
      state,
      fixedSpawnInput([
        {
          factionId: "alpha",
          origins: [cellId(width, 20, 20), cellId(width, 30, 20)],
        },
        { factionId: "beta", origins: [cellId(width, 150, 80)] },
      ]),
    );

    expect(
      initialized.snapshot.factions.find((faction) => faction.factionId === "alpha")
        ?.origins,
    ).toHaveLength(2);
    expect(ownerCount(initialized.state, "alpha")).toBe(1_000);
  });

  it("rejects an unknown Spawn mode even when malformed origins omit source provenance", () => {
    const width = 100;
    const state = spawnState({
      seed: "invalid-spawn-mode",
      width,
      height: 100,
    });
    const malformed = Object.freeze({
      spawnMode: "BROKEN",
      spawnResolverVersion: "1",
      factions: Object.freeze([
        Object.freeze({
          factionId: "alpha",
          origins: Object.freeze([
            Object.freeze({
              originSlot: 0,
              resolvedExactOrigin: cellId(width, 10, 10),
            }),
          ]),
        }),
        Object.freeze({
          factionId: "beta",
          origins: Object.freeze([
            Object.freeze({
              originSlot: 0,
              resolvedExactOrigin: cellId(width, 90, 90),
            }),
          ]),
        }),
      ]),
    }) as unknown as SpawnInitializationInput;

    expect(() => materializeSpawnInitialization(state, malformed)).toThrow(
      /unsupported Spawn mode/i,
    );
  });

  it("permits ordinary hostile action immediately after Spawn and exposes no Spawn-immunity state", () => {
    const width = 100;
    const input = fixedSpawnInput([
      { factionId: "alpha", origins: [cellId(width, 10, 10)] },
      { factionId: "beta", origins: [cellId(width, 90, 90)] },
    ]);
    const runtime = new MatchRuntime(
      withCurrentSpawnInput(
        createMicroSimulationSpec({
          seed: "immediate-opening-pvp",
          width,
          height: 100,
          factions: [
            { id: "alpha", rules: rules() },
            { id: "beta", rules: rules() },
          ],
        }),
        input,
      ),
      { controllerReferenceNamespace: "immediate-opening-pvp" },
    );

    const receipts = runtime.runControllerRound(attackController());
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
      true,
    );
    expect(runtime.acceptedInputs()).toHaveLength(1);
    expect("spawnImmunityEndsAtTickExclusive" in runtime.snapshot()).toBe(false);
    expect(runtime.stateFingerprint()).not.toContain("spawnImmunity");
  });
});
