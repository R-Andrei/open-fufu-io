import type {
  CellId,
  FactionId,
  MobileUnitType,
  MovementClass,
  UnitId,
} from "../core/controller/ControllerApi";
import type { SimulationMap } from "./SimulationMap";

const MOBILE_UNIT_TYPES = new Set<MobileUnitType>([
  "TANK",
  "HEAVY_ARTILLERY",
  "WARSHIP",
  "TRANSPORT_SHIP",
  "TRADE_SHIP",
  "TRAIN",
]);

const MOVEMENT_CLASSES = new Set<MovementClass>([
  "LAND",
  "TANK",
  "HEAVY_ARTILLERY",
  "NAVAL",
  "TRANSPORT",
  "RAIL",
]);

const UNIT_ID_PREFIX = "unit:";
const UNIT_ID_WIDTH = String(Number.MAX_SAFE_INTEGER).length;
const EMPTY_UNITS = Object.freeze([]) as readonly MobileUnitState[];

export interface MobileUnitRouteInput {
  readonly cells: readonly CellId[];
  /** Positive safe-integer work required to traverse each corresponding edge. */
  readonly edgeWeights: readonly number[];
}

export interface MobileUnitRouteState {
  readonly destinationCellId: CellId;
  readonly cells: readonly CellId[];
  readonly edgeWeights: readonly number[];
  /** Index of the next cell to enter; current cell is `cells[nextCellIndex - 1]`. */
  readonly nextCellIndex: number;
  /** Safe-integer work already accumulated toward the next edge. */
  readonly edgeProgress: number;
}

export interface MobileUnitState {
  readonly id: UnitId;
  readonly ownerId: FactionId;
  readonly type: MobileUnitType;
  readonly movementClass: MovementClass;
  readonly cellId: CellId;
  readonly route?: MobileUnitRouteState;
}

export interface MobileUnitCollectionState {
  readonly mobileUnits: readonly MobileUnitState[];
  readonly nextMobileUnitOrdinal: number;
}

export interface CreateMobileUnitInput {
  readonly ownerId: FactionId;
  readonly type: MobileUnitType;
  readonly movementClass: MovementClass;
  readonly cellId: CellId;
}

export interface MobileUnitCreateResult extends MobileUnitCollectionState {
  readonly unit: MobileUnitState;
}

export interface MobileUnitAdvanceResult {
  readonly unit: MobileUnitState;
  readonly unusedWork: number;
}

export interface MobileUnitProjectionSource {
  readonly id: UnitId;
  readonly ownerId: FactionId;
  readonly type: MobileUnitType;
  readonly movementClass: MovementClass;
  readonly cellId: CellId;
  readonly movementDestinationCellId?: CellId;
}

