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
