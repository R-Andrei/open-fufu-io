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
import { landTerrainBaseSpec, type LandTerrainBaseSpec } from "./LandOperations";
import type { MatchFactionState, MatchState } from "./MatchState";
import type {
  ResolvedSpawnOrigin,
  SpawnInitializationInput,
  SpawnMode,
  SpawnOriginSource,
} from "./MatchSpec";
import type { SimulationMap, SimulationTerrain } from "./SimulationMap";

export const SPAWN_RESOLVER_VERSION = "1" as const;
export const SPAWN_STABLE_TIE32_ID = "FNV1A32_LENPREFIX_V1" as const;
export const SPAWN_FOREIGN_ORIGIN_MIN_DISTANCE_CELLS = 50 as const;

const ORDINARY_INITIAL_TERRITORY = 1_000;
const ORDINARY_STARTING_POPULATION_FRACTION = 0.5;
const UTF8_ENCODER = new TextEncoder();
const GLOBAL_SCOPE = { kind: "GLOBAL" } as const satisfies RuleScope;

const EXACT_SEED_ELIGIBLE_TERRAINS = new Set<SimulationTerrain>([
  "TEST",
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "MARSH",
]);

export interface SpawnTerrainBaseSpec extends LandTerrainBaseSpec {
  readonly spawnEligible: boolean;
}

export interface MaterializedSpawnProfile {
  readonly exactOriginCount: number;
  readonly initialTerritoryPopulationBearingQuota: number;
  readonly footprintShapeProfile: "COMPACT" | "STAR";
  readonly startingPopulation: number;
}

export interface MaterializedSpawnFaction {
  readonly faction: MatchFactionState;
  readonly profile: MaterializedSpawnProfile;
  readonly origins: readonly ResolvedSpawnOrigin[];
}

export function compareSpawnUtf8(left: string, right: string): number {
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

export function materializeEffectiveSpawnProfile(
  rules: CompiledRuleProfile,
): MaterializedSpawnProfile {
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

export function spawnTerrainBaseSpec(
  terrain: SimulationTerrain,
): SpawnTerrainBaseSpec {
  const base = landTerrainBaseSpec(terrain);
  return Object.freeze({
    ...base,
    spawnEligible: EXACT_SEED_ELIGIBLE_TERRAINS.has(terrain),
  });
}

export function isExactSpawnSeedTerrain(terrain: SimulationTerrain): boolean {
  return spawnTerrainBaseSpec(terrain).spawnEligible;
}

export function isSpawnFootprintOwnable(terrain: SimulationTerrain): boolean {
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

export function isSpawnPopulationBearing(
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

export function expectedSpawnOriginSource(mode: SpawnMode): SpawnOriginSource {
  switch (mode) {
    case "STRATEGIC":
      return "STRATEGIC_SUBMISSION";
    case "RANDOM":
      return "RANDOM_RESOLUTION";
    case "FIXED":
      return "FIXED_CONFIGURATION";
    default:
      throw new Error(`unsupported Spawn mode ${String(mode)}`);
  }
}

export function foreignSpawnOriginsMeetSpacing(
  map: SimulationMap,
  leftCellId: number,
  rightCellId: number,
): boolean {
  const left = map.positionOf(leftCellId);
  const right = map.positionOf(rightCellId);
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return (
    dx * dx + dy * dy >=
    SPAWN_FOREIGN_ORIGIN_MIN_DISTANCE_CELLS *
      SPAWN_FOREIGN_ORIGIN_MIN_DISTANCE_CELLS
  );
}

export function validateResolvedSpawnOrigins(
  state: MatchState,
  input: SpawnInitializationInput,
): readonly MaterializedSpawnFaction[] {
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
  for (const entry of input.factions) {
    if (!state.factions.some((faction) => faction.id === entry.factionId)) {
      throw new Error(`Spawn initialization contains unknown faction ${entry.factionId}`);
    }
  }

  const expectedSource = expectedSpawnOriginSource(input.spawnMode);
  const result = [...state.factions]
    .sort((left, right) => compareSpawnUtf8(left.id, right.id))
    .map((faction) => {
      const resolved = byFaction.get(faction.id);
      if (resolved === undefined) {
        throw new Error(`Spawn initialization is missing faction ${faction.id}`);
      }
      const profile = materializeEffectiveSpawnProfile(faction.rules);
      const origins = [...resolved.origins].sort(
        (left, right) => left.originSlot - right.originSlot,
      );
      if (origins.length !== profile.exactOriginCount) {
        throw new Error(
          `Spawn input for ${faction.id} has ${origins.length} origins; expected ${profile.exactOriginCount}`,
        );
      }

      const ownCells = new Set<number>();
      for (let slot = 0; slot < origins.length; slot += 1) {
        const origin = origins[slot]!;
        if (origin.originSlot !== slot) {
          throw new Error(`Spawn input for ${faction.id} has non-canonical origin slots`);
        }
        if (origin.source !== expectedSource) {
          throw new Error(`Spawn input source ${origin.source} does not match ${input.spawnMode}`);
        }
        const cellId = origin.resolvedExactOrigin;
        if (!state.map.isValidCellId(cellId)) {
          throw new Error(`Spawn origin ${faction.id}/${slot} is outside the map`);
        }
        if (
          state.fallout[cellId] === true ||
          !isExactSpawnSeedTerrain(state.map.terrainAt(cellId))
        ) {
          throw new Error(`ORIGIN_ILLEGAL_TERRAIN:${faction.id}/${slot}`);
        }
        if (ownCells.has(cellId)) {
          throw new Error(`ORIGIN_DUPLICATE_OWN_SLOT:${faction.id}/${slot}`);
        }
        ownCells.add(cellId);
      }

      return Object.freeze({
        faction,
        profile,
        origins: Object.freeze(origins.map((origin) => Object.freeze({ ...origin }))),
      });
    });

  for (let leftIndex = 0; leftIndex < result.length; leftIndex += 1) {
    const left = result[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < result.length; rightIndex += 1) {
      const right = result[rightIndex]!;
      for (const leftOrigin of left.origins) {
        for (const rightOrigin of right.origins) {
          if (
            !foreignSpawnOriginsMeetSpacing(
              state.map,
              leftOrigin.resolvedExactOrigin,
              rightOrigin.resolvedExactOrigin,
            )
          ) {
            throw new Error(
              `ORIGIN_FOREIGN_SPACING_CONFLICT:${left.faction.id}/${leftOrigin.originSlot}:${right.faction.id}/${rightOrigin.originSlot}`,
            );
          }
        }
      }
    }
  }

  return Object.freeze(result);
}
