import {
  hostilitySideOf,
  type HostilitySideIdentity,
} from "../core/FactionRelations";
import type { DirectiveChanges } from "../core/controller/ControllerApi";
import {
  resolveLandTick as resolveLandTickCore,
  tryApplyPersistentDirectiveChanges as tryApplyPersistentDirectiveChangesCore,
  type LandDirectiveApplyResult,
  type LandDirectiveStateLike,
  type LandFactionStateLike,
  type LandOperationState,
  type LandTickResult as CoreLandTickResult,
  type LandTickStateLike,
} from "./LandOperationsCore";
import {
  createCellOwnershipChangedEvent,
  createPersistentDirectedHostilitySourceEndedEvent,
  type CellOwnershipChangedEvent,
  type PersistentDirectedHostilitySourceEndedEvent,
} from "./SimulationEvents";

export * from "./LandOperationsCore";

export type LandSimulationEvent =
  | CellOwnershipChangedEvent
  | PersistentDirectedHostilitySourceEndedEvent;

export type LandTickResult<F extends LandFactionStateLike> =
  CoreLandTickResult<F> & {
    readonly events: readonly LandSimulationEvent[];
  };

export type LandDirectiveApplyResultWithEvents<F extends LandFactionStateLike> =
  | (Extract<LandDirectiveApplyResult<F>, { readonly ok: true }> & {
      readonly events: readonly PersistentDirectedHostilitySourceEndedEvent[];
    })
  | Extract<LandDirectiveApplyResult<F>, { readonly ok: false }>;

export interface LandDirectiveEventContext {
  readonly transitionTick: number;
  readonly acceptedInputSequence: number;
}

interface PersistentHostilitySourceProjection {
  readonly key: string;
  readonly sourceSide: HostilitySideIdentity;
  readonly targetSide: HostilitySideIdentity;
}

function assertTransitionTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) {
    throw new Error("land event transition tick must be a non-negative safe integer");
  }
}

function assertAcceptedInputSequence(sequence: number): void {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || Object.is(sequence, -0)) {
    throw new Error("accepted input sequence must be a non-negative safe integer");
  }
}

function cellOwnershipEventId(tick: number, cellId: number): string {
  return `land:cell-ownership:${tick}:${cellId}`;
}

function hostilitySideKey(side: HostilitySideIdentity): string {
  return `${side.kind}\u0000${side.id}`;
}

function factionHostilitySide<F extends LandFactionStateLike>(
  factions: readonly F[],
  factionId: string,
): HostilitySideIdentity | undefined {
  const faction = factions.find((entry) => entry.id === factionId);
  if (faction === undefined || faction.status !== "ACTIVE") return undefined;
  return hostilitySideOf({
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined ? {} : { fixedTeamId: faction.fixedTeamId }),
  });
}

function sourceProjectionKey(
  operation: LandOperationState,
  sourceSide: HostilitySideIdentity,
  targetSide: HostilitySideIdentity,
): string {
  return [
    operation.kind,
    operation.id,
    hostilitySideKey(sourceSide),
    hostilitySideKey(targetSide),
  ].join("\u0001");
}

function activePersistentHostilitySources<F extends LandFactionStateLike>(
  factions: readonly F[],
  operations: readonly LandOperationState[],
): ReadonlyMap<string, PersistentHostilitySourceProjection> {
  const result = new Map<string, PersistentHostilitySourceProjection>();

  for (const operation of operations) {
    if (operation.committedPopulation <= 0) continue;

    let sourceFactionId: string;
    let targetFactionId: string;

    if (operation.kind === "ATTACK") {
      sourceFactionId = operation.ownerId;
      targetFactionId = operation.targetFactionId;
    } else if (operation.kind === "COUNTER_RESPONSE") {
      const incoming = operations.find(
        (candidate) =>
          candidate.id === operation.incomingOperationId &&
          candidate.kind === "ATTACK" &&
          candidate.committedPopulation > 0,
      );
      if (incoming === undefined) continue;
      sourceFactionId = operation.ownerId;
      targetFactionId = incoming.ownerId;
    } else {
      continue;
    }

    const sourceSide = factionHostilitySide(factions, sourceFactionId);
    const targetSide = factionHostilitySide(factions, targetFactionId);
    if (
      sourceSide === undefined ||
      targetSide === undefined ||
      hostilitySideKey(sourceSide) === hostilitySideKey(targetSide)
    ) {
      continue;
    }

    const key = sourceProjectionKey(operation, sourceSide, targetSide);
    result.set(
      key,
      Object.freeze({
        key,
        sourceSide: Object.freeze({ ...sourceSide }),
        targetSide: Object.freeze({ ...targetSide }),
      }),
    );
  }

  return result;
}

function endedPersistentHostilitySources<F extends LandFactionStateLike>(
  beforeFactions: readonly F[],
  beforeOperations: readonly LandOperationState[],
  afterFactions: readonly F[],
  afterOperations: readonly LandOperationState[],
): readonly PersistentHostilitySourceProjection[] {
  const before = activePersistentHostilitySources(beforeFactions, beforeOperations);
  const after = activePersistentHostilitySources(afterFactions, afterOperations);
  return Object.freeze(
    [...before.entries()]
      .filter(([key]) => !after.has(key))
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([, projection]) => projection),
  );
}

function directiveEndedSourceEventId(
  tick: number,
  sequence: number,
  ordinal: number,
): string {
  return `land:hostility-source-ended:directive:${tick}:${sequence}:${ordinal}`;
}

function tickEndedSourceEventId(tick: number, ordinal: number): string {
  return `land:hostility-source-ended:tick:${tick}:${ordinal}`;
}

export function tryApplyPersistentDirectiveChangesWithEvents<
  F extends LandFactionStateLike,
>(
  state: LandDirectiveStateLike<F>,
  factionId: string,
  changes: DirectiveChanges,
  context: LandDirectiveEventContext,
): LandDirectiveApplyResultWithEvents<F> {
  assertTransitionTick(context.transitionTick);
  assertAcceptedInputSequence(context.acceptedInputSequence);

  const result = tryApplyPersistentDirectiveChangesCore(state, factionId, changes);
  if (!result.ok) return result;

  const ended = endedPersistentHostilitySources(
    state.factions,
    state.operations,
    result.factions,
    result.operations,
  );
  const events = ended.map((source, ordinal) =>
    createPersistentDirectedHostilitySourceEndedEvent({
      id: directiveEndedSourceEventId(
        context.transitionTick,
        context.acceptedInputSequence,
        ordinal,
      ),
      tick: context.transitionTick,
      sourceSide: source.sourceSide,
      targetSide: source.targetSide,
    }),
  );

  return Object.freeze({
    ...result,
    events: Object.freeze(events),
  });
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

  const events: LandSimulationEvent[] = [];
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

  const ended = endedPersistentHostilitySources(
    state.factions,
    state.operations,
    result.factions,
    result.operations,
  );
  ended.forEach((source, ordinal) => {
    events.push(
      createPersistentDirectedHostilitySourceEndedEvent({
        id: tickEndedSourceEventId(transitionTick, ordinal),
        tick: transitionTick,
        sourceSide: source.sourceSide,
        targetSide: source.targetSide,
      }),
    );
  });

  return Object.freeze({
    ...result,
    events: Object.freeze(events),
  });
}
