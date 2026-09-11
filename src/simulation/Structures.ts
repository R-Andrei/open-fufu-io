import type {
  FactionId,
  StructureLevel,
} from "../core/controller/ControllerApi";
import type { MatchState } from "./MatchState";
import type { CellOwnershipChangedEvent } from "./SimulationEvents";
import {
  effectiveStructureRechargeTicks,
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructureState,
  materializePersistentStructures,
  type PersistentStructureState,
  type StructureChargeSlotState,
} from "./StructuresCore";

export * from "./StructuresCore";

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertTransitionTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) {
    throw new Error("structure lifecycle tick must be a non-negative safe integer");
  }
}

function isFactionIdOrNull(value: unknown): value is FactionId | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

function validateOwnershipEventBatch(
  state: MatchState,
  events: readonly CellOwnershipChangedEvent[],
  currentTick: number,
): ReadonlyMap<number, CellOwnershipChangedEvent> {
  const byCell = new Map<number, CellOwnershipChangedEvent>();

  for (const candidate of events as readonly unknown[]) {
    if (candidate === null || typeof candidate !== "object") {
      throw new Error("cell ownership event must be an object");
    }
    const event = candidate as Partial<CellOwnershipChangedEvent> & {
      payload?: Partial<CellOwnershipChangedEvent["payload"]>;
    };
    if (event.kind !== "CELL_OWNERSHIP_CHANGED") {
      throw new Error("structure lifecycle received a non-ownership event");
    }
    if (typeof event.id !== "string" || event.id.length === 0) {
      throw new Error("cell ownership event id must be a non-empty string");
    }
    if (event.tick !== currentTick) {
      throw new Error("cell ownership event tick must match structure lifecycle tick");
    }
    if (event.payload === null || typeof event.payload !== "object") {
      throw new Error("cell ownership event payload must be an object");
    }

    const cellId = event.payload.cellId;
    if (
      typeof cellId !== "number" ||
      !Number.isSafeInteger(cellId) ||
      cellId < 0 ||
      Object.is(cellId, -0) ||
      cellId >= state.ownership.length
    ) {
      throw new Error("cell ownership event cellId is outside MatchState ownership");
    }
    if (byCell.has(cellId)) {
      throw new Error(`duplicate cell ownership event for cell ${cellId}`);
    }

    const previousOwnerId = event.payload.previousOwnerId;
    const nextOwnerId = event.payload.nextOwnerId;
    if (!isFactionIdOrNull(previousOwnerId) || !isFactionIdOrNull(nextOwnerId)) {
      throw new Error("cell ownership event owner ids must be null or non-empty strings");
    }
    if (previousOwnerId === nextOwnerId) {
      throw new Error("cell ownership event requires distinct previous and next owners");
    }
    if ((state.ownership[cellId] ?? null) !== nextOwnerId) {
      throw new Error(
        `cell ownership event next owner does not match current ownership for cell ${cellId}`,
      );
    }

    byCell.set(cellId, event as CellOwnershipChangedEvent);
  }

  return byCell;
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

function resolveCaptureTransfersFromEvents(
  state: MatchState,
  eventsByCell: ReadonlyMap<number, CellOwnershipChangedEvent>,
): readonly PersistentStructureState[] {
  const candidates = state.structures
    .filter((structure) => {
      const event = eventsByCell.get(structure.cellId);
      const nextOwnerId = event?.payload.nextOwnerId;
      return event !== undefined && nextOwnerId !== null && nextOwnerId !== structure.ownerId;
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
    const event = eventsByCell.get(structure.cellId);
    const nextOwnerId = event?.payload.nextOwnerId;
    if (nextOwnerId === null || nextOwnerId === undefined) continue;
    if (factionHasN17CaptureDestruction(state, nextOwnerId)) continue;

    const admissionState = {
      ...state,
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
  ownershipEvents: readonly CellOwnershipChangedEvent[],
  currentTick: number,
): readonly PersistentStructureState[] {
  assertTransitionTick(currentTick);
  const eventsByCell = validateOwnershipEventBatch(
    state,
    ownershipEvents,
    currentTick,
  );
  const afterCapture = resolveCaptureTransfersFromEvents(state, eventsByCell);
  const postCaptureState = {
    ...state,
    structures: afterCapture,
  } as MatchState;
  return materializePersistentStructures(
    afterCapture.map((structure) =>
      progressStructure(postCaptureState, structure, currentTick),
    ),
  );
}
