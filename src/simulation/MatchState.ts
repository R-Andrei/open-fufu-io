import type {
  FactionStatus,
  OriginView,
  StructureType,
} from "../core/controller/ControllerApi";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import type { DirectRevealRecord } from "../core/visibility/TacticalVisibility";
import { materializeFfyBalance, STARTING_FFY } from "./Economy";
import {
  materializeHomingCombatProjectiles,
  type HomingCombatProjectileState,
} from "./CombatProjectiles";
import {
  materializeFactoryTrainState,
  serializeFactoryTrainState,
  type FactoryTrainState,
  type FactoryTrainStateUpdate,
} from "./FactoryTrainState";
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
import type { TankOperationalState, TankProductionJobState } from "./Tanks";
import type {
  WarshipOperationalState,
  WarshipProductionJobState,
} from "./Warships";
export type { TrainServiceRuntimeState } from "./FactoryTrainState";

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

type MatchTankOperationalState = TankOperationalState &
  Readonly<{ roamingOrdinal?: number }>;

export interface MatchFactionState {
  readonly id: string;
  readonly displayName: string;
  readonly isMinorFaction: boolean;
  readonly origin?: OriginView;
  readonly status: FactionStatus;
  readonly rules: CompiledRuleProfile;
  readonly population: PopulationState;
  readonly ffy: number;
  readonly lifetimeGrossPositiveFfyEarned: number;
  readonly successfulStructurePurchaseTypes: readonly StructureType[];
  readonly testMarker: number;
  readonly fixedTeamId?: string;
}

export interface TradeVoyageEconomicSnapshotV1 {
  readonly originalOwnerId: string;
  readonly sourcePortId: string;
  readonly launchDestinationPortId: string;
  readonly valuationCellId: number;
  readonly plannedRouteLengthCells: number;
  readonly rawCargoFfy: number;
  readonly ownerSuccessValueFfy: number;
}

export type TradeVoyageRoutingMode =
  | "ORDINARY"
  | "OWNED_RETURN"
  | "CAPTURED";

export interface TradeVoyageState {
  readonly unitId: string;
  readonly economicSnapshot: TradeVoyageEconomicSnapshotV1;
  readonly sourcePortOwnershipEpochOrdinal: number;
  readonly routingMode: TradeVoyageRoutingMode;
  readonly destinationPortId: string | null;
  readonly firstHostileCaptureResolved: boolean;
}

export interface TradeDestinationHistoryState {
  readonly destinationPortId: string;
  readonly lastSelectedOrdinal: number;
}

export interface TradePortSchedulerState {
  readonly portId: string;
  readonly ownerId: string;
  readonly ownershipEpochOrdinal: number;
  readonly nextAttemptOrdinal: number;
  readonly nextAttemptTick: number | null;
  readonly nextDestinationSelectionOrdinal: number;
  readonly destinationHistory: readonly TradeDestinationHistoryState[];
}

export interface TradeRetiredPortEpochState {
  readonly portId: string;
  readonly ownerId: string;
  readonly ownershipEpochOrdinal: number;
  readonly nextDestinationSelectionOrdinal: number;
  readonly destinationHistory: readonly TradeDestinationHistoryState[];
}

export interface TradePendingSignedFactState {
  readonly id: string;
  readonly ownerId: string;
  readonly componentsFfy: readonly number[];
}

export interface TransportExactHealth {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface TransportOperationalState {
  readonly unitId: string;
  readonly carriedPopulation: number;
  readonly health?: TransportExactHealth;
}

export type TransportDestructionCauseClass =
  | "NAVAL_GUNFIRE"
  | "SAM_ANTI_SHIP"
  | "STRATEGIC_BLAST"
  | "OTHER_HOSTILE_EFFECT"
  | "UNATTRIBUTED";

export interface TransportDestructionResult {
  readonly transportId: string;
  readonly previousOwnerFactionId: string;
  readonly destructionTick: number;
  readonly carriedPopulationAtDestruction: number;
  readonly creditedDestroyerFactionId?: string;
  readonly causeClass: TransportDestructionCauseClass;
}

export interface MatchState extends FactoryTrainState {
  readonly seed: string;
  readonly tick: number;
  readonly map: SimulationMap;
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
  readonly factions: readonly MatchFactionState[];
  readonly structures: readonly PersistentStructureState[];
  readonly mobileUnits: readonly MobileUnitState[];
  readonly nextMobileUnitOrdinal: number;
  readonly combatProjectiles: readonly HomingCombatProjectileState[];
  readonly transportOperationalStates: readonly TransportOperationalState[];
  readonly transportDestructionResults: readonly TransportDestructionResult[];
  readonly tradeVoyages: readonly TradeVoyageState[];
  readonly tradePortSchedulers: readonly TradePortSchedulerState[];
  readonly tradeRetiredPortEpochs: readonly TradeRetiredPortEpochState[];
  readonly tradePendingSignedFacts: readonly TradePendingSignedFactState[];
  readonly tankProductionJobs: readonly TankProductionJobState[];
  readonly warshipProductionJobs: readonly WarshipProductionJobState[];
  readonly tankOperationalStates: readonly MatchTankOperationalState[];
  readonly warshipOperationalStates: readonly WarshipOperationalState[];
  readonly directReveals: readonly DirectRevealRecord[];
  readonly operations: readonly LandOperationState[];
  readonly defensePriorities: readonly DefensePriorityState[];
  readonly captureProgress: readonly CaptureProgressState[];
  readonly counterResponseResiduals: readonly CounterResponseResidualState[];
  readonly hostilityGrace: readonly HostilityGraceState[];
}

export interface MatchStateUpdate extends FactoryTrainStateUpdate {
  readonly factions?: readonly MatchFactionState[];
  readonly ownership?: readonly (string | null)[];
  readonly fallout?: readonly boolean[];
  readonly structures?: readonly PersistentStructureState[];
  readonly mobileUnits?: readonly MobileUnitState[];
  readonly nextMobileUnitOrdinal?: number;
  readonly combatProjectiles?: readonly HomingCombatProjectileState[];
  readonly transportOperationalStates?: readonly TransportOperationalState[];
  readonly transportDestructionResults?: readonly TransportDestructionResult[];
  readonly tradeVoyages?: readonly TradeVoyageState[];
  readonly tradePortSchedulers?: readonly TradePortSchedulerState[];
  readonly tradeRetiredPortEpochs?: readonly TradeRetiredPortEpochState[];
  readonly tradePendingSignedFacts?: readonly TradePendingSignedFactState[];
  readonly tankProductionJobs?: readonly TankProductionJobState[];
  readonly warshipProductionJobs?: readonly WarshipProductionJobState[];
  readonly tankOperationalStates?: readonly MatchTankOperationalState[];
  readonly warshipOperationalStates?: readonly WarshipOperationalState[];
  readonly directReveals?: readonly DirectRevealRecord[];
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
    ...(map.initialOwners === undefined
      ? {}
      : { initialOwners: map.initialOwners }),
    ...(map.initialFallout === undefined
      ? {}
      : { initialFallout: map.initialFallout }),
  });
}

