import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import { materializeCompiledScalarScaleFactor } from "../core/rules/RuleMaterialization";
import { resolveFfyEconomicStage } from "./Economy";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  assignMobileUnitRoute,
  createMobileUnit,
  removeMobileUnit,
} from "./MobileUnits";
import { createNavigation } from "./Navigation";

const TRADE_DISPATCH_MIN_TICKS = 200;
const TRADE_DISPATCH_MAX_TICKS = 300;
const UINT32_RANGE = 0x1_0000_0000;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export interface LaunchTradeShipRequest {
  readonly ownerId: string;
  readonly sourcePortId: string;
}

export type TradeShipLaunchFailureCode =
  | "INVALID_REQUEST"
  | "DOCK_UNAVAILABLE"
  | "DOCK_BLOCKED";

export type LaunchTradeShipResult =
  | {
      readonly ok: true;
      readonly unit: MatchState["mobileUnits"][number];
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: TradeShipLaunchFailureCode }>;
      readonly state: MatchState;
    };

export interface LaunchTradeVoyageRequest extends LaunchTradeShipRequest {
  readonly destinationPortId: string;
}

export type TradeVoyageLaunchFailureCode =
  | TradeShipLaunchFailureCode
  | "DESTINATION_UNAVAILABLE"
  | "ROUTE_UNREACHABLE";

export type LaunchTradeVoyageResult =
  | {
      readonly ok: true;
      readonly unit: MatchState["mobileUnits"][number];
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: TradeVoyageLaunchFailureCode }>;
      readonly state: MatchState;
    };

export interface CompleteTradeShipArrivalRequest {
  readonly unitId: string;
  readonly destinationPortId: string;
}

export type TradeShipArrivalFailureCode =
  | "INVALID_REQUEST"
  | "DELIVERY_CELL_REQUIRED";

export type CompleteTradeShipArrivalResult =
  | {
      readonly ok: true;
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: TradeShipArrivalFailureCode }>;
      readonly state: MatchState;
    };

function launchFailure(
  state: MatchState,
  code: TradeShipLaunchFailureCode,
): LaunchTradeShipResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

function voyageLaunchFailure(
  state: MatchState,
  code: TradeVoyageLaunchFailureCode,
): LaunchTradeVoyageResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

function arrivalFailure(
  state: MatchState,
  code: TradeShipArrivalFailureCode,
): CompleteTradeShipArrivalResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

function operationalPort(state: MatchState, portId: string) {
  const port = state.structures.find(
    (structure) => structure.id === portId && structure.type === "PORT",
  );
  if (
    port === undefined ||
    !port.active ||
    port.completedLevel === undefined ||
    port.completedLevel < 1
  ) {
    return undefined;
  }
  return port;
}

function tradeShipDockCell(
  state: MatchState,
  ownerId: string,
  sourcePortId: string,
): number | undefined {
  const port = operationalPort(state, sourcePortId);
  if (port === undefined || port.ownerId !== ownerId) return undefined;
  const dockCellId = port.outputCellId;
  if (
    dockCellId === undefined ||
    !state.map.isValidCellId(dockCellId) ||
    state.map.terrainAt(dockCellId) !== "DEEP_WATER" ||
    state.structures.some((structure) => structure.cellId === dockCellId)
  ) {
    return undefined;
  }
  return dockCellId;
}

function territorialContactCount(state: MatchState, ownerId: string): number {
  const activeFactionIds = new Set(
    state.factions
      .filter((faction) => faction.status === "ACTIVE")
      .map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < state.ownership.length; cellId += 1) {
    if (state.ownership[cellId] !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwnerId = state.ownership[neighbor] ?? null;
      if (
        neighborOwnerId !== null &&
        neighborOwnerId !== ownerId &&
        activeFactionIds.has(neighborOwnerId)
      ) {
        contacts.add(neighborOwnerId);
      }
    }
  }
  return contacts.size;
}

