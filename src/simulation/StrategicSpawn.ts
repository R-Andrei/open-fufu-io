import type {
  CellId,
  ControllerMemory,
  SpawnBaseContext,
  SpawnFactionView,
  SpawnInfluenceContext,
  SpawnInfluenceDecision,
  SpawnOriginApi,
  SpawnOriginContext,
  SpawnOriginDecision,
  SpawnOriginValidation,
  SpawnParticipantView,
  SpawnReconsiderContext,
} from "../core/controller/ControllerApi";
import type {
  ControllerHost,
  ControllerHostInvocationResult,
} from "./ControllerRuntime";
import type { MatchState } from "./MatchState";
import type { SpawnInitializationInput } from "./MatchSpec";
import {
  compareSpawnUtf8,
  isExactSpawnSeedTerrain,
  materializeEffectiveSpawnProfile,
  SPAWN_RESOLVER_VERSION,
  validateResolvedSpawnOrigins,
} from "./SpawnSemantics";

const EMPTY_MEMORY = Object.freeze({}) as Readonly<ControllerMemory>;

export type StrategicSpawnBaseContextInput = Omit<
  SpawnBaseContext,
  "memory" | "participants"
>;

export interface ResolveStrategicSpawnInput {
  readonly state: MatchState;
  readonly host: ControllerHost;
  readonly contextForFaction: (
    factionId: string,
  ) => StrategicSpawnBaseContextInput;
}

export interface StrategicSpawnResolution {
  readonly initialization: SpawnInitializationInput;
}

interface StrategicFactionContext {
  readonly factionId: string;
  readonly base: StrategicSpawnBaseContextInput;
}

function freezeCells(cells: readonly CellId[]): readonly CellId[] {
  return Object.freeze([...cells]);
}

function requireInfluenceCenters(
  state: MatchState,
  faction: StrategicFactionContext,
  result: ControllerHostInvocationResult<SpawnInfluenceDecision>,
  phase: "INFLUENCE" | "RECONSIDER",
): readonly CellId[] {
  if (!result.ok || result.output === undefined) {
    throw new Error(`Strategic Spawn ${phase} fallback is not implemented for ${faction.factionId}`);
  }
  const centers = result.output.centers;
  if (
    !Array.isArray(centers) ||
    centers.length !== faction.base.profile.influenceSlotCount
  ) {
    throw new Error(`Strategic Spawn ${phase} returned a structurally invalid center set for ${faction.factionId}`);
  }
  for (const center of centers) {
    if (!Number.isSafeInteger(center) || !state.map.isValidCellId(center)) {
      throw new Error(`Strategic Spawn ${phase} returned an invalid center for ${faction.factionId}`);
    }
  }
  return freezeCells(centers);
}

function revealedFactions(
  factions: readonly StrategicFactionContext[],
  centersByFaction: ReadonlyMap<string, readonly CellId[]>,
): readonly SpawnFactionView[] {
  return Object.freeze(
    factions.map((faction) =>
      Object.freeze({
        id: faction.factionId,
        displayName: faction.base.me.displayName,
        influenceCenters: centersByFaction.get(faction.factionId)!,
      }),
    ),
  );
}

