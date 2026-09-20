export interface WarshipProgressionState {
  readonly unitId: string;
  readonly rank: number;
  readonly navalXp: number;
}

const NAVAL_XP_PER_RANK = 100;

function assertNonEmptyUnitId(unitId: string): void {
  if (typeof unitId !== "string" || unitId.length === 0) {
    throw new Error("Warship progression unitId must be a non-empty string");
  }
}

function assertRank(rank: number): void {
  if (!Number.isSafeInteger(rank) || rank < 1) {
    throw new Error("Warship rank must be a positive safe integer");
  }
}

function assertNavalXp(navalXp: number): void {
  if (
    !Number.isSafeInteger(navalXp) ||
    navalXp < 0 ||
    navalXp >= NAVAL_XP_PER_RANK
  ) {
    throw new Error("Warship carried Naval XP must be in 0..99");
  }
}

export function createWarshipProgressionState(
  unitId: string,
): WarshipProgressionState {
  assertNonEmptyUnitId(unitId);
  return Object.freeze({ unitId, rank: 1, navalXp: 0 });
}

export function materializeWarshipProgressionState(
  state: WarshipProgressionState,
): WarshipProgressionState {
  if (state === null || typeof state !== "object") {
    throw new Error("Warship progression state must be an object");
  }
  assertNonEmptyUnitId(state.unitId);
  assertRank(state.rank);
  assertNavalXp(state.navalXp);
  return Object.freeze({
    unitId: state.unitId,
    rank: state.rank,
    navalXp: state.navalXp,
  });
}

export function awardWarshipNavalXp(
  state: WarshipProgressionState,
  awardedXp: number,
  effectiveRankCap: number,
): WarshipProgressionState {
  const current = materializeWarshipProgressionState(state);
  if (!Number.isSafeInteger(awardedXp) || awardedXp < 0) {
    throw new Error("awarded Warship Naval XP must be a non-negative safe integer");
  }
  assertRank(effectiveRankCap);
  if (effectiveRankCap < current.rank) {
    throw new Error("effective Warship rank cap cannot be below current rank");
  }
  if (current.rank >= effectiveRankCap || awardedXp === 0) {
    return current;
  }

  let rank = current.rank;
  let navalXp = current.navalXp + awardedXp;
  while (rank < effectiveRankCap && navalXp >= NAVAL_XP_PER_RANK) {
    navalXp -= NAVAL_XP_PER_RANK;
    rank += 1;
  }
  if (rank >= effectiveRankCap) navalXp = 0;

  return Object.freeze({ unitId: current.unitId, rank, navalXp });
}

export function warshipRankHealthScale(
  rank: number,
): Readonly<{ numerator: bigint; denominator: bigint }> {
  assertRank(rank);
  return Object.freeze({
    numerator: BigInt(5 + (rank - 1)),
    denominator: 5n,
  });
}
