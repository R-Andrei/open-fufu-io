import type { CellId } from "../core/controller/ControllerApi";
import {
  assignMobileUnitRoute,
  createMobileUnit,
  removeMobileUnit,
  setMobileUnitStrategicDestination,
  type MobileUnitCollectionState,
  type MobileUnitState,
} from "./MobileUnits";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  createNavigation,
  type NavigationCandidate,
  type NavigationPath,
} from "./Navigation";
import type { SimulationMap } from "./SimulationMap";
import { tryMaterializeStructureGrant } from "./Structures";

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

export interface SuccessfulTransportLandingConsequencesRequest {
  readonly transportId: string;
  /** Deterministic Structure identity supplied by the owning landing lifecycle. */
  readonly fortStructureId: string;
}

export type SuccessfulTransportLandingConsequencesResult =
  | Readonly<{
      readonly status: "LANDED";
      readonly state: MatchState;
    }>
  | Readonly<{
      readonly status: "FORT_GRANTED";
      readonly state: MatchState;
    }>
  | Readonly<{
      readonly status: "SKIP_GRANT_KEEP_LANDING";
      readonly state: MatchState;
      readonly grantFailure: Readonly<{ readonly code: string }>;
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
  blockedCellIds: ReadonlySet<CellId>,
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
      if (!isTransportWater(map, neighbor) || blockedCellIds.has(neighbor)) continue;
      candidates.push({
        cellId: neighbor,
        intentWeight: manhattanDistance(map, strategicIntentCellId, neighbor),
      });
    }
  }
  return Object.freeze(candidates);
}

function physicalOccupancyCellIds(
  state: Pick<TransportMaterializationState, "structures" | "mobileUnits">,
): ReadonlySet<CellId> {
  return new Set<CellId>([
    ...state.structures.map((structure) => structure.cellId),
    ...state.mobileUnits.map((unit) => unit.cellId),
  ]);
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

function resolveTransportEndpointRouteWithBlockedCells(
  map: SimulationMap,
  request: TransportEndpointRouteRequest,
  blockedCellIds: ReadonlySet<CellId>,
): TransportEndpointRouteResult {
  assertCellId(map, request.sourceCellId, "Transport source intent");
  assertCellId(map, request.targetCellId, "Transport target intent");

  const embarkCandidates = waterSideCandidates(
    map,
    request.sourceCellId,
    request.embarkCoastCellIds,
    "embark",
    blockedCellIds,
  );
  const landingCandidates = waterSideCandidates(
    map,
    request.targetCellId,
    request.landingCoastCellIds,
    "landing",
    blockedCellIds,
  );

  const navigation = createNavigation(map);
  const resolved = navigation.pathBetweenCandidates(
    embarkCandidates,
    landingCandidates,
    {
      traversalWeight(from, to) {
        return isTransportWater(map, from) &&
          isTransportWater(map, to) &&
          !blockedCellIds.has(from) &&
          !blockedCellIds.has(to)
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

export function resolveTransportEndpointRoute(
  map: SimulationMap,
  request: TransportEndpointRouteRequest,
): TransportEndpointRouteResult {
  return resolveTransportEndpointRouteWithBlockedCells(map, request, new Set<CellId>());
}

export function resolveTransportEndpointRouteForState(
  state: TransportMaterializationState,
  request: TransportEndpointRouteRequest,
): TransportEndpointRouteResult {
  return resolveTransportEndpointRouteWithBlockedCells(
    state.map,
    request,
    physicalOccupancyCellIds(state),
  );
}

export function tryMaterializeTransportAtResolvedRoute<
  T extends TransportMaterializationState,
>(
  state: T,
  request: TransportMaterializationRequest,
): TransportMaterializationResult<T> {
  assertResolvedTransportRoute(state.map, request.route);
  if (physicalOccupancyCellIds(state).has(request.route.embarkCellId)) {
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

export function applySuccessfulTransportLandingConsequences(
  state: MatchState,
  request: SuccessfulTransportLandingConsequencesRequest,
): SuccessfulTransportLandingConsequencesResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.transportId !== "string" ||
    request.transportId.length === 0 ||
    typeof request.fortStructureId !== "string" ||
    request.fortStructureId.length === 0
  ) {
    throw new Error("successful Transport landing consequence request is malformed");
  }

  const transport = state.mobileUnits.find((unit) => unit.id === request.transportId);
  if (
    transport === undefined ||
    transport.type !== "TRANSPORT_SHIP" ||
    transport.strategicDestinationCellId === undefined
  ) {
    throw new Error("successful Transport landing consequence requires an active Transport");
  }
  const landingCellId = transport.strategicDestinationCellId;
  if ((state.ownership[landingCellId] ?? null) !== transport.ownerId) {
    throw new Error("successful Transport landing consequence requires established authored-target ownership");
  }

  const remaining = removeMobileUnit(
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    transport.id,
  );
  const landedState = createProspectiveMatchState(state, {
    mobileUnits: remaining.mobileUnits,
    nextMobileUnitOrdinal: remaining.nextMobileUnitOrdinal,
  });

  const owner = landedState.factions.find((faction) => faction.id === transport.ownerId);
  const grantsLandingFort = owner?.rules.customDomains.some(
    (entry) => entry.domain === "LANDING_FORT_GRANT",
  ) ?? false;
  if (!grantsLandingFort) {
    return Object.freeze({ status: "LANDED" as const, state: landedState });
  }

  const grant = tryMaterializeStructureGrant(landedState, {
    structureId: request.fortStructureId,
    ownerId: transport.ownerId,
    type: "FORT",
    cellId: landingCellId,
    level: 1,
  });
  if (!grant.ok) {
    return Object.freeze({
      status: "SKIP_GRANT_KEEP_LANDING" as const,
      state: landedState,
      grantFailure: grant.failure,
    });
  }

  return Object.freeze({
    status: "FORT_GRANTED" as const,
    state: createProspectiveMatchState(landedState, {
      structures: grant.structures,
    }),
  });
}
