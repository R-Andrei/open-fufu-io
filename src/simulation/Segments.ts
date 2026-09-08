// Deterministic Open Fufu Segment compiler/runtime substrate.
// Segment semantics and compiler priorities are owned by docs/SEGMENTS.md.
// Exact OPEN_FUFU_MAP package/manifest ownership remains in MapArtifact.ts.

import type {
  CellId,
  SegmentId,
  TerrainType,
} from "../core/controller/ControllerApi";

export const SEGMENT_GENERATOR_VERSION = 1 as const;
export const SEGMENT_TARGET_CELL_COUNT = 4_096 as const;
export const SEGMENT_COUNT_LIMIT = 65_536 as const;

export const SEGMENT_MEMBERSHIP_ENCODING =
  "SEGMENT_MEMBERSHIP_U16LE_V1" as const;
export const SEGMENT_METADATA_ENCODING = "SEGMENT_METADATA_U32LE_V1" as const;
export const SEGMENT_ADJACENCY_OFFSETS_ENCODING =
  "SEGMENT_ADJACENCY_OFFSETS_U32LE_V1" as const;
export const SEGMENT_ADJACENCY_ENCODING = "SEGMENT_ADJACENCY_U16LE_V1" as const;

// OPEN_FUFU_MAP placement is owned by MapArtifact.ts. These compatibility
// exports remain temporarily until that owner consumes the paths directly.
export const SEGMENT_MEMBERSHIP_PATH = "segments/membership.bin" as const;
export const SEGMENT_METADATA_PATH = "segments/metadata.bin" as const;
export const SEGMENT_ADJACENCY_OFFSETS_PATH =
  "segments/adjacency-offsets.bin" as const;
export const SEGMENT_ADJACENCY_PATH = "segments/adjacency.bin" as const;

const TERRAIN_ORDER = Object.freeze([
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
] as const satisfies readonly TerrainType[]);

const TERRAIN_INDEX = new Map<TerrainType, number>(
  TERRAIN_ORDER.map((terrain, index) => [terrain, index]),
);
const VALID_TERRAINS = new Set<TerrainType>(TERRAIN_ORDER);
const WATER_TERRAINS = new Set<TerrainType>([
  "SHALLOW_WATER",
  "DEEP_WATER",
]);
const STRONG_DOMAIN_TERRAINS = new Set<TerrainType>([
  "SHALLOW_WATER",
  "DEEP_WATER",
  "IMPASSABLE",
]);

// Generator-v1 implementation parameters. These are compiler parameters rather
// than live gameplay rules; changing output semantics requires a new Segment
// generator version/map artifact.
const ORDINARY_FEATURE_MIN_CELLS = 8;
const ORDINARY_FEATURE_MIN_SPAN = 6;
const MOUNTAIN_FEATURE_MIN_CELLS = 3;
const MOUNTAIN_FEATURE_MIN_SPAN = 3;
const STRONG_DOMAIN_MIN_CELLS = 2;
const STRONG_DOMAIN_MIN_SPAN = 3;
const TOPOLOGY_NECK_MAX_WIDTH = 3;
const TOPOLOGY_SIDE_MIN_CELLS = 12;

export interface SegmentMetadata {
  readonly minCellId: CellId;
  readonly cellCount: number;
  readonly terrainCounts: Readonly<Partial<Record<TerrainType, number>>>;
}

export interface SegmentCompilerDiagnostics {
  readonly segmentCount: number;
  readonly minCellCount: number;
  readonly maxCellCount: number;
  readonly meanCellCount: number;
  readonly belowHalfTargetCount: number;
  readonly aboveDoubleTargetCount: number;
}

export interface SegmentCompilerInput {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly TerrainType[];
}

export interface CompiledSegments {
  readonly generatorVersion: typeof SEGMENT_GENERATOR_VERSION;
  readonly segmentCount: number;
  readonly metadata: readonly SegmentMetadata[];
  readonly diagnostics: SegmentCompilerDiagnostics;
  segmentIdOf(cellId: CellId): SegmentId;
  cells(segmentId: SegmentId): readonly CellId[];
  adjacentSegmentIds(segmentId: SegmentId): readonly SegmentId[];
}

export interface SegmentCellSpan {
  readonly length: number;
  at(index: number): CellId;
}

export interface SegmentRuntimeIndex {
  readonly generatorVersion: typeof SEGMENT_GENERATOR_VERSION;
  readonly segmentCount: number;
  segmentIdOf(cellId: CellId): SegmentId;
  metadata(segmentId: SegmentId): SegmentMetadata;
  cells(segmentId: SegmentId): SegmentCellSpan;
  adjacentSegmentIds(segmentId: SegmentId): readonly SegmentId[];
}

export interface SegmentArtifactBytes {
  readonly membership: Uint8Array;
  readonly metadata: Uint8Array;
  readonly adjacencyOffsets: Uint8Array;
  readonly adjacency: Uint8Array;
}

interface ComponentStats {
  readonly terrain: TerrainType;
  readonly count: number;
  readonly minCellId: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly topologyProtected: boolean;
}

interface RegionStats {
  count: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minCellId: number;
}

interface RuntimeData {
  readonly membership: Uint16Array;
  readonly metadata: readonly SegmentMetadata[];
  readonly adjacency: readonly (readonly SegmentId[])[];
}

interface TopologyComponent {
  readonly terrain: TerrainType;
  readonly candidate: boolean;
  readonly count: number;
}

