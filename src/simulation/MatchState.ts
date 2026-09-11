import type {
  FactionStatus,
  StructureType,
} from "../core/controller/ControllerApi";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import { reducedRational } from "../core/rules/RuleComposition";
import { materializeFfyBalance, STARTING_FFY } from "./Economy";
import type { FactoryRailLoopLifecycleState } from "./FactoryRailLifecycle";
import {
  canonicalHostilitySideKey,
  materializeHostilityGraceState,
  type HostilityGraceState,
} from "./HostilityState";
import {
  canonicalCellSelectorKey,
  canonicalSpatialPolicyKey,
  materializeDefensePriorityState,
  materializeLandOperationState,
  type CaptureProgressState,
  type CounterResponseResidualState,
  type DefensePriorityState,
  type LandOperationState,
} from "./LandOperations";
import {
  isArtifactMapSpec,
  type MatchSpec,
  type SyntheticMapSpec,
} from "./MatchSpec";
import {
  materializeMobileUnitCollection,
  type MobileUnitState,
} from "./MobileUnits";
import {
  createEmptyPopulationState,
  createPopulationState,
  type PopulationState,
} from "./Population";
import type { FactoryRailLoopPlan } from "./RailNetwork";
import {
  createSimulationMap,
  type SimulationMap,
  type SimulationTerrain,
} from "./SimulationMap";
import {
  materializePersistentStructures,
  tryMaterializeStructureGrant,
  type PersistentStructureState,
} from "./Structures";
import type {
  FactoryTrainServiceEpochState,
  TrainDispatchEconomicSnapshot,
} from "./TrainService";

const STRUCTURE_TYPES = new Set<StructureType>([
  "CITY",
  "FORT",
  "PORT",
  "FACTORY",
  "MISSILE_SILO",
  "SAM_LAUNCHER",
  "OBSERVATION_POST",
  "COMMAND_POST",
]);

export interface MatchFactionState {
  readonly id: string;
  readonly status: FactionStatus;
  readonly rules: CompiledRuleProfile;
  readonly population: PopulationState;
  readonly ffy: number;
  readonly successfulStructurePurchaseTypes: readonly StructureType[];
  readonly testMarker: number;
  readonly fixedTeamId?: string;
}

export interface TrainServiceRuntimeState {
  readonly trainId: string;
  readonly factoryId: string;
  readonly loopSnapshotId: string;
  readonly isPrimary: boolean;
  readonly dispatchSnapshot: TrainDispatchEconomicSnapshot;
  readonly resumeAtTick: number | null;
}

export interface MatchState {
  readonly seed: string;
  readonly tick: number;
  readonly map: SimulationMap;
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
  readonly factions: readonly MatchFactionState[];
  readonly structures: readonly PersistentStructureState[];
  readonly mobileUnits: readonly MobileUnitState[];
  readonly nextMobileUnitOrdinal: number;
  readonly factoryRailLoops: readonly FactoryRailLoopLifecycleState[];
  readonly factoryTrainEpochs: readonly FactoryTrainServiceEpochState[];
  readonly trainServices: readonly TrainServiceRuntimeState[];
  readonly operations: readonly LandOperationState[];
  readonly defensePriorities: readonly DefensePriorityState[];
  readonly captureProgress: readonly CaptureProgressState[];
  readonly counterResponseResiduals: readonly CounterResponseResidualState[];
  readonly hostilityGrace: readonly HostilityGraceState[];
}

export interface MatchStateUpdate {
  readonly factions?: readonly MatchFactionState[];
  readonly ownership?: readonly (string | null)[];
  readonly fallout?: readonly boolean[];
  readonly structures?: readonly PersistentStructureState[];
  readonly mobileUnits?: readonly MobileUnitState[];
  readonly nextMobileUnitOrdinal?: number;
  readonly factoryRailLoops?: readonly FactoryRailLoopLifecycleState[];
  readonly factoryTrainEpochs?: readonly FactoryTrainServiceEpochState[];
  readonly trainServices?: readonly TrainServiceRuntimeState[];
  readonly operations?: readonly LandOperationState[];
  readonly defensePriorities?: readonly DefensePriorityState[];
  readonly captureProgress?: readonly CaptureProgressState[];
  readonly counterResponseResiduals?: readonly CounterResponseResidualState[];
  readonly hostilityGrace?: readonly HostilityGraceState[];
}

