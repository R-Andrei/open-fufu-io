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

export interface MatchSpec {
  readonly seed: string;
  readonly map: MatchMapSpec;
  readonly factions: readonly MatchFactionSpec[];
  readonly initialStructureGrants?: readonly StructureGrantRequest[];
}