const COMPILED_MEMBERSHIP = new WeakMap<CompiledSegments, Uint16Array>();

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function checkedCellCount(width: number, height: number): number {
  assertDimension(width, "Segment compiler width");
  assertDimension(height, "Segment compiler height");
  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0) {
    throw new Error("Segment compiler cell count must be a positive safe integer");
  }
  return cellCount;
}

function assertCellId(cellId: number, cellCount: number): void {
  if (!Number.isSafeInteger(cellId) || cellId < 0 || cellId >= cellCount) {
    throw new Error(`CellId is outside compiled Segment membership: ${String(cellId)}`);
  }
}

function cardinalNeighbors(
  cellId: number,
  width: number,
  height: number,
  target: number[],
): number[] {
  target.length = 0;
  const x = cellId % width;
  const y = Math.floor(cellId / width);
  if (x > 0) target.push(cellId - 1);
  if (x + 1 < width) target.push(cellId + 1);
  if (y > 0) target.push(cellId - width);
  if (y + 1 < height) target.push(cellId + width);
  target.sort((left, right) => left - right);
  return target;
}

function incrementNeighbor(
  map: Map<number, number>,
  neighbor: number,
): void {
  map.set(neighbor, (map.get(neighbor) ?? 0) + 1);
}

function narrowRunCandidates(
  width: number,
  height: number,
  terrain: readonly TerrainType[],
): Uint8Array | undefined {
  const candidate = new Uint8Array(width * height);
  let anyCandidate = false;

  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      const start = x;
      const currentTerrain = terrain[y * width + x]!;
      x += 1;
      while (x < width && terrain[y * width + x] === currentTerrain) x += 1;
      if (x - start <= TOPOLOGY_NECK_MAX_WIDTH) {
        anyCandidate = true;
        for (let mark = start; mark < x; mark += 1) {
          candidate[y * width + mark] = 1;
        }
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    let y = 0;
    while (y < height) {
      const start = y;
      const currentTerrain = terrain[y * width + x]!;
      y += 1;
      while (y < height && terrain[y * width + x] === currentTerrain) y += 1;
      if (y - start <= TOPOLOGY_NECK_MAX_WIDTH) {
        anyCandidate = true;
        for (let mark = start; mark < y; mark += 1) {
          candidate[mark * width + x] = 1;
        }
      }
    }
  }

  return anyCandidate ? candidate : undefined;
}

function buildTopologyProtectedMask(
  width: number,
  height: number,
  terrain: readonly TerrainType[],
  queue: Uint32Array,
  neighborsScratch: number[],
): Uint8Array {
  const cellCount = width * height;
  const protectedMask = new Uint8Array(cellCount);
  const candidate = narrowRunCandidates(width, height, terrain);
  if (candidate === undefined) return protectedMask;

  const componentOf = new Int32Array(cellCount);
  componentOf.fill(-1);
  const components: TopologyComponent[] = [];

  for (let start = 0; start < cellCount; start += 1) {
    if (componentOf[start] !== -1) continue;
    const componentId = components.length;
    const componentTerrain = terrain[start]!;
    const componentCandidate = candidate[start] === 1;
    let head = 0;
    let tail = 0;
    let count = 0;
    queue[tail++] = start;
    componentOf[start] = componentId;

    while (head < tail) {
      const cellId = queue[head++]!;
      count += 1;
      for (const neighbor of cardinalNeighbors(
        cellId,
        width,
        height,
        neighborsScratch,
      )) {
        if (
          componentOf[neighbor] === -1 &&
          terrain[neighbor] === componentTerrain &&
          (candidate[neighbor] === 1) === componentCandidate
        ) {
          componentOf[neighbor] = componentId;
          queue[tail++] = neighbor;
        }
      }
    }

    components.push({
      terrain: componentTerrain,
      candidate: componentCandidate,
      count,
    });
  }

  const componentNeighbors = Array.from(
    { length: components.length },
    () => new Set<number>(),
  );
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cellId = y * width + x;
      const current = componentOf[cellId]!;
      if (x + 1 < width) {
        const right = componentOf[cellId + 1]!;
        if (current !== right) {
          componentNeighbors[current]!.add(right);
          componentNeighbors[right]!.add(current);
        }
      }
      if (y + 1 < height) {
        const down = componentOf[cellId + width]!;
        if (current !== down) {
          componentNeighbors[current]!.add(down);
          componentNeighbors[down]!.add(current);
        }
      }
    }
  }

  const protectedComponent = new Uint8Array(components.length);
  for (let componentId = 0; componentId < components.length; componentId += 1) {
    const component = components[componentId]!;
    if (!component.candidate) continue;
    let substantialSameTerrainSides = 0;
    for (const neighborId of componentNeighbors[componentId]!) {
      const neighbor = components[neighborId]!;
      if (
        !neighbor.candidate &&
        neighbor.terrain === component.terrain &&
        neighbor.count >= TOPOLOGY_SIDE_MIN_CELLS
      ) {
        substantialSameTerrainSides += 1;
      }
    }
    if (substantialSameTerrainSides >= 2) {
      protectedComponent[componentId] = 1;
    }
  }

  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    if (protectedComponent[componentOf[cellId]!] === 1) {
      protectedMask[cellId] = 1;
    }
  }
  return protectedMask;
}

function isIsolatedLandIsland(
  componentId: number,
  components: readonly ComponentStats[],
  neighbors: readonly Map<number, number>[],
): boolean {
  const terrain = components[componentId]!.terrain;
  if (WATER_TERRAINS.has(terrain) || terrain === "IMPASSABLE") return false;
  const adjacent = [...neighbors[componentId]!.keys()];
  return (
    adjacent.length > 0 &&
    adjacent.every((neighbor) => WATER_TERRAINS.has(components[neighbor]!.terrain))
  );
}

