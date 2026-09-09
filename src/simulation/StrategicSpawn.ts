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
  foreignSpawnOriginsMeetSpacing,
  isExactSpawnSeedTerrain,
  materializeEffectiveSpawnProfile,
  SPAWN_RESOLVER_VERSION,
  SPAWN_STABLE_TIE32_ID,
  stableTie32,
  validateResolvedSpawnOrigins,
} from "./SpawnSemantics";

const EMPTY_MEMORY = Object.freeze({}) as Readonly<ControllerMemory>;
const ORDINARY_INFLUENCE_AREA_CELLS = 160_000;
const SPLIT_TWO_INFLUENCE_AREA_CELLS = 80_000;

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

export type StrategicHookFallbackReason =
  | "HOOK_MISSING"
  | "HOOK_MALFORMED"
  | "HOOK_RUNTIME_FAULT";

export interface StrategicInfluenceEvidence {
  readonly submittedInfluenceCenters?: readonly CellId[];
  readonly resolvedInfluenceCenters: readonly CellId[];
  readonly fallbackReason?: StrategicHookFallbackReason;
}

export interface StrategicOriginPhaseEvidence {
  readonly submittedOrigins?: readonly CellId[];
  readonly resolvedRequestedOrigins: readonly CellId[];
  readonly fallbackReason?: StrategicHookFallbackReason;
}

export interface StrategicOriginEvidence {
  readonly originSlot: number;
  readonly requestedOrigin: CellId;
  readonly resolvedExactOrigin: CellId;
  readonly diagnostics: readonly string[];
}

export interface StrategicFactionEvidence {
  readonly factionId: string;
  readonly phase1: StrategicInfluenceEvidence;
  readonly phase2: StrategicInfluenceEvidence;
  readonly phase3: StrategicOriginPhaseEvidence;
  readonly origins: readonly StrategicOriginEvidence[];
}

export interface StrategicSpawnEvidence {
  readonly spawnResolverVersion: typeof SPAWN_RESOLVER_VERSION;
  readonly stableTie32Id: typeof SPAWN_STABLE_TIE32_ID;
  readonly factions: readonly StrategicFactionEvidence[];
}

export interface StrategicSpawnResolution {
  readonly initialization: SpawnInitializationInput;
  readonly evidence: StrategicSpawnEvidence;
}

interface StrategicFactionContext {
  readonly factionId: string;
  readonly base: StrategicSpawnBaseContextInput;
}

interface InfluenceResolution {
  readonly submittedInfluenceCenters?: readonly CellId[];
  readonly resolvedInfluenceCenters: readonly CellId[];
  readonly fallbackReason?: StrategicHookFallbackReason;
}

interface OriginRequestResolution {
  readonly submittedOrigins?: readonly CellId[];
  readonly resolvedRequestedOrigins: readonly CellId[];
  readonly fallbackReason?: StrategicHookFallbackReason;
}

interface RequestedOriginSlot {
  readonly faction: StrategicFactionContext;
  readonly originSlot: number;
  readonly requestedOrigin: CellId;
  readonly influenceCenter: CellId;
}

interface CommittedOriginSlot {
  readonly factionId: string;
  readonly originSlot: number;
  readonly cellId: CellId;
}

interface ResolvedOriginSlot extends CommittedOriginSlot {
  readonly requestedOrigin: CellId;
  readonly resolutionReason?: "ORIGIN_IN_REGION_FALLBACK" | "ORIGIN_GLOBAL_FALLBACK";
  readonly diagnostics: readonly string[];
}

function freezeCells(cells: readonly CellId[]): readonly CellId[] {
  return Object.freeze([...cells]);
}

function hookFallbackReason<T>(
  result: ControllerHostInvocationResult<T>,
): StrategicHookFallbackReason | undefined {
  if (!result.ok) {
    const classification = (
      result.fault as typeof result.fault & {
        readonly classification?: "INVALID_OUTPUT";
      }
    ).classification;
    if (classification === "INVALID_OUTPUT") return "HOOK_MALFORMED";
    return result.fault.code === "RUNTIME_ERROR"
      ? "HOOK_RUNTIME_FAULT"
      : "HOOK_MALFORMED";
  }
  return result.output === undefined ? "HOOK_MISSING" : undefined;
}

