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

  const targets = lawfulDeliveryCells(state, request.destinationPortId).map(
    (cellId) => Object.freeze({ cellId, intentWeight: 0 }),
  );
  if (targets.length === 0) {
    return voyageLaunchFailure(state, "ROUTE_UNREACHABLE");
  }

  const navigation = createNavigation(state.map);
  const route = navigation.pathBetweenCandidates(
    Object.freeze([{ cellId: dockCellId, intentWeight: 0 }]),
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
  if (route.status === "UNREACHABLE") {
    return voyageLaunchFailure(state, "ROUTE_UNREACHABLE");
  }
  if (route.status === "LIMIT_REACHED") {
    throw new Error("unbounded Trade voyage route resolution reached a work limit");
  }

  const physical = tryLaunchTradeShipAtPortDock(state, request);
  if (!physical.ok) {
    return voyageLaunchFailure(state, physical.failure.code);
  }

  const plannedRouteLengthCells = route.route.path.totalWeight;
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

  const routed = assignMobileUnitRoute(state.map, physical.unit, {
    cells: route.route.path.cells,
    edgeWeights: Array.from(
      { length: Math.max(0, route.route.path.cells.length - 1) },
      () => 1,
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
