import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createInitialMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  resolveFixedSpawnInitialization,
  resolveRandomSpawnInitialization,
  type FixedSpawnConfiguration,
} from "../src/simulation/SpawnModeResolution";
import { materializeSpawnInitialization } from "../src/simulation/SpawnInitialization";

function rules(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function cellId(width: number, x: number, y: number): number {
  return y * width + x;
}

function spawnState(options: {
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly terrain?: readonly string[];
  readonly initialFallout?: readonly boolean[];
  readonly factions?: readonly {
    readonly id: string;
    readonly traits?: readonly OriginTraitId[];
  }[];
}): MatchState {
  const factions =
    options.factions ??
    (Object.freeze([
      Object.freeze({ id: "alpha" }),
      Object.freeze({ id: "beta" }),
    ]) as readonly { readonly id: string; readonly traits?: readonly OriginTraitId[] }[]);
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: options.seed,
      width: options.width,
      height: options.height,
      ...(options.terrain === undefined ? {} : { terrain: options.terrain }),
      ...(options.initialFallout === undefined
        ? {}
        : { initialFallout: options.initialFallout }),
      factions: factions.map((faction) => ({
        id: faction.id,
        rules: rules(faction.traits),
      })),
    }),
  );
}

function fixedConfiguration(
  factions: FixedSpawnConfiguration["factions"],
): FixedSpawnConfiguration {
  return Object.freeze({
    factions: Object.freeze(
      factions.map((faction) =>
        Object.freeze({
          factionId: faction.factionId,
          origins: Object.freeze([...faction.origins]),
        }),
      ),
    ),
  });
}

function originCells(input: ReturnType<typeof resolveRandomSpawnInitialization>) {
  return Object.fromEntries(
    input.factions.map((faction) => [
      faction.factionId,
      faction.origins.map((origin) => origin.resolvedExactOrigin),
    ]),
  );
}