function createSyntheticMap(map: SyntheticMapSpec): SimulationMap {
  return createSimulationMap({
    source: "SYNTHETIC",
    width: map.width,
    height: map.height,
    terrain: map.terrain as readonly SimulationTerrain[],
    ...(map.initialOwners === undefined ? {} : { initialOwners: map.initialOwners }),
    ...(map.initialFallout === undefined ? {} : { initialFallout: map.initialFallout }),
  });
}

function freezeSuccessfulStructurePurchaseTypes(
  types: readonly StructureType[],
): readonly StructureType[] {
  const seen = new Set<StructureType>();
  for (const type of types) {
    if (!STRUCTURE_TYPES.has(type)) {
      throw new Error(`unknown successful structure purchase type: ${String(type)}`);
    }
    if (seen.has(type)) {
      throw new Error(`duplicate successful structure purchase type: ${type}`);
    }
    seen.add(type);
  }
  return Object.freeze([...seen].sort());
}

function freezeFactions(
  factions: readonly MatchFactionState[],
): readonly MatchFactionState[] {
  return Object.freeze(
    factions.map((faction) =>
      Object.freeze({
        id: faction.id,
        status: faction.status,
        rules: faction.rules,
        population: createPopulationState(faction.population),
        ffy: materializeFfyBalance(faction.ffy),
        successfulStructurePurchaseTypes: freezeSuccessfulStructurePurchaseTypes(
          faction.successfulStructurePurchaseTypes ?? [],
        ),
        testMarker: faction.testMarker,
        ...(faction.fixedTeamId === undefined
          ? {}
          : { fixedTeamId: faction.fixedTeamId }),
      }),
    ),
  );
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertNonEmptyId(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function freezeOwnership(
  ownership: readonly (string | null)[],
  previous?: readonly (string | null)[],
): readonly (string | null)[] {
  const materialized = [...ownership];
  if (
    previous !== undefined &&
    previous.length === materialized.length &&
    materialized.every((ownerId, index) => ownerId === previous[index])
  ) {
    return previous;
  }
  return Object.freeze(materialized);
}

function freezeFallout(fallout: readonly boolean[]): readonly boolean[] {
  return Object.freeze([...fallout]);
}

function freezeCaptureProgress(
  entries: readonly CaptureProgressState[],
): readonly CaptureProgressState[] {
  return Object.freeze(
    [...entries]
      .sort(
        (left, right) =>
          left.cellId - right.cellId ||
          compareIds(left.claimantFactionId, right.claimantFactionId),
      )
      .map((entry) => Object.freeze({ ...entry })),
  );
}

function freezeCounterResiduals(
  entries: readonly CounterResponseResidualState[],
): readonly CounterResponseResidualState[] {
  return Object.freeze(
    [...entries]
      .sort(
        (left, right) =>
          compareIds(left.attackerFactionId, right.attackerFactionId) ||
          compareIds(left.responderFactionId, right.responderFactionId),
      )
      .map((entry) => Object.freeze({ ...entry })),
  );
}

function freezeHostilityGrace(
  entries: readonly HostilityGraceState[],
): readonly HostilityGraceState[] {
  return Object.freeze(
    entries
      .map(materializeHostilityGraceState)
      .sort(
        (left, right) =>
          compareIds(
            canonicalHostilitySideKey(left.sideA),
            canonicalHostilitySideKey(right.sideA),
          ) ||
          compareIds(
            canonicalHostilitySideKey(left.sideB),
            canonicalHostilitySideKey(right.sideB),
          ),
      ),
  );
}

function freezeFactoryLoopPlan(
  loop: FactoryRailLoopPlan | null,
  factoryId: string,
  map: SimulationMap,
): FactoryRailLoopPlan | null {
  if (loop === null) return null;
  if (loop === undefined || typeof loop !== "object" || Array.isArray(loop)) {
    throw new Error("Factory rail loop must be an object or null");
  }
  if (loop.factoryId !== factoryId) {
    throw new Error(`Factory rail loop ${loop.factoryId} cannot belong to ${factoryId}`);
  }
  if (
    !Array.isArray(loop.targetStructureIds) ||
    !Array.isArray(loop.servicedStructureIds) ||
    !Array.isArray(loop.cells)
  ) {
    throw new Error("Factory rail loop collections must be arrays");
  }
  for (const id of loop.targetStructureIds) {
    assertNonEmptyId(id, "Factory rail target structure ID");
  }
  for (const id of loop.servicedStructureIds) {
    assertNonEmptyId(id, "Factory rail serviced structure ID");
  }
  for (const cellId of loop.cells) {
    if (!map.isValidCellId(cellId)) {
      throw new Error(`Factory rail loop cell is outside the map: ${String(cellId)}`);
    }
  }
  assertNonNegativeSafeInteger(
    loop.sharedExistingEdgeCount,
    "Factory rail shared edge count",
  );
  return Object.freeze({
    factoryId,
    targetStructureIds: Object.freeze([...loop.targetStructureIds]),
    servicedStructureIds: Object.freeze([...loop.servicedStructureIds]),
    cells: Object.freeze([...loop.cells]),
    sharedExistingEdgeCount: loop.sharedExistingEdgeCount,
  });
}

function freezeFactoryRailLoops(
  entries: readonly FactoryRailLoopLifecycleState[],
  map: SimulationMap,
): readonly FactoryRailLoopLifecycleState[] {
  const seenFactories = new Set<string>();
  return Object.freeze(
    [...entries]
      .sort((left, right) => compareIds(left.factoryId, right.factoryId))
      .map((entry) => {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
          throw new Error("Factory rail lifecycle state must be an object");
        }
        assertNonEmptyId(entry.factoryId, "Factory rail lifecycle factory ID");
        if (seenFactories.has(entry.factoryId)) {
          throw new Error(`duplicate Factory rail lifecycle: ${entry.factoryId}`);
        }
        seenFactories.add(entry.factoryId);
        if (!Array.isArray(entry.retainedSnapshots)) {
          throw new Error("Factory rail retained snapshots must be an array");
        }
        const seenSnapshots = new Set<string>();
        const retainedSnapshots = Object.freeze(
          [...entry.retainedSnapshots]
            .sort((left, right) => compareIds(left.snapshotId, right.snapshotId))
            .map((snapshot) => {
              if (
                snapshot === null ||
                typeof snapshot !== "object" ||
                Array.isArray(snapshot) ||
                !Array.isArray(snapshot.cells)
              ) {
                throw new Error("Factory rail retained snapshot must be an object");
              }
              assertNonEmptyId(snapshot.snapshotId, "Factory rail snapshot ID");
              if (seenSnapshots.has(snapshot.snapshotId)) {
                throw new Error(`duplicate Factory rail snapshot ID: ${snapshot.snapshotId}`);
              }
              seenSnapshots.add(snapshot.snapshotId);
              for (const cellId of snapshot.cells) {
                if (!map.isValidCellId(cellId)) {
                  throw new Error(
                    `Factory rail snapshot cell is outside the map: ${String(cellId)}`,
                  );
                }
              }
              return Object.freeze({
                snapshotId: snapshot.snapshotId,
                cells: Object.freeze([...snapshot.cells]),
              });
            }),
        );
        return Object.freeze({
          factoryId: entry.factoryId,
          currentLoop: freezeFactoryLoopPlan(entry.currentLoop, entry.factoryId, map),
          pendingLoop: freezeFactoryLoopPlan(entry.pendingLoop, entry.factoryId, map),
          retainedSnapshots,
        });
      }),
  );
}

function freezeFactoryTrainEpochs(
  entries: readonly FactoryTrainServiceEpochState[],
): readonly FactoryTrainServiceEpochState[] {
  const seenFactories = new Set<string>();
  return Object.freeze(
    [...entries]
      .sort((left, right) => compareIds(left.factoryId, right.factoryId))
      .map((entry) => {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
          throw new Error("Factory Train epoch state must be an object");
        }
        assertNonEmptyId(entry.factoryId, "Factory Train epoch factory ID");
        assertNonEmptyId(entry.ownerId, "Factory Train epoch owner ID");
        if (seenFactories.has(entry.factoryId)) {
          throw new Error(`duplicate Factory Train epoch: ${entry.factoryId}`);
        }
        seenFactories.add(entry.factoryId);
        if (entry.activePrimaryTrainId !== null) {
          assertNonEmptyId(entry.activePrimaryTrainId, "active primary Train ID");
        }
        assertNonNegativeSafeInteger(
          entry.turnaroundRemainingActiveTicks,
          "Factory Train turnaround",
        );
        if (
          !Number.isInteger(entry.p07PrimaryDispatchPhase) ||
          entry.p07PrimaryDispatchPhase < 0 ||
          entry.p07PrimaryDispatchPhase > 3
        ) {
          throw new Error("Factory Train P07 phase must be 0 through 3");
        }
        return Object.freeze({
          factoryId: entry.factoryId,
          ownerId: entry.ownerId,
          activePrimaryTrainId: entry.activePrimaryTrainId,
          turnaroundRemainingActiveTicks: entry.turnaroundRemainingActiveTicks,
          p07PrimaryDispatchPhase: entry.p07PrimaryDispatchPhase,
        });
      }),
  );
}

