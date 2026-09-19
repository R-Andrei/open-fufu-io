import type {
  DirectiveChanges,
  StructureType,
} from "../core/controller/ControllerApi";
import { resolvePassiveFfyTick } from "./Economy";
import { advanceHomingCombatProjectiles } from "./CombatProjectiles";
import {
  applyFactoryTrainDestructionLifecycleEvents,
  factoryTrainMovementWorkByUnitId,
  prepareFactoryTrainRuntimePhase,
  settleFactoryTrainEconomicEvents,
  settleFactoryTrainMovementPhase,
} from "./FactoryTrainRuntime";
import {
  matchStateAtWar,
  resolveHostilityGraceFromEvents,
} from "./HostilityState";
import {
  resolveLandTick,
  tryApplyPersistentDirectiveChangesWithEvents,
  type LandOperationPressureResolvedEvent,
} from "./LandOperations";
import {
  createAdvancedMatchState,
  createProspectiveMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";
import {
  advanceMobileUnits,
  assignMobileUnitRoute,
  setMobileUnitStrategicDestination,
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
  createFactionCapitulatedEvent,
  type CellOwnershipChangedEvent,
  type HostilityLifecycleSimulationEvent,
  type PersistentDirectedHostilitySourceEndedEvent,
  type UnitDestroyedEvent,
} from "./SimulationEvents";
import {
  resolvePersistentStructureLifecycleTickWithEvents,
  tryPurchaseStructureBuild,
  tryPurchaseStructureUpgrade,
} from "./Structures";
import {
  resolveAdmittedTankPopulationAttacks,
  resolveAdmittedTankUnitAttackEffects,
  resolveTankPopulationAftershocks,
  type AdmittedTankUnitAttack,
} from "./TankCombat";
import {
  advanceTankRepairIntentPhase,
  advanceTankRepairPhase,
  settleTankRepairMovementPhase,
  tankFastServiceUnitIds,
} from "./TankRepair";
import {
  planTankPursuitRoute,
  selectTankAutonomousUnitTarget,
  type TankAutonomousUnitTargetSelection,
} from "./TankTargeting";
import {
  advanceTankProductionPhase,
  tankCellTraversalTiming,
  tankNavigationRoute,
  tankOperatingLeashContains,
  tankStrategicNavigationRoute,
  type AdmittedTankPopulationShot,
} from "./Tanks";
import { applyRadioactiveAttackAftershockEvents } from "./TerritoryEffects";
import {
  projectTankTargetObservation,
  resolveDirectRevealsFromLandOperationEvents,
  resolveDirectRevealsFromPhysicalEvents,
  resolveDirectRevealsFromTankCombatEvents,
} from "./VisibilityState";
import {
  prepareTradeShipRuntimePhase,
  settleTradeShipRuntimePhase,
  settleTradeShipSignedFactsPhase,
  tradeShipMovementWorkByUnitId,
} from "./TradeShips";
import {
  resolveWarshipGunfireDecisions,
  resolveWarshipNavalProjectileImpacts,
  WARSHIP_NAVAL_GUN_PROFILE_ID,
} from "./WarshipCombat";
import {
  advanceWarshipProductionPhase,
  warshipStrategicNavigationRoute,
} from "./Warships";

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

type TankRetainedTarget = NonNullable<
  MatchState["tankOperationalStates"][number]["retainedTarget"]
>;

interface TankMovementPreparation {
  readonly state: MatchState;
  readonly movementWorkByUnitId: Readonly<Record<string, number>>;
  readonly strategicMoverIds: ReadonlySet<string>;
}

interface WarshipMovementPreparation {
  readonly state: MatchState;
  readonly movementWorkByUnitId: Readonly<Record<string, number>>;
  readonly strategicMoverIds: ReadonlySet<string>;
}

const TANK_ROAMING_LEASH_CELLS = 100;

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

function factionCapitulationEventId(
  tick: number,
  sequence: number,
  factionId: string,
): string {
  return `faction:capitulated:${tick}:${sequence}:${JSON.stringify(factionId)}`;
}

function sameTankTarget(
  left: TankRetainedTarget | undefined,
  right: TankAutonomousUnitTargetSelection | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.targetClass !== right.targetClass) return false;
  if (left.targetClass === "POPULATION") {
    return right.targetClass === "POPULATION" && left.cellId === right.cellId;
  }
  return right.targetClass !== "POPULATION" && left.unitId === right.unitId;
}

