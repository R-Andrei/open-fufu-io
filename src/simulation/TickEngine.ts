import type { DirectiveChanges } from "../core/controller/ControllerApi";
import { resolvePassiveFfyTick } from "./Economy";
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
  grantPopulation,
  removePopulation,
  repartitionPopulation,
  transferPopulation,
  type PopulationBucket,
  type PopulationState,
} from "./Population";

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

export type SimulationAction =
  | SetTestMarkerAction
  | CapitulateFactionAction
  | GrantPopulationAction
  | RepartitionPopulationAction
  | RemovePopulationAction
  | TransferPopulationAction
  | ApplyPersistentDirectivesAction;

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
    const hostilityGrace = reconcileHostilityGrace(
      earningSnapshot.factions,
      earningSnapshot.operations,
      land.factions,
      land.operations,
      earningSnapshot.hostilityGrace,
      nextTick,
    );
    return createAdvancedMatchState(earningSnapshot, {
      factions: land.factions,
      ownership: land.ownership,
      fallout: land.fallout,
      operations: land.operations,
      defensePriorities: land.defensePriorities,
      captureProgress: land.captureProgress,
      counterResponseResiduals: land.counterResponseResiduals,
      hostilityGrace,
    });
  }
}
