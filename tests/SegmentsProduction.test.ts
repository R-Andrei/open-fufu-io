import type { TerrainType } from "../src/core/controller/ControllerApi";
import {
  mapArtifactHash,
  materializeMapArtifact,
  type MapArtifactFile,
  type MapArtifactPackage,
} from "../src/simulation/MapArtifact";
import {
  SEGMENT_COUNT_LIMIT,
  SEGMENT_GENERATOR_VERSION,
  SEGMENT_TARGET_CELL_COUNT,
  compileSegments,
  encodeCompiledSegments,
} from "../src/simulation/Segments";

const WIDTH = 2_400;
const HEIGHT = 2_000;
const CELL_COUNT = WIDTH * HEIGHT;
const UTF8 = new TextEncoder();

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
  throw new Error(`unsupported canonical test value: ${typeof value}`);
}

describe("production-scale Segment compiler validation", () => {
  it(
    "compiles and materializes all 4,800,000 cells without arbitrary size rejection",
    () => {
      const terrain = new Array<TerrainType>(CELL_COUNT).fill("PLAINS");
      const compiled = compileSegments({ width: WIDTH, height: HEIGHT, terrain });

      expect(compiled.segmentCount).toBe(
        Math.round(CELL_COUNT / SEGMENT_TARGET_CELL_COUNT),
      );
      expect(compiled.segmentCount).toBeLessThan(SEGMENT_COUNT_LIMIT);
      expect(compiled.metadata).toHaveLength(compiled.segmentCount);
      expect(compiled.diagnostics.segmentCount).toBe(compiled.segmentCount);

      let totalCells = 0;
      let previousMinCellId = -1;
      for (let segmentId = 0; segmentId < compiled.segmentCount; segmentId += 1) {
        const metadata = compiled.metadata[segmentId]!;
        expect(metadata.cellCount).toBeGreaterThan(0);
        expect(metadata.minCellId).toBeGreaterThan(previousMinCellId);
        expect(metadata.terrainCounts).toEqual({ PLAINS: metadata.cellCount });
        totalCells += metadata.cellCount;
        previousMinCellId = metadata.minCellId;
      }
      expect(totalCells).toBe(CELL_COUNT);
      expect(compiled.segmentIdOf(0)).toBe(0);
      expect(compiled.segmentIdOf(CELL_COUNT - 1)).toBeLessThan(compiled.segmentCount);

      const firstCells = compiled.cells(0);
      expect(firstCells).toHaveLength(compiled.metadata[0]!.cellCount);
      expect(firstCells[0]).toBe(compiled.metadata[0]!.minCellId);

      const segmentBytes = encodeCompiledSegments(compiled);
      const manifest = {
        format: "OPEN_FUFU_MAP",
        formatVersion: 2,
        mapId: "production-segments",
        mapVersion: "1",
        width: WIDTH,
        height: HEIGHT,
        segmentGeneratorVersion: SEGMENT_GENERATOR_VERSION,
        segmentCount: compiled.segmentCount,
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
      const files: readonly MapArtifactFile[] = [
        { path: "manifest.json", bytes: UTF8.encode(canonicalJson(manifest)) },
        { path: "terrain.bin", bytes: new Uint8Array(CELL_COUNT) },
        { path: "segments/membership.bin", bytes: segmentBytes.membership },
        { path: "segments/metadata.bin", bytes: segmentBytes.metadata },
        {
          path: "segments/adjacency-offsets.bin",
          bytes: segmentBytes.adjacencyOffsets,
        },
        { path: "segments/adjacency.bin", bytes: segmentBytes.adjacency },
      ];
      const artifactPackage: MapArtifactPackage = { files };
      const mapHash = mapArtifactHash(files);
      const map = materializeMapArtifact(
        {
          mapId: "production-segments",
          mapVersion: "1",
          mapHash,
        },
        artifactPackage,
      );

      expect(map.formatVersion).toBe(2);
      expect(map.mapHash).toBe(mapHash);
      expect(map.segments?.segmentCount).toBe(compiled.segmentCount);
      expect(map.segments?.segmentIdOf(0)).toBe(compiled.segmentIdOf(0));
      expect(map.segments?.segmentIdOf(CELL_COUNT - 1)).toBe(
        compiled.segmentIdOf(CELL_COUNT - 1),
      );
      expect(map.segments?.metadata(0)).toEqual(compiled.metadata[0]);
      expect(map.segments?.adjacentSegmentIds(0)).toEqual(
        compiled.adjacentSegmentIds(0),
      );
      const materializedFirst = map.segments!.cells(0);
      expect(materializedFirst.length).toBe(firstCells.length);
      expect(materializedFirst.at(0)).toBe(firstCells[0]);
      expect(materializedFirst.at(materializedFirst.length - 1)).toBe(
        firstCells[firstCells.length - 1],
      );
    },
    60_000,
  );
});
