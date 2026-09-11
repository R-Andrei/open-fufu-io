import type { CellId } from "../core/controller/ControllerApi";

export const RAIL_CONNECTION_TOP = 0x01 as const;
export const RAIL_CONNECTION_RIGHT = 0x02 as const;
export const RAIL_CONNECTION_BOTTOM = 0x04 as const;
export const RAIL_CONNECTION_LEFT = 0x08 as const;
export const RAIL_CELL_PRESENT = 0x10 as const;

const RAIL_CONNECTION_MASK =
  RAIL_CONNECTION_TOP |
  RAIL_CONNECTION_RIGHT |
  RAIL_CONNECTION_BOTTOM |
  RAIL_CONNECTION_LEFT;
const RAIL_KNOWN_MASK = RAIL_CELL_PRESENT | RAIL_CONNECTION_MASK;
const NO_COMPONENT = -1;
const EMPTY_NEIGHBORS = Object.freeze([]) as readonly CellId[];

export interface RailMapGeometry {
  readonly width: number;
  readonly height: number;
  readonly cellCount: number;
}

export type RailRouteResult =
  | {
      readonly status: "FOUND";
      readonly distanceCells: number;
      readonly cells: readonly CellId[];
    }
  | {
      readonly status: "INVALID_ENDPOINT";
      readonly endpoint: "FROM" | "TO" | "BOTH";
    }
  | { readonly status: "DISCONNECTED" };

export interface RailNetwork {
  isRailCell(cellId: CellId): boolean;
  neighbors(cellId: CellId): readonly CellId[];
  areConnected(left: CellId, right: CellId): boolean;
  componentOf(cellId: CellId): CellId | null;
  shortestRoute(from: CellId, to: CellId): RailRouteResult;
}

export interface FactoryRailStation {
  readonly id: string;
  readonly type: "CITY" | "PORT";
  readonly cellId: CellId;
  readonly active: boolean;
  readonly completedLevel: number | undefined;
}

export interface FactoryGeneratedRailEdge {
  readonly a: CellId;
  readonly b: CellId;
}

export interface FactoryRailLoopPlanningInput {
  readonly factoryId: string;
  readonly width: number;
  readonly height: number;
  readonly outboundPortCellId: CellId;
  readonly inboundPortCellId: CellId;
  readonly influenceCellIds: readonly CellId[];
  readonly railBuildableCellIds: readonly CellId[];
  readonly stations: readonly FactoryRailStation[];
  readonly existingGeneratedEdges: readonly FactoryGeneratedRailEdge[];
}

export interface FactoryRailLoopPlan {
  readonly factoryId: string;
  readonly targetStructureIds: readonly string[];
  readonly servicedStructureIds: readonly string[];
  readonly cells: readonly CellId[];
  readonly sharedExistingEdgeCount: number;
}

export interface GeneratedRailContributor {
  readonly contributorId: string;
  readonly cells: readonly CellId[];
}

export interface GeneratedRailReference {
  readonly a: CellId;
  readonly b: CellId;
  readonly referenceCount: number;
  readonly contributorIds: readonly string[];
}

type Direction = Readonly<{
  bit: number;
  reciprocal: number;
  dx: number;
  dy: number;
}>;

const DIRECTIONS = Object.freeze([
  Object.freeze({
    bit: RAIL_CONNECTION_TOP,
    reciprocal: RAIL_CONNECTION_BOTTOM,
    dx: 0,
    dy: -1,
  }),
  Object.freeze({
    bit: RAIL_CONNECTION_RIGHT,
    reciprocal: RAIL_CONNECTION_LEFT,
    dx: 1,
    dy: 0,
  }),
  Object.freeze({
    bit: RAIL_CONNECTION_BOTTOM,
    reciprocal: RAIL_CONNECTION_TOP,
    dx: 0,
    dy: 1,
  }),
  Object.freeze({
    bit: RAIL_CONNECTION_LEFT,
    reciprocal: RAIL_CONNECTION_RIGHT,
    dx: -1,
    dy: 0,
  }),
] satisfies readonly Direction[]);

