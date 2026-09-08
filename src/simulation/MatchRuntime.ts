import type { DecisionReceipt } from "../core/controller/ControllerApi";
import {
  evaluateControllerRound,
  type ControllerHost,
  type ControllerRoundEvaluation,
  type ControllerRoundReceipt,
} from "./ControllerRuntime";
import {
  materializeDirectiveChanges,
  tryApplyPersistentDirectiveChanges,
} from "./LandOperations";
import {
  materializeMapArtifact,
  validateMapArtifactBinding,
  type MapArtifactBinding,
  type MapArtifactResolver,
} from "./MapArtifact";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";
import {
  isArtifactMapSpec,
  type ArtifactMapSpec,
  type MatchSpec,
  type SyntheticMapSpec,
} from "./MatchSpec";
import {
  grantPopulation,
  removePopulation,
  repartitionPopulation,
  transferPopulation,
  type PopulationBucket,
} from "./Population";
import {
  materializeSpawnInitialization,
  type SpawnSnapshot,
} from "./SpawnInitialization";
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

const ARTIFACT_MAP_KEYS = ["kind", "mapId", "mapVersion", "mapHash"] as const;

export interface MatchRuntimeDependencies {
  readonly mapArtifacts?: MapArtifactResolver;
}

export type MatchRuntimePhase = "INITIALIZING" | "ACTIVE";

export interface SpawnAwareMatchState extends MatchState {
  readonly phase: MatchRuntimePhase;
  readonly spawnSnapshot: SpawnSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as Promise<T>).then === "function"
  );
}

function validateArtifactMapSpec(map: ArtifactMapSpec): void {
  if (!isRecord(map)) {
    throw new Error("artifact MatchSpec map must be an object");
  }
  const keys = Object.keys(map);
  if (
    keys.length !== ARTIFACT_MAP_KEYS.length ||
    !ARTIFACT_MAP_KEYS.every((key) => Object.prototype.hasOwnProperty.call(map, key))
  ) {
    throw new Error(
      "artifact MatchSpec map must contain exactly kind, mapId, mapVersion, and mapHash",
    );
  }
  if (map.kind !== "ARTIFACT") {
    throw new Error("artifact MatchSpec map kind must be ARTIFACT");
  }
  validateMapArtifactBinding(map);
}

function validateSyntheticMapSpec(map: SyntheticMapSpec): number {
  if (!Number.isInteger(map.width) || map.width <= 0) {
    throw new Error("synthetic map width must be a positive integer");
  }
  if (!Number.isInteger(map.height) || map.height <= 0) {
    throw new Error("synthetic map height must be a positive integer");
  }
  const cellCount = map.width * map.height;
  if (!Number.isSafeInteger(cellCount) || cellCount <= 0) {
    throw new Error("synthetic map cell count must be a positive safe integer");
  }
  if (map.terrain.length !== cellCount) {
    throw new Error("synthetic map terrain length must equal width * height");
  }
  for (const terrain of map.terrain) {
    if (!SYNTHETIC_TERRAINS.has(terrain)) {
      throw new Error(`unknown synthetic terrain: ${terrain}`);
    }
  }
  if (
    map.initialOwners !== undefined &&
    map.initialOwners.length !== cellCount
  ) {
    throw new Error("synthetic map initialOwners length must equal width * height");
  }
  if (
    map.initialFallout !== undefined &&
    map.initialFallout.length !== cellCount
  ) {
    throw new Error("synthetic map initialFallout length must equal width * height");
  }
  if (
    map.initialFallout?.some((value) => typeof value !== "boolean") === true
  ) {
    throw new Error("synthetic map initialFallout values must be boolean");
  }
  return cellCount;
}

