import type { CellId } from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  materializeCompiledScalarRule,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import {
  assignMobileUnitRoute,
  createMobileUnit,
  removeMobileUnit,
  setMobileUnitStrategicDestination,
  type MobileUnitCollectionState,
  type MobileUnitState,
} from "./MobileUnits";
import { tryDebitFfy } from "./Economy";
import {
  landTerrainBaseSpec,
  isLandSideCoastTerrain,
} from "./LandOperationsCore";
import {
  createProspectiveMatchState,
  type MatchState,
  type TransportOperationState,
} from "./MatchState";
import {
  createNavigation,
  type NavigationCandidate,
  type NavigationPath,
} from "./Navigation";
import { repartitionPopulation } from "./Population";
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

function routeAroundTransientOccupancy(
  state: TransportMaterializationState,
  route: TransportEndpointRoute,
): TransportEndpointRoute {
  const blockedCellIds = physicalOccupancyCellIds(state);
  if (blockedCellIds.size === 0) return route;

  const navigation = createNavigation(state.map);
  const replanned = navigation.path(
    route.embarkCellId,
    route.landingCellId,
    {
      traversalWeight(from, to) {
        if (!isTransportWater(state.map, from) || !isTransportWater(state.map, to)) {
          return undefined;
        }
        const blocksFrom =
          blockedCellIds.has(from) &&
          from !== route.embarkCellId &&
          from !== route.landingCellId;
        const blocksTo =
          blockedCellIds.has(to) &&
          to !== route.embarkCellId &&
          to !== route.landingCellId;
        return blocksFrom || blocksTo ? undefined : 1;
      },
    },
  );

  if (replanned.status !== "FOUND") {
    // Endpoint identity is stable. If occupancy currently blocks every path,
    // retain the selected route and let ordinary movement/materialization wait.
    return route;
  }

  return Object.freeze({
    ...route,
    path: replanned.path,
  });
}

export function resolveTransportEndpointRouteForState(
  state: TransportMaterializationState,
  request: TransportEndpointRouteRequest,
): TransportEndpointRouteResult {
  const resolved = resolveTransportEndpointRoute(state.map, request);
  if (resolved.status !== "FOUND") return resolved;
  return Object.freeze({
    status: "FOUND" as const,
    route: routeAroundTransientOccupancy(state, resolved.route),
  });
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

export type TransportEmbarkFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "OWNER_INACTIVE"
  | "INVALID_SOURCE"
  | "SOURCE_NOT_OWNED"
  | "INVALID_TARGET"
  | "OWNERSHIP_CAP"
  | "INSUFFICIENT_AVAILABLE_POPULATION"
  | "INSUFFICIENT_FFY"
  | "UNREACHABLE"
  | "EMBARK_BLOCKED";

export interface TransportEmbarkRequest {
  readonly ownerId: string;
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly population: number;
}

export type TransportEmbarkQuoteResult =
  | Readonly<{
      readonly ok: true;
      readonly ffyCost: number;
      readonly route: TransportEndpointRoute;
    }>
  | Readonly<{
      readonly ok: false;
      readonly ffyCost: number;
      readonly failure: Readonly<{ readonly code: TransportEmbarkFailureCode }>;
    }>;

export type TransportEmbarkCommitResult =
  | Readonly<{
      readonly ok: true;
      readonly state: MatchState;
      readonly unit: MobileUnitState;
      readonly route: TransportEndpointRoute;
      readonly ffyCost: number;
    }>
  | Readonly<{
      readonly ok: false;
      readonly state: MatchState;
      readonly ffyCost: number;
      readonly failure: Readonly<{ readonly code: TransportEmbarkFailureCode }>;
    }>;

export type TransportRecallFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "OWNER_INACTIVE"
  | "UNKNOWN_TRANSPORT"
  | "NOT_OWNER"
  | "NOT_ACTIVE_OPERATION"
  | "NO_RETURN_ROUTE";

export interface TransportRecallRequest {
  readonly ownerId: string;
  readonly transportId: string;
}

export type TransportRecallResult =
  | Readonly<{
      readonly ok: true;
      readonly state: MatchState;
      readonly unit: MobileUnitState;
      readonly operation: TransportOperationState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly state: MatchState;
      readonly failure: Readonly<{ readonly code: TransportRecallFailureCode }>;
    }>;

const BASE_TRANSPORT_EMBARK_FFY_COST = 0;
const MAX_ACTIVE_TRANSPORTS_PER_FACTION = 3;

function transportRuleDynamicState(
  state: MatchState,
  ownerId: string,
): RuleDynamicState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`unknown Transport owner: ${ownerId}`);
  }

  const contacted = new Set<string>();
  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    if ((state.ownership[cellId] ?? null) !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwnerId = state.ownership[neighbor] ?? null;
      if (neighborOwnerId !== null && neighborOwnerId !== ownerId) {
        contacted.add(neighborOwnerId);
      }
    }
  }

  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: contacted.size,
    peakTotalPopulation: owner.population.peakTotal,
  });
}

