export const DIRECT_REVEAL_DURATION_SECONDS = 15 as const;

export const TACTICAL_VISIBILITY_PRECEDENCE = [
  "EXPLICIT_PUBLIC",
  "DIRECT_REVEAL",
  "CONCEALMENT",
  "REMOTE_OBSERVATION",
  "UNREVEALED",
] as const;

export type TacticalVisibilityReason =
  | "SELF"
  | (typeof TACTICAL_VISIBILITY_PRECEDENCE)[number];

export interface TacticalVisibilityInput {
  readonly selfOwned: boolean;
  readonly explicitPublic: boolean;
  readonly directRevealActive: boolean;
  readonly concealed: boolean;
  readonly remotelyObserved: boolean;
}

export interface TacticalVisibilityDecision {
  readonly visible: boolean;
  readonly reason: TacticalVisibilityReason;
}

/**
 * Canonical requester-relative tactical visibility precedence. Self-owned state is
 * inherently known; every other subject follows the ordered public/reveal/
 * concealment/observation contract.
 */
export function resolveTacticalVisibility(
  input: TacticalVisibilityInput,
): TacticalVisibilityDecision {
  if (input.selfOwned) return { visible: true, reason: "SELF" };
  if (input.explicitPublic) {
    return { visible: true, reason: "EXPLICIT_PUBLIC" };
  }
  if (input.directRevealActive) {
    return { visible: true, reason: "DIRECT_REVEAL" };
  }
  if (input.concealed) return { visible: false, reason: "CONCEALMENT" };
  if (input.remotelyObserved) {
    return { visible: true, reason: "REMOTE_OBSERVATION" };
  }
  return { visible: false, reason: "UNREVEALED" };
}

/** P45's entire geometry predicate: owned Forest, with no boundary exception. */
export function isOwnedForestConcealmentCell(
  terrain: string,
  cellOwnerId: string | undefined,
  holderId: string,
): boolean {
  return terrain === "FOREST" && cellOwnerId === holderId;
}