function assertGeometry(geometry: RailMapGeometry): void {
  if (!Number.isSafeInteger(geometry.width) || geometry.width <= 0) {
    throw new Error("rail map width must be a positive safe integer");
  }
  if (!Number.isSafeInteger(geometry.height) || geometry.height <= 0) {
    throw new Error("rail map height must be a positive safe integer");
  }
  const expectedCellCount = geometry.width * geometry.height;
  if (
    !Number.isSafeInteger(geometry.cellCount) ||
    geometry.cellCount <= 0 ||
    geometry.cellCount !== expectedCellCount
  ) {
    throw new Error("rail map cellCount must equal width * height");
  }
}

function isValidCellId(geometry: RailMapGeometry, cellId: CellId): boolean {
  return (
    Number.isSafeInteger(cellId) &&
    cellId >= 0 &&
    cellId < geometry.cellCount
  );
}

function neighborForDirection(
  geometry: RailMapGeometry,
  cellId: CellId,
  direction: Direction,
): CellId | undefined {
  const x = cellId % geometry.width;
  const y = Math.floor(cellId / geometry.width);
  const nextX = x + direction.dx;
  const nextY = y + direction.dy;
  if (
    nextX < 0 ||
    nextY < 0 ||
    nextX >= geometry.width ||
    nextY >= geometry.height
  ) {
    return undefined;
  }
  return nextY * geometry.width + nextX;
}

function endpointFailure(
  fromValid: boolean,
  toValid: boolean,
): RailRouteResult | undefined {
  if (fromValid && toValid) return undefined;
  return {
    status: "INVALID_ENDPOINT",
    endpoint: !fromValid && !toValid ? "BOTH" : fromValid ? "TO" : "FROM",
  };
}

function createEmptyRailNetwork(geometry: RailMapGeometry): RailNetwork {
  const isRailCell = (_cellId: CellId): boolean => false;
  const neighbors = (_cellId: CellId): readonly CellId[] => EMPTY_NEIGHBORS;
  const areConnected = (_left: CellId, _right: CellId): boolean => false;
  const componentOf = (_cellId: CellId): CellId | null => null;
  const shortestRoute = (from: CellId, to: CellId): RailRouteResult => {
    const failure = endpointFailure(
      isValidCellId(geometry, from) && isRailCell(from),
      isValidCellId(geometry, to) && isRailCell(to),
    );
    return failure ?? { status: "DISCONNECTED" };
  };
  return Object.freeze({
    isRailCell,
    neighbors,
    areConnected,
    componentOf,
    shortestRoute,
  });
}

