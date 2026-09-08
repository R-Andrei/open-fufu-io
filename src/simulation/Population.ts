import type { RuleDynamicState } from "../core/rules/RuleMaterialization";

export type PopulationBucket =
  | "AVAILABLE"
  | "OFFENSIVE"
  | "COUNTER_RESPONSE"
  | "TRANSPORT";

export interface PopulationState {
  readonly total: number;
  readonly available: number;
  readonly committedOffensive: number;
  readonly committedCounterResponse: number;
  readonly aboardTransports: number;
  readonly peakTotal: number;
  readonly neutralSettlementHalfResidual: 0 | 1;
}

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

function withBucket(
  state: PopulationState,
  bucket: PopulationBucket,
  value: number,
): PopulationState {
  switch (bucket) {
    case "AVAILABLE":
      return createPopulationState({ ...state, available: value });
    case "OFFENSIVE":
      return createPopulationState({ ...state, committedOffensive: value });
    case "COUNTER_RESPONSE":
      return createPopulationState({ ...state, committedCounterResponse: value });
    case "TRANSPORT":
      return createPopulationState({ ...state, aboardTransports: value });
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
  const debited = withBucket(state, from, source - amount);
  return withBucket(debited, to, destination);
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
