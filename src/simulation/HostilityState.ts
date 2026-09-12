import {
  hostilitySideOf,
  type HostilitySideIdentity,
} from "../core/FactionRelations";
import type { FactionStatus } from "../core/controller/ControllerApi";
import type { LandOperationState } from "./LandOperations";
import type {
  FactionCapitulatedEvent,
  HostilityLifecycleSimulationEvent,
  PersistentDirectedHostilitySourceEndedEvent,
} from "./SimulationEvents";

export const HOSTILITY_GRACE_TICKS = 600;

export interface HostilityFactionStateLike {
  readonly id: string;
  readonly status: FactionStatus;
  readonly fixedTeamId?: string;
}

export interface HostilityGraceState {
  readonly sideA: HostilitySideIdentity;
  readonly sideB: HostilitySideIdentity;
  readonly expiresAtTickExclusive: number;
}

export interface HostilityStateLike<
  F extends HostilityFactionStateLike = HostilityFactionStateLike,
> {
  readonly tick: number;
  readonly factions: readonly F[];
  readonly operations: readonly LandOperationState[];
  readonly hostilityGrace: readonly HostilityGraceState[];
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertNonEmptyId(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertTransitionTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) {
    throw new Error("hostility transition tick must be a non-negative safe integer");
  }
}

export function canonicalHostilitySideKey(side: HostilitySideIdentity): string {
  return `${side.kind}\u0000${side.id}`;
}

function materializeSide(side: HostilitySideIdentity): HostilitySideIdentity {
  if (side === null || typeof side !== "object") {
    throw new Error("hostility side must be an object");
  }
  if (side.kind !== "FACTION" && side.kind !== "FIXED_TEAM") {
    throw new Error("unsupported hostility side kind");
  }
  assertNonEmptyId(side.id, "hostility side id");
  return Object.freeze({ kind: side.kind, id: side.id });
}

function normalizedPair(
  left: HostilitySideIdentity,
  right: HostilitySideIdentity,
): {
  readonly key: string;
  readonly sideA: HostilitySideIdentity;
  readonly sideB: HostilitySideIdentity;
} | undefined {
  const leftKey = canonicalHostilitySideKey(left);
  const rightKey = canonicalHostilitySideKey(right);
  if (leftKey === rightKey) return undefined;
  if (leftKey < rightKey) {
    return Object.freeze({
      key: `${leftKey}\u0001${rightKey}`,
      sideA: materializeSide(left),
      sideB: materializeSide(right),
    });
  }
  return Object.freeze({
    key: `${rightKey}\u0001${leftKey}`,
    sideA: materializeSide(right),
    sideB: materializeSide(left),
  });
}

function factionSide(faction: HostilityFactionStateLike): HostilitySideIdentity {
  return hostilitySideOf({
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  });
}

function factionById<F extends HostilityFactionStateLike>(
  factions: readonly F[],
  id: string,
): F | undefined {
  return factions.find((entry) => entry.id === id);
}

function sideHasActiveFaction<F extends HostilityFactionStateLike>(
  factions: readonly F[],
  side: HostilitySideIdentity,
): boolean {
  return factions.some(
    (faction) =>
      faction.status === "ACTIVE" &&
      canonicalHostilitySideKey(factionSide(faction)) ===
        canonicalHostilitySideKey(side),
  );
}

function activePersistentPairs<F extends HostilityFactionStateLike>(
  factions: readonly F[],
  operations: readonly LandOperationState[],
): ReadonlyMap<
  string,
  { readonly sideA: HostilitySideIdentity; readonly sideB: HostilitySideIdentity }
> {
  const pairs = new Map<
    string,
    { readonly sideA: HostilitySideIdentity; readonly sideB: HostilitySideIdentity }
  >();

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

    const source = factionById(factions, sourceFactionId);
    const target = factionById(factions, targetFactionId);
    if (
      source === undefined ||
      target === undefined ||
      source.status !== "ACTIVE" ||
      target.status !== "ACTIVE"
    ) {
      continue;
    }
    const pair = normalizedPair(factionSide(source), factionSide(target));
    if (pair !== undefined) {
      pairs.set(pair.key, Object.freeze({ sideA: pair.sideA, sideB: pair.sideB }));
    }
  }

  return pairs;
}

export function materializeHostilityGraceState(
  state: HostilityGraceState,
): HostilityGraceState {
  if (
    !Number.isSafeInteger(state.expiresAtTickExclusive) ||
    state.expiresAtTickExclusive < 0
  ) {
    throw new Error("hostility expiry tick must be a non-negative safe integer");
  }
  const pair = normalizedPair(
    materializeSide(state.sideA),
    materializeSide(state.sideB),
  );
  if (pair === undefined) {
    throw new Error("hostility grace requires two distinct sides");
  }
  return Object.freeze({
    sideA: pair.sideA,
    sideB: pair.sideB,
    expiresAtTickExclusive: state.expiresAtTickExclusive,
  });
}

function graceKey(state: HostilityGraceState): string {
  const pair = normalizedPair(state.sideA, state.sideB);
  if (pair === undefined) {
    throw new Error("hostility grace requires two distinct sides");
  }
  return pair.key;
}

function addGraceForPair(
  grace: Map<string, HostilityGraceState>,
  pair: {
    readonly key: string;
    readonly sideA: HostilitySideIdentity;
    readonly sideB: HostilitySideIdentity;
  },
  transitionTick: number,
): void {
  const existing = grace.get(pair.key)?.expiresAtTickExclusive ?? 0;
  grace.set(
    pair.key,
    Object.freeze({
      sideA: pair.sideA,
      sideB: pair.sideB,
      expiresAtTickExclusive: Math.max(
        existing,
        transitionTick + HOSTILITY_GRACE_TICKS,
      ),
    }),
  );
}

