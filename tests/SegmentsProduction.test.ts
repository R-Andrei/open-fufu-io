import type { TerrainType } from "../src/core/controller/ControllerApi";
import {
  SEGMENT_COUNT_LIMIT,
  SEGMENT_TARGET_CELL_COUNT,
  compileSegments,
} from "../src/simulation/Segments";

const WIDTH = 2_400;
const HEIGHT = 2_000;
const CELL_COUNT = WIDTH * HEIGHT;

describe("production-scale Segment compiler validation", () => {
  it(
    "compiles all 4,800,000 cells deterministically without arbitrary size rejection",
    () => {
      const terrain = new Array<TerrainType>(CELL_COUNT).fill("PLAINS");
      const compiled = compileSegments({ width: WIDTH, height: HEIGHT, terrain });

      expect(compiled.membership.length).toBe(CELL_COUNT);
      expect(compiled.segmentCount).toBe(
        Math.round(CELL_COUNT / SEGMENT_TARGET_CELL_COUNT),
      );
      expect(compiled.segmentCount).toBeLessThan(SEGMENT_COUNT_LIMIT);
      expect(compiled.metadata).toHaveLength(compiled.segmentCount);

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
      expect(compiled.membership[0]).toBe(0);
      expect(compiled.membership[CELL_COUNT - 1]).toBeLessThan(
        compiled.segmentCount,
      );

      const firstCells = compiled.cells(0);
      expect(firstCells).toHaveLength(compiled.metadata[0]!.cellCount);
      expect(firstCells[0]).toBe(compiled.metadata[0]!.minCellId);
    },
    60_000,
  );
});
