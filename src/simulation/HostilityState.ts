import {
  hostilitySideOf,
  type HostilitySideIdentity,
} from "../core/FactionRelations";
import type { FactionStatus } from "../core/controller/ControllerApi";
import type { LandOperationState } from "./LandOperations";

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

export interface HostilityStateLike<F extends HostilityFactionStateLike = HostilityFactionStateLike> {
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

export function canonicalHostilitySideKey(side: HostilitySideIdentity): string {
  return `${side.kind}\u0000${side.id}`;
}

function materializeSide(side: HostilitySideIdentity): HostilitySideIdentity {
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
    ...(faction.fixedTeamId === undefined ? {} : { fixedTeamId: faction.fixedTeamId }),
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
      canonicalHostilitySideKey(factionSide(faction)) === canonicalHostilitySideKey(side),
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
  if (!Number.isSafeInteger(state.expiresAtTickExclusive) || state.expiresAtTickExclusive < 0) {
    throw new Error("hostility expiry tick must be a non-negative safe integer");
  }
  const pair = normalizedPair(state.sideA, state.sideB);
  if (pair === undefined) throw new Error("hostility grace requires two distinct sides");
  return Object.freeze({
    sideA: pair.sideA,
    sideB: pair.sideB,
    expiresAtTickExclusive: state.expiresAtTickExclusive,
  });
}

function graceKey(state: HostilityGraceState): string {
  const pair = normalizedPair(state.sideA, state.sideB);
  if (pair === undefined) throw new Error("hostility grace requires two distinct sides");
  return pair.key;
}

export function reconcileHostilityGrace<F extends HostilityFactionStateLike>(
  beforeFactions: readonly F[],
  beforeOperations: readonly LandOperationState[],
  afterFactions: readonly F[],
  afterOperations: readonly LandOperationState[],
  previousGrace: readonly HostilityGraceState[],
  transitionTick: number,
): readonly HostilityGraceState[] {
  if (!Number.isSafeInteger(transitionTick) || transitionTick < 0) {
    throw new Error("hostility transition tick must be a non-negative safe integer");
  }
  const beforePairs = activePersistentPairs(beforeFactions, beforeOperations);
  const afterPairs = activePersistentPairs(afterFactions, afterOperations);
  const grace = new Map<string, HostilityGraceState>();

  for (const entry of previousGrace.map(materializeHostilityGraceState)) {
    if (entry.expiresAtTickExclusive > transitionTick) grace.set(graceKey(entry), entry);
  }

  for (const [key, pair] of beforePairs) {
    if (afterPairs.has(key)) continue;
    const existing = grace.get(key)?.expiresAtTickExclusive ?? 0;
    grace.set(
      key,
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

  return Object.freeze(
    [...grace.entries()]
      .filter(([, entry]) =>
        sideHasActiveFaction(afterFactions, entry.sideA) &&
        sideHasActiveFaction(afterFactions, entry.sideB) &&
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
  if (activePersistentPairs(state.factions, state.operations).has(pair.key)) return true;
  return state.hostilityGrace.some(
    (entry) => graceKey(entry) === pair.key && state.tick < entry.expiresAtTickExclusive,
  );
}
