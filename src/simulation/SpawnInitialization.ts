import type { TerrainType } from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  selectRuleContributionsForScope,
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import { materializeCompiledScalarRule } from "../core/rules/RuleMaterialization";
import { landTerrainBaseSpec } from "./LandOperations";
import { mapArtifactHash } from "./MapArtifact";
import {
  createProspectiveMatchState,
  type MatchFactionState,
  type MatchState,
} from "./MatchState";
import type {
  ResolvedSpawnOrigin,
  SpawnInitializationInput,
  SpawnMode,
  SpawnOriginSource,
} from "./MatchSpec";
import { createPopulationState } from "./Population";
import type { SimulationMap, SimulationTerrain } from "./SimulationMap";
import {
  tryMaterializeStructureGrant,
  type StructureAdmissionFailureCode,
} from "./Structures";

export const SPAWN_RESOLVER_VERSION = "1" as const;
export const SPAWN_STABLE_TIE32_ID = "FNV1A32_LENPREFIX_V1" as const;
export const SPAWN_IMMUNITY_TICKS = 50 as const;
export const SPAWN_STAR_TEMPLATE_ID = "P54_STAR_V1" as const;
export const SPAWN_STAR_TEMPLATE_SHA256 =
  "52318cc016a674164fc4861468e29b24b177b8fc35287337a55a11d1b6773440" as const;

const ORDINARY_INITIAL_TERRITORY = 1_000;
const ORDINARY_STARTING_POPULATION_FRACTION = 0.5;
const UTF8_ENCODER = new TextEncoder();
const GLOBAL_SCOPE = { kind: "GLOBAL" } as const satisfies RuleScope;
const STAR_VERTICES = Object.freeze([
  Object.freeze([0, 24576] as const),
  Object.freeze([2408, 3314] as const),
  Object.freeze([23373, 7594] as const),
  Object.freeze([3896, -1266] as const),
  Object.freeze([14445, -19882] as const),
  Object.freeze([0, -4096] as const),
  Object.freeze([-14445, -19882] as const),
  Object.freeze([-3896, -1266] as const),
  Object.freeze([-23373, 7594] as const),
  Object.freeze([-2408, 3314] as const),
]);

export interface EffectiveSpawnProfileSnapshot {
  readonly exactOriginCount: number;
  readonly initialTerritoryPopulationBearingQuota: number;
  readonly footprintShapeProfile: "COMPACT" | "STAR";
}

export interface SpawnFootprintSnapshot {
  readonly footprintSlot: number;
  readonly populationBearingQuota: number;
  readonly populationBearingClaimed: number;
  readonly totalCellsClaimed: number;
  readonly zeroCapacityCellsClaimed: number;
  readonly contestsWon: number;
  readonly contestsLost: number;
  readonly boundingBox: Readonly<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>;
  readonly shapeProfile: "COMPACT" | "STAR";
  readonly shapeTemplateId?: typeof SPAWN_STAR_TEMPLATE_ID;
  readonly shapeTemplateSha256?: typeof SPAWN_STAR_TEMPLATE_SHA256;
  readonly cellIds: readonly number[];
  readonly cellSetSha256: string;
}

export interface SpawnSingularEffectSnapshot {
  readonly effectId: string;
  readonly domain: string;
  readonly result: "GRANTED" | "REJECTED";
  readonly cellId?: number;
  readonly failureCode?: StructureAdmissionFailureCode;
}

export interface SpawnFactionSnapshot {
  readonly factionId: string;
  readonly effectiveSpawnProfile: EffectiveSpawnProfileSnapshot;
  readonly origins: readonly ResolvedSpawnOrigin[];
  readonly footprints: readonly SpawnFootprintSnapshot[];
  readonly singularEffects: readonly SpawnSingularEffectSnapshot[];
}

export interface SpawnSnapshot {
  readonly spawnMode: SpawnMode;
  readonly spawnResolverVersion: typeof SPAWN_RESOLVER_VERSION;
  readonly stableTie32Id: typeof SPAWN_STABLE_TIE32_ID;
  readonly factions: readonly SpawnFactionSnapshot[];
}

export interface SpawnInitializationResult {
  readonly state: MatchState;
  readonly snapshot: SpawnSnapshot;
  readonly immunityEndsAtTickExclusive: number;
}