function freezeDispatchSnapshot(
  snapshot: TrainDispatchEconomicSnapshot,
  expectedFactoryId: string,
): TrainDispatchEconomicSnapshot {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Train dispatch economic snapshot must be an object");
  }
  if (snapshot.factoryId !== expectedFactoryId) {
    throw new Error("Train dispatch snapshot Factory does not match service Factory");
  }
  assertNonEmptyId(snapshot.factoryId, "Train dispatch Factory ID");
  assertNonEmptyId(snapshot.dispatchOwnerId, "Train dispatch owner ID");
  if (
    !Number.isSafeInteger(snapshot.factoryLevel) ||
    snapshot.factoryLevel < 1 ||
    snapshot.factoryLevel > 5
  ) {
    throw new Error("Train dispatch Factory level must be an integer from 1 through 5");
  }
  if (
    snapshot.baseCargoFfy === null ||
    typeof snapshot.baseCargoFfy !== "object" ||
    typeof snapshot.baseCargoFfy.numerator !== "bigint" ||
    typeof snapshot.baseCargoFfy.denominator !== "bigint" ||
    snapshot.baseCargoFfy.numerator < 0n ||
    snapshot.baseCargoFfy.denominator <= 0n
  ) {
    throw new Error("Train dispatch base cargo must be a non-negative exact rational");
  }
  return Object.freeze({
    factoryId: snapshot.factoryId,
    dispatchOwnerId: snapshot.dispatchOwnerId,
    factoryLevel: snapshot.factoryLevel,
    baseCargoFfy: Object.freeze(
      reducedRational(
        snapshot.baseCargoFfy.numerator,
        snapshot.baseCargoFfy.denominator,
      ),
    ),
  });
}