function advanceTankTargetAcquisitionPhase(state: MatchState): MatchState {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const fastServiceUnitIds = tankFastServiceUnitIds(state);
  const observationByOwner = new Map<
    string,
    ReturnType<typeof projectTankTargetObservation>
  >();
  let changed = false;
  const tankOperationalStates = state.tankOperationalStates.map((operational) => {
    if (
      operational.eligibleFromTick > state.tick ||
      fastServiceUnitIds.has(operational.unitId)
    ) {
      return operational;
    }
    const unit = unitsById.get(operational.unitId);
    if (
      unit === undefined ||
      (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
    ) {
      return operational;
    }
    let observation = observationByOwner.get(unit.ownerId);
    if (observation === undefined) {
      observation = projectTankTargetObservation(state, unit.ownerId);
      observationByOwner.set(unit.ownerId, observation);
    }
    const selectTarget = (
      observedUnitIds: readonly string[],
      observedCellIds: readonly number[],
    ) =>
      selectTankAutonomousUnitTarget(state, {
        ownerId: unit.ownerId,
        chassisType: unit.type,
        currentCellId: unit.cellId,
        operatingAnchorCellId: operational.operatingAnchorCellId,
        strategicDestinationCellId: unit.strategicDestinationCellId,
        observedUnitIds,
        observedCellIds,
      });

    const retainedTarget = operational.retainedTarget;
    if (retainedTarget !== undefined) {
      const retainedObservedUnitIds =
        retainedTarget.targetClass !== "POPULATION" &&
        observation.observedUnitIds.includes(retainedTarget.unitId)
          ? Object.freeze([retainedTarget.unitId])
          : Object.freeze([] as string[]);
      const retainedObservedCellIds =
        retainedTarget.targetClass === "POPULATION" &&
        observation.observedCellIds.includes(retainedTarget.cellId)
          ? Object.freeze([retainedTarget.cellId])
          : Object.freeze([] as number[]);
      if (
        sameTankTarget(
          retainedTarget,
          selectTarget(retainedObservedUnitIds, retainedObservedCellIds),
        )
      ) {
        return operational;
      }
    }

    const target = selectTarget(
      observation.observedUnitIds,
      observation.observedCellIds,
    );
    if (target === undefined) {
      if (retainedTarget === undefined) return operational;
      const { retainedTarget: _staleTarget, ...withoutRetainedTarget } = operational;
      changed = true;
      return Object.freeze(withoutRetainedTarget);
    }
    changed = true;
    return Object.freeze({ ...operational, retainedTarget: target });
  });

  return changed
    ? createProspectiveMatchState(state, {
        tankOperationalStates: Object.freeze(tankOperationalStates),
      })
    : state;
}

function routeMatchesStrategicPlan(
  unit: MatchState["mobileUnits"][number],
  plan: Readonly<{
    cells: readonly number[];
    edgeWeights: readonly number[];
  }>,
): boolean {
  const route = unit.route;
  if (route === undefined) return false;
  const routeStartIndex = route.nextCellIndex - 1;
  if (route.cells.length - routeStartIndex !== plan.cells.length) return false;
  if (route.edgeWeights.length - routeStartIndex !== plan.edgeWeights.length) {
    return false;
  }
  for (let index = 0; index < plan.cells.length; index += 1) {
    if (route.cells[routeStartIndex + index] !== plan.cells[index]) return false;
  }
  for (let index = 0; index < plan.edgeWeights.length; index += 1) {
    if (route.edgeWeights[routeStartIndex + index] !== plan.edgeWeights[index]) {
      return false;
    }
  }
  return true;
}

function tankRoamingHash(unitId: string, roamingOrdinal: number): number {
  let hash = 0x811c9dc5;
  const key = `${unitId}\u0000${roamingOrdinal}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tankRouteInsideOperatingLeash(
  state: MatchState,
  operatingAnchorCellId: number,
  cells: readonly number[],
): boolean {
  return cells.every((cellId) =>
    tankOperatingLeashContains(state.map, operatingAnchorCellId, cellId),
  );
}

function tankRoamingCandidates(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
  operatingAnchorCellId: number,
): readonly number[] {
  if (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY") {
    return Object.freeze([]);
  }
  const anchor = state.map.positionOf(operatingAnchorCellId);
  const minX = Math.max(0, anchor.x - TANK_ROAMING_LEASH_CELLS);
  const maxX = Math.min(state.map.width - 1, anchor.x + TANK_ROAMING_LEASH_CELLS);
  const minY = Math.max(0, anchor.y - TANK_ROAMING_LEASH_CELLS);
  const maxY = Math.min(state.map.height - 1, anchor.y + TANK_ROAMING_LEASH_CELLS);
  const candidates: number[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cellId = state.map.cellIdAt(x, y);
      if (
        cellId === undefined ||
        cellId === unit.cellId ||
        !tankOperatingLeashContains(state.map, operatingAnchorCellId, cellId) ||
        tankCellTraversalTiming(state, unit.ownerId, unit.type, cellId) === undefined
      ) {
        continue;
      }
      candidates.push(cellId);
    }
  }
  return Object.freeze(candidates);
}

function tankRoamingPlan(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
  operatingAnchorCellId: number,
  roamingOrdinal: number,
) {
  if (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY") {
    return undefined;
  }
  const candidates = tankRoamingCandidates(state, unit, operatingAnchorCellId);
  if (candidates.length === 0) return undefined;
  const startIndex = tankRoamingHash(unit.id, roamingOrdinal) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const destinationCellId = candidates[(startIndex + offset) % candidates.length]!;
    const route = tankNavigationRoute(
      state,
      unit.ownerId,
      unit.type,
      unit.cellId,
      destinationCellId,
    );
    if (
      route.status === "FOUND" &&
      route.route.cells.length > 1 &&
      tankRouteInsideOperatingLeash(
        state,
        operatingAnchorCellId,
        route.route.cells,
      )
    ) {
      return route.route;
    }
  }
  return undefined;
}

function prepareTankMovementPhase(
  state: MatchState,
  stateBeforeTargeting: MatchState,
): TankMovementPreparation {
  const operationalById = new Map(
    state.tankOperationalStates.map((operational) => [operational.unitId, operational]),
  );
  const previousOperationalById = new Map(
    stateBeforeTargeting.tankOperationalStates.map((operational) => [
      operational.unitId,
      operational,
    ]),
  );
  const unitUpdates = new Map<string, MatchState["mobileUnits"][number]>();
  const operationalUpdates = new Map<
    string,
    MatchState["tankOperationalStates"][number]
  >();
  const movementWorkByUnitId: Record<string, number> = {};
  const strategicMoverIds = new Set<string>();

  for (const unit of state.mobileUnits) {
    const operational = operationalById.get(unit.id);
    if (
      operational === undefined ||
      operational.eligibleFromTick > state.tick ||
      (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
    ) {
      continue;
    }

    let prepared = unit;
    const previousTarget = previousOperationalById.get(unit.id)?.retainedTarget;

    if (operational.repairFactoryId !== undefined) {
      if (
        operational.repairArrivalTick === undefined &&
        prepared.route !== undefined
      ) {
        const timing = tankNavigationRoute(
          state,
          prepared.ownerId,
          prepared.type,
          prepared.cellId,
          prepared.cellId,
        );
        if (timing.status === "FOUND") {
          movementWorkByUnitId[prepared.id] = timing.route.movementWorkPerTick;
        }
      }
      continue;
    }

    const target = operational.retainedTarget;
    if (target !== undefined) {
      const plan = planTankPursuitRoute(
        state,
        {
          ownerId: prepared.ownerId,
          chassisType: prepared.type,
          currentCellId: prepared.cellId,
          operatingAnchorCellId: operational.operatingAnchorCellId,
          strategicDestinationCellId: prepared.strategicDestinationCellId,
        },
        target,
      );
      if (plan === undefined) continue;

      if (plan.cells.length === 1) {
        if (prepared.route !== undefined) {
          prepared = assignMobileUnitRoute(state.map, prepared, {
            cells: [prepared.cellId],
            edgeWeights: [],
          });
        }
      } else {
        if (
          !sameTankTarget(previousTarget, target) ||
          prepared.route === undefined ||
          prepared.route.destinationCellId !== plan.destinationCellId
        ) {
          prepared = assignMobileUnitRoute(state.map, prepared, {
            cells: plan.cells,
            edgeWeights: plan.edgeWeights,
          });
        }
        movementWorkByUnitId[prepared.id] = plan.movementWorkPerTick;
      }
      if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
      continue;
    }

    if (previousTarget !== undefined && prepared.route !== undefined) {
      prepared = assignMobileUnitRoute(state.map, prepared, {
        cells: [prepared.cellId],
        edgeWeights: [],
      });
    }

    const destinationCellId = prepared.strategicDestinationCellId;
    if (destinationCellId !== undefined) {
      const plan = tankStrategicNavigationRoute(
        state,
        prepared.ownerId,
        prepared.type,
        prepared.cellId,
        destinationCellId,
      );
      if (plan.status === "LIMIT_REACHED") {
        if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
        continue;
      }

      if (plan.route.cells.length === 1) {
        if (prepared.route !== undefined) {
          prepared = assignMobileUnitRoute(state.map, prepared, {
            cells: [prepared.cellId],
            edgeWeights: [],
          });
        }
      } else if (!routeMatchesStrategicPlan(prepared, plan.route)) {
        prepared = assignMobileUnitRoute(state.map, prepared, {
          cells: plan.route.cells,
          edgeWeights: plan.route.edgeWeights,
        });
      }
      movementWorkByUnitId[prepared.id] = plan.route.movementWorkPerTick;
      strategicMoverIds.add(prepared.id);
      if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
      continue;
    }

    const movementTiming = tankNavigationRoute(
      state,
      prepared.ownerId,
      prepared.type,
      prepared.cellId,
      prepared.cellId,
    );
    if (movementTiming.status !== "FOUND") {
      if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
      continue;
    }

    if (
      !tankOperatingLeashContains(
        state.map,
        operational.operatingAnchorCellId,
        prepared.cellId,
      )
    ) {
      const returnRoute = tankNavigationRoute(
        state,
        prepared.ownerId,
        prepared.type,
        prepared.cellId,
        operational.operatingAnchorCellId,
      );
      if (returnRoute.status === "FOUND") {
        if (!routeMatchesStrategicPlan(prepared, returnRoute.route)) {
          prepared = assignMobileUnitRoute(state.map, prepared, {
            cells: returnRoute.route.cells,
            edgeWeights: returnRoute.route.edgeWeights,
          });
        }
        movementWorkByUnitId[prepared.id] = returnRoute.route.movementWorkPerTick;
      }
      if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
      continue;
    }

    if (
      prepared.route !== undefined &&
      tankRouteInsideOperatingLeash(
        state,
        operational.operatingAnchorCellId,
        prepared.route.cells.slice(prepared.route.nextCellIndex - 1),
      )
    ) {
      movementWorkByUnitId[prepared.id] = movementTiming.route.movementWorkPerTick;
      if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
      continue;
    }

    const roamingOrdinal = operational.roamingOrdinal ?? 0;
    if (roamingOrdinal >= Number.MAX_SAFE_INTEGER) {
      throw new Error("Tank roaming ordinal is exhausted");
    }
    const plan = tankRoamingPlan(
      state,
      prepared,
      operational.operatingAnchorCellId,
      roamingOrdinal,
    );
    if (plan === undefined) {
      if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
      continue;
    }
    prepared = assignMobileUnitRoute(state.map, prepared, {
      cells: plan.cells,
      edgeWeights: plan.edgeWeights,
    });
    movementWorkByUnitId[prepared.id] = plan.movementWorkPerTick;
    unitUpdates.set(prepared.id, prepared);
    operationalUpdates.set(
      prepared.id,
      Object.freeze({
        ...operational,
        roamingOrdinal: roamingOrdinal + 1,
      }),
    );
  }

  const preparedState =
    unitUpdates.size === 0 && operationalUpdates.size === 0
      ? state
      : createProspectiveMatchState(state, {
          mobileUnits: state.mobileUnits.map(
            (unit) => unitUpdates.get(unit.id) ?? unit,
          ),
          tankOperationalStates: state.tankOperationalStates.map(
            (operational) =>
              operationalUpdates.get(operational.unitId) ?? operational,
          ),
        });

  return Object.freeze({
    state: preparedState,
    movementWorkByUnitId: Object.freeze(movementWorkByUnitId),
    strategicMoverIds,
  });
}

function prepareWarshipMovementPhase(
  state: MatchState,
): WarshipMovementPreparation {
  const operationalUnitIds = new Set(
    state.warshipOperationalStates.map((operational) => operational.unitId),
  );
  const unitUpdates = new Map<string, MatchState["mobileUnits"][number]>();
  const movementWorkByUnitId: Record<string, number> = {};
  const strategicMoverIds = new Set<string>();

  for (const unit of state.mobileUnits) {
    if (unit.type !== "WARSHIP" || !operationalUnitIds.has(unit.id)) {
      continue;
    }
    const destinationCellId = unit.strategicDestinationCellId;
    if (destinationCellId === undefined) continue;

    const plan = warshipStrategicNavigationRoute(
      state,
      unit.ownerId,
      unit.cellId,
      destinationCellId,
    );
    if (plan.status === "LIMIT_REACHED") continue;

    let prepared = unit;
    if (plan.route.cells.length === 1) {
      if (prepared.route !== undefined) {
        prepared = assignMobileUnitRoute(state.map, prepared, {
          cells: [prepared.cellId],
          edgeWeights: [],
        });
      }
    } else if (!routeMatchesStrategicPlan(prepared, plan.route)) {
      prepared = assignMobileUnitRoute(state.map, prepared, {
        cells: plan.route.cells,
        edgeWeights: plan.route.edgeWeights,
      });
    }

    movementWorkByUnitId[prepared.id] = plan.route.movementWorkPerTick;
    strategicMoverIds.add(prepared.id);
    if (prepared !== unit) unitUpdates.set(prepared.id, prepared);
  }

  return Object.freeze({
    state:
      unitUpdates.size === 0
        ? state
        : createProspectiveMatchState(state, {
            mobileUnits: state.mobileUnits.map(
              (unit) => unitUpdates.get(unit.id) ?? unit,
            ),
          }),
    movementWorkByUnitId: Object.freeze(movementWorkByUnitId),
    strategicMoverIds,
  });
}

function settleTankStrategicMovementPhase(
  stateBeforeMovement: MatchState,
  stateAfterMovement: MatchState,
  strategicMoverIds: ReadonlySet<string>,
): MatchState {
  if (strategicMoverIds.size === 0) return stateAfterMovement;
  const beforeUnitsById = new Map(
    stateBeforeMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const afterUnitsById = new Map(
    stateAfterMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const operationalById = new Map(
    stateAfterMovement.tankOperationalStates.map((operational) => [
      operational.unitId,
      operational,
    ]),
  );
  const unitUpdates = new Map<string, MatchState["mobileUnits"][number]>();
  const operationalUpdates = new Map<
    string,
    MatchState["tankOperationalStates"][number]
  >();

  for (const unitId of strategicMoverIds) {
    const before = beforeUnitsById.get(unitId);
    const after = afterUnitsById.get(unitId);
    const destinationCellId = before?.strategicDestinationCellId;
    if (
      before === undefined ||
      after === undefined ||
      destinationCellId === undefined ||
      after.cellId !== destinationCellId
    ) {
      continue;
    }
    unitUpdates.set(
      unitId,
      setMobileUnitStrategicDestination(
        stateAfterMovement.map,
        after,
        undefined,
      ),
    );
    const operational = operationalById.get(unitId);
    if (
      operational !== undefined &&
      operational.operatingAnchorCellId !== destinationCellId
    ) {
      operationalUpdates.set(
        unitId,
        Object.freeze({
          ...operational,
          operatingAnchorCellId: destinationCellId,
        }),
      );
    }
  }

  if (unitUpdates.size === 0 && operationalUpdates.size === 0) {
    return stateAfterMovement;
  }
  return createProspectiveMatchState(stateAfterMovement, {
    mobileUnits: stateAfterMovement.mobileUnits.map(
      (unit) => unitUpdates.get(unit.id) ?? unit,
    ),
    tankOperationalStates: stateAfterMovement.tankOperationalStates.map(
      (operational) =>
        operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}

function settleWarshipStrategicMovementPhase(
  stateBeforeMovement: MatchState,
  stateAfterMovement: MatchState,
  strategicMoverIds: ReadonlySet<string>,
): MatchState {
  if (strategicMoverIds.size === 0) return stateAfterMovement;
  const beforeUnitsById = new Map(
    stateBeforeMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const afterUnitsById = new Map(
    stateAfterMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const operationalById = new Map(
    stateAfterMovement.warshipOperationalStates.map((operational) => [
      operational.unitId,
      operational,
    ]),
  );
  const unitUpdates = new Map<string, MatchState["mobileUnits"][number]>();
  const operationalUpdates = new Map<
    string,
    MatchState["warshipOperationalStates"][number]
  >();

  for (const unitId of strategicMoverIds) {
    const before = beforeUnitsById.get(unitId);
    const after = afterUnitsById.get(unitId);
    const destinationCellId = before?.strategicDestinationCellId;
    if (
      before === undefined ||
      after === undefined ||
      destinationCellId === undefined ||
      after.cellId !== destinationCellId
    ) {
      continue;
    }
    unitUpdates.set(
      unitId,
      setMobileUnitStrategicDestination(
        stateAfterMovement.map,
        after,
        undefined,
      ),
    );
    const operational = operationalById.get(unitId);
    if (
      operational !== undefined &&
      operational.operatingAnchorCellId !== destinationCellId
    ) {
      operationalUpdates.set(
        unitId,
        Object.freeze({
          ...operational,
          operatingAnchorCellId: destinationCellId,
        }),
      );
    }
  }

  if (unitUpdates.size === 0 && operationalUpdates.size === 0) {
    return stateAfterMovement;
  }
  return createProspectiveMatchState(stateAfterMovement, {
    mobileUnits: stateAfterMovement.mobileUnits.map(
      (unit) => unitUpdates.get(unit.id) ?? unit,
    ),
    warshipOperationalStates: stateAfterMovement.warshipOperationalStates.map(
      (operational) =>
        operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}

function tankAttackCooldownTicks(
  unitType: "TANK" | "HEAVY_ARTILLERY",
  targetClass: TankRetainedTarget["targetClass"],
): number {
  if (unitType === "HEAVY_ARTILLERY") return 120;
  return targetClass === "POPULATION" ? 30 : 10;
}

function advanceTankUnitCombatPhase(state: MatchState) {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const fastServiceUnitIds = tankFastServiceUnitIds(state);
  const observationByOwner = new Map<
    string,
    ReturnType<typeof projectTankTargetObservation>
  >();
  const unitAttacks: AdmittedTankUnitAttack[] = [];
  const populationShots: AdmittedTankPopulationShot[] = [];
  const cooldownTicksByUnitId = new Map<string, number>();

  for (const operational of state.tankOperationalStates) {
    const retainedTarget = operational.retainedTarget;
    if (
      operational.eligibleFromTick > state.tick ||
      fastServiceUnitIds.has(operational.unitId) ||
      operational.attackReadyAtTick > state.tick ||
      retainedTarget === undefined
    ) {
      continue;
    }
    const unit = unitsById.get(operational.unitId);
    if (
      unit === undefined ||
      (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
    ) {
      continue;
    }

    let observation = observationByOwner.get(unit.ownerId);
    if (observation === undefined) {
      observation = projectTankTargetObservation(state, unit.ownerId);
      observationByOwner.set(unit.ownerId, observation);
    }

    if (retainedTarget.targetClass === "POPULATION") {
      if (!observation.observedCellIds.includes(retainedTarget.cellId)) continue;
      const stillLegal = selectTankAutonomousUnitTarget(state, {
        ownerId: unit.ownerId,
        chassisType: unit.type,
        currentCellId: unit.cellId,
        operatingAnchorCellId: operational.operatingAnchorCellId,
        strategicDestinationCellId: unit.strategicDestinationCellId,
        observedUnitIds: Object.freeze([]),
        observedCellIds: Object.freeze([retainedTarget.cellId]),
      });
      if (!sameTankTarget(retainedTarget, stillLegal)) continue;

      const plan = planTankPursuitRoute(
        state,
        {
          ownerId: unit.ownerId,
          chassisType: unit.type,
          currentCellId: unit.cellId,
          operatingAnchorCellId: operational.operatingAnchorCellId,
          strategicDestinationCellId: unit.strategicDestinationCellId,
        },
        retainedTarget,
      );
      if (
        plan === undefined ||
        plan.cells.length !== 1 ||
        plan.destinationCellId !== unit.cellId
      ) {
        continue;
      }
      const targetFactionId = state.ownership[retainedTarget.cellId] ?? null;
      if (targetFactionId === null) continue;
      populationShots.push(
        Object.freeze({
          attackerOwnerId: unit.ownerId,
          chassisType: unit.type,
          targetFactionId,
          attackerUnitId: unit.id,
          targetCellId: retainedTarget.cellId,
        }),
      );
      cooldownTicksByUnitId.set(
        unit.id,
        tankAttackCooldownTicks(unit.type, retainedTarget.targetClass),
      );
      continue;
    }

    if (
      retainedTarget.targetClass !== "TANK_CHASSIS" &&
      retainedTarget.targetClass !== "TRAIN"
    ) {
      continue;
    }
    const target = unitsById.get(retainedTarget.unitId);
    if (target === undefined) continue;
    if (
      retainedTarget.targetClass === "TANK_CHASSIS"
        ? target.type !== "TANK" && target.type !== "HEAVY_ARTILLERY"
        : unit.type !== "TANK" || target.type !== "TRAIN"
    ) {
      continue;
    }
    if (!observation.observedUnitIds.includes(target.id)) continue;

    const plan = planTankPursuitRoute(
      state,
      {
        ownerId: unit.ownerId,
        chassisType: unit.type,
        currentCellId: unit.cellId,
        operatingAnchorCellId: operational.operatingAnchorCellId,
        strategicDestinationCellId: unit.strategicDestinationCellId,
      },
      retainedTarget,
    );
    if (
      plan === undefined ||
      plan.cells.length !== 1 ||
      plan.destinationCellId !== unit.cellId
    ) {
      continue;
    }

    unitAttacks.push(
      Object.freeze({
        attackerUnitId: unit.id,
        targetUnitId: target.id,
      }),
    );
    cooldownTicksByUnitId.set(
      unit.id,
      tankAttackCooldownTicks(unit.type, retainedTarget.targetClass),
    );
  }

  const preCombat =
    cooldownTicksByUnitId.size === 0
      ? state
      : createProspectiveMatchState(state, {
          tankOperationalStates: state.tankOperationalStates.map((operational) => {
            const cooldownTicks = cooldownTicksByUnitId.get(operational.unitId);
            if (cooldownTicks === undefined) return operational;
            const unit = unitsById.get(operational.unitId);
            if (
              unit === undefined ||
              (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
            ) {
              throw new Error(
                `Tank combat cooldown update lost firing unit ${operational.unitId}`,
              );
            }
            return Object.freeze({
              ...operational,
              attackReadyAtTick: state.tick + cooldownTicks,
            });
          }),
        });

  const populationCombat = resolveAdmittedTankPopulationAttacks(
    preCombat,
    populationShots,
  );
  const aftershocks = resolveTankPopulationAftershocks(
    preCombat,
    populationCombat.successfulShots,
  );
  const physicalCombat = resolveAdmittedTankUnitAttackEffects(
    preCombat,
    unitAttacks,
  );
  const destructionEvents = physicalCombat.events.filter(
    (event): event is UnitDestroyedEvent => event.kind === "UNIT_DESTROYED",
  );
  const servicesAtInterception = preCombat.trainServices;
  const trainDestructionUpdate = applyFactoryTrainDestructionLifecycleEvents(
    preCombat,
    destructionEvents,
  );
  const physicalState =
    physicalCombat.update === null && trainDestructionUpdate === null
      ? preCombat
      : createProspectiveMatchState(preCombat, {
          ...(physicalCombat.update ?? {}),
          ...(trainDestructionUpdate ?? {}),
        });
  const targetPopulationByFactionId = new Map(
    populationCombat.targets.map((target) => [
      target.targetFactionId,
      target.targetPopulation,
    ]),
  );
  const populationApplied =
    targetPopulationByFactionId.size === 0
      ? physicalState
      : createProspectiveMatchState(physicalState, {
          factions: physicalState.factions.map((faction) => {
            const population = targetPopulationByFactionId.get(faction.id);
            return population === undefined
              ? faction
              : Object.freeze({ ...faction, population });
          }),
        });
  const territorial = applyRadioactiveAttackAftershockEvents(
    populationApplied,
    aftershocks.events,
  );
  const territorialApplied =
    territorial.ownership === populationApplied.ownership &&
    territorial.fallout === populationApplied.fallout
      ? populationApplied
      : createProspectiveMatchState(populationApplied, {
          ownership: territorial.ownership,
          fallout: territorial.fallout,
        });
  const directReveals = resolveDirectRevealsFromTankCombatEvents(
    territorialApplied,
    physicalCombat.events,
    populationCombat.events,
    state.tick,
  );
  return Object.freeze({
    state: createProspectiveMatchState(territorialApplied, { directReveals }),
    destructionEvents: Object.freeze(destructionEvents),
    servicesAtInterception,
  });
}

const V1_COMBAT_PROJECTILE_TICKS_PER_SECOND = 10 as const;

function combatProjectileIdentityKey(
  projectile: Readonly<{
    readonly sourceUnitId: string;
    readonly projectileOrdinal: number;
  }>,
): string {
  return JSON.stringify([
    projectile.sourceUnitId,
    projectile.projectileOrdinal,
  ]);
}

/**
 * Applies Warship firing decisions admitted from the frozen post-movement
 * snapshot, then advances only Warship-gun projectiles that pre-existed that
 * combat phase. Tank-owned immediate effects are already committed in
 * postTankCombatState, but cannot retroactively revoke a shot admitted from
 * combatSnapshot.
 */
function advanceWarshipGunfireAndProjectilePhase(
  combatSnapshot: MatchState,
  postTankCombatState: MatchState,
): MatchState {
  const firingSnapshot = resolveWarshipGunfireDecisions(combatSnapshot);
  const preExistingKeys = new Set(
    combatSnapshot.combatProjectiles.map(combatProjectileIdentityKey),
  );
  const spawnedProjectiles = firingSnapshot.combatProjectiles.filter(
    (projectile) => !preExistingKeys.has(combatProjectileIdentityKey(projectile)),
  );
  const firingOperationalByUnitId = new Map(
    firingSnapshot.warshipOperationalStates.map((operational) => [
      operational.unitId,
      operational,
    ]),
  );

  const immediateState = createProspectiveMatchState(postTankCombatState, {
    combatProjectiles: Object.freeze([
      ...postTankCombatState.combatProjectiles,
      ...spawnedProjectiles,
    ]),
    warshipOperationalStates: postTankCombatState.warshipOperationalStates.map(
      (operational) => {
        const firing = firingOperationalByUnitId.get(operational.unitId);
        if (firing === undefined) return operational;
        return Object.freeze({
          ...operational,
          attackReadyAtTick: firing.attackReadyAtTick,
          nextProjectileOrdinal: firing.nextProjectileOrdinal,
        });
      },
    ),
  });

  const preExistingWarshipProjectiles =
    combatSnapshot.combatProjectiles.filter(
      (projectile) =>
        projectile.profileId === WARSHIP_NAVAL_GUN_PROFILE_ID,
    );
  if (preExistingWarshipProjectiles.length === 0) {
    return immediateState;
  }

  const advancingKeys = new Set(
    preExistingWarshipProjectiles.map(combatProjectileIdentityKey),
  );
  const advanced = advanceHomingCombatProjectiles(
    preExistingWarshipProjectiles,
    {
      tick: combatSnapshot.tick,
      ticksPerSecond: V1_COMBAT_PROJECTILE_TICKS_PER_SECOND,
      targetPosition(unitId) {
        const target = immediateState.mobileUnits.find(
          (unit) => unit.id === unitId,
        );
        if (target === undefined) return undefined;
        const position = immediateState.map.positionOf(target.cellId);
        return Object.freeze({ x: position.x, y: position.y });
      },
    },
  );
  const projectileTravelState = createProspectiveMatchState(immediateState, {
    combatProjectiles: Object.freeze([
      ...immediateState.combatProjectiles.filter(
        (projectile) =>
          !advancingKeys.has(combatProjectileIdentityKey(projectile)),
      ),
      ...advanced.projectiles,
    ]),
  });
  const impacts = resolveWarshipNavalProjectileImpacts(
    projectileTravelState,
    advanced.impacts,
  );
  if (impacts.unresolvedImpacts.length > 0) {
    throw new Error(
      "Warship naval projectile impact resolved to an unsupported target owner",
    );
  }
  if (impacts.events.length === 0) return impacts.state;

  const directReveals = resolveDirectRevealsFromPhysicalEvents(
    impacts.state,
    impacts.events,
    combatSnapshot.tick,
  );
  return createProspectiveMatchState(impacts.state, { directReveals });
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
          const previousFaction = working.factions.find(
            (faction) => faction.id === action.factionId,
          );
          const nextFactions = working.factions.map((faction) =>
            faction.id === action.factionId
              ? { ...faction, status: "CAPITULATED" as const }
              : faction,
          );
          const postProducer = createProspectiveMatchState(working, {
            factions: nextFactions,
          });
          const events: HostilityLifecycleSimulationEvent[] =
            previousFaction?.status === "ACTIVE"
              ? [
                  createFactionCapitulatedEvent({
                    id: factionCapitulationEventId(
                      nextTick,
                      input.sequence,
                      action.factionId,
                    ),
                    tick: nextTick,
                    factionId: action.factionId,
                  }),
                ]
              : [];
          const hostilityGrace = resolveHostilityGraceFromEvents(
            postProducer,
            events,
            nextTick,
          );
          working = createProspectiveMatchState(postProducer, {
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
          const applied = tryApplyPersistentDirectiveChangesWithEvents(
            working,
            action.factionId,
            action.changes,
            {
              transitionTick: nextTick,
              acceptedInputSequence: input.sequence,
            },
          );
          if (!applied.ok) {
            throw new Error(
              `accepted directive action became invalid: ${applied.failure.code}`,
            );
          }
          const postProducer = createProspectiveMatchState(working, {
            factions: applied.factions,
            operations: applied.operations,
            defensePriorities: applied.defensePriorities,
          });
          const hostilityGrace = resolveHostilityGraceFromEvents(
            postProducer,
            applied.events,
            nextTick,
          );
          working = createProspectiveMatchState(postProducer, {
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
    const nextTick = earningSnapshot.tick + 1;
    const land = resolveLandTick(earningSnapshot, nextTick);
    const landPressureEvents = land.events.filter(
      (event): event is LandOperationPressureResolvedEvent =>
        event.kind === "LAND_OPERATION_PRESSURE_RESOLVED",
    );
    const directReveals = resolveDirectRevealsFromLandOperationEvents(
      earningSnapshot,
      landPressureEvents,
      nextTick,
    );
    const postLandState = createProspectiveMatchState(earningSnapshot, {
      factions: land.factions,
      ownership: land.ownership,
      fallout: land.fallout,
      operations: land.operations,
      defensePriorities: land.defensePriorities,
      captureProgress: land.captureProgress,
      counterResponseResiduals: land.counterResponseResiduals,
      directReveals,
    });
    const ownershipEvents = land.events.filter(
      (event): event is CellOwnershipChangedEvent =>
        event.kind === "CELL_OWNERSHIP_CHANGED",
    );
    const hostilityEvents = land.events.filter(
      (event): event is PersistentDirectedHostilitySourceEndedEvent =>
        event.kind === "PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED",
    );
    const structurePhase = resolvePersistentStructureLifecycleTickWithEvents(
      postLandState,
      ownershipEvents,
      nextTick,
    );
    const hostilityGrace = resolveHostilityGraceFromEvents(
      postLandState,
      hostilityEvents,
      nextTick,
    );
    const advanced = createAdvancedMatchState(earningSnapshot, {
      factions: land.factions,
      ownership: land.ownership,
      fallout: land.fallout,
      structures: structurePhase.structures,
      operations: land.operations,
      defensePriorities: land.defensePriorities,
      captureProgress: land.captureProgress,
      counterResponseResiduals: land.counterResponseResiduals,
      hostilityGrace,
      directReveals,
    });
    const factoryTrainUpdate = prepareFactoryTrainRuntimePhase(
      advanced,
      nextTick,
      structurePhase.events,
    );
    const trainPrepared = createProspectiveMatchState(
      advanced,
      factoryTrainUpdate,
    );
    const tradePrepared = createProspectiveMatchState(
      trainPrepared,
      prepareTradeShipRuntimePhase(trainPrepared, postLandState),
    );
    const repairIntended = advanceTankRepairIntentPhase(tradePrepared);
    const targetIntended = advanceTankTargetAcquisitionPhase(repairIntended);
    const tankPreparation = prepareTankMovementPhase(
      targetIntended,
      repairIntended,
    );
    const warshipPreparation = prepareWarshipMovementPhase(
      tankPreparation.state,
    );
    const movementPrepared = warshipPreparation.state;
    const movementWorkByUnitId: Record<string, number> = {
      ...factoryTrainMovementWorkByUnitId(movementPrepared, nextTick),
      ...tradeShipMovementWorkByUnitId(movementPrepared),
      ...tankPreparation.movementWorkByUnitId,
      ...warshipPreparation.movementWorkByUnitId,
    };
    const structureCells = new Set(
      movementPrepared.structures.map((structure) => structure.cellId),
    );
    const movedMobileUnits = advanceMobileUnits(
      movementPrepared.mobileUnits,
      movementWorkByUnitId,
      structureCells,
    );
    const trainMovementUpdate = settleFactoryTrainMovementPhase(
      movementPrepared,
      movedMobileUnits,
      nextTick,
    );
    const trainSettled = createProspectiveMatchState(
      movementPrepared,
      trainMovementUpdate,
    );
    const tankStrategicSettled = settleTankStrategicMovementPhase(
      movementPrepared,
      trainSettled,
      tankPreparation.strategicMoverIds,
    );
    const strategicSettled = settleWarshipStrategicMovementPhase(
      movementPrepared,
      tankStrategicSettled,
      warshipPreparation.strategicMoverIds,
    );
    const repairSettled = settleTankRepairMovementPhase(
      movementPrepared,
      strategicSettled,
    );
    const combatSnapshot = repairSettled;
    const combatResolved = advanceTankUnitCombatPhase(combatSnapshot);
    const warshipCombatResolved = advanceWarshipGunfireAndProjectilePhase(
      combatSnapshot,
      combatResolved.state,
    );
    const tradeSettled = settleTradeShipRuntimePhase(
      warshipCombatResolved,
      (tradeOwnerId, destinationOwnerId) =>
        matchStateAtWar(
          warshipCombatResolved,
          tradeOwnerId,
          destinationOwnerId,
        ),
      "DEFER",
    );
    const repaired = advanceTankRepairPhase(tradeSettled);
    const tanksProduced = advanceTankProductionPhase(repaired);
    const produced = advanceWarshipProductionPhase(tanksProduced);
    const trainEconomicUpdate = settleFactoryTrainEconomicEvents(
      produced,
      combatResolved.servicesAtInterception,
      combatResolved.destructionEvents,
      (trainOwnerId, stationOwnerId) =>
        matchStateAtWar(produced, trainOwnerId, stationOwnerId),
    );
    const trainEconomicSettled =
      trainEconomicUpdate === null
        ? produced
        : createProspectiveMatchState(produced, trainEconomicUpdate);
    return settleTradeShipSignedFactsPhase(trainEconomicSettled);
  }
}