function tradeRuleDynamicState(state: MatchState, ownerId: string) {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`Trade voyage references unknown owner ${ownerId}`);
  }
  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: territorialContactCount(state, ownerId),
    peakTotalPopulation: owner.population.peakTotal,
  });
}

function stableTradeHash32(domain: string, ...fields: readonly (string | number)[]): number {
  const text = JSON.stringify([domain, ...fields.map((field) => String(field))]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= code >>> 8;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function stableUniformInclusive(
  min: number,
  max: number,
  domain: string,
  ...fields: readonly (string | number)[]
): number {
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min < 0 ||
    max < min
  ) {
    throw new Error("Trade deterministic integer range is invalid");
  }
  const range = max - min + 1;
  const acceptanceLimit = Math.floor(UINT32_RANGE / range) * range;
  for (let retry = 0; ; retry += 1) {
    const sample = stableTradeHash32(domain, ...fields, retry);
    if (sample < acceptanceLimit) return min + (sample % range);
    if (retry === Number.MAX_SAFE_INTEGER) {
      throw new Error("Trade deterministic integer rejection sampling exhausted");
    }
  }
}

function nextTradeDispatchDelay(
  state: MatchState,
  portId: string,
  attemptOrdinal: number,
): number {
  return stableUniformInclusive(
    TRADE_DISPATCH_MIN_TICKS,
    TRADE_DISPATCH_MAX_TICKS,
    "TRADE_DISPATCH_DELAY_V1",
    state.seed,
    portId,
    attemptOrdinal,
  );
}

function compareSeededDestinationTie(
  state: MatchState,
  sourcePortId: string,
  leftDestinationPortId: string,
  rightDestinationPortId: string,
): number {
  const left = stableTradeHash32(
    "TRADE_DESTINATION_TIE_V1",
    state.seed,
    sourcePortId,
    leftDestinationPortId,
  );
  const right = stableTradeHash32(
    "TRADE_DESTINATION_TIE_V1",
    state.seed,
    sourcePortId,
    rightDestinationPortId,
  );
  return left - right ||
    (leftDestinationPortId < rightDestinationPortId
      ? -1
      : leftDestinationPortId > rightDestinationPortId
        ? 1
        : 0);
}

function tradeMovementTiming(state: MatchState, ownerId: string): Readonly<{
  movementWorkPerTick: number;
  edgeWeight: number;
}> {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`Trade movement references unknown owner ${ownerId}`);
  }
  const scale = materializeCompiledScalarScaleFactor(
    owner.rules,
    RULE_AXIS_REGISTRY,
    "UNIT_MOVEMENT_SPEED",
    { kind: "UNIT", unit: "TRADE_SHIP" },
    tradeRuleDynamicState(state, ownerId),
  );
  if (
    scale.numerator <= 0n ||
    scale.denominator <= 0n ||
    scale.numerator > MAX_SAFE_BIGINT ||
    scale.denominator > MAX_SAFE_BIGINT
  ) {
    throw new Error("Trade Ship movement speed must resolve to a positive safe ratio");
  }
  return Object.freeze({
    movementWorkPerTick: Number(scale.numerator),
    edgeWeight: Number(scale.denominator),
  });
}

function lawfulDeliveryCells(
  state: MatchState,
  destinationPortId: string,
): readonly number[] {
  const port = operationalPort(state, destinationPortId);
  if (port === undefined) return Object.freeze([]);
  const center = state.map.positionOf(port.cellId);
  const cells: number[] = [];
  for (
    let y = Math.max(0, center.y - 5);
    y <= Math.min(state.map.height - 1, center.y + 5);
    y += 1
  ) {
    for (
      let x = Math.max(0, center.x - 5);
      x <= Math.min(state.map.width - 1, center.x + 5);
      x += 1
    ) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > 25) continue;
      const cellId = state.map.cellIdAt(x, y);
      if (
        cellId !== undefined &&
        state.map.terrainAt(cellId) === "DEEP_WATER"
      ) {
        cells.push(cellId);
      }
    }
  }
  return Object.freeze(cells);
}