function isMeaningfulComponent(
  componentId: number,
  components: readonly ComponentStats[],
  neighbors: readonly Map<number, number>[],
): boolean {
  const component = components[componentId]!;
  if (component.topologyProtected) return true;
  const span = Math.max(
    component.maxX - component.minX + 1,
    component.maxY - component.minY + 1,
  );
  if (STRONG_DOMAIN_TERRAINS.has(component.terrain)) {
    return (
      component.count >= STRONG_DOMAIN_MIN_CELLS ||
      span >= STRONG_DOMAIN_MIN_SPAN
    );
  }
  if (component.terrain === "MOUNTAIN") {
    return (
      component.count >= MOUNTAIN_FEATURE_MIN_CELLS ||
      span >= MOUNTAIN_FEATURE_MIN_SPAN
    );
  }
  if (isIsolatedLandIsland(componentId, components, neighbors)) return true;
  return (
    component.count >= ORDINARY_FEATURE_MIN_CELLS ||
    span >= ORDINARY_FEATURE_MIN_SPAN
  );
}

function chooseNoiseParent(
  componentId: number,
  components: readonly ComponentStats[],
  neighbors: readonly Map<number, number>[],
  meaningful: readonly boolean[],
): number {
  const current = components[componentId]!;
  let best = -1;
  let bestMeaningful = -1;
  let bestBoundary = -1;
  let bestCount = -1;
  let bestMinCell = Number.POSITIVE_INFINITY;

  for (const [candidateId, sharedBoundary] of neighbors[componentId]!) {
    const candidate = components[candidateId]!;
    const candidateMeaningful = meaningful[candidateId] ? 1 : 0;
    const acyclic =
      candidateMeaningful === 1 ||
      candidate.count > current.count ||
      (candidate.count === current.count &&
        candidate.minCellId < current.minCellId);
    if (!acyclic) continue;

    if (
      candidateMeaningful > bestMeaningful ||
      (candidateMeaningful === bestMeaningful &&
        sharedBoundary > bestBoundary) ||
      (candidateMeaningful === bestMeaningful &&
        sharedBoundary === bestBoundary &&
        candidate.count > bestCount) ||
      (candidateMeaningful === bestMeaningful &&
        sharedBoundary === bestBoundary &&
        candidate.count === bestCount &&
        candidate.minCellId < bestMinCell)
    ) {
      best = candidateId;
      bestMeaningful = candidateMeaningful;
      bestBoundary = sharedBoundary;
      bestCount = candidate.count;
      bestMinCell = candidate.minCellId;
    }
  }
  return best === -1 ? componentId : best;
}

function resolveRoot(componentId: number, parent: Int32Array): number {
  let root = componentId;
  while (parent[root] !== root) root = parent[root]!;
  let cursor = componentId;
  while (parent[cursor] !== cursor) {
    const next = parent[cursor]!;
    parent[cursor] = root;
    cursor = next;
  }
  return root;
}

function regionPieceCount(cellCount: number): number {
  return Math.max(1, Math.round(cellCount / SEGMENT_TARGET_CELL_COUNT));
}

function chooseSeeds(
  cells: Uint32Array,
  start: number,
  end: number,
  pieceCount: number,
  stats: RegionStats,
  width: number,
): readonly number[] {
  if (pieceCount === 1) return [cells[start]!] as const;
  const boxWidth = stats.maxX - stats.minX + 1;
  const boxHeight = stats.maxY - stats.minY + 1;
  const aspect = boxWidth / boxHeight;
  let columns = Math.max(1, Math.round(Math.sqrt(pieceCount * aspect)));
  columns = Math.min(pieceCount, columns);
  const rows = Math.ceil(pieceCount / columns);
  const candidates = new Int32Array(pieceCount);
  candidates.fill(-1);
  const bestDistance = new Float64Array(pieceCount);
  bestDistance.fill(Number.POSITIVE_INFINITY);

  for (let offset = start; offset < end; offset += 1) {
    const cellId = cells[offset]!;
    const x = cellId % width;
    const y = Math.floor(cellId / width);
    let column = Math.floor(((x - stats.minX) * columns) / boxWidth);
    let row = Math.floor(((y - stats.minY) * rows) / boxHeight);
    if (column >= columns) column = columns - 1;
    if (row >= rows) row = rows - 1;
    const bucket = row * columns + column;
    if (bucket >= pieceCount) continue;

    const xDelta =
      (2 * (x - stats.minX) + 1) * columns - (2 * column + 1) * boxWidth;
    const yDelta =
      (2 * (y - stats.minY) + 1) * rows - (2 * row + 1) * boxHeight;
    const distance = xDelta * xDelta + yDelta * yDelta;
    const previous = candidates[bucket]!;
    if (
      distance < bestDistance[bucket]! ||
      (distance === bestDistance[bucket]! &&
        (previous === -1 || cellId < previous))
    ) {
      candidates[bucket] = cellId;
      bestDistance[bucket] = distance;
    }
  }

  const seeds: number[] = [];
  const used = new Set<number>();
  for (const candidate of candidates) {
    if (candidate >= 0 && !used.has(candidate)) {
      seeds.push(candidate);
      used.add(candidate);
    }
  }

  for (let index = 0; seeds.length < pieceCount && index < pieceCount * 2; index += 1) {
    const position = Math.min(
      end - 1,
      start + Math.floor(((index + 0.5) * (end - start)) / pieceCount),
    );
    const cellId = cells[position]!;
    if (!used.has(cellId)) {
      seeds.push(cellId);
      used.add(cellId);
    }
  }
  for (let offset = start; seeds.length < pieceCount && offset < end; offset += 1) {
    const cellId = cells[offset]!;
    if (!used.has(cellId)) {
      seeds.push(cellId);
      used.add(cellId);
    }
  }
  if (seeds.length !== pieceCount) {
    throw new Error("Segment compiler could not choose the required distinct subdivision seeds");
  }
  seeds.sort((left, right) => left - right);
  return Object.freeze(seeds);
}

