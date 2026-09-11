import type { FactionId } from "../core/controller/ControllerApi";
import {
  resolveLandTick,
  type LandFactionStateLike,
  type LandTickResult,
  type LandTickStateLike,
} from "./LandOperations";
import type { MatchState } from "./MatchState";
import {
  createCellOwnershipChangedEvent,
  type CellOwnershipChangedEvent,
} from "./SimulationEvents";
import {
  resolvePersistentStructureLifecycleTick,
  type PersistentStructureState,
} from "./Structures";

export interface LandTickWithEventsResult<F extends LandFactionStateLike>
  extends LandTickResult<F> {
  readonly events: readonly CellOwnershipChangedEvent[];
}

function assertTransitionTick(tick: number, label: string): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function cellOwnershipEventId(tick: number, cellId: number): string {
  return `land:cell-ownership:${tick}:${cellId}`;
}

export function resolveLandTickWithEvents<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  transitionTick: number,
): LandTickWithEventsResult<F> {
  assertTransitionTick(transitionTick, "land event transition tick");
  const result = resolveLandTick(state);
  if (result.ownership.length !== state.ownership.length) {
    throw new Error("land ownership result length must match input ownership");
  }

  const events: CellOwnershipChangedEvent[] = [];
  for (let cellId = 0; cellId < result.ownership.length; cellId += 1) {
    const previousOwnerId = state.ownership[cellId] ?? null;
    const nextOwnerId = result.ownership[cellId] ?? null;
    if (previousOwnerId === nextOwnerId) continue;
    events.push(
      createCellOwnershipChangedEvent({
        id: cellOwnershipEventId(transitionTick, cellId),
        tick: transitionTick,
        cellId,
        previousOwnerId,
        nextOwnerId,
      }),
    );
  }

  return Object.freeze({
    ...result,
    events: Object.freeze(events),
  });
}

function isFactionIdOrNull(value: unknown): value is FactionId | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

function validateOwnershipEventBatch(
  state: MatchState,
  events: readonly CellOwnershipChangedEvent[],
  currentTick: number,
): readonly CellOwnershipChangedEvent[] {
  const seenCells = new Set<number>();
  const validated: CellOwnershipChangedEvent[] = [];

  for (const candidate of events as readonly unknown[]) {
    if (candidate === null || typeof candidate !== "object") {
      throw new Error("cell ownership event must be an object");
    }
    const event = candidate as Partial<CellOwnershipChangedEvent> & {
      payload?: Partial<CellOwnershipChangedEvent["payload"]>;
    };
    if (event.kind !== "CELL_OWNERSHIP_CHANGED") {
      throw new Error("structure lifecycle received a non-ownership event");
    }
    if (typeof event.id !== "string" || event.id.length === 0) {
      throw new Error("cell ownership event id must be a non-empty string");
    }
    if (event.tick !== currentTick) {
      throw new Error("cell ownership event tick must match structure lifecycle tick");
    }
    if (event.payload === null || typeof event.payload !== "object") {
      throw new Error("cell ownership event payload must be an object");
    }

    const cellId = event.payload.cellId;
    if (
      typeof cellId !== "number" ||
      !Number.isSafeInteger(cellId) ||
      cellId < 0 ||
      Object.is(cellId, -0) ||
      cellId >= state.ownership.length
    ) {
      throw new Error("cell ownership event cellId is outside MatchState ownership");
    }
    if (seenCells.has(cellId)) {
      throw new Error(`duplicate cell ownership event for cell ${cellId}`);
    }
    seenCells.add(cellId);

    const previousOwnerId = event.payload.previousOwnerId;
    const nextOwnerId = event.payload.nextOwnerId;
    if (!isFactionIdOrNull(previousOwnerId) || !isFactionIdOrNull(nextOwnerId)) {
      throw new Error("cell ownership event owner ids must be null or non-empty strings");
    }
    if (previousOwnerId === nextOwnerId) {
      throw new Error("cell ownership event requires distinct previous and next owners");
    }
    if ((state.ownership[cellId] ?? null) !== nextOwnerId) {
      throw new Error(
        `cell ownership event next owner does not match current ownership for cell ${cellId}`,
      );
    }

    validated.push(event as CellOwnershipChangedEvent);
  }

  return Object.freeze(validated);
}

export function resolvePersistentStructureLifecycleFromEvents(
  state: MatchState,
  events: readonly CellOwnershipChangedEvent[],
  currentTick: number,
): readonly PersistentStructureState[] {
  assertTransitionTick(currentTick, "structure lifecycle tick");
  const validated = validateOwnershipEventBatch(state, events, currentTick);
  const eventCells = new Set(validated.map((event) => event.payload.cellId));

  // The legacy structure core still accepts a whole ownership raster internally.
  // Mask mismatches that were not explicitly delivered as ownership facts so the
  // cross-system boundary cannot rediscover an occurrence from current state.
  const routedOwnership = [...state.ownership];
  for (const structure of state.structures) {
    if (eventCells.has(structure.cellId)) continue;
    if ((routedOwnership[structure.cellId] ?? null) !== structure.ownerId) {
      routedOwnership[structure.cellId] = structure.ownerId;
    }
  }

  return resolvePersistentStructureLifecycleTick(
    state,
    Object.freeze(routedOwnership),
    currentTick,
  );
}
