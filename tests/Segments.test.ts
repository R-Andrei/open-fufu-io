import type { TerrainType } from "../src/core/controller/ControllerApi";
import {
  mapArtifactHash,
  materializeMapArtifact,
  type MapArtifactFile,
  type MapArtifactPackage,
} from "../src/simulation/MapArtifact";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import {
  SEGMENT_GENERATOR_VERSION,
  compileSegments,
  createSegmentRuntimeIndex,
  encodeCompiledSegments,
  materializeSegmentArtifact,
} from "../src/simulation/Segments";

const PRODUCTION_CELL_COUNT = 4_800_000;
const PRODUCTION_WIDTH = 2_400;
const PRODUCTION_HEIGHT = 2_000;
const UTF8 = new TextEncoder();

function filledTerrain(
  width: number,
  height: number,
  terrain: TerrainType,
): TerrainType[] {
  return Array.from({ length: width * height }, () => terrain);
}

function membershipArray(
  compiled: ReturnType<typeof compileSegments>,
  cellCount: number,
): number[] {
  return Array.from({ length: cellCount }, (_, cellId) =>
    compiled.segmentIdOf(cellId),
  );
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
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported canonical test value: ${typeof value}`);
}

function uint16Le(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return bytes;
}

function uint32Le(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

function v2Manifest(segmentGeneratorVersion = 1, segmentCount = 1) {
  return {
    format: "OPEN_FUFU_MAP",
    formatVersion: 2,
    mapId: "segment-map",
    mapVersion: "1",
    width: PRODUCTION_WIDTH,
    height: PRODUCTION_HEIGHT,
    segmentGeneratorVersion,
    segmentCount,
    sections: [
      {
        id: "terrain",
        encoding: "TERRAIN_U8_V1",
        path: "terrain.bin",
      },
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
}

function oneSegmentV2Package(
  overrides: Partial<{
    readonly manifest: ReturnType<typeof v2Manifest>;
    readonly membership: Uint8Array;
    readonly metadata: Uint8Array;
    readonly adjacencyOffsets: Uint8Array;
    readonly adjacency: Uint8Array;
  }> = {},
): MapArtifactPackage {
  const terrain = new Uint8Array(PRODUCTION_CELL_COUNT);
  const membership =
    overrides.membership ?? new Uint8Array(PRODUCTION_CELL_COUNT * 2);
  const metadata =
    overrides.metadata ??
    uint32Le([
      0,
      PRODUCTION_CELL_COUNT,
      PRODUCTION_CELL_COUNT,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
  const adjacencyOffsets = overrides.adjacencyOffsets ?? uint32Le([0, 0]);
  const adjacency = overrides.adjacency ?? new Uint8Array(0);
  const manifest = overrides.manifest ?? v2Manifest();
  const files: readonly MapArtifactFile[] = [
    { path: "manifest.json", bytes: UTF8.encode(canonicalJson(manifest)) },
    { path: "terrain.bin", bytes: terrain },
    { path: "segments/membership.bin", bytes: membership },
    { path: "segments/metadata.bin", bytes: metadata },
    { path: "segments/adjacency-offsets.bin", bytes: adjacencyOffsets },
    { path: "segments/adjacency.bin", bytes: adjacency },
  ];
  return { files };
}

function materialize(packageValue: MapArtifactPackage) {
  const binding = {
    mapId: "segment-map",
    mapVersion: "1",
    mapHash: mapArtifactHash(packageValue.files),
  };
  return materializeMapArtifact(binding, packageValue);
}

describe("deterministic Segment compiler", () => {
  it("preserves a coherent winding Shallow-Water feature with stable IDs and adjacency", () => {
    const width = 7;
    const height = 5;
    const terrain = filledTerrain(width, height, "PLAINS");
    const waterCells = [1, 8, 15, 16, 17, 24, 31];
    for (const cellId of waterCells) terrain[cellId] = "SHALLOW_WATER";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.generatorVersion).toBe(SEGMENT_GENERATOR_VERSION);
    expect(compiled.segmentCount).toBe(3);
    expect(waterCells.map((cellId) => compiled.segmentIdOf(cellId))).toEqual(
      waterCells.map(() => 1),
    );
    expect(compiled.metadata.map((entry) => entry.minCellId)).toEqual([0, 1, 2]);
    expect(compiled.cells(1)).toEqual(waterCells);
    expect(compiled.adjacentSegmentIds(1)).toEqual([0, 2]);
  });

  it("merges a meaningless one-cell raster speck instead of creating a standalone Segment", () => {
    const width = 5;
    const height = 5;
    const terrain = filledTerrain(width, height, "PLAINS");
    terrain[12] = "FOREST";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(1);
    expect(membershipArray(compiled, 25)).toEqual(
      Array.from({ length: 25 }, () => 0),
    );
    expect(compiled.metadata[0]?.terrainCounts).toEqual({ PLAINS: 24, FOREST: 1 });
  });

  it("preserves a tiny cardinally isolated island as meaningful geography", () => {
    const width = 5;
    const height = 5;
    const terrain = filledTerrain(width, height, "DEEP_WATER");
    terrain[12] = "PLAINS";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(2);
    const islandId = compiled.segmentIdOf(12);
    expect(compiled.cells(islandId)).toEqual([12]);
    expect(compiled.metadata[islandId]?.terrainCounts).toEqual({ PLAINS: 1 });
  });

  it("preserves a mountain ridge split by a cardinal pass", () => {
    const width = 7;
    const height = 7;
    const terrain = filledTerrain(width, height, "PLAINS");
    const northRidge = [3, 10, 17];
    const passCell = 24;
    const southRidge = [31, 38, 45];
    for (const cellId of [...northRidge, ...southRidge]) {
      terrain[cellId] = "MOUNTAIN";
    }

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(3);
    expect(compiled.metadata.map((entry) => entry.minCellId)).toEqual([0, 3, 31]);
    expect(compiled.segmentIdOf(passCell)).toBe(0);
    expect(compiled.cells(1)).toEqual(northRidge);
    expect(compiled.cells(2)).toEqual(southRidge);
    expect(compiled.adjacentSegmentIds(1)).toEqual([0]);
    expect(compiled.adjacentSegmentIds(2)).toEqual([0]);
  });

  it("allows a legitimate mixed-terrain Segment after deterministic fragment cleanup", () => {
    const width = 5;
    const height = 5;
    const terrain = filledTerrain(width, height, "PLAINS");
    for (const cellId of [6, 7, 11, 12]) terrain[cellId] = "FOREST";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(1);
    expect(compiled.cells(0)).toEqual(Array.from({ length: 25 }, (_, cellId) => cellId));
    expect(compiled.metadata[0]).toEqual({
      minCellId: 0,
      cellCount: 25,
      terrainCounts: { PLAINS: 21, FOREST: 4 },
    });
  });

  it("keeps diagonal corner/island contacts separate under cardinal connectivity", () => {
    const width = 3;
    const height = 3;
    const terrain = filledTerrain(width, height, "DEEP_WATER");
    terrain[0] = "PLAINS";
    terrain[4] = "PLAINS";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(3);
    expect(compiled.metadata.map((entry) => entry.minCellId)).toEqual([0, 1, 4]);
    expect(membershipArray(compiled, 9)).toEqual([0, 1, 1, 1, 2, 1, 1, 1, 1]);
    expect(compiled.cells(0)).toEqual([0]);
    expect(compiled.cells(2)).toEqual([4]);
    expect(compiled.adjacentSegmentIds(0)).toEqual([1]);
    expect(compiled.adjacentSegmentIds(2)).toEqual([1]);
  });

  it("subdivides large coherent geography deterministically without enforcing compactness", () => {
    const plainCellCount = 100 * 100;
    const longWaterCellCount = 9_000;
    const plain = compileSegments({
      width: 100,
      height: 100,
      terrain: filledTerrain(100, 100, "PLAINS"),
    });
    const longWater = compileSegments({
      width: 9_000,
      height: 1,
      terrain: filledTerrain(9_000, 1, "SHALLOW_WATER"),
    });

    expect(plain.segmentCount).toBe(2);
    expect(longWater.segmentCount).toBe(2);
    for (const [result, cellCount] of [
      [plain, plainCellCount],
      [longWater, longWaterCellCount],
    ] as const) {
      const counts = result.metadata.map((entry) => entry.cellCount);
      expect(counts.reduce((sum, value) => sum + value, 0)).toBe(cellCount);
      expect(result.metadata.map((entry) => entry.minCellId)).toEqual(
        [...result.metadata]
          .map((entry) => entry.minCellId)
          .sort((left, right) => left - right),
      );
    }

    const repeat = compileSegments({
      width: 100,
      height: 100,
      terrain: filledTerrain(100, 100, "PLAINS"),
    });
    expect(membershipArray(repeat, plainCellCount)).toEqual(
      membershipArray(plain, plainCellCount),
    );
    expect(repeat.metadata).toEqual(plain.metadata);
    expect(
      repeat.metadata.map((_, id) => repeat.adjacentSegmentIds(id)),
    ).toEqual(plain.metadata.map((_, id) => plain.adjacentSegmentIds(id)));
  });
});

describe("OPEN_FUFU_MAP V2 Segment artifact", () => {
  it(
    "materializes canonical Segment membership/metadata/adjacency into an immutable runtime index",
    () => {
      const map = materialize(oneSegmentV2Package());

      expect(map.formatVersion).toBe(2);
      expect(map.segments).toBeDefined();
      expect(map.segments?.generatorVersion).toBe(1);
      expect(map.segments?.segmentCount).toBe(1);
      expect(map.segments?.segmentIdOf(0)).toBe(0);
      expect(map.segments?.segmentIdOf(PRODUCTION_CELL_COUNT - 1)).toBe(0);
      expect(map.segments?.metadata(0)).toEqual({
        minCellId: 0,
        cellCount: PRODUCTION_CELL_COUNT,
        terrainCounts: { PLAINS: PRODUCTION_CELL_COUNT },
      });
      const cells = map.segments!.cells(0);
      expect(cells.length).toBe(PRODUCTION_CELL_COUNT);
      expect(cells.at(0)).toBe(0);
      expect(cells.at(PRODUCTION_CELL_COUNT - 1)).toBe(PRODUCTION_CELL_COUNT - 1);
      expect(map.segments?.adjacentSegmentIds(0)).toEqual([]);
      expect(Object.isFrozen(map.segments)).toBe(true);
      expect(Object.isFrozen(cells)).toBe(true);
    },
    15_000,
  );

  it(
    "rejects unsupported generator versions and inconsistent compiled Segment bytes before state creation",
    () => {
      expect(() =>
        materialize(
          oneSegmentV2Package({
            manifest: v2Manifest(2) as ReturnType<typeof v2Manifest>,
          }),
        ),
      ).toThrow(/segmentGeneratorVersion/i);

      const invalidMembership = new Uint8Array(PRODUCTION_CELL_COUNT * 2);
      invalidMembership[0] = 1;
      expect(() =>
        materialize(oneSegmentV2Package({ membership: invalidMembership })),
      ).toThrow(/membership.*SegmentId|SegmentId.*membership/i);

      const invalidMetadata = uint32Le([
        0,
        PRODUCTION_CELL_COUNT - 1,
        PRODUCTION_CELL_COUNT - 1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]);
      expect(() =>
        materialize(oneSegmentV2Package({ metadata: invalidMetadata })),
      ).toThrow(/metadata|cellCount|membership/i);
    },
    15_000,
  );
});

describe("Segment review regression coverage", () => {
  it("preserves a one-cell-wide same-terrain neck between broad regions", () => {
    const width = 11;
    const height = 7;
    const terrain = filledTerrain(width, height, "DEEP_WATER");
    for (let y = 1; y <= 5; y += 1) {
      for (let x = 0; x <= 3; x += 1) terrain[y * width + x] = "PLAINS";
      for (let x = 7; x <= 10; x += 1) terrain[y * width + x] = "PLAINS";
    }
    const neck = [37, 38, 39];
    for (const cellId of neck) terrain[cellId] = "PLAINS";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(5);
    expect(compiled.metadata.map((entry) => entry.minCellId)).toEqual([
      0,
      11,
      18,
      37,
      48,
    ]);
    expect(neck.map((cellId) => compiled.segmentIdOf(cellId))).toEqual([3, 3, 3]);
    expect(compiled.segmentIdOf(36)).toBe(1);
    expect(compiled.segmentIdOf(40)).toBe(2);
    expect(compiled.adjacentSegmentIds(3)).toEqual([0, 1, 2, 4]);
  });

  it("preserves a three-cell-wide same-terrain neck between broad regions", () => {
    const width = 13;
    const height = 9;
    const terrain = filledTerrain(width, height, "DEEP_WATER");
    for (let y = 1; y <= 7; y += 1) {
      for (let x = 0; x <= 3; x += 1) terrain[y * width + x] = "PLAINS";
      for (let x = 9; x <= 12; x += 1) terrain[y * width + x] = "PLAINS";
    }
    const neck: number[] = [];
    for (let y = 3; y <= 5; y += 1) {
      for (let x = 4; x <= 8; x += 1) {
        const cellId = y * width + x;
        terrain[cellId] = "PLAINS";
        neck.push(cellId);
      }
    }

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(5);
    expect(compiled.metadata.map((entry) => entry.minCellId)).toEqual([
      0,
      13,
      22,
      43,
      82,
    ]);
    expect(neck.map((cellId) => compiled.segmentIdOf(cellId))).toEqual(
      neck.map(() => 3),
    );
    expect(compiled.adjacentSegmentIds(3)).toEqual([0, 1, 2, 4]);
  });

  it("preserves an inset peninsula neck without relying on a map-edge barrier", () => {
    const width = 15;
    const height = 9;
    const terrain = filledTerrain(width, height, "DEEP_WATER");
    for (let y = 1; y <= 7; y += 1) {
      for (let x = 1; x <= 4; x += 1) terrain[y * width + x] = "PLAINS";
    }
    for (let y = 2; y <= 6; y += 1) {
      for (let x = 10; x <= 13; x += 1) terrain[y * width + x] = "PLAINS";
    }
    const neck = [65, 66, 67, 68, 69];
    for (const cellId of neck) terrain[cellId] = "PLAINS";

    const compiled = compileSegments({ width, height, terrain });

    expect(compiled.segmentCount).toBe(4);
    expect(compiled.metadata.map((entry) => entry.minCellId)).toEqual([0, 16, 40, 65]);
    expect(neck.map((cellId) => compiled.segmentIdOf(cellId))).toEqual(
      neck.map(() => 3),
    );
    expect(compiled.adjacentSegmentIds(3)).toEqual([0, 1, 2]);
  });

  it("reports Segment-size distribution diagnostics without turning them into legality gates", () => {
    const compiled = compileSegments({
      width: 100,
      height: 100,
      terrain: filledTerrain(100, 100, "PLAINS"),
    });
    const counts = compiled.metadata.map((entry) => entry.cellCount);

    expect(compiled.diagnostics).toEqual({
      segmentCount: compiled.segmentCount,
      minCellCount: Math.min(...counts),
      maxCellCount: Math.max(...counts),
      meanCellCount: 10_000 / compiled.segmentCount,
      belowHalfTargetCount: counts.filter((count) => count < 2_048).length,
      aboveDoubleTargetCount: counts.filter((count) => count > 8_192).length,
    });
  });

  it("does not expose mutable compiler membership that can desynchronize metadata and adjacency", () => {
    const compiled = compileSegments({
      width: 5,
      height: 5,
      terrain: filledTerrain(5, 5, "PLAINS"),
    });
    const publicShape = compiled as unknown as Record<string, unknown>;

    expect(publicShape.membership).toBeUndefined();
    expect(typeof publicShape.segmentIdOf).toBe("function");
    expect(compiled.segmentIdOf(0)).toBe(0);
    expect(() => compiled.segmentIdOf(25)).toThrow(/CellId/i);
  });

  it("rejects a Segment runtime index compiled from a different base-terrain raster with matching geometry", () => {
    const width = 2;
    const height = 1;
    const segments = createSegmentRuntimeIndex(
      compileSegments({
        width,
        height,
        terrain: ["PLAINS", "FOREST"],
      }),
    );

    expect(() =>
      createSimulationMap({
        source: "SYNTHETIC",
        width,
        height,
        terrain: ["PLAINS", "PLAINS"],
        segments,
      }),
    ).toThrow(/Segment runtime index terrain must match map base terrain/i);
  });

  it("round-trips deterministic compiler output through the Segment binary materializer", () => {
    const width = 7;
    const height = 5;
    const terrain = filledTerrain(width, height, "PLAINS");
    for (const cellId of [1, 8, 15, 16, 17, 24, 31]) {
      terrain[cellId] = "SHALLOW_WATER";
    }

    const first = compileSegments({ width, height, terrain });
    const second = compileSegments({ width, height, terrain });
    const firstBytes = encodeCompiledSegments(first);
    const secondBytes = encodeCompiledSegments(second);

    expect([...firstBytes.membership]).toEqual([...secondBytes.membership]);
    expect([...firstBytes.metadata]).toEqual([...secondBytes.metadata]);
    expect([...firstBytes.adjacencyOffsets]).toEqual([...secondBytes.adjacencyOffsets]);
    expect([...firstBytes.adjacency]).toEqual([...secondBytes.adjacency]);

    const runtime = materializeSegmentArtifact({
      generatorVersion: first.generatorVersion,
      segmentCount: first.segmentCount,
      width,
      height,
      terrain,
      membershipBytes: firstBytes.membership,
      metadataBytes: firstBytes.metadata,
      adjacencyOffsetsBytes: firstBytes.adjacencyOffsets,
      adjacencyBytes: firstBytes.adjacency,
    });

    expect(runtime.segmentCount).toBe(first.segmentCount);
    for (let segmentId = 0; segmentId < first.segmentCount; segmentId += 1) {
      expect(runtime.metadata(segmentId)).toEqual(first.metadata[segmentId]);
      const span = runtime.cells(segmentId);
      expect(
        Array.from({ length: span.length }, (_, index) => span.at(index)),
      ).toEqual(first.cells(segmentId));
      expect(runtime.adjacentSegmentIds(segmentId)).toEqual(
        first.adjacentSegmentIds(segmentId),
      );
    }
  });

  it("rejects disconnected membership, unstable IDs, and malformed CSR adjacency", () => {
    expect(() =>
      materializeSegmentArtifact({
        generatorVersion: 1,
        segmentCount: 2,
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        membershipBytes: uint16Le([0, 1, 0]),
        metadataBytes: new Uint8Array(2 * 12 * 4),
        adjacencyOffsetsBytes: uint32Le([0, 0, 0]),
        adjacencyBytes: new Uint8Array(0),
      }),
    ).toThrow(/4-connected/i);

    const singletonMetadata = (minCellId: number) => [
      minCellId,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ];
    expect(() =>
      materializeSegmentArtifact({
        generatorVersion: 1,
        segmentCount: 2,
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        membershipBytes: uint16Le([1, 0]),
        metadataBytes: uint32Le([
          ...singletonMetadata(1),
          ...singletonMetadata(0),
        ]),
        adjacencyOffsetsBytes: uint32Le([0, 1, 2]),
        adjacencyBytes: uint16Le([1, 0]),
      }),
    ).toThrow(/stable ID ordering/i);

    expect(() =>
      materializeSegmentArtifact({
        generatorVersion: 1,
        segmentCount: 2,
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        membershipBytes: uint16Le([0, 1]),
        metadataBytes: uint32Le([
          ...singletonMetadata(0),
          ...singletonMetadata(1),
        ]),
        adjacencyOffsetsBytes: uint32Le([0, 1, 2]),
        adjacencyBytes: uint16Le([0, 0]),
      }),
    ).toThrow(/adjacent to itself|adjacency/i);
  });
});