export function createRailNetwork(
  geometry: RailMapGeometry,
  rawTopology?: Uint8Array,
): RailNetwork {
  assertGeometry(geometry);
  if (rawTopology === undefined) {
    return createEmptyRailNetwork(geometry);
  }
  if (!(rawTopology instanceof Uint8Array)) {
    throw new Error("rail topology must be a Uint8Array");
  }
  if (rawTopology.byteLength !== geometry.cellCount) {
    throw new Error(
      `rail topology length must equal map cell count ${geometry.cellCount}`,
    );
  }

  const topology = rawTopology.slice();
  for (let cellId = 0; cellId < geometry.cellCount; cellId += 1) {
    const mask = topology[cellId]!;
    if ((mask & ~RAIL_KNOWN_MASK) !== 0) {
      throw new Error(`unsupported rail topology bits at CellId ${cellId}`);
    }
    const connectionBits = mask & RAIL_CONNECTION_MASK;
    if (connectionBits !== 0 && (mask & RAIL_CELL_PRESENT) === 0) {
      throw new Error(
        `rail connections require the source rail cell to be present at CellId ${cellId}`,
      );
    }
    if ((mask & RAIL_CELL_PRESENT) === 0) continue;

    for (const direction of DIRECTIONS) {
      if ((mask & direction.bit) === 0) continue;
      const neighbor = neighborForDirection(geometry, cellId, direction);
      if (neighbor === undefined) {
        throw new Error(
          `rail connection points outside the map at CellId ${cellId}`,
        );
      }
      const neighborMask = topology[neighbor]!;
      if (
        (neighborMask & RAIL_CELL_PRESENT) === 0 ||
        (neighborMask & direction.reciprocal) === 0
      ) {
        throw new Error(
          `rail connection at CellId ${cellId} must have a reciprocal present rail neighbor`,
        );
      }
    }
  }

  const railPresent = (cellId: CellId): boolean =>
    isValidCellId(geometry, cellId) &&
    (topology[cellId]! & RAIL_CELL_PRESENT) !== 0;

  const visitNeighbors = (
    cellId: CellId,
    visitor: (neighbor: CellId) => void,
  ): void => {
    const mask = topology[cellId]!;
    for (const direction of DIRECTIONS) {
      if ((mask & direction.bit) === 0) continue;
      const neighbor = neighborForDirection(geometry, cellId, direction);
      if (neighbor !== undefined) visitor(neighbor);
    }
  };

  const componentIds = new Int32Array(geometry.cellCount);
  componentIds.fill(NO_COMPONENT);
  const queue = new Int32Array(geometry.cellCount);
  for (let start = 0; start < geometry.cellCount; start += 1) {
    if (!railPresent(start) || componentIds[start] !== NO_COMPONENT) continue;
    const componentId = start;
    let read = 0;
    let write = 1;
    queue[0] = start;
    componentIds[start] = componentId;
    while (read < write) {
      const cellId = queue[read++]!;
      visitNeighbors(cellId, (neighbor) => {
        if (componentIds[neighbor] !== NO_COMPONENT) return;
        componentIds[neighbor] = componentId;
        queue[write++] = neighbor;
      });
    }
  }

  const isRailCell = (cellId: CellId): boolean => railPresent(cellId);

  const neighbors = (cellId: CellId): readonly CellId[] => {
    if (!railPresent(cellId)) return EMPTY_NEIGHBORS;
    const result: CellId[] = [];
    visitNeighbors(cellId, (neighbor) => result.push(neighbor));
    return Object.freeze(result);
  };

  const areConnected = (left: CellId, right: CellId): boolean => {
    if (!railPresent(left) || !railPresent(right)) return false;
    let connected = false;
    visitNeighbors(left, (neighbor) => {
      if (neighbor === right) connected = true;
    });
    return connected;
  };

  const componentOf = (cellId: CellId): CellId | null => {
    if (!railPresent(cellId)) return null;
    const componentId = componentIds[cellId]!;
    return componentId === NO_COMPONENT ? null : componentId;
  };

  const shortestRoute = (from: CellId, to: CellId): RailRouteResult => {
    const failure = endpointFailure(railPresent(from), railPresent(to));
    if (failure !== undefined) return failure;
    if (from === to) {
      return {
        status: "FOUND",
        distanceCells: 0,
        cells: Object.freeze([from]),
      };
    }
    if (componentIds[from] !== componentIds[to]) {
      return { status: "DISCONNECTED" };
    }

    const parents = new Map<CellId, CellId>();
    const frontier: CellId[] = [from];
    parents.set(from, from);
    let read = 0;
    while (read < frontier.length) {
      const current = frontier[read++]!;
      let found = false;
      visitNeighbors(current, (neighbor) => {
        if (found || parents.has(neighbor)) return;
        parents.set(neighbor, current);
        if (neighbor === to) {
          found = true;
          return;
        }
        frontier.push(neighbor);
      });
      if (!found) continue;

      const reversePath: CellId[] = [to];
      let cursor = to;
      while (cursor !== from) {
        const parent = parents.get(cursor);
        if (parent === undefined) {
          throw new Error("rail route reconstruction lost a discovered predecessor");
        }
        cursor = parent;
        reversePath.push(cursor);
      }
      reversePath.reverse();
      const cells = Object.freeze(reversePath);
      return {
        status: "FOUND",
        distanceCells: cells.length - 1,
        cells,
      };
    }

    throw new Error("rail component index disagrees with rail route traversal");
  };

  return Object.freeze({
    isRailCell,
    neighbors,
    areConnected,
    componentOf,
    shortestRoute,
  });
}

interface FactoryPathSearchEntry {
  readonly cellId: CellId;
  readonly usedSharedEdge: boolean;
  readonly distance: number;
  readonly sharedEdgeCount: number;
  readonly pathKey: string;
  readonly previous: FactoryPathSearchEntry | undefined;
}

