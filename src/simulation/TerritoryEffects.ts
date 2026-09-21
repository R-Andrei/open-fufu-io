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

export interface TerritoryRelinquishmentStateLike
  extends TerritorialEffectStateLike {
  readonly factions: readonly Readonly<{
    readonly id: string;
    readonly rules: Readonly<{
      readonly customDomains: readonly Readonly<{ readonly domain: string }>[];
    }>;
  }>[];
  readonly structures: readonly Readonly<{ readonly cellId: number }>[];
}

export interface TerritoryRelinquishmentRequest {
  readonly ownerId: string;
  readonly cellIds: readonly number[];
}

export type TerritoryRelinquishmentFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "CELL_NOT_OWNED"
  | "PERSISTENT_STRUCTURE_PRESENT";

export type TerritoryRelinquishmentResult =
  | Readonly<{
      readonly ok: true;
      readonly ownership: readonly (string | null)[];
      readonly fallout: readonly boolean[];
      readonly cellIds: readonly number[];
      readonly appliesFallout: boolean;
    }>
  | Readonly<{
      readonly ok: false;
      readonly failure: Readonly<{
        readonly code: TerritoryRelinquishmentFailureCode;
      }>;
    }>;

export function relinquishmentAppliesFallout(
  state: Pick<TerritoryRelinquishmentStateLike, "factions">,
  ownerId: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  return (
    owner?.rules.customDomains.some(
      (entry) => entry.domain === "RELINQUISHMENT_FALLOUT",
    ) ?? false
  );
}

function territoryRelinquishmentFailure(
  code: TerritoryRelinquishmentFailureCode,
): TerritoryRelinquishmentResult {
  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({ code }),
  });
}

export function tryRelinquishTerritory(
  state: TerritoryRelinquishmentStateLike,
  request: TerritoryRelinquishmentRequest,
): TerritoryRelinquishmentResult {
  assertTerritorialState(state);
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    !Array.isArray(request.cellIds)
  ) {
    return territoryRelinquishmentFailure("INVALID_REQUEST");
  }

  if (!state.factions.some((faction) => faction.id === request.ownerId)) {
    return territoryRelinquishmentFailure("UNKNOWN_OWNER");
  }

  const selected = new Set<number>();
  for (let index = 0; index < request.cellIds.length; index += 1) {
    if (!(index in request.cellIds)) {
      return territoryRelinquishmentFailure("INVALID_REQUEST");
    }
    const cellId = request.cellIds[index]!;
    if (
      !Number.isSafeInteger(cellId) ||
      cellId < 0 ||
      Object.is(cellId, -0) ||
      cellId >= state.ownership.length
    ) {
      return territoryRelinquishmentFailure("INVALID_REQUEST");
    }
    selected.add(cellId);
  }
  const cellIds = Object.freeze(
    [...selected].sort((left, right) => left - right),
  );

  if (cellIds.some((cellId) => state.ownership[cellId] !== request.ownerId)) {
    return territoryRelinquishmentFailure("CELL_NOT_OWNED");
  }
  const selectedSet = new Set(cellIds);
  if (state.structures.some((structure) => selectedSet.has(structure.cellId))) {
    return territoryRelinquishmentFailure("PERSISTENT_STRUCTURE_PRESENT");
  }

  const appliesFallout = relinquishmentAppliesFallout(state, request.ownerId);
  if (cellIds.length === 0) {
    return Object.freeze({
      ok: true as const,
      ownership: state.ownership,
      fallout: state.fallout,
      cellIds,
      appliesFallout,
    });
  }

  const ownership = [...state.ownership];
  const fallout = appliesFallout ? [...state.fallout] : undefined;
  for (const cellId of cellIds) {
    ownership[cellId] = null;
    if (fallout !== undefined) fallout[cellId] = true;
  }
  return Object.freeze({
    ok: true as const,
    ownership: Object.freeze(ownership),
    fallout:
      fallout === undefined ? state.fallout : Object.freeze(fallout),
    cellIds,
    appliesFallout,
  });
}

export function applyRadioactiveAttackAftershockEvents(
  state: TerritorialEffectStateLike,
  events: readonly RadioactiveAttackAftershockResolvedEvent[],
): TerritorialEffectResult {
  assertTerritorialState(state);
  const affectedCellIds = new Set<number>();

  for (const event of events) {
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