export interface MobileUnitSpatialIndex {
  get(id: UnitId): MobileUnitState | undefined;
  ownedBy(ownerId: FactionId): readonly MobileUnitState[];
  atCell(cellId: CellId): readonly MobileUnitState[];
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertCanonicalNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function mobileUnitId(ordinal: number): UnitId {
  assertCanonicalNonNegativeSafeInteger(ordinal, "mobile-unit ordinal");
  return `${UNIT_ID_PREFIX}${String(ordinal).padStart(UNIT_ID_WIDTH, "0")}`;
}

function parseMobileUnitOrdinal(id: UnitId): number {
  if (typeof id !== "string" || !id.startsWith(UNIT_ID_PREFIX)) {
    throw new Error("mobile-unit identity is malformed");
  }
  const digits = id.slice(UNIT_ID_PREFIX.length);
  if (digits.length !== UNIT_ID_WIDTH || !/^\d+$/.test(digits)) {
    throw new Error("mobile-unit identity is malformed");
  }
  const ordinal = Number(digits);
  if (!Number.isSafeInteger(ordinal) || mobileUnitId(ordinal) !== id) {
    throw new Error("mobile-unit identity is malformed");
  }
  return ordinal;
}

function assertKnownOwner(ownerIds: ReadonlySet<FactionId>, ownerId: FactionId): void {
  if (typeof ownerId !== "string" || !ownerIds.has(ownerId)) {
    throw new Error(`mobile-unit owner is not present in MatchState: ${String(ownerId)}`);
  }
}

function assertKnownUnitType(type: MobileUnitType): void {
  if (!MOBILE_UNIT_TYPES.has(type)) {
    throw new Error(`unknown mobile unit type: ${String(type)}`);
  }
}

function assertKnownMovementClass(movementClass: MovementClass): void {
  if (!MOVEMENT_CLASSES.has(movementClass)) {
    throw new Error(`unknown mobile-unit movement class: ${String(movementClass)}`);
  }
}

function assertCellId(map: SimulationMap, cellId: CellId): void {
  if (Object.is(cellId, -0) || !map.isValidCellId(cellId)) {
    throw new Error(`CellId is outside the mobile-unit map: ${String(cellId)}`);
  }
}

function isCardinalTransition(map: SimulationMap, from: CellId, to: CellId): boolean {
  return map.cardinalNeighbors(from).includes(to);
}

function materializeRoute(
  map: SimulationMap,
  currentCellId: CellId,
  route: MobileUnitRouteState,
): MobileUnitRouteState {
  if (route === null || typeof route !== "object" || Array.isArray(route)) {
    throw new Error("mobile-unit route must be an object");
  }
  if (!Array.isArray(route.cells) || !Array.isArray(route.edgeWeights)) {
    throw new Error("mobile-unit route cells and edge weights must be arrays");
  }
  if (route.cells.length < 2) {
    throw new Error("active mobile-unit route must contain at least two cells");
  }
  if (route.edgeWeights.length !== route.cells.length - 1) {
    throw new Error("mobile-unit route edge weight count must equal cells - 1");
  }

  for (const cellId of route.cells) assertCellId(map, cellId);
  for (let index = 0; index < route.edgeWeights.length; index += 1) {
    assertPositiveSafeInteger(route.edgeWeights[index]!, "mobile-unit route edge weight");
    if (!isCardinalTransition(map, route.cells[index]!, route.cells[index + 1]!)) {
      throw new Error("mobile-unit route must use cardinal map transitions");
    }
  }

  if (route.destinationCellId !== route.cells[route.cells.length - 1]) {
    throw new Error("mobile-unit route destination must equal its final cell");
  }
  if (
    !Number.isSafeInteger(route.nextCellIndex) ||
    route.nextCellIndex < 1 ||
    route.nextCellIndex >= route.cells.length
  ) {
    throw new Error("mobile-unit route nextCellIndex is invalid");
  }
  if (route.cells[route.nextCellIndex - 1] !== currentCellId) {
    throw new Error("mobile-unit route current cell does not match route progress");
  }
  assertCanonicalNonNegativeSafeInteger(route.edgeProgress, "mobile-unit route progress");
  if (route.edgeProgress >= route.edgeWeights[route.nextCellIndex - 1]!) {
    throw new Error("mobile-unit route progress must be below the current edge weight");
  }

  if (
    Object.isFrozen(route) &&
    Object.isFrozen(route.cells) &&
    Object.isFrozen(route.edgeWeights)
  ) {
    return route;
  }

  return Object.freeze({
    destinationCellId: route.destinationCellId,
    cells: Object.freeze([...route.cells]),
    edgeWeights: Object.freeze([...route.edgeWeights]),
    nextCellIndex: route.nextCellIndex,
    edgeProgress: route.edgeProgress,
  });
}

function materializeUnit(
  map: SimulationMap,
  ownerIds: ReadonlySet<FactionId>,
  unit: MobileUnitState,
): MobileUnitState {
  if (unit === null || typeof unit !== "object" || Array.isArray(unit)) {
    throw new Error("mobile-unit state must be an object");
  }
  parseMobileUnitOrdinal(unit.id);
  assertKnownOwner(ownerIds, unit.ownerId);
  assertKnownUnitType(unit.type);
  assertKnownMovementClass(unit.movementClass);
  assertCellId(map, unit.cellId);
  const route = unit.route === undefined ? undefined : materializeRoute(map, unit.cellId, unit.route);

  if (Object.isFrozen(unit) && (route === undefined || route === unit.route)) {
    return unit;
  }

  return Object.freeze({
    id: unit.id,
    ownerId: unit.ownerId,
    type: unit.type,
    movementClass: unit.movementClass,
    cellId: unit.cellId,
    ...(route === undefined ? {} : { route }),
  });
}

export function materializeMobileUnitCollection(
  map: SimulationMap,
  ownerIds: readonly FactionId[],
  state: MobileUnitCollectionState,
): MobileUnitCollectionState {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("mobile-unit collection state must be an object");
  }
  if (!Array.isArray(state.mobileUnits)) {
    throw new Error("mobileUnits must be an array");
  }
  assertCanonicalNonNegativeSafeInteger(
    state.nextMobileUnitOrdinal,
    "next mobile-unit ordinal",
  );

