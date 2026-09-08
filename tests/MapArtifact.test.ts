import { createHash } from "node:crypto";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { MatchRuntime } from "../src/simulation/MatchRuntime";

const CELL_COUNT = 4_800_000;
const WIDTH = 2_400;
const HEIGHT = 2_000;
const UTF8 = new TextEncoder();

const TERRAIN_NAMES = [
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
  "SHALLOW_WATER",
  "DEEP_WATER",
  "IMPASSABLE",
] as const;

interface TestArtifactFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

interface TestArtifactPackage {
  readonly files: readonly TestArtifactFile[];
}

interface TestArtifactBinding {
  readonly mapId: string;
  readonly mapVersion: string;
  readonly mapHash: string;
}

interface TestArtifactResolver {
  resolve(binding: TestArtifactBinding): TestArtifactPackage | undefined;
}

interface TestRuntimeDependencies {
  readonly mapArtifacts: TestArtifactResolver;
}

type TestRules = ReturnType<typeof emptyRules>;

interface TestArtifactMatchSpec {
  readonly seed: string;
  readonly map: Readonly<
    { readonly kind: "ARTIFACT" } & TestArtifactBinding
  >;
  readonly factions: readonly {
    readonly id: string;
    readonly rules: TestRules;
  }[];
}

interface ArtifactRuntimeConstructor {
  new (
    spec: TestArtifactMatchSpec,
    dependencies: TestRuntimeDependencies,
  ): MatchRuntime;
  regenerate(
    spec: TestArtifactMatchSpec,
    inputs: ReturnType<MatchRuntime["acceptedInputs"]>,
    finalTick: number,
    dependencies: TestRuntimeDependencies,
  ): MatchRuntime;
}

interface TestSimulationMap {
  readonly source: "ARTIFACT" | "SYNTHETIC";
  readonly formatVersion?: number;
  readonly mapId?: string;
  readonly mapVersion?: string;
  readonly mapHash?: string;
  readonly width: number;
  readonly height: number;
  readonly cellCount: number;
  readonly terrain: readonly string[];
  isValidCellId(cellId: number): boolean;
  cellIdAt(x: number, y: number): number | undefined;
  positionOf(cellId: number): Readonly<{ x: number; y: number }>;
  terrainAt(cellId: number): string;
  cardinalNeighbors(cellId: number): readonly number[];
}

interface TestManifestSection {
  readonly id: string;
  readonly encoding: string;
  readonly path: string;
}

interface TestManifest {
  readonly format: string;
  readonly formatVersion: number;
  readonly mapId: unknown;
  readonly mapVersion: unknown;
  readonly width: unknown;
  readonly height: unknown;
  readonly sections: unknown;
  readonly [key: string]: unknown;
}

