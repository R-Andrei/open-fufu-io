import {
  releaseFactoryRailLoopSnapshot,
  retainFactoryRailLoopSnapshot,
} from "./FactoryRailLifecycle";
import type { MatchState } from "./MatchState";
import {
  assignMobileUnitRoute,
  createMobileUnit,
} from "./MobileUnits";
import type {
  StructureCaptureResolvedEvent,
  UnitDestroyedEvent,
} from "./SimulationEvents";
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

export type FactoryTrainRuntimeUpdate = Readonly<
  Pick<
    MatchState,
    | "mobileUnits"
    | "nextMobileUnitOrdinal"
    | "factoryRailLoops"
    | "factoryTrainEpochs"
    | "trainServices"
  >
>;

export type FactoryTrainDestructionLifecycleUpdate = Readonly<
  Pick<
    MatchState,
    "factoryRailLoops" | "factoryTrainEpochs" | "trainServices"
  >
>;

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function factoryTransferEvents(
  events: readonly StructureCaptureResolvedEvent[],
  currentTick: number,
): ReadonlyMap<string, StructureCaptureResolvedEvent> {
  const result = new Map<string, StructureCaptureResolvedEvent>();
  for (const event of events) {
    if (event.tick !== currentTick) {
      throw new Error("Factory Train structure event tick must match runtime tick");
    }
    if (
      event.payload.structure.structureType !== "FACTORY" ||
      event.payload.result !== "STRUCTURE_TRANSFERRED"
    ) {
      continue;
    }
    const factoryId = event.payload.structure.structureId;
    if (result.has(factoryId)) {
      throw new Error(`duplicate Factory transfer event: ${factoryId}`);
    }
    result.set(factoryId, event);
  }
  return result;
}

export function applyFactoryTrainDestructionLifecycleEvents(
  state: MatchState,
  destructionEvents: readonly UnitDestroyedEvent[],
): FactoryTrainDestructionLifecycleUpdate | null {
  let factoryRailLoops = [...state.factoryRailLoops];
  let factoryTrainEpochs = [...state.factoryTrainEpochs];
  let trainServices = [...state.trainServices];
  const loopsByFactory = new Map(
    factoryRailLoops.map((lifecycle) => [lifecycle.factoryId, lifecycle]),
  );
  const epochsByFactory = new Map(
    factoryTrainEpochs.map((epoch) => [epoch.factoryId, epoch]),
  );
  const consumedTrainIds = new Set<string>();

  for (const event of destructionEvents) {
    if (event.tick !== state.tick) {
      throw new Error("Factory Train destruction event tick must match runtime tick");
    }
    if (event.payload.unit.unitType !== "TRAIN") continue;

    const trainId = event.payload.unit.unitId;
    const service = trainServices.find((entry) => entry.trainId === trainId);
    if (service === undefined) continue;
    if (consumedTrainIds.has(trainId)) {
      throw new Error(`duplicate Factory Train destruction event: ${trainId}`);
    }
    consumedTrainIds.add(trainId);

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
      const activeEpoch = epochsByFactory.get(service.factoryId);
      if (activeEpoch?.activePrimaryTrainId === service.trainId) {
        const finishedEpoch = finishFactoryPrimaryTrain(
          activeEpoch,
          service.trainId,
        );
        factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
          entry.factoryId === service.factoryId ? finishedEpoch : entry,
        );
        epochsByFactory.set(service.factoryId, finishedEpoch);
      }
    }

    trainServices = trainServices.filter((entry) => entry.trainId !== trainId);
  }

  if (consumedTrainIds.size === 0) return null;
  return Object.freeze({
    factoryRailLoops: Object.freeze(factoryRailLoops),
    factoryTrainEpochs: Object.freeze(factoryTrainEpochs),
    trainServices: Object.freeze(trainServices),
  });
}

export function advanceFactoryTrainRuntimePhase(
  state: MatchState,
  currentTick: number,
  structureEvents: readonly StructureCaptureResolvedEvent[],
): FactoryTrainRuntimeUpdate {
  const transferEvents = factoryTransferEvents(structureEvents, currentTick);
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
    const transferEvent = transferEvents.get(factory.id);
    if (epoch === undefined) {
      epoch = createFactoryTrainServiceEpoch(factory.id, factory.ownerId);
      factoryTrainEpochs.push(epoch);
      epochsByFactory.set(factory.id, epoch);
    } else if (transferEvent !== undefined) {
      const subject = transferEvent.payload.structure;
      if (
        subject.previousOwnerId !== epoch.ownerId ||
        subject.capturingFactionId !== factory.ownerId
      ) {
        throw new Error(
          `Factory ${factory.id} transfer event does not match Train service epoch transition`,
        );
      }
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
      if (epoch.ownerId !== factory.ownerId) {
        throw new Error(
          `Factory ${factory.id} owner changed without a canonical transfer event`,
        );
      }
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
    const bonusDispatchActive = owner.rules.customDomains.some(
      (entry) => entry.domain === "FACTORY_DISPATCH_SCHEDULER",
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
      bonusDispatchActive,
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
        const activeEpoch = epochsByFactory.get(service.factoryId);
        if (activeEpoch?.activePrimaryTrainId === service.trainId) {
          const finishedEpoch = finishFactoryPrimaryTrain(
            activeEpoch,
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

  return Object.freeze({
    mobileUnits: Object.freeze(mobileUnits),
    nextMobileUnitOrdinal,
    factoryRailLoops: Object.freeze(factoryRailLoops),
    factoryTrainEpochs: Object.freeze(factoryTrainEpochs),
    trainServices: Object.freeze(survivingTrainServices),
  });
}