function legalSpawnSeeds(state: MatchState): readonly CellId[] {
  const result: CellId[] = [];
  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    if (
      state.fallout[cellId] !== true &&
      isExactSpawnSeedTerrain(state.map.terrainAt(cellId))
    ) {
      result.push(cellId);
    }
  }
  return Object.freeze(result);
}

function structurallyValidInfluenceCenters(
  state: MatchState,
  faction: StrategicFactionContext,
  value: unknown,
): value is readonly CellId[] {
  return (
    Array.isArray(value) &&
    value.length === faction.base.profile.influenceSlotCount &&
    value.every(
      (center) =>
        Number.isSafeInteger(center) && state.map.isValidCellId(center),
    )
  );
}

function defaultInfluenceCenters(
  state: MatchState,
  legalSeeds: readonly CellId[],
  faction: StrategicFactionContext,
): readonly CellId[] {
  const used = new Set<CellId>();
  const result: CellId[] = [];
  for (
    let influenceSlot = 0;
    influenceSlot < faction.base.profile.influenceSlotCount;
    influenceSlot += 1
  ) {
    const candidate = [...legalSeeds]
      .filter((cellId) => !used.has(cellId))
      .sort((left, right) => {
        const tie =
          stableTie32(
            "default-influence-center",
            SPAWN_RESOLVER_VERSION,
            state.seed,
            faction.factionId,
            influenceSlot,
            left,
          ) -
          stableTie32(
            "default-influence-center",
            SPAWN_RESOLVER_VERSION,
            state.seed,
            faction.factionId,
            influenceSlot,
            right,
          );
        return tie === 0 ? left - right : tie;
      })[0];
    if (candidate === undefined) {
      throw new Error("ORIGIN_GLOBAL_UNFILLABLE");
    }
    used.add(candidate);
    result.push(candidate);
  }
  return freezeCells(result);
}

function resolvePhase1Influence(
  state: MatchState,
  legalSeeds: readonly CellId[],
  faction: StrategicFactionContext,
  result: ControllerHostInvocationResult<SpawnInfluenceDecision>,
): InfluenceResolution {
  let fallbackReason = hookFallbackReason(result);
  if (fallbackReason === undefined && result.ok) {
    const centers = result.output?.centers;
    if (structurallyValidInfluenceCenters(state, faction, centers)) {
      const frozen = freezeCells(centers);
      return Object.freeze({
        submittedInfluenceCenters: frozen,
        resolvedInfluenceCenters: frozen,
      });
    }
    fallbackReason = "HOOK_MALFORMED";
  }
  return Object.freeze({
    resolvedInfluenceCenters: defaultInfluenceCenters(
      state,
      legalSeeds,
      faction,
    ),
    fallbackReason: fallbackReason!,
  });
}

