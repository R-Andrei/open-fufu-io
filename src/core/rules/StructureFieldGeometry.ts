import { reducedRational } from "./RuleComposition";

export const STRUCTURE_RADIAL_FIELD_VERSION = "STRUCTURE_RADIAL_FIELD_V1" as const;

export interface ExactPositiveRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface StructureRadialFieldProfile {
  readonly version: typeof STRUCTURE_RADIAL_FIELD_VERSION;
  /** True only for an explicitly zero effective field. */
  readonly empty: boolean;
  /** Exact squared-radius numerator when empty=false. */
  readonly squaredRadiusNumerator: bigint;
  /** Exact positive denominator shared by the squared-radius threshold. */
  readonly squaredRadiusDenominator: bigint;
}

export interface SerializedStructureRadialFieldProfile {
  readonly version: typeof STRUCTURE_RADIAL_FIELD_VERSION;
  readonly empty: boolean;
  readonly squaredRadiusNumerator: string;
  readonly squaredRadiusDenominator: string;
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function normalizedNonNegativeFactor(
  numeratorInput: bigint,
  denominatorInput: bigint,
): ExactPositiveRational {
  if (denominatorInput <= 0n) {
    throw new Error("Structure-field factor denominator must be positive");
  }
  if (numeratorInput < 0n) {
    throw new Error("Structure-field factor numerator cannot be negative");
  }
  return reducedRational(numeratorInput, denominatorInput);
}

function profileFromSquaredThreshold(
  numeratorInput: bigint,
  denominatorInput: bigint,
): StructureRadialFieldProfile {
  if (numeratorInput === 0n) {
    return Object.freeze({
      version: STRUCTURE_RADIAL_FIELD_VERSION,
      empty: true,
      squaredRadiusNumerator: 0n,
      squaredRadiusDenominator: 1n,
    });
  }
  const reduced = reducedRational(numeratorInput, denominatorInput);
  return Object.freeze({
    version: STRUCTURE_RADIAL_FIELD_VERSION,
    empty: false,
    squaredRadiusNumerator: reduced.numerator,
    squaredRadiusDenominator: reduced.denominator,
  });
}

/**
 * Project an exact semantic area multiplier onto a radial raster field.
 *
 * A baseline radius R and area factor p/q produce the exact squared threshold
 * R^2 * p/q. No square root or intermediate floating-point radius exists in the
 * authoritative representation.
 */
export function structureRadialFieldFromAreaFactor(
  baselineRadiusCells: number,
  areaNumerator: bigint,
  areaDenominator: bigint,
): StructureRadialFieldProfile {
  assertNonNegativeSafeInteger(baselineRadiusCells, "baselineRadiusCells");
  const factor = normalizedNonNegativeFactor(areaNumerator, areaDenominator);
  const radius = BigInt(baselineRadiusCells);
  return profileFromSquaredThreshold(
    radius * radius * factor.numerator,
    factor.denominator,
  );
}

/**
 * Project an exact semantic range multiplier onto a radial raster field.
 *
 * A baseline radius R and range factor p/q produce exact squared geometry
 * R^2 * p^2/q^2. This is intentionally distinct from area scaling.
 */
export function structureRadialFieldFromRangeFactor(
  baselineRadiusCells: number,
  rangeNumerator: bigint,
  rangeDenominator: bigint,
): StructureRadialFieldProfile {
  assertNonNegativeSafeInteger(baselineRadiusCells, "baselineRadiusCells");
  const factor = normalizedNonNegativeFactor(rangeNumerator, rangeDenominator);
  const radius = BigInt(baselineRadiusCells);
  return profileFromSquaredThreshold(
    radius * radius * factor.numerator * factor.numerator,
    factor.denominator * factor.denominator,
  );
}

/**
 * Exact cell-center membership for STRUCTURE_RADIAL_FIELD_V1.
 * Boundary equality is inside. An explicitly zero effective field is empty.
 */
export function structureRadialFieldContainsOffset(
  profile: StructureRadialFieldProfile,
  dx: number,
  dy: number,
): boolean {
  assertNonNegativeSafeInteger(Math.abs(dx), "abs(dx)");
  assertNonNegativeSafeInteger(Math.abs(dy), "abs(dy)");
  if (profile.version !== STRUCTURE_RADIAL_FIELD_VERSION) {
    throw new Error(`Unsupported structure-field profile ${profile.version as string}`);
  }
  if (profile.empty) return false;
  const x = BigInt(dx);
  const y = BigInt(dy);
  const distanceSquared = x * x + y * y;
  return (
    distanceSquared * profile.squaredRadiusDenominator <=
    profile.squaredRadiusNumerator
  );
}

export function structureRadialFieldContainsCell(
  profile: StructureRadialFieldProfile,
  centerX: number,
  centerY: number,
  candidateX: number,
  candidateY: number,
): boolean {
  for (const [value, label] of [
    [centerX, "centerX"],
    [centerY, "centerY"],
    [candidateX, "candidateX"],
    [candidateY, "candidateY"],
  ] as const) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a safe integer`);
    }
  }
  return structureRadialFieldContainsOffset(
    profile,
    candidateX - centerX,
    candidateY - centerY,
  );
}

export function serializeStructureRadialFieldProfile(
  profile: StructureRadialFieldProfile,
): SerializedStructureRadialFieldProfile {
  return Object.freeze({
    version: profile.version,
    empty: profile.empty,
    squaredRadiusNumerator: profile.squaredRadiusNumerator.toString(),
    squaredRadiusDenominator: profile.squaredRadiusDenominator.toString(),
  });
}
