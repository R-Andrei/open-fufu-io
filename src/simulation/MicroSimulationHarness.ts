import type { MatchFactionSpec, MatchSpec } from "./MatchSpec";

export interface MicroSimulationSpecOptions {
  readonly seed?: string;
  readonly width?: number;
  readonly height?: number;
  readonly terrain?: readonly string[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialFallout?: readonly boolean[];
  readonly factions: readonly MatchFactionSpec[];
}

export function createMicroSimulationSpec(
  options: MicroSimulationSpecOptions,
): MatchSpec {
  const width = options.width ?? 2;
  const height = options.height ?? 2;
  const terrain =
    options.terrain ?? Array.from({ length: width * height }, () => "TEST");

  return Object.freeze({
    seed: options.seed ?? "micro-simulation",
    map: Object.freeze({
      width,
      height,
      terrain: Object.freeze([...terrain]),
      ...(options.initialOwners === undefined
        ? {}
        : { initialOwners: Object.freeze([...options.initialOwners]) }),
      ...(options.initialFallout === undefined
        ? {}
        : { initialFallout: Object.freeze([...options.initialFallout]) }),
    }),
    factions: Object.freeze([...options.factions]),
  });
}
