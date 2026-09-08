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

export type SimulationAction =
  | SetTestMarkerAction
  | CapitulateFactionAction
  | GrantPopulationAction
  | RepartitionPopulationAction
  | RemovePopulationAction
  | TransferPopulationAction;

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
    let factions: readonly MatchFactionState[] = state.factions;

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

      switch (input.action.type) {
        case "SET_TEST_MARKER":
          factions = factions.map((faction) =>
            faction.id === input.action.factionId
              ? { ...faction, testMarker: input.action.value }
              : faction,
          );
          break;
        case "CAPITULATE_FACTION":
          factions = factions.map((faction) =>
            faction.id === input.action.factionId
              ? { ...faction, status: "CAPITULATED" }
              : faction,
          );
          break;
        case "GRANT_POPULATION":
          factions = updateFactionPopulation(
            factions,
            input.action.factionId,
            (population) => grantPopulation(population, input.action.amount),
          );
          break;
        case "REPARTITION_POPULATION":
          factions = updateFactionPopulation(
            factions,
            input.action.factionId,
            (population) =>
              repartitionPopulation(
                population,
                input.action.from,
                input.action.to,
                input.action.amount,
              ),
          );
          break;
        case "REMOVE_POPULATION":
          factions = updateFactionPopulation(
            factions,
            input.action.factionId,
            (population) =>
              removePopulation(
                population,
                input.action.from,
                input.action.amount,
              ),
          );
          break;
        case "TRANSFER_POPULATION": {
          const source = factions.find(
            (faction) => faction.id === input.action.sourceFactionId,
          );
          const recipient = factions.find(
            (faction) => faction.id === input.action.recipientFactionId,
          );
          if (source === undefined) {
            throw new Error(`unknown faction: ${input.action.sourceFactionId}`);
          }
          if (recipient === undefined) {
            throw new Error(`unknown faction: ${input.action.recipientFactionId}`);
          }
          const transferred = transferPopulation(
            source.population,
            recipient.population,
            input.action.sourceBucket,
            input.action.amount,
          );
          factions = factions.map((faction) => {
            if (faction.id === source.id) {
              return { ...faction, population: transferred.source };
            }
            if (faction.id === recipient.id) {
              return { ...faction, population: transferred.recipient };
            }
            return faction;
          });
          break;
        }
      }
    }

    return createProspectiveMatchState(state, factions);
  }

  advance(
    state: MatchState,
    inputs: readonly AcceptedSimulationInput[],
  ): MatchState {
    const prospective = this.applyAcceptedInputs(state, inputs);
    return createAdvancedMatchState(state, prospective.factions);
  }
}
