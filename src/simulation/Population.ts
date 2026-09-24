import type { RuleDynamicState } from "../core/rules/RuleMaterialization";

export type PopulationBucket =
  | "AVAILABLE"
  | "OFFENSIVE"
  | "COUNTER_RESPONSE"
  | "TRANSPORT";

export const POPULATION_GROWTH_RESIDUAL_SCALE = 1_000_000_000;

export interface PopulationState {
  readonly total: number;
  readonly available: number;
  readonly committedOffensive: number;
  readonly committedCounterResponse: number;
  readonly aboardTransports: number;
  readonly peakTotal: number;
  readonly neutralSettlementHalfResidual: 0 | 1;
  /** Internal deterministic ordinary-growth carry; canonical zero is omitted. */
  readonly growthResidualUnits?: number;
}

type MutablePopulationState = {
  -readonly [Key in keyof PopulationState]: PopulationState[Key];
};

export type PopulationRuleDynamicState = Pick<
  RuleDynamicState,
  "peakTotalPopulation"
>;

function assertPopulationInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} exceeds the safe-integer range`);
  }
  return result;
}

function bucketValue(state: PopulationState, bucket: PopulationBucket): number {
  switch (bucket) {
    case "AVAILABLE":
      return state.available;
    case "OFFENSIVE":
      return state.committedOffensive;
    case "COUNTER_RESPONSE":
      return state.committedCounterResponse;
    case "TRANSPORT":
      return state.aboardTransports;
  }
}

function bucketLabel(bucket: PopulationBucket): string {
  switch (bucket) {
    case "AVAILABLE":
      return "available";
    case "OFFENSIVE":
      return "offensive";
    case "COUNTER_RESPONSE":
      return "counter-response";
    case "TRANSPORT":
      return "transport";
  }
}

function setBucket(
  state: MutablePopulationState,
  bucket: PopulationBucket,
  value: number,
): void {
  switch (bucket) {
    case "AVAILABLE":
      state.available = value;
      break;
    case "OFFENSIVE":
      state.committedOffensive = value;
      break;
    case "COUNTER_RESPONSE":
      state.committedCounterResponse = value;
      break;
    case "TRANSPORT":
      state.aboardTransports = value;
      break;
  }
}

export function createPopulationState(input: PopulationState): PopulationState {
  assertPopulationInteger(input.total, "Total Population");
  assertPopulationInteger(input.available, "Available Population");
  assertPopulationInteger(
    input.committedOffensive,
    "Committed offensive Population",
  );
  assertPopulationInteger(
    input.committedCounterResponse,
    "Committed counter-response Population",
  );
  assertPopulationInteger(input.aboardTransports, "Transport Population");
  assertPopulationInteger(input.peakTotal, "Peak Total Population");

  if (
    input.neutralSettlementHalfResidual !== 0 &&
    input.neutralSettlementHalfResidual !== 1
  ) {
    throw new Error("neutral settlement half residual must be 0 or 1");
  }
  if (
    input.growthResidualUnits !== undefined &&
    (!Number.isSafeInteger(input.growthResidualUnits) ||
      input.growthResidualUnits < 0 ||
      input.growthResidualUnits >= POPULATION_GROWTH_RESIDUAL_SCALE)
  ) {
    throw new Error(
      `ordinary Population growth residual must be an integer in 0..${POPULATION_GROWTH_RESIDUAL_SCALE - 1}`,
    );
  }

  const partitionTotal =
    BigInt(input.available) +
    BigInt(input.committedOffensive) +
    BigInt(input.committedCounterResponse) +
    BigInt(input.aboardTransports);
  if (partitionTotal !== BigInt(input.total)) {
    throw new Error("Total Population must equal the Population partition sum");
  }
  if (input.peakTotal < input.total) {
    throw new Error("Peak Total Population cannot be below current Total Population");
  }

  return Object.freeze({
    total: input.total,
    available: input.available,
    committedOffensive: input.committedOffensive,
    committedCounterResponse: input.committedCounterResponse,
    aboardTransports: input.aboardTransports,
    peakTotal: input.peakTotal,
    neutralSettlementHalfResidual: input.neutralSettlementHalfResidual,
    ...(input.growthResidualUnits === undefined || input.growthResidualUnits === 0
      ? {}
      : { growthResidualUnits: input.growthResidualUnits }),
  });
}

export function createEmptyPopulationState(): PopulationState {
  return createPopulationState({
    total: 0,
    available: 0,
    committedOffensive: 0,
    committedCounterResponse: 0,
    aboardTransports: 0,
    peakTotal: 0,
    neutralSettlementHalfResidual: 0,
  });
}

export function repartitionPopulation(
  state: PopulationState,
  from: PopulationBucket,
  to: PopulationBucket,
  amount: number,
): PopulationState {
  assertPopulationInteger(amount, "Population repartition amount");
  const source = bucketValue(state, from);
  if (amount > source) {
    throw new Error(`insufficient ${bucketLabel(from)} Population`);
  }
  if (amount === 0 || from === to) return state;

  const destination = checkedAdd(
    bucketValue(state, to),
    amount,
    `${bucketLabel(to)} Population`,
  );
  const next: MutablePopulationState = { ...state };
  setBucket(next, from, source - amount);
  setBucket(next, to, destination);
  return createPopulationState(next);
}

export function removePopulation(
  state: PopulationState,
  from: PopulationBucket,
  amount: number,
): PopulationState {
  assertPopulationInteger(amount, "Population removal amount");
  const source = bucketValue(state, from);
  if (amount > source) {
    throw new Error(`insufficient ${bucketLabel(from)} Population`);
  }
  if (amount === 0) return state;

  const next = {
    ...state,
    total: state.total - amount,
  };
  switch (from) {
    case "AVAILABLE":
      return createPopulationState({ ...next, available: source - amount });
    case "OFFENSIVE":
      return createPopulationState({
        ...next,
        committedOffensive: source - amount,
      });
    case "COUNTER_RESPONSE":
      return createPopulationState({
        ...next,
        committedCounterResponse: source - amount,
      });
    case "TRANSPORT":
      return createPopulationState({
        ...next,
        aboardTransports: source - amount,
      });
  }
}

export function grantPopulation(
  state: PopulationState,
  amount: number,
): PopulationState {
  assertPopulationInteger(amount, "Population grant amount");
  if (amount === 0) return state;

  const total = checkedAdd(state.total, amount, "Total Population");
  const available = checkedAdd(
    state.available,
    amount,
    "Available Population",
  );
  return createPopulationState({
    ...state,
    total,
    available,
    peakTotal: Math.max(state.peakTotal, total),
  });
}

export function transferPopulation(
  source: PopulationState,
  recipient: PopulationState,
  sourceBucket: PopulationBucket,
  amount: number,
): {
  readonly source: PopulationState;
  readonly recipient: PopulationState;
} {
  assertPopulationInteger(amount, "Population transfer amount");
  const sourceAfter = removePopulation(source, sourceBucket, amount);
  const recipientAfter = grantPopulation(recipient, amount);
  return Object.freeze({
    source: sourceAfter,
    recipient: recipientAfter,
  });
}

export function populationRuleDynamicState(
  state: PopulationState,
): PopulationRuleDynamicState {
  return Object.freeze({ peakTotalPopulation: state.peakTotal });
}


export function accrueOrdinaryPopulationGrowthUnits(
  state: PopulationState,
  units: number,
): PopulationState {
  if (!Number.isSafeInteger(units) || units < 0) {
    throw new Error("ordinary Population growth units must be a non-negative safe integer");
  }
  if (units === 0) return state;

  const totalUnits =
    BigInt(state.growthResidualUnits ?? 0) + BigInt(units);
  const scale = BigInt(POPULATION_GROWTH_RESIDUAL_SCALE);
  const emitted = totalUnits / scale;
  const residual = Number(totalUnits % scale);
  if (emitted > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("ordinary Population growth emission exceeds the safe-integer range");
  }

  const grown = grantPopulation(state, Number(emitted));
  return createPopulationState({
    ...grown,
    growthResidualUnits: residual,
  });
}