  const knownOwners = new Set(ownerIds);
  const seenIds = new Set<UnitId>();
  const units = state.mobileUnits.map((unit) => {
    const materialized = materializeUnit(map, knownOwners, unit);
    if (seenIds.has(materialized.id)) {
      throw new Error(`duplicate mobile-unit identity: ${materialized.id}`);
    }
    seenIds.add(materialized.id);
    const ordinal = parseMobileUnitOrdinal(materialized.id);
    if (ordinal >= state.nextMobileUnitOrdinal) {
      throw new Error("next mobile-unit ordinal must exceed every allocated unit identity");
    }
    return materialized;
  });

  units.sort((left, right) => compareIds(left.id, right.id));
  return Object.freeze({
    mobileUnits: units.length === 0 ? EMPTY_UNITS : Object.freeze(units),
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  });
}

export function createMobileUnit(
  map: SimulationMap,
  ownerIds: readonly FactionId[],
  state: MobileUnitCollectionState,
  input: CreateMobileUnitInput,
): MobileUnitCreateResult {
  const current = materializeMobileUnitCollection(map, ownerIds, state);
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("mobile-unit creation input must be an object");
  }

  const knownOwners = new Set(ownerIds);
  assertKnownOwner(knownOwners, input.ownerId);
  assertKnownUnitType(input.type);
  assertKnownMovementClass(input.movementClass);
  assertCellId(map, input.cellId);

  const ordinal = current.nextMobileUnitOrdinal;
  if (ordinal >= Number.MAX_SAFE_INTEGER) {
    throw new Error("mobile-unit ordinal allocator is exhausted");
  }
  const unit = Object.freeze({
    id: mobileUnitId(ordinal),
    ownerId: input.ownerId,
    type: input.type,
    movementClass: input.movementClass,
    cellId: input.cellId,
  });
  const mobileUnits = [...current.mobileUnits, unit].sort((left, right) =>
    compareIds(left.id, right.id),
  );

  return Object.freeze({
    mobileUnits: Object.freeze(mobileUnits),
    nextMobileUnitOrdinal: ordinal + 1,
    unit,
  });
}

export function removeMobileUnit(
  state: MobileUnitCollectionState,
  id: UnitId,
): MobileUnitCollectionState {
  assertCanonicalNonNegativeSafeInteger(
    state.nextMobileUnitOrdinal,
    "next mobile-unit ordinal",
  );
  parseMobileUnitOrdinal(id);
  const remaining = state.mobileUnits.filter((unit) => unit.id !== id);
  if (remaining.length === state.mobileUnits.length) {
    return Object.freeze({
      mobileUnits: Object.isFrozen(state.mobileUnits)
        ? state.mobileUnits
        : Object.freeze([...state.mobileUnits]),
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    });
  }
  return Object.freeze({
    mobileUnits: remaining.length === 0 ? EMPTY_UNITS : Object.freeze(remaining),
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  });
}