interface MaterializedSpawnProfile {
  readonly exactOriginCount: number;
  readonly initialTerritoryPopulationBearingQuota: number;
  readonly footprintShapeProfile: "COMPACT" | "STAR";
  readonly startingPopulation: number;
}

interface CandidatePriority {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly tie: number;
  readonly cellId: number;
}

interface FrontierCandidate extends CandidatePriority {}

interface MutableFootprint {
  readonly factionId: string;
  readonly footprintSlot: number;
  readonly originCellId: number;
  readonly quota: number;
  readonly shapeProfile: "COMPACT" | "STAR";
  readonly rules: CompiledRuleProfile;
  readonly claimed: Set<number>;
  readonly queued: Set<number>;
  readonly frontier: CandidateHeap;
  populationBearingClaimed: number;
  contestsWon: number;
  contestsLost: number;
}

function compareUtf8(left: string, right: string): number {
  const a = UTF8_ENCODER.encode(left);
  const b = UTF8_ENCODER.encode(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = a[index]! - b[index]!;
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
}

function canonicalStableField(value: string | number): Uint8Array {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error("stableTie32 numeric keys must be safe integers");
    }
    return UTF8_ENCODER.encode(String(value));
  }
  return UTF8_ENCODER.encode(value);
}

export function stableTie32(
  domain: string,
  version: string,
  matchSeed: string,
  ...keys: readonly (string | number)[]
): number {
  const fields = [domain, version, matchSeed, ...keys].map(canonicalStableField);
  let hash = 0x811c9dc5;
  for (const field of fields) {
    const length = field.byteLength;
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (length >>> shift) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    for (const byte of field) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

function comparePriority(left: CandidatePriority, right: CandidatePriority): number {
  const lhs = left.numerator * right.denominator;
  const rhs = right.numerator * left.denominator;
  if (lhs < rhs) return -1;
  if (lhs > rhs) return 1;
  if (left.tie !== right.tie) return left.tie - right.tie;
  return left.cellId - right.cellId;
}

class CandidateHeap {
  private readonly values: FrontierCandidate[] = [];

  push(value: FrontierCandidate): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (comparePriority(this.values[parent]!, value) <= 0) break;
      this.values[index] = this.values[parent]!;
      index = parent;
    }
    this.values[index] = value;
  }

  pop(): FrontierCandidate | undefined {
    const root = this.values[0];
    const tail = this.values.pop();
    if (root === undefined || tail === undefined || this.values.length === 0) {
      return root;
    }
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.values.length) break;
      const right = left + 1;
      let child = left;
      if (
        right < this.values.length &&
        comparePriority(this.values[right]!, this.values[left]!) < 0
      ) {
        child = right;
      }
      if (comparePriority(tail, this.values[child]!) <= 0) break;
      this.values[index] = this.values[child]!;
      index = child;
    }
    this.values[index] = tail;
    return root;
  }
}

function materializationState() {
  return Object.freeze({
    ownedPersistentStructureCount: 0,
    territorialContactCount: 0,
    peakTotalPopulation: 0,
  });
}

function structuralProfile(
  rules: CompiledRuleProfile,
  axis: "SPAWN_PROFILE" | "SPAWN_FOOTPRINT_PROFILE",
): string | undefined {
  if (rules.dynamicProviders.some((provider) => provider.axis === axis)) {
    throw new Error(`${axis} cannot depend on runtime dynamic state during Spawn initialization`);
  }
  const terms = rules.normalizedRules.filter(
    (entry) => entry.axis === axis && entry.scope.kind === "GLOBAL",
  );
  if (terms.length === 0) return undefined;
  if (terms.length !== 1 || terms[0]?.value.kind !== "SINGLETON") {
    throw new Error(`${axis} must materialize as one structural profile`);
  }
  const value = terms[0].value.value;
  if (typeof value !== "string") {
    throw new Error(`${axis} structural profile must be a string`);
  }
  return value;
}

