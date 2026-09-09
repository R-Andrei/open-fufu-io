import type { MatchState } from "./MatchState";
import type {
  ResolvedSpawnFactionInput,
  SpawnInitializationInput,
  SpawnMode,
} from "./MatchSpec";
import {
  compareSpawnUtf8,
  foreignSpawnOriginsMeetSpacing,
  isExactSpawnSeedTerrain,
  materializeEffectiveSpawnProfile,
  SPAWN_RESOLVER_VERSION,
  stableTie32,
  validateResolvedSpawnOrigins,
} from "./SpawnSemantics";

export interface FixedSpawnFactionInput {
  readonly factionId: string;
  readonly origins: readonly number[];
}

export interface FixedSpawnConfiguration {
  readonly factions: readonly FixedSpawnFactionInput[];
}

interface RandomSlot {
  readonly factionId: string;
  readonly originSlot: number;
  readonly priority: number;
}

interface RandomPlacement extends RandomSlot {
  readonly cellId: number;
}

function freezeSpawnInput(
  spawnMode: SpawnMode,
  factions: readonly ResolvedSpawnFactionInput[],
): SpawnInitializationInput {
  return Object.freeze({
    spawnMode,
    spawnResolverVersion: SPAWN_RESOLVER_VERSION,
    factions: Object.freeze(
      factions.map((faction) =>
        Object.freeze({
          factionId: faction.factionId,
          origins: Object.freeze(
            faction.origins.map((origin) => Object.freeze({ ...origin })),
          ),
        }),
      ),
    ),
  });
}

export function resolveFixedSpawnInitialization(
  state: MatchState,
  configuration: FixedSpawnConfiguration,
): SpawnInitializationInput {
  const input = freezeSpawnInput(
    "FIXED",
    [...configuration.factions]
      .sort((left, right) => compareSpawnUtf8(left.factionId, right.factionId))
      .map((faction) => ({
        factionId: faction.factionId,
        origins: faction.origins.map((resolvedExactOrigin, originSlot) => ({
          originSlot,
          resolvedExactOrigin,
          source: "FIXED_CONFIGURATION" as const,
        })),
      })),
  );

  validateResolvedSpawnOrigins(state, input);
  return input;
}

function compareRandomSlots(left: RandomSlot, right: RandomSlot): number {
  return (
    left.priority - right.priority ||
    compareSpawnUtf8(left.factionId, right.factionId) ||
    left.originSlot - right.originSlot
  );
}

function candidateIsCompatible(
  state: MatchState,
  factionId: string,
  cellId: number,
  placements: readonly RandomPlacement[],
): boolean {
  for (const placement of placements) {
    if (placement.factionId === factionId) {
      if (placement.cellId === cellId) return false;
      continue;
    }
    if (!foreignSpawnOriginsMeetSpacing(state.map, cellId, placement.cellId)) {
      return false;
    }
  }
  return true;
}

function bestCompatibleRandomCandidate(
  state: MatchState,
  slot: RandomSlot,
  committed: readonly RandomPlacement[],
): number | undefined {
  let bestCellId: number | undefined;
  let bestTie: number | undefined;

  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    if (
      state.fallout[cellId] === true ||
      !isExactSpawnSeedTerrain(state.map.terrainAt(cellId)) ||
      !candidateIsCompatible(state, slot.factionId, cellId, committed)
    ) {
      continue;
    }

    const tie = stableTie32(
      "random-exact-origin",
      SPAWN_RESOLVER_VERSION,
      state.seed,
      slot.factionId,
      slot.originSlot,
      cellId,
    );
    if (
      bestTie === undefined ||
      tie < bestTie ||
      (tie === bestTie && cellId < bestCellId!)
    ) {
      bestTie = tie;
      bestCellId = cellId;
    }
  }

  return bestCellId;
}

function sameRandomSlot(left: RandomSlot, right: RandomSlot): boolean {
  return left.factionId === right.factionId && left.originSlot === right.originSlot;
}

export function resolveRandomSpawnInitialization(
  state: MatchState,
): SpawnInitializationInput {
  const sortedFactions = [...state.factions].sort((left, right) =>
    compareSpawnUtf8(left.id, right.id),
  );
  const slots: RandomSlot[] = [];

  for (const faction of sortedFactions) {
    const profile = materializeEffectiveSpawnProfile(faction.rules);
    for (let originSlot = 0; originSlot < profile.exactOriginCount; originSlot += 1) {
      slots.push(
        Object.freeze({
          factionId: faction.id,
          originSlot,
          priority: stableTie32(
            "random-origin-priority",
            SPAWN_RESOLVER_VERSION,
            state.seed,
            faction.id,
            originSlot,
          ),
        }),
      );
    }
  }

  let unresolved = [...slots];
  const committed: RandomPlacement[] = [];

  while (unresolved.length > 0) {
    const proposals = unresolved.map((slot) => {
      const cellId = bestCompatibleRandomCandidate(state, slot, committed);
      if (cellId === undefined) {
        throw new Error("RANDOM_ORIGIN_ALLOCATION_UNFILLABLE");
      }
      return Object.freeze({ ...slot, cellId });
    });
    proposals.sort(compareRandomSlots);

    const accepted: RandomPlacement[] = [];
    for (const proposal of proposals) {
      if (
        candidateIsCompatible(
          state,
          proposal.factionId,
          proposal.cellId,
          accepted,
        )
      ) {
        accepted.push(proposal);
      }
    }

    if (accepted.length === 0) {
      throw new Error("RANDOM_ORIGIN_ALLOCATION_UNFILLABLE");
    }

    committed.push(...accepted);
    unresolved = unresolved.filter(
      (slot) => !accepted.some((placement) => sameRandomSlot(slot, placement)),
    );
  }

  const input = freezeSpawnInput(
    "RANDOM",
    sortedFactions.map((faction) => ({
      factionId: faction.id,
      origins: committed
        .filter((placement) => placement.factionId === faction.id)
        .sort((left, right) => left.originSlot - right.originSlot)
        .map((placement) => ({
          originSlot: placement.originSlot,
          resolvedExactOrigin: placement.cellId,
          source: "RANDOM_RESOLUTION" as const,
        })),
    })),
  );

  validateResolvedSpawnOrigins(state, input);
  return input;
}
