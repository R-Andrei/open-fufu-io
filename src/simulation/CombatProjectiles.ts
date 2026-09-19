export interface CombatProjectilePoint {
  readonly x: number;
  readonly y: number;
}

export interface CombatProjectileExactDamage {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface HomingCombatProjectileInput {
  readonly sourceUnitId: string;
  readonly sourceOwnerId: string;
  readonly targetUnitId: string;
  readonly projectileOrdinal: number;
  readonly profileId: string;
  readonly position: CombatProjectilePoint;
  readonly speedCellsPerSecond: number;
  readonly damage: CombatProjectileExactDamage;
  readonly createdTick: number;
}

export interface HomingCombatProjectileState
  extends HomingCombatProjectileInput {}

export interface HomingCombatProjectileImpact {
  readonly sourceUnitId: string;
  readonly sourceOwnerId: string;
  readonly targetUnitId: string;
  readonly projectileOrdinal: number;
  readonly profileId: string;
  readonly damage: CombatProjectileExactDamage;
}

export interface AdvanceHomingCombatProjectilesRequest {
  readonly tick: number;
  readonly ticksPerSecond: number;
  readonly targetPosition: (
    unitId: string,
  ) => CombatProjectilePoint | undefined;
}

export interface AdvanceHomingCombatProjectilesResult {
  readonly projectiles: readonly HomingCombatProjectileState[];
  readonly impacts: readonly HomingCombatProjectileImpact[];
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
f64[0] = 1;
const HIGH_WORD_INDEX = u32[1] === 0x3ff00000 ? 1 : 0;
const LOW_WORD_INDEX = 1 - HIGH_WORD_INDEX;
const SQRT_2 = 1.4142135623730951;
const MIN_NORMAL = 2.2250738585072014e-308;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function canonicalFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function canonicalDamage(
  damage: CombatProjectileExactDamage,
): CombatProjectileExactDamage {
  if (
    damage === null ||
    typeof damage !== "object" ||
    Array.isArray(damage) ||
    typeof damage.numerator !== "bigint" ||
    typeof damage.denominator !== "bigint" ||
    damage.numerator < 0n ||
    damage.denominator <= 0n
  ) {
    throw new Error("combat projectile damage must be a non-negative exact ratio");
  }
  if (damage.numerator === 0n) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }
  const divisor = greatestCommonDivisor(
    damage.numerator,
    damage.denominator,
  );
  return Object.freeze({
    numerator: damage.numerator / divisor,
    denominator: damage.denominator / divisor,
  });
}

function powerOfTwo(exponent: number): number {
  if (exponent > 1023) return Infinity;
  if (exponent < -1074) return 0;
  if (exponent >= -1022) {
    u32[HIGH_WORD_INDEX] = (exponent + 1023) << 20;
    u32[LOW_WORD_INDEX] = 0;
    return f64[0];
  }
  const fractionBit = exponent + 1074;
  if (fractionBit < 32) {
    u32[HIGH_WORD_INDEX] = 0;
    u32[LOW_WORD_INDEX] = 1 << fractionBit;
  } else {
    u32[HIGH_WORD_INDEX] = 1 << (fractionBit - 32);
    u32[LOW_WORD_INDEX] = 0;
  }
  return f64[0];
}

/**
 * Deterministic square root for authoritative projectile motion.
 * It uses only IEEE-754 basic arithmetic plus exact bit-derived powers of two,
 * avoiding implementation-approximated transcendental Math functions.
 */
function deterministicSqrt(value: number): number {
  if (value < 0) return NaN;
  if (value === 0 || value === Infinity) return value;
  if (!Number.isFinite(value)) return NaN;

  let scaled = value;
  let finalScale = 1;
  if (scaled < MIN_NORMAL) {
    scaled *= powerOfTwo(54);
    finalScale = powerOfTwo(-27);
  }

  f64[0] = scaled;
  const exponent = ((u32[HIGH_WORD_INDEX] >>> 20) & 0x7ff) - 1023;
  let estimate = powerOfTwo(Math.floor(exponent / 2));
  if (exponent % 2 !== 0) estimate *= SQRT_2;

  for (let iteration = 0; iteration < 7; iteration += 1) {
    estimate = (estimate + scaled / estimate) * 0.5;
  }
  return estimate * finalScale;
}

function projectileIdentityKey(
  projectile: Pick<
    HomingCombatProjectileState,
    "sourceUnitId" | "projectileOrdinal"
  >,
): string {
  return `${JSON.stringify(projectile.sourceUnitId)}\u0000${projectile.projectileOrdinal}`;
}

function compareProjectiles(
  left: HomingCombatProjectileState,
  right: HomingCombatProjectileState,
): number {
  return (
    compareIds(left.sourceUnitId, right.sourceUnitId) ||
    left.projectileOrdinal - right.projectileOrdinal
  );
}

export function createHomingCombatProjectile(
  input: HomingCombatProjectileInput,
): HomingCombatProjectileState {
  assertNonEmptyString(input.sourceUnitId, "combat projectile sourceUnitId");
  assertNonEmptyString(input.sourceOwnerId, "combat projectile sourceOwnerId");
  assertNonEmptyString(input.targetUnitId, "combat projectile targetUnitId");
  assertNonEmptyString(input.profileId, "combat projectile profileId");
  assertNonNegativeSafeInteger(
    input.projectileOrdinal,
    "combat projectile projectileOrdinal",
  );
  assertNonNegativeSafeInteger(input.createdTick, "combat projectile createdTick");
  const speedCellsPerSecond = canonicalFiniteNumber(
    input.speedCellsPerSecond,
    "combat projectile speedCellsPerSecond",
  );
  if (speedCellsPerSecond <= 0) {
    throw new Error("combat projectile speedCellsPerSecond must be positive");
  }
  const position = Object.freeze({
    x: canonicalFiniteNumber(input.position.x, "combat projectile position.x"),
    y: canonicalFiniteNumber(input.position.y, "combat projectile position.y"),
  });
  return Object.freeze({
    sourceUnitId: input.sourceUnitId,
    sourceOwnerId: input.sourceOwnerId,
    targetUnitId: input.targetUnitId,
    projectileOrdinal: input.projectileOrdinal,
    profileId: input.profileId,
    position,
    speedCellsPerSecond,
    damage: canonicalDamage(input.damage),
    createdTick: input.createdTick,
  });
}

export function materializeHomingCombatProjectiles(
  projectiles: readonly HomingCombatProjectileInput[],
): readonly HomingCombatProjectileState[] {
  const seen = new Set<string>();
  const materialized = projectiles.map((projectile) => {
    const state = createHomingCombatProjectile(projectile);
    const key = projectileIdentityKey(state);
    if (seen.has(key)) {
      throw new Error(
        `duplicate combat projectile identity: ${state.sourceUnitId}/${state.projectileOrdinal}`,
      );
    }
    seen.add(key);
    return state;
  });
  materialized.sort(compareProjectiles);
  return Object.freeze(materialized);
}

export function advanceHomingCombatProjectiles(
  projectiles: readonly HomingCombatProjectileInput[],
  request: AdvanceHomingCombatProjectilesRequest,
): AdvanceHomingCombatProjectilesResult {
  assertNonNegativeSafeInteger(request.tick, "combat projectile tick");
  if (!Number.isSafeInteger(request.ticksPerSecond) || request.ticksPerSecond <= 0) {
    throw new Error("combat projectile ticksPerSecond must be a positive safe integer");
  }

  const active = materializeHomingCombatProjectiles(projectiles);
  const next: HomingCombatProjectileState[] = [];
  const impacts: HomingCombatProjectileImpact[] = [];

  for (const projectile of active) {
    if (request.tick < projectile.createdTick) {
      throw new Error("combat projectile cannot advance before its creation tick");
    }
    if (request.tick === projectile.createdTick) {
      next.push(projectile);
      continue;
    }

    const rawTarget = request.targetPosition(projectile.targetUnitId);
    if (rawTarget === undefined) continue;
    const target = Object.freeze({
      x: canonicalFiniteNumber(rawTarget.x, "combat projectile target position.x"),
      y: canonicalFiniteNumber(rawTarget.y, "combat projectile target position.y"),
    });
    const dx = target.x - projectile.position.x;
    const dy = target.y - projectile.position.y;
    const distanceSquared = dx * dx + dy * dy;
    if (!Number.isFinite(distanceSquared)) {
      throw new Error("combat projectile target distance must be finite");
    }
    const travel = projectile.speedCellsPerSecond / request.ticksPerSecond;
    if (distanceSquared <= travel * travel) {
      impacts.push(
        Object.freeze({
          sourceUnitId: projectile.sourceUnitId,
          sourceOwnerId: projectile.sourceOwnerId,
          targetUnitId: projectile.targetUnitId,
          projectileOrdinal: projectile.projectileOrdinal,
          profileId: projectile.profileId,
          damage: projectile.damage,
        }),
      );
      continue;
    }

    const distance = deterministicSqrt(distanceSquared);
    if (!(distance > 0) || !Number.isFinite(distance)) {
      throw new Error("combat projectile target distance must be positive and finite");
    }
    const fraction = travel / distance;
    next.push(
      Object.freeze({
        ...projectile,
        position: Object.freeze({
          x: canonicalFiniteNumber(
            projectile.position.x + dx * fraction,
            "combat projectile advanced position.x",
          ),
          y: canonicalFiniteNumber(
            projectile.position.y + dy * fraction,
            "combat projectile advanced position.y",
          ),
        }),
      }),
    );
  }

  return Object.freeze({
    projectiles: Object.freeze(next),
    impacts: Object.freeze(impacts),
  });
}