const ArtifactRuntime = MatchRuntime as unknown as ArtifactRuntimeConstructor;

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareStrings);
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported canonical test value: ${typeof value}`);
}

function hashPackage(files: readonly TestArtifactFile[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => compareStrings(left.path, right.path))) {
    const pathBytes = Buffer.from(file.path, "utf8");
    hash.update(`${pathBytes.byteLength}:`);
    hash.update(pathBytes);
    hash.update(`${file.bytes.byteLength}:`);
    hash.update(file.bytes);
  }
  return hash.digest("hex");
}

function baseManifest(): TestManifest {
  return {
    format: "OPEN_FUFU_MAP",
    formatVersion: 1,
    mapId: "europe",
    mapVersion: "1",
    width: WIDTH,
    height: HEIGHT,
    sections: [
      {
        id: "terrain",
        encoding: "TERRAIN_U8_V1",
        path: "terrain.bin",
      },
    ] satisfies readonly TestManifestSection[],
  };
}

function canonicalManifestBytes(manifest: unknown): Uint8Array {
  return UTF8.encode(canonicalJson(manifest));
}

function packageFrom(
  manifestBytes: Uint8Array,
  terrainBytes: Uint8Array,
  extraFiles: readonly TestArtifactFile[] = [],
): TestArtifactPackage {
  return {
    files: [
      { path: "manifest.json", bytes: manifestBytes },
      { path: "terrain.bin", bytes: terrainBytes },
      ...extraFiles,
    ],
  };
}

function buildValidPackage(): {
  readonly package: TestArtifactPackage;
  readonly manifestBytes: Uint8Array;
  readonly terrainBytes: Uint8Array;
  readonly hash: string;
} {
  const terrainBytes = new Uint8Array(CELL_COUNT);
  terrainBytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const manifestBytes = canonicalManifestBytes(baseManifest());
  const artifactPackage = packageFrom(manifestBytes, terrainBytes);
  return {
    package: artifactPackage,
    manifestBytes,
    terrainBytes,
    hash: hashPackage(artifactPackage.files),
  };
}

function artifactSpec(
  binding: TestArtifactBinding,
  seed = "map-artifact-runtime",
): TestArtifactMatchSpec {
  const rules = emptyRules();
  return {
    seed,
    map: { kind: "ARTIFACT", ...binding },
    factions: [
      { id: "alpha", rules },
      { id: "beta", rules },
    ],
  };
}

function resolverFor(
  artifactPackage: TestArtifactPackage | undefined,
): TestArtifactResolver {
  return {
    resolve() {
      return artifactPackage;
    },
  };
}

function constructArtifactRuntime(
  artifactPackage: TestArtifactPackage,
  bindingOverrides: Partial<TestArtifactBinding> = {},
): MatchRuntime {
  const mapHash = hashPackage(artifactPackage.files);
  const binding: TestArtifactBinding = {
    mapId: "europe",
    mapVersion: "1",
    mapHash,
    ...bindingOverrides,
  };
  return new ArtifactRuntime(artifactSpec(binding), {
    mapArtifacts: resolverFor(artifactPackage),
  });
}

function expectArtifactFailure(
  artifactPackage: TestArtifactPackage,
  expected: RegExp,
  bindingOverrides: Partial<TestArtifactBinding> = {},
): void {
  expect(() =>
    constructArtifactRuntime(artifactPackage, bindingOverrides),
  ).toThrow(expected);
}

describe("Open Fufu V1 map artifact and simulation substrate", () => {
  it("loads an exact artifact into an immutable row-major substrate and reconstructs it deterministically", () => {
    const valid = buildValidPackage();
    const spec = artifactSpec({
      mapId: "europe",
      mapVersion: "1",
      mapHash: valid.hash,
    });
    const dependencies = { mapArtifacts: resolverFor(valid.package) };
    const runtime = new ArtifactRuntime(spec, dependencies);
    const map = runtime.snapshot().map as unknown as TestSimulationMap;

    expect(map.source).toBe("ARTIFACT");
    expect(map.formatVersion).toBe(1);
    expect(map.mapId).toBe("europe");
    expect(map.mapVersion).toBe("1");
    expect(map.mapHash).toBe(valid.hash);
    expect(map.width).toBe(WIDTH);
    expect(map.height).toBe(HEIGHT);
    expect(map.cellCount).toBe(CELL_COUNT);
    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.isFrozen(map.terrain)).toBe(true);

    expect(map.isValidCellId(-1)).toBe(false);
    expect(map.isValidCellId(0)).toBe(true);
    expect(map.isValidCellId(CELL_COUNT - 1)).toBe(true);
    expect(map.isValidCellId(CELL_COUNT)).toBe(false);
    expect(map.isValidCellId(0.5)).toBe(false);
    expect(map.cellIdAt(0, 0)).toBe(0);
    expect(map.cellIdAt(WIDTH - 1, HEIGHT - 1)).toBe(CELL_COUNT - 1);
    expect(map.cellIdAt(-1, 0)).toBeUndefined();
    expect(map.cellIdAt(WIDTH, 0)).toBeUndefined();
    expect(map.cellIdAt(0.5, 0)).toBeUndefined();
    expect(map.positionOf(WIDTH + 1)).toEqual({ x: 1, y: 1 });
    expect(TERRAIN_NAMES.map((_, cellId) => map.terrainAt(cellId))).toEqual(
      TERRAIN_NAMES,
    );
    expect(map.cardinalNeighbors(0)).toEqual([1, WIDTH]);
    expect(map.cardinalNeighbors(WIDTH + 1)).toEqual([
      1,
      WIDTH,
      WIDTH + 2,
      WIDTH * 2 + 1,
    ]);
    expect(() => map.positionOf(CELL_COUNT)).toThrow(/CellId/i);
    expect(() => map.terrainAt(CELL_COUNT)).toThrow(/CellId/i);
    expect(() => map.cardinalNeighbors(CELL_COUNT)).toThrow(/CellId/i);

    const regenerated = ArtifactRuntime.regenerate(
      spec,
      runtime.acceptedInputs(),
      runtime.snapshot().tick,
      dependencies,
    );
    const regeneratedMap = regenerated.snapshot().map as unknown as TestSimulationMap;
    expect(regeneratedMap.mapId).toBe(map.mapId);
    expect(regeneratedMap.mapVersion).toBe(map.mapVersion);
    expect(regeneratedMap.mapHash).toBe(map.mapHash);
    expect(regeneratedMap.terrainAt(9)).toBe("IMPASSABLE");

    valid.terrainBytes[0] = 9;
    valid.manifestBytes[0] ^= 1;
    expect(map.terrainAt(0)).toBe("PLAINS");
    expect(map.mapHash).toBe(valid.hash);
  });

  it("uses package-relative path ordering rather than resolver file order for content identity", () => {
    const valid = buildValidPackage();
    const reversed: TestArtifactPackage = {
      files: [...valid.package.files].reverse(),
    };

    expect(hashPackage(reversed.files)).toBe(valid.hash);
    const runtime = constructArtifactRuntime(reversed);
    const map = runtime.snapshot().map as unknown as TestSimulationMap;
    expect(map.mapHash).toBe(valid.hash);
    expect(map.terrainAt(0)).toBe("PLAINS");
  });

  it("requires an artifact resolver and exact resolution for artifact-backed MatchSpecs", () => {
    const valid = buildValidPackage();
    const spec = artifactSpec({
      mapId: "europe",
      mapVersion: "1",
      mapHash: valid.hash,
    });

    expect(() => new ArtifactRuntime(spec, {} as TestRuntimeDependencies)).toThrow(
      /map artifact resolver/i,
    );
    expect(
      () =>
        new ArtifactRuntime(spec, {
          mapArtifacts: resolverFor(undefined),
        }),
    ).toThrow(/map artifact.*not found/i);
  });

  it("validates the external SHA-256 binding before accepting artifact content", () => {
    const valid = buildValidPackage();

    expectArtifactFailure(valid.package, /mapHash.*lowercase.*SHA-256/i, {
      mapHash: "ABC",
    });
    expectArtifactFailure(valid.package, /mapHash.*lowercase.*SHA-256/i, {
      mapHash: "A".repeat(64),
    });
    expectArtifactFailure(valid.package, /mapHash.*lowercase.*SHA-256/i, {
      mapHash: "g".repeat(64),
    });
    expectArtifactFailure(valid.package, /hash mismatch/i, {
      mapHash: "0".repeat(64),
    });

    const changedTerrain = valid.terrainBytes.slice();
    changedTerrain[123_456] = 1;
    const changedPackage = packageFrom(valid.manifestBytes, changedTerrain);
    expectArtifactFailure(changedPackage, /hash mismatch/i, {
      mapHash: valid.hash,
    });
  });

  it("rejects duplicate, missing, unknown, and ambiguously named package files", () => {
    const valid = buildValidPackage();

    expectArtifactFailure(
      {
        files: [
          ...valid.package.files,
          { path: "terrain.bin", bytes: valid.terrainBytes },
        ],
      },
      /duplicate.*path/i,
    );
    expectArtifactFailure(
      { files: [{ path: "terrain.bin", bytes: valid.terrainBytes }] },
      /manifest\.json.*required/i,
    );
    expectArtifactFailure(
      { files: [{ path: "manifest.json", bytes: valid.manifestBytes }] },
      /terrain\.bin.*required/i,
    );
    expectArtifactFailure(
      {
        files: [
          ...valid.package.files,
          { path: "extra.bin", bytes: new Uint8Array([1]) },
        ],
      },
      /unknown artifact file/i,
    );
    expectArtifactFailure(
      {
        files: [
          { path: "./manifest.json", bytes: valid.manifestBytes },
          { path: "terrain.bin", bytes: valid.terrainBytes },
        ],
      },
      /unknown artifact file|manifest\.json.*required/i,
    );
  });

  it("requires manifest.json to be valid canonical UTF-8 JSON with one closed top-level shape", () => {
    const valid = buildValidPackage();

    expectArtifactFailure(
      packageFrom(new Uint8Array([0xff]), valid.terrainBytes),
      /UTF-8/i,
    );
    expectArtifactFailure(
      packageFrom(UTF8.encode("{"), valid.terrainBytes),
      /JSON/i,
    );
    expectArtifactFailure(
      packageFrom(UTF8.encode(JSON.stringify(baseManifest())), valid.terrainBytes),
      /canonical/i,
    );

    const canonical = canonicalJson(baseManifest());
    const duplicateFormat = canonical.replace(
      "{",
      '{"format":"OPEN_FUFU_MAP",',
    );
    expectArtifactFailure(
      packageFrom(UTF8.encode(duplicateFormat), valid.terrainBytes),
      /canonical/i,
    );

    const { height: _height, ...missingHeight } = baseManifest();
    expectArtifactFailure(
      packageFrom(canonicalManifestBytes(missingHeight), valid.terrainBytes),
      /manifest.*keys/i,
    );
    expectArtifactFailure(
      packageFrom(
        canonicalManifestBytes({ ...baseManifest(), unknown: true }),
        valid.terrainBytes,
      ),
      /manifest.*keys/i,
    );
    expectArtifactFailure(
      packageFrom(canonicalManifestBytes([]), valid.terrainBytes),
      /manifest.*object/i,
    );
  });

  it.each([
    ["wrong format", { ...baseManifest(), format: "OPENFRONT_MAP" }, /format/i],
    [
      "unsupported format version",
      { ...baseManifest(), formatVersion: 2 },
      /formatVersion.*unsupported/i,
    ],
    ["empty map id", { ...baseManifest(), mapId: "" }, /mapId.*non-empty/i],
    [
      "non-string map id",
      { ...baseManifest(), mapId: 7 },
      /mapId.*string/i,
    ],
    [
      "empty map version",
      { ...baseManifest(), mapVersion: "" },
      /mapVersion.*non-empty/i,
    ],
    [
      "non-string map version",
      { ...baseManifest(), mapVersion: 1 },
      /mapVersion.*string/i,
    ],
    ["zero width", { ...baseManifest(), width: 0 }, /width.*positive.*integer/i],
    [
      "fractional width",
      { ...baseManifest(), width: 2_400.5 },
      /width.*positive.*integer/i,
    ],
    [
      "zero height",
      { ...baseManifest(), height: 0 },
      /height.*positive.*integer/i,
    ],
    [
      "fractional height",
      { ...baseManifest(), height: 2_000.5 },
      /height.*positive.*integer/i,
    ],
    [
      "wrong canonical cell count",
      { ...baseManifest(), width: 1_200, height: 800 },
      /4,800,000/i,
    ],
    ["sections is not an array", { ...baseManifest(), sections: {} }, /sections.*array/i],
    ["missing terrain section", { ...baseManifest(), sections: [] }, /terrain.*section/i],
    [
      "unknown second section",
      {
        ...baseManifest(),
        sections: [
          ...(baseManifest().sections as readonly TestManifestSection[]),
          { id: "segments", encoding: "SEGMENTS_V1", path: "segments.bin" },
        ],
      },
      /V1.*section|sections.*V1/i,
    ],
    [
      "terrain section wrong id",
      {
        ...baseManifest(),
        sections: [
          { id: "tiles", encoding: "TERRAIN_U8_V1", path: "terrain.bin" },
        ],
      },
      /terrain.*section/i,
    ],
    [
      "terrain section wrong encoding",
      {
        ...baseManifest(),
        sections: [
          { id: "terrain", encoding: "TERRAIN_U16_V1", path: "terrain.bin" },
        ],
      },
      /TERRAIN_U8_V1/i,
    ],
    [
      "terrain section wrong path",
      {
        ...baseManifest(),
        sections: [
          { id: "terrain", encoding: "TERRAIN_U8_V1", path: "../terrain.bin" },
        ],
      },
      /terrain\.bin/i,
    ],
    [
      "terrain section unknown field",
      {
        ...baseManifest(),
        sections: [
          {
            id: "terrain",
            encoding: "TERRAIN_U8_V1",
            path: "terrain.bin",
            unknown: true,
          },
        ],
      },
      /section.*keys/i,
    ],
  ])("rejects invalid manifest attribute: %s", (_name, manifest, expected) => {
    const valid = buildValidPackage();
    expectArtifactFailure(
      packageFrom(canonicalManifestBytes(manifest), valid.terrainBytes),
      expected,
    );
  });

  it("rejects manifest identity that does not exactly match the MatchSpec binding", () => {
    const valid = buildValidPackage();

    expectArtifactFailure(
      packageFrom(
        canonicalManifestBytes({ ...baseManifest(), mapId: "other" }),
        valid.terrainBytes,
      ),
      /mapId.*mismatch/i,
    );
    expectArtifactFailure(
      packageFrom(
        canonicalManifestBytes({ ...baseManifest(), mapVersion: "2" }),
        valid.terrainBytes,
      ),
      /mapVersion.*mismatch/i,
    );
  });

  it("requires exactly one terrain byte per canonical raster cell and rejects every undefined terrain code", () => {
    const valid = buildValidPackage();

    expectArtifactFailure(
      packageFrom(valid.manifestBytes, new Uint8Array(CELL_COUNT - 1)),
      /terrain.*length.*4,800,000/i,
    );
    expectArtifactFailure(
      packageFrom(valid.manifestBytes, new Uint8Array(CELL_COUNT + 1)),
      /terrain.*length.*4,800,000/i,
    );

    const invalidTerrain = valid.terrainBytes.slice();
    invalidTerrain[77] = 10;
    expectArtifactFailure(
      packageFrom(valid.manifestBytes, invalidTerrain),
      /terrain.*code.*10/i,
    );
    const invalidTerrain255 = valid.terrainBytes.slice();
    invalidTerrain255[78] = 255;
    expectArtifactFailure(
      packageFrom(valid.manifestBytes, invalidTerrain255),
      /terrain.*code.*255/i,
    );
  });
});
