import type { DecisionReceipt } from "../core/controller/ControllerApi";
import {
  evaluateControllerRound,
  type ControllerHost,
  type ControllerRoundReceipt,
} from "./ControllerRuntime";
import {
  materializeDirectiveChanges,
  tryApplyPersistentDirectiveChanges,
} from "./LandOperations";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";
import type { MatchSpec } from "./MatchSpec";
import {
  grantPopulation,
  removePopulation,
  repartitionPopulation,
  transferPopulation,
  type PopulationBucket,
} from "./Population";
import {
  TickEngine,
  type AcceptedSimulationInput,
  type SimulationAction,
} from "./TickEngine";

const POPULATION_BUCKETS = new Set<PopulationBucket>([
  "AVAILABLE",
  "OFFENSIVE",
  "COUNTER_RESPONSE",
  "TRANSPORT",
]);

const SYNTHETIC_TERRAINS = new Set([
  "TEST",
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
  "SHALLOW_WATER",
  "DEEP_WATER",
  "IMPASSABLE",
]);

function validateMatchSpec(spec: MatchSpec): void {
  if (!Number.isInteger(spec.map.width) || spec.map.width <= 0) {
    throw new Error("synthetic map width must be a positive integer");
  }
  if (!Number.isInteger(spec.map.height) || spec.map.height <= 0) {
    throw new Error("synthetic map height must be a positive integer");
  }
  const cellCount = spec.map.width * spec.map.height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0) {
    throw new Error("synthetic map cell count must be a positive safe integer");
  }
  if (spec.map.terrain.length !== cellCount) {
    throw new Error("synthetic map terrain length must equal width * height");
  }
  for (const terrain of spec.map.terrain) {
    if (!SYNTHETIC_TERRAINS.has(terrain)) {
      throw new Error(`unknown synthetic terrain: ${terrain}`);
    }
  }
  if (
    spec.map.initialOwners !== undefined &&
    spec.map.initialOwners.length !== cellCount
  ) {
    throw new Error("synthetic map initialOwners length must equal width * height");
  }
  if (
    spec.map.initialFallout !== undefined &&
    spec.map.initialFallout.length !== cellCount
  ) {
    throw new Error("synthetic map initialFallout length must equal width * height");
  }
  if (
    spec.map.initialFallout?.some((value) => typeof value !== "boolean") === true
  ) {
    throw new Error("synthetic map initialFallout values must be boolean");
  }
  if (spec.factions.length < 2) {
    throw new Error("MatchRuntime requires at least two factions");
  }

  const ids = new Set<string>();
  for (const faction of spec.factions) {
    if (faction.id.length === 0) {
      throw new Error("faction id must not be empty");
    }
    if (ids.has(faction.id)) {
      throw new Error(`duplicate faction id: ${faction.id}`);
    }
    ids.add(faction.id);
    if (
      faction.fixedTeamId !== undefined &&
      faction.fixedTeamId.length === 0
    ) {
      throw new Error(`faction ${faction.id} fixedTeamId must not be empty`);
    }
    if (typeof faction.rules.canonicalSerialization !== "string") {
      throw new Error(`faction ${faction.id} must provide a compiled rule profile`);
    }
  }
  for (const ownerId of spec.map.initialOwners ?? []) {
    if (ownerId !== null && !ids.has(ownerId)) {
      throw new Error(`unknown initial owner faction: ${ownerId}`);
    }
  }
}

function faction(state: MatchState, factionId: string): MatchFactionState {
  const result = state.factions.find((entry) => entry.id === factionId);
  if (result === undefined) throw new Error(`unknown faction: ${factionId}`);
  return result;
}

function validateBucket(bucket: PopulationBucket): void {
  if (!POPULATION_BUCKETS.has(bucket)) {
    throw new Error(`unknown Population bucket: ${String(bucket)}`);
  }
}

function validateAction(state: MatchState, action: SimulationAction): void {
  switch (action.type) {
    case "SET_TEST_MARKER": {
      faction(state, action.factionId);
      if (!Number.isFinite(action.value) || !Number.isInteger(action.value)) {
        throw new Error("test marker value must be a finite integer");
      }
      break;
    }
    case "CAPITULATE_FACTION": {
      const target = faction(state, action.factionId);
      if (target.status !== "ACTIVE") {
        throw new Error(`faction is not active: ${action.factionId}`);
      }
      break;
    }
    case "GRANT_POPULATION":
      grantPopulation(faction(state, action.factionId).population, action.amount);
      break;
    case "REPARTITION_POPULATION":
      validateBucket(action.from);
      validateBucket(action.to);
      repartitionPopulation(
        faction(state, action.factionId).population,
        action.from,
        action.to,
        action.amount,
      );
      break;
    case "REMOVE_POPULATION":
      validateBucket(action.from);
      removePopulation(
        faction(state, action.factionId).population,
        action.from,
        action.amount,
      );
      break;
    case "TRANSFER_POPULATION": {
      validateBucket(action.sourceBucket);
      if (action.sourceFactionId === action.recipientFactionId) {
        throw new Error("Population transfer requires two distinct factions");
      }
      transferPopulation(
        faction(state, action.sourceFactionId).population,
        faction(state, action.recipientFactionId).population,
        action.sourceBucket,
        action.amount,
      );
      break;
    }
    case "APPLY_PERSISTENT_DIRECTIVES": {
      const applied = tryApplyPersistentDirectiveChanges(
        state,
        action.factionId,
        action.changes,
      );
      if (!applied.ok) {
        throw new Error(
          `invalid persistent directives: ${applied.failure.code}${
            applied.failure.key === undefined ? "" : `/${applied.failure.key}`
          }`,
        );
      }
      break;
    }
  }
}