function squaredDistance(
  state: MatchState,
  leftCellId: CellId,
  rightCellId: CellId,
): number {
  const left = state.map.positionOf(leftCellId);
  const right = state.map.positionOf(rightCellId);
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function createSpawnOriginApi(
  state: MatchState,
  profile: StrategicSpawnBaseContextInput["profile"],
  influenceCenters: readonly CellId[],
): SpawnOriginApi {
  if (
    influenceCenters.length !== profile.influenceSlotCount ||
    profile.influenceAreaCells.length !== profile.influenceSlotCount
  ) {
    throw new Error("Strategic Spawn profile influence geometry is internally inconsistent");
  }

  const validLocalChoice = (cellId: CellId, slotIndex: number): boolean => {
    if (
      !Number.isSafeInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= profile.exactOriginCount ||
      slotIndex >= influenceCenters.length ||
      !Number.isSafeInteger(cellId) ||
      !state.map.isValidCellId(cellId)
    ) {
      return false;
    }
    const area = profile.influenceAreaCells[slotIndex];
    const center = influenceCenters[slotIndex];
    if (
      area === undefined ||
      center === undefined ||
      !Number.isSafeInteger(area) ||
      area < 0 ||
      squaredDistance(state, cellId, center) > area
    ) {
      return false;
    }
    return (
      state.fallout[cellId] !== true &&
      isExactSpawnSeedTerrain(state.map.terrainAt(cellId))
    );
  };

  const validateOriginChoices = (
    origins: readonly CellId[],
  ): SpawnOriginValidation => {
    if (!Array.isArray(origins) || origins.length !== profile.exactOriginCount) {
      return Object.freeze({ valid: false, code: "WRONG_ORIGIN_COUNT" });
    }
    const seen = new Set<CellId>();
    for (let slotIndex = 0; slotIndex < origins.length; slotIndex += 1) {
      const cellId = origins[slotIndex]!;
      if (!Number.isSafeInteger(cellId) || !state.map.isValidCellId(cellId)) {
        return Object.freeze({ valid: false, code: "INVALID_CELL", slotIndex });
      }
      const center = influenceCenters[slotIndex];
      const area = profile.influenceAreaCells[slotIndex];
      if (
        center === undefined ||
        area === undefined ||
        !Number.isSafeInteger(area) ||
        area < 0 ||
        squaredDistance(state, cellId, center) > area
      ) {
        return Object.freeze({ valid: false, code: "OUTSIDE_INFLUENCE", slotIndex });
      }
      if (
        state.fallout[cellId] === true ||
        !isExactSpawnSeedTerrain(state.map.terrainAt(cellId))
      ) {
        return Object.freeze({ valid: false, code: "SPAWN_INELIGIBLE", slotIndex });
      }
      if (seen.has(cellId)) {
        return Object.freeze({ valid: false, code: "DUPLICATE_ORIGIN", slotIndex });
      }
      seen.add(cellId);
    }
    return Object.freeze({ valid: true });
  };

  return Object.freeze({
    isValidOriginChoice: validLocalChoice,
    validateOriginChoices,
  });
}

function requireOriginDecision(
  state: MatchState,
  faction: StrategicFactionContext,
  influenceCenters: readonly CellId[],
  result: ControllerHostInvocationResult<SpawnOriginDecision>,
): readonly CellId[] {
  if (!result.ok || result.output === undefined) {
    throw new Error(`Strategic Spawn ORIGIN fallback is not implemented for ${faction.factionId}`);
  }
  const origins = result.output.origins;
  if (!Array.isArray(origins) || origins.length !== faction.base.profile.exactOriginCount) {
    throw new Error(`Strategic Spawn ORIGIN returned a structurally invalid origin set for ${faction.factionId}`);
  }
  const validation = createSpawnOriginApi(
    state,
    faction.base.profile,
    influenceCenters,
  ).validateOriginChoices(origins);
  if (!validation.valid) {
    throw new Error(
      `Strategic Spawn ORIGIN requires resolver repair for ${faction.factionId}:${validation.code ?? "INVALID"}`,
    );
  }
  return freezeCells(origins);
}

function publicParticipants(
  state: MatchState,
  factions: readonly StrategicFactionContext[],
): readonly SpawnParticipantView[] {
  return Object.freeze(
    factions.map((entry) => {
      const faction = state.factions.find((candidate) => candidate.id === entry.factionId)!;
      const effective = materializeEffectiveSpawnProfile(faction.rules);
      if (
        entry.base.profile.exactOriginCount !== effective.exactOriginCount ||
        entry.base.profile.initialTerritoryPopulationBearingCells !==
          effective.initialTerritoryPopulationBearingQuota ||
        entry.base.profile.footprintShape !== effective.footprintShapeProfile
      ) {
        throw new Error(`Strategic Spawn public profile does not match effective rules for ${entry.factionId}`);
      }
      if (
        !Number.isSafeInteger(entry.base.profile.influenceSlotCount) ||
        entry.base.profile.influenceSlotCount <= 0 ||
        entry.base.profile.influenceAreaCells.length !==
          entry.base.profile.influenceSlotCount
      ) {
        throw new Error(`Strategic Spawn public influence profile is invalid for ${entry.factionId}`);
      }
      return Object.freeze({
        id: entry.factionId,
        displayName: entry.base.me.displayName,
        origin: entry.base.me.origin,
        profile: entry.base.profile,
        startingPopulation: effective.startingPopulation,
        effectiveModifiers: entry.base.me.effectiveModifiers,
      });
    }),
  );
}

function phaseBase(
  faction: StrategicFactionContext,
  participants: readonly SpawnParticipantView[],
): SpawnBaseContext {
  return Object.freeze({
    ...faction.base,
    memory: EMPTY_MEMORY,
    participants,
  });
}

export async function resolveStrategicSpawn(
  input: ResolveStrategicSpawnInput,
): Promise<StrategicSpawnResolution> {
  const factions = Object.freeze(
    [...input.state.factions]
      .sort((left, right) => compareSpawnUtf8(left.id, right.id))
      .map((faction) => {
        const base = input.contextForFaction(faction.id);
        if (base.me.id !== faction.id) {
          throw new Error(`Strategic Spawn context requester mismatch for ${faction.id}`);
        }
        if (base.game.spawnMode !== "STRATEGIC") {
          throw new Error(`Strategic Spawn context for ${faction.id} must use STRATEGIC mode`);
        }
        return Object.freeze({ factionId: faction.id, base });
      }),
  );
  const participants = publicParticipants(input.state, factions);

  const phase1Results = await Promise.all(
    factions.map(async (faction) => {
      const context = Object.freeze({
        ...phaseBase(faction, participants),
        phase: "INFLUENCE" as const,
      }) satisfies SpawnInfluenceContext;
      return Object.freeze({
        factionId: faction.factionId,
        result: await input.host.chooseInfluence(faction.factionId, context),
      });
    }),
  );
  const phase1ByFaction = new Map<string, readonly CellId[]>();
  for (let index = 0; index < factions.length; index += 1) {
    const faction = factions[index]!;
    phase1ByFaction.set(
      faction.factionId,
      requireInfluenceCenters(
        input.state,
        faction,
        phase1Results[index]!.result,
        "INFLUENCE",
      ),
    );
  }
  const phase1Reveal = revealedFactions(factions, phase1ByFaction);

  const phase2Results = await Promise.all(
    factions.map(async (faction) => {
      const currentInfluenceCenters = phase1ByFaction.get(faction.factionId)!;
      const context = Object.freeze({
        ...phaseBase(faction, participants),
        phase: "RECONSIDER" as const,
        currentInfluenceCenters,
        revealedFactions: phase1Reveal,
      }) satisfies SpawnReconsiderContext;
      return Object.freeze({
        factionId: faction.factionId,
        result: await input.host.reconsiderInfluence(faction.factionId, context),
      });
    }),
  );
  const finalInfluenceByFaction = new Map<string, readonly CellId[]>();
  for (let index = 0; index < factions.length; index += 1) {
    const faction = factions[index]!;
    finalInfluenceByFaction.set(
      faction.factionId,
      requireInfluenceCenters(
        input.state,
        faction,
        phase2Results[index]!.result,
        "RECONSIDER",
      ),
    );
  }
  const finalInfluenceReveal = revealedFactions(factions, finalInfluenceByFaction);

  const phase3Results = await Promise.all(
    factions.map(async (faction) => {
      const influenceCenters = finalInfluenceByFaction.get(faction.factionId)!;
      const context = Object.freeze({
        ...phaseBase(faction, participants),
        phase: "ORIGIN" as const,
        influenceCenters,
        revealedFactions: finalInfluenceReveal,
        spawn: createSpawnOriginApi(input.state, faction.base.profile, influenceCenters),
      }) satisfies SpawnOriginContext;
      return Object.freeze({
        factionId: faction.factionId,
        result: await input.host.chooseOrigins(faction.factionId, context),
      });
    }),
  );

  const initialization = Object.freeze({
    spawnMode: "STRATEGIC" as const,
    spawnResolverVersion: SPAWN_RESOLVER_VERSION,
    factions: Object.freeze(
      factions.map((faction, index) => {
        const influenceCenters = finalInfluenceByFaction.get(faction.factionId)!;
        const origins = requireOriginDecision(
          input.state,
          faction,
          influenceCenters,
          phase3Results[index]!.result,
        );
        return Object.freeze({
          factionId: faction.factionId,
          origins: Object.freeze(
            origins.map((resolvedExactOrigin, originSlot) =>
              Object.freeze({
                originSlot,
                resolvedExactOrigin,
                source: "STRATEGIC_SUBMISSION" as const,
              }),
            ),
          ),
        });
      }),
    ),
  }) satisfies SpawnInitializationInput;

  validateResolvedSpawnOrigins(input.state, initialization);
  return Object.freeze({ initialization });
}
