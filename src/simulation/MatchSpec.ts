import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";

export interface SyntheticMapSpec {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly string[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialFallout?: readonly boolean[];
}

export interface MatchFactionSpec {
  readonly id: string;
  readonly rules: CompiledRuleProfile;
  readonly fixedTeamId?: string;
}

export interface MatchSpec {
  readonly seed: string;
  readonly map: SyntheticMapSpec;
  readonly factions: readonly MatchFactionSpec[];
}
