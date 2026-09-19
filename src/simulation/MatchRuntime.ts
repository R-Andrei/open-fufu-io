import type {
  ControllerDecision,
  CounterResponseDirective,
  JsonValue,
  DecisionFailure,
  DecisionReceipt,
} from "../core/controller/ControllerApi";
import {
  controllerTeamSignalPayloadIsValid,
  controllerUnitBuildFailureCode,
  mapControllerStructureBuildFailure,
  materializeControllerTeamSignalPayload,
  mapControllerStructureUpgradeFailure,
  mapControllerTransportEmbarkFailure,
} from "./ControllerQueryProjection";
import { ControllerReferenceSession } from "./ControllerReferenceSession";
import {
  evaluateControllerRound,
  type ControllerHost,
  type ControllerHostInvocationResult,
  type ControllerProposedAction,
  type ControllerRoundEvaluation,
  type PendingTeamSignalObservation,
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
  tryPurchaseStructureBuild,
  tryPurchaseStructureUpgrade,
} from "./Structures";
import {
  trySetTankStrategicDestination,
  tryStartTankProduction,
  type TankStrategicDestinationFailureCode,
} from "./Tanks";
import {
  tryRelinquishTerritory,
  type TerritoryRelinquishmentFailureCode,
} from "./TerritoryEffects";
import {
  tryCommitTransportEmbark,
  tryStartTransportRecall,
  type TransportRecallFailureCode,
} from "./Transports";
import {
  tryCommitStrategicLaunch,
  type StrategicLaunchFailureCode,
} from "./StrategicWeapons";
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
  /**
   * Opaque live-match namespace for private controller refs. It is intentionally
   * operational session state rather than canonical MatchSpec/replay state.
   */
  readonly controllerReferenceNamespace?: string;
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

function operationDirectRevealIsActive(
  state: MatchState,
  viewerFactionId: string,
  operationId: string,
): boolean {
  return state.directReveals.some(
    (record) =>
      record.viewerFactionId === viewerFactionId &&
      record.sourceKind === "OPERATION" &&
      record.sourceId === operationId &&
      state.tick < record.expiryExclusiveTick,
  );
}

function resolveCounterResponseOperationRefs(
  state: MatchState,
  factionId: string,
  decision: ControllerDecision,
  references: ControllerReferenceSession,
): ControllerDecision {
  const directives = decision.directives;
  if (
    directives?.set === undefined ||
    !directives.set.some((directive) => directive.kind === "COUNTER_RESPONSE")
  ) {
    return decision;
  }

  const set = directives.set.map((directive) => {
    if (directive.kind !== "COUNTER_RESPONSE") return directive;
    const incomingOperation = directive.incomingOperation;
    if (incomingOperation === undefined) return directive;

    const operationId = references.resolve(
      factionId,
      "OPERATION",
      incomingOperation,
    );
    if (operationId === undefined) return directive;

    const operation = state.operations.find(
      (candidate) => candidate.id === operationId,
    );
    if (
      operation === undefined ||
      operation.kind !== "ATTACK" ||
      operation.targetFactionId !== factionId ||
      !operationDirectRevealIsActive(state, factionId, operationId)
    ) {
      return directive;
    }

    return Object.freeze({
      kind: "COUNTER_RESPONSE" as const,
      key: directive.key,
      incomingOperationId: operationId,
      population: directive.population,
    }) as CounterResponseDirective;
  });

  return Object.freeze({
    ...decision,
    directives: Object.freeze({
      ...directives,
      set: Object.freeze(set),
    }),
  });
}

