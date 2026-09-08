import type {
  StructureAcquisitionPath,
  StructureLevel,
  StructureType,
} from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  ruleScopeMatches,
  selectRuleContributionsForScope,
  type RuleCondition,
  type RuleConditions,
  type RuleScope,
} from "../core/rules/RuleComposition";
import { materializeCompiledCapRule } from "../core/rules/RuleMaterialization";
import type { MatchState } from "./MatchState";

const STRUCTURE_TYPES = new Set<StructureType>([
  "CITY",
  "FORT",
  "PORT",
  "FACTORY",
  "MISSILE_SILO",
  "SAM_LAUNCHER",
  "OBSERVATION_POST",
  "COMMAND_POST",
]);

const BASE_BUILDABLE_TERRAINS = new Set([
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "MARSH",
]);

export interface StructureConstructionState {
  readonly targetLevel: StructureLevel;
  readonly remainingTicks: number;
}

export interface PersistentStructureState {
  readonly id: string;
  readonly ownerId: string;
  readonly type: StructureType;
  readonly cellId: number;
  readonly completedLevel?: StructureLevel;
  readonly active: boolean;
  readonly construction?: StructureConstructionState;
  readonly acquisitionPath: StructureAcquisitionPath;
}

export interface StructureAcquisitionRequest {
  readonly structureId: string;
  readonly ownerId: string;
  readonly type: StructureType;
  readonly cellId: number;
  readonly level: StructureLevel;
  readonly acquisitionPath: StructureAcquisitionPath;
}

export interface StructureGrantRequest {
  readonly structureId: string;
  readonly ownerId: string;
  readonly type: StructureType;
  readonly cellId: number;
  readonly level: StructureLevel;
}

export type StructureAdmissionFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "STRUCTURE_ID_CONFLICT"
  | "OWNERSHIP_CAP"
  | "CELL_NOT_OWNED"
  | "CELL_OCCUPIED"
  | "BUILD_NOT_PERMITTED"
  | "PLACEMENT_GEOMETRY_UNAVAILABLE";

export interface StructureAdmissionFailure {
  readonly code: StructureAdmissionFailureCode;
}

export type StructureAdmissionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: StructureAdmissionFailure };

export type StructureGrantResult =
  | {
      readonly ok: true;
      readonly structure: PersistentStructureState;
      readonly structures: readonly PersistentStructureState[];
    }
  | { readonly ok: false; readonly failure: StructureAdmissionFailure };

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function freezeConstruction(
  construction: StructureConstructionState,
): StructureConstructionState {
  return Object.freeze({
    targetLevel: construction.targetLevel,
    remainingTicks: construction.remainingTicks,
  });
}

export function materializePersistentStructureState(
  structure: PersistentStructureState,
): PersistentStructureState {
  return Object.freeze({
    id: structure.id,
    ownerId: structure.ownerId,
    type: structure.type,
    cellId: structure.cellId,
    ...(structure.completedLevel === undefined
      ? {}
      : { completedLevel: structure.completedLevel }),
    active: structure.active,
    ...(structure.construction === undefined
      ? {}
      : { construction: freezeConstruction(structure.construction) }),
    acquisitionPath: structure.acquisitionPath,
  });
}

export function materializePersistentStructures(
  structures: readonly PersistentStructureState[],
): readonly PersistentStructureState[] {
  return Object.freeze(
    [...structures]
      .sort(
        (left, right) =>
          compareIds(left.id, right.id) ||
          left.cellId - right.cellId ||
          compareIds(left.ownerId, right.ownerId),
      )
      .map(materializePersistentStructureState),
  );
}

function failure(code: StructureAdmissionFailureCode): StructureAdmissionResult {
  return Object.freeze({ ok: false, failure: Object.freeze({ code }) });
}

function isStructureType(value: unknown): value is StructureType {
  return typeof value === "string" && STRUCTURE_TYPES.has(value as StructureType);
}