function effectiveTransportEmbarkFfyCost(
  state: MatchState,
  ownerId: string,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`unknown Transport owner: ${ownerId}`);
  }
  const cost = materializeCompiledScalarRule(
    BASE_TRANSPORT_EMBARK_FFY_COST,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "TRANSPORT_EMBARK_COST",
    { kind: "GLOBAL" },
    transportRuleDynamicState(state, ownerId),
  );
  if (!Number.isSafeInteger(cost) || cost < 0) {
    throw new Error("effective Transport embark FFY cost must be a non-negative safe integer");
  }
  return cost;
}

function isTransportLand(map: SimulationMap, cellId: CellId): boolean {
  const terrain = map.terrainAt(cellId);
  return !isTransportWater(map, cellId) && landTerrainBaseSpec(terrain).landTraversable;
}

function landSideCoastsInPoliticalComponent(
  state: MatchState,
  strategicIntentCellId: CellId,
  ownerId: string | null,
): readonly CellId[] {
  if (
    !state.map.isValidCellId(strategicIntentCellId) ||
    (state.ownership[strategicIntentCellId] ?? null) !== ownerId ||
    !isTransportLand(state.map, strategicIntentCellId)
  ) {
    return Object.freeze([]);
  }

  const seen = new Set<CellId>([strategicIntentCellId]);
  const queue: CellId[] = [strategicIntentCellId];
  const coasts: CellId[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const cellId = queue[index]!;
    const terrain = state.map.terrainAt(cellId);
    const neighbors = state.map.cardinalNeighbors(cellId);
    if (
      isLandSideCoastTerrain(
        terrain,
        neighbors.map((neighbor) => state.map.terrainAt(neighbor)),
      )
    ) {
      coasts.push(cellId);
    }
    for (const neighbor of neighbors) {
      if (
        seen.has(neighbor) ||
        (state.ownership[neighbor] ?? null) !== ownerId ||
        !isTransportLand(state.map, neighbor)
      ) {
        continue;
      }
      seen.add(neighbor);
      queue.push(neighbor);
    }
  }
  coasts.sort((left, right) => left - right);
  return Object.freeze(coasts);
}

function embarkFailure(
  ffyCost: number,
  code: TransportEmbarkFailureCode,
): TransportEmbarkQuoteResult {
  return Object.freeze({
    ok: false as const,
    ffyCost,
    failure: Object.freeze({ code }),
  });
}