interface FactoryGridPath {
  readonly cells: readonly CellId[];
  readonly distance: number;
  readonly sharedEdgeCount: number;
  readonly pathKey: string;
}

interface FactoryLoopCandidate {
  readonly targetStructureIds: readonly string[];
  readonly cells: readonly CellId[];
  readonly distance: number;
  readonly sharedExistingEdgeCount: number;
  readonly pathKey: string;
}

function normalizedEdgeKey(a: CellId, b: CellId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareStringSequences(
  left: readonly string[],
  right: readonly string[],
): number {
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const compared = compareString(left[index]!, right[index]!);
    if (compared !== 0) return compared;
  }
  return left.length - right.length;
}

function compareSearchEntries(
  left: FactoryPathSearchEntry,
  right: FactoryPathSearchEntry,
): number {
  if (left.distance !== right.distance) return left.distance - right.distance;
  if (left.sharedEdgeCount !== right.sharedEdgeCount) {
    return right.sharedEdgeCount - left.sharedEdgeCount;
  }
  const pathCompared = compareString(left.pathKey, right.pathKey);
  if (pathCompared !== 0) return pathCompared;
  if (left.cellId !== right.cellId) return left.cellId - right.cellId;
  return Number(left.usedSharedEdge) - Number(right.usedSharedEdge);
}

class FactoryPathHeap {
  readonly #entries: FactoryPathSearchEntry[] = [];

  push(entry: FactoryPathSearchEntry): void {
    const entries = this.#entries;
    entries.push(entry);
    let index = entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareSearchEntries(entries[parent]!, entry) <= 0) break;
      entries[index] = entries[parent]!;
      index = parent;
    }
    entries[index] = entry;
  }

  pop(): FactoryPathSearchEntry | undefined {
    const entries = this.#entries;
    if (entries.length === 0) return undefined;
    const root = entries[0]!;
    const tail = entries.pop()!;
    if (entries.length === 0) return root;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= entries.length) break;
      const right = left + 1;
      const child =
        right < entries.length &&
        compareSearchEntries(entries[right]!, entries[left]!) < 0
          ? right
          : left;
      if (compareSearchEntries(tail, entries[child]!) <= 0) break;
      entries[index] = entries[child]!;
      index = child;
    }
    entries[index] = tail;
    return root;
  }
}

function comparePathTuple(
  left: Pick<FactoryPathSearchEntry, "distance" | "sharedEdgeCount" | "pathKey">,
  right: Pick<FactoryPathSearchEntry, "distance" | "sharedEdgeCount" | "pathKey">,
): number {
  if (left.distance !== right.distance) return left.distance - right.distance;
  if (left.sharedEdgeCount !== right.sharedEdgeCount) {
    return right.sharedEdgeCount - left.sharedEdgeCount;
  }
  return compareString(left.pathKey, right.pathKey);
}

function reconstructFactoryPath(entry: FactoryPathSearchEntry): FactoryGridPath {
  const reverseCells: CellId[] = [];
  let cursor: FactoryPathSearchEntry | undefined = entry;
  while (cursor !== undefined) {
    reverseCells.push(cursor.cellId);
    cursor = cursor.previous;
  }
  reverseCells.reverse();
  return Object.freeze({
    cells: Object.freeze(reverseCells),
    distance: entry.distance,
    sharedEdgeCount: entry.sharedEdgeCount,
    pathKey: entry.pathKey,
  });
}

