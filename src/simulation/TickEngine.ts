import type {
  DirectiveChanges,
  StructureType,
} from "../core/controller/ControllerApi";
import { resolvePassiveFfyTick } from "./Economy";
import { resolveHostilityGraceFromEvents } from "./HostilityState";
import {
  resolveLandTick,
  tryApplyPersistentDirectiveChangesWithEvents,
} from "./LandOperations";
import {
  createAdvancedMatchState,
  createProspectiveMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
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
} from "./SimulationEvents";
import {
  resolvePersistentStructureLifecycleTickWithEvents,
  tryPurchaseStructureBuild,
  tryPurchaseStructureUpgrade,
} from "./Structures";
import {
  resolveAdmittedTankUnitAttacks,
  type AdmittedTankUnitAttack,
} from "./TankCombat";
import {
  advanceTankRepairIntentPhase,
  advanceTankRepairMovementPhase,
  advanceTankRepairPhase,
} from "./TankRepair";
import {
  planTankPursuitRoute,
  selectTankAutonomousUnitTarget,
  type TankAutonomousUnitTargetSelection,
} from "./TankTargeting";
import { advanceTankProductionPhase } from "./Tanks";
import {
  projectTankTargetObservation,
  resolveDirectRevealsFromPhysicalEvents,
} from "./VisibilityState";

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
  const observationByOwner = new Map<
    string,
    ReturnType<typeof projectTankTargetObservation>
  >();
  let changed = false;
  const tankOperationalStates = state.tankOperationalStates.map((operational) => {
    if (
      operational.eligibleFromTick > state.tick ||
      operational.repairFactoryId !== undefined
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

function advanceTankPursuitMovementPhase(
  state: MatchState,
  stateBeforeTargeting: MatchState,
): MatchState {
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

  for (const unit of state.mobileUnits) {
    const operational = operationalById.get(unit.id);
    if (
      operational === undefined ||
      operational.eligibleFromTick > state.tick ||
      operational.repairFactoryId !== undefined ||
      (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
    ) {
      continue;
    }

    const previousTarget = previousOperationalById.get(unit.id)?.retainedTarget;
    const target = operational.retainedTarget;
    if (target === undefined) {
      if (previousTarget !== undefined && unit.route !== undefined) {
        const cleared = assignMobileUnitRoute(state.map, unit, {
          cells: [unit.cellId],
          edgeWeights: [],
        });
        if (cleared !== unit) unitUpdates.set(unit.id, cleared);
      }
      continue;
    }

    const plan = planTankPursuitRoute(
      state,
      {
        ownerId: unit.ownerId,
        chassisType: unit.type,
        currentCellId: unit.cellId,
        operatingAnchorCellId: operational.operatingAnchorCellId,
      },
      target,
    );
    if (plan === undefined) continue;

    let prepared = unit;
    if (plan.cells.length === 1) {
      if (unit.route !== undefined) {
        prepared = assignMobileUnitRoute(state.map, unit, {
          cells: [unit.cellId],
          edgeWeights: [],
        });
      }
    } else if (
      !sameTankTarget(previousTarget, target) ||
      unit.route === undefined ||
      unit.route.destinationCellId !== plan.destinationCellId
    ) {
      prepared = assignMobileUnitRoute(state.map, unit, {
        cells: plan.cells,
        edgeWeights: plan.edgeWeights,
      });
    }

    const advanced = advanceMobileUnit(
      prepared,
      plan.movementWorkPerTick,
    ).unit;
    if (advanced !== unit) unitUpdates.set(unit.id, advanced);
  }

  if (unitUpdates.size === 0) return state;
  return createProspectiveMatchState(state, {
    mobileUnits: state.mobileUnits.map((unit) => unitUpdates.get(unit.id) ?? unit),
  });
}

function tankUnitAttackCooldownTicks(
  unitType: "TANK" | "HEAVY_ARTILLERY",
): number {
  return unitType === "HEAVY_ARTILLERY" ? 120 : 10;
}

function advanceTankUnitCombatPhase(state: MatchState): MatchState {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const observationByOwner = new Map<
    string,
    ReturnType<typeof projectTankTargetObservation>
  >();
  const attacks: AdmittedTankUnitAttack[] = [];
  const firingUnitIds = new Set<string>();

  for (const operational of state.tankOperationalStates) {
    const retainedTarget = operational.retainedTarget;
    if (
      operational.eligibleFromTick > state.tick ||
      operational.repairFactoryId !== undefined ||
      operational.attackReadyAtTick > state.tick ||
      retainedTarget === undefined ||
      (retainedTarget.targetClass !== "TANK_CHASSIS" &&
        retainedTarget.targetClass !== "TRAIN")
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
    const target = unitsById.get(retainedTarget.unitId);
    if (target === undefined) continue;
    if (
      retainedTarget.targetClass === "TANK_CHASSIS"
        ? target.type !== "TANK" && target.type !== "HEAVY_ARTILLERY"
        : unit.type !== "TANK" || target.type !== "TRAIN"
    ) {
      continue;
    }

    let observation = observationByOwner.get(unit.ownerId);
    if (observation === undefined) {
      observation = projectTankTargetObservation(state, unit.ownerId);
      observationByOwner.set(unit.ownerId, observation);
    }
    if (!observation.observedUnitIds.includes(target.id)) continue;

    const plan = planTankPursuitRoute(
      state,
      {
        ownerId: unit.ownerId,
        chassisType: unit.type,
        currentCellId: unit.cellId,
        operatingAnchorCellId: operational.operatingAnchorCellId,
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

    attacks.push(
      Object.freeze({
        attackerUnitId: unit.id,
        targetUnitId: target.id,
      }),
    );
    firingUnitIds.add(unit.id);
  }

  const preCombat =
    firingUnitIds.size === 0
      ? state
      : createProspectiveMatchState(state, {
          tankOperationalStates: state.tankOperationalStates.map((operational) => {
            if (!firingUnitIds.has(operational.unitId)) return operational;
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
              attackReadyAtTick:
                state.tick + tankUnitAttackCooldownTicks(unit.type),
            });
          }),
        });
  const combat = resolveAdmittedTankUnitAttacks(preCombat, attacks);
  const directReveals = resolveDirectRevealsFromPhysicalEvents(
    combat.state,
    combat.events,
    state.tick,
  );
  return createProspectiveMatchState(combat.state, { directReveals });
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
    const postLandState = createProspectiveMatchState(earningSnapshot, {
      factions: land.factions,
      ownership: land.ownership,
      fallout: land.fallout,
      operations: land.operations,
      defensePriorities: land.defensePriorities,
      captureProgress: land.captureProgress,
      counterResponseResiduals: land.counterResponseResiduals,
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
    });
    const repairIntended = advanceTankRepairIntentPhase(advanced);
    const targetIntended = advanceTankTargetAcquisitionPhase(repairIntended);
    const pursuitMoved = advanceTankPursuitMovementPhase(
      targetIntended,
      repairIntended,
    );
    const repairMoved = advanceTankRepairMovementPhase(pursuitMoved);
    const combatResolved = advanceTankUnitCombatPhase(repairMoved);
    const repaired = advanceTankRepairPhase(combatResolved);
    return advanceTankProductionPhase(repaired);
  }
}