function freezeTrainServices(
  entries: readonly TrainServiceRuntimeState[],
  mobileUnits: readonly MobileUnitState[],
  factoryRailLoops: readonly FactoryRailLoopLifecycleState[],
): readonly TrainServiceRuntimeState[] {
  const seenTrains = new Set<string>();
  const unitsById = new Map(mobileUnits.map((unit) => [unit.id, unit]));
  const loopsByFactory = new Map(
    factoryRailLoops.map((loop) => [loop.factoryId, loop]),
  );
  return Object.freeze(
    [...entries]
      .sort((left, right) => compareIds(left.trainId, right.trainId))
      .map((entry) => {
        if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
          throw new Error("Train service runtime state must be an object");
        }
        assertNonEmptyId(entry.trainId, "Train service Train ID");
        assertNonEmptyId(entry.factoryId, "Train service Factory ID");
        assertNonEmptyId(entry.loopSnapshotId, "Train service loop snapshot ID");
        if (seenTrains.has(entry.trainId)) {
          throw new Error(`duplicate Train service state: ${entry.trainId}`);
        }
        seenTrains.add(entry.trainId);
        if (typeof entry.isPrimary !== "boolean") {
          throw new Error("Train service primary marker must be boolean");
        }
        if (entry.resumeAtTick !== null) {
          assertNonNegativeSafeInteger(entry.resumeAtTick, "Train resume tick");
        }
        const dispatchSnapshot = freezeDispatchSnapshot(
          entry.dispatchSnapshot,
          entry.factoryId,
        );
        const unit = unitsById.get(entry.trainId);
        if (unit === undefined || unit.type !== "TRAIN" || unit.movementClass !== "RAIL") {
          throw new Error(`Train service ${entry.trainId} requires a physical RAIL Train`);
        }
        if (unit.ownerId !== dispatchSnapshot.dispatchOwnerId) {
          throw new Error("Train physical owner must match dispatch owner snapshot");
        }
        const loop = loopsByFactory.get(entry.factoryId);
        if (
          loop === undefined ||
          !loop.retainedSnapshots.some(
            (snapshot) => snapshot.snapshotId === entry.loopSnapshotId,
          )
        ) {
          throw new Error("Train service requires its retained Factory loop snapshot");
        }
        return Object.freeze({
          trainId: entry.trainId,
          factoryId: entry.factoryId,
          loopSnapshotId: entry.loopSnapshotId,
          isPrimary: entry.isPrimary,
          dispatchSnapshot,
          resumeAtTick: entry.resumeAtTick,
        });
      }),
  );
}