function freezeSuccessfulStructurePurchaseTypes(
  types: readonly StructureType[],
): readonly StructureType[] {
  const seen = new Set<StructureType>();
  for (const type of types) {
    if (!STRUCTURE_TYPES.has(type)) {
      throw new Error(
        `unknown successful structure purchase type: ${String(type)}`,
      );
    }
    if (seen.has(type)) {
      throw new Error(`duplicate successful structure purchase type: ${type}`);
    }
    seen.add(type);
  }
  return Object.freeze([...seen].sort());
}

function freezeOrigin(origin: OriginView | undefined): OriginView | undefined {
  if (origin === undefined) return undefined;
  if (
    typeof origin.id !== "string" ||
    origin.id.length === 0 ||
    typeof origin.displayName !== "string" ||
    origin.displayName.length === 0 ||
    typeof origin.version !== "string" ||
    origin.version.length === 0 ||
    !Array.isArray(origin.positiveTraitIds) ||
    origin.positiveTraitIds.some((traitId) => typeof traitId !== "string") ||
    !Array.isArray(origin.negativeTraitIds) ||
    origin.negativeTraitIds.some((traitId) => typeof traitId !== "string")
  ) {
    throw new Error("faction Origin metadata is invalid");
  }
  return Object.freeze({
    id: origin.id,
    displayName: origin.displayName,
    version: origin.version,
    positiveTraitIds: Object.freeze([...origin.positiveTraitIds]),
    negativeTraitIds: Object.freeze([...origin.negativeTraitIds]),
  });
}

function freezeFactions(
  factions: readonly MatchFactionState[],
): readonly MatchFactionState[] {
  return Object.freeze(
    factions.map((faction) => {
      if (typeof faction.displayName !== "string" || faction.displayName.length === 0) {
        throw new Error("faction displayName must be a non-empty string");
      }
      if (typeof faction.isMinorFaction !== "boolean") {
        throw new Error("faction isMinorFaction must be boolean");
      }
      assertNonNegativeSafeInteger(
        faction.lifetimeGrossPositiveFfyEarned,
        "lifetimeGrossPositiveFfyEarned",
      );
      const origin = freezeOrigin(faction.origin);
      return Object.freeze({
        id: faction.id,
        displayName: faction.displayName,
        isMinorFaction: faction.isMinorFaction,
        ...(origin === undefined ? {} : { origin }),
        status: faction.status,
        rules: faction.rules,
        population: createPopulationState(faction.population),
        ffy: materializeFfyBalance(faction.ffy),
        lifetimeGrossPositiveFfyEarned: faction.lifetimeGrossPositiveFfyEarned,
        successfulStructurePurchaseTypes:
          freezeSuccessfulStructurePurchaseTypes(
            faction.successfulStructurePurchaseTypes ?? [],
          ),
        testMarker: faction.testMarker,
        ...(faction.fixedTeamId === undefined
          ? {}
          : { fixedTeamId: faction.fixedTeamId }),
      });
    }),
  );
}

function freezeTradeVoyages(
  entries: readonly TradeVoyageState[],
  mobileUnits: readonly MobileUnitState[],
  map: SimulationMap,
  factions: readonly MatchFactionState[],
): readonly TradeVoyageState[] {
  if (!Array.isArray(entries)) {
    throw new Error("tradeVoyages must be an array");
  }
  const unitsById = new Map(mobileUnits.map((unit) => [unit.id, unit]));
  const factionIds = new Set(factions.map((faction) => faction.id));
  const seen = new Set<string>();
  const voyages = [...entries]
    .sort((left, right) => compareIds(left.unitId, right.unitId))
    .map((entry) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error("Trade voyage state must be an object");
      }
      if (typeof entry.unitId !== "string" || entry.unitId.length === 0) {
        throw new Error("Trade voyage unitId must be a non-empty string");
      }
      if (seen.has(entry.unitId)) {
        throw new Error(`duplicate Trade voyage: ${entry.unitId}`);
      }
      seen.add(entry.unitId);
      const unit = unitsById.get(entry.unitId);
      if (
        unit === undefined ||
        unit.type !== "TRADE_SHIP" ||
        unit.movementClass !== "NAVAL"
      ) {
        throw new Error(
          `Trade voyage ${entry.unitId} requires a physical NAVAL Trade Ship`,
        );
      }
      const snapshot = entry.economicSnapshot;
      if (
        snapshot === null ||
        typeof snapshot !== "object" ||
        Array.isArray(snapshot)
      ) {
        throw new Error("Trade voyage economic snapshot must be an object");
      }
      for (const [label, value] of [
        ["originalOwnerId", snapshot.originalOwnerId],
        ["sourcePortId", snapshot.sourcePortId],
        ["launchDestinationPortId", snapshot.launchDestinationPortId],
      ] as const) {
        if (typeof value !== "string" || value.length === 0) {
          throw new Error(`Trade voyage ${label} must be a non-empty string`);
        }
      }
      if (!factionIds.has(snapshot.originalOwnerId)) {
        throw new Error("Trade voyage original owner must be a known faction");
      }
      if (!map.isValidCellId(snapshot.valuationCellId)) {
        throw new Error("Trade voyage valuation cell must be a valid map cell");
      }
      assertNonNegativeSafeInteger(
        snapshot.plannedRouteLengthCells,
        "Trade voyage plannedRouteLengthCells",
      );
      assertNonNegativeSafeInteger(snapshot.rawCargoFfy, "Trade voyage rawCargoFfy");
      assertNonNegativeSafeInteger(
        snapshot.ownerSuccessValueFfy,
        "Trade voyage ownerSuccessValueFfy",
      );
      if (
        snapshot.plannedRouteLengthCells >
          Math.floor(Number.MAX_SAFE_INTEGER / 150) ||
        snapshot.rawCargoFfy !== snapshot.plannedRouteLengthCells * 150
      ) {
        throw new Error("Trade voyage raw cargo must equal 150 FFY per planned route edge");
      }
      assertNonNegativeSafeInteger(
        entry.sourcePortOwnershipEpochOrdinal,
        "Trade voyage sourcePortOwnershipEpochOrdinal",
      );
      if (
        entry.routingMode !== "ORDINARY" &&
        entry.routingMode !== "OWNED_RETURN" &&
        entry.routingMode !== "CAPTURED"
      ) {
        throw new Error("Trade voyage routingMode is invalid");
      }
      if (
        entry.destinationPortId !== null &&
        (typeof entry.destinationPortId !== "string" ||
          entry.destinationPortId.length === 0)
      ) {
        throw new Error("Trade voyage destinationPortId must be null or non-empty");
      }
      if (typeof entry.firstHostileCaptureResolved !== "boolean") {
        throw new Error("Trade voyage first-hostile-capture state must be boolean");
      }
      if (
        entry.firstHostileCaptureResolved !== (entry.routingMode === "CAPTURED")
      ) {
        throw new Error(
          "Trade voyage capture flag must agree with CAPTURED routing mode",
        );
      }
      if (
        !entry.firstHostileCaptureResolved &&
        unit.ownerId !== snapshot.originalOwnerId
      ) {
        throw new Error(
          "uncaptured Trade voyage physical owner must match original owner",
        );
      }
      return Object.freeze({
        unitId: entry.unitId,
        economicSnapshot: Object.freeze({
          originalOwnerId: snapshot.originalOwnerId,
          sourcePortId: snapshot.sourcePortId,
          launchDestinationPortId: snapshot.launchDestinationPortId,
          valuationCellId: snapshot.valuationCellId,
          plannedRouteLengthCells: snapshot.plannedRouteLengthCells,
          rawCargoFfy: snapshot.rawCargoFfy,
          ownerSuccessValueFfy: snapshot.ownerSuccessValueFfy,
        }),
        sourcePortOwnershipEpochOrdinal: entry.sourcePortOwnershipEpochOrdinal,
        routingMode: entry.routingMode,
        destinationPortId: entry.destinationPortId,
        firstHostileCaptureResolved: entry.firstHostileCaptureResolved,
      });
    });
  return Object.freeze(voyages);
}

