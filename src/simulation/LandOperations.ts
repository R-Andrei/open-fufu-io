import {
  resolveLandTick as resolveLandTickCore,
  type LandFactionStateLike,
  type LandTickResult as CoreLandTickResult,
  type LandTickStateLike,
} from "./LandOperationsCore";
import {
  createCellOwnershipChangedEvent,
  type CellOwnershipChangedEvent,
} from "./SimulationEvents";

export * from "./LandOperationsCore";

export type LandTickResult<F extends LandFactionStateLike> =
  CoreLandTickResult<F> & {
    readonly events: readonly CellOwnershipChangedEvent[];
  };

function assertTransitionTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) {
    throw new Error("land event transition tick must be a non-negative safe integer");
  }
}

function cellOwnershipEventId(tick: number, cellId: number): string {
  return `land:cell-ownership:${tick}:${cellId}`;
}

export function resolveLandTick<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  transitionTick: number,
): LandTickResult<F> {
  assertTransitionTick(transitionTick);
  const result = resolveLandTickCore(state);
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
