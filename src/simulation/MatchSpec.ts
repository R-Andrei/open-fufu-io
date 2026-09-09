import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import type { MapArtifactBinding } from "./MapArtifact";
import type { StructureGrantRequest } from "./Structures";

export interface SyntheticMapSpec {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly string[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialFallout?: readonly boolean[];
}

export interface ArtifactMapSpec extends MapArtifactBinding {
  readonly kind: "ARTIFACT";
}

export type MatchMapSpec = SyntheticMapSpec | ArtifactMapSpec;

export function isArtifactMapSpec(map: MatchMapSpec): map is ArtifactMapSpec {
  return (
    typeof map === "object" &&
    map !== null &&
    "kind" in map &&
    map.kind === "ARTIFACT"
  );
}

export interface MatchFactionSpec {
  readonly id: string;
  readonly rules: CompiledRuleProfile;
  readonly fixedTeamId?: string;
}

export type SpawnMode = "STRATEGIC" | "RANDOM" | "FIXED";
export type SpawnOriginSource =
  | "STRATEGIC_SUBMISSION"
  | "RANDOM_RESOLUTION"
  | "FIXED_CONFIGURATION";

export interface ResolvedSpawnOrigin {
  readonly originSlot: number;
  readonly resolvedExactOrigin: number;
  readonly source: SpawnOriginSource;
  readonly resolutionReason?: string;
}

export interface ResolvedSpawnFactionInput {
  readonly factionId: string;
  readonly origins: readonly ResolvedSpawnOrigin[];
}

export interface SpawnInitializationInput {
  readonly spawnMode: SpawnMode;
  readonly spawnResolverVersion: "1";
  readonly factions: readonly ResolvedSpawnFactionInput[];
}

export interface SpawnMatchInitialization {
  readonly kind: "SPAWN";
  /**
   * Mode-independent pre-resolved Spawn handoff. Origin selection/repair remains
   * owned by the mode-specific provider; MatchRuntime only materializes start state.
   */
  readonly input: SpawnInitializationInput;
}

export interface SyntheticFixtureMatchInitialization {
  /** Explicit opt-in for synthetic test/micro-simulation pre-authored start state. */
  readonly kind: "SYNTHETIC_FIXTURE";
}

export type MatchInitialization =
  | SpawnMatchInitialization
  | SyntheticFixtureMatchInitialization;

export interface MatchSpec {
  readonly seed: string;
  readonly map: MatchMapSpec;
  readonly factions: readonly MatchFactionSpec[];
  readonly initialization: MatchInitialization;
  /** Legacy pre-authored grants are legal only for SYNTHETIC_FIXTURE startup. */
  readonly initialStructureGrants?: readonly StructureGrantRequest[];
}
