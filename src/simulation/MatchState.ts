import type { FactionStatus } from "../core/controller/ControllerApi";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import type { MatchSpec, SyntheticMapSpec } from "./MatchSpec";

export interface MatchFactionState {
  readonly id: string;
  readonly status: FactionStatus;
  readonly rules: CompiledRuleProfile;
  readonly testMarker: number;
}

export interface MatchState {
  readonly seed: string;
  readonly tick: number;
  readonly map: SyntheticMapSpec;
  readonly factions: readonly MatchFactionState[];
}

function freezeMap(map: SyntheticMapSpec): SyntheticMapSpec {
  return Object.freeze({
    width: map.width,
    height: map.height,
    terrain: Object.freeze([...map.terrain]),
  });
}

function freezeFactions(
  factions: readonly MatchFactionState[],
): readonly MatchFactionState[] {
  return Object.freeze(
    factions.map((faction) =>
      Object.freeze({
        id: faction.id,
        status: faction.status,
        rules: faction.rules,
        testMarker: faction.testMarker,
      }),
    ),
  );
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function createInitialMatchState(spec: MatchSpec): MatchState {
  return Object.freeze({
    seed: spec.seed,
    tick: 0,
    map: freezeMap(spec.map),
    factions: freezeFactions(
      spec.factions.map((faction) => ({
        id: faction.id,
        status: "ACTIVE",
        rules: faction.rules,
        testMarker: 0,
      })),
    ),
  });
}

export function createAdvancedMatchState(
  previous: MatchState,
  factions: readonly MatchFactionState[],
): MatchState {
  return Object.freeze({
    seed: previous.seed,
    tick: previous.tick + 1,
    map: previous.map,
    factions: freezeFactions(factions),
  });
}

export function canonicalMatchStateSerialization(state: MatchState): string {
  const factions = [...state.factions]
    .sort((left, right) => compareIds(left.id, right.id))
    .map((faction) => ({
      id: faction.id,
      status: faction.status,
      testMarker: faction.testMarker,
      rules: {
        version: faction.rules.version,
        canonicalSerialization: faction.rules.canonicalSerialization,
      },
    }));

  return JSON.stringify({
    seed: state.seed,
    tick: state.tick,
    map: {
      width: state.map.width,
      height: state.map.height,
      terrain: [...state.map.terrain],
    },
    factions,
  });
}
