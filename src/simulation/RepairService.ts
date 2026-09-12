import { reducedRational } from "../core/rules/RuleComposition";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromRangeFactor,
  type StructureRadialFieldProfile,
} from "../core/rules/StructureFieldGeometry";

export type RepairServiceLevel = 1 | 2 | 3 | 4 | 5;

export interface ExactRepairAmount {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface RepairServiceProfile {
  readonly broadRadiusCells: number;
  readonly broadHealthPerSecond: ExactRepairAmount;
  readonly fastRadiusCells: number;
  readonly fastHealthPerSecond: ExactRepairAmount;
  readonly fastCapacity: number;
}

export interface FastServiceQueueEntry {
  readonly unitId: string;
  readonly repairArrivalTick: number;
}

const BROAD_RADIUS_BY_LEVEL = Object.freeze([20, 40, 60, 80, 100] as const);
const BROAD_RATE_BY_LEVEL = Object.freeze([10n, 20n, 30n, 40n, 50n] as const);
const FAST_RATE_BY_LEVEL = Object.freeze([
  Object.freeze({ numerator: 100n, denominator: 1n }),
  Object.freeze({ numerator: 275n, denominator: 2n }),
  Object.freeze({ numerator: 175n, denominator: 1n }),
  Object.freeze({ numerator: 425n, denominator: 2n }),
  Object.freeze({ numerator: 250n, denominator: 1n }),
] as const);
const FAST_RADIUS_CELLS = 10;
const FAST_CAPACITY = 1;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactAmount(numerator: bigint, denominator: bigint): ExactRepairAmount {
  const reduced = reducedRational(numerator, denominator);
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

export function repairServiceProfileForLevel(
  level: RepairServiceLevel,
): RepairServiceProfile {
  const index = level - 1;
  return Object.freeze({
    broadRadiusCells: BROAD_RADIUS_BY_LEVEL[index],
    broadHealthPerSecond: exactAmount(BROAD_RATE_BY_LEVEL[index], 1n),
    fastRadiusCells: FAST_RADIUS_CELLS,
    fastHealthPerSecond: FAST_RATE_BY_LEVEL[index],
    fastCapacity: FAST_CAPACITY,
  });
}

export function scaledRepairField(
  baseRadiusCells: number,
  scaleNumerator: bigint,
  scaleDenominator: bigint,
): StructureRadialFieldProfile {
  if (scaleNumerator < 0n || scaleDenominator <= 0n) {
    throw new Error("repair-field scale must be non-negative with positive denominator");
  }
  return structureRadialFieldFromRangeFactor(
    baseRadiusCells,
    scaleNumerator,
    scaleDenominator,
  );
}

export function fixedRepairField(radiusCells: number): StructureRadialFieldProfile {
  if (!Number.isSafeInteger(radiusCells) || radiusCells < 0) {
    throw new Error("repair-field radius must be a non-negative safe integer");
  }
  return structureRadialFieldFromRangeFactor(radiusCells, 1n, 1n);
}

export function repairFieldContainsCell(
  field: StructureRadialFieldProfile,
  centerX: number,
  centerY: number,
  candidateX: number,
  candidateY: number,
): boolean {
  return structureRadialFieldContainsCell(
    field,
    centerX,
    centerY,
    candidateX,
    candidateY,
  );
}

export function repairPerTick(
  baseHealthPerSecond: ExactRepairAmount,
  scaleNumerator: bigint,
  scaleDenominator: bigint,
  ticksPerSecond: bigint,
): ExactRepairAmount {
  if (scaleNumerator < 0n || scaleDenominator <= 0n) {
    throw new Error("repair-rate scale must be non-negative with positive denominator");
  }
  if (ticksPerSecond <= 0n) {
    throw new Error("ticksPerSecond must be positive");
  }
  return exactAmount(
    baseHealthPerSecond.numerator * scaleNumerator,
    baseHealthPerSecond.denominator * scaleDenominator * ticksPerSecond,
  );
}

function amountAtLeast(left: ExactRepairAmount, right: ExactRepairAmount): boolean {
  return left.numerator * right.denominator >= right.numerator * left.denominator;
}

export function addRepairClamped(
  current: ExactRepairAmount,
  repair: ExactRepairAmount,
  maximum: ExactRepairAmount,
): Readonly<{ amount: ExactRepairAmount; full: boolean }> {
  if (amountAtLeast(current, maximum)) {
    return Object.freeze({ amount: current, full: true });
  }
  const sum = exactAmount(
    current.numerator * repair.denominator + repair.numerator * current.denominator,
    current.denominator * repair.denominator,
  );
  if (amountAtLeast(sum, maximum)) {
    return Object.freeze({ amount: maximum, full: true });
  }
  return Object.freeze({ amount: sum, full: false });
}

export function selectFastServiceUnitIds(
  candidates: readonly FastServiceQueueEntry[],
  capacity = FAST_CAPACITY,
): readonly string[] {
  if (!Number.isSafeInteger(capacity) || capacity < 0) {
    throw new Error("fast-service capacity must be a non-negative safe integer");
  }
  return Object.freeze(
    [...candidates]
      .sort(
        (left, right) =>
          left.repairArrivalTick - right.repairArrivalTick ||
          compareIds(left.unitId, right.unitId),
      )
      .slice(0, capacity)
      .map((entry) => entry.unitId),
  );
}
