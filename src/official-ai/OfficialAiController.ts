import { OFFICIAL_AI_BASELINE_CHARACTER_PROFILE } from "../../design/official-ai/character-configurations.config";
import type {
  ControllerDecision,
  SpawnInfluenceContext,
  SpawnInfluenceDecision,
  SpawnOriginContext,
  SpawnOriginDecision,
  SpawnReconsiderContext,
} from "../core/controller/ControllerApi";
import {
  createControllerSpatialSurface,
  type ControllerHost,
  type ControllerHostInvocationResult,
  type ControllerQuerySession,
  type ControllerSpatialSurface,
  type LawfulControllerObservation,
} from "../simulation/ControllerRuntime";

type BaselineProfile = typeof OFFICIAL_AI_BASELINE_CHARACTER_PROFILE;

export interface OfficialAiControllerRegistration {
  readonly factionId: string;
  readonly profile: BaselineProfile;
}

function decideBaseline(
  profile: BaselineProfile,
  observation: LawfulControllerObservation,
  spatial: ControllerSpatialSurface,
): ControllerDecision | void {
  if (observation.me.status !== "ACTIVE") return;
  if (observation.me.population.available !== 1) return;
  if (spatial.map.cellCount !== 2) return;
  if (profile.evaluators.territory !== "LOCAL") return;
  if (profile.evaluators.opportunity !== "OBVIOUS") return;
  if (profile.planners.expansion !== "NEAREST") return;
  if (profile.arbiter.kind !== "SIMPLE_PRIORITY") return;

  let sourceId: number | undefined;
  let targetId: number | undefined;
  for (let id = 0; id < spatial.map.cellCount; id += 1) {
    const ownerId = spatial.cells.owner(id);
    if (ownerId === observation.me.id) {
      if (sourceId !== undefined) return;
      sourceId = id;
    } else if (ownerId === null) {
      if (targetId !== undefined) return;
      targetId = id;
    }
  }

  if (sourceId === undefined || targetId === undefined) return;
  if (
    spatial.map.terrainAt(sourceId) !== "PLAINS" ||
    spatial.map.terrainAt(targetId) !== "PLAINS"
  ) {
    return;
  }

  return {
    directives: {
      set: [
        {
          kind: "LAND_OPERATION",
          key: "official-ai:BASELINE_D0:neutral-expansion",
          operation: "NEUTRAL_EXPANSION",
          population: 1,
          source: { kind: "CELLS", ids: [sourceId] },
          target: { kind: "CELLS", ids: [targetId] },
        },
      ],
    },
  };
}

function successfulInvocation<T>(
  output?: T,
): ControllerHostInvocationResult<T> {
  return output === undefined
    ? Object.freeze({ ok: true as const })
    : Object.freeze({ ok: true as const, output });
}

function runtimeFailure<T>(): ControllerHostInvocationResult<T> {
  return Object.freeze({
    ok: false as const,
    fault: Object.freeze({ code: "RUNTIME_ERROR" as const }),
  });
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
    querySession?: ControllerQuerySession,
  ): ControllerHostInvocationResult<ControllerDecision> {
    const profile = this.registrations.get(factionId);
    if (profile === undefined) return successfulInvocation();
    if (querySession === undefined) return runtimeFailure();

    try {
      const decision = decideBaseline(
        profile,
        observation,
        createControllerSpatialSurface(querySession),
      );
      return decision === undefined
        ? successfulInvocation<ControllerDecision>()
        : successfulInvocation<ControllerDecision>(decision);
    } catch {
      return runtimeFailure();
    }
  }

  chooseInfluence(
    _factionId: string,
    _context: SpawnInfluenceContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision> {
    return successfulInvocation();
  }

  reconsiderInfluence(
    _factionId: string,
    _context: SpawnReconsiderContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision> {
    return successfulInvocation();
  }

  chooseOrigins(
    _factionId: string,
    _context: SpawnOriginContext,
  ): ControllerHostInvocationResult<SpawnOriginDecision> {
    return successfulInvocation();
  }
}