function materializeSpawnProfile(rules: CompiledRuleProfile): MaterializedSpawnProfile {
  for (const provider of rules.dynamicProviders) {
    if (
      provider.axis === "INITIAL_TERRITORY_QUOTA" ||
      provider.axis === "STARTING_POPULATION_FRACTION"
    ) {
      throw new Error(
        `${provider.axis} dynamic Spawn materialization requires an explicit pre-match authority`,
      );
    }
  }
  const territory = materializeCompiledScalarRule(
    ORDINARY_INITIAL_TERRITORY,
    rules,
    RULE_AXIS_REGISTRY,
    "INITIAL_TERRITORY_QUOTA",
    GLOBAL_SCOPE,
    materializationState(),
  );
  const startingFraction = materializeCompiledScalarRule(
    ORDINARY_STARTING_POPULATION_FRACTION,
    rules,
    RULE_AXIS_REGISTRY,
    "STARTING_POPULATION_FRACTION",
    GLOBAL_SCOPE,
    materializationState(),
  );
  if (!Number.isSafeInteger(territory) || territory <= 0) {
    throw new Error("final Initial-Territory quota must be a positive whole safe integer");
  }
  const startingPopulation = territory * startingFraction;
  if (!Number.isSafeInteger(startingPopulation) || startingPopulation < 0) {
    throw new Error("final Starting Population must resolve to a non-negative whole safe integer");
  }

  const spawnProfile = structuralProfile(rules, "SPAWN_PROFILE");
  const footprintProfile = structuralProfile(rules, "SPAWN_FOOTPRINT_PROFILE");
  if (spawnProfile !== undefined && spawnProfile !== "SPLIT_TWO") {
    throw new Error(`unsupported effective Spawn profile ${spawnProfile}`);
  }
  if (footprintProfile !== undefined && footprintProfile !== "STAR") {
    throw new Error(`unsupported effective Spawn footprint profile ${footprintProfile}`);
  }
  return Object.freeze({
    exactOriginCount: spawnProfile === "SPLIT_TWO" ? 2 : 1,
    initialTerritoryPopulationBearingQuota: territory,
    footprintShapeProfile: footprintProfile === "STAR" ? "STAR" : "COMPACT",
    startingPopulation,
  });
}

function expectedSource(mode: SpawnMode): SpawnOriginSource {
  switch (mode) {
    case "STRATEGIC":
      return "STRATEGIC_SUBMISSION";
    case "RANDOM":
      return "RANDOM_RESOLUTION";
    case "FIXED":
      return "FIXED_CONFIGURATION";
  }
}

function ownableTerrain(terrain: SimulationTerrain): boolean {
  const base = landTerrainBaseSpec(terrain);
  return base.conquerable && base.landTraversable;
}

function conditionApplies(
  condition: RuleCondition,
  terrain: TerrainType,
  hasFallout: boolean,
): boolean {
  switch (condition.kind) {
    case "SOURCE_TERRAIN_IS":
    case "TARGET_TERRAIN_IS":
    case "EVENT_TERRAIN_IS":
    case "BUILD_TERRAIN_IS":
      return condition.terrain === terrain;
    case "TARGET_HAS_FALLOUT":
      return hasFallout;
    case "TARGET_LACKS_FALLOUT":
      return !hasFallout;
    default:
      return false;
  }
}

function isPopulationBearing(
  terrain: SimulationTerrain,
  hasFallout: boolean,
  rules: CompiledRuleProfile,
): boolean {
  const base = landTerrainBaseSpec(terrain).populationBearing;
  if (terrain === "TEST" || terrain === "DEEP_WATER" || terrain === "IMPASSABLE") {
    return base;
  }
  const scope = { kind: "TERRAIN", terrain } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "TERRAIN_POPULATION_BEARING_PERMISSION",
    scope,
    rules.contributions,
  ).filter(
    (entry) =>
      entry.conditions === undefined ||
      entry.conditions.every((condition) => conditionApplies(condition, terrain, hasFallout)),
  );
  return reducePermissionRule(
    base,
    RULE_AXIS_REGISTRY.TERRAIN_POPULATION_BEARING_PERMISSION,
    contributions,
  );
}

function cross(
  a: readonly [number, number],
  b: readonly [bigint, bigint],
): bigint {
  return BigInt(a[0]) * b[1] - BigInt(a[1]) * b[0];
}

