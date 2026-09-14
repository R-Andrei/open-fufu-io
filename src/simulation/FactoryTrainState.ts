import { reducedRational } from "../core/rules/RuleComposition";
import type { FactoryRailLoopLifecycleState } from "./FactoryRailLifecycle";
import type { MobileUnitState } from "./MobileUnits";
import type { FactoryRailLoopPlan } from "./RailNetwork";
import type { SimulationMap } from "./SimulationMap";
import type {
  FactoryTrainServiceEpochState,
  TrainDispatchEconomicSnapshot,
} from "./TrainService";

export interface TrainServiceRuntimeState {
  readonly trainId: string;
  readonly factoryId: string;
  readonly loopSnapshotId: string;
  readonly isPrimary: boolean;
  readonly dispatchSnapshot: TrainDispatchEconomicSnapshot;
  readonly resumeAtTick: number | null;
}

export interface FactoryTrainState {
  readonly factoryRailLoops: readonly FactoryRailLoopLifecycleState[];
  readonly factoryTrainEpochs: readonly FactoryTrainServiceEpochState[];
  readonly trainServices: readonly TrainServiceRuntimeState[];
}

export interface FactoryTrainStateUpdate {
  readonly factoryRailLoops?: readonly FactoryRailLoopLifecycleState[];
  readonly factoryTrainEpochs?: readonly FactoryTrainServiceEpochState[];
  readonly trainServices?: readonly TrainServiceRuntimeState[];
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

export function materializeFactoryTrainState(
  previous: FactoryTrainState | undefined,
  update: FactoryTrainStateUpdate,
  mobileUnits: readonly MobileUnitState[],
  map: SimulationMap,
): FactoryTrainState {
  const factoryRailLoops = freezeFactoryRailLoops(
    update.factoryRailLoops ?? previous?.factoryRailLoops ?? [],
    map,
  );
  const factoryTrainEpochs = freezeFactoryTrainEpochs(
    update.factoryTrainEpochs ?? previous?.factoryTrainEpochs ?? [],
  );
  const trainServices = freezeTrainServices(
    update.trainServices ?? previous?.trainServices ?? [],
    mobileUnits,
    factoryRailLoops,
  );
  return Object.freeze({
    factoryRailLoops,
    factoryTrainEpochs,
    trainServices,
  });
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

export function serializeFactoryTrainState(state: FactoryTrainState): FactoryTrainState {
  return {
    factoryRailLoops: state.factoryRailLoops.map((entry) => ({
      factoryId: entry.factoryId,
      currentLoop: serializeFactoryLoopPlan(entry.currentLoop),
      pendingLoop: serializeFactoryLoopPlan(entry.pendingLoop),
      retainedSnapshots: entry.retainedSnapshots.map((snapshot) => ({
        snapshotId: snapshot.snapshotId,
        cells: [...snapshot.cells],
      })),
    })) as unknown as FactoryTrainState["factoryRailLoops"],
    factoryTrainEpochs: state.factoryTrainEpochs.map((entry) => ({
      factoryId: entry.factoryId,
      ownerId: entry.ownerId,
      activePrimaryTrainId: entry.activePrimaryTrainId,
      turnaroundRemainingActiveTicks: entry.turnaroundRemainingActiveTicks,
      p07PrimaryDispatchPhase: entry.p07PrimaryDispatchPhase,
    })),
    trainServices: state.trainServices.map((entry) => ({
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
    })) as unknown as FactoryTrainState["trainServices"],
  };
}
