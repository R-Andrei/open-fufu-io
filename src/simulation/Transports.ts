import type { CellId } from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  conditionEligibleRuleTerms,
  materializeCompiledCapRule,
  materializeCompiledScalarRule,
  resolvedRuleTermsForScope,
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
import { isLandSideCoastTerrain } from "./LandOperations";
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

export interface TransportEmbarkAdmissionRequest {
  readonly ownerId: string;
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly population: number;
}

export type TransportEmbarkAdmissionFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "INVALID_SOURCE"
  | "INVALID_TARGET"
  | "UNREACHABLE"
  | "OWNERSHIP_CAP"
  | "INSUFFICIENT_FFY"
  | "INSUFFICIENT_POPULATION";

export type TransportEmbarkAdmissionResult =
  | Readonly<{
      readonly ok: true;
      readonly route: TransportEndpointRoute;
      readonly ffyCost: number;
      readonly ownershipCap: number;
    }>
  | Readonly<{
      readonly ok: false;
      readonly ffyCost: number;
      readonly ownershipCap: number;
      readonly failure: Readonly<{
        readonly code: TransportEmbarkAdmissionFailureCode;
      }>;
    }>;

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

const BASELINE_ACTIVE_TRANSPORT_CAP = 3;

function transportTerritorialContactCount(
  state: MatchState,
  ownerId: string,
): number {
  const active = new Set(
    state.factions
      .filter((faction) => faction.status === "ACTIVE")
      .map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < state.ownership.length; cellId += 1) {
    if (state.ownership[cellId] !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwner = state.ownership[neighbor] ?? null;
      if (
        neighborOwner !== null &&
        neighborOwner !== ownerId &&
        active.has(neighborOwner)
      ) {
        contacts.add(neighborOwner);
      }
    }
  }
  return contacts.size;
}

function transportRuleDynamicState(
  state: MatchState,
  ownerId: string,
): RuleDynamicState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: transportTerritorialContactCount(state, ownerId),
    peakTotalPopulation: owner.population.peakTotal,
  });
}

function effectiveTransportOwnershipCap(
  state: MatchState,
  ownerId: string,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const cap = materializeCompiledCapRule(
    BASELINE_ACTIVE_TRANSPORT_CAP,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "UNIT_OWNERSHIP_CAP",
    { kind: "UNIT", unit: "TRANSPORT_SHIP" },
    transportRuleDynamicState(state, ownerId),
  );
  if (!Number.isSafeInteger(cap) || cap < 0 || Object.is(cap, -0)) {
    throw new Error("Transport ownership cap must resolve to a non-negative safe integer");
  }
  return cap;
}

function effectiveTransportEmbarkCost(
  state: MatchState,
  ownerId: string,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const cost = materializeCompiledScalarRule(
    0,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "TRANSPORT_EMBARK_COST",
    { kind: "GLOBAL" },
    transportRuleDynamicState(state, ownerId),
  );
  if (!Number.isSafeInteger(cost) || cost < 0 || Object.is(cost, -0)) {
    throw new Error("Transport embark FFY cost must resolve to a non-negative safe integer");
  }
  return cost;
}

function transportRequiresActivePortSource(
  state: MatchState,
  ownerId: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_CHASSIS_PROFILE",
      { kind: "UNIT", unit: "TRANSPORT_SHIP" },
      transportRuleDynamicState(state, ownerId),
    ),
  );
  if (terms.length === 0) return false;
  if (terms.length !== 1) {
    throw new Error("Transport chassis profile must resolve to at most one transform");
  }
  const value = terms[0]?.value;
  if (value?.kind !== "SINGLETON" || value.value !== "ARMORED_PORT_TRANSPORT") {
    throw new Error("Transport chassis profile resolved to an unsupported profile");
  }
  return true;
}

function isTransportWater(map: SimulationMap, cellId: CellId): boolean {
  const terrain = map.terrainAt(cellId);
  return terrain === "SHALLOW_WATER" || terrain === "DEEP_WATER";
}

function isTransportCoast(state: MatchState, cellId: CellId): boolean {
  return isLandSideCoastTerrain(
    state.map.terrainAt(cellId),
    state.map
      .cardinalNeighbors(cellId)
      .map((neighbor) => state.map.terrainAt(neighbor)),
  );
}