function findFactoryGridPath(
  geometry: RailMapGeometry,
  pathableCells: ReadonlySet<CellId>,
  sharedEdgeKeys: ReadonlySet<string>,
  from: CellId,
  to: CellId,
  requireSharedEdge: boolean,
): FactoryGridPath | null {
  if (!pathableCells.has(from) || !pathableCells.has(to)) return null;
  const initial: FactoryPathSearchEntry = Object.freeze({
    cellId: from,
    usedSharedEdge: false,
    distance: 0,
    sharedEdgeCount: 0,
    pathKey: "",
    previous: undefined,
  });
  const heap = new FactoryPathHeap();
  heap.push(initial);
  const best = new Map<
    string,
    Pick<FactoryPathSearchEntry, "distance" | "sharedEdgeCount" | "pathKey">
  >();
  best.set(`${from}:0`, initial);

  while (true) {
    const current = heap.pop();
    if (current === undefined) return null;
    const currentKey = `${current.cellId}:${current.usedSharedEdge ? 1 : 0}`;
    const recorded = best.get(currentKey);
    if (recorded === undefined || comparePathTuple(current, recorded) !== 0) {
      continue;
    }
    if (
      current.cellId === to &&
      (!requireSharedEdge || current.usedSharedEdge)
    ) {
      return reconstructFactoryPath(current);
    }

    for (let directionIndex = 0; directionIndex < DIRECTIONS.length; directionIndex += 1) {
      const neighbor = neighborForDirection(
        geometry,
        current.cellId,
        DIRECTIONS[directionIndex]!,
      );
      if (neighbor === undefined || !pathableCells.has(neighbor)) continue;
      const shared = sharedEdgeKeys.has(
        normalizedEdgeKey(current.cellId, neighbor),
      );
      const candidate: FactoryPathSearchEntry = Object.freeze({
        cellId: neighbor,
        usedSharedEdge: current.usedSharedEdge || shared,
        distance: current.distance + 1,
        sharedEdgeCount: current.sharedEdgeCount + (shared ? 1 : 0),
        pathKey: `${current.pathKey}${directionIndex}`,
        previous: current,
      });
      const stateKey = `${neighbor}:${candidate.usedSharedEdge ? 1 : 0}`;
      const previousBest = best.get(stateKey);
      if (
        previousBest !== undefined &&
        comparePathTuple(candidate, previousBest) >= 0
      ) {
        continue;
      }
      best.set(stateKey, candidate);
      heap.push(candidate);
    }
  }
}

function isCardinalEdge(
  geometry: RailMapGeometry,
  a: CellId,
  b: CellId,
): boolean {
  if (!isValidCellId(geometry, a) || !isValidCellId(geometry, b)) return false;
  const ax = a % geometry.width;
  const ay = Math.floor(a / geometry.width);
  const bx = b % geometry.width;
  const by = Math.floor(b / geometry.width);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

function countSharedEdges(
  cells: readonly CellId[],
  sharedEdgeKeys: ReadonlySet<string>,
): number {
  const found = new Set<string>();
  for (let index = 1; index < cells.length; index += 1) {
    const key = normalizedEdgeKey(cells[index - 1]!, cells[index]!);
    if (sharedEdgeKeys.has(key)) found.add(key);
  }
  return found.size;
}

function combineFactoryPaths(paths: readonly FactoryGridPath[]): FactoryGridPath {
  if (paths.length === 0) {
    throw new Error("Factory loop candidate requires at least one path leg");
  }
  const cells: CellId[] = [];
  let distance = 0;
  let sharedEdgeCount = 0;
  let pathKey = "";
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index]!;
    cells.push(...(index === 0 ? path.cells : path.cells.slice(1)));
    distance += path.distance;
    sharedEdgeCount += path.sharedEdgeCount;
    pathKey += path.pathKey;
  }
  return Object.freeze({
    cells: Object.freeze(cells),
    distance,
    sharedEdgeCount,
    pathKey,
  });
}

function compareLoopCandidates(
  left: FactoryLoopCandidate,
  right: FactoryLoopCandidate,
): number {
  if (left.distance !== right.distance) return left.distance - right.distance;
  if (left.sharedExistingEdgeCount !== right.sharedExistingEdgeCount) {
    return right.sharedExistingEdgeCount - left.sharedExistingEdgeCount;
  }
  const targetsCompared = compareStringSequences(
    left.targetStructureIds,
    right.targetStructureIds,
  );
  if (targetsCompared !== 0) return targetsCompared;
  return compareString(left.pathKey, right.pathKey);
}

function enumerateOrderedSelections<T>(
  values: readonly T[],
  count: number,
  visitor: (selection: readonly T[]) => void,
): void {
  const selected: T[] = [];
  const used = new Array<boolean>(values.length).fill(false);
  const visit = (): void => {
    if (selected.length === count) {
      visitor(selected.slice());
      return;
    }
    for (let index = 0; index < values.length; index += 1) {
      if (used[index]) continue;
      used[index] = true;
      selected.push(values[index]!);
      visit();
      selected.pop();
      used[index] = false;
    }
  };
  visit();
}

