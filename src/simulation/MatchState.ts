import type {
  FactionStatus,
  StructureType,
} from "../core/controller/ControllerApi";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import { materializeFfyBalance, STARTING_FFY } from "./Economy";
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
  TankOperationalState,
  TankProductionJobState,
} from "./Tanks";

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
  readonly tankProductionJobs: readonly TankProductionJobState[];
  readonly tankOperationalStates: readonly TankOperationalState[];
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
  readonly tankProductionJobs?: readonly TankProductionJobState[];
  readonly tankOperationalStates?: readonly TankOperationalState[];
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

function freezeTankProductionJobs(
  entries: readonly TankProductionJobState[],
): readonly TankProductionJobState[] {
  const seenFactories = new Set<string>();
  const jobs = entries.map((job) => {
    if (job === null || typeof job !== "object" || Array.isArray(job)) {
      throw new Error("Tank production job must be an object");
    }
    if (typeof job.factoryId !== "string" || job.factoryId.length === 0) {
      throw new Error("Tank production factoryId must be a non-empty string");
    }
    if (seenFactories.has(job.factoryId)) {
      throw new Error(`duplicate Tank production Factory: ${job.factoryId}`);
    }
    seenFactories.add(job.factoryId);
    if (typeof job.ownerId !== "string" || job.ownerId.length === 0) {
      throw new Error("Tank production ownerId must be a non-empty string");
    }
    if (job.chassisType !== "TANK" && job.chassisType !== "HEAVY_ARTILLERY") {
      throw new Error("Tank production chassis type is invalid");
    }
    if (job.state === "BUILDING") {
      if (
        !Number.isSafeInteger(job.remainingTicks) ||
        job.remainingTicks <= 0 ||
        Object.is(job.remainingTicks, -0)
      ) {
        throw new Error(
          "Tank production remainingTicks must be a positive safe integer",
        );
      }
      return Object.freeze({
        factoryId: job.factoryId,
        ownerId: job.ownerId,
        chassisType: job.chassisType,
        state: "BUILDING" as const,
        remainingTicks: job.remainingTicks,
      });
    }
    if (job.state !== "WAITING_DEPLOYMENT") {
      throw new Error("Tank production job state is invalid");
    }
    return Object.freeze({
      factoryId: job.factoryId,
      ownerId: job.ownerId,
      chassisType: job.chassisType,
      state: "WAITING_DEPLOYMENT" as const,
    });
  });
  jobs.sort(
    (left, right) =>
      compareIds(left.factoryId, right.factoryId) ||
      compareIds(left.ownerId, right.ownerId),
  );
  return Object.freeze(jobs);
}

function freezeTankHealth(
  health: TankOperationalState["health"],
): TankOperationalState["health"] {
  if (
    health === null ||
    typeof health !== "object" ||
    Array.isArray(health) ||
    typeof health.numerator !== "bigint" ||
    typeof health.denominator !== "bigint" ||
    health.numerator < 0n ||
    health.denominator <= 0n
  ) {
    throw new Error("Tank health must be a non-negative exact ratio");
  }
  if (health.numerator === 0n) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }
  let left = health.numerator;
  let right = health.denominator;
  while (right !== 0n) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return Object.freeze({
    numerator: health.numerator / left,
    denominator: health.denominator / left,
  });
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function freezeTankOperationalStates(
  entries: readonly TankOperationalState[],
  mobileUnits: readonly MobileUnitState[],
  map: SimulationMap,
): readonly TankOperationalState[] {
  if (!Array.isArray(entries)) {
    throw new Error("tankOperationalStates must be an array");
  }
  const unitsById = new Map(mobileUnits.map((unit) => [unit.id, unit]));
  const seenUnitIds = new Set<string>();
  const states = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Tank operational state must be an object");
    }
    if (typeof entry.unitId !== "string" || entry.unitId.length === 0) {
      throw new Error("Tank operational unitId must be a non-empty string");
    }
    if (seenUnitIds.has(entry.unitId)) {
      throw new Error(`duplicate Tank operational state: ${entry.unitId}`);
    }
    seenUnitIds.add(entry.unitId);
    const unit = unitsById.get(entry.unitId);
    if (
      unit === undefined ||
      (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
    ) {
      throw new Error(
        `Tank operational state must reference a deployed Tank-derived unit: ${entry.unitId}`,
      );
    }
    if (!map.isValidCellId(entry.operatingAnchorCellId)) {
      throw new Error("Tank operating anchor must be a valid map cell");
    }
    assertNonNegativeSafeInteger(entry.eligibleFromTick, "Tank eligibleFromTick");
    assertNonNegativeSafeInteger(entry.attackReadyAtTick, "Tank attackReadyAtTick");
    return Object.freeze({
      unitId: entry.unitId,
      health: freezeTankHealth(entry.health),
      operatingAnchorCellId: entry.operatingAnchorCellId,
      eligibleFromTick: entry.eligibleFromTick,
      attackReadyAtTick: entry.attackReadyAtTick,
    });
  });
  states.sort((left, right) => compareIds(left.unitId, right.unitId));
  return Object.freeze(states);
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
  const tankOperationalStates = freezeTankOperationalStates(
    update.tankOperationalStates ?? previous.tankOperationalStates ?? [],
    mobileUnits.mobileUnits,
    previous.map,
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
    tankProductionJobs: freezeTankProductionJobs(
      update.tankProductionJobs ?? previous.tankProductionJobs ?? [],
    ),
    tankOperationalStates,
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

type InitialMatchStateSpec = Readonly<Pick<MatchSpec, "seed" | "factions">>;

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
    tankProductionJobs: Object.freeze([]),
    tankOperationalStates: Object.freeze([]),
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

  const tankProductionJobs = [...state.tankProductionJobs]
    .sort(
      (left, right) =>
        compareIds(left.factoryId, right.factoryId) ||
        compareIds(left.ownerId, right.ownerId),
    )
    .map((job) =>
      job.state === "BUILDING"
        ? {
            factoryId: job.factoryId,
            ownerId: job.ownerId,
            chassisType: job.chassisType,
            state: job.state,
            remainingTicks: job.remainingTicks,
          }
        : {
            factoryId: job.factoryId,
            ownerId: job.ownerId,
            chassisType: job.chassisType,
            state: job.state,
          },
    );

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
    tankProductionJobs,
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
