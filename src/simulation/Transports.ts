import type { CellId } from "../core/controller/ControllerApi";
import {
  assignMobileUnitRoute,
  createMobileUnit,
  setMobileUnitStrategicDestination,
  type MobileUnitCollectionState,
  type MobileUnitState,
} from "./MobileUnits";
import {
  createNavigation,
  type NavigationCandidate,
  type NavigationPath,
} from "./Navigation";
import type { SimulationMap } from "./SimulationMap";

export interface TransportEndpointRouteRequest {
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  /** Already-lawful land-side embark coast candidates supplied by Transport admission. */
  readonly embarkCoastCellIds: readonly CellId[];
  /** Already-lawful land-side landing coast candidates supplied by Transport admission. */
  readonly landingCoastCellIds: readonly CellId[];
}

export interface TransportEndpointRoute {
  /** Authored strategic source intent; not necessarily a physical water cell. */
  readonly sourceCellId: CellId;
  /** Authored strategic target intent; retained for downstream landing semantics. */
  readonly targetCellId: CellId;
  /** Resolved physical water cell where the Transport materializes. */
  readonly embarkCellId: CellId;
  /** Resolved physical water cell reached immediately before landing resolution. */
  readonly landingCellId: CellId;
  readonly path: NavigationPath;
  readonly objectiveWeight: number;
}

export type TransportEndpointRouteResult =
  | Readonly<{ readonly status: "FOUND"; readonly route: TransportEndpointRoute }>
  | Readonly<{ readonly status: "UNREACHABLE" }>;

export interface TransportMaterializationState extends MobileUnitCollectionState {
  readonly map: SimulationMap;
  readonly factions: readonly Readonly<{ readonly id: string }>[];
  readonly structures: readonly Readonly<{ readonly cellId: CellId }>[];
}

export interface TransportMaterializationRequest {
  readonly ownerId: string;
  readonly route: TransportEndpointRoute;
}

export type TransportMaterializationResult<T extends TransportMaterializationState> =
  | Readonly<{
      readonly ok: true;
      readonly state: T;
      readonly unit: MobileUnitState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly state: T;
      readonly failure: Readonly<{ readonly code: "EMBARK_BLOCKED" }>;
    }>;

function isTransportWater(map: SimulationMap, cellId: CellId): boolean {
  const terrain = map.terrainAt(cellId);
  return terrain === "SHALLOW_WATER" || terrain === "DEEP_WATER";
}

function assertCellId(map: SimulationMap, cellId: CellId, label: string): void {
  if (!map.isValidCellId(cellId)) {
    throw new Error(`${label} CellId is outside the Transport map: ${String(cellId)}`);
  }
}

function manhattanDistance(
  map: SimulationMap,
  from: CellId,
  to: CellId,
): number {
  const fromPosition = map.positionOf(from);
  const toPosition = map.positionOf(to);
  if (fromPosition === undefined || toPosition === undefined) {
    throw new Error("Transport endpoint distance requires valid CellIds");
  }
  const distance =
    Math.abs(fromPosition.x - toPosition.x) +
    Math.abs(fromPosition.y - toPosition.y);
  if (!Number.isSafeInteger(distance)) {
    throw new Error("Transport endpoint distance exceeds safe integer range");
  }
  return distance;
}

function waterSideCandidates(
  map: SimulationMap,
  strategicIntentCellId: CellId,
  coastCellIds: readonly CellId[],
  label: string,
): readonly NavigationCandidate[] {
  if (!Array.isArray(coastCellIds)) {
    throw new Error(`${label} coast candidates must be an array`);
  }

  const candidates: NavigationCandidate[] = [];
  for (let index = 0; index < coastCellIds.length; index += 1) {
    if (!(index in coastCellIds)) {
      throw new Error(`${label} coast candidates must be a dense array`);
    }
    const coastCellId = coastCellIds[index]!;
    assertCellId(map, coastCellId, `${label} coast`);

    for (const neighbor of map.cardinalNeighbors(coastCellId)) {
      if (!isTransportWater(map, neighbor)) continue;
      candidates.push({
        cellId: neighbor,
        intentWeight: manhattanDistance(map, strategicIntentCellId, neighbor),
      });
    }
  }
  return Object.freeze(candidates);
}