function resolvingControllerHost(
  host: ControllerHost,
  state: MatchState,
  references: ControllerReferenceSession,
): ControllerHost {
  const resolveInvocation = (
    factionId: string,
    result: ControllerHostInvocationResult<ControllerDecision>,
  ): ControllerHostInvocationResult<ControllerDecision> => {
    if (!result.ok || result.output === undefined) return result;
    return Object.freeze({
      ...result,
      output: resolveCounterResponseOperationRefs(
        state,
        factionId,
        result.output,
        references,
      ),
    });
  };

  return Object.freeze({
    invoke(factionId, observation, querySession) {
      const invocation = host.invoke(factionId, observation, querySession);
      return isPromiseLike(invocation)
        ? Promise.resolve(invocation).then((result) =>
            resolveInvocation(factionId, result),
          )
        : resolveInvocation(factionId, invocation);
    },
    chooseInfluence(factionId, context) {
      return host.chooseInfluence(factionId, context);
    },
    reconsiderInfluence(factionId, context) {
      return host.reconsiderInfluence(factionId, context);
    },
    chooseOrigins(factionId, context) {
      return host.chooseOrigins(factionId, context);
    },
  });
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
    case "TEAM_SIGNAL": {
      faction(state, action.senderFactionId);
      if (
        typeof action.channel !== "string" ||
        !controllerTeamSignalPayloadIsValid(action.payload)
      ) {
        throw new Error("invalid team signal");
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
    case "PURCHASE_STRUCTURE_BUILD": {
      const purchased = tryPurchaseStructureBuild(state, {
        structureId: action.structureId,
        ownerId: action.ownerId,
        type: action.structureType,
        cellId: action.cellId,
      });
      if (!purchased.ok) {
        throw new Error(`invalid structure build purchase: ${purchased.failure.code}`);
      }
      break;
    }
    case "PURCHASE_STRUCTURE_UPGRADE": {
      const purchased = tryPurchaseStructureUpgrade(state, {
        structureId: action.structureId,
        ownerId: action.ownerId,
      });
      if (!purchased.ok) {
        throw new Error(`invalid structure upgrade purchase: ${purchased.failure.code}`);
      }
      break;
    }
    case "START_TANK_PRODUCTION": {
      const started = tryStartTankProduction(state, {
        ownerId: action.ownerId,
        factoryId: action.factoryId,
        strategicDestinationCellId: action.strategicDestinationCellId,
      });
      if (!started.ok) {
        throw new Error(
          `invalid Tank production start: ${started.failure.code}`,
        );
      }
      break;
    }
    case "SET_UNIT_STRATEGIC_DESTINATION": {
      const moved = trySetTankStrategicDestination(state, {
        ownerId: action.ownerId,
        unitId: action.unitId,
        destinationCellId: action.destinationCellId,
      });
      if (!moved.ok) {
        throw new Error(
          `invalid Tank strategic destination: ${moved.failure.code}`,
        );
      }
      break;
    }
    case "EMBARK_TRANSPORT": {
      const embarked = tryCommitTransportEmbark(state, {
        ownerId: action.ownerId,
        sourceCellId: action.sourceCellId,
        targetCellId: action.targetCellId,
        population: action.population,
      });
      if (!embarked.ok) {
        throw new Error(`invalid Transport embark: ${embarked.failure.code}`);
      }
      break;
    }
    case "RETURN_TRANSPORT": {
      const recalled = tryStartTransportRecall(state, {
        ownerId: action.ownerId,
        transportId: action.transportId,
      });
      if (!recalled.ok) {
        throw new Error(`invalid Transport recall: ${recalled.failure.code}`);
      }
      break;
    }
    case "RELINQUISH_TERRITORY": {
      const relinquished = tryRelinquishTerritory(state, {
        ownerId: action.ownerId,
        cellIds: action.cellIds,
      });
      if (!relinquished.ok) {
        throw new Error(
          `invalid territory relinquishment: ${relinquished.failure.code}`,
        );
      }
      break;
    }
    case "LAUNCH_STRATEGIC_WEAPON": {
      const launched = tryCommitStrategicLaunch(
        state,
        {
          ownerId: action.ownerId,
          launcherId: action.launcherId,
          weapon: action.weapon,
          targetCellId: action.targetCellId,
          ...(action.targetFactionId === undefined
            ? {}
            : { targetFactionId: action.targetFactionId }),
        },
        state.tick + 1,
      );
      if (!launched.ok) {
        throw new Error(
          `invalid strategic launch: ${launched.failure.code}`,
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
      : input.action.type === "TEAM_SIGNAL"
        ? Object.freeze({
            ...input.action,
            payload: materializeControllerTeamSignalPayload(input.action.payload),
          })
        : Object.freeze({ ...input.action });
  return Object.freeze({
    tick: input.tick,
    sequence: input.sequence,
    action,
  });
}

function decisionFailure(
  code: DecisionFailure["code"],
  key?: string,
): DecisionFailure {
  return Object.freeze({
    code,
    ...(key === undefined ? {} : { key }),
  });
}

function mapTankStrategicDestinationFailure(
  code: TankStrategicDestinationFailureCode,
  key?: string,
): DecisionFailure {
  switch (code) {
    case "NOT_OWNER":
      return decisionFailure("NOT_OWNER", key);
    case "INVALID_REQUEST":
    case "UNKNOWN_OWNER":
    case "UNKNOWN_TANK":
    case "INVALID_DESTINATION":
      return decisionFailure("INVALID_TARGET", key);
  }
}

function mapTerritoryRelinquishmentFailure(
  code: TerritoryRelinquishmentFailureCode,
  key?: string,
): DecisionFailure {
  switch (code) {
    case "INVALID_REQUEST":
    case "UNKNOWN_OWNER":
      return decisionFailure("INVALID_TARGET", key);
    case "CELL_NOT_OWNED":
      return decisionFailure("CELL_NOT_OWNED", key);
    case "PERSISTENT_STRUCTURE_PRESENT":
      return decisionFailure("PERSISTENT_STRUCTURE_PRESENT", key);
  }
}

function mapTransportRecallFailure(
  code: TransportRecallFailureCode,
  key?: string,
): DecisionFailure {
  switch (code) {
    case "NOT_OWNER":
      return decisionFailure("NOT_OWNER", key);
    case "INVALID_REQUEST":
    case "UNKNOWN_OWNER":
    case "OWNER_INACTIVE":
    case "UNKNOWN_TRANSPORT":
    case "NOT_ACTIVE_OPERATION":
    case "NO_RETURN_ROUTE":
      return decisionFailure("INVALID_TARGET", key);
  }
}

function mapStrategicLaunchFailure(
  code: StrategicLaunchFailureCode,
  key?: string,
): DecisionFailure {
  switch (code) {
    case "INVALID_REQUEST":
    case "INVALID_TARGET":
      return decisionFailure("INVALID_TARGET", key);
    case "UNKNOWN_OWNER":
    case "UNKNOWN_LAUNCHER":
    case "LAUNCHER_INACTIVE":
    case "LAUNCHER_LEVEL_REQUIRED":
      return decisionFailure("INVALID_LAUNCHER", key);
    case "NOT_OWNER":
      return decisionFailure("NOT_OWNER", key);
    case "WEAPON_NOT_PERMITTED":
      return decisionFailure("INVALID_COMMAND", key);
    case "NO_READY_CHARGE":
      return decisionFailure("COMMITMENT_LIMIT", key);
    case "INSUFFICIENT_FFY":
      return decisionFailure("INSUFFICIENT_FFY", key);
  }
}

function controllerActionFailure(
  state: MatchState,
  proposed: ControllerProposedAction,
  action: SimulationAction,
): DecisionFailure | undefined {
  switch (action.type) {
    case "CAPITULATE_FACTION": {
      const target = state.factions.find(
        (candidate) => candidate.id === action.factionId,
      );
      return target === undefined || target.status !== "ACTIVE"
        ? decisionFailure("INVALID_TARGET", proposed.key)
        : undefined;
    }
    case "APPLY_PERSISTENT_DIRECTIVES": {
      const applied = tryApplyPersistentDirectiveChanges(
        state,
        action.factionId,
        action.changes,
      );
      return applied.ok ? undefined : applied.failure;
    }
    case "PURCHASE_STRUCTURE_BUILD": {
      const purchased = tryPurchaseStructureBuild(state, {
        structureId: action.structureId,
        ownerId: action.ownerId,
        type: action.structureType,
        cellId: action.cellId,
      });
      return purchased.ok
        ? undefined
        : mapControllerStructureBuildFailure(
            state,
            action.ownerId,
            action.cellId,
            purchased.failure.code,
            proposed.key,
          );
    }
    case "PURCHASE_STRUCTURE_UPGRADE": {
      const purchased = tryPurchaseStructureUpgrade(state, {
        structureId: action.structureId,
        ownerId: action.ownerId,
      });
      return purchased.ok
        ? undefined
        : mapControllerStructureUpgradeFailure(
            state,
            action.ownerId,
            action.structureId,
            purchased.failure.code,
            proposed.key,
          );
    }
    case "START_TANK_PRODUCTION": {
      const started = tryStartTankProduction(state, {
        ownerId: action.ownerId,
        factoryId: action.factoryId,
        strategicDestinationCellId: action.strategicDestinationCellId,
      });
      return started.ok
        ? undefined
        : decisionFailure(
            controllerUnitBuildFailureCode(started.failure.code),
            proposed.key,
          );
    }
    case "SET_UNIT_STRATEGIC_DESTINATION": {
      const moved = trySetTankStrategicDestination(state, {
        ownerId: action.ownerId,
        unitId: action.unitId,
        destinationCellId: action.destinationCellId,
      });
      return moved.ok
        ? undefined
        : mapTankStrategicDestinationFailure(
            moved.failure.code,
            proposed.key,
          );
    }
    case "EMBARK_TRANSPORT": {
      const embarked = tryCommitTransportEmbark(state, {
        ownerId: action.ownerId,
        sourceCellId: action.sourceCellId,
        targetCellId: action.targetCellId,
        population: action.population,
      });
      return embarked.ok
        ? undefined
        : mapControllerTransportEmbarkFailure(
            embarked.failure.code,
            proposed.key,
          );
    }
    case "RETURN_TRANSPORT": {
      const recalled = tryStartTransportRecall(state, {
        ownerId: action.ownerId,
        transportId: action.transportId,
      });
      return recalled.ok
        ? undefined
        : mapTransportRecallFailure(recalled.failure.code, proposed.key);
    }
    case "RELINQUISH_TERRITORY": {
      const relinquished = tryRelinquishTerritory(state, {
        ownerId: action.ownerId,
        cellIds: action.cellIds,
      });
      return relinquished.ok
        ? undefined
        : mapTerritoryRelinquishmentFailure(
            relinquished.failure.code,
            proposed.key,
          );
    }
    case "LAUNCH_STRATEGIC_WEAPON": {
      const launched = tryCommitStrategicLaunch(
        state,
        {
          ownerId: action.ownerId,
          launcherId: action.launcherId,
          weapon: action.weapon,
          targetCellId: action.targetCellId,
          ...(action.targetFactionId === undefined
            ? {}
            : { targetFactionId: action.targetFactionId }),
        },
        state.tick + 1,
      );
      return launched.ok
        ? undefined
        : mapStrategicLaunchFailure(
            launched.failure.code,
            proposed.key,
          );
    }
    default:
      validateAction(state, action);
      return undefined;
  }
}

function resolvePendingTeamSignalDeliveries(
  state: MatchState,
  inputs: readonly AcceptedSimulationInput[],
): ReadonlyMap<string, readonly PendingTeamSignalObservation[]> {
  const factionsById = new Map(state.factions.map((entry) => [entry.id, entry]));
  const activeById = new Map(
    state.factions.map((entry) => [entry.id, entry.status === "ACTIVE"]),
  );
  const deliveries = new Map<string, PendingTeamSignalObservation[]>();

  for (const input of [...inputs].sort(
    (left, right) => left.sequence - right.sequence,
  )) {
    if (input.action.type === "CAPITULATE_FACTION") {
      activeById.set(input.action.factionId, false);
      continue;
    }
    if (input.action.type !== "TEAM_SIGNAL") continue;

    const sender = factionsById.get(input.action.senderFactionId);
    if (sender === undefined) {
      throw new Error(
        `accepted team signal has unknown sender: ${input.action.senderFactionId}`,
      );
    }
    const fixedTeamId = sender.fixedTeamId;
    if (fixedTeamId === undefined) continue;

    const signal = Object.freeze({
      senderFactionId: sender.id,
      channel: input.action.channel,
      payload: input.action.payload,
    });
    for (const recipient of state.factions) {
      if (
        recipient.id === sender.id ||
        recipient.fixedTeamId !== fixedTeamId ||
        activeById.get(recipient.id) !== true
      ) {
        continue;
      }
      const existing = deliveries.get(recipient.id);
      if (existing === undefined) {
        deliveries.set(recipient.id, [signal]);
      } else {
        existing.push(signal);
      }
    }
  }

  return new Map(
    [...deliveries].map(([factionId, signals]) => [
      factionId,
      Object.freeze([...signals]),
    ]),
  );
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
  private readonly pendingTeamSignalsByFaction = new Map<
    string,
    readonly PendingTeamSignalObservation[]
  >();
  private phase: MatchRuntimePhase = "ACTIVE";
  private spawnSnapshot?: SpawnSnapshot;
  private readonly controllerReferences?: ControllerReferenceSession;

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
    if (dependencies.controllerReferenceNamespace === undefined) {
      throw new Error("controller reference namespace is required");
    }
    this.controllerReferences = new ControllerReferenceSession(
      dependencies.controllerReferenceNamespace,
      this.state,
    );
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

  controllerReferenceSession(): ControllerReferenceSession {
    if (this.controllerReferences === undefined) {
      throw new Error("controller reference session is not configured");
    }
    return this.controllerReferences;
  }

  private validationState(): MatchState {
    if (this.pendingInputs.length === 0) return this.state;
    return this.engine.applyAcceptedInputs(this.state, this.pendingInputs);
  }

  acceptAction(action: SimulationAction): AcceptedSimulationInput {
    if (this.controllerRoundInFlightTick !== undefined) {
      throw new Error("controller round is in progress for this simulation tick");
    }
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

  private materializeControllerAction(
    proposed: ControllerProposedAction,
    sequence: number,
    proposalBaseState: MatchState,
  ): SimulationAction | undefined {
    if (proposed.action.type === "CONTROLLER_PURCHASE_STRUCTURE_BUILD") {
      return Object.freeze({
        type: "PURCHASE_STRUCTURE_BUILD" as const,
        structureId: `structure:purchase:${this.spec.seed}:${this.state.tick + 1}:${sequence}`,
        ownerId: proposed.action.ownerId,
        structureType: proposed.action.structureType,
        cellId: proposed.action.cellId,
      });
    }
    if (proposed.action.type === "CONTROLLER_PURCHASE_STRUCTURE_UPGRADE") {
      const structure = proposalBaseState.structures.find(
        (candidate) => candidate.cellId === proposed.action.cellId,
      );
      if (structure === undefined) return undefined;
      return Object.freeze({
        type: "PURCHASE_STRUCTURE_UPGRADE" as const,
        structureId: structure.id,
        ownerId: proposed.action.ownerId,
      });
    }
    return proposed.action;
  }

  private acceptControllerProposalAtomically(
    actions: readonly ControllerProposedAction[],
  ): DecisionFailure | undefined {
    const acceptedBatch: AcceptedSimulationInput[] = [];
    const proposalBaseState = this.validationState();

    for (const proposed of actions) {
      const sequence = this.nextSequence + acceptedBatch.length;
      const action = this.materializeControllerAction(
        proposed,
        sequence,
        proposalBaseState,
      );
      if (action === undefined) {
        return decisionFailure("INVALID_TARGET", proposed.key);
      }
      const priorInputs = [...this.pendingInputs, ...acceptedBatch];
      const validationState =
        priorInputs.length === 0
          ? this.state
          : this.engine.applyAcceptedInputs(this.state, priorInputs);
      const failure = controllerActionFailure(validationState, proposed, action);
      if (failure !== undefined) return failure;

      // This second canonical check is intentionally strict: a successful
      // structured controller validation followed by a normal validator failure
      // would be an engine inconsistency rather than an ordinary gameplay result.
      validateAction(validationState, action);
      acceptedBatch.push(
        freezeAcceptedInput({
          tick: this.state.tick + 1,
          sequence,
          action,
        }),
      );
    }

    this.nextSequence += acceptedBatch.length;
    this.pendingInputs.push(...acceptedBatch);
    this.acceptedInputLog.push(...acceptedBatch);
    return undefined;
  }

  private commitControllerRound(
    evaluated: ControllerRoundEvaluation,
  ): readonly ControllerRoundReceipt[] {
    const receipts = [...evaluated.receipts];
    const receiptIndexByFaction = new Map(
      receipts.map((entry, index) => [entry.factionId, index] as const),
    );

    for (const proposal of evaluated.proposals) {
      const receiptIndex = receiptIndexByFaction.get(proposal.factionId);
      if (receiptIndex === undefined) {
        throw new Error(
          `controller proposal has no receipt for faction ${proposal.factionId}`,
        );
      }
      const existing = receipts[receiptIndex];
      if (existing === undefined || !existing.receipt.accepted) continue;

      const failure = this.acceptControllerProposalAtomically(proposal.actions);
      if (failure === undefined) continue;

      receipts[receiptIndex] = Object.freeze({
        factionId: existing.factionId,
        receipt: Object.freeze({
          ...existing.receipt,
          accepted: false,
          failure,
        }),
      });
    }

    const frozenReceipts = Object.freeze(receipts);
    for (const entry of frozenReceipts) {
      this.controllerReceipts.set(entry.factionId, entry.receipt);
    }
    for (const faction of this.state.factions) {
      if (!this.controllerFaultedFactionIds.has(faction.id)) {
        this.pendingTeamSignalsByFaction.delete(faction.id);
      }
    }
    this.controllerFaultCounts = new Map(evaluated.faultCounts);
    this.controllerConsecutiveFaultCounts = new Map(
      evaluated.consecutiveFaultCounts,
    );
    this.controllerFaultedFactionIds = new Set(evaluated.faultedFactionIds);
    this.lastControllerRoundTick = this.state.tick;
    this.nextControllerDecisionNumber += 1;
    return frozenReceipts;
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
    this.controllerRoundInFlightTick = roundTick;
    const evaluationHost =
      this.controllerReferences === undefined
        ? host
        : resolvingControllerHost(host, this.state, this.controllerReferences);

    let evaluated: ControllerRoundEvaluation | Promise<ControllerRoundEvaluation>;
    try {
      evaluated = evaluateControllerRound(
        this.state,
        evaluationHost,
        this.nextControllerDecisionNumber,
        this.controllerReceipts,
        this.controllerFaultCounts,
        this.controllerConsecutiveFaultCounts,
        this.controllerFaultedFactionIds,
        this.controllerReferences,
        this.pendingTeamSignalsByFaction,
      );
    } catch (error) {
      this.controllerRoundInFlightTick = undefined;
      throw error;
    }

    if (!isPromiseLike(evaluated)) {
      try {
        return this.commitControllerRound(evaluated);
      } finally {
        this.controllerRoundInFlightTick = undefined;
      }
    }

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
    const teamSignalDeliveries = resolvePendingTeamSignalDeliveries(
      this.state,
      executing,
    );
    const nextState = this.engine.advance(this.state, executing);
    if (this.controllerReferences !== undefined) {
      for (const input of [...executing].sort(
        (left, right) => left.sequence - right.sequence,
      )) {
        switch (input.action.type) {
          case "APPLY_PERSISTENT_DIRECTIVES":
            this.controllerReferences.applyDirectiveChanges(
              input.action.factionId,
              input.action.changes,
            );
            break;
          case "PURCHASE_STRUCTURE_BUILD":
          case "PURCHASE_STRUCTURE_UPGRADE":
            this.controllerReferences.applyEntityLifecycleTransition(
              "STRUCTURE",
              input.action.structureId,
              "START",
            );
            break;
        }
      }
      this.controllerReferences.reconcile(nextState);
    }
    this.state = nextState;
    for (const [factionId, signals] of teamSignalDeliveries) {
      const existing = this.pendingTeamSignalsByFaction.get(factionId);
      this.pendingTeamSignalsByFaction.set(
        factionId,
        existing === undefined
          ? signals
          : Object.freeze([...existing, ...signals]),
      );
    }
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