function starScore(dx: number, dy: number): readonly [bigint, bigint] {
  if (dx === 0 && dy === 0) return [0n, 1n] as const;
  const p = [BigInt(dx), BigInt(dy)] as const;
  for (let index = 0; index < STAR_VERTICES.length; index += 1) {
    const a = STAR_VERTICES[index]!;
    const b = STAR_VERTICES[(index + 1) % STAR_VERTICES.length]!;
    const crossAP = cross(a, p);
    const crossPB = p[0] * BigInt(b[1]) - p[1] * BigInt(b[0]);
    if (crossAP <= 0n && crossPB <= 0n) {
      const crossAB = BigInt(a[0]) * BigInt(b[1]) - BigInt(a[1]) * BigInt(b[0]);
      return [-(crossPB + crossAP), -crossAB] as const;
    }
  }
  throw new Error("P54_STAR_V1 could not classify a nonzero candidate direction");
}

function candidatePriority(
  map: SimulationMap,
  seed: string,
  footprint: Pick<
    MutableFootprint,
    "factionId" | "footprintSlot" | "originCellId" | "shapeProfile"
  >,
  cellId: number,
): FrontierCandidate {
  const origin = map.positionOf(footprint.originCellId);
  const position = map.positionOf(cellId);
  const dx = position.x - origin.x;
  const dy = position.y - origin.y;
  if (footprint.shapeProfile === "STAR") {
    const [numerator, denominator] = starScore(dx, dy);
    return Object.freeze({
      numerator,
      denominator,
      tie: stableTie32(
        "spawn-star-cell",
        SPAWN_RESOLVER_VERSION,
        seed,
        footprint.factionId,
        footprint.footprintSlot,
        cellId,
      ),
      cellId,
    });
  }
  return Object.freeze({
    numerator: BigInt(dx) * BigInt(dx) + BigInt(dy) * BigInt(dy),
    denominator: 1n,
    tie: stableTie32(
      "spawn-compact-cell",
      SPAWN_RESOLVER_VERSION,
      seed,
      footprint.factionId,
      footprint.footprintSlot,
      cellId,
    ),
    cellId,
  });
}

function enqueueNeighbors(
  map: SimulationMap,
  fallout: readonly boolean[],
  seed: string,
  ownership: readonly (string | null)[],
  footprint: MutableFootprint,
  cellId: number,
): void {
  for (const neighbor of map.cardinalNeighbors(cellId)) {
    if (ownership[neighbor] !== null || footprint.queued.has(neighbor)) continue;
    if (fallout[neighbor] === true || !ownableTerrain(map.terrainAt(neighbor))) continue;
    footprint.queued.add(neighbor);
    footprint.frontier.push(candidatePriority(map, seed, footprint, neighbor));
  }
}

function nextLiveProposal(
  ownership: readonly (string | null)[],
  footprint: MutableFootprint,
): FrontierCandidate | undefined {
  while (true) {
    const candidate = footprint.frontier.pop();
    if (candidate === undefined) return undefined;
    if (ownership[candidate.cellId] === null) return candidate;
  }
}

function compareFootprintContest(
  seed: string,
  cellId: number,
  left: MutableFootprint,
  right: MutableFootprint,
): number {
  const leftTie = stableTie32(
    "spawn-footprint-cell",
    SPAWN_RESOLVER_VERSION,
    seed,
    cellId,
    left.factionId,
    left.footprintSlot,
  );
  const rightTie = stableTie32(
    "spawn-footprint-cell",
    SPAWN_RESOLVER_VERSION,
    seed,
    cellId,
    right.factionId,
    right.footprintSlot,
  );
  if (leftTie !== rightTie) return leftTie - rightTie;
  return compareUtf8(left.factionId, right.factionId) || left.footprintSlot - right.footprintSlot;
}

function splitQuota(total: number, slots: number): readonly number[] {
  if (slots === 1) return Object.freeze([total]);
  if (slots !== 2) throw new Error(`unsupported Spawn footprint count ${slots}`);
  const secondary = Math.floor(total / 2);
  return Object.freeze([total - secondary, secondary]);
}

