import {
  createAdvancedMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";

export interface SetTestMarkerAction {
  readonly type: "SET_TEST_MARKER";
  readonly factionId: string;
  readonly value: number;
}

export interface CapitulateFactionAction {
  readonly type: "CAPITULATE_FACTION";
  readonly factionId: string;
}

export type SimulationAction = SetTestMarkerAction | CapitulateFactionAction;

export interface AcceptedSimulationInput {
  readonly tick: number;
  readonly sequence: number;
  readonly action: SimulationAction;
}

export class TickEngine {
  advance(
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
      }
    }

    return createAdvancedMatchState(state, factions);
  }
}
