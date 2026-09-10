import type {
  CellId,
  MapPoint,
  TerrainType,
} from "../core/controller/ControllerApi";
import { createRailNetwork, type RailNetwork } from "./RailNetwork";
import {
  segmentRuntimeIndexMatchesTerrain,
  type SegmentRuntimeIndex,
} from "./Segments";

export type SimulationTerrain = TerrainType | "TEST";
export type SimulationMapSource = "SYNTHETIC" | "ARTIFACT";

export interface SimulationMap {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly SimulationTerrain[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialFallout?: readonly boolean[];

  readonly source: SimulationMapSource;
  readonly cellCount: number;
  readonly formatVersion?: number;
  readonly mapId?: string;
  readonly mapVersion?: string;
  readonly mapHash?: string;
  readonly segments?: SegmentRuntimeIndex;
  readonly rail: RailNetwork;

  isValidCellId(cellId: CellId): boolean;
  cellIdAt(x: number, y: number): CellId | undefined;
  positionOf(cellId: CellId): Readonly<MapPoint>;
  terrainAt(cellId: CellId): SimulationTerrain;
  cardinalNeighbors(cellId: CellId): readonly CellId[];
}

export interface SimulationMapInput {
  readonly source: SimulationMapSource;
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly SimulationTerrain[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialFallout?: readonly boolean[];
  readonly formatVersion?: number;
  readonly mapId?: string;
  readonly mapVersion?: string;
  readonly mapHash?: string;
  readonly segments?: SegmentRuntimeIndex;
  readonly railTopology?: Uint8Array;
}

function assertPositiveSafeDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function checkedCellCount(width: number, height: number): number {
  assertPositiveSafeDimension(width, "map width");
  assertPositiveSafeDimension(height, "map height");
  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0) {
    throw new Error("map cell count must be a positive safe integer");
  }
  return cellCount;
}

export function createSimulationMap(input: SimulationMapInput): SimulationMap {
  const cellCount = checkedCellCount(input.width, input.height);
  if (input.terrain.length !== cellCount) {
    throw new Error("map terrain length must equal width * height");
  }
  if (
    input.initialOwners !== undefined &&
    input.initialOwners.length !== cellCount
  ) {
    throw new Error("map initialOwners length must equal width * height");
  }
  if (
    input.initialFallout !== undefined &&
    input.initialFallout.length !== cellCount
  ) {
    throw new Error("map initialFallout length must equal width * height");
  }
  if (
    input.segments !== undefined &&
    (input.segments.width !== input.width ||
      input.segments.height !== input.height ||
      input.segments.cellCount !== cellCount)
  ) {
    throw new Error(
      "Segment runtime index raster must match map width, height, and cell count",
    );
  }
  if (
    input.segments !== undefined &&
    (input.terrain.some((terrain) => terrain === "TEST") ||
      !segmentRuntimeIndexMatchesTerrain(
        input.segments,
        input.terrain as readonly TerrainType[],
      ))
  ) {
    throw new Error("Segment runtime index terrain must match map base terrain");
  }

  const terrain = Object.freeze([...input.terrain]);
  const rail = createRailNetwork(
    { width: input.width, height: input.height, cellCount },
    input.railTopology,
  );
  const map: Record<string, unknown> = {
    width: input.width,
    height: input.height,
    terrain,
    ...(input.initialOwners === undefined
      ? {}
      : { initialOwners: Object.freeze([...input.initialOwners]) }),
    ...(input.initialFallout === undefined
      ? {}
      : { initialFallout: Object.freeze([...input.initialFallout]) }),
  };

  const isValidCellId = (cellId: CellId): boolean =>
    Number.isSafeInteger(cellId) && cellId >= 0 && cellId < cellCount;

  const assertCellId = (cellId: CellId): void => {
    if (!isValidCellId(cellId)) {
      throw new Error(`CellId is outside the map substrate: ${String(cellId)}`);
    }
  };

  const cellIdAt = (x: number, y: number): CellId | undefined => {
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= input.width ||
      y >= input.height
    ) {
      return undefined;
    }
    return y * input.width + x;
  };

  const positionOf = (cellId: CellId): Readonly<MapPoint> => {
    assertCellId(cellId);
    return Object.freeze({
      x: cellId % input.width,
      y: Math.floor(cellId / input.width),
    });
  };

  const terrainAt = (cellId: CellId): SimulationTerrain => {
    assertCellId(cellId);
    return terrain[cellId]!;
  };

  const cardinalNeighbors = (cellId: CellId): readonly CellId[] => {
    assertCellId(cellId);
    const x = cellId % input.width;
    const y = Math.floor(cellId / input.width);
    const neighbors: CellId[] = [];
    if (x > 0) neighbors.push(cellId - 1);
    if (x + 1 < input.width) neighbors.push(cellId + 1);
    if (y > 0) neighbors.push(cellId - input.width);
    if (y + 1 < input.height) neighbors.push(cellId + input.width);
    neighbors.sort((left, right) => left - right);
    return Object.freeze(neighbors);
  };

  Object.defineProperties(map, {
    source: { value: input.source, enumerable: false },
    cellCount: { value: cellCount, enumerable: false },
    ...(input.formatVersion === undefined
      ? {}
      : { formatVersion: { value: input.formatVersion, enumerable: false } }),
    ...(input.mapId === undefined
      ? {}
      : { mapId: { value: input.mapId, enumerable: false } }),
    ...(input.mapVersion === undefined
      ? {}
      : { mapVersion: { value: input.mapVersion, enumerable: false } }),
    ...(input.mapHash === undefined
      ? {}
      : { mapHash: { value: input.mapHash, enumerable: false } }),
    ...(input.segments === undefined
      ? {}
      : { segments: { value: input.segments, enumerable: false } }),
    rail: { value: rail, enumerable: false },
    isValidCellId: { value: isValidCellId, enumerable: false },
    cellIdAt: { value: cellIdAt, enumerable: false },
    positionOf: { value: positionOf, enumerable: false },
    terrainAt: { value: terrainAt, enumerable: false },
    cardinalNeighbors: { value: cardinalNeighbors, enumerable: false },
  });

  return Object.freeze(map) as unknown as SimulationMap;
}