function freezeTradePortSchedulers(
  entries: readonly TradePortSchedulerState[],
  factions: readonly MatchFactionState[],
): readonly TradePortSchedulerState[] {
  if (!Array.isArray(entries)) {
    throw new Error("tradePortSchedulers must be an array");
  }
  const factionIds = new Set(factions.map((faction) => faction.id));
  const seenPorts = new Set<string>();
  const schedulers = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Trade Port scheduler state must be an object");
    }
    if (typeof entry.portId !== "string" || entry.portId.length === 0) {
      throw new Error("Trade Port scheduler portId must be a non-empty string");
    }
    if (seenPorts.has(entry.portId)) {
      throw new Error(`duplicate Trade Port scheduler: ${entry.portId}`);
    }
    seenPorts.add(entry.portId);
    if (typeof entry.ownerId !== "string" || !factionIds.has(entry.ownerId)) {
      throw new Error("Trade Port scheduler owner must be a known faction");
    }
    assertNonNegativeSafeInteger(
      entry.ownershipEpochOrdinal,
      "Trade Port ownershipEpochOrdinal",
    );
    assertNonNegativeSafeInteger(
      entry.nextAttemptOrdinal,
      "Trade Port nextAttemptOrdinal",
    );
    if (entry.nextAttemptTick !== null) {
      assertNonNegativeSafeInteger(
        entry.nextAttemptTick,
        "Trade Port nextAttemptTick",
      );
    }
    assertNonNegativeSafeInteger(
      entry.nextDestinationSelectionOrdinal,
      "Trade Port nextDestinationSelectionOrdinal",
    );
    if (!Array.isArray(entry.destinationHistory)) {
      throw new Error("Trade Port destination history must be an array");
    }
    const seenDestinations = new Set<string>();
    const destinationHistory: TradeDestinationHistoryState[] =
      entry.destinationHistory.map((history: TradeDestinationHistoryState) => {
      if (
        history === null ||
        typeof history !== "object" ||
        Array.isArray(history) ||
        typeof history.destinationPortId !== "string" ||
        history.destinationPortId.length === 0
      ) {
        throw new Error("Trade destination history entry is invalid");
      }
      if (seenDestinations.has(history.destinationPortId)) {
        throw new Error(
          `duplicate Trade destination history: ${history.destinationPortId}`,
        );
      }
      seenDestinations.add(history.destinationPortId);
      assertNonNegativeSafeInteger(
        history.lastSelectedOrdinal,
        "Trade destination lastSelectedOrdinal",
      );
      if (
        history.lastSelectedOrdinal >= entry.nextDestinationSelectionOrdinal
      ) {
        throw new Error(
          "Trade destination history ordinal must precede the next selection ordinal",
        );
      }
      return Object.freeze({
        destinationPortId: history.destinationPortId,
        lastSelectedOrdinal: history.lastSelectedOrdinal,
      });
    });
    destinationHistory.sort(
      (
        left: TradeDestinationHistoryState,
        right: TradeDestinationHistoryState,
      ) => compareIds(left.destinationPortId, right.destinationPortId),
    );
    return Object.freeze({
      portId: entry.portId,
      ownerId: entry.ownerId,
      ownershipEpochOrdinal: entry.ownershipEpochOrdinal,
      nextAttemptOrdinal: entry.nextAttemptOrdinal,
      nextAttemptTick: entry.nextAttemptTick,
      nextDestinationSelectionOrdinal: entry.nextDestinationSelectionOrdinal,
      destinationHistory: Object.freeze(destinationHistory),
    });
  });
  schedulers.sort((left, right) => compareIds(left.portId, right.portId));
  return Object.freeze(schedulers);
}

function freezeTradeRetiredPortEpochs(
  entries: readonly TradeRetiredPortEpochState[],
  factions: readonly MatchFactionState[],
): readonly TradeRetiredPortEpochState[] {
  if (!Array.isArray(entries)) {
    throw new Error("tradeRetiredPortEpochs must be an array");
  }
  const factionIds = new Set(factions.map((faction) => faction.id));
  const seen = new Set<string>();
  const materialized = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Trade retired Port epoch must be an object");
    }
    if (typeof entry.portId !== "string" || entry.portId.length === 0) {
      throw new Error("Trade retired Port epoch portId must be non-empty");
    }
    if (typeof entry.ownerId !== "string" || !factionIds.has(entry.ownerId)) {
      throw new Error("Trade retired Port epoch owner must be a known faction");
    }
    assertNonNegativeSafeInteger(
      entry.ownershipEpochOrdinal,
      "Trade retired Port ownershipEpochOrdinal",
    );
    assertNonNegativeSafeInteger(
      entry.nextDestinationSelectionOrdinal,
      "Trade retired Port nextDestinationSelectionOrdinal",
    );
    const key = JSON.stringify([
      entry.portId,
      entry.ownerId,
      entry.ownershipEpochOrdinal,
    ]);
    if (seen.has(key)) throw new Error(`duplicate Trade retired Port epoch: ${key}`);
    seen.add(key);
    if (!Array.isArray(entry.destinationHistory)) {
      throw new Error("Trade retired Port destination history must be an array");
    }
    const seenDestinations = new Set<string>();
    const destinationHistory: TradeDestinationHistoryState[] =
      entry.destinationHistory.map((history: TradeDestinationHistoryState) => {
      if (
        history === null ||
        typeof history !== "object" ||
        Array.isArray(history) ||
        typeof history.destinationPortId !== "string" ||
        history.destinationPortId.length === 0
      ) {
        throw new Error("Trade retired destination history entry is invalid");
      }
      if (seenDestinations.has(history.destinationPortId)) {
        throw new Error(
          `duplicate Trade retired destination history: ${history.destinationPortId}`,
        );
      }
      seenDestinations.add(history.destinationPortId);
      assertNonNegativeSafeInteger(
        history.lastSelectedOrdinal,
        "Trade retired destination lastSelectedOrdinal",
      );
      if (history.lastSelectedOrdinal >= entry.nextDestinationSelectionOrdinal) {
        throw new Error(
          "Trade retired destination history ordinal must precede next selection ordinal",
        );
      }
      return Object.freeze({
        destinationPortId: history.destinationPortId,
        lastSelectedOrdinal: history.lastSelectedOrdinal,
      });
    });
    destinationHistory.sort(
      (
        left: TradeDestinationHistoryState,
        right: TradeDestinationHistoryState,
      ) => compareIds(left.destinationPortId, right.destinationPortId),
    );
    return Object.freeze({
      portId: entry.portId,
      ownerId: entry.ownerId,
      ownershipEpochOrdinal: entry.ownershipEpochOrdinal,
      nextDestinationSelectionOrdinal: entry.nextDestinationSelectionOrdinal,
      destinationHistory: Object.freeze(destinationHistory),
    });
  });
  materialized.sort(
    (left, right) =>
      compareIds(left.portId, right.portId) ||
      left.ownershipEpochOrdinal - right.ownershipEpochOrdinal ||
      compareIds(left.ownerId, right.ownerId),
  );
  return Object.freeze(materialized);
}

