import type {
  CellsApi,
  MapApi,
  SegmentId,
  SegmentsApi,
} from "../core/controller/ControllerApi";
import type { ControllerQuerySession } from "./ControllerQueryProjection";

export interface ControllerSpatialSurface {
  readonly map: MapApi;
  readonly cells: CellsApi;
  readonly segments: SegmentsApi;
}

/**
 * Builds the same lawful public spatial shape used by the production worker for
 * trusted in-process hosts, mechanics tests, and Official AI.
 */
export function createControllerSpatialSurface(
  session: ControllerQuerySession,
): ControllerSpatialSurface {
  const sourceMap = session.publicSpatial.map;
  const ownership = session.publicSpatial.ownership;

  const validCellId = (id: number): boolean => sourceMap.isValidCellId(id);
  const validSegmentId = (id: SegmentId): boolean => {
    const segments = sourceMap.segments;
    return (
      segments !== undefined &&
      Number.isSafeInteger(id) &&
      id >= 0 &&
      id < segments.segmentCount
    );
  };

  const map: MapApi = Object.freeze({
    width: sourceMap.width,
    height: sourceMap.height,
    cellCount: sourceMap.cellCount,
    isValidCellId: (id) => validCellId(id),
    cellIdAt: (x, y) => sourceMap.cellIdAt(x, y),
    positionOf: (id) =>
      validCellId(id) ? sourceMap.positionOf(id) : undefined,
    terrainAt: (id) => {
      if (!validCellId(id)) return undefined;
      const terrain = sourceMap.terrainAt(id);
      return terrain === "TEST" ? undefined : terrain;
    },
    segmentIdOf: (id) =>
      validCellId(id) ? sourceMap.segments?.segmentIdOf(id) : undefined,
    cardinalNeighbors: (id) =>
      validCellId(id) ? sourceMap.cardinalNeighbors(id) : undefined,
  });

  const cells: CellsApi = Object.freeze({
    owner: (id) => (validCellId(id) ? (ownership[id] ?? null) : undefined),
    get: (id) => session.cells.get(id),
    query: (selector, limit) => session.cells.query(selector, limit),
    count: (selector) => session.cells.count(selector),
    neighbors: (id) => session.cells.neighbors(id),
    boundary: (selector, limit) => session.cells.boundary(selector, limit),
    distance: (a, b) => session.cells.distance(a, b),
  });

  const segments: SegmentsApi = Object.freeze({
    get: (id) => session.segments.get(id),
    list: () => session.segments.list(),
    cells: (id) => session.segments.cells(id),
    cellIds: (id) => {
      const sourceSegments = sourceMap.segments;
      if (sourceSegments === undefined || !validSegmentId(id)) return undefined;
      const span = sourceSegments.cells(id);
      return Object.freeze(
        Array.from({ length: span.length }, (_, index) => span.at(index)),
      );
    },
  });

  return Object.freeze({ map, cells, segments });
}