type TradeDestinationRoute = Readonly<{
  destinationPortId: string;
  route: Readonly<{ cells: readonly number[]; totalWeight: number }>;
}>;

function routeToTradeDestination(
  state: MatchState,
  startCellId: number,
  destinationPortId: string,
): TradeDestinationRoute | null {
  const targets = lawfulDeliveryCells(state, destinationPortId).map(
    (cellId) => Object.freeze({ cellId, intentWeight: 0 }),
  );
  if (targets.length === 0) return null;
  const result = createNavigation(state.map).pathBetweenCandidates(
    Object.freeze([{ cellId: startCellId, intentWeight: 0 }]),
    Object.freeze(targets),
    {
      traversalWeight(from, to) {
        return state.map.terrainAt(from) === "DEEP_WATER" &&
          state.map.terrainAt(to) === "DEEP_WATER"
          ? 1
          : undefined;
      },
    },
  );
  if (result.status === "UNREACHABLE") return null;
  if (result.status === "LIMIT_REACHED") {
    throw new Error("unbounded Trade voyage route resolution reached a work limit");
  }
  return Object.freeze({
    destinationPortId,
    route: Object.freeze({
      cells: Object.freeze([...result.route.path.cells]),
      totalWeight: result.route.path.totalWeight,
    }),
  });
}

function reachableForeignTradeDestinations(
  state: MatchState,
  ownerId: string,
  sourcePortId: string,
  sourceCellId: number,
): readonly TradeDestinationRoute[] {
  const destinations = state.structures
    .filter(
      (structure) =>
        structure.type === "PORT" &&
        structure.id !== sourcePortId &&
        structure.ownerId !== ownerId &&
        structure.active &&
        structure.completedLevel !== undefined &&
        structure.completedLevel >= 1,
    )
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
  const reachable: TradeDestinationRoute[] = [];
  for (const destination of destinations) {
    const route = routeToTradeDestination(state, sourceCellId, destination.id);
    if (route !== null) reachable.push(route);
  }
  return Object.freeze(reachable);
}

function selectLeastRecentTradeDestination(
  state: MatchState,
  sourcePortId: string,
  destinations: readonly TradeDestinationRoute[],
  history: readonly MatchState["tradePortSchedulers"][number]["destinationHistory"],
): TradeDestinationRoute | null {
  if (destinations.length === 0) return null;
  const lastSelected = new Map(
    history.map((entry) => [entry.destinationPortId, entry.lastSelectedOrdinal]),
  );
  return [...destinations].sort((left, right) => {
    const leftOrdinal = lastSelected.get(left.destinationPortId);
    const rightOrdinal = lastSelected.get(right.destinationPortId);
    if (leftOrdinal === undefined && rightOrdinal !== undefined) return -1;
    if (leftOrdinal !== undefined && rightOrdinal === undefined) return 1;
    if (
      leftOrdinal !== undefined &&
      rightOrdinal !== undefined &&
      leftOrdinal !== rightOrdinal
    ) {
      return leftOrdinal - rightOrdinal;
    }
    return compareSeededDestinationTie(
      state,
      sourcePortId,
      left.destinationPortId,
      right.destinationPortId,
    );
  })[0]!;
}

function scheduleNextTradeAttempt(
  state: MatchState,
  scheduler: MatchState["tradePortSchedulers"][number],
  baseTick: number,
): MatchState["tradePortSchedulers"][number] {
  const delay = nextTradeDispatchDelay(
    state,
    scheduler.portId,
    scheduler.nextAttemptOrdinal,
  );
  if (baseTick > Number.MAX_SAFE_INTEGER - delay) {
    throw new Error("Trade dispatch tick exceeds the safe-integer range");
  }
  return Object.freeze({
    ...scheduler,
    nextAttemptOrdinal: scheduler.nextAttemptOrdinal + 1,
    nextAttemptTick: baseTick + delay,
  });
}

