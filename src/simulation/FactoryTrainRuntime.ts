import {
  ffyEventConditionAppliesAtCell,
  ffyRuleDynamicState,
  resolveEffectivePopulationCapacities,
  resolveFfyEconomicStage,
  type PositiveFfyEventInput,
} from "./Economy";
import {
  releaseFactoryRailLoopSnapshot,
  retainFactoryRailLoopSnapshot,
} from "./FactoryRailLifecycle";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  advanceMobileUnits,
  assignMobileUnitRoute,
  createMobileUnit,
} from "./MobileUnits";
import type {
  StructureCaptureResolvedEvent,
  UnitDestroyedEvent,
} from "./SimulationEvents";
import {
  TRAIN_STATION_DWELL_TICKS,
  advanceFactoryTrainServiceSchedulerTick,
  applyTrainCityPopulationGrant,
  canDispatchFactoryPrimaryTrain,
  createFactoryTrainDispatchRoutes,
  createFactoryTrainServiceEpoch,
  createTrainDispatchEconomicSnapshot,
  createTrainStationFfyEvent,
  dispatchFactoryPrimaryTrain,
  finishFactoryPrimaryTrain,
  planTrainMovementTick,
  resolveFactoryTrainEventBaseMultiplier,
  resolveTrainDestroyedEconomicOutcome,
  resolveTrainExternalWartimeMultiplier,
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

export type FactoryTrainEconomicUpdate = Readonly<Pick<MatchState, "factions">>;

type TrainServiceRuntimeEntry = MatchState["trainServices"][number];
type FactoryRailLifecycleEntry = MatchState["factoryRailLoops"][number];
type FactoryRailSnapshotEntry =
  FactoryRailLifecycleEntry["retainedSnapshots"][number];

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function factoryDispatchSchedulerActive(state: MatchState, ownerId: string): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) {
    throw new Error(`Factory Train scheduler references unknown faction ${ownerId}`);
  }
  return owner.rules.customDomains.some(
    (entry) => entry.domain === "FACTORY_DISPATCH_SCHEDULER",
  );
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

function trainInterceptionRaiderEventId(event: UnitDestroyedEvent): string {
  return JSON.stringify(["TRAIN_INTERCEPTION", event.id]);
}

function trainStationEventId(
  tick: number,
  trainId: string,
  stationCellId: number,
): string {
  return JSON.stringify(["TRAIN_STATION", tick, trainId, stationCellId]);
}

function isCurrentTickStationOccurrence(
  state: MatchState,
  resumeAtTick: number | null,
): boolean {
  return (
    resumeAtTick !== null &&
    state.tick <= Number.MAX_SAFE_INTEGER - TRAIN_STATION_DWELL_TICKS &&
    resumeAtTick === state.tick + TRAIN_STATION_DWELL_TICKS
  );
}

function retainedLoopSnapshot(
  lifecycles: readonly FactoryRailLifecycleEntry[],
  service: TrainServiceRuntimeEntry,
): FactoryRailSnapshotEntry {
  const lifecycle = lifecycles.find(
    (entry) => entry.factoryId === service.factoryId,
  );
  if (lifecycle === undefined) {
    throw new Error(
      `Train service ${service.trainId} has no Factory rail lifecycle`,
    );
  }
  const snapshot = lifecycle.retainedSnapshots.find(
    (entry) => entry.snapshotId === service.loopSnapshotId,
  );
  if (snapshot === undefined) {
    throw new Error(
      `Train service ${service.trainId} lost retained Factory loop snapshot ${service.loopSnapshotId}`,
    );
  }
  return snapshot;
}

function activeTrainStation(
  state: MatchState,
  structureId: string,
): MatchState["structures"][number] | null {
  return (
    state.structures.find(
      (structure) =>
        structure.id === structureId &&
        (structure.type === "CITY" || structure.type === "PORT") &&
        structure.active &&
        structure.completedLevel !== undefined,
    ) ?? null
  );
}

function qualifyingStationInterfaceCellIds(
  state: MatchState,
  snapshot: FactoryRailSnapshotEntry,
): readonly number[] {
  const result: number[] = [];
  const seen = new Set<number>();
  for (const stationInterface of snapshot.stationInterfaces ?? []) {
    if (
      seen.has(stationInterface.cellId) ||
      activeTrainStation(state, stationInterface.structureId) === null
    ) {
      continue;
    }
    seen.add(stationInterface.cellId);
    result.push(stationInterface.cellId);
  }
  return Object.freeze(result);
}

