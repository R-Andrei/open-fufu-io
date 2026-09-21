import type { CellId } from "../core/controller/ControllerApi";
import {
  reducedRational,
  ruleScopeMatches,
  type RuleScope,
} from "../core/rules/RuleComposition";
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
  type TransportDestructionCauseClass,
  type TransportDestructionResult,
  type TransportExactHealth,
  type TransportOperationalState,
} from "./MatchState";
import {
  createNavigation,
  type NavigationCandidate,
  type NavigationPath,
} from "./Navigation";
import { removePopulation } from "./Population";
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
  /** Population already committed to the aggregate TRANSPORT bucket by admission. */
  readonly carriedPopulation: number;
}

export type TransportMaterializationResult =
  | Readonly<{
      readonly ok: true;
      readonly state: MatchState;
      readonly unit: MobileUnitState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly state: MatchState;
      readonly failure: Readonly<{ readonly code: "EMBARK_BLOCKED" }>;
    }>;

export interface TransportDamageRequest {
  readonly transportId: string;
  readonly damage: Readonly<{ readonly numerator: bigint; readonly denominator: bigint }>;
  readonly causeClass: TransportDestructionCauseClass;
  readonly creditedDestroyerFactionId?: string;
}

export interface TransportDamageResolution {
  readonly state: MatchState;
  readonly destructionResult: TransportDestructionResult | null;
}

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

function assertTransportPopulation(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new Error("Transport carried Population must be a non-negative safe integer");
  }
}