function resolvePhase2Influence(
  state: MatchState,
  faction: StrategicFactionContext,
  phase1Centers: readonly CellId[],
  result: ControllerHostInvocationResult<SpawnInfluenceDecision>,
): InfluenceResolution {
  let fallbackReason = hookFallbackReason(result);
  if (fallbackReason === undefined && result.ok) {
    const centers = result.output?.centers;
    if (structurallyValidInfluenceCenters(state, faction, centers)) {
      const frozen = freezeCells(centers);
      return Object.freeze({
        submittedInfluenceCenters: frozen,
        resolvedInfluenceCenters: frozen,
      });
    }
    fallbackReason = "HOOK_MALFORMED";
  }
  return Object.freeze({
    resolvedInfluenceCenters: freezeCells(phase1Centers),
    fallbackReason: fallbackReason!,
  });
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

function insideInfluenceRegion(
  state: MatchState,
  faction: StrategicFactionContext,
  influenceCenters: readonly CellId[],
  cellId: CellId,
  slotIndex: number,
): boolean {
  const center = influenceCenters[slotIndex];
  const area = faction.base.profile.influenceAreaCells[slotIndex];
  return (
    center !== undefined &&
    area !== undefined &&
    Number.isSafeInteger(area) &&
    area >= 0 &&
    squaredDistance(state, cellId, center) <= area
  );
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

function structurallyValidOriginDecision(
  state: MatchState,
  faction: StrategicFactionContext,
  value: unknown,
): value is readonly CellId[] {
  return (
    Array.isArray(value) &&
    value.length === faction.base.profile.exactOriginCount &&
    value.every(
      (cellId) =>
        Number.isSafeInteger(cellId) && state.map.isValidCellId(cellId),
    )
  );
}

function compareOriginCandidate(
  state: MatchState,
  factionId: string,
  originSlot: number,
  distanceFrom: CellId,
  domain: "exact-origin-cell" | "exact-origin-global-cell",
  left: CellId,
  right: CellId,
): number {
  const distance =
    squaredDistance(state, left, distanceFrom) -
    squaredDistance(state, right, distanceFrom);
  if (distance !== 0) return distance;
  const tie =
    stableTie32(
      domain,
      SPAWN_RESOLVER_VERSION,
      state.seed,
      factionId,
      originSlot,
      left,
    ) -
    stableTie32(
      domain,
      SPAWN_RESOLVER_VERSION,
      state.seed,
      factionId,
      originSlot,
      right,
    );
  return tie === 0 ? left - right : tie;
}

function nearestLegalInRegion(
  state: MatchState,
  legalSeeds: readonly CellId[],
  faction: StrategicFactionContext,
  influenceCenters: readonly CellId[],
  originSlot: number,
  distanceFrom: CellId,
): CellId | undefined {
  return [...legalSeeds]
    .filter((cellId) =>
      insideInfluenceRegion(
        state,
        faction,
        influenceCenters,
        cellId,
        originSlot,
      ),
    )
    .sort((left, right) =>
      compareOriginCandidate(
        state,
        faction.factionId,
        originSlot,
        distanceFrom,
        "exact-origin-cell",
        left,
        right,
      ),
    )[0];
}

function defaultOriginRequests(
  state: MatchState,
  legalSeeds: readonly CellId[],
  faction: StrategicFactionContext,
  influenceCenters: readonly CellId[],
): readonly CellId[] {
  const result: CellId[] = [];
  for (
    let originSlot = 0;
    originSlot < faction.base.profile.exactOriginCount;
    originSlot += 1
  ) {
    const center = influenceCenters[originSlot];
    if (center === undefined) {
      throw new Error(
        `Strategic Spawn missing final influence center ${faction.factionId}/${originSlot}`,
      );
    }
    const inRegion = nearestLegalInRegion(
      state,
      legalSeeds,
      faction,
      influenceCenters,
      originSlot,
      center,
    );
    const candidate =
      inRegion ??
      [...legalSeeds].sort((left, right) =>
        compareOriginCandidate(
          state,
          faction.factionId,
          originSlot,
          center,
          "exact-origin-global-cell",
          left,
          right,
        ),
      )[0];
    if (candidate === undefined) {
      throw new Error("ORIGIN_GLOBAL_UNFILLABLE");
    }
    result.push(candidate);
  }
  return freezeCells(result);
}

function resolveOriginRequest(
  state: MatchState,
  legalSeeds: readonly CellId[],
  faction: StrategicFactionContext,
  influenceCenters: readonly CellId[],
  result: ControllerHostInvocationResult<SpawnOriginDecision>,
): OriginRequestResolution {
  let fallbackReason = hookFallbackReason(result);
  if (fallbackReason === undefined && result.ok) {
    const origins = result.output?.origins;
    if (structurallyValidOriginDecision(state, faction, origins)) {
      const frozen = freezeCells(origins);
      return Object.freeze({
        submittedOrigins: frozen,
        resolvedRequestedOrigins: frozen,
      });
    }
    fallbackReason = "HOOK_MALFORMED";
  }
  return Object.freeze({
    resolvedRequestedOrigins: defaultOriginRequests(
      state,
      legalSeeds,
      faction,
      influenceCenters,
    ),
    fallbackReason: fallbackReason!,
  });
}

function compatibleWithCommitted(
  state: MatchState,
  factionId: string,
  cellId: CellId,
  committed: readonly CommittedOriginSlot[],
): boolean {
  for (const origin of committed) {
    if (origin.factionId === factionId) {
      if (origin.cellId === cellId) return false;
    } else if (
      !foreignSpawnOriginsMeetSpacing(state.map, cellId, origin.cellId)
    ) {
      return false;
    }
  }
  return true;
}

function semanticDiagnostics(
  state: MatchState,
  slot: RequestedOriginSlot,
  influenceCenters: readonly CellId[],
  committed: readonly CommittedOriginSlot[],
): readonly string[] {
  const diagnostics: string[] = [];
  if (
    !insideInfluenceRegion(
      state,
      slot.faction,
      influenceCenters,
      slot.requestedOrigin,
      slot.originSlot,
    )
  ) {
    diagnostics.push("ORIGIN_OUTSIDE_INFLUENCE");
  }
  if (
    state.fallout[slot.requestedOrigin] === true ||
    !isExactSpawnSeedTerrain(state.map.terrainAt(slot.requestedOrigin))
  ) {
    diagnostics.push("ORIGIN_ILLEGAL_TERRAIN");
  }
  for (const origin of committed) {
    if (
      origin.factionId === slot.faction.factionId &&
      origin.cellId === slot.requestedOrigin
    ) {
      diagnostics.push("ORIGIN_DUPLICATE_OWN_SLOT");
      break;
    }
  }
  for (const origin of committed) {
    if (
      origin.factionId !== slot.faction.factionId &&
      !foreignSpawnOriginsMeetSpacing(
        state.map,
        slot.requestedOrigin,
        origin.cellId,
      )
    ) {
      diagnostics.push("ORIGIN_FOREIGN_SPACING_CONFLICT");
      break;
    }
  }
  return Object.freeze(diagnostics);
}

function resolveRequestedOrigins(
  state: MatchState,
  legalSeeds: readonly CellId[],
  factions: readonly StrategicFactionContext[],
  influenceByFaction: ReadonlyMap<string, readonly CellId[]>,
  requestsByFaction: ReadonlyMap<string, OriginRequestResolution>,
): readonly ResolvedOriginSlot[] {
  const requested: RequestedOriginSlot[] = [];
  for (const faction of factions) {
    const centers = influenceByFaction.get(faction.factionId)!;
    const origins = requestsByFaction.get(faction.factionId)!.resolvedRequestedOrigins;
    for (let originSlot = 0; originSlot < origins.length; originSlot += 1) {
      requested.push(
        Object.freeze({
          faction,
          originSlot,
          requestedOrigin: origins[originSlot]!,
          influenceCenter: centers[originSlot]!,
        }),
      );
    }
  }
  requested.sort((left, right) => {
    const tie =
      stableTie32(
        "exact-origin-priority",
        SPAWN_RESOLVER_VERSION,
        state.seed,
        left.faction.factionId,
        left.originSlot,
      ) -
      stableTie32(
        "exact-origin-priority",
        SPAWN_RESOLVER_VERSION,
        state.seed,
        right.faction.factionId,
        right.originSlot,
      );
    if (tie !== 0) return tie;
    const factionOrder = compareSpawnUtf8(
      left.faction.factionId,
      right.faction.factionId,
    );
    return factionOrder !== 0 ? factionOrder : left.originSlot - right.originSlot;
  });

  const committed: CommittedOriginSlot[] = [];
  const resolved: ResolvedOriginSlot[] = [];
  for (const slot of requested) {
    const centers = influenceByFaction.get(slot.faction.factionId)!;
    const initialDiagnostics = semanticDiagnostics(
      state,
      slot,
      centers,
      committed,
    );
    if (
      initialDiagnostics.length === 0 &&
      compatibleWithCommitted(
        state,
        slot.faction.factionId,
        slot.requestedOrigin,
        committed,
      )
    ) {
      const result = Object.freeze({
        factionId: slot.faction.factionId,
        originSlot: slot.originSlot,
        cellId: slot.requestedOrigin,
        requestedOrigin: slot.requestedOrigin,
        diagnostics: Object.freeze(["ORIGIN_ACCEPTED"]),
      }) satisfies ResolvedOriginSlot;
      committed.push(result);
      resolved.push(result);
      continue;
    }

    const inRegion = [...legalSeeds]
      .filter(
        (cellId) =>
          insideInfluenceRegion(
            state,
            slot.faction,
            centers,
            cellId,
            slot.originSlot,
          ) &&
          compatibleWithCommitted(
            state,
            slot.faction.factionId,
            cellId,
            committed,
          ),
      )
      .sort((left, right) =>
        compareOriginCandidate(
          state,
          slot.faction.factionId,
          slot.originSlot,
          slot.requestedOrigin,
          "exact-origin-cell",
          left,
          right,
        ),
      )[0];

    if (inRegion !== undefined) {
      const result = Object.freeze({
        factionId: slot.faction.factionId,
        originSlot: slot.originSlot,
        cellId: inRegion,
        requestedOrigin: slot.requestedOrigin,
        resolutionReason: "ORIGIN_IN_REGION_FALLBACK" as const,
        diagnostics: Object.freeze([
          ...initialDiagnostics,
          "ORIGIN_IN_REGION_FALLBACK",
        ]),
      }) satisfies ResolvedOriginSlot;
      committed.push(result);
      resolved.push(result);
      continue;
    }

    const global = [...legalSeeds]
      .filter((cellId) =>
        compatibleWithCommitted(
          state,
          slot.faction.factionId,
          cellId,
          committed,
        ),
      )
      .sort((left, right) =>
        compareOriginCandidate(
          state,
          slot.faction.factionId,
          slot.originSlot,
          slot.influenceCenter,
          "exact-origin-global-cell",
          left,
          right,
        ),
      )[0];

    if (global === undefined) {
      throw new Error("ORIGIN_GLOBAL_UNFILLABLE");
    }
    const result = Object.freeze({
      factionId: slot.faction.factionId,
      originSlot: slot.originSlot,
      cellId: global,
      requestedOrigin: slot.requestedOrigin,
      resolutionReason: "ORIGIN_GLOBAL_FALLBACK" as const,
      diagnostics: Object.freeze([
        ...initialDiagnostics,
        "ORIGIN_GLOBAL_FALLBACK",
      ]),
    }) satisfies ResolvedOriginSlot;
    committed.push(result);
    resolved.push(result);
  }
  return Object.freeze(resolved);
}

function expectedInfluenceAreaCells(exactOriginCount: number): readonly number[] {
  if (exactOriginCount === 1) {
    return Object.freeze([ORDINARY_INFLUENCE_AREA_CELLS]);
  }
  if (exactOriginCount === 2) {
    return Object.freeze([
      SPLIT_TWO_INFLUENCE_AREA_CELLS,
      SPLIT_TWO_INFLUENCE_AREA_CELLS,
    ]);
  }
  throw new Error(`Strategic Spawn unsupported effective origin count ${exactOriginCount}`);
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
      const expectedAreas = expectedInfluenceAreaCells(effective.exactOriginCount);
      if (
        entry.base.profile.influenceSlotCount !== effective.exactOriginCount ||
        entry.base.profile.influenceAreaCells.length !== expectedAreas.length ||
        entry.base.profile.influenceAreaCells.some(
          (area, index) => area !== expectedAreas[index],
        )
      ) {
        throw new Error(`Strategic Spawn public profile does not match effective rules for ${entry.factionId}`);
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

function influenceEvidence(
  resolution: InfluenceResolution,
): StrategicInfluenceEvidence {
  return Object.freeze({
    ...(resolution.submittedInfluenceCenters === undefined
      ? {}
      : {
          submittedInfluenceCenters: freezeCells(
            resolution.submittedInfluenceCenters,
          ),
        }),
    resolvedInfluenceCenters: freezeCells(
      resolution.resolvedInfluenceCenters,
    ),
    ...(resolution.fallbackReason === undefined
      ? {}
      : { fallbackReason: resolution.fallbackReason }),
  });
}

function originPhaseEvidence(
  resolution: OriginRequestResolution,
): StrategicOriginPhaseEvidence {
  return Object.freeze({
    ...(resolution.submittedOrigins === undefined
      ? {}
      : { submittedOrigins: freezeCells(resolution.submittedOrigins) }),
    resolvedRequestedOrigins: freezeCells(
      resolution.resolvedRequestedOrigins,
    ),
    ...(resolution.fallbackReason === undefined
      ? {}
      : { fallbackReason: resolution.fallbackReason }),
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
  const legalSeeds = legalSpawnSeeds(input.state);

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
  const phase1ByFaction = new Map<string, InfluenceResolution>();
  for (let index = 0; index < factions.length; index += 1) {
    const faction = factions[index]!;
    phase1ByFaction.set(
      faction.factionId,
      resolvePhase1Influence(
        input.state,
        legalSeeds,
        faction,
        phase1Results[index]!.result,
      ),
    );
  }
  const phase1CentersByFaction = new Map(
    factions.map((faction) => [
      faction.factionId,
      phase1ByFaction.get(faction.factionId)!.resolvedInfluenceCenters,
    ]),
  );
  const phase1Reveal = revealedFactions(factions, phase1CentersByFaction);

  const phase2Results = await Promise.all(
    factions.map(async (faction) => {
      const currentInfluenceCenters = phase1CentersByFaction.get(
        faction.factionId,
      )!;
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
  const phase2ByFaction = new Map<string, InfluenceResolution>();
  for (let index = 0; index < factions.length; index += 1) {
    const faction = factions[index]!;
    phase2ByFaction.set(
      faction.factionId,
      resolvePhase2Influence(
        input.state,
        faction,
        phase1CentersByFaction.get(faction.factionId)!,
        phase2Results[index]!.result,
      ),
    );
  }
  const finalInfluenceByFaction = new Map(
    factions.map((faction) => [
      faction.factionId,
      phase2ByFaction.get(faction.factionId)!.resolvedInfluenceCenters,
    ]),
  );
  const finalInfluenceReveal = revealedFactions(
    factions,
    finalInfluenceByFaction,
  );

  const phase3Results = await Promise.all(
    factions.map(async (faction) => {
      const influenceCenters = finalInfluenceByFaction.get(
        faction.factionId,
      )!;
      const context = Object.freeze({
        ...phaseBase(faction, participants),
        phase: "ORIGIN" as const,
        influenceCenters,
        revealedFactions: finalInfluenceReveal,
        spawn: createSpawnOriginApi(
          input.state,
          faction.base.profile,
          influenceCenters,
        ),
      }) satisfies SpawnOriginContext;
      return Object.freeze({
        factionId: faction.factionId,
        result: await input.host.chooseOrigins(faction.factionId, context),
      });
    }),
  );
  const phase3ByFaction = new Map<string, OriginRequestResolution>();
  for (let index = 0; index < factions.length; index += 1) {
    const faction = factions[index]!;
    phase3ByFaction.set(
      faction.factionId,
      resolveOriginRequest(
        input.state,
        legalSeeds,
        faction,
        finalInfluenceByFaction.get(faction.factionId)!,
        phase3Results[index]!.result,
      ),
    );
  }

  const resolvedSlots = resolveRequestedOrigins(
    input.state,
    legalSeeds,
    factions,
    finalInfluenceByFaction,
    phase3ByFaction,
  );
  const resolvedByFaction = new Map<string, readonly ResolvedOriginSlot[]>();
  for (const faction of factions) {
    resolvedByFaction.set(
      faction.factionId,
      Object.freeze(
        resolvedSlots
          .filter((slot) => slot.factionId === faction.factionId)
          .sort((left, right) => left.originSlot - right.originSlot),
      ),
    );
  }

  const initialization = Object.freeze({
    spawnMode: "STRATEGIC" as const,
    spawnResolverVersion: SPAWN_RESOLVER_VERSION,
    factions: Object.freeze(
      factions.map((faction) =>
        Object.freeze({
          factionId: faction.factionId,
          origins: Object.freeze(
            resolvedByFaction.get(faction.factionId)!.map((origin) =>
              Object.freeze({
                originSlot: origin.originSlot,
                resolvedExactOrigin: origin.cellId,
                source: "STRATEGIC_SUBMISSION" as const,
                ...(origin.resolutionReason === undefined
                  ? {}
                  : { resolutionReason: origin.resolutionReason }),
              }),
            ),
          ),
        }),
      ),
    ),
  }) satisfies SpawnInitializationInput;

  validateResolvedSpawnOrigins(input.state, initialization);

  const evidence = Object.freeze({
    spawnResolverVersion: SPAWN_RESOLVER_VERSION,
    stableTie32Id: SPAWN_STABLE_TIE32_ID,
    factions: Object.freeze(
      factions.map((faction) =>
        Object.freeze({
          factionId: faction.factionId,
          phase1: influenceEvidence(phase1ByFaction.get(faction.factionId)!),
          phase2: influenceEvidence(phase2ByFaction.get(faction.factionId)!),
          phase3: originPhaseEvidence(phase3ByFaction.get(faction.factionId)!),
          origins: Object.freeze(
            resolvedByFaction.get(faction.factionId)!.map((origin) =>
              Object.freeze({
                originSlot: origin.originSlot,
                requestedOrigin: origin.requestedOrigin,
                resolvedExactOrigin: origin.cellId,
                diagnostics: Object.freeze([...origin.diagnostics]),
              }),
            ),
          ),
        }),
      ),
    ),
  }) satisfies StrategicSpawnEvidence;

  return Object.freeze({ initialization, evidence });
}