function activeMappedStationsAtInterface(
  state: MatchState,
  snapshot: FactoryRailSnapshotEntry,
  interfaceCellId: number,
): readonly MatchState["structures"][number][] {
  const result: MatchState["structures"][number][] = [];
  const seenStructureIds = new Set<string>();
  for (const stationInterface of snapshot.stationInterfaces ?? []) {
    if (
      stationInterface.cellId !== interfaceCellId ||
      seenStructureIds.has(stationInterface.structureId)
    ) {
      continue;
    }
    const station = activeTrainStation(state, stationInterface.structureId);
    if (station === null) continue;
    seenStructureIds.add(stationInterface.structureId);
    result.push(station);
  }
  return Object.freeze(result);
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
          factoryDispatchSchedulerActive(state, activeEpoch.ownerId),
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

export function settleFactoryTrainEconomicEvents(
  state: MatchState,
  servicesAtInterception: readonly MatchState["trainServices"][number][],
  destructionEvents: readonly UnitDestroyedEvent[],
  currentAtWar: (trainOwnerId: string, stationOwnerId: string) => boolean,
): FactoryTrainEconomicUpdate | null {
  const positiveEventsByOwnerId = new Map<string, PositiveFfyEventInput[]>();
  const survivingCityStations: MatchState["structures"][number][] = [];
  const consumedTrainIds = new Set<string>();

  for (const event of destructionEvents) {
    if (event.tick !== state.tick) {
      throw new Error("Factory Train destruction event tick must match runtime tick");
    }
    if (event.payload.unit.unitType !== "TRAIN") continue;

    const trainId = event.payload.unit.unitId;
    const service = servicesAtInterception.find((entry) => entry.trainId === trainId);
    if (service === undefined) continue;
    if (consumedTrainIds.has(trainId)) {
      throw new Error(`duplicate Factory Train destruction event: ${trainId}`);
    }
    consumedTrainIds.add(trainId);

    const pendingStationEvent = isCurrentTickStationOccurrence(
      state,
      service.resumeAtTick,
    )
      ? createTrainStationFfyEvent(service.dispatchSnapshot, {
          eventId: trainStationEventId(
            state.tick,
            service.trainId,
            event.payload.unit.cellId,
          ),
        })
      : null;
    const economicResolution = resolveTrainDestroyedEconomicOutcome(
      Object.freeze([
        Object.freeze({
          trainId: service.trainId,
          dispatchSnapshot: service.dispatchSnapshot,
        }),
      ]),
      event,
      {
        raiderEventId: trainInterceptionRaiderEventId(event),
        pendingStationEvent,
      },
    );
    if (economicResolution !== null) {
      const existing =
        positiveEventsByOwnerId.get(economicResolution.raiderOwnerId) ?? [];
      existing.push(economicResolution.economic.raiderEvent);
      positiveEventsByOwnerId.set(economicResolution.raiderOwnerId, existing);
    }
  }

  for (const service of state.trainServices
    .slice()
    .sort((left, right) => compareIds(left.trainId, right.trainId))) {
    if (!isCurrentTickStationOccurrence(state, service.resumeAtTick)) continue;
    const unit = state.mobileUnits.find((candidate) => candidate.id === service.trainId);
    if (unit === undefined || unit.type !== "TRAIN") {
      throw new Error(
        `surviving Train station occurrence lost physical Train ${service.trainId}`,
      );
    }
    const snapshot = retainedLoopSnapshot(state.factoryRailLoops, service);
    const stations = activeMappedStationsAtInterface(
      state,
      snapshot,
      unit.cellId,
    );
    if (stations.length === 0) continue;

    const ownerId = service.dispatchSnapshot.dispatchOwnerId;
    const owner = state.factions.find((faction) => faction.id === ownerId);
    if (owner === undefined) {
      throw new Error(`Train economic consequence references unknown faction ${ownerId}`);
    }

    for (const station of stations) {
      const externalWartimeMultiplier =
        station.ownerId === ownerId
          ? undefined
          : resolveTrainExternalWartimeMultiplier(
              owner.rules,
              ffyRuleDynamicState(state, ownerId),
              currentAtWar(ownerId, station.ownerId),
            );
      const event = createTrainStationFfyEvent(service.dispatchSnapshot, {
        eventId: trainStationEventId(
          state.tick,
          service.trainId,
          station.cellId,
        ),
        conditionApplies: (condition) =>
          ffyEventConditionAppliesAtCell(
            state,
            ownerId,
            station.cellId,
            condition,
          ),
        ...(externalWartimeMultiplier === undefined
          ? {}
          : { externalWartimeMultiplier }),
      });
      const existing = positiveEventsByOwnerId.get(ownerId) ?? [];
      existing.push(event);
      positiveEventsByOwnerId.set(ownerId, existing);

      if (station.type === "CITY") {
        survivingCityStations.push(station);
      }
    }
  }

  if (
    positiveEventsByOwnerId.size === 0 &&
    survivingCityStations.length === 0
  ) {
    return null;
  }

  let factions = state.factions.map((faction) => {
    const positiveEvents = positiveEventsByOwnerId.get(faction.id);
    if (positiveEvents === undefined || positiveEvents.length === 0) {
      return faction;
    }
    const resolved = resolveFfyEconomicStage({
      balance: faction.ffy,
      rules: faction.rules,
      ruleDynamicState: ffyRuleDynamicState(state, faction.id),
      positiveEvents: Object.freeze([...positiveEvents]),
      signedFacts: Object.freeze([]),
    });
    const lifetimeGrossPositiveFfyEarned =
      BigInt(faction.lifetimeGrossPositiveFfyEarned) +
      resolved.positiveEvents.reduce(
        (sum, event) => sum + BigInt(event.award),
        0n,
      );
    if (lifetimeGrossPositiveFfyEarned > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(
        "lifetime gross positive FFY earned exceeds the safe-integer range",
      );
    }
    return Object.freeze({
      ...faction,
      ffy: resolved.balance,
      lifetimeGrossPositiveFfyEarned: Number(lifetimeGrossPositiveFfyEarned),
    });
  });

  if (survivingCityStations.length > 0) {
    const capacities = resolveEffectivePopulationCapacities(state);
    for (const station of survivingCityStations) {
      const ownerIndex = factions.findIndex(
        (faction) => faction.id === station.ownerId,
      );
      if (ownerIndex < 0) {
        throw new Error(
          `Train City station ${station.id} references unknown owner ${station.ownerId}`,
        );
      }
      const owner = factions[ownerIndex]!;
      const capacity = capacities.get(owner.id);
      if (capacity === undefined) {
        throw new Error(
          `missing effective Population Capacity for Train City owner ${owner.id}`,
        );
      }
      const grant = applyTrainCityPopulationGrant(
        owner.rules,
        station,
        owner.population,
        capacity,
      );
      if (grant.population !== owner.population) {
        factions = factions.map((faction, index) =>
          index === ownerIndex
            ? Object.freeze({ ...owner, population: grant.population })
            : faction,
        );
      }
    }
  }

  return Object.freeze({ factions: Object.freeze(factions) });
}

export function prepareFactoryTrainRuntimePhase(
  state: MatchState,
  currentTick: number,
  structureEvents: readonly StructureCaptureResolvedEvent[],
): FactoryTrainRuntimeUpdate {
  const transferEvents = factoryTransferEvents(structureEvents, currentTick);
  let mobileUnits = [...state.mobileUnits];
  let nextMobileUnitOrdinal = state.nextMobileUnitOrdinal;
  let factoryRailLoops = [...state.factoryRailLoops];
  let factoryTrainEpochs = [...state.factoryTrainEpochs];
  const trainServices = [...state.trainServices];

  const ownerIds = state.factions.map((faction) => faction.id);
  const epochsByFactory = new Map(
    factoryTrainEpochs.map((epoch) => [epoch.factoryId, epoch]),
  );
  const loopsByFactory = new Map(
    factoryRailLoops.map((lifecycle) => [lifecycle.factoryId, lifecycle]),
  );

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
    const p07Active = factoryDispatchSchedulerActive(state, owner.id);

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
    const routes = createFactoryTrainDispatchRoutes(loop!.cells);
    const routed = assignMobileUnitRoute(
      state.map,
      created.unit,
      routes.primary,
    );

    mobileUnits = created.mobileUnits.map((unit) =>
      unit.id === routed.id ? routed : unit,
    );
    nextMobileUnitOrdinal = created.nextMobileUnitOrdinal;

    const retainedLifecycle = retainFactoryRailLoopSnapshot(
      lifecycle!,
      routed.id,
    );
    const factoryBaseMultiplier = resolveFactoryTrainEventBaseMultiplier(
      owner.rules,
      ffyRuleDynamicState(state, owner.id),
      factory.acquisitionPath,
    );
    const dispatchSnapshot = createTrainDispatchEconomicSnapshot(
      factory.id,
      factory.ownerId,
      factory.completedLevel!,
      factoryBaseMultiplier,
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
    factoryRailLoops = factoryRailLoops.map((entry) =>
      entry.factoryId === factory.id ? retainedLifecycle : entry,
    );
    loopsByFactory.set(factory.id, retainedLifecycle);
    factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
      entry.factoryId === factory.id ? epoch : entry,
    );
    epochsByFactory.set(factory.id, epoch);
  }

  return Object.freeze({
    mobileUnits: Object.freeze(mobileUnits),
    nextMobileUnitOrdinal,
    factoryRailLoops: Object.freeze(factoryRailLoops),
    factoryTrainEpochs: Object.freeze(factoryTrainEpochs),
    trainServices: Object.freeze(trainServices),
  });
}

