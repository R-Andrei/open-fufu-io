import type { HostilitySideIdentity } from "../core/FactionRelations";
import type {
  CellId,
  FactionId,
  MobileUnitType,
  UnitId,
} from "../core/controller/ControllerApi";

const MOBILE_UNIT_TYPES = new Set<MobileUnitType>([
  "TANK",
  "HEAVY_ARTILLERY",
  "WARSHIP",
  "TRANSPORT_SHIP",
  "TRADE_SHIP",
  "TRAIN",
]);

export interface SimulationEvent<TKind extends string, TPayload> {
  readonly id: string;
  readonly tick: number;
  readonly kind: TKind;
  readonly payload: Readonly<TPayload>;
}

export interface UnitEventSubject {
  readonly unitId: UnitId;
  readonly ownerId: FactionId;
  readonly unitType: MobileUnitType;
  readonly cellId: CellId;
}

export interface UnitAttackResolvedPayload {
  readonly attacker: UnitEventSubject;
  readonly target: UnitEventSubject;
}

export type UnitAttackResolvedEvent = SimulationEvent<
  "UNIT_ATTACK_RESOLVED",
  UnitAttackResolvedPayload
>;

export interface UnitAttackDestructionCause {
  readonly kind: "UNIT_ATTACK";
  readonly attackEventId: string;
  readonly attacker: UnitEventSubject;
}

export interface UnitDestroyedPayload {
  readonly unit: UnitEventSubject;
  readonly causes: readonly UnitAttackDestructionCause[];
}

export type UnitDestroyedEvent = SimulationEvent<
  "UNIT_DESTROYED",
  UnitDestroyedPayload
>;

export interface RadioactiveAttackAftershockResolvedPayload {
  readonly attacker: UnitEventSubject;
  readonly targetCellId: CellId;
  readonly affectedCellIds: readonly CellId[];
}

export type RadioactiveAttackAftershockResolvedEvent = SimulationEvent<
  "RADIOACTIVE_ATTACK_AFTERSHOCK_RESOLVED",
  RadioactiveAttackAftershockResolvedPayload
>;

export interface CellOwnershipChangedPayload {
  readonly cellId: CellId;
  readonly previousOwnerId: FactionId | null;
  readonly nextOwnerId: FactionId | null;
}

export type CellOwnershipChangedEvent = SimulationEvent<
  "CELL_OWNERSHIP_CHANGED",
  CellOwnershipChangedPayload
>;

export interface PersistentDirectedHostilitySourceEndedPayload {
  readonly sourceSide: HostilitySideIdentity;
  readonly targetSide: HostilitySideIdentity;
}

export type PersistentDirectedHostilitySourceEndedEvent = SimulationEvent<
  "PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED",
  PersistentDirectedHostilitySourceEndedPayload
>;

export interface FactionCapitulatedPayload {
  readonly factionId: FactionId;
}

export type FactionCapitulatedEvent = SimulationEvent<
  "FACTION_CAPITULATED",
  FactionCapitulatedPayload
>;

export type PhysicalUnitSimulationEvent =
  | UnitAttackResolvedEvent
  | UnitDestroyedEvent;

export type HostilityLifecycleSimulationEvent =
  | PersistentDirectedHostilitySourceEndedEvent
  | FactionCapitulatedEvent;

export interface CreateUnitAttackResolvedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly attacker: UnitEventSubject;
  readonly target: UnitEventSubject;
}

export interface CreateUnitDestroyedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly unit: UnitEventSubject;
  readonly causes: readonly UnitAttackDestructionCause[];
}

export interface CreateRadioactiveAttackAftershockResolvedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly attacker: UnitEventSubject;
  readonly targetCellId: CellId;
  readonly affectedCellIds: readonly CellId[];
}

export interface CreateCellOwnershipChangedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly cellId: CellId;
  readonly previousOwnerId: FactionId | null;
  readonly nextOwnerId: FactionId | null;
}

export interface CreatePersistentDirectedHostilitySourceEndedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly sourceSide: HostilitySideIdentity;
  readonly targetSide: HostilitySideIdentity;
}

export interface CreateFactionCapitulatedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly factionId: FactionId;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertNonEmptyId(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) {
    throw new Error("simulation event tick must be a non-negative safe integer");
  }
}