function validateAndMaterializeInputs(
  state: MatchState,
  input: SpawnInitializationInput,
): readonly {
  readonly faction: MatchFactionState;
  readonly profile: MaterializedSpawnProfile;
  readonly origins: readonly ResolvedSpawnOrigin[];
}[] {
  if (input.spawnResolverVersion !== SPAWN_RESOLVER_VERSION) {
    throw new Error(`unsupported Spawn resolver version ${input.spawnResolverVersion}`);
  }
  if (input.factions.length !== state.factions.length) {
    throw new Error("Spawn initialization requires exactly one resolved input per faction");
  }
  const byFaction = new Map(input.factions.map((entry) => [entry.factionId, entry]));
  if (byFaction.size !== input.factions.length) {
    throw new Error("Spawn initialization contains duplicate faction inputs");
  }
  const usedOrigins = new Set<number>();
  const expected = expectedSource(input.spawnMode);
  const result = [...state.factions]
    .sort((left, right) => compareUtf8(left.id, right.id))
    .map((faction) => {
      const resolved = byFaction.get(faction.id);
      if (resolved === undefined) {
        throw new Error(`Spawn initialization is missing faction ${faction.id}`);
      }
      const profile = materializeSpawnProfile(faction.rules);
      const origins = [...resolved.origins].sort(
        (left, right) => left.originSlot - right.originSlot,
      );
      if (origins.length !== profile.exactOriginCount) {
        throw new Error(
          `Spawn input for ${faction.id} has ${origins.length} origins; expected ${profile.exactOriginCount}`,
        );
      }
      for (let slot = 0; slot < origins.length; slot += 1) {
        const origin = origins[slot]!;
        if (origin.originSlot !== slot) {
          throw new Error(`Spawn input for ${faction.id} has non-canonical origin slots`);
        }
        if (origin.source !== expected) {
          throw new Error(`Spawn input source ${origin.source} does not match ${input.spawnMode}`);
        }
        const cellId = origin.resolvedExactOrigin;
        if (!state.map.isValidCellId(cellId)) {
          throw new Error(`Spawn origin ${faction.id}/${slot} is outside the map`);
        }
        if (state.fallout[cellId] === true || !ownableTerrain(state.map.terrainAt(cellId))) {
          throw new Error(`Spawn origin ${faction.id}/${slot} is not ownable starting geography`);
        }
        if (usedOrigins.has(cellId)) {
          throw new Error(`Spawn initialization contains duplicate resolved origin cell ${cellId}`);
        }
        usedOrigins.add(cellId);
      }
      return Object.freeze({
        faction,
        profile,
        origins: Object.freeze(origins.map((origin) => Object.freeze({ ...origin }))),
      });
    });
  for (const entry of input.factions) {
    if (!state.factions.some((faction) => faction.id === entry.factionId)) {
      throw new Error(`Spawn initialization contains unknown faction ${entry.factionId}`);
    }
  }
  return Object.freeze(result);
}

