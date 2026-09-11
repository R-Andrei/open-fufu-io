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

export type PhysicalUnitSimulationEvent =
  | UnitAttackResolvedEvent
  | UnitDestroyedEvent;

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

function freezeUnitSubject(subject: UnitEventSubject): UnitEventSubject {
  assertNonEmptyId(subject.unitId, "unit event subject unitId");
  assertNonEmptyId(subject.ownerId, "unit event subject ownerId");
  if (!MOBILE_UNIT_TYPES.has(subject.unitType)) {
    throw new Error(`unsupported unit event subject type: ${String(subject.unitType)}`);
  }
  if (
    !Number.isSafeInteger(subject.cellId) ||
    subject.cellId < 0 ||
    Object.is(subject.cellId, -0)
  ) {
    throw new Error("unit event subject cellId must be a non-negative safe integer");
  }
  return Object.freeze({
    unitId: subject.unitId,
    ownerId: subject.ownerId,
    unitType: subject.unitType,
    cellId: subject.cellId,
  });
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
