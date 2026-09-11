import type {
  CellId,
  FactionId,
  MobileUnitType,
  UnitId,
} from "../core/controller/ControllerApi";

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

export function createUnitAttackResolvedEvent(
  _input: CreateUnitAttackResolvedEventInput,
): UnitAttackResolvedEvent {
  throw new Error("SimulationEvents foundation not implemented");
}

export function createUnitDestroyedEvent(
  _input: CreateUnitDestroyedEventInput,
): UnitDestroyedEvent {
  throw new Error("SimulationEvents foundation not implemented");
}