function freezeTradePendingSignedFacts(
  entries: readonly TradePendingSignedFactState[],
  factions: readonly MatchFactionState[],
): readonly TradePendingSignedFactState[] {
  if (!Array.isArray(entries)) {
    throw new Error("tradePendingSignedFacts must be an array");
  }
  const factionIds = new Set(factions.map((faction) => faction.id));
  const seen = new Set<string>();
  const materialized = entries.map((entry) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      typeof entry.id !== "string" ||
      entry.id.length === 0
    ) {
      throw new Error("Trade pending signed fact is invalid");
    }
    if (seen.has(entry.id)) {
      throw new Error(`duplicate Trade pending signed fact: ${entry.id}`);
    }
    seen.add(entry.id);
    if (typeof entry.ownerId !== "string" || !factionIds.has(entry.ownerId)) {
      throw new Error("Trade pending signed fact owner must be a known faction");
    }
    if (
      !Array.isArray(entry.componentsFfy) ||
      entry.componentsFfy.length === 0 ||
      entry.componentsFfy.some(
        (component: number) =>
          !Number.isSafeInteger(component) || Object.is(component, -0),
      )
    ) {
      throw new Error(
        "Trade pending signed fact components must be non-empty safe integers",
      );
    }
    return Object.freeze({
      id: entry.id,
      ownerId: entry.ownerId,
      componentsFfy: Object.freeze([...entry.componentsFfy]),
    });
  });
  materialized.sort(
    (left, right) =>
      compareIds(left.ownerId, right.ownerId) || compareIds(left.id, right.id),
  );
  return Object.freeze(materialized);
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

function freezeDirectReveals(
  entries: readonly DirectRevealRecord[],
): readonly DirectRevealRecord[] {
  if (!Array.isArray(entries)) {
    throw new Error("directReveals must be an array");
  }
  const seen = new Set<string>();
  const materialized = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("direct reveal record must be an object");
    }
    if (
      typeof entry.viewerFactionId !== "string" ||
      entry.viewerFactionId.length === 0
    ) {
      throw new Error(
        "direct reveal viewerFactionId must be a non-empty string",
      );
    }
    if (
      entry.sourceKind !== "UNIT" &&
      entry.sourceKind !== "STRUCTURE" &&
      entry.sourceKind !== "OPERATION"
    ) {
      throw new Error("direct reveal sourceKind is invalid");
    }
    if (typeof entry.sourceId !== "string" || entry.sourceId.length === 0) {
      throw new Error("direct reveal sourceId must be a non-empty string");
    }
    if (
      !Number.isSafeInteger(entry.expiryExclusiveTick) ||
      entry.expiryExclusiveTick < 0 ||
      Object.is(entry.expiryExclusiveTick, -0)
    ) {
      throw new Error(
        "direct reveal expiryExclusiveTick must be a non-negative safe integer",
      );
    }
    const key = `${JSON.stringify(entry.viewerFactionId)}\u0000${entry.sourceKind}\u0000${JSON.stringify(entry.sourceId)}`;
    if (seen.has(key)) {
      throw new Error("duplicate direct reveal viewer/source record");
    }
    seen.add(key);
    return Object.freeze({
      viewerFactionId: entry.viewerFactionId,
      sourceKind: entry.sourceKind,
      sourceId: entry.sourceId,
      expiryExclusiveTick: entry.expiryExclusiveTick,
    });
  });
  materialized.sort(
    (left, right) =>
      compareIds(left.viewerFactionId, right.viewerFactionId) ||
      compareIds(left.sourceKind, right.sourceKind) ||
      compareIds(left.sourceId, right.sourceId),
  );
  return Object.freeze(materialized);
}

function freezeTankProductionJobs(
  entries: readonly TankProductionJobState[],
  map: SimulationMap,
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
    if (!map.isValidCellId(job.strategicDestinationCellId)) {
      throw new Error(
        "Tank production strategic destination must be a valid map cell",
      );
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
        strategicDestinationCellId: job.strategicDestinationCellId,
        state: "BUILDING" as const,
        remainingTicks: job.remainingTicks,
      });
    }
    if (job.state !== "READY_TO_DEPLOY") {
      throw new Error("Tank production job state is invalid");
    }
    return Object.freeze({
      factoryId: job.factoryId,
      ownerId: job.ownerId,
      chassisType: job.chassisType,
      strategicDestinationCellId: job.strategicDestinationCellId,
      state: "READY_TO_DEPLOY" as const,
    });
  });
  jobs.sort(
    (left, right) =>
      compareIds(left.factoryId, right.factoryId) ||
      compareIds(left.ownerId, right.ownerId),
  );
  return Object.freeze(jobs);
}