function createState(
  previous: MatchState,
  tick: number,
  update: MatchStateUpdate,
): MatchState {
  const cellCount = previous.map.cellCount;
  const ownership = update.ownership ?? previous.ownership;
  const fallout = update.fallout ?? previous.fallout;
  if (ownership.length !== cellCount) {
    throw new Error("ownership length must equal width * height");
  }
  if (fallout.length !== cellCount) {
    throw new Error("fallout length must equal width * height");
  }
  const factions = freezeFactions(update.factions ?? previous.factions);
  const mobileUnits = materializeMobileUnitCollection(
    previous.map,
    factions.map((faction) => faction.id),
    {
      mobileUnits: update.mobileUnits ?? previous.mobileUnits,
      nextMobileUnitOrdinal:
        update.nextMobileUnitOrdinal ?? previous.nextMobileUnitOrdinal,
    },
  );
  const factoryRailLoops = freezeFactoryRailLoops(
    update.factoryRailLoops ?? previous.factoryRailLoops ?? [],
    previous.map,
  );
  const factoryTrainEpochs = freezeFactoryTrainEpochs(
    update.factoryTrainEpochs ?? previous.factoryTrainEpochs ?? [],
  );
  const trainServices = freezeTrainServices(
    update.trainServices ?? previous.trainServices ?? [],
    mobileUnits.mobileUnits,
    factoryRailLoops,
  );
  return Object.freeze({
    seed: previous.seed,
    tick,
    map: previous.map,
    ownership: freezeOwnership(ownership, previous.ownership),
    fallout: freezeFallout(fallout),
    factions,
    structures: materializePersistentStructures(
      update.structures ?? previous.structures,
    ),
    mobileUnits: mobileUnits.mobileUnits,
    nextMobileUnitOrdinal: mobileUnits.nextMobileUnitOrdinal,
    factoryRailLoops,
    factoryTrainEpochs,
    trainServices,
    operations: Object.freeze(
      (update.operations ?? previous.operations).map(materializeLandOperationState),
    ),
    defensePriorities: Object.freeze(
      (update.defensePriorities ?? previous.defensePriorities).map(
        materializeDefensePriorityState,
      ),
    ),
    captureProgress: freezeCaptureProgress(
      update.captureProgress ?? previous.captureProgress,
    ),
    counterResponseResiduals: freezeCounterResiduals(
      update.counterResponseResiduals ?? previous.counterResponseResiduals,
    ),
    hostilityGrace: freezeHostilityGrace(
      update.hostilityGrace ?? previous.hostilityGrace,
    ),
  });
}

