import type {
  DirectiveChanges,
  StructureType,
} from "../core/controller/ControllerApi";
import { resolvePassiveFfyTick } from "./Economy";
import {
  releaseFactoryRailLoopSnapshot,
  retainFactoryRailLoopSnapshot,
} from "./FactoryRailLifecycle";
import { reconcileHostilityGrace } from "./HostilityState";
import {
  resolveLandTick,
  tryApplyPersistentDirectiveChanges,
} from "./LandOperations";
import {
  createAdvancedMatchState,
  createProspectiveMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";
import {
  assignMobileUnitRoute,
  createMobileUnit,
} from "./MobileUnits";
import {
  grantPopulation,
  removePopulation,
  repartitionPopulation,
  transferPopulation,
  type PopulationBucket,
  type PopulationState,
} from "./Population";
import {
  resolvePersistentStructureLifecycleTick,
  tryPurchaseStructureBuild,
  tryPurchaseStructureUpgrade,
} from "./Structures";
import {
  advanceFactoryTrainServiceSchedulerTick,
  advanceTrainMovementTick,
  canDispatchFactoryPrimaryTrain,
  createFactoryTrainDispatchRoutes,
  createFactoryTrainServiceEpoch,
  createTrainDispatchEconomicSnapshot,
  dispatchFactoryPrimaryTrain,
  finishFactoryPrimaryTrain,
  transferFactoryTrainServiceEpoch,
} from "./TrainService";

export interface SetTestMarkerAction {
  readonly type: "SET_TEST_MARKER";
  readonly factionId: string;
  readonly value: number;
}

export interface CapitulateFactionAction {
  readonly type: "CAPITULATE_FACTION";
  readonly factionId: string;
}

export interface GrantPopulationAction {
  readonly type: "GRANT_POPULATION";
  readonly factionId: string;
  readonly amount: number;
}

export interface RepartitionPopulationAction {
  readonly type: "REPARTITION_POPULATION";
  readonly factionId: string;
  readonly from: PopulationBucket;
  readonly to: PopulationBucket;
  readonly amount: number;
}

export interface RemovePopulationAction {
  readonly type: "REMOVE_POPULATION";
  readonly factionId: string;
  readonly from: PopulationBucket;
  readonly amount: number;
}

export interface TransferPopulationAction {
  readonly type: "TRANSFER_POPULATION";
  readonly sourceFactionId: string;
  readonly recipientFactionId: string;
  readonly sourceBucket: PopulationBucket;
  readonly amount: number;
}

export interface ApplyPersistentDirectivesAction {
  readonly type: "APPLY_PERSISTENT_DIRECTIVES";
  readonly factionId: string;
  readonly changes: DirectiveChanges;
}

export interface PurchaseStructureBuildAction {
  readonly type: "PURCHASE_STRUCTURE_BUILD";
  readonly structureId: string;
  readonly ownerId: string;
  readonly structureType: StructureType;
  readonly cellId: number;
}

export interface PurchaseStructureUpgradeAction {
  readonly type: "PURCHASE_STRUCTURE_UPGRADE";
  readonly structureId: string;
  readonly ownerId: string;
}

export type SimulationAction =
  | SetTestMarkerAction
  | CapitulateFactionAction
  | GrantPopulationAction
  | RepartitionPopulationAction
  | RemovePopulationAction
  | TransferPopulationAction
  | ApplyPersistentDirectivesAction
  | PurchaseStructureBuildAction
  | PurchaseStructureUpgradeAction;

export interface AcceptedSimulationInput {
  readonly tick: number;
  readonly sequence: number;
  readonly action: SimulationAction;
}

function updateFactionPopulation(
  factions: readonly MatchFactionState[],
  factionId: string,
  update: (population: PopulationState) => PopulationState,
): readonly MatchFactionState[] {
  let found = false;
  const result = factions.map((faction) => {
    if (faction.id !== factionId) return faction;
    found = true;
    return { ...faction, population: update(faction.population) };
  });
  if (!found) throw new Error(`unknown faction: ${factionId}`);
  return result;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function reconcileStoredFactoryTrainDispatches(
  state: MatchState,
  currentTick: number,
): Readonly<
  Pick<
    MatchState,
    | "mobileUnits"
    | "nextMobileUnitOrdinal"
    | "factoryRailLoops"
    | "factoryTrainEpochs"
    | "trainServices"
  >
> {
  let mobileUnits = [...state.mobileUnits];
  let nextMobileUnitOrdinal = state.nextMobileUnitOrdinal;
  let factoryRailLoops = [...state.factoryRailLoops];
  let factoryTrainEpochs = [...state.factoryTrainEpochs];
  let trainServices = [...state.trainServices];

  const ownerIds = state.factions.map((faction) => faction.id);
  const epochsByFactory = new Map(
    factoryTrainEpochs.map((epoch) => [epoch.factoryId, epoch]),
  );
  const loopsByFactory = new Map(
    factoryRailLoops.map((lifecycle) => [lifecycle.factoryId, lifecycle]),
  );
  const qualifyingStationCellIds = state.structures
    .filter(
      (structure) =>
        (structure.type === "CITY" || structure.type === "PORT") &&
        structure.active &&
        structure.completedLevel !== undefined,
    )
    .map((structure) => structure.cellId);

  const factories = state.structures
    .filter(
      (structure) =>
        structure.type === "FACTORY" && structure.completedLevel !== undefined,
    )
    .slice()
    .sort((left, right) => compareIds(left.id, right.id));

  for (const factory of factories) {
    let epoch = epochsByFactory.get(factory.id);
    if (epoch === undefined) {
      epoch = createFactoryTrainServiceEpoch(factory.id, factory.ownerId);
      factoryTrainEpochs.push(epoch);
      epochsByFactory.set(factory.id, epoch);
    } else if (epoch.ownerId !== factory.ownerId) {
      const transferredEpoch = transferFactoryTrainServiceEpoch(
        epoch,
        factory.ownerId,
      );
      factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
        entry.factoryId === factory.id ? transferredEpoch : entry,
      );
      epoch = transferredEpoch;
      epochsByFactory.set(factory.id, epoch);
    } else {
      const advancedEpoch = advanceFactoryTrainServiceSchedulerTick(
        epoch,
        factory.active,
      );
      if (advancedEpoch !== epoch) {
        factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
          entry.factoryId === factory.id ? advancedEpoch : entry,
        );
        epoch = advancedEpoch;
        epochsByFactory.set(factory.id, epoch);
      }
    }

    const lifecycle = loopsByFactory.get(factory.id);
    const loop = lifecycle?.currentLoop ?? null;
    if (
      !canDispatchFactoryPrimaryTrain(
        epoch,
        factory.active,
        loop !== null && loop.cells.length > 0,
      )
    ) {
      continue;
    }

    const owner = state.factions.find(
      (faction) => faction.id === factory.ownerId,
    );
    if (owner === undefined) {
      throw new Error(
        `Factory ${factory.id} has unknown owner ${factory.ownerId}`,
      );
    }
    const p07Active = owner.rules.customDomains.some(
      (entry) =>
        entry.sourceKind === "ORIGIN" &&
        entry.sourceId === "P07" &&
        entry.domain === "FACTORY_DISPATCH_SCHEDULER",
    );

    const created = createMobileUnit(
      state.map,
      ownerIds,
      { mobileUnits, nextMobileUnitOrdinal },
      {
        ownerId: factory.ownerId,
        type: "TRAIN",
        movementClass: "RAIL",
        cellId: loop!.cells[0]!,
      },
    );
    const dispatch = dispatchFactoryPrimaryTrain(
      epoch,
      created.unit.id,
      p07Active,
    );
    const routes = createFactoryTrainDispatchRoutes(
      loop!.cells,
      dispatch.bonusTrainRequired,
    );
    const routed = assignMobileUnitRoute(
      state.map,
      created.unit,
      routes.primary,
    );

    mobileUnits = created.mobileUnits.map((unit) =>
      unit.id === routed.id ? routed : unit,
    );
    nextMobileUnitOrdinal = created.nextMobileUnitOrdinal;

    let retainedLifecycle = retainFactoryRailLoopSnapshot(
      lifecycle!,
      routed.id,
    );
    const dispatchSnapshot = createTrainDispatchEconomicSnapshot(
      factory.id,
      factory.ownerId,
      factory.completedLevel!,
    );
    trainServices.push({
      trainId: routed.id,
      factoryId: factory.id,
      loopSnapshotId: routed.id,
      isPrimary: true,
      dispatchSnapshot,
      resumeAtTick: null,
    });

    epoch = dispatch.epoch;
    if (routes.bonus !== null) {
      const bonusCreated = createMobileUnit(
        state.map,
        ownerIds,
        { mobileUnits, nextMobileUnitOrdinal },
        {
          ownerId: factory.ownerId,
          type: "TRAIN",
          movementClass: "RAIL",
          cellId: loop!.cells[0]!,
        },
      );
      const bonusRouted = assignMobileUnitRoute(
        state.map,
        bonusCreated.unit,
        routes.bonus,
      );
      mobileUnits = bonusCreated.mobileUnits.map((unit) =>
        unit.id === bonusRouted.id ? bonusRouted : unit,
      );
      nextMobileUnitOrdinal = bonusCreated.nextMobileUnitOrdinal;
      retainedLifecycle = retainFactoryRailLoopSnapshot(
        retainedLifecycle,
        bonusRouted.id,
      );
      trainServices.push({
        trainId: bonusRouted.id,
        factoryId: factory.id,
        loopSnapshotId: bonusRouted.id,
        isPrimary: false,
        dispatchSnapshot,
        resumeAtTick: null,
      });
    }

    factoryRailLoops = factoryRailLoops.map((entry) =>
      entry.factoryId === factory.id ? retainedLifecycle : entry,
    );
    loopsByFactory.set(factory.id, retainedLifecycle);
    factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
      entry.factoryId === factory.id ? epoch : entry,
    );
    epochsByFactory.set(factory.id, epoch);
  }

  const survivingTrainServices: typeof trainServices = [];
  for (const service of trainServices
    .slice()
    .sort((left, right) => compareIds(left.trainId, right.trainId))) {
    const unit = mobileUnits.find((candidate) => candidate.id === service.trainId);
    if (unit === undefined) {
      throw new Error(`Train service ${service.trainId} has no physical Train`);
    }

    const moved = advanceTrainMovementTick(
      unit,
      currentTick,
      service.resumeAtTick,
      qualifyingStationCellIds,
    );

    if (moved.unit.route === undefined) {
      mobileUnits = mobileUnits.filter(
        (candidate) => candidate.id !== service.trainId,
      );

      const lifecycle = loopsByFactory.get(service.factoryId);
      if (lifecycle === undefined) {
        throw new Error(
          `Train service ${service.trainId} has no Factory rail lifecycle`,
        );
      }
      const releasedLifecycle = releaseFactoryRailLoopSnapshot(
        lifecycle,
        service.loopSnapshotId,
      );
      factoryRailLoops = factoryRailLoops.map((entry) =>
        entry.factoryId === service.factoryId ? releasedLifecycle : entry,
      );
      loopsByFactory.set(service.factoryId, releasedLifecycle);

      if (service.isPrimary) {
        const epoch = epochsByFactory.get(service.factoryId);
        if (epoch?.activePrimaryTrainId === service.trainId) {
          const finishedEpoch = finishFactoryPrimaryTrain(
            epoch,
            service.trainId,
          );
          factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
            entry.factoryId === service.factoryId ? finishedEpoch : entry,
          );
          epochsByFactory.set(service.factoryId, finishedEpoch);
        }
      }
      continue;
    }

    mobileUnits = mobileUnits.map((candidate) =>
      candidate.id === service.trainId ? moved.unit : candidate,
    );
    survivingTrainServices.push({
      ...service,
      resumeAtTick: moved.resumeAtTick,
    });
  }
  trainServices = survivingTrainServices;

  return Object.freeze({
    mobileUnits: Object.freeze(mobileUnits),
    nextMobileUnitOrdinal,
    factoryRailLoops: Object.freeze(factoryRailLoops),
    factoryTrainEpochs: Object.freeze(factoryTrainEpochs),
    trainServices: Object.freeze(trainServices),
  });
}