function freezeWarshipProductionJobs(
  entries: readonly WarshipProductionJobState[],
  map: SimulationMap,
): readonly WarshipProductionJobState[] {
  const seenPorts = new Set<string>();
  const jobs = entries.map((job) => {
    if (job === null || typeof job !== "object" || Array.isArray(job)) {
      throw new Error("Warship production job must be an object");
    }
    if (typeof job.portId !== "string" || job.portId.length === 0) {
      throw new Error("Warship production portId must be a non-empty string");
    }
    if (seenPorts.has(job.portId)) {
      throw new Error(`duplicate Warship production Port: ${job.portId}`);
    }
    seenPorts.add(job.portId);
    if (typeof job.ownerId !== "string" || job.ownerId.length === 0) {
      throw new Error("Warship production ownerId must be a non-empty string");
    }
    if (!map.isValidCellId(job.strategicDestinationCellId)) {
      throw new Error(
        "Warship production strategic destination must be a valid map cell",
      );
    }
    if (map.terrainAt(job.strategicDestinationCellId) !== "DEEP_WATER") {
      throw new Error(
        "Warship production strategic destination must be a Deep-Water map cell",
      );
    }
    if (job.state === "BUILDING") {
      if (
        !Number.isSafeInteger(job.remainingTicks) ||
        job.remainingTicks <= 0 ||
        Object.is(job.remainingTicks, -0)
      ) {
        throw new Error(
          "Warship production remainingTicks must be a positive safe integer",
        );
      }
      return Object.freeze({
        portId: job.portId,
        ownerId: job.ownerId,
        strategicDestinationCellId: job.strategicDestinationCellId,
        state: "BUILDING" as const,
        remainingTicks: job.remainingTicks,
      });
    }
    if (job.state !== "READY_TO_DEPLOY") {
      throw new Error("Warship production job state is invalid");
    }
    return Object.freeze({
      portId: job.portId,
      ownerId: job.ownerId,
      strategicDestinationCellId: job.strategicDestinationCellId,
      state: "READY_TO_DEPLOY" as const,
    });
  });
  jobs.sort(
    (left, right) =>
      compareIds(left.portId, right.portId) ||
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

function freezeWarshipHealth(
  health: WarshipOperationalState["health"],
): WarshipOperationalState["health"] {
  if (
    health === null ||
    typeof health !== "object" ||
    Array.isArray(health) ||
    typeof health.numerator !== "bigint" ||
    typeof health.denominator !== "bigint" ||
    health.numerator < 0n ||
    health.denominator <= 0n
  ) {
    throw new Error("Warship health must be a non-negative exact ratio");
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

function freezeTransportHealth(
  health: TransportExactHealth,
): TransportExactHealth {
  if (
    health === null ||
    typeof health !== "object" ||
    Array.isArray(health) ||
    typeof health.numerator !== "bigint" ||
    typeof health.denominator !== "bigint" ||
    health.numerator <= 0n ||
    health.denominator <= 0n
  ) {
    throw new Error("active Transport health must be a positive exact ratio");
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

function freezeTankRetainedTarget(
  target: TankOperationalState["retainedTarget"],
  map: SimulationMap,
): TankOperationalState["retainedTarget"] {
  if (target === undefined) return undefined;
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    throw new Error("Tank retained target must be an object");
  }
  if (target.targetClass === "POPULATION") {
    if (!map.isValidCellId(target.cellId)) {
      throw new Error(
        "Tank retained Population target must be a valid map cell",
      );
    }
    return Object.freeze({
      targetClass: "POPULATION" as const,
      cellId: target.cellId,
    });
  }
  if (
    target.targetClass !== "TANK_CHASSIS" &&
    target.targetClass !== "WARSHIP" &&
    target.targetClass !== "TRAIN"
  ) {
    throw new Error("Tank retained target class is invalid");
  }
  if (typeof target.unitId !== "string" || target.unitId.length === 0) {
    throw new Error("Tank retained unit target must have a non-empty unitId");
  }
  return Object.freeze({
    targetClass: target.targetClass,
    unitId: target.unitId,
  });
}

function freezeTankOperationalStates(
  entries: readonly MatchTankOperationalState[],
  mobileUnits: readonly MobileUnitState[],
  map: SimulationMap,
): readonly MatchTankOperationalState[] {
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
    assertNonNegativeSafeInteger(
      entry.eligibleFromTick,
      "Tank eligibleFromTick",
    );
    assertNonNegativeSafeInteger(
      entry.attackReadyAtTick,
      "Tank attackReadyAtTick",
    );
    const roamingOrdinal = entry.roamingOrdinal ?? 0;
    assertNonNegativeSafeInteger(roamingOrdinal, "Tank roamingOrdinal");
    const retainedTarget = freezeTankRetainedTarget(entry.retainedTarget, map);
    if (
      entry.repairFactoryId !== undefined &&
      (typeof entry.repairFactoryId !== "string" ||
        entry.repairFactoryId.length === 0)
    ) {
      throw new Error("Tank repairFactoryId must be a non-empty string");
    }
    if (entry.repairArrivalTick !== undefined) {
      assertNonNegativeSafeInteger(
        entry.repairArrivalTick,
        "Tank repairArrivalTick",
      );
      if (entry.repairFactoryId === undefined) {
        throw new Error("Tank repairArrivalTick requires repairFactoryId");
      }
    }
    return Object.freeze({
      unitId: entry.unitId,
      health: freezeTankHealth(entry.health),
      operatingAnchorCellId: entry.operatingAnchorCellId,
      eligibleFromTick: entry.eligibleFromTick,
      attackReadyAtTick: entry.attackReadyAtTick,
      roamingOrdinal,
      ...(retainedTarget === undefined ? {} : { retainedTarget }),
      ...(entry.repairFactoryId === undefined
        ? {}
        : { repairFactoryId: entry.repairFactoryId }),
      ...(entry.repairArrivalTick === undefined
        ? {}
        : { repairArrivalTick: entry.repairArrivalTick }),
    });
  });
  states.sort((left, right) => compareIds(left.unitId, right.unitId));
  return Object.freeze(states);
}

function freezeWarshipOperationalStates(
  entries: readonly WarshipOperationalState[],
  mobileUnits: readonly MobileUnitState[],
  map: SimulationMap,
): readonly WarshipOperationalState[] {
  if (!Array.isArray(entries)) {
    throw new Error("warshipOperationalStates must be an array");
  }
  const unitsById = new Map(mobileUnits.map((unit) => [unit.id, unit]));
  const seenUnitIds = new Set<string>();
  const states = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Warship operational state must be an object");
    }
    if (typeof entry.unitId !== "string" || entry.unitId.length === 0) {
      throw new Error("Warship operational unitId must be a non-empty string");
    }
    if (seenUnitIds.has(entry.unitId)) {
      throw new Error(`duplicate Warship operational state: ${entry.unitId}`);
    }
    seenUnitIds.add(entry.unitId);
    const unit = unitsById.get(entry.unitId);
    if (unit === undefined || unit.type !== "WARSHIP") {
      throw new Error(
        `Warship operational state must reference a deployed Warship: ${entry.unitId}`,
      );
    }
    if (unit.movementClass !== "NAVAL") {
      throw new Error("Warship movement class must be NAVAL");
    }
    if (map.terrainAt(unit.cellId) !== "DEEP_WATER") {
      throw new Error("Warship current cell must be a Deep-Water map cell");
    }
    if (
      unit.strategicDestinationCellId !== undefined &&
      map.terrainAt(unit.strategicDestinationCellId) !== "DEEP_WATER"
    ) {
      throw new Error("Warship strategic destination must be a Deep-Water map cell");
    }
    if (
      unit.route !== undefined &&
      unit.route.cells.some((cellId) => map.terrainAt(cellId) !== "DEEP_WATER")
    ) {
      throw new Error("Warship route must contain only Deep-Water map cells");
    }
    if (
      !map.isValidCellId(entry.operatingAnchorCellId) ||
      map.terrainAt(entry.operatingAnchorCellId) !== "DEEP_WATER"
    ) {
      throw new Error("Warship operating anchor must be a Deep-Water map cell");
    }
    assertNonNegativeSafeInteger(
      entry.attackReadyAtTick,
      "Warship attackReadyAtTick",
    );
    assertNonNegativeSafeInteger(
      entry.nextProjectileOrdinal,
      "Warship nextProjectileOrdinal",
    );
    assertNonNegativeSafeInteger(entry.roamingOrdinal, "Warship roamingOrdinal");
    if (
      entry.repairPortId !== undefined &&
      (typeof entry.repairPortId !== "string" || entry.repairPortId.length === 0)
    ) {
      throw new Error("Warship repairPortId must be a non-empty string");
    }
    if (entry.repairArrivalTick !== undefined) {
      assertNonNegativeSafeInteger(
        entry.repairArrivalTick,
        "Warship repairArrivalTick",
      );
      if (entry.repairPortId === undefined) {
        throw new Error("Warship repairArrivalTick requires repairPortId");
      }
    }
    return Object.freeze({
      unitId: entry.unitId,
      health: freezeWarshipHealth(entry.health),
      operatingAnchorCellId: entry.operatingAnchorCellId,
      attackReadyAtTick: entry.attackReadyAtTick,
      nextProjectileOrdinal: entry.nextProjectileOrdinal,
      roamingOrdinal: entry.roamingOrdinal,
      ...(entry.repairPortId === undefined
        ? {}
        : { repairPortId: entry.repairPortId }),
      ...(entry.repairArrivalTick === undefined
        ? {}
        : { repairArrivalTick: entry.repairArrivalTick }),
    });
  });
  for (const unit of mobileUnits) {
    if (unit.type === "WARSHIP" && !seenUnitIds.has(unit.id)) {
      throw new Error(
        `deployed Warship is missing operational state: ${unit.id}`,
      );
    }
  }
  states.sort((left, right) => compareIds(left.unitId, right.unitId));
  return Object.freeze(states);
}