function resolveFootprints(
  state: MatchState,
  materialized: ReturnType<typeof validateAndMaterializeInputs>,
): {
  readonly ownership: readonly (string | null)[];
  readonly footprints: readonly MutableFootprint[];
} {
  const ownership: (string | null)[] = Array.from(
    { length: state.map.cellCount },
    () => null,
  );
  const footprints: MutableFootprint[] = [];

  for (const entry of materialized) {
    const quotas = splitQuota(
      entry.profile.initialTerritoryPopulationBearingQuota,
      entry.profile.exactOriginCount,
    );
    for (const origin of entry.origins) {
      const cellId = origin.resolvedExactOrigin;
      const footprint: MutableFootprint = {
        factionId: entry.faction.id,
        footprintSlot: origin.originSlot,
        originCellId: cellId,
        quota: quotas[origin.originSlot]!,
        shapeProfile: entry.profile.footprintShapeProfile,
        rules: entry.faction.rules,
        claimed: new Set([cellId]),
        queued: new Set([cellId]),
        frontier: new CandidateHeap(),
        populationBearingClaimed: isPopulationBearing(
          state.map.terrainAt(cellId),
          state.fallout[cellId] ?? false,
          entry.faction.rules,
        )
          ? 1
          : 0,
        contestsWon: 0,
        contestsLost: 0,
      };
      ownership[cellId] = entry.faction.id;
      footprints.push(footprint);
    }
  }

  for (const footprint of footprints) {
    enqueueNeighbors(
      state.map,
      state.fallout,
      state.seed,
      ownership,
      footprint,
      footprint.originCellId,
    );
  }

  while (footprints.some((footprint) => footprint.populationBearingClaimed < footprint.quota)) {
    const proposals = new Map<
      number,
      Array<{ footprint: MutableFootprint; candidate: FrontierCandidate }>
    >();
    for (const footprint of footprints) {
      if (footprint.populationBearingClaimed >= footprint.quota) continue;
      const candidate = nextLiveProposal(ownership, footprint);
      if (candidate === undefined) {
        throw new Error(
          `FOOTPRINT_QUOTA_UNFILLABLE:${footprint.factionId}/${footprint.footprintSlot}`,
        );
      }
      const group = proposals.get(candidate.cellId) ?? [];
      group.push({ footprint, candidate });
      proposals.set(candidate.cellId, group);
    }

    const winners: Array<{ footprint: MutableFootprint; cellId: number }> = [];
    for (const [cellId, group] of proposals) {
      group.sort((left, right) =>
        compareFootprintContest(state.seed, cellId, left.footprint, right.footprint),
      );
      const winner = group[0]!;
      if (group.length > 1) {
        winner.footprint.contestsWon += 1;
        for (const loser of group.slice(1)) loser.footprint.contestsLost += 1;
      }
      winners.push({ footprint: winner.footprint, cellId });
    }

    for (const winner of winners) {
      if (ownership[winner.cellId] !== null) {
        throw new Error("Spawn simultaneous commit encountered a pre-claimed cell");
      }
      ownership[winner.cellId] = winner.footprint.factionId;
      winner.footprint.claimed.add(winner.cellId);
      if (
        isPopulationBearing(
          state.map.terrainAt(winner.cellId),
          state.fallout[winner.cellId] ?? false,
          winner.footprint.rules,
        )
      ) {
        winner.footprint.populationBearingClaimed += 1;
      }
    }
    for (const winner of winners) {
      enqueueNeighbors(
        state.map,
        state.fallout,
        state.seed,
        ownership,
        winner.footprint,
        winner.cellId,
      );
    }
  }

  return Object.freeze({ ownership: Object.freeze(ownership), footprints });
}

function footprintHash(cellIds: readonly number[]): string {
  return mapArtifactHash([
    Object.freeze({
      path: "spawn-cell-set-v1",
      bytes: UTF8_ENCODER.encode(cellIds.join(",")),
    }),
  ]);
}

function footprintSnapshot(
  map: SimulationMap,
  footprint: MutableFootprint,
): SpawnFootprintSnapshot {
  const cellIds = Object.freeze([...footprint.claimed].sort((a, b) => a - b));
  let minX = Number.MAX_SAFE_INTEGER;
  let minY = Number.MAX_SAFE_INTEGER;
  let maxX = Number.MIN_SAFE_INTEGER;
  let maxY = Number.MIN_SAFE_INTEGER;
  for (const cellId of cellIds) {
    const position = map.positionOf(cellId);
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x);
    maxY = Math.max(maxY, position.y);
  }
  return Object.freeze({
    footprintSlot: footprint.footprintSlot,
    populationBearingQuota: footprint.quota,
    populationBearingClaimed: footprint.populationBearingClaimed,
    totalCellsClaimed: cellIds.length,
    zeroCapacityCellsClaimed: cellIds.length - footprint.populationBearingClaimed,
    contestsWon: footprint.contestsWon,
    contestsLost: footprint.contestsLost,
    boundingBox: Object.freeze({ minX, minY, maxX, maxY }),
    shapeProfile: footprint.shapeProfile,
    ...(footprint.shapeProfile === "STAR"
      ? {
          shapeTemplateId: SPAWN_STAR_TEMPLATE_ID,
          shapeTemplateSha256: SPAWN_STAR_TEMPLATE_SHA256,
        }
      : {}),
    cellIds,
    cellSetSha256: footprintHash(cellIds),
  });
}

function initializePopulations(
  state: MatchState,
  materialized: ReturnType<typeof validateAndMaterializeInputs>,
  ownership: readonly (string | null)[],
): MatchState {
  const byFaction = new Map(materialized.map((entry) => [entry.faction.id, entry]));
  return createProspectiveMatchState(state, {
    ownership,
    factions: state.factions.map((faction) => {
      const entry = byFaction.get(faction.id);
      if (entry === undefined) throw new Error(`missing materialized Spawn profile ${faction.id}`);
      const population = entry.profile.startingPopulation;
      return Object.freeze({
        ...faction,
        population: createPopulationState({
          total: population,
          available: population,
          committedOffensive: 0,
          committedCounterResponse: 0,
          aboardTransports: 0,
          peakTotal: population,
          neutralSettlementHalfResidual: 0,
        }),
      });
    }),
  });
}