export class TickEngine {
  applyAcceptedInputs(
    state: MatchState,
    inputs: readonly AcceptedSimulationInput[],
  ): MatchState {
    const nextTick = state.tick + 1;
    const orderedInputs = [...inputs].sort(
      (left, right) => left.sequence - right.sequence,
    );
    const seenSequences = new Set<number>();
    let working = state;

    for (const input of orderedInputs) {
      if (input.tick !== nextTick) {
        throw new Error(
          `accepted input tick ${input.tick} cannot execute during tick ${nextTick}`,
        );
      }
      if (seenSequences.has(input.sequence)) {
        throw new Error(`duplicate accepted input sequence ${input.sequence}`);
      }
      seenSequences.add(input.sequence);

      const action = input.action;
      switch (action.type) {
        case "SET_TEST_MARKER":
          working = createProspectiveMatchState(working, {
            factions: working.factions.map((faction) =>
              faction.id === action.factionId
                ? { ...faction, testMarker: action.value }
                : faction,
            ),
          });
          break;
        case "CAPITULATE_FACTION": {
          const nextFactions = working.factions.map((faction) =>
            faction.id === action.factionId
              ? { ...faction, status: "CAPITULATED" as const }
              : faction,
          );
          const hostilityGrace = reconcileHostilityGrace(
            working.factions,
            working.operations,
            nextFactions,
            working.operations,
            working.hostilityGrace,
            nextTick,
          );
          working = createProspectiveMatchState(working, {
            factions: nextFactions,
            hostilityGrace,
          });
          break;
        }
        case "GRANT_POPULATION":
          working = createProspectiveMatchState(working, {
            factions: updateFactionPopulation(
              working.factions,
              action.factionId,
              (population) => grantPopulation(population, action.amount),
            ),
          });
          break;
        case "REPARTITION_POPULATION":
          working = createProspectiveMatchState(working, {
            factions: updateFactionPopulation(
              working.factions,
              action.factionId,
              (population) =>
                repartitionPopulation(
                  population,
                  action.from,
                  action.to,
                  action.amount,
                ),
            ),
          });
          break;
        case "REMOVE_POPULATION":
          working = createProspectiveMatchState(working, {
            factions: updateFactionPopulation(
              working.factions,
              action.factionId,
              (population) =>
                removePopulation(
                  population,
                  action.from,
                  action.amount,
                ),
            ),
          });
          break;
        case "TRANSFER_POPULATION": {
          const source = working.factions.find(
            (faction) => faction.id === action.sourceFactionId,
          );
          const recipient = working.factions.find(
            (faction) => faction.id === action.recipientFactionId,
          );
          if (source === undefined) {
            throw new Error(`unknown faction: ${action.sourceFactionId}`);
          }
          if (recipient === undefined) {
            throw new Error(`unknown faction: ${action.recipientFactionId}`);
          }
          const transferred = transferPopulation(
            source.population,
            recipient.population,
            action.sourceBucket,
            action.amount,
          );
          working = createProspectiveMatchState(working, {
            factions: working.factions.map((faction) => {
              if (faction.id === source.id) {
                return { ...faction, population: transferred.source };
              }
              if (faction.id === recipient.id) {
                return { ...faction, population: transferred.recipient };
              }
              return faction;
            }),
          });
          break;
        }
        case "APPLY_PERSISTENT_DIRECTIVES": {
          const applied = tryApplyPersistentDirectiveChanges(
            working,
            action.factionId,
            action.changes,
          );
          if (!applied.ok) {
            throw new Error(
              `accepted directive action became invalid: ${applied.failure.code}`,
            );
          }
          const hostilityGrace = reconcileHostilityGrace(
            working.factions,
            working.operations,
            applied.factions,
            applied.operations,
            working.hostilityGrace,
            nextTick,
          );
          working = createProspectiveMatchState(working, {
            factions: applied.factions,
            operations: applied.operations,
            defensePriorities: applied.defensePriorities,
            hostilityGrace,
          });
          break;
        }
        case "PURCHASE_STRUCTURE_BUILD": {
          const purchased = tryPurchaseStructureBuild(working, {
            structureId: action.structureId,
            ownerId: action.ownerId,
            type: action.structureType,
            cellId: action.cellId,
          });
          if (!purchased.ok) {
            throw new Error(
              `accepted structure build purchase became invalid: ${purchased.failure.code}`,
            );
          }
          working = createProspectiveMatchState(working, {
            factions: purchased.factions,
            structures: purchased.structures,
          });
          break;
        }
        case "PURCHASE_STRUCTURE_UPGRADE": {
          const purchased = tryPurchaseStructureUpgrade(working, {
            structureId: action.structureId,
            ownerId: action.ownerId,
          });
          if (!purchased.ok) {
            throw new Error(
              `accepted structure upgrade purchase became invalid: ${purchased.failure.code}`,
            );
          }
          working = createProspectiveMatchState(working, {
            factions: purchased.factions,
            structures: purchased.structures,
          });
          break;
        }
      }
    }

    return working;
  }