function assertCellId(cellId: number, label: string): void {
  if (!Number.isSafeInteger(cellId) || cellId < 0 || Object.is(cellId, -0)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function assertOptionalFactionId(value: FactionId | null, label: string): void {
  if (value !== null) assertNonEmptyId(value, label);
}

function freezeUnitSubject(subject: UnitEventSubject): UnitEventSubject {
  assertNonEmptyId(subject.unitId, "unit event subject unitId");
  assertNonEmptyId(subject.ownerId, "unit event subject ownerId");
  if (!MOBILE_UNIT_TYPES.has(subject.unitType)) {
    throw new Error(`unsupported unit event subject type: ${String(subject.unitType)}`);
  }
  assertCellId(subject.cellId, "unit event subject cellId");
  return Object.freeze({
    unitId: subject.unitId,
    ownerId: subject.ownerId,
    unitType: subject.unitType,
    cellId: subject.cellId,
  });
}

function freezeHostilitySide(
  side: HostilitySideIdentity,
  label: string,
): HostilitySideIdentity {
  if (side === null || typeof side !== "object") {
    throw new Error(`${label} must be a hostility-side object`);
  }
  if (side.kind !== "FACTION" && side.kind !== "FIXED_TEAM") {
    throw new Error(`${label} has an unsupported hostility-side kind`);
  }
  assertNonEmptyId(side.id, `${label} id`);
  return Object.freeze({ kind: side.kind, id: side.id });
}

function hostilitySideKey(side: HostilitySideIdentity): string {
  return `${side.kind}\u0000${side.id}`;
}

export function createUnitAttackResolvedEvent(
  input: CreateUnitAttackResolvedEventInput,
): UnitAttackResolvedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "UNIT_ATTACK_RESOLVED" as const,
    payload: Object.freeze({
      attacker: freezeUnitSubject(input.attacker),
      target: freezeUnitSubject(input.target),
    }),
  });
}

export function createUnitDestroyedEvent(
  input: CreateUnitDestroyedEventInput,
): UnitDestroyedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  const causes = input.causes
    .map((cause) => {
      if (cause.kind !== "UNIT_ATTACK") {
        throw new Error(`unsupported unit destruction cause: ${String(cause.kind)}`);
      }
      assertNonEmptyId(cause.attackEventId, "attack event id");
      return Object.freeze({
        kind: "UNIT_ATTACK" as const,
        attackEventId: cause.attackEventId,
        attacker: freezeUnitSubject(cause.attacker),
      });
    })
    .sort(
      (left, right) =>
        compareIds(left.attacker.unitId, right.attacker.unitId) ||
        compareIds(left.attackEventId, right.attackEventId),
    );

  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "UNIT_DESTROYED" as const,
    payload: Object.freeze({
      unit: freezeUnitSubject(input.unit),
      causes: Object.freeze(causes),
    }),
  });
}

export function createRadioactiveAttackAftershockResolvedEvent(
  input: CreateRadioactiveAttackAftershockResolvedEventInput,
): RadioactiveAttackAftershockResolvedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  assertCellId(input.targetCellId, "radioactive aftershock targetCellId");
  const affectedCellIds = input.affectedCellIds.map((cellId) => {
    assertCellId(cellId, "radioactive aftershock affected cellId");
    return cellId;
  });

  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "RADIOACTIVE_ATTACK_AFTERSHOCK_RESOLVED" as const,
    payload: Object.freeze({
      attacker: freezeUnitSubject(input.attacker),
      targetCellId: input.targetCellId,
      affectedCellIds: Object.freeze(affectedCellIds),
    }),
  });
}

export function createCellOwnershipChangedEvent(
  input: CreateCellOwnershipChangedEventInput,
): CellOwnershipChangedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  assertCellId(input.cellId, "cell ownership event cellId");
  assertOptionalFactionId(input.previousOwnerId, "cell ownership previous ownerId");
  assertOptionalFactionId(input.nextOwnerId, "cell ownership next ownerId");
  if (input.previousOwnerId === input.nextOwnerId) {
    throw new Error("cell ownership change requires distinct previous and next owners");
  }
  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "CELL_OWNERSHIP_CHANGED" as const,
    payload: Object.freeze({
      cellId: input.cellId,
      previousOwnerId: input.previousOwnerId,
      nextOwnerId: input.nextOwnerId,
    }),
  });
}

export function createPersistentDirectedHostilitySourceEndedEvent(
  input: CreatePersistentDirectedHostilitySourceEndedEventInput,
): PersistentDirectedHostilitySourceEndedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  const sourceSide = freezeHostilitySide(input.sourceSide, "hostility source side");
  const targetSide = freezeHostilitySide(input.targetSide, "hostility target side");
  if (hostilitySideKey(sourceSide) === hostilitySideKey(targetSide)) {
    throw new Error("ended hostility source requires two distinct sides");
  }
  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED" as const,
    payload: Object.freeze({
      sourceSide,
      targetSide,
    }),
  });
}

export function createFactionCapitulatedEvent(
  input: CreateFactionCapitulatedEventInput,
): FactionCapitulatedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  assertNonEmptyId(input.factionId, "capitulated factionId");
  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "FACTION_CAPITULATED" as const,
    payload: Object.freeze({ factionId: input.factionId }),
  });
}
