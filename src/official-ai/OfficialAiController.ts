import { OFFICIAL_AI_BASELINE_CHARACTER_PROFILE } from "../../design/official-ai/character-configurations.config";
import type { ControllerDecision } from "../core/controller/ControllerApi";
import type {
  ControllerHost,
  LawfulControllerObservation,
  LawfulLandCellObservation,
} from "../simulation/ControllerRuntime";

type BaselineProfile = typeof OFFICIAL_AI_BASELINE_CHARACTER_PROFILE;

export interface OfficialAiControllerRegistration {
  readonly factionId: string;
  readonly profile: BaselineProfile;
}

interface LawfulObservationIndex {
  readonly ownedCells: readonly LawfulLandCellObservation[];
  readonly neutralCells: readonly LawfulLandCellObservation[];
}

function compareCellId(
  left: LawfulLandCellObservation,
  right: LawfulLandCellObservation,
): number {
  return left.id - right.id;
}

function indexObservation(
  observation: LawfulControllerObservation,
): LawfulObservationIndex {
  const ownedCells = observation.cells
    .filter((cell) => cell.ownerId === observation.me.id)
    .sort(compareCellId);
  const neutralCells = observation.cells
    .filter((cell) => cell.ownerId === undefined)
    .sort(compareCellId);

  return Object.freeze({
    ownedCells: Object.freeze(ownedCells),
    neutralCells: Object.freeze(neutralCells),
  });
}

function decideBaseline(
  profile: BaselineProfile,
  observation: LawfulControllerObservation,
): ControllerDecision | void {
  if (observation.me.status !== "ACTIVE") return;
  if (observation.me.population.available !== 1) return;
  if (observation.cells.length !== 2) return;
  if (profile.evaluators.territory !== "LOCAL") return;
  if (profile.evaluators.opportunity !== "OBVIOUS") return;
  if (profile.planners.expansion !== "NEAREST") return;
  if (profile.arbiter.kind !== "SIMPLE_PRIORITY") return;

  const index = indexObservation(observation);
  if (index.ownedCells.length !== 1 || index.neutralCells.length !== 1) return;

  const source = index.ownedCells[0];
  const target = index.neutralCells[0];
  if (source === undefined || target === undefined) return;
  if (source.terrain !== "PLAINS" || target.terrain !== "PLAINS") return;

  return {
    directives: {
      set: [
        {
          kind: "LAND_OPERATION",
          key: "official-ai:BASELINE_D0:neutral-expansion",
          operation: "NEUTRAL_EXPANSION",
          population: 1,
          source: { kind: "CELLS", ids: [source.id] },
          target: { kind: "CELLS", ids: [target.id] },
        },
      ],
    },
  };
}

export class OfficialAiControllerHost implements ControllerHost {
  private readonly registrations: ReadonlyMap<string, BaselineProfile>;

  constructor(registrations: readonly OfficialAiControllerRegistration[]) {
    const byFaction = new Map<string, BaselineProfile>();
    for (const registration of registrations) {
      if (byFaction.has(registration.factionId)) {
        throw new Error(`duplicate Official AI faction: ${registration.factionId}`);
      }
      if (registration.profile.id !== OFFICIAL_AI_BASELINE_CHARACTER_PROFILE.id) {
        throw new Error(`unsupported Official AI profile: ${registration.profile.id}`);
      }
      byFaction.set(registration.factionId, registration.profile);
    }
    this.registrations = byFaction;
  }

  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
  ): ControllerDecision | void {
    const profile = this.registrations.get(factionId);
    if (profile === undefined) return;
    return decideBaseline(profile, observation);
  }
}