const TRANSPORT_DESTRUCTION_CAUSE_CLASSES =
  new Set<TransportDestructionCauseClass>([
    "NAVAL_GUNFIRE",
    "SAM_ANTI_SHIP",
    "STRATEGIC_BLAST",
    "OTHER_HOSTILE_EFFECT",
    "UNATTRIBUTED",
  ]);

function freezeTransportOperationalStates(
  entries: readonly TransportOperationalState[],
  mobileUnits: readonly MobileUnitState[],
  factions: readonly MatchFactionState[],
): readonly TransportOperationalState[] {
  if (!Array.isArray(entries)) {
    throw new Error("transportOperationalStates must be an array");
  }
  const unitsById = new Map(mobileUnits.map((unit) => [unit.id, unit]));
  const factionsById = new Map(factions.map((faction) => [faction.id, faction]));
  const seenUnitIds = new Set<string>();
  const carriedByOwner = new Map<string, number>();
  const states = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Transport operational state must be an object");
    }
    if (typeof entry.unitId !== "string" || entry.unitId.length === 0) {
      throw new Error("Transport operational unitId must be a non-empty string");
    }
    if (seenUnitIds.has(entry.unitId)) {
      throw new Error(`duplicate Transport operational state: ${entry.unitId}`);
    }
    seenUnitIds.add(entry.unitId);
    const unit = unitsById.get(entry.unitId);
    if (unit === undefined || unit.type !== "TRANSPORT_SHIP") {
      throw new Error(
        `Transport operational state must reference an active Transport: ${entry.unitId}`,
      );
    }
    if (unit.movementClass !== "TRANSPORT") {
      throw new Error("Transport movement class must be TRANSPORT");
    }
    assertNonNegativeSafeInteger(
      entry.carriedPopulation,
      "Transport carriedPopulation",
    );
    const owner = factionsById.get(unit.ownerId);
    if (owner === undefined) {
      throw new Error(`Transport owner is missing: ${unit.ownerId}`);
    }
    const nextCarried =
      (carriedByOwner.get(unit.ownerId) ?? 0) + entry.carriedPopulation;
    if (!Number.isSafeInteger(nextCarried)) {
      throw new Error("Transport carried Population exceeds safe-integer range");
    }
    carriedByOwner.set(unit.ownerId, nextCarried);
    return Object.freeze({
      unitId: entry.unitId,
      carriedPopulation: entry.carriedPopulation,
      ...(entry.health === undefined
        ? {}
        : { health: freezeTransportHealth(entry.health) }),
    });
  });
  for (const [ownerId, carried] of carriedByOwner) {
    const aboard = factionsById.get(ownerId)!.population.aboardTransports;
    if (carried > aboard) {
      throw new Error(
        `Transport operational payload exceeds ${ownerId} aboard Population`,
      );
    }
  }
  states.sort((left, right) => compareIds(left.unitId, right.unitId));
  return Object.freeze(states);
}

function freezeTransportDestructionResults(
  entries: readonly TransportDestructionResult[],
  mobileUnits: readonly MobileUnitState[],
  factions: readonly MatchFactionState[],
): readonly TransportDestructionResult[] {
  if (!Array.isArray(entries)) {
    throw new Error("transportDestructionResults must be an array");
  }
  const activeUnitIds = new Set(mobileUnits.map((unit) => unit.id));
  const factionIds = new Set(factions.map((faction) => faction.id));
  const seenTransportIds = new Set<string>();
  const results = entries.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Transport destruction result must be an object");
    }
    if (typeof entry.transportId !== "string" || entry.transportId.length === 0) {
      throw new Error("Transport destruction transportId must be non-empty");
    }
    if (seenTransportIds.has(entry.transportId)) {
      throw new Error(`duplicate Transport destruction result: ${entry.transportId}`);
    }
    seenTransportIds.add(entry.transportId);
    if (activeUnitIds.has(entry.transportId)) {
      throw new Error(
        `Transport destruction result cannot reference an active unit: ${entry.transportId}`,
      );
    }
    if (
      typeof entry.previousOwnerFactionId !== "string" ||
      !factionIds.has(entry.previousOwnerFactionId)
    ) {
      throw new Error("Transport destruction previous owner must be a current faction");
    }
    assertNonNegativeSafeInteger(
      entry.destructionTick,
      "Transport destructionTick",
    );
    assertNonNegativeSafeInteger(
      entry.carriedPopulationAtDestruction,
      "Transport carriedPopulationAtDestruction",
    );
    if (
      entry.creditedDestroyerFactionId !== undefined &&
      (typeof entry.creditedDestroyerFactionId !== "string" ||
        !factionIds.has(entry.creditedDestroyerFactionId))
    ) {
      throw new Error("Transport credited destroyer must be a current faction");
    }
    if (!TRANSPORT_DESTRUCTION_CAUSE_CLASSES.has(entry.causeClass)) {
      throw new Error("Transport destruction causeClass is invalid");
    }
    return Object.freeze({
      transportId: entry.transportId,
      previousOwnerFactionId: entry.previousOwnerFactionId,
      destructionTick: entry.destructionTick,
      carriedPopulationAtDestruction: entry.carriedPopulationAtDestruction,
      ...(entry.creditedDestroyerFactionId === undefined
        ? {}
        : { creditedDestroyerFactionId: entry.creditedDestroyerFactionId }),
      causeClass: entry.causeClass,
    });
  });
  results.sort(
    (left, right) =>
      left.destructionTick - right.destructionTick ||
      compareIds(left.transportId, right.transportId),
  );
  return Object.freeze(results);
}

