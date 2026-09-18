import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  createMobileUnit,
  removeMobileUnit,
} from "./MobileUnits";

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

  const dockCellId = port.outputCellId;
  if (
    dockCellId === undefined ||
    !state.map.isValidCellId(dockCellId) ||
    state.map.terrainAt(dockCellId) !== "DEEP_WATER" ||
    state.structures.some((structure) => structure.cellId === dockCellId)
  ) {
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
  });
  return Object.freeze({ ok: true, state: next });
}