function servicedStationIds(
  eligibleStations: readonly FactoryRailStation[],
  cells: readonly CellId[],
): readonly string[] {
  const firstIndex = new Map<CellId, number>();
  for (let index = 0; index < cells.length; index += 1) {
    if (!firstIndex.has(cells[index]!)) firstIndex.set(cells[index]!, index);
  }
  return Object.freeze(
    eligibleStations
      .filter((station) => firstIndex.has(station.cellId))
      .slice()
      .sort((left, right) => {
        const indexDifference =
          firstIndex.get(left.cellId)! - firstIndex.get(right.cellId)!;
        return indexDifference !== 0
          ? indexDifference
          : compareString(left.id, right.id);
      })
      .map((station) => station.id),
  );
}

export function planFactoryRailLoop(
  input: FactoryRailLoopPlanningInput,
): FactoryRailLoopPlan | null {
  const geometry: RailMapGeometry = Object.freeze({
    width: input.width,
    height: input.height,
    cellCount: input.width * input.height,
  });
  assertGeometry(geometry);

  const influenceCells = new Set<CellId>();
  for (const cellId of input.influenceCellIds) {
    if (!isValidCellId(geometry, cellId)) {
      throw new Error(`Factory influence contains invalid CellId ${cellId}`);
    }
    influenceCells.add(cellId);
  }
  const pathableCells = new Set<CellId>();
  for (const cellId of input.railBuildableCellIds) {
    if (!isValidCellId(geometry, cellId)) {
      throw new Error(`Factory rail-buildable set contains invalid CellId ${cellId}`);
    }
    pathableCells.add(cellId);
  }

  const eligibleStations = input.stations
    .filter(
      (station) =>
        station.active &&
        Number.isSafeInteger(station.completedLevel) &&
        station.completedLevel !== undefined &&
        station.completedLevel >= 1 &&
        influenceCells.has(station.cellId),
    )
    .slice()
    .sort((left, right) => compareString(left.id, right.id));
  if (eligibleStations.length === 0) return null;

  const seenStationIds = new Set<string>();
  for (const station of eligibleStations) {
    if (!isValidCellId(geometry, station.cellId)) {
      throw new Error(`Factory station ${station.id} has invalid CellId`);
    }
    if (seenStationIds.has(station.id)) {
      throw new Error(`Factory station ID must be unique: ${station.id}`);
    }
    seenStationIds.add(station.id);
  }

  const sharedEdgeKeys = new Set<string>();
  for (const edge of input.existingGeneratedEdges) {
    if (
      isCardinalEdge(geometry, edge.a, edge.b) &&
      pathableCells.has(edge.a) &&
      pathableCells.has(edge.b) &&
      influenceCells.has(edge.a) &&
      influenceCells.has(edge.b)
    ) {
      sharedEdgeKeys.add(normalizedEdgeKey(edge.a, edge.b));
    }
  }

  const pathCache = new Map<string, FactoryGridPath | null>();
  const pathFor = (
    from: CellId,
    to: CellId,
    requireShared: boolean,
  ): FactoryGridPath | null => {
    const key = `${from}>${to}:${requireShared ? 1 : 0}`;
    if (pathCache.has(key)) return pathCache.get(key)!;
    const path = findFactoryGridPath(
      geometry,
      pathableCells,
      sharedEdgeKeys,
      from,
      to,
      requireShared,
    );
    pathCache.set(key, path);
    return path;
  };

  let bestIndependent: FactoryLoopCandidate | undefined;
  let bestIntersecting: FactoryLoopCandidate | undefined;
  const targetCount = Math.min(5, eligibleStations.length);

  enumerateOrderedSelections(eligibleStations, targetCount, (targets) => {
    const waypoints: CellId[] = [
      input.outboundPortCellId,
      ...targets.map((station) => station.cellId),
      input.inboundPortCellId,
    ];
    const ordinaryLegs: FactoryGridPath[] = [];
    const sharedLegs: (FactoryGridPath | null)[] = [];
    for (let index = 1; index < waypoints.length; index += 1) {
      const from = waypoints[index - 1]!;
      const to = waypoints[index]!;
      const ordinary = pathFor(from, to, false);
      if (ordinary === null) return;
      ordinaryLegs.push(ordinary);
      sharedLegs.push(
        sharedEdgeKeys.size === 0 ? null : pathFor(from, to, true),
      );
    }

    const targetStructureIds = Object.freeze(targets.map((station) => station.id));
    const ordinaryRoute = combineFactoryPaths(ordinaryLegs);
    const ordinaryCandidate: FactoryLoopCandidate = Object.freeze({
      targetStructureIds,
      cells: ordinaryRoute.cells,
      distance: ordinaryRoute.distance,
      sharedExistingEdgeCount: countSharedEdges(
        ordinaryRoute.cells,
        sharedEdgeKeys,
      ),
      pathKey: ordinaryRoute.pathKey,
    });
    if (
      bestIndependent === undefined ||
      compareLoopCandidates(ordinaryCandidate, bestIndependent) < 0
    ) {
      bestIndependent = ordinaryCandidate;
    }
    if (ordinaryCandidate.sharedExistingEdgeCount > 0) {
      if (
        bestIntersecting === undefined ||
        compareLoopCandidates(ordinaryCandidate, bestIntersecting) < 0
      ) {
        bestIntersecting = ordinaryCandidate;
      }
      return;
    }

    for (let forcedLeg = 0; forcedLeg < sharedLegs.length; forcedLeg += 1) {
      const sharedLeg = sharedLegs[forcedLeg];
      if (sharedLeg === null) continue;
      const legs = ordinaryLegs.slice();
      legs[forcedLeg] = sharedLeg;
      const route = combineFactoryPaths(legs);
      const candidate: FactoryLoopCandidate = Object.freeze({
        targetStructureIds,
        cells: route.cells,
        distance: route.distance,
        sharedExistingEdgeCount: countSharedEdges(route.cells, sharedEdgeKeys),
        pathKey: route.pathKey,
      });
      if (candidate.sharedExistingEdgeCount === 0) continue;
      if (
        bestIntersecting === undefined ||
        compareLoopCandidates(candidate, bestIntersecting) < 0
      ) {
        bestIntersecting = candidate;
      }
    }
  });

  const selected = bestIntersecting ?? bestIndependent;
  if (selected === undefined) return null;
  return Object.freeze({
    factoryId: input.factoryId,
    targetStructureIds: selected.targetStructureIds,
    servicedStructureIds: servicedStationIds(eligibleStations, selected.cells),
    cells: selected.cells,
    sharedExistingEdgeCount: selected.sharedExistingEdgeCount,
  });
}