export function assignMobileUnitRoute(
  map: SimulationMap,
  unit: MobileUnitState,
  input: MobileUnitRouteInput,
): MobileUnitState {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("mobile-unit route input must be an object");
  }
  if (!Array.isArray(input.cells) || !Array.isArray(input.edgeWeights)) {
    throw new Error("mobile-unit route cells and edge weights must be arrays");
  }
  if (input.cells.length === 0) {
    throw new Error("mobile-unit route must contain the current cell");
  }
  if (input.cells[0] !== unit.cellId) {
    throw new Error("mobile-unit route must begin at the unit current cell");
  }
  if (input.edgeWeights.length !== input.cells.length - 1) {
    throw new Error("mobile-unit route edge weight count must equal cells - 1");
  }

  for (const cellId of input.cells) assertCellId(map, cellId);
  for (let index = 0; index < input.edgeWeights.length; index += 1) {
    assertPositiveSafeInteger(input.edgeWeights[index]!, "mobile-unit route edge weight");
    if (!isCardinalTransition(map, input.cells[index]!, input.cells[index + 1]!)) {
      throw new Error("mobile-unit route must use cardinal map transitions");
    }
  }

  if (input.cells.length === 1) {
    return Object.freeze({
      id: unit.id,
      ownerId: unit.ownerId,
      type: unit.type,
      movementClass: unit.movementClass,
      cellId: unit.cellId,
    });
  }

  return Object.freeze({
    id: unit.id,
    ownerId: unit.ownerId,
    type: unit.type,
    movementClass: unit.movementClass,
    cellId: unit.cellId,
    route: Object.freeze({
      destinationCellId: input.cells[input.cells.length - 1]!,
      cells: Object.freeze([...input.cells]),
      edgeWeights: Object.freeze([...input.edgeWeights]),
      nextCellIndex: 1,
      edgeProgress: 0,
    }),
  });
}

function assertAdvanceableRoute(unit: MobileUnitState): MobileUnitRouteState | undefined {
  const route = unit.route;
  if (route === undefined) return undefined;
  if (!Array.isArray(route.cells) || !Array.isArray(route.edgeWeights)) {
    throw new Error("mobile-unit route state is malformed");
  }
  if (
    route.cells.length < 2 ||
    route.edgeWeights.length !== route.cells.length - 1 ||
    !Number.isSafeInteger(route.nextCellIndex) ||
    route.nextCellIndex < 1 ||
    route.nextCellIndex >= route.cells.length ||
    route.cells[route.nextCellIndex - 1] !== unit.cellId
  ) {
    throw new Error("mobile-unit route state is malformed");
  }
  for (const edgeWeight of route.edgeWeights) {
    assertPositiveSafeInteger(edgeWeight, "mobile-unit route edge weight");
  }
  assertCanonicalNonNegativeSafeInteger(route.edgeProgress, "mobile-unit route progress");
  if (route.edgeProgress >= route.edgeWeights[route.nextCellIndex - 1]!) {
    throw new Error("mobile-unit route progress must be below the current edge weight");
  }
  return route;
}