export function quoteTransportEmbark(
  state: MatchState,
  request: TransportEmbarkRequest,
): TransportEmbarkQuoteResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    !Number.isSafeInteger(request.sourceCellId) ||
    !Number.isSafeInteger(request.targetCellId) ||
    !Number.isSafeInteger(request.population) ||
    request.population <= 0
  ) {
    return embarkFailure(0, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return embarkFailure(0, "UNKNOWN_OWNER");
  const ffyCost = effectiveTransportEmbarkFfyCost(state, request.ownerId);
  if (owner.status !== "ACTIVE") return embarkFailure(ffyCost, "OWNER_INACTIVE");

  if (!state.map.isValidCellId(request.sourceCellId)) {
    return embarkFailure(ffyCost, "INVALID_SOURCE");
  }
  if ((state.ownership[request.sourceCellId] ?? null) !== request.ownerId) {
    return embarkFailure(ffyCost, "SOURCE_NOT_OWNED");
  }
  const embarkCoastCellIds = landSideCoastsInPoliticalComponent(
    state,
    request.sourceCellId,
    request.ownerId,
  );
  if (embarkCoastCellIds.length === 0) {
    return embarkFailure(ffyCost, "INVALID_SOURCE");
  }

  if (!state.map.isValidCellId(request.targetCellId)) {
    return embarkFailure(ffyCost, "INVALID_TARGET");
  }
  const targetOwnerId = state.ownership[request.targetCellId] ?? null;
  const landingCoastCellIds = landSideCoastsInPoliticalComponent(
    state,
    request.targetCellId,
    targetOwnerId,
  );
  if (landingCoastCellIds.length === 0) {
    return embarkFailure(ffyCost, "INVALID_TARGET");
  }

  const activeTransportCount = state.mobileUnits.filter(
    (unit) =>
      unit.ownerId === request.ownerId && unit.type === "TRANSPORT_SHIP",
  ).length;
  if (activeTransportCount >= MAX_ACTIVE_TRANSPORTS_PER_FACTION) {
    return embarkFailure(ffyCost, "OWNERSHIP_CAP");
  }
  if (owner.population.available < request.population) {
    return embarkFailure(ffyCost, "INSUFFICIENT_AVAILABLE_POPULATION");
  }
  const debit = tryDebitFfy(owner.ffy, {
    numerator: BigInt(ffyCost),
    denominator: 1n,
  });
  if (!debit.ok) return embarkFailure(ffyCost, "INSUFFICIENT_FFY");

  const resolved = resolveTransportEndpointRouteForState(state, {
    sourceCellId: request.sourceCellId,
    targetCellId: request.targetCellId,
    embarkCoastCellIds,
    landingCoastCellIds,
  });
  if (resolved.status !== "FOUND") {
    return embarkFailure(ffyCost, "UNREACHABLE");
  }
  if (physicalOccupancyCellIds(state).has(resolved.route.embarkCellId)) {
    return embarkFailure(ffyCost, "EMBARK_BLOCKED");
  }
  return Object.freeze({
    ok: true as const,
    ffyCost,
    route: resolved.route,
  });
}

export function tryCommitTransportEmbark(
  state: MatchState,
  request: TransportEmbarkRequest,
): TransportEmbarkCommitResult {
  const quoted = quoteTransportEmbark(state, request);
  if (!quoted.ok) {
    return Object.freeze({
      ok: false as const,
      state,
      ffyCost: quoted.ffyCost,
      failure: quoted.failure,
    });
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId)!;
  const debit = tryDebitFfy(owner.ffy, {
    numerator: BigInt(quoted.ffyCost),
    denominator: 1n,
  });
  if (!debit.ok) {
    return Object.freeze({
      ok: false as const,
      state,
      ffyCost: quoted.ffyCost,
      failure: Object.freeze({ code: "INSUFFICIENT_FFY" as const }),
    });
  }
  const population = repartitionPopulation(
    owner.population,
    "AVAILABLE",
    "TRANSPORT",
    request.population,
  );
  const funded = createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === owner.id
        ? Object.freeze({
            ...faction,
            ffy: debit.balance,
            population,
          })
        : faction,
    ),
  });
  const materialized = tryMaterializeTransportAtResolvedRoute(funded, {
    ownerId: request.ownerId,
    route: quoted.route,
  });
  if (!materialized.ok) {
    return Object.freeze({
      ok: false as const,
      state,
      ffyCost: quoted.ffyCost,
      failure: Object.freeze({ code: "EMBARK_BLOCKED" as const }),
    });
  }

  const operation: TransportOperationState = Object.freeze({
    unitId: materialized.unit.id,
    sourceCellId: request.sourceCellId,
    targetCellId: request.targetCellId,
    embarkCellId: quoted.route.embarkCellId,
    landingCellId: quoted.route.landingCellId,
    carriedPopulation: request.population,
    phase: "OUTBOUND" as const,
  });
  const nextState = createProspectiveMatchState(materialized.state, {
    transportOperations: Object.freeze([
      ...(state.transportOperations ?? []),
      operation,
    ]),
  });
  return Object.freeze({
    ok: true as const,
    state: nextState,
    unit: materialized.unit,
    route: quoted.route,
    ffyCost: quoted.ffyCost,
  });
}

interface TransportReturnRoute {
  readonly returnWaterCellId: CellId;
  readonly returnCoastCellId: CellId;
  readonly path: NavigationPath;
}