export function shouldRegenerateFactoryRailLoop(input: {
  readonly currentLoopCells: readonly CellId[];
  readonly currentServicedStructureIds: readonly string[];
  readonly newStationCellId: CellId;
}): boolean {
  if (input.currentLoopCells.includes(input.newStationCellId)) return false;
  return input.currentServicedStructureIds.length < 5;
}

export function collectGeneratedRailReferences(
  contributors: readonly GeneratedRailContributor[],
): readonly GeneratedRailReference[] {
  const edgeContributors = new Map<string, { a: CellId; b: CellId; ids: Set<string> }>();
  for (const contributor of contributors) {
    const contributedEdges = new Set<string>();
    for (let index = 1; index < contributor.cells.length; index += 1) {
      const left = contributor.cells[index - 1]!;
      const right = contributor.cells[index]!;
      if (left === right) continue;
      const key = normalizedEdgeKey(left, right);
      if (contributedEdges.has(key)) continue;
      contributedEdges.add(key);
      let entry = edgeContributors.get(key);
      if (entry === undefined) {
        entry = {
          a: Math.min(left, right),
          b: Math.max(left, right),
          ids: new Set<string>(),
        };
        edgeContributors.set(key, entry);
      }
      entry.ids.add(contributor.contributorId);
    }
  }

  return Object.freeze(
    [...edgeContributors.values()]
      .sort((left, right) => left.a - right.a || left.b - right.b)
      .map((entry) => {
        const contributorIds = Object.freeze([...entry.ids].sort(compareString));
        return Object.freeze({
          a: entry.a,
          b: entry.b,
          referenceCount: contributorIds.length,
          contributorIds,
        });
      }),
  );
}
