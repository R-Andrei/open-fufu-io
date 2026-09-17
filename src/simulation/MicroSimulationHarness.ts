import type { MatchFactionSpec, MatchSpec } from "./MatchSpec";
import type { StructureGrantRequest } from "./Structures";

type MicroSimulationFactionSpec = Omit<
  MatchFactionSpec,
  "displayName" | "isMinorFaction"
> &
  Partial<Pick<MatchFactionSpec, "displayName" | "isMinorFaction">>;

export interface MicroSimulationSpecOptions {
  readonly seed?: string;
  readonly width?: number;
  readonly height?: number;
  readonly terrain?: readonly string[];
  readonly initialOwners?: readonly (string | null)[];
  readonly initialFallout?: readonly boolean[];
  readonly initialStructureGrants?: readonly StructureGrantRequest[];
  readonly factions: readonly MicroSimulationFactionSpec[];
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
    // Synthetic fixtures deliberately author convenient metadata defaults here.
    // Production projection never derives public metadata from internal IDs.
    factions: Object.freeze(
      options.factions.map((faction) =>
        Object.freeze({
          ...faction,
          displayName: faction.displayName ?? faction.id,
          isMinorFaction: faction.isMinorFaction ?? false,
        }),
      ),
    ),
    initialization: Object.freeze({ kind: "SYNTHETIC_FIXTURE" as const }),
    ...(options.initialStructureGrants === undefined
      ? {}
      : {
          initialStructureGrants: Object.freeze(
            options.initialStructureGrants.map((grant) =>
              Object.freeze({ ...grant }),
            ),
          ),
        }),
  });
}
