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
import {
  materializeCompiledCapRule,
  materializeCompiledScalarRule,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
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

const PORT_LAND_TERRAINS = new Set([
  "PLAINS",
  "HIGHLAND",
  "MOUNTAIN",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
]);

const BASE_STRUCTURE_CONSTRUCTION_TICKS: Readonly<Record<StructureType, number>> =
  Object.freeze({
    CITY: 50,
    FORT: 50,
    PORT: 50,
    FACTORY: 100,
    MISSILE_SILO: 150,
    SAM_LAUNCHER: 150,
    OBSERVATION_POST: 50,
    COMMAND_POST: 100,
  });

const BASE_STRUCTURE_RECHARGE_TICKS = Object.freeze({
  MISSILE_SILO: 90,
  SAM_LAUNCHER: 90,
} as const);

type ChargeBearingStructureType = keyof typeof BASE_STRUCTURE_RECHARGE_TICKS;

export interface StructureConstructionState {
  readonly targetLevel: StructureLevel;
  readonly remainingTicks: number;
}

export type StructureChargeSlotState =
  | {
      readonly slotId: number;
      readonly state: "READY";
    }
  | {
      readonly slotId: number;
      readonly state: "RECHARGING";
      readonly readyAtTick: number;
    };

export interface PersistentStructureState {
  readonly id: string;
  readonly ownerId: string;
  readonly type: StructureType;
  readonly cellId: number;
  readonly completedLevel?: StructureLevel;
  readonly active: boolean;
  readonly construction?: StructureConstructionState;
  readonly chargeSlots?: readonly StructureChargeSlotState[];
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

export interface StructureUpgradeRequest {
  readonly structureId: string;
  readonly ownerId: string;
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

export type StructureBuildResult = StructureGrantResult;

export type StructureUpgradeFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_STRUCTURE"
  | "NOT_OWNER"
  | "NOT_COMPLETED"
  | "CONSTRUCTION_IN_PROGRESS"
  | "MAX_LEVEL"
  | "UPGRADE_NOT_PERMITTED";

export type StructureUpgradeResult =
  | {
      readonly ok: true;
      readonly structure: PersistentStructureState;
      readonly structures: readonly PersistentStructureState[];
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: StructureUpgradeFailureCode }>;
    };

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isStructureType(value: unknown): value is StructureType {
  return typeof value === "string" && STRUCTURE_TYPES.has(value as StructureType);
}

function isStructureLevel(value: unknown): value is StructureLevel {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function assertPersistentStructureState(structure: PersistentStructureState): void {
  if (typeof structure.id !== "string" || structure.id.length === 0) {
    throw new Error("structure id must be a non-empty string");
  }
  if (typeof structure.ownerId !== "string" || structure.ownerId.length === 0) {
    throw new Error("structure ownerId must be a non-empty string");
  }
  if (!isStructureType(structure.type)) {
    throw new Error("structure type is invalid");
  }
  if (!Number.isSafeInteger(structure.cellId) || structure.cellId < 0) {
    throw new Error("structure cellId must be a non-negative safe integer");
  }
  if (
    structure.completedLevel !== undefined &&
    !isStructureLevel(structure.completedLevel)
  ) {
    throw new Error("structure completedLevel must be in 1..5");
  }
  if (structure.construction !== undefined) {
    if (!isStructureLevel(structure.construction.targetLevel)) {
      throw new Error("structure construction targetLevel must be in 1..5");
    }
    if (
      !Number.isSafeInteger(structure.construction.remainingTicks) ||
      structure.construction.remainingTicks <= 0
    ) {
      throw new Error(
        "structure construction remainingTicks must be a positive safe integer",
      );
    }
    if (structure.completedLevel !== undefined) {
      if (
        structure.construction.targetLevel !==
        structure.completedLevel + 1
      ) {
        throw new Error(
          "structure upgrade construction targetLevel must be the next level",
        );
      }
      if (!structure.active) {
        throw new Error(
          "structure upgrade must keep its completed level active",
        );
      }
    }
  }
  if (structure.completedLevel === undefined) {
    if (structure.active) {
      throw new Error("structure without a completed level cannot be active");
    }
    if (structure.construction === undefined) {
      throw new Error(
        "structure without a completed level must have construction state",
      );
    }
  }
  if (
    structure.acquisitionPath !== "PURCHASE_BUILD" &&
    structure.acquisitionPath !== "GRANT" &&
    structure.acquisitionPath !== "CAPTURE_TRANSFER"
  ) {
    throw new Error("structure acquisitionPath is invalid");
  }

  const slotIds = new Set<number>();
  for (const slot of structure.chargeSlots ?? []) {
    if (!Number.isSafeInteger(slot.slotId) || slot.slotId < 0) {
      throw new Error("structure charge slotId must be a non-negative safe integer");
    }
    if (slotIds.has(slot.slotId)) {
      throw new Error(`duplicate structure charge slotId ${slot.slotId}`);
    }
    slotIds.add(slot.slotId);
    if (
      slot.state === "RECHARGING" &&
      (!Number.isSafeInteger(slot.readyAtTick) || slot.readyAtTick < 0)
    ) {
      throw new Error("structure charge readyAtTick must be a non-negative safe integer");
    }
  }
}

function freezeConstruction(
  construction: StructureConstructionState,
): StructureConstructionState {
  return Object.freeze({
    targetLevel: construction.targetLevel,
    remainingTicks: construction.remainingTicks,
  });
}

function freezeChargeSlots(
  slots: readonly StructureChargeSlotState[],
): readonly StructureChargeSlotState[] {
  return Object.freeze(
    [...slots]
      .sort((left, right) => left.slotId - right.slotId)
      .map((slot) =>
        slot.state === "READY"
          ? Object.freeze({ slotId: slot.slotId, state: "READY" as const })
          : Object.freeze({
              slotId: slot.slotId,
              state: "RECHARGING" as const,
              readyAtTick: slot.readyAtTick,
            }),
      ),
  );
}

export function materializePersistentStructureState(
  structure: PersistentStructureState,
): PersistentStructureState {
  assertPersistentStructureState(structure);
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
    ...(structure.chargeSlots === undefined
      ? {}
      : { chargeSlots: freezeChargeSlots(structure.chargeSlots) }),
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

function upgradeFailure(code: StructureUpgradeFailureCode): StructureUpgradeResult {
  return Object.freeze({ ok: false, failure: Object.freeze({ code }) });
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

function territorialContactCount(state: MatchState, ownerId: string): number {
  const active = new Set(
    state.factions
      .filter((faction) => faction.status === "ACTIVE")
      .map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < state.ownership.length; cellId += 1) {
    if (state.ownership[cellId] !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwner = state.ownership[neighbor] ?? null;
      if (
        neighborOwner !== null &&
        neighborOwner !== ownerId &&
        active.has(neighborOwner)
      ) {
        contacts.add(neighborOwner);
      }
    }
  }
  return contacts.size;
}

function ruleDynamicState(state: MatchState, ownerId: string): RuleDynamicState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: territorialContactCount(state, ownerId),
    peakTotalPopulation: owner.population.peakTotal,
  });
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
  return materializeCompiledCapRule(
    Number.MAX_SAFE_INTEGER,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "STRUCTURE_OWNERSHIP_CAP",
    scope,
    ruleDynamicState(state, request.ownerId),
  );
}

function finalizePositiveTicks(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must resolve to a finite positive duration`);
  }
  const ticks = Math.ceil(value);
  if (!Number.isSafeInteger(ticks) || ticks <= 0) {
    throw new Error(`${label} must resolve to a positive safe-integer tick duration`);
  }
  return ticks;
}

export function effectiveStructureConstructionTicks(
  state: MatchState,
  ownerId: string,
  type: StructureType,
): number {
  if (!isStructureType(type)) throw new Error(`unknown structure type: ${String(type)}`);
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "STRUCTURE", structure: type } as const satisfies RuleScope;
  const effective = materializeCompiledScalarRule(
    BASE_STRUCTURE_CONSTRUCTION_TICKS[type],
    owner.rules,
    RULE_AXIS_REGISTRY,
    "STRUCTURE_CONSTRUCTION_TIME",
    scope,
    ruleDynamicState(state, ownerId),
  );
  return finalizePositiveTicks(effective, `${type} construction time`);
}

export function effectiveStructureRechargeTicks(
  state: MatchState,
  ownerId: string,
  type: ChargeBearingStructureType,
): number {
  const base = BASE_STRUCTURE_RECHARGE_TICKS[type];
  if (base === undefined) {
    throw new Error(`${String(type)} has no persistent structure recharge duration`);
  }
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "STRUCTURE", structure: type } as const satisfies RuleScope;
  const effective = materializeCompiledScalarRule(
    base,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "STRUCTURE_RECHARGE_TIME",
    scope,
    ruleDynamicState(state, ownerId),
  );
  return finalizePositiveTicks(effective, `${type} recharge time`);
}

function upgradeAllowed(
  state: MatchState,
  structure: PersistentStructureState,
): boolean {
  const owner = state.factions.find((faction) => faction.id === structure.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${structure.ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: structure.type,
  } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "STRUCTURE_UPGRADE_PERMISSION",
    scope,
    owner.rules.contributions,
  );
  if (
    contributions.some(
      (entry) => entry.conditions !== undefined && entry.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned STRUCTURE_UPGRADE_PERMISSION requires an explicit lifecycle context",
    );
  }
  return reducePermissionRule(
    true,
    RULE_AXIS_REGISTRY.STRUCTURE_UPGRADE_PERMISSION,
    contributions,
  );
}

function portPlacementHasDeepWaterInterface(
  state: MatchState,
  request: StructureAcquisitionRequest,
): boolean {
  const terrain = state.map.terrainAt(request.cellId);
  return (
    PORT_LAND_TERRAINS.has(terrain) &&
    state.map
      .cardinalNeighbors(request.cellId)
      .some((neighbor) => state.map.terrainAt(neighbor) === "DEEP_WATER")
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
  if (request.type === "PORT" && !portPlacementHasDeepWaterInterface(state, request)) {
    return failure("PLACEMENT_GEOMETRY_UNAVAILABLE");
  }

  return Object.freeze({ ok: true });
}

function initialGrantedChargeSlots(
  grant: StructureGrantRequest,
): readonly StructureChargeSlotState[] | undefined {
  if (grant.type !== "MISSILE_SILO") return undefined;
  return Object.freeze(
    Array.from({ length: grant.level }, (_, slotId) =>
      Object.freeze({ slotId, state: "READY" as const }),
    ),
  );
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

  const chargeSlots = initialGrantedChargeSlots(grant);
  const structure = materializePersistentStructureState({
    id: grant.structureId,
    ownerId: grant.ownerId,
    type: grant.type,
    cellId: grant.cellId,
    completedLevel: grant.level,
    active: true,
    ...(chargeSlots === undefined ? {} : { chargeSlots }),
    acquisitionPath: "GRANT",
  });
  return Object.freeze({
    ok: true,
    structure,
    structures: materializePersistentStructures([...state.structures, structure]),
  });
}

export function tryMaterializeStructureBuild(
  state: MatchState,
  build: StructureGrantRequest,
): StructureBuildResult {
  const request: StructureAcquisitionRequest = {
    ...build,
    acquisitionPath: "PURCHASE_BUILD",
  };
  const admission = evaluateStructureAcquisitionAdmission(state, request);
  if (!admission.ok) return admission;

  const remainingTicks = effectiveStructureConstructionTicks(
    state,
    build.ownerId,
    build.type,
  );
  const structure = materializePersistentStructureState({
    id: build.structureId,
    ownerId: build.ownerId,
    type: build.type,
    cellId: build.cellId,
    active: false,
    construction: {
      targetLevel: build.level,
      remainingTicks,
    },
    acquisitionPath: "PURCHASE_BUILD",
  });
  return Object.freeze({
    ok: true,
    structure,
    structures: materializePersistentStructures([...state.structures, structure]),
  });
}

export function tryBeginStructureUpgrade(
  state: MatchState,
  request: StructureUpgradeRequest,
): StructureUpgradeResult {
  if (
    typeof request.structureId !== "string" ||
    request.structureId.length === 0 ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0
  ) {
    return upgradeFailure("INVALID_REQUEST");
  }
  const structure = state.structures.find(
    (candidate) => candidate.id === request.structureId,
  );
  if (structure === undefined) return upgradeFailure("UNKNOWN_STRUCTURE");
  if (structure.ownerId !== request.ownerId) return upgradeFailure("NOT_OWNER");
  if (structure.construction !== undefined) {
    return upgradeFailure("CONSTRUCTION_IN_PROGRESS");
  }
  if (structure.completedLevel === undefined) return upgradeFailure("NOT_COMPLETED");
  if (structure.completedLevel >= 5) return upgradeFailure("MAX_LEVEL");
  if (!upgradeAllowed(state, structure)) {
    return upgradeFailure("UPGRADE_NOT_PERMITTED");
  }

  const remainingTicks = effectiveStructureConstructionTicks(
    state,
    structure.ownerId,
    structure.type,
  );
  const targetLevel = (structure.completedLevel + 1) as StructureLevel;
  const upgraded = materializePersistentStructureState({
    ...structure,
    construction: { targetLevel, remainingTicks },
  });
  return Object.freeze({
    ok: true,
    structure: upgraded,
    structures: materializePersistentStructures(
      state.structures.map((candidate) =>
        candidate.id === structure.id ? upgraded : candidate,
      ),
    ),
  });
}

function factionHasN17CaptureDestruction(
  state: MatchState,
  ownerId: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  return (
    owner?.rules.customDomains.some(
      (entry) =>
        entry.sourceKind === "ORIGIN" &&
        entry.sourceId === "N17" &&
        entry.domain === "STRUCTURE_CAPTURE_DISPOSITION",
    ) ?? false
  );
}

function acquisitionLevelForCapture(
  structure: PersistentStructureState,
): StructureLevel {
  if (structure.completedLevel !== undefined) return structure.completedLevel;
  if (structure.construction !== undefined) return structure.construction.targetLevel;
  throw new Error(`structure ${structure.id} has no level-bearing persistent state`);
}

function resolveCaptureTransfers(
  state: MatchState,
  nextOwnership: readonly (string | null)[],
): readonly PersistentStructureState[] {
  const candidates = state.structures
    .filter((structure) => {
      const nextOwner = nextOwnership[structure.cellId] ?? null;
      return nextOwner !== null && nextOwner !== structure.ownerId;
    })
    .sort(
      (left, right) => left.cellId - right.cellId || compareIds(left.id, right.id),
    );
  if (candidates.length === 0) return state.structures;

  const candidateIds = new Set(candidates.map((structure) => structure.id));
  let working = state.structures.filter(
    (structure) => !candidateIds.has(structure.id),
  );

  for (const structure of candidates) {
    const nextOwnerId = nextOwnership[structure.cellId];
    if (nextOwnerId === null || nextOwnerId === undefined) continue;
    if (factionHasN17CaptureDestruction(state, nextOwnerId)) continue;

    const admissionState = {
      ...state,
      ownership: nextOwnership,
      structures: materializePersistentStructures([...working, structure]),
    } as MatchState;
    const admission = evaluateStructureAcquisitionAdmission(admissionState, {
      structureId: structure.id,
      ownerId: nextOwnerId,
      type: structure.type,
      cellId: structure.cellId,
      level: acquisitionLevelForCapture(structure),
      acquisitionPath: "CAPTURE_TRANSFER",
    });
    if (!admission.ok) {
      if (admission.failure.code === "OWNERSHIP_CAP") continue;
      throw new Error(
        `capture transfer admission for ${structure.id} failed with ${admission.failure.code}`,
      );
    }

    working = [
      ...working,
      materializePersistentStructureState({
        ...structure,
        ownerId: nextOwnerId,
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ];
  }

  return materializePersistentStructures(working);
}

function matureChargeSlots(
  slots: readonly StructureChargeSlotState[] | undefined,
  currentTick: number,
): readonly StructureChargeSlotState[] | undefined {
  if (slots === undefined) return undefined;
  return freezeChargeSlots(
    slots.map((slot) =>
      slot.state === "RECHARGING" && currentTick >= slot.readyAtTick
        ? { slotId: slot.slotId, state: "READY" as const }
        : slot,
    ),
  );
}

function completedSiloChargeSlots(
  state: MatchState,
  structure: PersistentStructureState,
  targetLevel: StructureLevel,
  activationTick: number,
): readonly StructureChargeSlotState[] {
  if (structure.completedLevel === undefined) {
    return Object.freeze(
      Array.from({ length: targetLevel }, (_, slotId) =>
        Object.freeze({ slotId, state: "READY" as const }),
      ),
    );
  }

  const existing = matureChargeSlots(structure.chargeSlots, activationTick);
  if (existing === undefined) {
    throw new Error(
      `upgrading Missile Silo ${structure.id} is missing its persistent charge bank`,
    );
  }
  const byId = new Map(existing.map((slot) => [slot.slotId, slot]));
  for (let slotId = 0; slotId < structure.completedLevel; slotId += 1) {
    if (!byId.has(slotId)) {
      throw new Error(
        `upgrading Missile Silo ${structure.id} is missing charge slot ${slotId}`,
      );
    }
  }

  const rechargeTicks = effectiveStructureRechargeTicks(
    state,
    structure.ownerId,
    "MISSILE_SILO",
  );
  const result: StructureChargeSlotState[] = [...existing];
  for (let slotId = structure.completedLevel; slotId < targetLevel; slotId += 1) {
    if (byId.has(slotId)) {
      throw new Error(
        `upgrading Missile Silo ${structure.id} already contains future charge slot ${slotId}`,
      );
    }
    result.push({
      slotId,
      state: "RECHARGING",
      readyAtTick: activationTick + rechargeTicks,
    });
  }
  return freezeChargeSlots(result);
}

function progressStructure(
  state: MatchState,
  structure: PersistentStructureState,
  currentTick: number,
): PersistentStructureState {
  const maturedSlots = matureChargeSlots(structure.chargeSlots, currentTick);
  const current =
    maturedSlots === structure.chargeSlots
      ? structure
      : materializePersistentStructureState({
          ...structure,
          ...(maturedSlots === undefined ? {} : { chargeSlots: maturedSlots }),
        });
  if (current.construction === undefined) return current;

  if (current.construction.remainingTicks > 1) {
    return materializePersistentStructureState({
      ...current,
      construction: {
        targetLevel: current.construction.targetLevel,
        remainingTicks: current.construction.remainingTicks - 1,
      },
    });
  }

  const targetLevel = current.construction.targetLevel;
  const chargeSlots =
    current.type === "MISSILE_SILO"
      ? completedSiloChargeSlots(state, current, targetLevel, currentTick)
      : maturedSlots;
  return materializePersistentStructureState({
    id: current.id,
    ownerId: current.ownerId,
    type: current.type,
    cellId: current.cellId,
    completedLevel: targetLevel,
    active: true,
    ...(chargeSlots === undefined ? {} : { chargeSlots }),
    acquisitionPath: current.acquisitionPath,
  });
}

export function resolvePersistentStructureLifecycleTick(
  state: MatchState,
  nextOwnership: readonly (string | null)[],
  currentTick: number,
): readonly PersistentStructureState[] {
  if (nextOwnership.length !== state.ownership.length) {
    throw new Error("structure lifecycle ownership length must match MatchState");
  }
  if (!Number.isSafeInteger(currentTick) || currentTick < 0) {
    throw new Error("structure lifecycle tick must be a non-negative safe integer");
  }

  const afterCapture = resolveCaptureTransfers(state, nextOwnership);
  const postCaptureState = {
    ...state,
    ownership: nextOwnership,
    structures: afterCapture,
  } as MatchState;
  return materializePersistentStructures(
    afterCapture.map((structure) =>
      progressStructure(postCaptureState, structure, currentTick),
    ),
  );
}
