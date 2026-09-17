import { tryDebitFfy } from "./Economy";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  createMobileUnit,
  type MobileUnitCollectionState,
} from "./MobileUnits";
import type { PersistentStructureState } from "./Structures";

export type WarshipProductionJobState =
  | {
      readonly portId: string;
      readonly ownerId: string;
      readonly state: "BUILDING";
      readonly remainingTicks: number;
    }
  | {
      readonly portId: string;
      readonly ownerId: string;
      readonly state: "READY_TO_DEPLOY";
    };

export interface StartWarshipProductionRequest {
  readonly ownerId: string;
  readonly portId: string;
}

export type WarshipProductionFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "UNKNOWN_PORT"
  | "NOT_OWNER"
  | "PORT_INACTIVE"
  | "PORT_LEVEL_REQUIRED"
  | "PORT_CAPACITY"
  | "INSUFFICIENT_FFY";

export type StartWarshipProductionResult =
  | {
      readonly ok: true;
      readonly cost: number;
      readonly job: WarshipProductionJobState;
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: WarshipProductionFailureCode }>;
      readonly state: MatchState;
    };

const BASE_WARSHIP_BUILD_TICKS = 50;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure(
  state: MatchState,
  code: WarshipProductionFailureCode,
): StartWarshipProductionResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

function activeWarshipCount(state: MatchState, ownerId: string): number {
  return state.mobileUnits.filter(
    (unit) => unit.ownerId === ownerId && unit.type === "WARSHIP",
  ).length;
}

export function warshipPurchaseCost(activeWarships: number): number {
  if (
    !Number.isSafeInteger(activeWarships) ||
    activeWarships < 0 ||
    Object.is(activeWarships, -0)
  ) {
    throw new Error("active Warship count must be a non-negative safe integer");
  }
  return Math.min(1_000_000, 250_000 * (activeWarships + 1));
}

export function tryStartWarshipProduction(
  state: MatchState,
  request: StartWarshipProductionRequest,
): StartWarshipProductionResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.portId !== "string" ||
    request.portId.length === 0
  ) {
    return failure(state, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return failure(state, "UNKNOWN_OWNER");
  const port = state.structures.find((structure) => structure.id === request.portId);
  if (port === undefined || port.type !== "PORT") {
    return failure(state, "UNKNOWN_PORT");
  }
  if (port.ownerId !== request.ownerId) return failure(state, "NOT_OWNER");
  if (!port.active) return failure(state, "PORT_INACTIVE");
  if (port.completedLevel === undefined || port.completedLevel < 1) {
    return failure(state, "PORT_LEVEL_REQUIRED");
  }
  if (state.warshipProductionJobs.some((job) => job.portId === request.portId)) {
    return failure(state, "PORT_CAPACITY");
  }

  const debit = tryDebitFfy(
    owner.ffy,
    Object.freeze({
      numerator: BigInt(
        warshipPurchaseCost(activeWarshipCount(state, request.ownerId)),
      ),
      denominator: 1n,
    }),
  );
  if (!debit.ok) return failure(state, "INSUFFICIENT_FFY");

  const job: WarshipProductionJobState = Object.freeze({
    portId: port.id,
    ownerId: request.ownerId,
    state: "BUILDING" as const,
    remainingTicks: BASE_WARSHIP_BUILD_TICKS,
  });
  const factions = state.factions.map((faction) =>
    faction.id === request.ownerId
      ? Object.freeze({ ...faction, ffy: debit.balance })
      : faction,
  );
  const jobs = Object.freeze(
    [...state.warshipProductionJobs, job].sort((left, right) =>
      compareIds(left.portId, right.portId),
    ),
  );
  const next = createProspectiveMatchState(state, {
    factions,
    warshipProductionJobs: jobs,
  });
  return Object.freeze({
    ok: true,
    cost: debit.cost,
    job,
    state: next,
  });
}

function warshipDeploymentCell(
  state: MatchState,
  port: PersistentStructureState,
): number | undefined {
  const cellId = port.outputCellId;
  if (cellId === undefined || !state.map.isValidCellId(cellId)) return undefined;
  if (state.map.terrainAt(cellId) !== "DEEP_WATER") return undefined;
  if (state.structures.some((structure) => structure.cellId === cellId)) return undefined;
  if (state.mobileUnits.some((unit) => unit.cellId === cellId)) return undefined;
  return cellId;
}

function waitingDeploymentJob(
  job: WarshipProductionJobState,
): WarshipProductionJobState {
  return Object.freeze({
    portId: job.portId,
    ownerId: job.ownerId,
    state: "READY_TO_DEPLOY" as const,
  });
}

export function advanceWarshipProductionPhase(state: MatchState): MatchState {
  let units: MobileUnitCollectionState = Object.freeze({
    mobileUnits: state.mobileUnits,
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  });
  const nextJobs: WarshipProductionJobState[] = [];
  const ownerIds = state.factions.map((faction) => faction.id);
  const jobs = [...state.warshipProductionJobs].sort((left, right) =>
    compareIds(left.portId, right.portId),
  );

  for (const job of jobs) {
    const port = state.structures.find((structure) => structure.id === job.portId);
    if (
      port === undefined ||
      port.type !== "PORT" ||
      port.ownerId !== job.ownerId
    ) {
      continue;
    }

    if (!port.active || port.completedLevel === undefined) {
      nextJobs.push(job);
      continue;
    }

    const deploy = (): boolean => {
      const cellId = warshipDeploymentCell(
        createProspectiveMatchState(state, {
          mobileUnits: units.mobileUnits,
          nextMobileUnitOrdinal: units.nextMobileUnitOrdinal,
        }),
        port,
      );
      if (cellId === undefined) return false;
      const created = createMobileUnit(state.map, ownerIds, units, {
        ownerId: job.ownerId,
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId,
      });
      units = Object.freeze({
        mobileUnits: created.mobileUnits,
        nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      });
      return true;
    };

    if (job.state === "READY_TO_DEPLOY") {
      if (!deploy()) nextJobs.push(job);
      continue;
    }

    if (job.remainingTicks > 1) {
      nextJobs.push(
        Object.freeze({
          portId: job.portId,
          ownerId: job.ownerId,
          state: "BUILDING" as const,
          remainingTicks: job.remainingTicks - 1,
        }),
      );
      continue;
    }

    if (!deploy()) nextJobs.push(waitingDeploymentJob(job));
  }

  return createProspectiveMatchState(state, {
    mobileUnits: units.mobileUnits,
    nextMobileUnitOrdinal: units.nextMobileUnitOrdinal,
    warshipProductionJobs: nextJobs,
  });
}