function assertSegmentId(segmentId: number, segmentCount: number): void {
  if (
    !Number.isSafeInteger(segmentId) ||
    segmentId < 0 ||
    segmentId >= segmentCount
  ) {
    throw new Error(`SegmentId is outside compiled Segment range: ${String(segmentId)}`);
  }
}

function buildCellIndex(
  membership: Uint16Array,
  segmentCount: number,
): { readonly offsets: Uint32Array; readonly cells: Uint32Array } {
  const counts = new Uint32Array(segmentCount);
  for (const segmentId of membership) counts[segmentId] = counts[segmentId]! + 1;
  const offsets = new Uint32Array(segmentCount + 1);
  for (let segmentId = 0; segmentId < segmentCount; segmentId += 1) {
    offsets[segmentId + 1] = offsets[segmentId]! + counts[segmentId]!;
  }
  const cursor = offsets.slice(0, segmentCount);
  const cells = new Uint32Array(membership.length);
  for (let cellId = 0; cellId < membership.length; cellId += 1) {
    const segmentId = membership[cellId]!;
    const index = cursor[segmentId]!;
    cells[index] = cellId;
    cursor[segmentId] = index + 1;
  }
  return { offsets, cells };
}

function terrainCountsObject(counts: Uint32Array): SegmentMetadata["terrainCounts"] {
  const result: Partial<Record<TerrainType, number>> = {};
  for (let index = 0; index < TERRAIN_ORDER.length; index += 1) {
    const count = counts[index]!;
    if (count > 0) result[TERRAIN_ORDER[index]!] = count;
  }
  return Object.freeze(result);
}

function buildMetadata(
  membership: Uint16Array,
  segmentCount: number,
  terrain: readonly TerrainType[],
): readonly SegmentMetadata[] {
  const minCellIds = new Uint32Array(segmentCount);
  minCellIds.fill(0xffff_ffff);
  const counts = new Uint32Array(segmentCount);
  const terrainCounts = Array.from(
    { length: segmentCount },
    () => new Uint32Array(TERRAIN_ORDER.length),
  );
  for (let cellId = 0; cellId < membership.length; cellId += 1) {
    const segmentId = membership[cellId]!;
    counts[segmentId] = counts[segmentId]! + 1;
    if (cellId < minCellIds[segmentId]!) minCellIds[segmentId] = cellId;
    const terrainIndex = TERRAIN_INDEX.get(terrain[cellId]!);
    if (terrainIndex === undefined) {
      throw new Error(`Segment metadata encountered unsupported terrain at CellId ${cellId}`);
    }
    terrainCounts[segmentId]![terrainIndex] += 1;
  }
  return Object.freeze(
    Array.from({ length: segmentCount }, (_, segmentId) =>
      Object.freeze({
        minCellId: minCellIds[segmentId]!,
        cellCount: counts[segmentId]!,
        terrainCounts: terrainCountsObject(terrainCounts[segmentId]!),
      }),
    ),
  );
}

function buildDiagnostics(
  metadata: readonly SegmentMetadata[],
  cellCount: number,
): SegmentCompilerDiagnostics {
  let minCellCount = Number.POSITIVE_INFINITY;
  let maxCellCount = 0;
  let belowHalfTargetCount = 0;
  let aboveDoubleTargetCount = 0;
  const halfTarget = SEGMENT_TARGET_CELL_COUNT / 2;
  const doubleTarget = SEGMENT_TARGET_CELL_COUNT * 2;
  for (const entry of metadata) {
    minCellCount = Math.min(minCellCount, entry.cellCount);
    maxCellCount = Math.max(maxCellCount, entry.cellCount);
    if (entry.cellCount < halfTarget) belowHalfTargetCount += 1;
    if (entry.cellCount > doubleTarget) aboveDoubleTargetCount += 1;
  }
  return Object.freeze({
    segmentCount: metadata.length,
    minCellCount,
    maxCellCount,
    meanCellCount: cellCount / metadata.length,
    belowHalfTargetCount,
    aboveDoubleTargetCount,
  });
}

function buildAdjacency(
  membership: Uint16Array,
  segmentCount: number,
  width: number,
  height: number,
): readonly (readonly SegmentId[])[] {
  const sets = Array.from({ length: segmentCount }, () => new Set<number>());
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cellId = y * width + x;
      const current = membership[cellId]!;
      if (x + 1 < width) {
        const right = membership[cellId + 1]!;
        if (current !== right) {
          sets[current]!.add(right);
          sets[right]!.add(current);
        }
      }
      if (y + 1 < height) {
        const down = membership[cellId + width]!;
        if (current !== down) {
          sets[current]!.add(down);
          sets[down]!.add(current);
        }
      }
    }
  }
  return Object.freeze(
    sets.map((set) => Object.freeze([...set].sort((left, right) => left - right))),
  );
}

