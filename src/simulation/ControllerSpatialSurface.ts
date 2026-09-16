import type {
  CellId,
  CellSelector,
  CellsApi,
  CellView,
  ControllerStructureView,
  MapApi,
  QueryPage,
  SegmentId,
  SegmentsApi,
  SegmentView,
  StructureView,
  UnitView,
} from "../core/controller/ControllerApi";
import type { ControllerQuerySession } from "./ControllerQueryProjection";

export interface ControllerSpatialSurface {
  readonly map: MapApi;
  readonly cells: CellsApi;
  readonly segments: SegmentsApi;
  readonly factions: ControllerQuerySession["factions"];
  readonly units: ControllerQuerySession["units"];
  readonly structures: ControllerQuerySession["structures"];
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
  const ownerRefById = new Map(
    (session.publicFactions?.entries ?? []).map((entry) => [
      entry.authoritativeId,
      entry.ref,
    ]),
  );

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

  const projectControllerStructureView = (
    view: ControllerStructureView | undefined,
  ): ControllerStructureView | undefined => {
    if (view === undefined) return undefined;
    const ownerRef = ownerRefById.get(view.ownerId);
    if (ownerRef === undefined) return undefined;
    return Object.freeze({ ...view, ownerId: ownerRef });
  };

  const projectCellView = (view: CellView): CellView => {
    const ownerRef =
      view.ownerId === undefined ? undefined : ownerRefById.get(view.ownerId);
    const structure = projectControllerStructureView(view.structure);
    return Object.freeze({
      id: view.id,
      position: view.position,
      terrain: view.terrain,
      hasFallout: view.hasFallout,
      conquerable: view.conquerable,
      populationBearing: view.populationBearing,
      ...(ownerRef === undefined ? {} : { ownerId: ownerRef }),
      ...(view.segmentId === undefined ? {} : { segmentId: view.segmentId }),
      isCoast: view.isCoast,
      isShoreline: view.isShoreline,
      ...(structure === undefined ? {} : { structure }),
    });
  };

  const projectUnitView = (view: UnitView): UnitView | undefined => {
    const ownerRef = ownerRefById.get(view.ownerId);
    if (ownerRef === undefined) return undefined;
    return Object.freeze({ ...view, ownerId: ownerRef });
  };

  const projectStructureView = (
    view: StructureView,
  ): StructureView | undefined => {
    const ownerRef = ownerRefById.get(view.ownerId);
    if (ownerRef === undefined) return undefined;
    return Object.freeze({ ...view, ownerId: ownerRef });
  };

  const projectSegmentView = (view: SegmentView): SegmentView => {
    const ownerShares: Record<string, number> = {};
    for (const [ownerId, share] of Object.entries(view.ownerShares)) {
      const ownerRef = ownerRefById.get(ownerId);
      if (ownerRef !== undefined) ownerShares[ownerRef] = share;
    }
    return Object.freeze({
      ...view,
      ownerShares: Object.freeze(ownerShares),
    });
  };

  const projectCellPage = (page: QueryPage<CellView>): QueryPage<CellView> =>
    Object.freeze({
      items: Object.freeze(page.items.map(projectCellView)),
      truncated: page.truncated,
    });

  const projectUnitPage = (page: QueryPage<UnitView>): QueryPage<UnitView> =>
    Object.freeze({
      items: Object.freeze(
        page.items.flatMap((view) => {
          const projected = projectUnitView(view);
          return projected === undefined ? [] : [projected];
        }),
      ),
      truncated: page.truncated,
    });

  const projectStructurePage = (
    page: QueryPage<StructureView>,
  ): QueryPage<StructureView> =>
    Object.freeze({
      items: Object.freeze(
        page.items.flatMap((view) => {
          const projected = projectStructureView(view);
          return projected === undefined ? [] : [projected];
        }),
      ),
      truncated: page.truncated,
    });

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
    owner: (id: CellId) => {
      if (!validCellId(id)) return undefined;
      const ownerId = ownership[id] ?? null;
      return ownerId === null ? null : ownerRefById.get(ownerId);
    },
    get: async (id: CellId) => {
      const view = await session.cells.get(id);
      return view === undefined ? undefined : projectCellView(view);
    },
    query: async (selector: CellSelector, limit?: number) =>
      projectCellPage(await session.cells.query(selector, limit)),
    count: (selector: CellSelector) => session.cells.count(selector),
    neighbors: (id: CellId) => session.cells.neighbors(id),
    boundary: async (selector: CellSelector, limit?: number) =>
      projectCellPage(await session.cells.boundary(selector, limit)),
    distance: (a: CellId, b: CellId) => session.cells.distance(a, b),
  });

  const segments: SegmentsApi = Object.freeze({
    get: async (id: SegmentId) => {
      const view = await session.segments.get(id);
      return view === undefined ? undefined : projectSegmentView(view);
    },
    list: async () =>
      Object.freeze((await session.segments.list()).map(projectSegmentView)),
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

  const units: ControllerQuerySession["units"] = Object.freeze({
    get: async (locator) => {
      const view = await session.units.get(locator);
      return view === undefined ? undefined : projectUnitView(view);
    },
    find: async (filter) => projectUnitPage(await session.units.find(filter)),
    count: (filter) => session.units.count(filter),
  });

  const structures: ControllerQuerySession["structures"] = Object.freeze({
    get: async (locator) => {
      const view = await session.structures.get(locator);
      return view === undefined ? undefined : projectStructureView(view);
    },
    find: async (filter) =>
      projectStructurePage(await session.structures.find(filter)),
    count: (filter) => session.structures.count(filter),
    build: (type, cellId) => session.structures.build(type, cellId),
    checkBuild: (type, cellId) => session.structures.checkBuild(type, cellId),
  });

  const surface = {
    map,
    cells,
    segments,
    units,
    structures,
  } as unknown as ControllerSpatialSurface;
  Object.defineProperty(surface, "factions", {
    value: session.factions,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(surface);
}