function isStructureLevel(value: unknown): value is StructureLevel {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function requestIsWellFormed(
  state: MatchState,
  request: StructureAcquisitionRequest,
): boolean {
  const cellCount = state.map.width * state.map.height;
  return (
    typeof request.structureId === "string" &&
    request.structureId.length > 0 &&
    typeof request.ownerId === "string" &&
    request.ownerId.length > 0 &&
    isStructureType(request.type) &&
    Number.isSafeInteger(request.cellId) &&
    request.cellId >= 0 &&
    request.cellId < cellCount &&
    isStructureLevel(request.level) &&
    (request.acquisitionPath === "PURCHASE_BUILD" ||
      request.acquisitionPath === "GRANT" ||
      request.acquisitionPath === "CAPTURE_TRANSFER")
  );
}

function conditionApplies(
  condition: RuleCondition,
  terrain: string,
  acquisitionPath: StructureAcquisitionPath,
): boolean {
  switch (condition.kind) {
    case "BUILD_TERRAIN_IS":
      return condition.terrain === terrain;
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return condition.path === acquisitionPath;
    default:
      throw new Error(
        `Unsupported structure-admission rule condition ${condition.kind}`,
      );
  }
}

function conditionsApply(
  conditions: RuleConditions | undefined,
  terrain: string,
  acquisitionPath: StructureAcquisitionPath,
): boolean {
  return (
    conditions === undefined ||
    conditions.every((condition) =>
      conditionApplies(condition, terrain, acquisitionPath),
    )
  );
}

function buildPlacementAllowed(
  state: MatchState,
  request: StructureAcquisitionRequest,
): boolean {
  const terrain = state.map.terrain[request.cellId];
  if (terrain === undefined) return false;
  const scope = {
    kind: "STRUCTURE",
    structure: request.type,
  } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "STRUCTURE_BUILD_PERMISSION",
    scope,
    state.factions.find((faction) => faction.id === request.ownerId)?.rules
      .contributions ?? [],
  ).filter((entry) =>
    conditionsApply(entry.conditions, terrain, request.acquisitionPath),
  );
  return reducePermissionRule(
    BASE_BUILDABLE_TERRAINS.has(terrain),
    RULE_AXIS_REGISTRY.STRUCTURE_BUILD_PERMISSION,
    contributions,
  );
}

function effectiveOwnershipCap(
  state: MatchState,
  request: StructureAcquisitionRequest,
): number {
  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${request.ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: request.type,
  } as const satisfies RuleScope;
  const relevantDynamicProviders = owner.rules.dynamicProviders.filter(
    (provider) =>
      provider.axis === "STRUCTURE_OWNERSHIP_CAP" &&
      ruleScopeMatches(provider.scope, scope),
  );
  if (
    relevantDynamicProviders.some(
      (provider) => provider.dependency === "TERRITORIAL_CONTACT_COUNT",
    )
  ) {
    throw new Error(
      "STRUCTURE_OWNERSHIP_CAP requires Territorial Contact state unavailable to the current structure foundation",
    );
  }
  return materializeCompiledCapRule(
    Number.MAX_SAFE_INTEGER,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "STRUCTURE_OWNERSHIP_CAP",
    scope,
    {
      ownedPersistentStructureCount: state.structures.filter(
        (structure) => structure.ownerId === request.ownerId,
      ).length,
      territorialContactCount: 0,
      peakTotalPopulation: owner.population.peakTotal,
    },
  );
}

export function evaluateStructureAcquisitionAdmission(
  state: MatchState,
  request: StructureAcquisitionRequest,
): StructureAdmissionResult {
  if (!requestIsWellFormed(state, request)) return failure("INVALID_REQUEST");
  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return failure("UNKNOWN_OWNER");

  const existingById = state.structures.find(
    (structure) => structure.id === request.structureId,
  );
  if (request.acquisitionPath === "CAPTURE_TRANSFER") {
    if (
      existingById === undefined ||
      existingById.type !== request.type ||
      existingById.cellId !== request.cellId
    ) {
      return failure("INVALID_REQUEST");
    }
  } else if (existingById !== undefined) {
    return failure("STRUCTURE_ID_CONFLICT");
  }

  const ownedSameType = state.structures.filter(
    (structure) =>
      structure.ownerId === request.ownerId && structure.type === request.type,
  ).length;
  const addsOwnershipSlot =
    existingById === undefined || existingById.ownerId !== request.ownerId;
  if (
    ownedSameType + (addsOwnershipSlot ? 1 : 0) >
    effectiveOwnershipCap(state, request)
  ) {
    return failure("OWNERSHIP_CAP");
  }

  if (request.acquisitionPath === "CAPTURE_TRANSFER") {
    return Object.freeze({ ok: true });
  }

  if ((state.ownership[request.cellId] ?? null) !== request.ownerId) {
    return failure("CELL_NOT_OWNED");
  }
  if (
    state.structures.some((structure) => structure.cellId === request.cellId)
  ) {
    return failure("CELL_OCCUPIED");
  }
  if (!buildPlacementAllowed(state, request)) {
    return failure("BUILD_NOT_PERMITTED");
  }

  // The current synthetic substrate has no canonical coast/interface predicate.
  // Reject Port materialization rather than inventing a second placement authority.
  if (request.type === "PORT") {
    return failure("PLACEMENT_GEOMETRY_UNAVAILABLE");
  }

  return Object.freeze({ ok: true });
}

export function tryMaterializeStructureGrant(
  state: MatchState,
  grant: StructureGrantRequest,
): StructureGrantResult {
  const request: StructureAcquisitionRequest = {
    ...grant,
    acquisitionPath: "GRANT",
  };
  const admission = evaluateStructureAcquisitionAdmission(state, request);
  if (!admission.ok) return admission;

  const structure = materializePersistentStructureState({
    id: grant.structureId,
    ownerId: grant.ownerId,
    type: grant.type,
    cellId: grant.cellId,
    completedLevel: grant.level,
    active: true,
    acquisitionPath: "GRANT",
  });
  return Object.freeze({
    ok: true,
    structure,
    structures: materializePersistentStructures([...state.structures, structure]),
  });
}