function validateConnectivity(
  membership: Uint16Array,
  segmentCount: number,
  width: number,
  height: number,
): void {
  const { offsets, cells } = buildCellIndex(membership, segmentCount);
  const visited = new Uint8Array(membership.length);
  const queue = new Uint32Array(membership.length);
  const neighbors: number[] = [];
  for (let segmentId = 0; segmentId < segmentCount; segmentId += 1) {
    const startOffset = offsets[segmentId]!;
    const endOffset = offsets[segmentId + 1]!;
    if (startOffset === endOffset) {
      throw new Error(`Segment ${segmentId} has no cells`);
    }
    let head = 0;
    let tail = 0;
    const startCell = cells[startOffset]!;
    queue[tail++] = startCell;
    visited[startCell] = 1;
    let reached = 0;
    while (head < tail) {
      const cellId = queue[head++]!;
      reached += 1;
      for (const neighbor of cardinalNeighbors(cellId, width, height, neighbors)) {
        if (membership[neighbor] === segmentId && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    if (reached !== endOffset - startOffset) {
      throw new Error(`Segment ${segmentId} is not cardinally 4-connected`);
    }
    for (let offset = startOffset; offset < endOffset; offset += 1) {
      visited[cells[offset]!] = 0;
    }
  }
}

function compiledMembership(compiled: CompiledSegments): Uint16Array {
  const membership = COMPILED_MEMBERSHIP.get(compiled);
  if (membership === undefined) {
    throw new Error("Segment compiler result was not created by this generator");
  }
  return membership;
}

export function compileSegments(input: SegmentCompilerInput): CompiledSegments {
  const cellCount = checkedCellCount(input.width, input.height);
  if (input.terrain.length !== cellCount) {
    throw new Error("Segment compiler terrain length must equal width * height");
  }
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    if (!VALID_TERRAINS.has(input.terrain[cellId]!)) {
      throw new Error(`Segment compiler encountered unsupported terrain at CellId ${cellId}`);
    }
  }

  const queue = new Uint32Array(cellCount);
  const neighborsScratch: number[] = [];
  const topologyProtected = buildTopologyProtectedMask(
    input.width,
    input.height,
    input.terrain,
    queue,
    neighborsScratch,
  );

  const componentOf = new Int32Array(cellCount);
  componentOf.fill(-1);
  const components: ComponentStats[] = [];

  for (let start = 0; start < cellCount; start += 1) {
    if (componentOf[start] !== -1) continue;
    const componentId = components.length;
    const terrain = input.terrain[start]!;
    const protectedTopology = topologyProtected[start] === 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    componentOf[start] = componentId;
    let count = 0;
    let minCellId = start;
    let minX = start % input.width;
    let maxX = minX;
    let minY = Math.floor(start / input.width);
    let maxY = minY;

    while (head < tail) {
      const cellId = queue[head++]!;
      count += 1;
      if (cellId < minCellId) minCellId = cellId;
      const x = cellId % input.width;
      const y = Math.floor(cellId / input.width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const neighbor of cardinalNeighbors(
        cellId,
        input.width,
        input.height,
        neighborsScratch,
      )) {
        if (
          componentOf[neighbor] === -1 &&
          input.terrain[neighbor] === terrain &&
          (topologyProtected[neighbor] === 1) === protectedTopology
        ) {
          componentOf[neighbor] = componentId;
          queue[tail++] = neighbor;
        }
      }
    }

    components.push({
      terrain,
      count,
      minCellId,
      minX,
      maxX,
      minY,
      maxY,
      topologyProtected: protectedTopology,
    });
  }

  const componentNeighbors = Array.from(
    { length: components.length },
    () => new Map<number, number>(),
  );
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const cellId = y * input.width + x;
      const component = componentOf[cellId]!;
      if (x + 1 < input.width) {
        const right = componentOf[cellId + 1]!;
        if (component !== right) {
          incrementNeighbor(componentNeighbors[component]!, right);
          incrementNeighbor(componentNeighbors[right]!, component);
        }
      }
      if (y + 1 < input.height) {
        const down = componentOf[cellId + input.width]!;
        if (component !== down) {
          incrementNeighbor(componentNeighbors[component]!, down);
          incrementNeighbor(componentNeighbors[down]!, component);
        }
      }
    }
  }

  const meaningful = components.map((_, componentId) =>
    isMeaningfulComponent(componentId, components, componentNeighbors),
  );
  const parent = new Int32Array(components.length);
  for (let componentId = 0; componentId < components.length; componentId += 1) {
    parent[componentId] = meaningful[componentId]
      ? componentId
      : chooseNoiseParent(
          componentId,
          components,
          componentNeighbors,
          meaningful,
        );
  }
  for (let componentId = 0; componentId < components.length; componentId += 1) {
    resolveRoot(componentId, parent);
  }

  const roots = [...new Set(Array.from(parent))].sort(
    (left, right) =>
      components[left]!.minCellId - components[right]!.minCellId,
  );
  const rootToRegion = new Map<number, number>();
  roots.forEach((root, index) => rootToRegion.set(root, index));
  const componentRegion = new Int32Array(components.length);
  const regionStats = roots.map<RegionStats>(() => ({
    count: 0,
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minCellId: Number.POSITIVE_INFINITY,
  }));
  for (let componentId = 0; componentId < components.length; componentId += 1) {
    const regionId = rootToRegion.get(parent[componentId]!)!;
    componentRegion[componentId] = regionId;
    const component = components[componentId]!;
    const stats = regionStats[regionId]!;
    stats.count += component.count;
    stats.minX = Math.min(stats.minX, component.minX);
    stats.maxX = Math.max(stats.maxX, component.maxX);
    stats.minY = Math.min(stats.minY, component.minY);
    stats.maxY = Math.max(stats.maxY, component.maxY);
    stats.minCellId = Math.min(stats.minCellId, component.minCellId);
  }

  const regionOffsets = new Uint32Array(regionStats.length + 1);
  for (let regionId = 0; regionId < regionStats.length; regionId += 1) {
    regionOffsets[regionId + 1] =
      regionOffsets[regionId]! + regionStats[regionId]!.count;
  }
  const regionCursor = regionOffsets.slice(0, regionStats.length);
  const regionCells = new Uint32Array(cellCount);
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    const regionId = componentRegion[componentOf[cellId]!]!;
    const offset = regionCursor[regionId]!;
    regionCells[offset] = cellId;
    regionCursor[regionId] = offset + 1;
  }

  const pieceCounts = regionStats.map((stats) => regionPieceCount(stats.count));
  const baseIds = new Uint32Array(regionStats.length);
  let provisionalCount = 0;
  for (let regionId = 0; regionId < regionStats.length; regionId += 1) {
    baseIds[regionId] = provisionalCount;
    provisionalCount += pieceCounts[regionId]!;
  }
  if (provisionalCount <= 0 || provisionalCount >= SEGMENT_COUNT_LIMIT) {
    throw new Error(
      `Segment compiler produced invalid Segment count ${provisionalCount}; V1 requires 1..65535`,
    );
  }

  const membership = new Uint16Array(cellCount);
  const visited = new Uint8Array(cellCount);
  for (let regionId = 0; regionId < regionStats.length; regionId += 1) {
    const start = regionOffsets[regionId]!;
    const end = regionOffsets[regionId + 1]!;
    const baseId = baseIds[regionId]!;
    const pieces = pieceCounts[regionId]!;
    if (pieces === 1) {
      for (let offset = start; offset < end; offset += 1) {
        membership[regionCells[offset]!] = baseId;
      }
      continue;
    }

    const seeds = chooseSeeds(
      regionCells,
      start,
      end,
      pieces,
      regionStats[regionId]!,
      input.width,
    );
    let head = 0;
    let tail = 0;
    for (let index = 0; index < seeds.length; index += 1) {
      const cellId = seeds[index]!;
      visited[cellId] = 1;
      membership[cellId] = baseId + index;
      queue[tail++] = cellId;
    }
    while (head < tail) {
      const cellId = queue[head++]!;
      const segmentId = membership[cellId]!;
      for (const neighbor of cardinalNeighbors(
        cellId,
        input.width,
        input.height,
        neighborsScratch,
      )) {
        if (
          visited[neighbor] === 0 &&
          componentRegion[componentOf[neighbor]!] === regionId
        ) {
          visited[neighbor] = 1;
          membership[neighbor] = segmentId;
          queue[tail++] = neighbor;
        }
      }
    }
    if (tail !== end - start) {
      throw new Error(`Segment compiler subdivision failed to cover region ${regionId}`);
    }
    for (let offset = start; offset < end; offset += 1) {
      visited[regionCells[offset]!] = 0;
    }
  }

  const provisionalMin = new Uint32Array(provisionalCount);
  provisionalMin.fill(0xffff_ffff);
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    const segmentId = membership[cellId]!;
    if (cellId < provisionalMin[segmentId]!) provisionalMin[segmentId] = cellId;
  }
  const stableOrder = Array.from(
    { length: provisionalCount },
    (_, segmentId) => segmentId,
  ).sort((left, right) => provisionalMin[left]! - provisionalMin[right]!);
  const remap = new Uint16Array(provisionalCount);
  stableOrder.forEach((oldId, newId) => {
    remap[oldId] = newId;
  });
  for (let cellId = 0; cellId < cellCount; cellId += 1) {
    membership[cellId] = remap[membership[cellId]!]!;
  }

  validateConnectivity(
    membership,
    provisionalCount,
    input.width,
    input.height,
  );
  const metadata = buildMetadata(
    membership,
    provisionalCount,
    input.terrain,
  );
  for (let segmentId = 1; segmentId < metadata.length; segmentId += 1) {
    if (metadata[segmentId - 1]!.minCellId >= metadata[segmentId]!.minCellId) {
      throw new Error("Segment compiler stable ID ordering is invalid");
    }
  }
  const adjacency = buildAdjacency(
    membership,
    provisionalCount,
    input.width,
    input.height,
  );
  const { offsets: cellOffsets, cells: indexedCells } = buildCellIndex(
    membership,
    provisionalCount,
  );
  const cellCache = new Map<number, readonly CellId[]>();
  const diagnostics = buildDiagnostics(metadata, cellCount);

  const compiled = Object.freeze({
    generatorVersion: SEGMENT_GENERATOR_VERSION,
    segmentCount: provisionalCount,
    metadata,
    diagnostics,
    segmentIdOf(cellId: CellId): SegmentId {
      assertCellId(cellId, membership.length);
      return membership[cellId]!;
    },
    cells(segmentId: SegmentId): readonly CellId[] {
      assertSegmentId(segmentId, provisionalCount);
      const cached = cellCache.get(segmentId);
      if (cached !== undefined) return cached;
      const result = Object.freeze(
        Array.from(
          indexedCells.subarray(
            cellOffsets[segmentId]!,
            cellOffsets[segmentId + 1]!,
          ),
        ),
      );
      cellCache.set(segmentId, result);
      return result;
    },
    adjacentSegmentIds(segmentId: SegmentId): readonly SegmentId[] {
      assertSegmentId(segmentId, provisionalCount);
      return adjacency[segmentId]!;
    },
  }) satisfies CompiledSegments;
  COMPILED_MEMBERSHIP.set(compiled, membership);
  return compiled;
}