function transportEmbarkCoastCandidates(
  state: MatchState,
  ownerId: string,
): readonly CellId[] {
  const requiresPort = transportRequiresActivePortSource(state, ownerId);
  const activePortCells = requiresPort
    ? new Set(
        state.structures
          .filter(
            (structure) =>
              structure.ownerId === ownerId &&
              structure.type === "PORT" &&
              structure.active &&
              structure.completedLevel !== undefined,
          )
          .map((structure) => structure.cellId),
      )
    : undefined;
  const candidates: CellId[] = [];
  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    if (state.ownership[cellId] !== ownerId || !isTransportCoast(state, cellId)) {
      continue;
    }
    if (activePortCells !== undefined && !activePortCells.has(cellId)) continue;
    candidates.push(cellId);
  }
  return Object.freeze(candidates);
}

function transportLandingCoastCandidates(state: MatchState): readonly CellId[] {
  const candidates: CellId[] = [];
  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    if (isTransportCoast(state, cellId)) candidates.push(cellId);
  }
  return Object.freeze(candidates);
}

function transportAdmissionFailure(
  ffyCost: number,
  ownershipCap: number,
  code: TransportEmbarkAdmissionFailureCode,
): TransportEmbarkAdmissionResult {
  return Object.freeze({
    ok: false as const,
    ffyCost,
    ownershipCap,
    failure: Object.freeze({ code }),
  });
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

export function resolveTransportEmbarkAdmission(
  state: MatchState,
  request: TransportEmbarkAdmissionRequest,
): TransportEmbarkAdmissionResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    !Number.isSafeInteger(request.sourceCellId) ||
    !Number.isSafeInteger(request.targetCellId) ||
    !Number.isSafeInteger(request.population) ||
    request.population < 0 ||
    Object.is(request.population, -0)
  ) {
    return transportAdmissionFailure(0, BASELINE_ACTIVE_TRANSPORT_CAP, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) {
    return transportAdmissionFailure(0, BASELINE_ACTIVE_TRANSPORT_CAP, "UNKNOWN_OWNER");
  }

  const ownershipCap = effectiveTransportOwnershipCap(state, request.ownerId);
  const ffyCost = effectiveTransportEmbarkCost(state, request.ownerId);
  if (
    !state.map.isValidCellId(request.sourceCellId)
  ) {
    return transportAdmissionFailure(ffyCost, ownershipCap, "INVALID_SOURCE");
  }
  if (!state.map.isValidCellId(request.targetCellId)) {
    return transportAdmissionFailure(ffyCost, ownershipCap, "INVALID_TARGET");
  }

  const embarkCoastCellIds = transportEmbarkCoastCandidates(state, request.ownerId);
  if (embarkCoastCellIds.length === 0) {
    return transportAdmissionFailure(ffyCost, ownershipCap, "INVALID_SOURCE");
  }
  const landingCoastCellIds = transportLandingCoastCandidates(state);
  if (landingCoastCellIds.length === 0) {
    return transportAdmissionFailure(ffyCost, ownershipCap, "INVALID_TARGET");
  }

  const resolved = resolveTransportEndpointRouteForState(state, {
    sourceCellId: request.sourceCellId,
    targetCellId: request.targetCellId,
    embarkCoastCellIds,
    landingCoastCellIds,
  });
  if (resolved.status !== "FOUND") {
    return transportAdmissionFailure(ffyCost, ownershipCap, "UNREACHABLE");
  }

  const activeCount = state.mobileUnits.filter(
    (unit) =>
      unit.ownerId === request.ownerId && unit.type === "TRANSPORT_SHIP",
  ).length;
  if (activeCount + 1 > ownershipCap) {
    return transportAdmissionFailure(ffyCost, ownershipCap, "OWNERSHIP_CAP");
  }
  if (owner.ffy < ffyCost) {
    return transportAdmissionFailure(ffyCost, ownershipCap, "INSUFFICIENT_FFY");
  }
  if (owner.population.available < request.population) {
    return transportAdmissionFailure(
      ffyCost,
      ownershipCap,
      "INSUFFICIENT_POPULATION",
    );
  }

  return Object.freeze({
    ok: true as const,
    route: resolved.route,
    ffyCost,
    ownershipCap,
  });
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