export function factoryTrainMovementWorkByUnitId(
  state: MatchState,
  currentTick: number,
): Readonly<Record<string, number>> {
  const work: Record<string, number> = {};
  for (const service of state.trainServices) {
    const unit = state.mobileUnits.find((candidate) => candidate.id === service.trainId);
    if (unit === undefined) {
      throw new Error(`Train service ${service.trainId} has no physical Train`);
    }
    const snapshot = retainedLoopSnapshot(state.factoryRailLoops, service);
    const plan = planTrainMovementTick(
      unit,
      currentTick,
      service.resumeAtTick,
      qualifyingStationInterfaceCellIds(state, snapshot),
    );
    work[service.trainId] = plan.movementWork;
  }
  return Object.freeze(work);
}

export function settleFactoryTrainMovementPhase(
  stateBeforeMovement: MatchState,
  movedMobileUnits: readonly MatchState["mobileUnits"][number][],
  currentTick: number,
): FactoryTrainRuntimeUpdate {
  let mobileUnits = [...movedMobileUnits];
  let factoryRailLoops = [...stateBeforeMovement.factoryRailLoops];
  let factoryTrainEpochs = [...stateBeforeMovement.factoryTrainEpochs];
  const loopsByFactory = new Map(
    factoryRailLoops.map((lifecycle) => [lifecycle.factoryId, lifecycle]),
  );
  const epochsByFactory = new Map(
    factoryTrainEpochs.map((epoch) => [epoch.factoryId, epoch]),
  );
  const survivingTrainServices: MatchState["trainServices"][number][] = [];

  for (const service of stateBeforeMovement.trainServices
    .slice()
    .sort((left, right) => compareIds(left.trainId, right.trainId))) {
    const beforeUnit = stateBeforeMovement.mobileUnits.find(
      (candidate) => candidate.id === service.trainId,
    );
    const movedUnit = mobileUnits.find(
      (candidate) => candidate.id === service.trainId,
    );
    if (beforeUnit === undefined || movedUnit === undefined) {
      throw new Error(`Train service ${service.trainId} has no physical Train`);
    }
    const snapshot = retainedLoopSnapshot(factoryRailLoops, service);
    const plan = planTrainMovementTick(
      beforeUnit,
      currentTick,
      service.resumeAtTick,
      qualifyingStationInterfaceCellIds(stateBeforeMovement, snapshot),
    );

    if (movedUnit.route === undefined) {
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
            factoryDispatchSchedulerActive(
              stateBeforeMovement,
              activeEpoch.ownerId,
            ),
          );
          factoryTrainEpochs = factoryTrainEpochs.map((entry) =>
            entry.factoryId === service.factoryId ? finishedEpoch : entry,
          );
          epochsByFactory.set(service.factoryId, finishedEpoch);
        }
      }
      continue;
    }

    const stationEntered =
      plan.stationEntryCellId !== null &&
      movedUnit.cellId === plan.stationEntryCellId;
    survivingTrainServices.push(
      Object.freeze({
        ...service,
        resumeAtTick:
          plan.holdResumeAtTick ??
          (stationEntered
            ? currentTick + TRAIN_STATION_DWELL_TICKS
            : null),
      }),
    );
  }

  return Object.freeze({
    mobileUnits: Object.freeze(mobileUnits),
    nextMobileUnitOrdinal: stateBeforeMovement.nextMobileUnitOrdinal,
    factoryRailLoops: Object.freeze(factoryRailLoops),
    factoryTrainEpochs: Object.freeze(factoryTrainEpochs),
    trainServices: Object.freeze(survivingTrainServices),
  });
}

export function advanceFactoryTrainRuntimePhase(
  state: MatchState,
  currentTick: number,
  structureEvents: readonly StructureCaptureResolvedEvent[],
): FactoryTrainRuntimeUpdate {
  const preparedUpdate = prepareFactoryTrainRuntimePhase(
    state,
    currentTick,
    structureEvents,
  );
  const prepared = createProspectiveMatchState(state, preparedUpdate);
  const structureCells = new Set(
    prepared.structures.map((structure) => structure.cellId),
  );
  const movedMobileUnits = advanceMobileUnits(
    prepared.mobileUnits,
    factoryTrainMovementWorkByUnitId(prepared, currentTick),
    structureCells,
  );
  return settleFactoryTrainMovementPhase(
    prepared,
    movedMobileUnits,
    currentTick,
  );
}