function validateMatchSpec(spec: MatchSpec): void {
  const artifact = isArtifactMapSpec(spec.map);
  const cellCount = artifact ? undefined : validateSyntheticMapSpec(spec.map);
  if (artifact) validateArtifactMapSpec(spec.map);

  const initialization = isRecord(spec.initialization)
    ? spec.initialization
    : undefined;
  if (
    artifact &&
    (initialization === undefined || initialization.kind !== "SPAWN")
  ) {
    throw new Error("artifact-backed MatchSpec requires SPAWN initialization");
  }
  if (
    initialization === undefined ||
    (initialization.kind !== "SPAWN" &&
      initialization.kind !== "SYNTHETIC_FIXTURE")
  ) {
    throw new Error(
      "MatchSpec initialization must be explicitly tagged SPAWN or SYNTHETIC_FIXTURE",
    );
  }
  if (initialization.kind === "SPAWN") {
    if (!("input" in initialization) || !isRecord(initialization.input)) {
      throw new Error("SPAWN initialization requires a resolved Spawn input");
    }
    if (!artifact && spec.map.initialOwners !== undefined) {
      throw new Error(
        "SPAWN initialization cannot be combined with synthetic initialOwners",
      );
    }
    if (spec.initialStructureGrants !== undefined) {
      throw new Error(
        "SPAWN initialization cannot be combined with legacy initialStructureGrants",
      );
    }
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

  if (artifact) return;
  for (const ownerId of spec.map.initialOwners ?? []) {
    if (ownerId !== null && !ids.has(ownerId)) {
      throw new Error(`unknown initial owner faction: ${ownerId}`);
    }
  }
  for (let index = 0; index < cellCount!; index += 1) {
    const ownerId = spec.map.initialOwners?.[index] ?? null;
    const hasFallout = spec.map.initialFallout?.[index] ?? false;
    if (hasFallout && ownerId !== null) {
      throw new Error(
        "Fallout cells must be neutral; owned Fallout initial state is invalid",
      );
    }
  }
}

function resolveArtifactMap(
  spec: ArtifactMapSpec,
  resolver: MapArtifactResolver | undefined,
) {
  if (resolver === undefined) {
    throw new Error(
      "map artifact resolver is required for an artifact-backed MatchSpec",
    );
  }
  const binding: MapArtifactBinding = Object.freeze({
    mapId: spec.mapId,
    mapVersion: spec.mapVersion,
    mapHash: spec.mapHash,
  });
  const artifactPackage = resolver.resolve(binding);
  if (artifactPackage === undefined) {
    throw new Error(
      `map artifact not found for ${spec.mapId}@${spec.mapVersion}/${spec.mapHash}`,
    );
  }
  return materializeMapArtifact(binding, artifactPackage);
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
  private controllerRoundInFlightTick: number | undefined;
  private readonly controllerReceipts = new Map<string, DecisionReceipt>();
  private controllerFaultCounts = new Map<string, number>();
  private controllerConsecutiveFaultCounts = new Map<string, number>();
  private controllerFaultedFactionIds = new Set<string>();
  private phase: MatchRuntimePhase = "ACTIVE";
  private spawnSnapshot?: SpawnSnapshot;

  constructor(
    readonly spec: MatchSpec,
    dependencies: MatchRuntimeDependencies = {},
  ) {
    validateMatchSpec(spec);
    const resolvedMap = isArtifactMapSpec(spec.map)
      ? resolveArtifactMap(spec.map, dependencies.mapArtifacts)
      : undefined;
    this.state = createInitialMatchState(spec, resolvedMap);
    if (spec.initialization.kind === "SPAWN") {
      this.phase = "INITIALIZING";
      const initialized = materializeSpawnInitialization(
        this.state,
        spec.initialization.input,
      );
      this.state = initialized.state;
      this.spawnSnapshot = initialized.snapshot;
      this.phase = "ACTIVE";
    }
  }

  snapshot(): MatchState | SpawnAwareMatchState {
    if (this.spawnSnapshot === undefined) {
      return this.state;
    }
    return Object.freeze({
      ...this.state,
      phase: this.phase,
      spawnSnapshot: this.spawnSnapshot,
    });
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

  private commitControllerRound(
    evaluated: ControllerRoundEvaluation,
  ): readonly ControllerRoundReceipt[] {
    for (const action of evaluated.actions) {
      this.acceptAction(action);
    }

    const receipts = Object.freeze([...evaluated.receipts]);
    for (const entry of receipts) {
      this.controllerReceipts.set(entry.factionId, entry.receipt);
    }
    this.controllerFaultCounts = new Map(evaluated.faultCounts);
    this.controllerConsecutiveFaultCounts = new Map(
      evaluated.consecutiveFaultCounts,
    );
    this.controllerFaultedFactionIds = new Set(evaluated.faultedFactionIds);
    this.lastControllerRoundTick = this.state.tick;
    this.nextControllerDecisionNumber += 1;
    return receipts;
  }

  runControllerRound(
    host: ControllerHost,
  ): readonly ControllerRoundReceipt[] | Promise<readonly ControllerRoundReceipt[]> {
    if (this.controllerRoundInFlightTick !== undefined) {
      throw new Error("controller round is in progress for this simulation tick");
    }
    if (this.lastControllerRoundTick === this.state.tick) {
      throw new Error("controller round already executed for this simulation tick");
    }

    const roundTick = this.state.tick;
    const evaluated = evaluateControllerRound(
      this.state,
      host,
      this.nextControllerDecisionNumber,
      this.controllerReceipts,
      this.controllerFaultCounts,
      this.controllerConsecutiveFaultCounts,
      this.controllerFaultedFactionIds,
    );

    if (!isPromiseLike(evaluated)) {
      return this.commitControllerRound(evaluated);
    }

    this.controllerRoundInFlightTick = roundTick;
    return Promise.resolve(evaluated)
      .then((resolved) => {
        if (this.state.tick !== roundTick) {
          throw new Error("simulation tick changed during controller round");
        }
        return this.commitControllerRound(resolved);
      })
      .finally(() => {
        this.controllerRoundInFlightTick = undefined;
      });
  }

  tick(): MatchState {
    if (this.controllerRoundInFlightTick !== undefined) {
      throw new Error("controller round is in progress for this simulation tick");
    }
    const nextTick = this.state.tick + 1;
    const executing = this.pendingInputs.filter((input) => input.tick === nextTick);
    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.tick !== nextTick,
    );
    this.state = this.engine.advance(this.state, executing);
    return this.state;
  }

  acceptedInputs(): readonly AcceptedSimulationInput[] {
    return Object.freeze([...this.acceptedInputLog]);
  }

  stateFingerprint(): string {
    const base = canonicalMatchStateSerialization(this.state);
    if (this.spawnSnapshot === undefined) {
      return base;
    }
    return `{"matchState":${base},"phase":${JSON.stringify(
      this.phase,
    )},"spawnSnapshot":${JSON.stringify(this.spawnSnapshot)}}`;
  }

  static regenerate(
    spec: MatchSpec,
    inputs: readonly AcceptedSimulationInput[],
    finalTick: number,
    dependencies: MatchRuntimeDependencies = {},
  ): MatchRuntime {
    if (!Number.isInteger(finalTick) || finalTick < 0) {
      throw new Error("final replay tick must be a non-negative integer");
    }

    const orderedInputs = [...inputs].sort(
      (left, right) => left.tick - right.tick || left.sequence - right.sequence,
    );
    if (orderedInputs.some((input) => input.tick < 1 || input.tick > finalTick)) {
      throw new Error(
        "accepted input stream contains a tick outside replay range",
      );
    }

    const runtime = new MatchRuntime(spec, dependencies);
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
          throw new Error(
            "accepted input stream is not canonical for this MatchSpec",
          );
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