export function tryLaunchTradeShipAtPortDock(
  state: MatchState,
  request: LaunchTradeShipRequest,
): LaunchTradeShipResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.sourcePortId !== "string" ||
    request.sourcePortId.length === 0
  ) {
    return launchFailure(state, "INVALID_REQUEST");
  }

  if (!state.factions.some((faction) => faction.id === request.ownerId)) {
    return launchFailure(state, "INVALID_REQUEST");
  }

  const port = operationalPort(state, request.sourcePortId);
  if (port === undefined || port.ownerId !== request.ownerId) {
    return launchFailure(state, "INVALID_REQUEST");
  }

  const dockCellId = tradeShipDockCell(
    state,
    request.ownerId,
    request.sourcePortId,
  );
  if (dockCellId === undefined) {
    return launchFailure(state, "DOCK_UNAVAILABLE");
  }
  if (state.mobileUnits.some((unit) => unit.cellId === dockCellId)) {
    return launchFailure(state, "DOCK_BLOCKED");
  }

  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: request.ownerId,
      type: "TRADE_SHIP",
      movementClass: "NAVAL",
      cellId: dockCellId,
    },
  );
  const next = createProspectiveMatchState(state, {
    mobileUnits: created.mobileUnits,
    nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
  });

  return Object.freeze({
    ok: true,
    unit: created.unit,
    state: next,
  });
}