function freezeAcceptedInput(
  input: AcceptedSimulationInput,
): AcceptedSimulationInput {
  const action =
    input.action.type === "APPLY_PERSISTENT_DIRECTIVES"
      ? Object.freeze({
          ...input.action,
          changes: materializeDirectiveChanges(input.action.changes),
        })
      : Object.freeze({ ...input.action });
  return Object.freeze({
    tick: input.tick,
    sequence: input.sequence,
    action,
  });
}

export class MatchRuntime {
  private readonly engine = new TickEngine();
  private state: MatchState;
  private pendingInputs: AcceptedSimulationInput[] = [];
  private readonly acceptedInputLog: AcceptedSimulationInput[] = [];
  private nextSequence = 0;
  private nextControllerDecisionNumber = 0;
  private lastControllerRoundTick = -1;
  private readonly controllerReceipts = new Map<string, DecisionReceipt>();
  private controllerFaultCounts = new Map<string, number>();

  constructor(readonly spec: MatchSpec) {
    validateMatchSpec(spec);
    this.state = createInitialMatchState(spec);
  }

  snapshot(): MatchState {
    return this.state;
  }

  private validationState(): MatchState {
    if (this.pendingInputs.length === 0) return this.state;
    return this.engine.applyAcceptedInputs(this.state, this.pendingInputs);
  }

  acceptAction(action: SimulationAction): AcceptedSimulationInput {
    validateAction(this.validationState(), action);
    const accepted = freezeAcceptedInput({
      tick: this.state.tick + 1,
      sequence: this.nextSequence,
      action,
    });
    this.nextSequence += 1;
    this.pendingInputs.push(accepted);
    this.acceptedInputLog.push(accepted);
    return accepted;
  }

  runControllerRound(host: ControllerHost): readonly ControllerRoundReceipt[] {
    if (this.lastControllerRoundTick === this.state.tick) {
      throw new Error("controller round already executed for this simulation tick");
    }

    const evaluated = evaluateControllerRound(
      this.state,
      host,
      this.nextControllerDecisionNumber,
      this.controllerReceipts,
      this.controllerFaultCounts,
    );

    for (const action of evaluated.actions) {
      this.acceptAction(action);
    }
    for (const entry of evaluated.receipts) {
      this.controllerReceipts.set(entry.factionId, entry.receipt);
    }
    this.controllerFaultCounts = new Map(evaluated.faultCounts);
    this.lastControllerRoundTick = this.state.tick;
    this.nextControllerDecisionNumber += 1;
    return evaluated.receipts;
  }

  tick(): MatchState {
    const nextTick = this.state.tick + 1;
    const executing = this.pendingInputs.filter((input) => input.tick === nextTick);
    this.pendingInputs = this.pendingInputs.filter((input) => input.tick !== nextTick);
    this.state = this.engine.advance(this.state, executing);
    return this.state;
  }

  acceptedInputs(): readonly AcceptedSimulationInput[] {
    return Object.freeze([...this.acceptedInputLog]);
  }

  stateFingerprint(): string {
    return canonicalMatchStateSerialization(this.state);
  }

  static regenerate(
    spec: MatchSpec,
    inputs: readonly AcceptedSimulationInput[],
    finalTick: number,
  ): MatchRuntime {
    if (!Number.isInteger(finalTick) || finalTick < 0) {
      throw new Error("final replay tick must be a non-negative integer");
    }

    const orderedInputs = [...inputs].sort(
      (left, right) => left.tick - right.tick || left.sequence - right.sequence,
    );
    if (orderedInputs.some((input) => input.tick < 1 || input.tick > finalTick)) {
      throw new Error("accepted input stream contains a tick outside replay range");
    }

    const runtime = new MatchRuntime(spec);
    let cursor = 0;

    while (runtime.snapshot().tick < finalTick) {
      const targetTick = runtime.snapshot().tick + 1;
      while (
        cursor < orderedInputs.length &&
        orderedInputs[cursor]?.tick === targetTick
      ) {
        const recorded = orderedInputs[cursor];
        if (recorded === undefined) break;
        const regenerated = runtime.acceptAction(recorded.action);
        if (
          regenerated.tick !== recorded.tick ||
          regenerated.sequence !== recorded.sequence
        ) {
          throw new Error("accepted input stream is not canonical for this MatchSpec");
        }
        cursor += 1;
      }
      runtime.tick();
    }

    if (cursor !== orderedInputs.length) {
      throw new Error("accepted input stream could not be fully regenerated");
    }

    return runtime;
  }
}