function encodeUint16(values: ArrayLike<number>): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index += 1) {
    view.setUint16(index * 2, values[index]!, true);
  }
  return bytes;
}

function encodeUint32(values: ArrayLike<number>): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < values.length; index += 1) {
    view.setUint32(index * 4, values[index]!, true);
  }
  return bytes;
}

function decodeUint16(bytes: Uint8Array, label: string): Uint16Array {
  if (bytes.byteLength % 2 !== 0) {
    throw new Error(`${label} byte length must be divisible by 2`);
  }
  const result = new Uint16Array(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = view.getUint16(index * 2, true);
  }
  return result;
}

function decodeUint32(bytes: Uint8Array, label: string): Uint32Array {
  if (bytes.byteLength % 4 !== 0) {
    throw new Error(`${label} byte length must be divisible by 4`);
  }
  const result = new Uint32Array(bytes.byteLength / 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = view.getUint32(index * 4, true);
  }
  return result;
}

export function encodeCompiledSegments(
  compiled: CompiledSegments,
): SegmentArtifactBytes {
  if (compiled.generatorVersion !== SEGMENT_GENERATOR_VERSION) {
    throw new Error("cannot encode an unsupported Segment generator version");
  }
  if (
    !Number.isSafeInteger(compiled.segmentCount) ||
    compiled.segmentCount <= 0 ||
    compiled.segmentCount >= SEGMENT_COUNT_LIMIT
  ) {
    throw new Error("cannot encode an invalid Segment count");
  }
  const membership = compiledMembership(compiled);

  const metadataValues = new Uint32Array(compiled.segmentCount * 12);
  const adjacencyOffsets = new Uint32Array(compiled.segmentCount + 1);
  const adjacencyValues: number[] = [];
  for (let segmentId = 0; segmentId < compiled.segmentCount; segmentId += 1) {
    const metadata = compiled.metadata[segmentId]!;
    const base = segmentId * 12;
    metadataValues[base] = metadata.minCellId;
    metadataValues[base + 1] = metadata.cellCount;
    for (let terrainIndex = 0; terrainIndex < TERRAIN_ORDER.length; terrainIndex += 1) {
      metadataValues[base + 2 + terrainIndex] =
        metadata.terrainCounts[TERRAIN_ORDER[terrainIndex]!] ?? 0;
    }
    adjacencyOffsets[segmentId] = adjacencyValues.length;
    adjacencyValues.push(...compiled.adjacentSegmentIds(segmentId));
  }
  adjacencyOffsets[compiled.segmentCount] = adjacencyValues.length;

  return Object.freeze({
    membership: encodeUint16(membership),
    metadata: encodeUint32(metadataValues),
    adjacencyOffsets: encodeUint32(adjacencyOffsets),
    adjacency: encodeUint16(adjacencyValues),
  });
}

