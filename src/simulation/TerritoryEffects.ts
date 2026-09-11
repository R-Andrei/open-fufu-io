import type { RadioactiveAttackAftershockResolvedEvent } from "./SimulationEvents";

export interface TerritorialEffectStateLike {
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
}

export interface TerritorialEffectResult {
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
}

function assertTerritorialState(state: TerritorialEffectStateLike): void {
  if (state.ownership.length !== state.fallout.length) {
    throw new Error("territorial ownership and Fallout arrays must have equal length");
  }
}

function assertCellIdInState(
  state: TerritorialEffectStateLike,
  cellId: number,
): void {
  if (
    !Number.isSafeInteger(cellId) ||
    cellId < 0 ||
    Object.is(cellId, -0) ||
    cellId >= state.ownership.length
  ) {
    throw new Error(`territorial effect references invalid cellId: ${String(cellId)}`);
  }
}

export function applyRadioactiveAttackAftershockEvents(
  state: TerritorialEffectStateLike,
  events: readonly RadioactiveAttackAftershockResolvedEvent[],
): TerritorialEffectResult {
  assertTerritorialState(state);
  const affectedCellIds = new Set<number>();

  for (const event of events) {
    if (event.kind !== "RADIOACTIVE_ATTACK_AFTERSHOCK_RESOLVED") {
      throw new Error(`unsupported territorial simulation event: ${String(event.kind)}`);
    }
    for (const cellId of event.payload.affectedCellIds) {
      assertCellIdInState(state, cellId);
      affectedCellIds.add(cellId);
    }
  }

  if (affectedCellIds.size === 0) {
    return Object.freeze({
      ownership: state.ownership,
      fallout: state.fallout,
    });
  }

  const ownership = [...state.ownership];
  const fallout = [...state.fallout];
  for (const cellId of [...affectedCellIds].sort((left, right) => left - right)) {
    ownership[cellId] = null;
    fallout[cellId] = true;
  }

  return Object.freeze({
    ownership: Object.freeze(ownership),
    fallout: Object.freeze(fallout),
  });
}