  advance(
    state: MatchState,
    inputs: readonly AcceptedSimulationInput[],
  ): MatchState {
    const prospective = this.applyAcceptedInputs(state, inputs);
    const earningSnapshot = createProspectiveMatchState(prospective, {
      factions: resolvePassiveFfyTick(prospective),
    });
    const land = resolveLandTick(earningSnapshot);
    const nextTick = earningSnapshot.tick + 1;
    const structures = resolvePersistentStructureLifecycleTick(
      earningSnapshot,
      land.ownership,
      nextTick,
    );
    const hostilityGrace = reconcileHostilityGrace(
      earningSnapshot.factions,
      earningSnapshot.operations,
      land.factions,
      land.operations,
      earningSnapshot.hostilityGrace,
      nextTick,
    );
    const postStructureState = createProspectiveMatchState(earningSnapshot, {
      factions: land.factions,
      ownership: land.ownership,
      fallout: land.fallout,
      structures,
      operations: land.operations,
      defensePriorities: land.defensePriorities,
      captureProgress: land.captureProgress,
      counterResponseResiduals: land.counterResponseResiduals,
      hostilityGrace,
    });
    const factoryTrains = reconcileStoredFactoryTrainDispatches(
      postStructureState,
      nextTick,
    );
    return createAdvancedMatchState(postStructureState, factoryTrains);
  }
}