describe("#106 deterministic Fixed and Random Spawn providers", () => {
  it("preserves authored Fixed P39 array order as canonical slot identity", () => {
    const width = 220;
    const state = spawnState({
      seed: "fixed-p39-slot-order",
      width,
      height: 1,
      factions: [
        { id: "alpha", traits: ["P39"] },
        { id: "beta" },
      ],
    });

    const input = resolveFixedSpawnInitialization(
      state,
      fixedConfiguration([
        { factionId: "beta", origins: [200] },
        { factionId: "alpha", origins: [80, 10] },
      ]),
    );

    expect(input).toEqual({
      spawnMode: "FIXED",
      spawnResolverVersion: "1",
      factions: [
        {
          factionId: "alpha",
          origins: [
            {
              originSlot: 0,
              resolvedExactOrigin: 80,
              source: "FIXED_CONFIGURATION",
            },
            {
              originSlot: 1,
              resolvedExactOrigin: 10,
              source: "FIXED_CONFIGURATION",
            },
          ],
        },
        {
          factionId: "beta",
          origins: [
            {
              originSlot: 0,
              resolvedExactOrigin: 200,
              source: "FIXED_CONFIGURATION",
            },
          ],
        },
      ],
    });
  });

  it("rejects malformed Fixed faction/profile tables without mutating authoritative state", () => {
    const state = spawnState({
      seed: "fixed-table-validation",
      width: 220,
      height: 1,
      factions: [
        { id: "alpha", traits: ["P39"] },
        { id: "beta" },
      ],
    });

    expect(() =>
      resolveFixedSpawnInitialization(
        state,
        fixedConfiguration([{ factionId: "alpha", origins: [10, 80] }]),
      ),
    ).toThrow(/exactly one resolved input per faction/i);

    expect(() =>
      resolveFixedSpawnInitialization(
        state,
        fixedConfiguration([
          { factionId: "alpha", origins: [10, 80] },
          { factionId: "gamma", origins: [200] },
        ]),
      ),
    ).toThrow(/unknown faction gamma/i);

    expect(() =>
      resolveFixedSpawnInitialization(
        state,
        fixedConfiguration([
          { factionId: "alpha", origins: [10] },
          { factionId: "beta", origins: [200] },
        ]),
      ),
    ).toThrow(/alpha.*1 origins.*expected 2/i);

    expect(() =>
      resolveFixedSpawnInitialization(
        state,
        fixedConfiguration([
          { factionId: "alpha", origins: [10, 10] },
          { factionId: "beta", origins: [200] },
        ]),
      ),
    ).toThrow(/ORIGIN_DUPLICATE_OWN_SLOT/);

    expect(state.ownership.every((owner) => owner === null)).toBe(true);
    expect(state.factions.every((faction) => faction.population.total === 0)).toBe(true);
  });

  it("rejects Fixed illegal terrain, Fallout, and foreign spacing without repair", () => {
    const width = 220;
    const alpha = 20;
    const beta = 200;
    const terrain = Array.from({ length: width }, () => "TEST");
    terrain[alpha] = "TUNDRA";
    const illegalTerrain = spawnState({
      seed: "fixed-illegal-terrain",
      width,
      height: 1,
      terrain,
    });
    expect(() =>
      resolveFixedSpawnInitialization(
        illegalTerrain,
        fixedConfiguration([
          { factionId: "alpha", origins: [alpha] },
          { factionId: "beta", origins: [beta] },
        ]),
      ),
    ).toThrow(/ORIGIN_ILLEGAL_TERRAIN/);

    const fallout = Array.from({ length: width }, () => false);
    fallout[alpha] = true;
    const falloutState = spawnState({
      seed: "fixed-fallout",
      width,
      height: 1,
      initialFallout: fallout,
    });
    expect(() =>
      resolveFixedSpawnInitialization(
        falloutState,
        fixedConfiguration([
          { factionId: "alpha", origins: [alpha] },
          { factionId: "beta", origins: [beta] },
        ]),
      ),
    ).toThrow(/ORIGIN_ILLEGAL_TERRAIN/);

    const spacingState = spawnState({
      seed: "fixed-spacing",
      width,
      height: 1,
    });
    expect(() =>
      resolveFixedSpawnInitialization(
        spacingState,
        fixedConfiguration([
          { factionId: "alpha", origins: [20] },
          { factionId: "beta", origins: [69] },
        ]),
      ),
    ).toThrow(/ORIGIN_FOREIGN_SPACING_CONFLICT/);
  });

  it("uses simultaneous Random priority arbitration and advances the losing slot", () => {
    const width = 200;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    for (const candidate of [0, 10, 60, 70, 120, 130]) terrain[candidate] = "TEST";
    const state = spawnState({
      seed: "s3",
      width,
      height: 1,
      terrain,
    });

    const input = resolveRandomSpawnInitialization(state);

    expect(originCells(input)).toEqual({ alpha: [60], beta: [0] });
    expect(input.factions.flatMap((faction) => faction.origins)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "RANDOM_RESOLUTION" }),
      ]),
    );
  });

  it("resolves composed P01+P39+P54 Random slots with distinct close own origins and retained foreign spacing", () => {
    const width = 200;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    for (const candidate of [0, 10, 60, 70, 120, 130]) terrain[candidate] = "TEST";
    const state = spawnState({
      seed: "p1",
      width,
      height: 1,
      terrain,
      factions: [
        { id: "alpha", traits: ["P01", "P39", "P54"] },
        { id: "beta" },
      ],
    });

    const input = resolveRandomSpawnInitialization(state);
    expect(originCells(input)).toEqual({ alpha: [70, 60], beta: [10] });
    expect(input.factions[0]?.origins.map((origin) => origin.originSlot)).toEqual([0, 1]);
    expect(Math.abs(70 - 60)).toBeLessThan(50);
    expect(Math.abs(60 - 10)).toBe(50);
  });

  it("is independent of faction enumeration order and reproduces identically from fresh state", () => {
    const width = 200;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    for (const candidate of [0, 10, 60, 70, 120, 130]) terrain[candidate] = "TEST";

    const forward = resolveRandomSpawnInitialization(
      spawnState({
        seed: "s3",
        width,
        height: 1,
        terrain,
        factions: [{ id: "alpha" }, { id: "beta" }],
      }),
    );
    const reversed = resolveRandomSpawnInitialization(
      spawnState({
        seed: "s3",
        width,
        height: 1,
        terrain,
        factions: [{ id: "beta" }, { id: "alpha" }],
      }),
    );
    const repeated = resolveRandomSpawnInitialization(
      spawnState({
        seed: "s3",
        width,
        height: 1,
        terrain,
        factions: [{ id: "alpha" }, { id: "beta" }],
      }),
    );

    expect(reversed).toEqual(forward);
    expect(repeated).toEqual(forward);
  });

  it("fails Random allocation deterministically when the legal seed set cannot satisfy foreign spacing", () => {
    const width = 40;
    const terrain = Array.from({ length: width }, () => "IMPASSABLE");
    terrain[0] = "TEST";
    terrain[10] = "TEST";
    const state = spawnState({
      seed: "random-unfillable",
      width,
      height: 1,
      terrain,
    });

    expect(() => resolveRandomSpawnInitialization(state)).toThrow(
      /^RANDOM_ORIGIN_ALLOCATION_UNFILLABLE$/,
    );
    expect(state.ownership.every((owner) => owner === null)).toBe(true);
    expect(state.factions.every((faction) => faction.population.total === 0)).toBe(true);
  });

  it("feeds Fixed and Random provider results into the existing shared initialization lifecycle reproducibly", () => {
    const width = 100;
    const height = 100;
    const fixedState = spawnState({
      seed: "provider-fixed-integration",
      width,
      height,
    });
    const fixedInput = resolveFixedSpawnInitialization(
      fixedState,
      fixedConfiguration([
        { factionId: "alpha", origins: [cellId(width, 10, 10)] },
        { factionId: "beta", origins: [cellId(width, 90, 90)] },
      ]),
    );
    const fixed = materializeSpawnInitialization(fixedState, fixedInput);
    expect(fixed.snapshot.spawnMode).toBe("FIXED");
    expect(
      fixed.snapshot.factions.flatMap((faction) => faction.origins.map((origin) => origin.source)),
    ).toEqual(["FIXED_CONFIGURATION", "FIXED_CONFIGURATION"]);

    const randomStateA = spawnState({
      seed: "provider-random-integration",
      width,
      height,
    });
    const randomStateB = spawnState({
      seed: "provider-random-integration",
      width,
      height,
    });
    const randomInputA = resolveRandomSpawnInitialization(randomStateA);
    const randomInputB = resolveRandomSpawnInitialization(randomStateB);
    const randomA = materializeSpawnInitialization(randomStateA, randomInputA);
    const randomB = materializeSpawnInitialization(randomStateB, randomInputB);

    expect(randomInputB).toEqual(randomInputA);
    expect(randomB.snapshot).toEqual(randomA.snapshot);
    expect(randomB.state).toEqual(randomA.state);
    expect(randomA.snapshot.spawnMode).toBe("RANDOM");
    expect(
      randomA.snapshot.factions.flatMap((faction) => faction.origins.map((origin) => origin.source)),
    ).toEqual(["RANDOM_RESOLUTION", "RANDOM_RESOLUTION"]);
  });
});
