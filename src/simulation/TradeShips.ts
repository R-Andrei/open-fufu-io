import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import { materializeCompiledScalarScaleFactor } from "../core/rules/RuleMaterialization";
import {
  ffyEventConditionAppliesAtCell,
  ffyRuleDynamicState,
  resolveExternalWartimeTradeMultiplier,
  resolveFfyEconomicStage,
  type PositiveFfyEventInput,
  type SignedFfyFactInput,
} from "./Economy";
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
    ffyRuleDynamicState(state, ownerId),
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

function tradeRouteCellIsPhysicallyAvailable(
  state: MatchState,
  startCellId: number,
  cellId: number,
): boolean {
  if (cellId === startCellId) return true;
  return (
    !state.structures.some((structure) => structure.cellId === cellId) &&
    !state.mobileUnits.some((unit) => unit.cellId === cellId)
  );
}

function resolveTradeDestinationRoute(
  state: MatchState,
  startCellId: number,
  destinationPortId: string,
  avoidCurrentPhysicalOccupancy: boolean,
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
        if (
          state.map.terrainAt(from) !== "DEEP_WATER" ||
          state.map.terrainAt(to) !== "DEEP_WATER"
        ) {
          return undefined;
        }
        if (
          avoidCurrentPhysicalOccupancy &&
          (!tradeRouteCellIsPhysicallyAvailable(state, startCellId, from) ||
            !tradeRouteCellIsPhysicallyAvailable(state, startCellId, to))
        ) {
          return undefined;
        }
        return 1;
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

function occupancyAvoidingTradeDestinationRoute(
  state: MatchState,
  startCellId: number,
  destinationPortId: string,
): TradeDestinationRoute | null {
  return resolveTradeDestinationRoute(
    state,
    startCellId,
    destinationPortId,
    true,
  );
}

function routeToTradeDestination(
  state: MatchState,
  startCellId: number,
  destinationPortId: string,
): TradeDestinationRoute | null {
  return (
    occupancyAvoidingTradeDestinationRoute(
      state,
      startCellId,
      destinationPortId,
    ) ??
    resolveTradeDestinationRoute(
      state,
      startCellId,
      destinationPortId,
      false,
    )
  );
}

function reachableForeignTradeDestinations(
  state: MatchState,
  ownerId: string,
  sourceCellId: number,
): readonly TradeDestinationRoute[] {
  const destinations = state.structures
    .filter(
      (structure) =>
        structure.type === "PORT" &&
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
  history: MatchState["tradePortSchedulers"][number]["destinationHistory"],
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

function tradeEpochKey(
  portId: string,
  ownerId: string,
  ownershipEpochOrdinal: number,
): string {
  return JSON.stringify([portId, ownerId, ownershipEpochOrdinal]);
}

function sourceEpochOrdinalForLaunch(
  state: MatchState,
  sourcePortId: string,
  ownerId: string,
): number {
  const scheduler = state.tradePortSchedulers.find(
    (entry) => entry.portId === sourcePortId,
  );
  if (scheduler === undefined) return 0;
  if (scheduler.ownerId === ownerId) return scheduler.ownershipEpochOrdinal;
  if (scheduler.ownershipEpochOrdinal >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Trade Port ownership epoch ordinal is exhausted");
  }
  return scheduler.ownershipEpochOrdinal + 1;
}

function assignTradeDestinationRoute(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
  route: TradeDestinationRoute,
): MatchState["mobileUnits"][number] {
  const timing = tradeMovementTiming(state, unit.ownerId);
  return assignMobileUnitRoute(state.map, unit, {
    cells: route.route.cells,
    edgeWeights: Array.from(
      { length: Math.max(0, route.route.cells.length - 1) },
      () => timing.edgeWeight,
    ),
  });
}

function clearTradeRoute(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
): MatchState["mobileUnits"][number] {
  return assignMobileUnitRoute(state.map, unit, {
    cells: Object.freeze([unit.cellId]),
    edgeWeights: Object.freeze([]),
  });
}


function tradeRouteHasCurrentPhysicalBlocker(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
): boolean {
  const route = unit.route;
  if (route === undefined) return false;
  for (let index = route.nextCellIndex; index < route.cells.length; index += 1) {
    const cellId = route.cells[index]!;
    if (
      state.structures.some((structure) => structure.cellId === cellId) ||
      state.mobileUnits.some(
        (candidate) =>
          candidate.id !== unit.id && candidate.cellId === cellId,
      )
    ) {
      return true;
    }
  }
  return false;
}

function reconcileTradeRouteToDestination(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
  destinationPortId: string,
): MatchState["mobileUnits"][number] {
  if (isTradeShipDeliveryCell(state, destinationPortId, unit.cellId)) {
    return unit;
  }
  if (unit.route === undefined) {
    const route = routeToTradeDestination(
      state,
      unit.cellId,
      destinationPortId,
    );
    return route === null
      ? unit
      : assignTradeDestinationRoute(state, unit, route);
  }
  if (!tradeRouteHasCurrentPhysicalBlocker(state, unit)) {
    return unit;
  }
  const bypass = occupancyAvoidingTradeDestinationRoute(
    state,
    unit.cellId,
    destinationPortId,
  );
  return bypass === null
    ? unit
    : assignTradeDestinationRoute(state, unit, bypass);
}

function nearestReachableOwnedTradePort(
  state: MatchState,
  ownerId: string,
  startCellId: number,
): TradeDestinationRoute | null {
  const candidates: TradeDestinationRoute[] = [];
  for (const port of state.structures) {
    if (
      port.type !== "PORT" ||
      port.ownerId !== ownerId ||
      !port.active ||
      port.completedLevel === undefined ||
      port.completedLevel < 1
    ) {
      continue;
    }
    const route = routeToTradeDestination(state, startCellId, port.id);
    if (route !== null) candidates.push(route);
  }
  candidates.sort(
    (left, right) =>
      left.route.totalWeight - right.route.totalWeight ||
      (left.destinationPortId < right.destinationPortId
        ? -1
        : left.destinationPortId > right.destinationPortId
          ? 1
          : 0),
  );
  return candidates[0] ?? null;
}

function updateTradeDestinationHistory<
  T extends {
    readonly nextDestinationSelectionOrdinal: number;
    readonly destinationHistory: MatchState["tradePortSchedulers"][number]["destinationHistory"];
  },
>(epoch: T, destinationPortId: string): T {
  if (epoch.nextDestinationSelectionOrdinal >= Number.MAX_SAFE_INTEGER) {
    throw new Error("Trade destination selection ordinal is exhausted");
  }
  const selectedOrdinal = epoch.nextDestinationSelectionOrdinal;
  const destinationHistory = epoch.destinationHistory
    .filter((entry) => entry.destinationPortId !== destinationPortId)
    .concat(
      Object.freeze({
        destinationPortId,
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
  return Object.freeze({
    ...epoch,
    nextDestinationSelectionOrdinal: selectedOrdinal + 1,
    destinationHistory: Object.freeze(destinationHistory),
  });
}

function tradeEpochReferenced(
  voyages: readonly MatchState["tradeVoyages"][number][],
  portId: string,
  ownerId: string,
  ownershipEpochOrdinal: number,
): boolean {
  return voyages.some(
    (voyage) =>
      voyage.economicSnapshot.sourcePortId === portId &&
      voyage.economicSnapshot.originalOwnerId === ownerId &&
      voyage.sourcePortOwnershipEpochOrdinal === ownershipEpochOrdinal,
  );
}

function cleanupRetiredTradeEpochs(
  voyages: readonly MatchState["tradeVoyages"][number][],
  retired: readonly MatchState["tradeRetiredPortEpochs"][number][],
): readonly MatchState["tradeRetiredPortEpochs"][number][] {
  return Object.freeze(
    retired.filter((epoch) =>
      tradeEpochReferenced(
        voyages,
        epoch.portId,
        epoch.ownerId,
        epoch.ownershipEpochOrdinal,
      ),
    ),
  );
}

function hasTradeCaptureValueTrait(
  state: MatchState,
  ownerId: string,
  traitId: "N14" | "N16",
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`Trade voyage references unknown faction ${ownerId}`);
  }
  return owner.rules.customDomains.some(
    (entry) =>
      entry.sourceKind === "ORIGIN" &&
      entry.sourceId === traitId &&
      entry.domain === "TRADE_CAPTURE_VALUE",
  );
}

function factionIdentity(state: MatchState, factionId: string) {
  const faction = state.factions.find((candidate) => candidate.id === factionId);
  if (faction === undefined) return null;
  return Object.freeze({
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  });
}

function exactWholeFfy(value: number) {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Trade FFY component must be a safe integer");
  }
  return Object.freeze({ numerator: BigInt(value), denominator: 1n });
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
    ruleDynamicState: ffyRuleDynamicState(state, owner.id),
    positiveEvents: Object.freeze([
      Object.freeze({
        id: JSON.stringify(["TRADE_VOWNER", physical.unit.id]),
        family: "NAVAL_TRADE" as const,
        baseValue: exactWholeFfy(rawCargoFfy),
        conditionApplies: (condition) =>
          ffyEventConditionAppliesAtCell(
            state,
            owner.id,
            destinationPort.cellId,
            condition,
          ),
      }),
    ]),
    signedFacts: Object.freeze([]),
  });
  const ownerSuccessValueFfy = preview.positiveEvents[0]?.award;
  if (ownerSuccessValueFfy === undefined) {
    throw new Error("Trade voyage Vowner preview produced no positive event");
  }

  const routed = assignTradeDestinationRoute(
    state,
    physical.unit,
    destinationRoute,
  );
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
    sourcePortOwnershipEpochOrdinal: sourceEpochOrdinalForLaunch(
      state,
      request.sourcePortId,
      request.ownerId,
    ),
    routingMode: "ORDINARY" as const,
    destinationPortId: request.destinationPortId,
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
    | "mobileUnits"
    | "nextMobileUnitOrdinal"
    | "tradeVoyages"
    | "tradePortSchedulers"
    | "tradeRetiredPortEpochs"
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
  let retiredEpochs = [...state.tradeRetiredPortEpochs];
  let schedulers: MatchState["tradePortSchedulers"][number][] = [];
  const ports = state.structures
    .filter((structure) => structure.type === "PORT")
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
  const currentPortIds = new Set(ports.map((port) => port.id));

  for (const port of ports) {
    const prior = priorSchedulers.get(port.id);
    const sameOwner = prior !== undefined && prior.ownerId === port.ownerId;
    if (
      prior !== undefined &&
      !sameOwner &&
      tradeEpochReferenced(
        working.tradeVoyages,
        prior.portId,
        prior.ownerId,
        prior.ownershipEpochOrdinal,
      ) &&
      !retiredEpochs.some(
        (entry) =>
          tradeEpochKey(
            entry.portId,
            entry.ownerId,
            entry.ownershipEpochOrdinal,
          ) ===
          tradeEpochKey(
            prior.portId,
            prior.ownerId,
            prior.ownershipEpochOrdinal,
          ),
      )
    ) {
      retiredEpochs.push(
        Object.freeze({
          portId: prior.portId,
          ownerId: prior.ownerId,
          ownershipEpochOrdinal: prior.ownershipEpochOrdinal,
          nextDestinationSelectionOrdinal:
            prior.nextDestinationSelectionOrdinal,
          destinationHistory: prior.destinationHistory,
        }),
      );
    }
    const newEpochOrdinal =
      prior === undefined
        ? 0
        : sameOwner
          ? prior.ownershipEpochOrdinal
          : prior.ownershipEpochOrdinal + 1;
    if (!Number.isSafeInteger(newEpochOrdinal)) {
      throw new Error("Trade Port ownership epoch ordinal is exhausted");
    }
    let scheduler: MatchState["tradePortSchedulers"][number] = sameOwner
      ? prior
      : Object.freeze({
          portId: port.id,
          ownerId: port.ownerId,
          ownershipEpochOrdinal: newEpochOrdinal,
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
        sameOwner &&
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
        scheduler = updateTradeDestinationHistory(
          scheduler,
          selected.destinationPortId,
        );
      }
    }
    scheduler = scheduleNextTradeAttempt(working, scheduler, state.tick);
    schedulers.push(scheduler);
  }

  for (const prior of priorSchedulers.values()) {
    if (
      currentPortIds.has(prior.portId) ||
      !tradeEpochReferenced(
        working.tradeVoyages,
        prior.portId,
        prior.ownerId,
        prior.ownershipEpochOrdinal,
      ) ||
      retiredEpochs.some(
        (entry) =>
          tradeEpochKey(
            entry.portId,
            entry.ownerId,
            entry.ownershipEpochOrdinal,
          ) ===
          tradeEpochKey(
            prior.portId,
            prior.ownerId,
            prior.ownershipEpochOrdinal,
          ),
      )
    ) {
      continue;
    }
    retiredEpochs.push(
      Object.freeze({
        portId: prior.portId,
        ownerId: prior.ownerId,
        ownershipEpochOrdinal: prior.ownershipEpochOrdinal,
        nextDestinationSelectionOrdinal: prior.nextDestinationSelectionOrdinal,
        destinationHistory: prior.destinationHistory,
      }),
    );
  }

  const schedulerIndex = new Map(
    schedulers.map((entry, index) => [
      tradeEpochKey(
        entry.portId,
        entry.ownerId,
        entry.ownershipEpochOrdinal,
      ),
      index,
    ]),
  );
  const retiredIndex = new Map(
    retiredEpochs.map((entry, index) => [
      tradeEpochKey(
        entry.portId,
        entry.ownerId,
        entry.ownershipEpochOrdinal,
      ),
      index,
    ]),
  );
  let mobileUnits = [...working.mobileUnits];
  let voyages = [...working.tradeVoyages];

  const replaceUnit = (unit: MatchState["mobileUnits"][number]) => {
    mobileUnits = mobileUnits.map((candidate) =>
      candidate.id === unit.id ? unit : candidate,
    );
  };
  const replaceVoyage = (voyage: MatchState["tradeVoyages"][number]) => {
    voyages = voyages.map((candidate) =>
      candidate.unitId === voyage.unitId ? voyage : candidate,
    );
  };

  for (const originalVoyage of [...voyages].sort((left, right) =>
    left.unitId < right.unitId ? -1 : left.unitId > right.unitId ? 1 : 0,
  )) {
    const unit = mobileUnits.find(
      (candidate) => candidate.id === originalVoyage.unitId,
    );
    if (unit === undefined) continue;
    let voyage = originalVoyage;

    if (voyage.routingMode === "CAPTURED") {
      const currentPort =
        voyage.destinationPortId === null
          ? undefined
          : operationalPort(working, voyage.destinationPortId);
      const destinationStillLegal =
        currentPort !== undefined &&
        currentPort.ownerId === unit.ownerId;
      if (destinationStillLegal) {
        const reconciledUnit = reconcileTradeRouteToDestination(
          working,
          unit,
          voyage.destinationPortId!,
        );
        if (reconciledUnit !== unit) replaceUnit(reconciledUnit);
        continue;
      }
      const ownedRoute = nearestReachableOwnedTradePort(
        working,
        unit.ownerId,
        unit.cellId,
      );
      if (ownedRoute === null) {
        replaceUnit(clearTradeRoute(working, unit));
        voyage = Object.freeze({ ...voyage, destinationPortId: null });
      } else {
        replaceUnit(assignTradeDestinationRoute(working, unit, ownedRoute));
        voyage = Object.freeze({
          ...voyage,
          destinationPortId: ownedRoute.destinationPortId,
        });
      }
      replaceVoyage(voyage);
      continue;
    }

    if (voyage.routingMode === "OWNED_RETURN") {
      const currentPort =
        voyage.destinationPortId === null
          ? undefined
          : operationalPort(working, voyage.destinationPortId);
      const destinationStillLegal =
        currentPort !== undefined &&
        currentPort.ownerId === voyage.economicSnapshot.originalOwnerId;
      if (destinationStillLegal) {
        const reconciledUnit = reconcileTradeRouteToDestination(
          working,
          unit,
          voyage.destinationPortId!,
        );
        if (reconciledUnit !== unit) replaceUnit(reconciledUnit);
        continue;
      }
      const ownedRoute = nearestReachableOwnedTradePort(
        working,
        voyage.economicSnapshot.originalOwnerId,
        unit.cellId,
      );
      if (ownedRoute === null) {
        replaceUnit(clearTradeRoute(working, unit));
        voyage = Object.freeze({ ...voyage, destinationPortId: null });
      } else {
        replaceUnit(assignTradeDestinationRoute(working, unit, ownedRoute));
        voyage = Object.freeze({
          ...voyage,
          destinationPortId: ownedRoute.destinationPortId,
        });
      }
      replaceVoyage(voyage);
      continue;
    }

    const destination =
      voyage.destinationPortId === null
        ? undefined
        : operationalPort(working, voyage.destinationPortId);
    const destinationStillLegal =
      destination !== undefined &&
      destination.ownerId !== voyage.economicSnapshot.originalOwnerId;
    if (destinationStillLegal) {
      const reconciledUnit = reconcileTradeRouteToDestination(
        working,
        unit,
        voyage.destinationPortId!,
      );
      if (reconciledUnit !== unit) replaceUnit(reconciledUnit);
      continue;
    }

    const foreignDestinations = reachableForeignTradeDestinations(
      working,
      voyage.economicSnapshot.originalOwnerId,
      unit.cellId,
    );
    if (foreignDestinations.length > 0) {
      const key = tradeEpochKey(
        voyage.economicSnapshot.sourcePortId,
        voyage.economicSnapshot.originalOwnerId,
        voyage.sourcePortOwnershipEpochOrdinal,
      );
      const currentIndex = schedulerIndex.get(key);
      const oldIndex = retiredIndex.get(key);
      const epoch =
        currentIndex === undefined
          ? oldIndex === undefined
            ? undefined
            : retiredEpochs[oldIndex]
          : schedulers[currentIndex];
      if (epoch === undefined) {
        throw new Error(
          `Trade voyage ${voyage.unitId} has no launching Port epoch history`,
        );
      }
      const selected = selectLeastRecentTradeDestination(
        working,
        voyage.economicSnapshot.sourcePortId,
        foreignDestinations,
        epoch.destinationHistory,
      );
      if (selected === null) {
        throw new Error("Trade destination selection lost non-empty candidates");
      }
      const updatedEpoch = updateTradeDestinationHistory(
        epoch,
        selected.destinationPortId,
      );
      if (currentIndex !== undefined) schedulers[currentIndex] = updatedEpoch as MatchState["tradePortSchedulers"][number];
      else retiredEpochs[oldIndex!] = updatedEpoch as MatchState["tradeRetiredPortEpochs"][number];
      replaceUnit(assignTradeDestinationRoute(working, unit, selected));
      voyage = Object.freeze({
        ...voyage,
        destinationPortId: selected.destinationPortId,
      });
      replaceVoyage(voyage);
      continue;
    }

    const ownedRoute = nearestReachableOwnedTradePort(
      working,
      voyage.economicSnapshot.originalOwnerId,
      unit.cellId,
    );
    if (ownedRoute === null) {
      replaceUnit(clearTradeRoute(working, unit));
      voyage = Object.freeze({ ...voyage, destinationPortId: null });
    } else {
      replaceUnit(assignTradeDestinationRoute(working, unit, ownedRoute));
      voyage = Object.freeze({
        ...voyage,
        routingMode: "OWNED_RETURN" as const,
        destinationPortId: ownedRoute.destinationPortId,
      });
    }
    replaceVoyage(voyage);
  }

  retiredEpochs = [...cleanupRetiredTradeEpochs(voyages, retiredEpochs)];
  return Object.freeze({
    mobileUnits: Object.freeze(mobileUnits),
    nextMobileUnitOrdinal: working.nextMobileUnitOrdinal,
    tradeVoyages: Object.freeze(voyages),
    tradePortSchedulers: Object.freeze(schedulers),
    tradeRetiredPortEpochs: Object.freeze(retiredEpochs),
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

export interface CaptureTradeShipRequest {
  readonly unitId: string;
  readonly capturingFactionId: string;
}

export type CaptureTradeShipFailureCode =
  | "INVALID_REQUEST"
  | "NOT_HOSTILE"
  | "NO_REACHABLE_DELIVERY_PORT";

export type CaptureTradeShipResult =
  | Readonly<{
      ok: true;
      state: MatchState;
      capture: Readonly<{
        unitId: string;
        originalOwnerId: string;
        previousHolderId: string;
        nextHolderId: string;
        firstHostileCapture: boolean;
      }>;
    }>
  | Readonly<{
      ok: false;
      state: MatchState;
      failure: Readonly<{ code: CaptureTradeShipFailureCode }>;
    }>;

function captureFailure(
  state: MatchState,
  code: CaptureTradeShipFailureCode,
): CaptureTradeShipResult {
  return Object.freeze({
    ok: false,
    state,
    failure: Object.freeze({ code }),
  });
}

export function tryCaptureTradeShip(
  state: MatchState,
  request: CaptureTradeShipRequest,
): CaptureTradeShipResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.unitId !== "string" ||
    request.unitId.length === 0 ||
    typeof request.capturingFactionId !== "string" ||
    request.capturingFactionId.length === 0
  ) {
    return captureFailure(state, "INVALID_REQUEST");
  }
  const unit = state.mobileUnits.find(
    (candidate) =>
      candidate.id === request.unitId && candidate.type === "TRADE_SHIP",
  );
  const voyage = state.tradeVoyages.find(
    (candidate) => candidate.unitId === request.unitId,
  );
  const previousIdentity =
    unit === undefined ? null : factionIdentity(state, unit.ownerId);
  const nextIdentity = factionIdentity(state, request.capturingFactionId);
  if (
    unit === undefined ||
    voyage === undefined ||
    previousIdentity === null ||
    nextIdentity === null
  ) {
    return captureFailure(state, "INVALID_REQUEST");
  }
  if (factionRelationBetween(previousIdentity, nextIdentity) !== "ENEMY") {
    return captureFailure(state, "NOT_HOSTILE");
  }
  const deliveryRoute = nearestReachableOwnedTradePort(
    state,
    request.capturingFactionId,
    unit.cellId,
  );
  if (deliveryRoute === null) {
    return captureFailure(state, "NO_REACHABLE_DELIVERY_PORT");
  }

  const transferredBase = Object.freeze({
    id: unit.id,
    ownerId: request.capturingFactionId,
    type: unit.type,
    movementClass: unit.movementClass,
    cellId: unit.cellId,
    ...(unit.strategicDestinationCellId === undefined
      ? {}
      : { strategicDestinationCellId: unit.strategicDestinationCellId }),
  });
  const transferred = assignTradeDestinationRoute(
    state,
    transferredBase,
    deliveryRoute,
  );
  const firstHostileCapture = !voyage.firstHostileCaptureResolved;
  const updatedVoyage = Object.freeze({
    ...voyage,
    routingMode: "CAPTURED" as const,
    destinationPortId: deliveryRoute.destinationPortId,
    firstHostileCaptureResolved: true,
  });
  const mobileUnits = Object.freeze(
    state.mobileUnits.map((candidate) =>
      candidate.id === unit.id ? transferred : candidate,
    ),
  );
  const tradeVoyages = Object.freeze(
    state.tradeVoyages.map((candidate) =>
      candidate.unitId === voyage.unitId ? updatedVoyage : candidate,
    ),
  );
  let tradePendingSignedFacts = state.tradePendingSignedFacts;
  if (firstHostileCapture) {
    const componentsFfy: number[] = [];
    const originalOwnerId = voyage.economicSnapshot.originalOwnerId;
    const vowner = voyage.economicSnapshot.ownerSuccessValueFfy;
    if (hasTradeCaptureValueTrait(state, originalOwnerId, "N14")) {
      componentsFfy.push(-vowner);
    }
    if (hasTradeCaptureValueTrait(state, originalOwnerId, "N16")) {
      componentsFfy.push(vowner);
    }
    if (componentsFfy.length > 0) {
      tradePendingSignedFacts = Object.freeze([
        ...state.tradePendingSignedFacts,
        Object.freeze({
          id: JSON.stringify([
            "TRADE_FIRST_CAPTURE",
            state.tick,
            voyage.unitId,
          ]),
          ownerId: originalOwnerId,
          componentsFfy: Object.freeze(componentsFfy),
        }),
      ]);
    }
  }
  const next = createProspectiveMatchState(state, {
    mobileUnits,
    tradeVoyages,
    tradePendingSignedFacts,
  });
  return Object.freeze({
    ok: true,
    state: next,
    capture: Object.freeze({
      unitId: voyage.unitId,
      originalOwnerId: voyage.economicSnapshot.originalOwnerId,
      previousHolderId: unit.ownerId,
      nextHolderId: request.capturingFactionId,
      firstHostileCapture,
    }),
  });
}

function tradeTerminalEventId(
  state: MatchState,
  voyage: MatchState["tradeVoyages"][number],
  kind: "ORDINARY" | "PIRACY" | "RECOVERY",
): string {
  return JSON.stringify(["TRADE_TERMINAL", state.tick, voyage.unitId, kind]);
}

function appendPositiveEvent(
  byOwner: Map<string, PositiveFfyEventInput[]>,
  ownerId: string,
  event: PositiveFfyEventInput,
): void {
  const existing = byOwner.get(ownerId);
  if (existing === undefined) byOwner.set(ownerId, [event]);
  else existing.push(event);
}

function appendSignedFact(
  byOwner: Map<string, SignedFfyFactInput[]>,
  ownerId: string,
  fact: SignedFfyFactInput,
): void {
  const existing = byOwner.get(ownerId);
  if (existing === undefined) byOwner.set(ownerId, [fact]);
  else existing.push(fact);
}

export function settleTradeShipRuntimePhase(
  state: MatchState,
  currentAtWar: (leftFactionId: string, rightFactionId: string) => boolean,
): MatchState {
  const positiveByOwner = new Map<string, PositiveFfyEventInput[]>();
  const signedByOwner = new Map<string, SignedFfyFactInput[]>();
  for (const pending of state.tradePendingSignedFacts) {
    appendSignedFact(
      signedByOwner,
      pending.ownerId,
      Object.freeze({
        id: pending.id,
        components: Object.freeze(
          pending.componentsFfy.map((component) => exactWholeFfy(component)),
        ),
      }),
    );
  }

  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const terminalUnitIds = new Set<string>();

  for (const voyage of [...state.tradeVoyages].sort((left, right) =>
    left.unitId < right.unitId ? -1 : left.unitId > right.unitId ? 1 : 0,
  )) {
    const unit = unitsById.get(voyage.unitId);
    if (unit === undefined || voyage.destinationPortId === null) continue;
    const destinationPort = operationalPort(state, voyage.destinationPortId);
    if (
      destinationPort === undefined ||
      !isTradeShipDeliveryCell(
        state,
        voyage.destinationPortId,
        unit.cellId,
      )
    ) {
      continue;
    }

    if (voyage.routingMode === "ORDINARY") {
      if (
        voyage.firstHostileCaptureResolved ||
        unit.ownerId !== voyage.economicSnapshot.originalOwnerId ||
        destinationPort.ownerId === voyage.economicSnapshot.originalOwnerId
      ) {
        continue;
      }
      const ownerId = voyage.economicSnapshot.originalOwnerId;
      if (hasTradeCaptureValueTrait(state, ownerId, "N16")) {
        appendSignedFact(
          signedByOwner,
          ownerId,
          Object.freeze({
            id: tradeTerminalEventId(state, voyage, "ORDINARY"),
            components: Object.freeze([
              exactWholeFfy(-voyage.economicSnapshot.ownerSuccessValueFfy),
            ]),
          }),
        );
      } else {
        const owner = state.factions.find((faction) => faction.id === ownerId)!;
        appendPositiveEvent(
          positiveByOwner,
          ownerId,
          Object.freeze({
            id: tradeTerminalEventId(state, voyage, "ORDINARY"),
            family: "NAVAL_TRADE" as const,
            baseValue: exactWholeFfy(voyage.economicSnapshot.rawCargoFfy),
            structuralMultiplier: resolveExternalWartimeTradeMultiplier(
              owner.rules,
              ffyRuleDynamicState(state, ownerId),
              currentAtWar(ownerId, destinationPort.ownerId),
            ),
            conditionApplies: (condition) =>
              ffyEventConditionAppliesAtCell(
                state,
                ownerId,
                destinationPort.cellId,
                condition,
              ),
          }),
        );
      }
      terminalUnitIds.add(voyage.unitId);
      continue;
    }

    if (voyage.routingMode === "OWNED_RETURN") {
      if (destinationPort.ownerId === voyage.economicSnapshot.originalOwnerId) {
        terminalUnitIds.add(voyage.unitId);
      }
      continue;
    }

    if (destinationPort.ownerId !== unit.ownerId) continue;
    const holderId = unit.ownerId;
    const holder = state.factions.find((faction) => faction.id === holderId);
    if (holder === undefined) {
      throw new Error(`captured Trade voyage has unknown holder ${holderId}`);
    }
    const recovered =
      holderId === voyage.economicSnapshot.originalOwnerId;
    appendPositiveEvent(
      positiveByOwner,
      holderId,
      Object.freeze({
        id: tradeTerminalEventId(
          state,
          voyage,
          recovered ? "RECOVERY" : "PIRACY",
        ),
        family: "NAVAL_TRADE" as const,
        ...(recovered ? {} : { specialization: "PIRACY" as const }),
        baseValue: exactWholeFfy(voyage.economicSnapshot.rawCargoFfy),
        conditionApplies: (condition) =>
          ffyEventConditionAppliesAtCell(
            state,
            holderId,
            destinationPort.cellId,
            condition,
          ),
      }),
    );
    terminalUnitIds.add(voyage.unitId);
  }

  const remainingVoyages = Object.freeze(
    state.tradeVoyages.filter(
      (voyage) => !terminalUnitIds.has(voyage.unitId),
    ),
  );
  const remainingUnits = Object.freeze(
    state.mobileUnits.filter((unit) => !terminalUnitIds.has(unit.id)),
  );
  const factions = state.factions.map((faction) => {
    const positiveEvents = positiveByOwner.get(faction.id) ?? [];
    const signedFacts = signedByOwner.get(faction.id) ?? [];
    if (positiveEvents.length === 0 && signedFacts.length === 0) return faction;
    const resolved = resolveFfyEconomicStage({
      balance: faction.ffy,
      rules: faction.rules,
      ruleDynamicState: ffyRuleDynamicState(state, faction.id),
      positiveEvents: Object.freeze([...positiveEvents]),
      signedFacts: Object.freeze([...signedFacts]),
    });
    const grossPositive = resolved.positiveEvents.reduce(
      (sum, event) => sum + event.award,
      0,
    );
    const lifetimeGrossPositiveFfyEarned =
      faction.lifetimeGrossPositiveFfyEarned + grossPositive;
    if (!Number.isSafeInteger(lifetimeGrossPositiveFfyEarned)) {
      throw new Error("Trade lifetime gross positive FFY exceeds safe range");
    }
    return Object.freeze({
      ...faction,
      ffy: resolved.balance,
      lifetimeGrossPositiveFfyEarned,
    });
  });

  return createProspectiveMatchState(state, {
    factions,
    mobileUnits: remainingUnits,
    tradeVoyages: remainingVoyages,
    tradePendingSignedFacts: Object.freeze([]),
    tradeRetiredPortEpochs: cleanupRetiredTradeEpochs(
      remainingVoyages,
      state.tradeRetiredPortEpochs,
    ),
  });
}

export type TerminateTradeShipAsDestroyedResult =
  | Readonly<{ ok: true; state: MatchState }>
  | Readonly<{
      ok: false;
      state: MatchState;
      failure: Readonly<{ code: "INVALID_REQUEST" }>;
    }>;

export function terminateTradeShipAsDestroyed(
  state: MatchState,
  request: Readonly<{ unitId: string }>,
): TerminateTradeShipAsDestroyedResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.unitId !== "string" ||
    request.unitId.length === 0
  ) {
    return Object.freeze({
      ok: false,
      state,
      failure: Object.freeze({ code: "INVALID_REQUEST" as const }),
    });
  }
  const voyage = state.tradeVoyages.find(
    (candidate) => candidate.unitId === request.unitId,
  );
  const unit = state.mobileUnits.find(
    (candidate) =>
      candidate.id === request.unitId && candidate.type === "TRADE_SHIP",
  );
  if (voyage === undefined || unit === undefined) {
    return Object.freeze({
      ok: false,
      state,
      failure: Object.freeze({ code: "INVALID_REQUEST" as const }),
    });
  }
  const remaining = removeMobileUnit(
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    request.unitId,
  );
  const tradeVoyages = Object.freeze(
    state.tradeVoyages.filter((candidate) => candidate.unitId !== request.unitId),
  );
  return Object.freeze({
    ok: true,
    state: createProspectiveMatchState(state, {
      mobileUnits: remaining.mobileUnits,
      nextMobileUnitOrdinal: remaining.nextMobileUnitOrdinal,
      tradeVoyages,
      tradeRetiredPortEpochs: cleanupRetiredTradeEpochs(
        tradeVoyages,
        state.tradeRetiredPortEpochs,
      ),
    }),
  });
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
  const tradeVoyages = Object.freeze(
    state.tradeVoyages.filter((voyage) => voyage.unitId !== unit.id),
  );
  const next = createProspectiveMatchState(state, {
    mobileUnits: remaining.mobileUnits,
    nextMobileUnitOrdinal: remaining.nextMobileUnitOrdinal,
    tradeVoyages,
    tradeRetiredPortEpochs: cleanupRetiredTradeEpochs(
      tradeVoyages,
      state.tradeRetiredPortEpochs,
    ),
  });
  return Object.freeze({ ok: true, state: next });
}
