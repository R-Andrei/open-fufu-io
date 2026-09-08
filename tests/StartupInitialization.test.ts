import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import type {
  MatchSpec,
  SpawnInitializationInput,
} from "../src/simulation/MatchSpec";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function cellId(width: number, x: number, y: number): number {
  return y * width + x;
}

function fixedSpawnInput(width: number): SpawnInitializationInput {
  return Object.freeze({
    spawnMode: "FIXED" as const,
    spawnResolverVersion: "1" as const,
    factions: Object.freeze([
      Object.freeze({
        factionId: "alpha",
        origins: Object.freeze([
          Object.freeze({
            originSlot: 0,
            resolvedExactOrigin: cellId(width, 10, 10),
            source: "FIXED_CONFIGURATION" as const,
          }),
        ]),
      }),
      Object.freeze({
        factionId: "beta",
        origins: Object.freeze([
          Object.freeze({
            originSlot: 0,
            resolvedExactOrigin: cellId(width, 90, 90),
            source: "FIXED_CONFIGURATION" as const,
          }),
        ]),
      }),
    ]),
  });
}

type TaggedInitialization =
  | Readonly<{ kind: "SYNTHETIC_FIXTURE" }>
  | Readonly<{ kind: "SPAWN"; input: SpawnInitializationInput }>;

type TaggedMatchSpec = Omit<MatchSpec, "spawnInitialization"> &
  Readonly<{ initialization: TaggedInitialization }>;

function tagged(
  spec: MatchSpec,
  initialization: TaggedInitialization,
): TaggedMatchSpec {
  const { spawnInitialization: _legacy, ...rest } = spec;
  return Object.freeze({ ...rest, initialization });
}

function ordinaryMicroSpec(options?: {
  readonly initialOwners?: readonly (string | null)[];
  readonly initialStructureGrant?: boolean;
}): MatchSpec {
  const width = 100;
  const initialOwners = options?.initialOwners;
  return createMicroSimulationSpec({
    seed: "startup-contract",
    width,
    height: 100,
    terrain: Array.from({ length: width * 100 }, () => "PLAINS"),
    ...(initialOwners === undefined ? {} : { initialOwners }),
    ...(options?.initialStructureGrant === true
      ? {
          initialStructureGrants: [
            {
              structureId: "fixture-alpha-silo",
              ownerId: "alpha",
              type: "MISSILE_SILO" as const,
              cellId: 0,
              level: 1,
            },
          ],
        }
      : {}),
    factions: [
      { id: "alpha", rules: rules() },
      { id: "beta", rules: rules() },
    ],
  });
}

function ownerCount(runtime: MatchRuntime, factionId: string): number {
  return runtime.snapshot().ownership.filter((ownerId) => ownerId === factionId).length;
}

describe("explicit MatchRuntime startup initialization contract", () => {
  it("rejects an artifact-backed MatchSpec that omits explicit SPAWN startup", () => {
    const invalid = Object.freeze({
      seed: "artifact-missing-startup",
      map: Object.freeze({
        kind: "ARTIFACT" as const,
        mapId: "europe",
        mapVersion: "1",
        mapHash: "0".repeat(64),
      }),
      factions: Object.freeze([
        Object.freeze({ id: "alpha", rules: rules() }),
        Object.freeze({ id: "beta", rules: rules() }),
      ]),
    }) as unknown as MatchSpec;

    expect(() => new MatchRuntime(invalid)).toThrow(
      /artifact-backed MatchSpec requires SPAWN initialization/i,
    );
  });

  it("keeps explicitly tagged synthetic fixtures available for pre-authored test state", () => {
    const owners = Array.from({ length: 10_000 }, (_, index) =>
      index < 5_000 ? "alpha" : "beta",
    );
    const spec = tagged(
      ordinaryMicroSpec({ initialOwners: owners, initialStructureGrant: true }),
      Object.freeze({ kind: "SYNTHETIC_FIXTURE" as const }),
    );

    const runtime = new MatchRuntime(spec);
    expect(ownerCount(runtime, "alpha")).toBe(5_000);
    expect(runtime.snapshot().structures).toEqual([
      expect.objectContaining({
        id: "fixture-alpha-silo",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
      }),
    ]);
  });

  it("materializes tagged SPAWN startup and preserves that path through regeneration", () => {
    const width = 100;
    const spec = tagged(
      ordinaryMicroSpec(),
      Object.freeze({ kind: "SPAWN" as const, input: fixedSpawnInput(width) }),
    );

    const runtime = new MatchRuntime(spec);
    expect(ownerCount(runtime, "alpha")).toBe(1_000);
    expect(ownerCount(runtime, "beta")).toBe(1_000);
    expect(runtime.snapshot()).toMatchObject({
      phase: "ACTIVE",
      spawnSnapshot: { spawnMode: "FIXED" },
    });

    const regenerated = MatchRuntime.regenerate(spec, [], 0);
    expect(regenerated.spec.initialization.kind).toBe("SPAWN");
    expect(regenerated.snapshot()).toEqual(runtime.snapshot());
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
  });

  it("rejects pre-authored ownership on the tagged SPAWN path", () => {
    const owners = Array.from({ length: 10_000 }, () => null as string | null);
    const spec = tagged(
      ordinaryMicroSpec({ initialOwners: owners }),
      Object.freeze({ kind: "SPAWN" as const, input: fixedSpawnInput(100) }),
    );

    expect(() => new MatchRuntime(spec)).toThrow(
      /SPAWN initialization cannot be combined with synthetic initialOwners/i,
    );
  });

  it("rejects legacy structure grants on the tagged SPAWN path", () => {
    const spec = tagged(
      ordinaryMicroSpec({ initialStructureGrant: true }),
      Object.freeze({ kind: "SPAWN" as const, input: fixedSpawnInput(100) }),
    );

    expect(() => new MatchRuntime(spec)).toThrow(
      /SPAWN initialization cannot be combined with legacy initialStructureGrants/i,
    );
  });
});