function validateArtifactMetadata(
  membership: Uint16Array,
  segmentCount: number,
  terrain: readonly TerrainType[],
  metadataValues: Uint32Array,
): readonly SegmentMetadata[] {
  if (metadataValues.length !== segmentCount * 12) {
    throw new Error(
      `Segment metadata length must contain exactly ${segmentCount} fixed 12×Uint32 records`,
    );
  }
  const derived = buildMetadata(membership, segmentCount, terrain);
  for (let segmentId = 0; segmentId < segmentCount; segmentId += 1) {
    const base = segmentId * 12;
    const expected = derived[segmentId]!;
    if (metadataValues[base] !== expected.minCellId) {
      throw new Error(`Segment metadata minCellId mismatch for Segment ${segmentId}`);
    }
    if (metadataValues[base + 1] !== expected.cellCount) {
      throw new Error(`Segment metadata cellCount mismatch for Segment ${segmentId}`);
    }
    for (let terrainIndex = 0; terrainIndex < TERRAIN_ORDER.length; terrainIndex += 1) {
      const expectedCount = expected.terrainCounts[TERRAIN_ORDER[terrainIndex]!] ?? 0;
      if (metadataValues[base + 2 + terrainIndex] !== expectedCount) {
        throw new Error(
          `Segment metadata terrain count mismatch for Segment ${segmentId}`,
        );
      }
    }
    if (
      segmentId > 0 &&
      derived[segmentId - 1]!.minCellId >= expected.minCellId
    ) {
      throw new Error("Segment metadata violates stable ID ordering by smallest CellId");
    }
  }
  return derived;
}

function validateArtifactAdjacency(
  membership: Uint16Array,
  segmentCount: number,
  width: number,
  height: number,
  offsetValues: Uint32Array,
  adjacencyValues: Uint16Array,
): readonly (readonly SegmentId[])[] {
  if (offsetValues.length !== segmentCount + 1) {
    throw new Error("Segment adjacency offsets length must equal segmentCount + 1");
  }
  if (offsetValues[0] !== 0) {
    throw new Error("Segment adjacency offsets must start at zero");
  }
  for (let index = 1; index < offsetValues.length; index += 1) {
    if (offsetValues[index]! < offsetValues[index - 1]!) {
      throw new Error("Segment adjacency offsets must be monotonic");
    }
  }
  if (offsetValues[segmentCount] !== adjacencyValues.length) {
    throw new Error("Segment adjacency offsets must terminate at adjacency length");
  }
  const decoded = Array.from({ length: segmentCount }, (_, segmentId) => {
    const start = offsetValues[segmentId]!;
    const end = offsetValues[segmentId + 1]!;
    let previous = -1;
    const result: number[] = [];
    for (let index = start; index < end; index += 1) {
      const adjacent = adjacencyValues[index]!;
      if (adjacent >= segmentCount) {
        throw new Error(`Segment adjacency contains invalid SegmentId ${adjacent}`);
      }
      if (adjacent === segmentId) {
        throw new Error(`Segment ${segmentId} cannot be adjacent to itself`);
      }
      if (adjacent <= previous) {
        throw new Error("Segment adjacency entries must be strictly sorted and unique");
      }
      previous = adjacent;
      result.push(adjacent);
    }
    return Object.freeze(result);
  });

  const expected = buildAdjacency(membership, segmentCount, width, height);
  for (let segmentId = 0; segmentId < segmentCount; segmentId += 1) {
    const actual = decoded[segmentId]!;
    const wanted = expected[segmentId]!;
    if (
      actual.length !== wanted.length ||
      actual.some((value, index) => value !== wanted[index])
    ) {
      throw new Error(`Segment adjacency mismatch for Segment ${segmentId}`);
    }
  }
  return Object.freeze(decoded);
}