function requireNonNegativeSafeTick(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer tick`);
  }
}

/** Resolve the 15-second contract onto the match's deterministic tick lattice. */
export function directRevealDurationTicks(ticksPerSecond: number): number {
  if (!Number.isSafeInteger(ticksPerSecond) || ticksPerSecond <= 0) {
    throw new Error("ticksPerSecond must be a positive safe integer");
  }
  const ticks = DIRECT_REVEAL_DURATION_SECONDS * ticksPerSecond;
  if (!Number.isSafeInteger(ticks)) {
    throw new Error("direct reveal duration exceeds safe-integer tick range");
  }
  return ticks;
}

/** A manifestation on tick T is visible through, but not including, this tick. */
export function directRevealExpiryExclusiveTick(
  manifestationTick: number,
  ticksPerSecond: number,
): number {
  requireNonNegativeSafeTick(manifestationTick, "manifestationTick");
  const expiry = manifestationTick + directRevealDurationTicks(ticksPerSecond);
  if (!Number.isSafeInteger(expiry)) {
    throw new Error("direct reveal expiry exceeds safe-integer tick range");
  }
  return expiry;
}

export function isDirectRevealActive(
  currentTick: number,
  expiryExclusiveTick: number,
): boolean {
  requireNonNegativeSafeTick(currentTick, "currentTick");
  requireNonNegativeSafeTick(expiryExclusiveTick, "expiryExclusiveTick");
  return currentTick < expiryExclusiveTick;
}

export type DirectRevealSourceKind = "UNIT" | "STRUCTURE" | "OPERATION";

export interface DirectRevealRecord {
  readonly viewerFactionId: string;
  readonly sourceKind: DirectRevealSourceKind;
  readonly sourceId: string;
  readonly expiryExclusiveTick: number;
}

function compareDirectRevealRecords(
  left: DirectRevealRecord,
  right: DirectRevealRecord,
): number {
  if (left.viewerFactionId !== right.viewerFactionId) {
    return left.viewerFactionId < right.viewerFactionId ? -1 : 1;
  }
  if (left.sourceKind !== right.sourceKind) {
    return left.sourceKind < right.sourceKind ? -1 : 1;
  }
  if (left.sourceId !== right.sourceId) {
    return left.sourceId < right.sourceId ? -1 : 1;
  }
  return 0;
}

function directRevealRecordKey(
  viewerFactionId: string,
  sourceKind: DirectRevealSourceKind,
  sourceId: string,
): string {
  return `${JSON.stringify(viewerFactionId)}\u0000${sourceKind}\u0000${JSON.stringify(sourceId)}`;
}

/**
 * Hostile manifestation refresh is keyed by source identity and lawful viewer,
 * so movement never clears the reveal and unrelated factions gain no reveal.
 */
export function refreshDirectReveal(
  viewerFactionId: string,
  sourceKind: DirectRevealSourceKind,
  sourceId: string,
  manifestationTick: number,
  ticksPerSecond: number,
): DirectRevealRecord {
  if (viewerFactionId.length === 0 || sourceId.length === 0) {
    throw new Error("direct reveal viewer/source identity must be non-empty");
  }
  return {
    viewerFactionId,
    sourceKind,
    sourceId,
    expiryExclusiveTick: directRevealExpiryExclusiveTick(
      manifestationTick,
      ticksPerSecond,
    ),
  };
}

export interface HostileManifestationInput {
  /** True only after the authoritative hostile effect actually resolved. */
  readonly resolved: boolean;
  /** True only for a hostile effect, never selection/tracking/private intent. */
  readonly hostile: boolean;
  /** Direct reveal requires one canonical source entity/operation identity. */
  readonly identifiableSource: boolean;
  /** Factions directly attacked by the resolved hostile effect. */
  readonly attackedFactionIds: readonly string[];
}

/**
 * Returns the deterministic directly-attacked faction set that receives
 * source-specific direct reveal. Third-party observers are never recipients.
 */
export function directRevealRecipients(
  manifestation: HostileManifestationInput,
): readonly string[] {
  if (
    !manifestation.resolved ||
    !manifestation.hostile ||
    !manifestation.identifiableSource
  ) {
    return [];
  }
  return Object.freeze(
    [
      ...new Set(
        manifestation.attackedFactionIds.filter((id) => id.length > 0),
      ),
    ].sort(),
  );
}

/**
 * Refreshes the source-specific reveal for every directly attacked faction and
 * preserves all unrelated viewer/source records.
 */
export function refreshDirectRevealRecords(
  records: readonly DirectRevealRecord[],
  manifestation: HostileManifestationInput,
  sourceKind: DirectRevealSourceKind,
  sourceId: string,
  manifestationTick: number,
  ticksPerSecond: number,
): readonly DirectRevealRecord[] {
  const recipients = directRevealRecipients(manifestation);
  if (recipients.length === 0) {
    return Object.freeze([...records].sort(compareDirectRevealRecords));
  }

  const refreshedByKey = new Map<string, DirectRevealRecord>();
  for (const record of records) {
    refreshedByKey.set(
      directRevealRecordKey(
        record.viewerFactionId,
        record.sourceKind,
        record.sourceId,
      ),
      record,
    );
  }
  for (const viewerFactionId of recipients) {
    const refreshed = refreshDirectReveal(
      viewerFactionId,
      sourceKind,
      sourceId,
      manifestationTick,
      ticksPerSecond,
    );
    refreshedByKey.set(
      directRevealRecordKey(viewerFactionId, sourceKind, sourceId),
      refreshed,
    );
  }

  return Object.freeze(
    [...refreshedByKey.values()].sort(compareDirectRevealRecords),
  );
}

/** Drops every source-specific reveal at its exclusive expiry tick. */
export function pruneExpiredDirectReveals(
  records: readonly DirectRevealRecord[],
  currentTick: number,
): readonly DirectRevealRecord[] {
  requireNonNegativeSafeTick(currentTick, "currentTick");
  return Object.freeze(
    records
      .filter((record) =>
        isDirectRevealActive(currentTick, record.expiryExclusiveTick),
      )
      .sort(compareDirectRevealRecords),
  );
}