function resolveTransportReturnRoute(
  state: MatchState,
  ownerId: string,
  currentCellId: CellId,
): TransportReturnRoute | undefined {
  if (!state.map.isValidCellId(currentCellId) || !isTransportWater(state.map, currentCellId)) {
    return undefined;
  }
  const navigation = createNavigation(state.map);
  let selected: TransportReturnRoute | undefined;

  for (let coastCellId = 0; coastCellId < state.map.cellCount; coastCellId += 1) {
    if ((state.ownership[coastCellId] ?? null) !== ownerId) continue;
    const neighbors = state.map.cardinalNeighbors(coastCellId);
    if (
      !isLandSideCoastTerrain(
        state.map.terrainAt(coastCellId),
        neighbors.map((neighbor) => state.map.terrainAt(neighbor)),
      )
    ) {
      continue;
    }

    for (const returnWaterCellId of neighbors) {
      if (!isTransportWater(state.map, returnWaterCellId)) continue;
      const resolved = navigation.path(currentCellId, returnWaterCellId, {
        traversalWeight(from, to) {
          return isTransportWater(state.map, from) &&
            isTransportWater(state.map, to)
            ? 1
            : undefined;
        },
      });
      if (resolved.status !== "FOUND") continue;
      const candidate: TransportReturnRoute = Object.freeze({
        returnWaterCellId,
        returnCoastCellId: coastCellId,
        path: resolved.path,
      });
      if (
        selected === undefined ||
        candidate.path.totalWeight < selected.path.totalWeight ||
        (candidate.path.totalWeight === selected.path.totalWeight &&
          (candidate.returnWaterCellId < selected.returnWaterCellId ||
            (candidate.returnWaterCellId === selected.returnWaterCellId &&
              candidate.returnCoastCellId < selected.returnCoastCellId)))
      ) {
        selected = candidate;
      }
    }
  }
  return selected;
}

function recallFailure(
  state: MatchState,
  code: TransportRecallFailureCode,
): TransportRecallResult {
  return Object.freeze({
    ok: false as const,
    state,
    failure: Object.freeze({ code }),
  });
}

export function tryStartTransportRecall(
  state: MatchState,
  request: TransportRecallRequest,
): TransportRecallResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.transportId !== "string" ||
    request.transportId.length === 0
  ) {
    return recallFailure(state, "INVALID_REQUEST");
  }
  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return recallFailure(state, "UNKNOWN_OWNER");
  if (owner.status !== "ACTIVE") return recallFailure(state, "OWNER_INACTIVE");

  const unit = state.mobileUnits.find(
    (candidate) =>
      candidate.id === request.transportId &&
      candidate.type === "TRANSPORT_SHIP",
  );
  if (unit === undefined) return recallFailure(state, "UNKNOWN_TRANSPORT");
  if (unit.ownerId !== request.ownerId) return recallFailure(state, "NOT_OWNER");

  const operation = (state.transportOperations ?? []).find(
    (candidate) => candidate.unitId === unit.id,
  );
  if (operation === undefined || operation.phase !== "OUTBOUND") {
    return recallFailure(state, "NOT_ACTIVE_OPERATION");
  }
  const route = resolveTransportReturnRoute(state, request.ownerId, unit.cellId);
  if (route === undefined) return recallFailure(state, "NO_RETURN_ROUTE");

  const cleared = setMobileUnitStrategicDestination(state.map, unit, undefined);
  const routed = assignMobileUnitRoute(state.map, cleared, {
    cells: route.path.cells,
    edgeWeights: Array.from(
      { length: Math.max(0, route.path.cells.length - 1) },
      () => 1,
    ),
  });
  const returningOperation: TransportOperationState = Object.freeze({
    ...operation,
    phase: "RETURNING" as const,
    returnWaterCellId: route.returnWaterCellId,
    returnCoastCellId: route.returnCoastCellId,
  });
  const nextState = createProspectiveMatchState(state, {
    mobileUnits: state.mobileUnits.map((candidate) =>
      candidate.id === routed.id ? routed : candidate,
    ),
    transportOperations: (state.transportOperations ?? []).map((candidate) =>
      candidate.unitId === returningOperation.unitId
        ? returningOperation
        : candidate,
    ),
  });
  return Object.freeze({
    ok: true as const,
    state: nextState,
    unit: routed,
    operation: returningOperation,
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
    transportOperations: (state.transportOperations ?? []).filter(
      (operation) => operation.unitId !== transport.id,
    ),
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