export function tryLaunchTradeVoyage(
  state: MatchState,
  request: LaunchTradeVoyageRequest,
): LaunchTradeVoyageResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.sourcePortId !== "string" ||
    request.sourcePortId.length === 0 ||
    typeof request.destinationPortId !== "string" ||
    request.destinationPortId.length === 0
  ) {
    return voyageLaunchFailure(state, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return voyageLaunchFailure(state, "INVALID_REQUEST");

  const dockCellId = tradeShipDockCell(
    state,
    request.ownerId,
    request.sourcePortId,
  );
  if (dockCellId === undefined) {
    const sourcePort = operationalPort(state, request.sourcePortId);
    return voyageLaunchFailure(
      state,
      sourcePort === undefined || sourcePort.ownerId !== request.ownerId
        ? "INVALID_REQUEST"
        : "DOCK_UNAVAILABLE",
    );
  }

  const destinationPort = operationalPort(state, request.destinationPortId);
  if (
    destinationPort === undefined ||
    destinationPort.ownerId === request.ownerId
  ) {
    return voyageLaunchFailure(state, "DESTINATION_UNAVAILABLE");
  }

  const destinationRoute = routeToTradeDestination(
    state,
    dockCellId,
    request.destinationPortId,
  );
  if (destinationRoute === null) {
    return voyageLaunchFailure(state, "ROUTE_UNREACHABLE");
  }

  const physical = tryLaunchTradeShipAtPortDock(state, request);
  if (!physical.ok) {
    return voyageLaunchFailure(state, physical.failure.code);
  }

  const plannedRouteLengthCells = destinationRoute.route.totalWeight;
  if (
    !Number.isSafeInteger(plannedRouteLengthCells) ||
    plannedRouteLengthCells < 0 ||
    plannedRouteLengthCells > Math.floor(Number.MAX_SAFE_INTEGER / 150)
  ) {
    throw new Error("Trade voyage planned route length is outside the safe range");
  }
  const rawCargoFfy = plannedRouteLengthCells * 150;
  const preview = resolveFfyEconomicStage({
    balance: 0,
    rules: owner.rules,
    ruleDynamicState: tradeRuleDynamicState(state, owner.id),
    positiveEvents: Object.freeze([
      Object.freeze({
        id: JSON.stringify(["TRADE_VOWNER", physical.unit.id]),
        family: "NAVAL_TRADE" as const,
        baseValue: Object.freeze({
          numerator: BigInt(rawCargoFfy),
          denominator: 1n,
        }),
      }),
    ]),
    signedFacts: Object.freeze([]),
  });
  const ownerSuccessValueFfy = preview.positiveEvents[0]?.award;
  if (ownerSuccessValueFfy === undefined) {
    throw new Error("Trade voyage Vowner preview produced no positive event");
  }

  const movementTiming = tradeMovementTiming(state, request.ownerId);
  const routed = assignMobileUnitRoute(state.map, physical.unit, {
    cells: destinationRoute.route.cells,
    edgeWeights: Array.from(
      { length: Math.max(0, destinationRoute.route.cells.length - 1) },
      () => movementTiming.edgeWeight,
    ),
  });
  const mobileUnits = Object.freeze(
    physical.state.mobileUnits.map((unit) =>
      unit.id === routed.id ? routed : unit,
    ),
  );
  const voyage = Object.freeze({
    unitId: routed.id,
    economicSnapshot: Object.freeze({
      originalOwnerId: request.ownerId,
      sourcePortId: request.sourcePortId,
      launchDestinationPortId: request.destinationPortId,
      valuationCellId: destinationPort.cellId,
      plannedRouteLengthCells,
      rawCargoFfy,
      ownerSuccessValueFfy,
    }),
    firstHostileCaptureResolved: false,
  });
  const next = createProspectiveMatchState(physical.state, {
    mobileUnits,
    tradeVoyages: Object.freeze([...physical.state.tradeVoyages, voyage]),
  });

  return Object.freeze({
    ok: true,
    unit: routed,
    state: next,
  });
}

export type TradeShipRuntimeUpdate = Readonly<
  Pick<
    MatchState,
    "mobileUnits" | "nextMobileUnitOrdinal" | "tradeVoyages" | "tradePortSchedulers"
  >
>;

export function prepareTradeShipRuntimePhase(
  state: MatchState,
  previousState: MatchState,
): TradeShipRuntimeUpdate {
  const priorSchedulers = new Map(
    state.tradePortSchedulers.map((entry) => [entry.portId, entry]),
  );
  let working = state;
  const schedulers: MatchState["tradePortSchedulers"][number][] = [];
  const ports = state.structures
    .filter((structure) => structure.type === "PORT")
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );

  for (const port of ports) {
    const prior = priorSchedulers.get(port.id);
    const sameOwner = prior !== undefined && prior.ownerId === port.ownerId;
    let scheduler: MatchState["tradePortSchedulers"][number] = sameOwner
      ? prior
      : Object.freeze({
          portId: port.id,
          ownerId: port.ownerId,
          nextAttemptOrdinal: 0,
          nextAttemptTick: null,
          nextDestinationSelectionOrdinal: 0,
          destinationHistory: Object.freeze([]),
        });

    const operational =
      port.active &&
      port.completedLevel !== undefined &&
      port.completedLevel >= 1;
    const dockCellId = operational
      ? tradeShipDockCell(working, port.ownerId, port.id)
      : undefined;

    if (!operational || dockCellId === undefined) {
      schedulers.push(
        Object.freeze({
          ...scheduler,
          nextAttemptTick: null,
        }),
      );
      continue;
    }

    const destinations = reachableForeignTradeDestinations(
      working,
      port.ownerId,
      port.id,
      dockCellId,
    );

    if (scheduler.nextAttemptTick === null) {
      if (destinations.length === 0) {
        schedulers.push(scheduler);
        continue;
      }
      const previousPort = previousState.structures.find(
        (structure) => structure.id === port.id && structure.type === "PORT",
      );
      const existedAsSameActiveEpoch =
        !sameOwner &&
        prior === undefined &&
        previousPort !== undefined &&
        previousPort.ownerId === port.ownerId &&
        previousPort.active &&
        previousPort.completedLevel !== undefined &&
        previousPort.completedLevel >= 1;
      scheduler = scheduleNextTradeAttempt(
        working,
        scheduler,
        existedAsSameActiveEpoch ? previousState.tick : state.tick,
      );
      schedulers.push(scheduler);
      continue;
    }

    if (scheduler.nextAttemptTick > state.tick) {
      schedulers.push(scheduler);
      continue;
    }

    const selected = selectLeastRecentTradeDestination(
      working,
      port.id,
      destinations,
      scheduler.destinationHistory,
    );
    if (selected !== null) {
      const launched = tryLaunchTradeVoyage(working, {
        ownerId: port.ownerId,
        sourcePortId: port.id,
        destinationPortId: selected.destinationPortId,
      });
      if (launched.ok) {
        working = launched.state;
        const selectedOrdinal = scheduler.nextDestinationSelectionOrdinal;
        const nextHistory = scheduler.destinationHistory
          .filter(
            (entry) =>
              entry.destinationPortId !== selected.destinationPortId,
          )
          .concat(
            Object.freeze({
              destinationPortId: selected.destinationPortId,
              lastSelectedOrdinal: selectedOrdinal,
            }),
          )
          .sort((left, right) =>
            left.destinationPortId < right.destinationPortId
              ? -1
              : left.destinationPortId > right.destinationPortId
                ? 1
                : 0,
          );
        scheduler = Object.freeze({
          ...scheduler,
          nextDestinationSelectionOrdinal: selectedOrdinal + 1,
          destinationHistory: Object.freeze(nextHistory),
        });
      }
    }

    scheduler = scheduleNextTradeAttempt(working, scheduler, state.tick);
    schedulers.push(scheduler);
  }

  return Object.freeze({
    mobileUnits: working.mobileUnits,
    nextMobileUnitOrdinal: working.nextMobileUnitOrdinal,
    tradeVoyages: working.tradeVoyages,
    tradePortSchedulers: Object.freeze(schedulers),
  });
}