function assertResolvedTransportRoute(
  map: SimulationMap,
  route: TransportEndpointRoute,
): void {
  assertCellId(map, route.sourceCellId, "Transport source intent");
  assertCellId(map, route.targetCellId, "Transport target intent");
  assertCellId(map, route.embarkCellId, "Transport embark");
  assertCellId(map, route.landingCellId, "Transport landing");
  if (!Array.isArray(route.path.cells) || route.path.cells.length === 0) {
    throw new Error("resolved Transport path must contain its physical endpoints");
  }
  for (let index = 0; index < route.path.cells.length; index += 1) {
    if (!(index in route.path.cells)) {
      throw new Error("resolved Transport path cells must be dense");
    }
    const cellId = route.path.cells[index]!;
    assertCellId(map, cellId, "Transport route");
    if (!isTransportWater(map, cellId)) {
      throw new Error("resolved Transport path must remain on Shallow/Deep Water");
    }
  }
  if (
    route.path.cells[0] !== route.embarkCellId ||
    route.path.cells[route.path.cells.length - 1] !== route.landingCellId
  ) {
    throw new Error("resolved Transport path endpoints are inconsistent");
  }
  const expectedWeight = route.path.cells.length - 1;
  if (route.path.totalWeight !== expectedWeight) {
    throw new Error("resolved Transport path weight is inconsistent");
  }
}

export function resolveTransportEndpointRoute(
  map: SimulationMap,
  request: TransportEndpointRouteRequest,
): TransportEndpointRouteResult {
  assertCellId(map, request.sourceCellId, "Transport source intent");
  assertCellId(map, request.targetCellId, "Transport target intent");

  const embarkCandidates = waterSideCandidates(
    map,
    request.sourceCellId,
    request.embarkCoastCellIds,
    "embark",
  );
  const landingCandidates = waterSideCandidates(
    map,
    request.targetCellId,
    request.landingCoastCellIds,
    "landing",
  );

  const navigation = createNavigation(map);
  const resolved = navigation.pathBetweenCandidates(
    embarkCandidates,
    landingCandidates,
    {
      traversalWeight(from, to) {
        return isTransportWater(map, from) && isTransportWater(map, to)
          ? 1
          : undefined;
      },
    },
  );

  if (resolved.status === "UNREACHABLE") {
    return Object.freeze({ status: "UNREACHABLE" as const });
  }
  if (resolved.status === "LIMIT_REACHED") {
    throw new Error("unbounded Transport endpoint resolution reached a work limit");
  }

  return Object.freeze({
    status: "FOUND" as const,
    route: Object.freeze({
      sourceCellId: request.sourceCellId,
      targetCellId: request.targetCellId,
      embarkCellId: resolved.route.sourceCellId,
      landingCellId: resolved.route.targetCellId,
      path: resolved.route.path,
      objectiveWeight: resolved.route.objectiveWeight,
    }),
  });
}

export function tryMaterializeTransportAtResolvedRoute<
  T extends TransportMaterializationState,
>(
  state: T,
  request: TransportMaterializationRequest,
): TransportMaterializationResult<T> {
  assertResolvedTransportRoute(state.map, request.route);
  if (
    state.structures.some(
      (structure) => structure.cellId === request.route.embarkCellId,
    ) ||
    state.mobileUnits.some((unit) => unit.cellId === request.route.embarkCellId)
  ) {
    return Object.freeze({
      ok: false as const,
      state,
      failure: Object.freeze({ code: "EMBARK_BLOCKED" as const }),
    });
  }

  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId: request.ownerId,
      type: "TRANSPORT_SHIP",
      movementClass: "TRANSPORT",
      cellId: request.route.embarkCellId,
    },
  );
  const strategic = setMobileUnitStrategicDestination(
    state.map,
    created.unit,
    request.route.targetCellId,
  );
  const routed = assignMobileUnitRoute(state.map, strategic, {
    cells: request.route.path.cells,
    edgeWeights: Array.from(
      { length: Math.max(0, request.route.path.cells.length - 1) },
      () => 1,
    ),
  });
  const mobileUnits = Object.freeze(
    created.mobileUnits.map((unit) => (unit.id === routed.id ? routed : unit)),
  );
  const nextState = Object.freeze({
    ...state,
    mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
  }) as T;

  return Object.freeze({
    ok: true as const,
    state: nextState,
    unit: routed,
  });
}