function assertExclusivePhysicalOccupancy(
  structures: readonly PersistentStructureState[],
  mobileUnits: readonly MobileUnitState[],
): void {
  const occupiedCells = new Set<number>();
  for (const structure of structures) {
    if (occupiedCells.has(structure.cellId)) {
      throw new Error(
        `duplicate physical occupancy at cell ${structure.cellId}`,
      );
    }
    occupiedCells.add(structure.cellId);
  }
  for (const unit of mobileUnits) {
    if (occupiedCells.has(unit.cellId)) {
      throw new Error(`duplicate physical occupancy at cell ${unit.cellId}`);
    }
    occupiedCells.add(unit.cellId);
  }
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
  const structures = materializePersistentStructures(
    update.structures ?? previous.structures,
  );
  assertExclusivePhysicalOccupancy(structures, mobileUnits.mobileUnits);
  const combatProjectiles = materializeHomingCombatProjectiles(
    update.combatProjectiles ?? previous.combatProjectiles ?? [],
  );
  const tradeVoyages = freezeTradeVoyages(
    update.tradeVoyages ?? previous.tradeVoyages ?? [],
    mobileUnits.mobileUnits,
    previous.map,
    factions,
  );
  const tradePortSchedulers = freezeTradePortSchedulers(
    update.tradePortSchedulers ?? previous.tradePortSchedulers ?? [],
    factions,
  );
  const tradeRetiredPortEpochs = freezeTradeRetiredPortEpochs(
    update.tradeRetiredPortEpochs ?? previous.tradeRetiredPortEpochs ?? [],
    factions,
  );
  const tradePendingSignedFacts = freezeTradePendingSignedFacts(
    update.tradePendingSignedFacts ?? previous.tradePendingSignedFacts ?? [],
    factions,
  );
  const factoryTrains = materializeFactoryTrainState(
    previous,
    update,
    mobileUnits.mobileUnits,
    previous.map,
  );
  const tankOperationalStates = freezeTankOperationalStates(
    update.tankOperationalStates ?? previous.tankOperationalStates ?? [],
    mobileUnits.mobileUnits,
    previous.map,
  );
  const warshipOperationalStates = freezeWarshipOperationalStates(
    update.warshipOperationalStates ?? previous.warshipOperationalStates ?? [],
    mobileUnits.mobileUnits,
    previous.map,
  );
  const transportOperationalStates = freezeTransportOperationalStates(
    update.transportOperationalStates ??
      previous.transportOperationalStates ??
      [],
    mobileUnits.mobileUnits,
    factions,
  );
  const transportDestructionResults = freezeTransportDestructionResults(
    update.transportDestructionResults ??
      previous.transportDestructionResults ??
      [],
    mobileUnits.mobileUnits,
    factions,
  );
  return Object.freeze({
    seed: previous.seed,
    tick,
    map: previous.map,
    ownership: freezeOwnership(ownership, previous.ownership),
    fallout: freezeFallout(fallout),
    factions,
    structures,
    mobileUnits: mobileUnits.mobileUnits,
    nextMobileUnitOrdinal: mobileUnits.nextMobileUnitOrdinal,
    combatProjectiles,
    transportOperationalStates,
    transportDestructionResults,
    tradeVoyages,
    tradePortSchedulers,
    tradeRetiredPortEpochs,
    tradePendingSignedFacts,
    ...factoryTrains,
    tankProductionJobs: freezeTankProductionJobs(
      update.tankProductionJobs ?? previous.tankProductionJobs ?? [],
      previous.map,
    ),
    warshipProductionJobs: freezeWarshipProductionJobs(
      update.warshipProductionJobs ?? previous.warshipProductionJobs ?? [],
      previous.map,
    ),
    tankOperationalStates,
    warshipOperationalStates,
    directReveals: freezeDirectReveals(
      update.directReveals ?? previous.directReveals ?? [],
    ),
    operations: Object.freeze(
      (update.operations ?? previous.operations).map(
        materializeLandOperationState,
      ),
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

type InitialMatchStateSpec = Readonly<
  Pick<MatchSpec, "seed" | "map" | "factions">
>;

function assertResolvedArtifactMapMatches(
  spec: InitialMatchStateSpec,
  map: SimulationMap,
): void {
  if (!isArtifactMapSpec(spec.map)) {
    throw new Error(
      "artifact map identity validation requires an artifact-backed binding",
    );
  }
  if (
    map.source !== "ARTIFACT" ||
    map.mapId !== spec.map.mapId ||
    map.mapVersion !== spec.map.mapVersion ||
    map.mapHash !== spec.map.mapHash
  ) {
    throw new Error(
      "resolved artifact map identity does not match MatchSpec binding",
    );
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
        displayName: faction.displayName,
        isMinorFaction: faction.isMinorFaction,
        ...(faction.origin === undefined ? {} : { origin: faction.origin }),
        status: "ACTIVE",
        rules: faction.rules,
        population: createEmptyPopulationState(),
        ffy: STARTING_FFY,
        lifetimeGrossPositiveFfyEarned: 0,
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
    combatProjectiles: Object.freeze([]),
    transportOperationalStates: Object.freeze([]),
    transportDestructionResults: Object.freeze([]),
    tradeVoyages: Object.freeze([]),
    tradePortSchedulers: Object.freeze([]),
    tradeRetiredPortEpochs: Object.freeze([]),
    tradePendingSignedFacts: Object.freeze([]),
    factoryRailLoops: Object.freeze([]),
    factoryTrainEpochs: Object.freeze([]),
    trainServices: Object.freeze([]),
    tankProductionJobs: Object.freeze([]),
    warshipProductionJobs: Object.freeze([]),
    tankOperationalStates: Object.freeze([]),
    warshipOperationalStates: Object.freeze([]),
    directReveals: Object.freeze([]),
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
    throw new Error(
      "pre-Spawn MatchState creation requires an artifact-backed map",
    );
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
    throw new Error(
      "artifact-backed MatchState creation requires a validated resolved map",
    );
  }
  if (!artifact && resolvedArtifactMap !== undefined) {
    throw new Error(
      "synthetic MatchState creation must not receive an artifact map override",
    );
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
    state = createProspectiveMatchState(state, {
      structures: result.structures,
    });
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
      displayName: faction.displayName,
      isMinorFaction: faction.isMinorFaction,
      ...(faction.origin === undefined
        ? {}
        : {
            origin: {
              id: faction.origin.id,
              displayName: faction.origin.displayName,
              version: faction.origin.version,
              positiveTraitIds: [...faction.origin.positiveTraitIds],
              negativeTraitIds: [...faction.origin.negativeTraitIds],
            },
          }),
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
      lifetimeGrossPositiveFfyEarned: faction.lifetimeGrossPositiveFfyEarned,
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
      ...(structure.outputCellId === undefined
        ? {}
        : { outputCellId: structure.outputCellId }),
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
      ...(unit.strategicDestinationCellId === undefined
        ? {}
        : { strategicDestinationCellId: unit.strategicDestinationCellId }),
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

  const tradePortSchedulers = state.tradePortSchedulers.map((scheduler) => ({
    portId: scheduler.portId,
    ownerId: scheduler.ownerId,
    ownershipEpochOrdinal: scheduler.ownershipEpochOrdinal,
    nextAttemptOrdinal: scheduler.nextAttemptOrdinal,
    nextAttemptTick: scheduler.nextAttemptTick,
    nextDestinationSelectionOrdinal: scheduler.nextDestinationSelectionOrdinal,
    destinationHistory: scheduler.destinationHistory.map((entry) => ({
      destinationPortId: entry.destinationPortId,
      lastSelectedOrdinal: entry.lastSelectedOrdinal,
    })),
  }));
  const tradeVoyages = state.tradeVoyages.map((voyage) => ({
    unitId: voyage.unitId,
    economicSnapshot: {
      originalOwnerId: voyage.economicSnapshot.originalOwnerId,
      sourcePortId: voyage.economicSnapshot.sourcePortId,
      launchDestinationPortId: voyage.economicSnapshot.launchDestinationPortId,
      valuationCellId: voyage.economicSnapshot.valuationCellId,
      plannedRouteLengthCells: voyage.economicSnapshot.plannedRouteLengthCells,
      rawCargoFfy: voyage.economicSnapshot.rawCargoFfy,
      ownerSuccessValueFfy: voyage.economicSnapshot.ownerSuccessValueFfy,
    },
    sourcePortOwnershipEpochOrdinal: voyage.sourcePortOwnershipEpochOrdinal,
    routingMode: voyage.routingMode,
    destinationPortId: voyage.destinationPortId,
    firstHostileCaptureResolved: voyage.firstHostileCaptureResolved,
  }));
  const tradeRetiredPortEpochs = state.tradeRetiredPortEpochs.map((entry) => ({
    portId: entry.portId,
    ownerId: entry.ownerId,
    ownershipEpochOrdinal: entry.ownershipEpochOrdinal,
    nextDestinationSelectionOrdinal: entry.nextDestinationSelectionOrdinal,
    destinationHistory: entry.destinationHistory.map((history) => ({
      destinationPortId: history.destinationPortId,
      lastSelectedOrdinal: history.lastSelectedOrdinal,
    })),
  }));
  const tradePendingSignedFacts = state.tradePendingSignedFacts.map((entry) => ({
    id: entry.id,
    ownerId: entry.ownerId,
    componentsFfy: [...entry.componentsFfy],
  }));
  const factoryTrains = serializeFactoryTrainState(state);

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
            strategicDestinationCellId: job.strategicDestinationCellId,
            state: job.state,
            remainingTicks: job.remainingTicks,
          }
        : {
            factoryId: job.factoryId,
            ownerId: job.ownerId,
            chassisType: job.chassisType,
            strategicDestinationCellId: job.strategicDestinationCellId,
            state: job.state,
          },
    );

  const warshipProductionJobs = [...state.warshipProductionJobs]
    .sort(
      (left, right) =>
        compareIds(left.portId, right.portId) ||
        compareIds(left.ownerId, right.ownerId),
    )
    .map((job) =>
      job.state === "BUILDING"
        ? {
            portId: job.portId,
            ownerId: job.ownerId,
            strategicDestinationCellId: job.strategicDestinationCellId,
            state: job.state,
            remainingTicks: job.remainingTicks,
          }
        : {
            portId: job.portId,
            ownerId: job.ownerId,
            strategicDestinationCellId: job.strategicDestinationCellId,
            state: job.state,
          },
    );

  const tankOperationalStates = [...state.tankOperationalStates]
    .sort((left, right) => compareIds(left.unitId, right.unitId))
    .map((entry) => ({
      unitId: entry.unitId,
      health: {
        numerator: entry.health.numerator.toString(),
        denominator: entry.health.denominator.toString(),
      },
      operatingAnchorCellId: entry.operatingAnchorCellId,
      eligibleFromTick: entry.eligibleFromTick,
      attackReadyAtTick: entry.attackReadyAtTick,
      roamingOrdinal: entry.roamingOrdinal ?? 0,
      ...(entry.retainedTarget === undefined
        ? {}
        : {
            retainedTarget:
              entry.retainedTarget.targetClass === "POPULATION"
                ? {
                    targetClass: "POPULATION" as const,
                    cellId: entry.retainedTarget.cellId,
                  }
                : {
                    targetClass: entry.retainedTarget.targetClass,
                    unitId: entry.retainedTarget.unitId,
                  },
          }),
      ...(entry.repairFactoryId === undefined
        ? {}
        : { repairFactoryId: entry.repairFactoryId }),
      ...(entry.repairArrivalTick === undefined
        ? {}
        : { repairArrivalTick: entry.repairArrivalTick }),
    }));

  const combatProjectiles = [...state.combatProjectiles]
    .sort(
      (left, right) =>
        compareIds(left.sourceUnitId, right.sourceUnitId) ||
        left.projectileOrdinal - right.projectileOrdinal,
    )
    .map((projectile) => ({
      sourceUnitId: projectile.sourceUnitId,
      sourceOwnerId: projectile.sourceOwnerId,
      targetUnitId: projectile.targetUnitId,
      projectileOrdinal: projectile.projectileOrdinal,
      profileId: projectile.profileId,
      position: {
        x: projectile.position.x,
        y: projectile.position.y,
      },
      speedCellsPerSecond: projectile.speedCellsPerSecond,
      damage: {
        numerator: projectile.damage.numerator.toString(),
        denominator: projectile.damage.denominator.toString(),
      },
      createdTick: projectile.createdTick,
    }));

  const warshipOperationalStates = [...state.warshipOperationalStates]
    .sort((left, right) => compareIds(left.unitId, right.unitId))
    .map((entry) => ({
      unitId: entry.unitId,
      health: {
        numerator: entry.health.numerator.toString(),
        denominator: entry.health.denominator.toString(),
      },
      operatingAnchorCellId: entry.operatingAnchorCellId,
      attackReadyAtTick: entry.attackReadyAtTick,
      nextProjectileOrdinal: entry.nextProjectileOrdinal,
      roamingOrdinal: entry.roamingOrdinal,
      ...(entry.repairPortId === undefined
        ? {}
        : { repairPortId: entry.repairPortId }),
      ...(entry.repairArrivalTick === undefined
        ? {}
        : { repairArrivalTick: entry.repairArrivalTick }),
    }));

  const transportOperationalStates = [...state.transportOperationalStates]
    .sort((left, right) => compareIds(left.unitId, right.unitId))
    .map((entry) => ({
      unitId: entry.unitId,
      carriedPopulation: entry.carriedPopulation,
      ...(entry.health === undefined
        ? {}
        : {
            health: {
              numerator: entry.health.numerator.toString(),
              denominator: entry.health.denominator.toString(),
            },
          }),
    }));

  const transportDestructionResults = [...state.transportDestructionResults]
    .sort(
      (left, right) =>
        left.destructionTick - right.destructionTick ||
        compareIds(left.transportId, right.transportId),
    )
    .map((entry) => ({
      transportId: entry.transportId,
      previousOwnerFactionId: entry.previousOwnerFactionId,
      destructionTick: entry.destructionTick,
      carriedPopulationAtDestruction: entry.carriedPopulationAtDestruction,
      ...(entry.creditedDestroyerFactionId === undefined
        ? {}
        : { creditedDestroyerFactionId: entry.creditedDestroyerFactionId }),
      causeClass: entry.causeClass,
    }));

  const directReveals = state.directReveals.map((entry) => ({
    viewerFactionId: entry.viewerFactionId,
    sourceKind: entry.sourceKind,
    sourceId: entry.sourceId,
    expiryExclusiveTick: entry.expiryExclusiveTick,
  }));

  const operations = [...state.operations]
    .sort(
      (left, right) =>
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
    combatProjectiles,
    transportOperationalStates,
    transportDestructionResults,
    tradePortSchedulers,
    tradeRetiredPortEpochs,
    tradePendingSignedFacts,
    tradeVoyages,
    factoryRailLoops: factoryTrains.factoryRailLoops,
    factoryTrainEpochs: factoryTrains.factoryTrainEpochs,
    trainServices: factoryTrains.trainServices,
    tankProductionJobs,
    warshipProductionJobs,
    tankOperationalStates,
    warshipOperationalStates,
    directReveals,
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
