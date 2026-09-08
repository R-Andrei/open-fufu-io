import type { FactionStatus } from "../core/controller/ControllerApi";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
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
import type { MatchSpec, SyntheticMapSpec } from "./MatchSpec";
import {
  createEmptyPopulationState,
  createPopulationState,
  type PopulationState,
} from "./Population";
import {
  materializePersistentStructures,
  tryMaterializeStructureGrant,
  type PersistentStructureState,
} from "./Structures";

export interface MatchFactionState {
  readonly id: string;
  readonly status: FactionStatus;
  readonly rules: CompiledRuleProfile;
  readonly population: PopulationState;
  readonly testMarker: number;
  readonly fixedTeamId?: string;
}

export interface MatchState {
  readonly seed: string;
  readonly tick: number;
  readonly map: SyntheticMapSpec;
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
  readonly factions: readonly MatchFactionState[];
  readonly structures: readonly PersistentStructureState[];
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
  readonly operations?: readonly LandOperationState[];
  readonly defensePriorities?: readonly DefensePriorityState[];
  readonly captureProgress?: readonly CaptureProgressState[];
  readonly counterResponseResiduals?: readonly CounterResponseResidualState[];
  readonly hostilityGrace?: readonly HostilityGraceState[];
}

function freezeMap(map: SyntheticMapSpec): SyntheticMapSpec {
  return Object.freeze({
    width: map.width,
    height: map.height,
    terrain: Object.freeze([...map.terrain]),
    ...(map.initialOwners === undefined
      ? {}
      : { initialOwners: Object.freeze([...map.initialOwners]) }),
    ...(map.initialFallout === undefined
      ? {}
      : { initialFallout: Object.freeze([...map.initialFallout]) }),
  });
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
): readonly (string | null)[] {
  return Object.freeze([...ownership]);
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

function createState(
  previous: MatchState,
  tick: number,
  update: MatchStateUpdate,
): MatchState {
  const cellCount = previous.map.width * previous.map.height;
  const ownership = update.ownership ?? previous.ownership;
  const fallout = update.fallout ?? previous.fallout;
  if (ownership.length !== cellCount) {
    throw new Error("ownership length must equal width * height");
  }
  if (fallout.length !== cellCount) {
    throw new Error("fallout length must equal width * height");
  }
  return Object.freeze({
    seed: previous.seed,
    tick,
    map: previous.map,
    ownership: freezeOwnership(ownership),
    fallout: freezeFallout(fallout),
    factions: freezeFactions(update.factions ?? previous.factions),
    structures: materializePersistentStructures(
      update.structures ?? previous.structures,
    ),
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

export function createInitialMatchState(spec: MatchSpec): MatchState {
  const map = freezeMap(spec.map);
  const cellCount = spec.map.width * spec.map.height;
  let state: MatchState = Object.freeze({
    seed: spec.seed,
    tick: 0,
    map,
    ownership: freezeOwnership(
      spec.map.initialOwners ?? Array.from({ length: cellCount }, () => null),
    ),
    fallout: freezeFallout(
      spec.map.initialFallout ?? Array.from({ length: cellCount }, () => false),
    ),
    factions: freezeFactions(
      spec.factions.map((faction) => ({
        id: faction.id,
        status: "ACTIVE",
        rules: faction.rules,
        population: createEmptyPopulationState(),
        testMarker: 0,
        ...(faction.fixedTeamId === undefined
          ? {}
          : { fixedTeamId: faction.fixedTeamId }),
      })),
    ),
    structures: Object.freeze([]),
    operations: Object.freeze([]),
    defensePriorities: Object.freeze([]),
    captureProgress: Object.freeze([]),
    counterResponseResiduals: Object.freeze([]),
    hostilityGrace: Object.freeze([]),
  });

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
      acquisitionPath: structure.acquisitionPath,
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

  return JSON.stringify({
    seed: state.seed,
    tick: state.tick,
    map: {
      width: state.map.width,
      height: state.map.height,
      terrain: [...state.map.terrain],
    },
    ownership: [...state.ownership],
    fallout: [...state.fallout],
    factions,
    structures,
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