type InitialMatchStateSpec = Readonly<Pick<MatchSpec, "seed" | "map" | "factions">>;

function assertResolvedArtifactMapMatches(
  spec: InitialMatchStateSpec,
  map: SimulationMap,
): void {
  if (!isArtifactMapSpec(spec.map)) {
    throw new Error("artifact map identity validation requires an artifact-backed binding");
  }
  if (
    map.source !== "ARTIFACT" ||
    map.mapId !== spec.map.mapId ||
    map.mapVersion !== spec.map.mapVersion ||
    map.mapHash !== spec.map.mapHash
  ) {
    throw new Error("resolved artifact map identity does not match MatchSpec binding");
  }
}

function createEmptyInitialMatchState(
  spec: Pick<MatchSpec, "seed" | "factions">,
  map: SimulationMap,
  initialOwners?: readonly (string | null)[],
  initialFallout?: readonly boolean[],
): MatchState {
  const cellCount = map.cellCount;
  return Object.freeze({
    seed: spec.seed,
    tick: 0,
    map,
    ownership: freezeOwnership(
      initialOwners ?? Array.from({ length: cellCount }, () => null),
    ),
    fallout: freezeFallout(
      initialFallout ?? Array.from({ length: cellCount }, () => false),
    ),
    factions: freezeFactions(
      spec.factions.map((faction) => ({
        id: faction.id,
        status: "ACTIVE",
        rules: faction.rules,
        population: createEmptyPopulationState(),
        ffy: STARTING_FFY,
        successfulStructurePurchaseTypes: Object.freeze([]),
        testMarker: 0,
        ...(faction.fixedTeamId === undefined
          ? {}
          : { fixedTeamId: faction.fixedTeamId }),
      })),
    ),
    structures: Object.freeze([]),
    mobileUnits: Object.freeze([]),
    nextMobileUnitOrdinal: 0,
    factoryRailLoops: Object.freeze([]),
    factoryTrainEpochs: Object.freeze([]),
    trainServices: Object.freeze([]),
    operations: Object.freeze([]),
    defensePriorities: Object.freeze([]),
    captureProgress: Object.freeze([]),
    counterResponseResiduals: Object.freeze([]),
    hostilityGrace: Object.freeze([]),
  });
}

/**
 * Creates the neutral authoritative state consumed by mode-specific Spawn
 * providers after artifact validation and before resolved exact origins exist.
 * It intentionally cannot accept synthetic ownership, legacy grants, or choose
 * a Spawn mode; those remain owned by their existing startup/provider layers.
 */
export function createPreSpawnMatchState(
  spec: InitialMatchStateSpec,
  resolvedArtifactMap: SimulationMap,
): MatchState {
  if (!isArtifactMapSpec(spec.map)) {
    throw new Error("pre-Spawn MatchState creation requires an artifact-backed map");
  }
  assertResolvedArtifactMapMatches(spec, resolvedArtifactMap);
  return createEmptyInitialMatchState(spec, resolvedArtifactMap);
}

export function createInitialMatchState(
  spec: MatchSpec,
  resolvedArtifactMap?: SimulationMap,
): MatchState {
  const artifact = isArtifactMapSpec(spec.map);
  if (artifact && resolvedArtifactMap === undefined) {
    throw new Error("artifact-backed MatchState creation requires a validated resolved map");
  }
  if (!artifact && resolvedArtifactMap !== undefined) {
    throw new Error("synthetic MatchState creation must not receive an artifact map override");
  }

  const map = artifact ? resolvedArtifactMap! : createSyntheticMap(spec.map);
  if (artifact) assertResolvedArtifactMapMatches(spec, map);
  const initialOwners = artifact ? undefined : spec.map.initialOwners;
  const initialFallout = artifact ? undefined : spec.map.initialFallout;

  let state = createEmptyInitialMatchState(
    spec,
    map,
    initialOwners,
    initialFallout,
  );

  for (const grant of spec.initialStructureGrants ?? []) {
    const result = tryMaterializeStructureGrant(state, grant);
    if (!result.ok) continue;
    state = createProspectiveMatchState(state, { structures: result.structures });
  }
  return state;
}