export function tradeShipMovementWorkByUnitId(
  state: MatchState,
): Readonly<Record<string, number>> {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const movementWork: Record<string, number> = {};
  for (const voyage of state.tradeVoyages) {
    const unit = unitsById.get(voyage.unitId);
    if (
      unit === undefined ||
      unit.type !== "TRADE_SHIP" ||
      unit.route === undefined
    ) {
      continue;
    }
    movementWork[unit.id] = tradeMovementTiming(
      state,
      unit.ownerId,
    ).movementWorkPerTick;
  }
  return Object.freeze(movementWork);
}

export function isTradeShipDeliveryCell(
  state: MatchState,
  destinationPortId: string,
  cellId: number,
): boolean {
  if (!state.map.isValidCellId(cellId)) return false;
  if (state.map.terrainAt(cellId) !== "DEEP_WATER") return false;

  const port = operationalPort(state, destinationPortId);
  if (port === undefined) return false;

  const portPosition = state.map.positionOf(port.cellId);
  const cellPosition = state.map.positionOf(cellId);
  const dx = cellPosition.x - portPosition.x;
  const dy = cellPosition.y - portPosition.y;
  return dx * dx + dy * dy <= 25;
}

export function completeTradeShipArrival(
  state: MatchState,
  request: CompleteTradeShipArrivalRequest,
): CompleteTradeShipArrivalResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.unitId !== "string" ||
    request.unitId.length === 0 ||
    typeof request.destinationPortId !== "string" ||
    request.destinationPortId.length === 0
  ) {
    return arrivalFailure(state, "INVALID_REQUEST");
  }

  const unit = state.mobileUnits.find((candidate) => candidate.id === request.unitId);
  if (unit === undefined || unit.type !== "TRADE_SHIP") {
    return arrivalFailure(state, "INVALID_REQUEST");
  }
  if (!isTradeShipDeliveryCell(state, request.destinationPortId, unit.cellId)) {
    return arrivalFailure(state, "DELIVERY_CELL_REQUIRED");
  }

  const remaining = removeMobileUnit(
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    unit.id,
  );
  const next = createProspectiveMatchState(state, {
    mobileUnits: remaining.mobileUnits,
    nextMobileUnitOrdinal: remaining.nextMobileUnitOrdinal,
    tradeVoyages: state.tradeVoyages.filter((voyage) => voyage.unitId !== unit.id),
  });
  return Object.freeze({ ok: true, state: next });
}