function effectiveTransportHealth(
  state: MatchState,
  ownerId: string,
): TransportExactHealth | undefined {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown Transport owner: ${ownerId}`);
  const scope = {
    kind: "UNIT" as const,
    unit: "TRANSPORT_SHIP" as const,
  } satisfies RuleScope;
  const chassisTerms = owner.rules.normalizedRules.filter(
    (entry) =>
      entry.axis === "UNIT_CHASSIS_PROFILE" &&
      ruleScopeMatches(entry.scope, scope),
  );
  if (chassisTerms.length === 0) return undefined;
  if (chassisTerms.length !== 1) {
    throw new Error("Transport chassis profile must resolve to at most one transform");
  }
  const term = chassisTerms[0]!;
  if (term.conditions !== undefined && term.conditions.length > 0) {
    throw new Error("Transport chassis profile has unresolved conditions");
  }
  if (
    term.value.kind !== "SINGLETON" ||
    typeof term.value.value !== "string"
  ) {
    throw new Error("Transport chassis profile must be a singleton profile ID");
  }
  if (term.value.value === "ARMORED_PORT_TRANSPORT") {
    return Object.freeze({ numerator: 500n, denominator: 1n });
  }
  if (term.value.value === "TRANSPORT_SHIP") return undefined;
  throw new Error(
    `unsupported Transport chassis profile: ${String(term.value.value)}`,
  );
}

function ownerBoundTransportPopulation(state: MatchState, ownerId: string): number {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  return state.transportOperationalStates.reduce((sum, entry) => {
    const unit = unitsById.get(entry.unitId);
    return unit?.ownerId === ownerId ? sum + entry.carriedPopulation : sum;
  }, 0);
}

export function tryMaterializeTransportAtResolvedRoute(
  state: MatchState,
  request: TransportMaterializationRequest,
): TransportMaterializationResult {
  assertResolvedTransportRoute(state.map, request.route);
  assertTransportPopulation(request.carriedPopulation);
  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) {
    throw new Error(`unknown Transport owner: ${request.ownerId}`);
  }
  const alreadyBound = ownerBoundTransportPopulation(state, request.ownerId);
  if (
    request.carriedPopulation >
    owner.population.aboardTransports - alreadyBound
  ) {
    throw new Error(
      "Transport carried Population exceeds the owner's committed aboard amount",
    );
  }
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
  const health = effectiveTransportHealth(state, request.ownerId);
  const operational: TransportOperationalState = Object.freeze({
    unitId: routed.id,
    carriedPopulation: request.carriedPopulation,
    ...(health === undefined ? {} : { health }),
  });
  const nextState = createProspectiveMatchState(state, {
    mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    transportOperationalStates: Object.freeze([
      ...state.transportOperationalStates,
      operational,
    ]),
  });

  return Object.freeze({
    ok: true as const,
    state: nextState,
    unit: routed,
  });
}

function subtractTransportHealth(
  health: TransportExactHealth,
  damage: TransportDamageRequest["damage"],
): TransportExactHealth {
  const reduced = reducedRational(
    health.numerator * damage.denominator -
      damage.numerator * health.denominator,
    health.denominator * damage.denominator,
  );
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

const TRANSPORT_DESTRUCTION_CAUSE_CLASSES =
  new Set<TransportDestructionCauseClass>([
    "NAVAL_GUNFIRE",
    "SAM_ANTI_SHIP",
    "STRATEGIC_BLAST",
    "OTHER_HOSTILE_EFFECT",
    "UNATTRIBUTED",
  ]);

export function applyTransportDamage(
  state: MatchState,
  request: TransportDamageRequest,
): TransportDamageResolution {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.transportId !== "string" ||
    request.transportId.length === 0 ||
    request.damage === null ||
    typeof request.damage !== "object" ||
    typeof request.damage.numerator !== "bigint" ||
    typeof request.damage.denominator !== "bigint" ||
    request.damage.numerator <= 0n ||
    request.damage.denominator <= 0n ||
    !TRANSPORT_DESTRUCTION_CAUSE_CLASSES.has(request.causeClass) ||
    (request.creditedDestroyerFactionId !== undefined &&
      (typeof request.creditedDestroyerFactionId !== "string" ||
        request.creditedDestroyerFactionId.length === 0))
  ) {
    throw new Error("Transport damage request is malformed");
  }
  if (
    request.creditedDestroyerFactionId !== undefined &&
    !state.factions.some(
      (faction) => faction.id === request.creditedDestroyerFactionId,
    )
  ) {
    throw new Error("Transport credited destroyer faction is unknown");
  }

  const transport = state.mobileUnits.find(
    (unit) => unit.id === request.transportId,
  );
  if (transport === undefined) {
    return Object.freeze({ state, destructionResult: null });
  }
  if (transport.type !== "TRANSPORT_SHIP") {
    throw new Error("Transport damage target is not a Transport");
  }
  const operational = state.transportOperationalStates.find(
    (entry) => entry.unitId === transport.id,
  );
  if (operational === undefined) {
    throw new Error(
      `active Transport is missing operational payload state: ${transport.id}`,
    );
  }

  if (operational.health !== undefined) {
    const health = subtractTransportHealth(operational.health, request.damage);
    if (health.numerator > 0n) {
      return Object.freeze({
        state: createProspectiveMatchState(state, {
          transportOperationalStates: state.transportOperationalStates.map(
            (entry) =>
              entry.unitId === transport.id
                ? Object.freeze({ ...entry, health })
                : entry,
          ),
        }),
        destructionResult: null,
      });
    }
  }

  const ownerIndex = state.factions.findIndex(
    (faction) => faction.id === transport.ownerId,
  );
  if (ownerIndex < 0) {
    throw new Error(`Transport owner is missing: ${transport.ownerId}`);
  }
  const owner = state.factions[ownerIndex]!;
  const population = removePopulation(
    owner.population,
    "TRANSPORT",
    operational.carriedPopulation,
  );
  const factions = state.factions.map((faction, index) =>
    index === ownerIndex ? Object.freeze({ ...faction, population }) : faction,
  );
  const remaining = removeMobileUnit(
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    transport.id,
  );
  const destructionResult: TransportDestructionResult = Object.freeze({
    transportId: transport.id,
    previousOwnerFactionId: transport.ownerId,
    destructionTick: state.tick,
    carriedPopulationAtDestruction: operational.carriedPopulation,
    ...(request.creditedDestroyerFactionId === undefined
      ? {}
      : { creditedDestroyerFactionId: request.creditedDestroyerFactionId }),
    causeClass: request.causeClass,
  });
  const nextState = createProspectiveMatchState(state, {
    factions,
    mobileUnits: remaining.mobileUnits,
    nextMobileUnitOrdinal: remaining.nextMobileUnitOrdinal,
    transportOperationalStates: state.transportOperationalStates.filter(
      (entry) => entry.unitId !== transport.id,
    ),
    transportDestructionResults: Object.freeze([
      ...state.transportDestructionResults,
      destructionResult,
    ]),
  });
  return Object.freeze({
    state: nextState,
    destructionResult,
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
    transportOperationalStates: state.transportOperationalStates.filter(
      (entry) => entry.unitId !== transport.id,
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