function applySingularEffects(
  state: MatchState,
  materialized: ReturnType<typeof validateAndMaterializeInputs>,
): {
  readonly state: MatchState;
  readonly effects: ReadonlyMap<string, readonly SpawnSingularEffectSnapshot[]>;
} {
  let working = state;
  const effects = new Map<string, readonly SpawnSingularEffectSnapshot[]>();
  for (const entry of materialized) {
    const singular: SpawnSingularEffectSnapshot[] = [];
    const domains = entry.faction.rules.customDomains
      .filter((domain) => domain.domain === "STARTING_STRUCTURE_GRANT")
      .sort((left, right) => compareUtf8(left.sourceId, right.sourceId));
    for (const domain of domains) {
      if (domain.sourceId !== "P20") {
        throw new Error(
          `unimplemented STARTING_STRUCTURE_GRANT source ${domain.sourceId}; refusing to invent grant semantics`,
        );
      }
      const cellId = entry.origins[0]!.resolvedExactOrigin;
      const result = tryMaterializeStructureGrant(working, {
        structureId: `spawn:${domain.sourceId}:${entry.faction.id}`,
        ownerId: entry.faction.id,
        type: "MISSILE_SILO",
        cellId,
        level: 1,
      });
      if (result.ok) {
        working = createProspectiveMatchState(working, {
          structures: result.structures,
        });
        singular.push(
          Object.freeze({
            effectId: domain.sourceId,
            domain: domain.domain,
            result: "GRANTED" as const,
            cellId,
          }),
        );
      } else {
        singular.push(
          Object.freeze({
            effectId: domain.sourceId,
            domain: domain.domain,
            result: "REJECTED" as const,
            cellId,
            failureCode: result.failure.code,
          }),
        );
      }
    }
    effects.set(entry.faction.id, Object.freeze(singular));
  }
  return Object.freeze({ state: working, effects });
}

export function materializeSpawnInitialization(
  initialState: MatchState,
  input: SpawnInitializationInput,
): SpawnInitializationResult {
  const materialized = validateAndMaterializeInputs(initialState, input);
  const resolved = resolveFootprints(initialState, materialized);
  let state = initializePopulations(initialState, materialized, resolved.ownership);
  const singular = applySingularEffects(state, materialized);
  state = singular.state;

  const footprintsByFaction = new Map<string, SpawnFootprintSnapshot[]>();
  for (const footprint of resolved.footprints) {
    const list = footprintsByFaction.get(footprint.factionId) ?? [];
    list.push(footprintSnapshot(initialState.map, footprint));
    footprintsByFaction.set(footprint.factionId, list);
  }

  const snapshot: SpawnSnapshot = Object.freeze({
    spawnMode: input.spawnMode,
    spawnResolverVersion: SPAWN_RESOLVER_VERSION,
    stableTie32Id: SPAWN_STABLE_TIE32_ID,
    factions: Object.freeze(
      materialized.map((entry) =>
        Object.freeze({
          factionId: entry.faction.id,
          effectiveSpawnProfile: Object.freeze({
            exactOriginCount: entry.profile.exactOriginCount,
            initialTerritoryPopulationBearingQuota:
              entry.profile.initialTerritoryPopulationBearingQuota,
            footprintShapeProfile: entry.profile.footprintShapeProfile,
          }),
          origins: entry.origins,
          footprints: Object.freeze(
            (footprintsByFaction.get(entry.faction.id) ?? []).sort(
              (left, right) => left.footprintSlot - right.footprintSlot,
            ),
          ),
          singularEffects: singular.effects.get(entry.faction.id) ?? Object.freeze([]),
        }),
      ),
    ),
  });

  return Object.freeze({
    state,
    snapshot,
    immunityEndsAtTickExclusive: initialState.tick + SPAWN_IMMUNITY_TICKS,
  });
}
