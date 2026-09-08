import type { MatchFactionSpec, MatchSpec } from "./MatchSpec";

export interface MicroSimulationSpecOptions {
  readonly seed?: string;
  readonly width?: number;
  readonly height?: number;
  readonly factions: readonly MatchFactionSpec[];
}

export function createMicroSimulationSpec(
  options: MicroSimulationSpecOptions,
): MatchSpec {
  const width = options.width ?? 2;
  const height = options.height ?? 2;

  return Object.freeze({
    seed: options.seed ?? "micro-simulation",
    map: Object.freeze({
      width,
      height,
      terrain: Object.freeze(Array.from({ length: width * height }, () => "TEST")),
    }),
    factions: Object.freeze([...options.factions]),
  });
}
