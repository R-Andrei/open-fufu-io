import type {
  CellId,
  CellSelector,
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

  const validCellId = (id: CellId): boolean => sourceMap.isValidCellId(id);
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
    isValidCellId: (id: CellId) => validCellId(id),
    cellIdAt: (x: number, y: number) => sourceMap.cellIdAt(x, y),
    positionOf: (id: CellId) =>
      validCellId(id) ? sourceMap.positionOf(id) : undefined,
    terrainAt: (id: CellId) => {
      if (!validCellId(id)) return undefined;
      const terrain = sourceMap.terrainAt(id);
      return terrain === "TEST" ? undefined : terrain;
    },
    segmentIdOf: (id: CellId) =>
      validCellId(id) ? sourceMap.segments?.segmentIdOf(id) : undefined,
    cardinalNeighbors: (id: CellId) =>
      validCellId(id) ? sourceMap.cardinalNeighbors(id) : undefined,
  });

  const cells: CellsApi = Object.freeze({
    owner: (id: CellId) =>
      validCellId(id) ? (ownership[id] ?? null) : undefined,
    get: (id: CellId) => session.cells.get(id),
    query: (selector: CellSelector, limit?: number) =>
      session.cells.query(selector, limit),
    count: (selector: CellSelector) => session.cells.count(selector),
    neighbors: (id: CellId) => session.cells.neighbors(id),
    boundary: (selector: CellSelector, limit?: number) =>
      session.cells.boundary(selector, limit),
    distance: (a: CellId, b: CellId) => session.cells.distance(a, b),
  });

  const segments: SegmentsApi = Object.freeze({
    get: (id: SegmentId) => session.segments.get(id),
    list: () => session.segments.list(),
    cells: (id: SegmentId) => session.segments.cells(id),
    cellIds: (id: SegmentId) => {
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