export function createProspectiveMatchState(
  previous: MatchState,
  update: MatchStateUpdate,
): MatchState {
  return createState(previous, previous.tick, update);
}

export function createAdvancedMatchState(
  previous: MatchState,
  update: MatchStateUpdate,
): MatchState {
  return createState(previous, previous.tick + 1, update);
}

function serializeFactoryLoopPlan(loop: FactoryRailLoopPlan | null): unknown {
  if (loop === null) return null;
  return {
    factoryId: loop.factoryId,
    targetStructureIds: [...loop.targetStructureIds],
    servicedStructureIds: [...loop.servicedStructureIds],
    cells: [...loop.cells],
    sharedExistingEdgeCount: loop.sharedExistingEdgeCount,
  };
}

export function canonicalMatchStateSerialization(state: MatchState): string {
  const factions = [...state.factions]
    .sort((left, right) => compareIds(left.id, right.id))
    .map((faction) => ({
      id: faction.id,
      status: faction.status,
      ...(faction.fixedTeamId === undefined
        ? {}
        : { fixedTeamId: faction.fixedTeamId }),
      population: {
        total: faction.population.total,
        available: faction.population.available,
        committedOffensive: faction.population.committedOffensive,
        committedCounterResponse: faction.population.committedCounterResponse,
        aboardTransports: faction.population.aboardTransports,
        peakTotal: faction.population.peakTotal,
        neutralSettlementHalfResidual:
          faction.population.neutralSettlementHalfResidual,
      },
      ffy: faction.ffy,
      successfulStructurePurchaseTypes: [
        ...(faction.successfulStructurePurchaseTypes ?? []),
      ],
      testMarker: faction.testMarker,
      rules: {
        version: faction.rules.version,
        canonicalSerialization: faction.rules.canonicalSerialization,
      },
    }));

  const structures = [...state.structures]
    .sort(
      (left, right) =>
        compareIds(left.id, right.id) ||
        left.cellId - right.cellId ||
        compareIds(left.ownerId, right.ownerId),
    )
    .map((structure) => ({
      id: structure.id,
      ownerId: structure.ownerId,
      type: structure.type,
      cellId: structure.cellId,
      ...(structure.completedLevel === undefined
        ? {}
        : { completedLevel: structure.completedLevel }),
      active: structure.active,
      ...(structure.construction === undefined
        ? {}
        : {
            construction: {
              targetLevel: structure.construction.targetLevel,
              remainingTicks: structure.construction.remainingTicks,
            },
          }),
      ...(structure.chargeSlots === undefined
        ? {}
        : {
            chargeSlots: structure.chargeSlots.map((slot) =>
              slot.state === "READY"
                ? { slotId: slot.slotId, state: slot.state }
                : {
                    slotId: slot.slotId,
                    state: slot.state,
                    readyAtTick: slot.readyAtTick,
                  },
            ),
          }),
      acquisitionPath: structure.acquisitionPath,
    }));

  const mobileUnits = [...state.mobileUnits]
    .sort((left, right) => compareIds(left.id, right.id))
    .map((unit) => ({
      id: unit.id,
      ownerId: unit.ownerId,
      type: unit.type,
      movementClass: unit.movementClass,
      cellId: unit.cellId,
      ...(unit.route === undefined
        ? {}
        : {
            route: {
              destinationCellId: unit.route.destinationCellId,
              cells: [...unit.route.cells],
              edgeWeights: [...unit.route.edgeWeights],
              nextCellIndex: unit.route.nextCellIndex,
              edgeProgress: unit.route.edgeProgress,
            },
          }),
    }));

  const factoryRailLoops = state.factoryRailLoops.map((entry) => ({
    factoryId: entry.factoryId,
    currentLoop: serializeFactoryLoopPlan(entry.currentLoop),
    pendingLoop: serializeFactoryLoopPlan(entry.pendingLoop),
    retainedSnapshots: entry.retainedSnapshots.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      cells: [...snapshot.cells],
    })),
  }));

  const factoryTrainEpochs = state.factoryTrainEpochs.map((entry) => ({
    factoryId: entry.factoryId,
    ownerId: entry.ownerId,
    activePrimaryTrainId: entry.activePrimaryTrainId,
    turnaroundRemainingActiveTicks: entry.turnaroundRemainingActiveTicks,
    p07PrimaryDispatchPhase: entry.p07PrimaryDispatchPhase,
  }));

  const trainServices = state.trainServices.map((entry) => ({
    trainId: entry.trainId,
    factoryId: entry.factoryId,
    loopSnapshotId: entry.loopSnapshotId,
    isPrimary: entry.isPrimary,
    dispatchSnapshot: {
      factoryId: entry.dispatchSnapshot.factoryId,
      dispatchOwnerId: entry.dispatchSnapshot.dispatchOwnerId,
      factoryLevel: entry.dispatchSnapshot.factoryLevel,
      baseCargoFfy: {
        numerator: entry.dispatchSnapshot.baseCargoFfy.numerator.toString(),
        denominator: entry.dispatchSnapshot.baseCargoFfy.denominator.toString(),
      },
    },
    resumeAtTick: entry.resumeAtTick,
  }));

  const operations = [...state.operations]
    .sort((left, right) =>
      compareIds(left.ownerId, right.ownerId) ||
      compareIds(left.kind, right.kind) ||
      compareIds(left.controllerKey, right.controllerKey),
    )
    .map((operation) =>
      operation.kind === "COUNTER_RESPONSE"
        ? {
            id: operation.id,
            controllerKey: operation.controllerKey,
            kind: operation.kind,
            ownerId: operation.ownerId,
            incomingOperationId: operation.incomingOperationId,
            committedPopulation: operation.committedPopulation,
          }
        : {
            id: operation.id,
            controllerKey: operation.controllerKey,
            kind: operation.kind,
            ownerId: operation.ownerId,
            ...(operation.kind === "ATTACK"
              ? { targetFactionId: operation.targetFactionId }
              : {}),
            committedPopulation: operation.committedPopulation,
            source: canonicalCellSelectorKey(operation.source),
            target: canonicalCellSelectorKey(operation.target),
            engagementPriority: canonicalSpatialPolicyKey(
              operation.engagementPriority,
            ),
            pressureWeight: canonicalSpatialPolicyKey(operation.pressureWeight),
          },
    );

  const serializedMap =
    state.map.source === "ARTIFACT"
      ? {
          source: "ARTIFACT",
          formatVersion: state.map.formatVersion,
          mapId: state.map.mapId,
          mapVersion: state.map.mapVersion,
          mapHash: state.map.mapHash,
          width: state.map.width,
          height: state.map.height,
        }
      : {
          width: state.map.width,
          height: state.map.height,
          terrain: [...state.map.terrain],
        };

  return JSON.stringify({
    seed: state.seed,
    tick: state.tick,
    map: serializedMap,
    ownership: [...state.ownership],
    fallout: [...state.fallout],
    factions,
    structures,
    mobileUnits,
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    factoryRailLoops,
    factoryTrainEpochs,
    trainServices,
    operations,
    defensePriorities: [...state.defensePriorities]
      .sort(
        (left, right) =>
          compareIds(left.ownerId, right.ownerId) ||
          compareIds(left.controllerKey, right.controllerKey),
      )
      .map((entry) => ({
        ownerId: entry.ownerId,
        controllerKey: entry.controllerKey,
        priority: canonicalSpatialPolicyKey(entry.priority),
      })),
    captureProgress: [...state.captureProgress],
    counterResponseResiduals: [...state.counterResponseResiduals],
    hostilityGrace: state.hostilityGrace.map((entry) => ({
      sideA: entry.sideA,
      sideB: entry.sideB,
      expiresAtTickExclusive: entry.expiresAtTickExclusive,
    })),
  });
}