export function advanceMobileUnit(
  unit: MobileUnitState,
  movementWork: number,
): MobileUnitAdvanceResult {
  assertCanonicalNonNegativeSafeInteger(movementWork, "movement work");
  const route = assertAdvanceableRoute(unit);
  if (route === undefined || movementWork === 0) {
    return Object.freeze({
      unit,
      unusedWork: route === undefined ? movementWork : 0,
    });
  }

  let remainingWork = movementWork;
  let currentCellId = unit.cellId;
  let nextCellIndex = route.nextCellIndex;
  let edgeProgress = route.edgeProgress;

  while (remainingWork > 0 && nextCellIndex < route.cells.length) {
    const edgeWeight = route.edgeWeights[nextCellIndex - 1]!;
    const requiredWork = edgeWeight - edgeProgress;
    if (remainingWork < requiredWork) {
      edgeProgress += remainingWork;
      remainingWork = 0;
      break;
    }

    remainingWork -= requiredWork;
    currentCellId = route.cells[nextCellIndex]!;
    nextCellIndex += 1;
    edgeProgress = 0;
  }

  if (nextCellIndex >= route.cells.length) {
    return Object.freeze({
      unit: Object.freeze({
        id: unit.id,
        ownerId: unit.ownerId,
        type: unit.type,
        movementClass: unit.movementClass,
        cellId: currentCellId,
      }),
      unusedWork: remainingWork,
    });
  }

  return Object.freeze({
    unit: Object.freeze({
      id: unit.id,
      ownerId: unit.ownerId,
      type: unit.type,
      movementClass: unit.movementClass,
      cellId: currentCellId,
      route: Object.freeze({
        destinationCellId: route.destinationCellId,
        cells: route.cells,
        edgeWeights: route.edgeWeights,
        nextCellIndex,
        edgeProgress,
      }),
    }),
    unusedWork: 0,
  });
}

export function advanceMobileUnits(
  units: readonly MobileUnitState[],
  movementWorkByUnitId: Readonly<Record<UnitId, number>>,
): readonly MobileUnitState[] {
  const ordered = [...units].sort((left, right) => compareIds(left.id, right.id));
  const seenIds = new Set<UnitId>();
  const advanced = ordered.map((unit) => {
    if (seenIds.has(unit.id)) {
      throw new Error(`duplicate mobile-unit identity: ${unit.id}`);
    }
    seenIds.add(unit.id);
    const work = Object.prototype.hasOwnProperty.call(movementWorkByUnitId, unit.id)
      ? movementWorkByUnitId[unit.id]!
      : 0;
    return advanceMobileUnit(unit, work).unit;
  });
  return Object.freeze(advanced);
}

export function createMobileUnitSpatialIndex(
  units: readonly MobileUnitState[],
): MobileUnitSpatialIndex {
  const ordered = [...units].sort((left, right) => compareIds(left.id, right.id));
  const byId = new Map<UnitId, MobileUnitState>();
  const byOwner = new Map<FactionId, MobileUnitState[]>();
  const byCell = new Map<CellId, MobileUnitState[]>();

  for (const unit of ordered) {
    if (byId.has(unit.id)) {
      throw new Error(`duplicate mobile-unit identity: ${unit.id}`);
    }
    byId.set(unit.id, unit);
    const ownerUnits = byOwner.get(unit.ownerId) ?? [];
    ownerUnits.push(unit);
    byOwner.set(unit.ownerId, ownerUnits);
    const cellUnits = byCell.get(unit.cellId) ?? [];
    cellUnits.push(unit);
    byCell.set(unit.cellId, cellUnits);
  }

  const frozenOwners = new Map<FactionId, readonly MobileUnitState[]>();
  for (const [ownerId, ownerUnits] of byOwner) {
    frozenOwners.set(ownerId, Object.freeze(ownerUnits));
  }
  const frozenCells = new Map<CellId, readonly MobileUnitState[]>();
  for (const [cellId, cellUnits] of byCell) {
    frozenCells.set(cellId, Object.freeze(cellUnits));
  }

  return Object.freeze({
    get: (id: UnitId): MobileUnitState | undefined => byId.get(id),
    ownedBy: (ownerId: FactionId): readonly MobileUnitState[] =>
      frozenOwners.get(ownerId) ?? EMPTY_UNITS,
    atCell: (cellId: CellId): readonly MobileUnitState[] =>
      frozenCells.get(cellId) ?? EMPTY_UNITS,
  });
}

export function snapshotMobileUnitForProjection(
  unit: MobileUnitState,
): MobileUnitProjectionSource {
  return Object.freeze({
    id: unit.id,
    ownerId: unit.ownerId,
    type: unit.type,
    movementClass: unit.movementClass,
    cellId: unit.cellId,
    ...(unit.route === undefined
      ? {}
      : { movementDestinationCellId: unit.route.destinationCellId }),
  });
}
