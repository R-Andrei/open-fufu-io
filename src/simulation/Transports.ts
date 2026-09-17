import type { CellId } from "../core/controller/ControllerApi";
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