function runtimeIndexFromData(data: RuntimeData): SegmentRuntimeIndex {
  const membership = data.membership.slice();
  const metadata = Object.freeze(
    data.metadata.map((entry) =>
      Object.freeze({
        minCellId: entry.minCellId,
        cellCount: entry.cellCount,
        terrainCounts: Object.freeze({ ...entry.terrainCounts }),
      }),
    ),
  );
  const adjacency = Object.freeze(
    data.adjacency.map((entry) => Object.freeze([...entry])),
  );
  const { offsets, cells } = buildCellIndex(membership, metadata.length);
  const spans = metadata.map((_, segmentId) => {
    const start = offsets[segmentId]!;
    const end = offsets[segmentId + 1]!;
    return Object.freeze({
      length: end - start,
      at(index: number): CellId {
        if (!Number.isSafeInteger(index) || index < 0 || start + index >= end) {
          throw new Error(`Segment cell index is out of range: ${String(index)}`);
        }
        return cells[start + index]!;
      },
    });
  });

  return Object.freeze({
    generatorVersion: SEGMENT_GENERATOR_VERSION,
    segmentCount: metadata.length,
    segmentIdOf(cellId: CellId): SegmentId {
      assertCellId(cellId, membership.length);
      return membership[cellId]!;
    },
    metadata(segmentId: SegmentId): SegmentMetadata {
      assertSegmentId(segmentId, metadata.length);
      return metadata[segmentId]!;
    },
    cells(segmentId: SegmentId): SegmentCellSpan {
      assertSegmentId(segmentId, metadata.length);
      return spans[segmentId]!;
    },
    adjacentSegmentIds(segmentId: SegmentId): readonly SegmentId[] {
      assertSegmentId(segmentId, metadata.length);
      return adjacency[segmentId]!;
    },
  });
}

export function createSegmentRuntimeIndex(
  compiled: CompiledSegments,
): SegmentRuntimeIndex {
  const adjacency = Object.freeze(
    Array.from({ length: compiled.segmentCount }, (_, segmentId) =>
      Object.freeze([...compiled.adjacentSegmentIds(segmentId)]),
    ),
  );
  return runtimeIndexFromData({
    membership: compiledMembership(compiled),
    metadata: compiled.metadata,
    adjacency,
  });
}

export function materializeSegmentArtifact(input: {
  readonly generatorVersion: number;
  readonly segmentCount: number;
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly TerrainType[];
  readonly membershipBytes: Uint8Array;
  readonly metadataBytes: Uint8Array;
  readonly adjacencyOffsetsBytes: Uint8Array;
  readonly adjacencyBytes: Uint8Array;
}): SegmentRuntimeIndex {
  if (input.generatorVersion !== SEGMENT_GENERATOR_VERSION) {
    throw new Error(
      `segmentGeneratorVersion ${String(input.generatorVersion)} is unsupported`,
    );
  }
  if (
    !Number.isSafeInteger(input.segmentCount) ||
    input.segmentCount <= 0 ||
    input.segmentCount >= SEGMENT_COUNT_LIMIT
  ) {
    throw new Error("segmentCount must be a positive integer below 65,536");
  }
  const cellCount = checkedCellCount(input.width, input.height);
  if (input.terrain.length !== cellCount) {
    throw new Error("Segment artifact terrain length must equal width * height");
  }
  if (input.membershipBytes.byteLength !== cellCount * 2) {
    throw new Error(
      `Segment membership length must be exactly ${cellCount * 2} bytes (Uint16LE per cell)`,
    );
  }
  const membership = decodeUint16(
    input.membershipBytes,
    "Segment membership",
  );
  for (let cellId = 0; cellId < membership.length; cellId += 1) {
    if (membership[cellId]! >= input.segmentCount) {
      throw new Error(
        `Segment membership contains invalid SegmentId ${membership[cellId]} at CellId ${cellId}`,
      );
    }
  }
  validateConnectivity(
    membership,
    input.segmentCount,
    input.width,
    input.height,
  );
  const metadata = validateArtifactMetadata(
    membership,
    input.segmentCount,
    input.terrain,
    decodeUint32(input.metadataBytes, "Segment metadata"),
  );
  const adjacency = validateArtifactAdjacency(
    membership,
    input.segmentCount,
    input.width,
    input.height,
    decodeUint32(input.adjacencyOffsetsBytes, "Segment adjacency offsets"),
    decodeUint16(input.adjacencyBytes, "Segment adjacency"),
  );
  return runtimeIndexFromData({ membership, metadata, adjacency });
}