function eventPair(
  event: PersistentDirectedHostilitySourceEndedEvent,
): {
  readonly key: string;
  readonly sideA: HostilitySideIdentity;
  readonly sideB: HostilitySideIdentity;
} {
  const sourceSide = materializeSide(event.payload.sourceSide);
  const targetSide = materializeSide(event.payload.targetSide);
  const pair = normalizedPair(sourceSide, targetSide);
  if (pair === undefined) {
    throw new Error("ended hostility source requires two distinct sides");
  }
  return pair;
}

function hypotheticalPairsBeforeCapitulation<
  F extends HostilityFactionStateLike,
>(
  state: HostilityStateLike<F>,
  factionId: string,
): ReadonlyMap<
  string,
  { readonly sideA: HostilitySideIdentity; readonly sideB: HostilitySideIdentity }
> {
  const factions = state.factions.map((faction) =>
    faction.id === factionId
      ? ({ ...faction, status: "ACTIVE" as const } as F)
      : faction,
  );
  return activePersistentPairs(factions, state.operations);
}

function validateEventEnvelope(
  event: HostilityLifecycleSimulationEvent,
  transitionTick: number,
): void {
  assertNonEmptyId(event.id, "hostility event id");
  if (event.tick !== transitionTick) {
    throw new Error(
      `hostility event tick ${event.tick} does not match transition tick ${transitionTick}`,
    );
  }
}

function capitulatedFactionFromEvent<F extends HostilityFactionStateLike>(
  state: HostilityStateLike<F>,
  event: FactionCapitulatedEvent,
): F {
  assertNonEmptyId(event.payload.factionId, "capitulated factionId");
  const faction = factionById(state.factions, event.payload.factionId);
  if (faction === undefined) {
    throw new Error(`unknown capitulated faction: ${event.payload.factionId}`);
  }
  if (faction.status !== "CAPITULATED") {
    throw new Error(
      `capitulation event does not match post-producer faction state: ${event.payload.factionId}`,
    );
  }
  return faction;
}

export function resolveHostilityGraceFromEvents<
  F extends HostilityFactionStateLike,
>(
  state: HostilityStateLike<F>,
  events: readonly HostilityLifecycleSimulationEvent[],
  transitionTick: number,
): readonly HostilityGraceState[] {
  assertTransitionTick(transitionTick);
  const currentPairs = activePersistentPairs(state.factions, state.operations);
  const grace = new Map<string, HostilityGraceState>();

  for (const entry of state.hostilityGrace.map(materializeHostilityGraceState)) {
    if (entry.expiresAtTickExclusive > transitionTick) {
      grace.set(graceKey(entry), entry);
    }
  }

  const seenEventIds = new Set<string>();
  for (const event of events) {
    validateEventEnvelope(event, transitionTick);
    if (seenEventIds.has(event.id)) {
      throw new Error(`duplicate hostility event id: ${event.id}`);
    }
    seenEventIds.add(event.id);

    if (event.kind === "PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED") {
      const pair = eventPair(event);
      if (
        !currentPairs.has(pair.key) &&
        sideHasActiveFaction(state.factions, pair.sideA) &&
        sideHasActiveFaction(state.factions, pair.sideB)
      ) {
        addGraceForPair(grace, pair, transitionTick);
      }
      continue;
    }

    if (event.kind === "FACTION_CAPITULATED") {
      const faction = capitulatedFactionFromEvent(state, event);
      const beforePairs = hypotheticalPairsBeforeCapitulation(state, faction.id);
      for (const [key, pair] of beforePairs) {
        if (
          currentPairs.has(key) ||
          !sideHasActiveFaction(state.factions, pair.sideA) ||
          !sideHasActiveFaction(state.factions, pair.sideB)
        ) {
          continue;
        }
        addGraceForPair(
          grace,
          Object.freeze({ key, sideA: pair.sideA, sideB: pair.sideB }),
          transitionTick,
        );
      }
      continue;
    }

    const exhaustive: never = event;
    throw new Error(
      `unsupported hostility lifecycle event: ${String(
        (exhaustive as { readonly kind?: unknown }).kind,
      )}`,
    );
  }

  return Object.freeze(
    [...grace.entries()]
      .filter(
        ([, entry]) =>
          sideHasActiveFaction(state.factions, entry.sideA) &&
          sideHasActiveFaction(state.factions, entry.sideB) &&
          entry.expiresAtTickExclusive > transitionTick,
      )
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([, entry]) => materializeHostilityGraceState(entry)),
  );
}

export function matchStateAtWar<F extends HostilityFactionStateLike>(
  state: HostilityStateLike<F>,
  factionAId: string,
  factionBId: string,
): boolean {
  const factionA = factionById(state.factions, factionAId);
  const factionB = factionById(state.factions, factionBId);
  if (
    factionA === undefined ||
    factionB === undefined ||
    factionA.status !== "ACTIVE" ||
    factionB.status !== "ACTIVE"
  ) {
    return false;
  }
  const pair = normalizedPair(factionSide(factionA), factionSide(factionB));
  if (pair === undefined) return false;
  if (activePersistentPairs(state.factions, state.operations).has(pair.key)) {
    return true;
  }
  return state.hostilityGrace.some(
    (entry) =>
      graceKey(entry) === pair.key &&
      state.tick < entry.expiresAtTickExclusive,
  );
}
