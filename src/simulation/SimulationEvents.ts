import type { HostilitySideIdentity } from "../core/FactionRelations";
import type {
  CellId,
  FactionId,
  MobileUnitType,
  StructureId,
  StructureLevel,
  StructureType,
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

export interface CellOwnershipChangedPayload {
  readonly cellId: CellId;
  readonly previousOwnerId: FactionId | null;
  readonly nextOwnerId: FactionId | null;
}

export type CellOwnershipChangedEvent = SimulationEvent<
  "CELL_OWNERSHIP_CHANGED",
  CellOwnershipChangedPayload
>;

export interface StructureCaptureConstructionSnapshot {
  readonly targetLevel: StructureLevel;
  readonly remainingTicks: number;
}

export interface StructureCaptureEventSubject {
  readonly structureId: StructureId;
  readonly structureType: StructureType;
  readonly cellId: CellId;
  readonly previousOwnerId: FactionId;
  readonly capturingFactionId: FactionId;
  readonly completedLevel?: StructureLevel;
  readonly active: boolean;
  readonly construction?: StructureCaptureConstructionSnapshot;
}

export type StructureCaptureResolvedResult =
  | "STRUCTURE_TRANSFERRED"
  | "STRUCTURE_DESTROYED_ON_CAPTURE";

export interface StructureCaptureResolvedPayload {
  readonly structure: StructureCaptureEventSubject;
  readonly result: StructureCaptureResolvedResult;
}

export type StructureCaptureResolvedEvent = SimulationEvent<
  "STRUCTURE_CAPTURE_RESOLVED",
  StructureCaptureResolvedPayload
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

export interface CreateCellOwnershipChangedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly cellId: CellId;
  readonly previousOwnerId: FactionId | null;
  readonly nextOwnerId: FactionId | null;
}

export interface CreateStructureCaptureResolvedEventInput {
  readonly id: string;
  readonly tick: number;
  readonly structure: StructureCaptureEventSubject;
  readonly result: StructureCaptureResolvedResult;
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

function assertStructureLevel(value: StructureLevel, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 5) {
    throw new Error(`${label} must be an integer from 1 through 5`);
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

function freezeStructureCaptureSubject(
  subject: StructureCaptureEventSubject,
): StructureCaptureEventSubject {
  assertNonEmptyId(subject.structureId, "structure capture subject structureId");
  if (!STRUCTURE_TYPES.has(subject.structureType)) {
    throw new Error(
      `unsupported structure capture subject type: ${String(subject.structureType)}`,
    );
  }
  assertCellId(subject.cellId, "structure capture subject cellId");
  assertNonEmptyId(subject.previousOwnerId, "structure capture previous ownerId");
  assertNonEmptyId(
    subject.capturingFactionId,
    "structure capture capturing factionId",
  );
  if (subject.previousOwnerId === subject.capturingFactionId) {
    throw new Error("structure capture requires distinct previous and capturing factions");
  }
  if (subject.completedLevel !== undefined) {
    assertStructureLevel(
      subject.completedLevel,
      "structure capture subject completedLevel",
    );
  }
  if (typeof subject.active !== "boolean") {
    throw new Error("structure capture subject active must be boolean");
  }
  const construction =
    subject.construction === undefined
      ? undefined
      : (() => {
          assertStructureLevel(
            subject.construction.targetLevel,
            "structure capture construction targetLevel",
          );
          if (
            !Number.isSafeInteger(subject.construction.remainingTicks) ||
            subject.construction.remainingTicks <= 0
          ) {
            throw new Error(
              "structure capture construction remainingTicks must be a positive safe integer",
            );
          }
          return Object.freeze({
            targetLevel: subject.construction.targetLevel,
            remainingTicks: subject.construction.remainingTicks,
          });
        })();

  return Object.freeze({
    structureId: subject.structureId,
    structureType: subject.structureType,
    cellId: subject.cellId,
    previousOwnerId: subject.previousOwnerId,
    capturingFactionId: subject.capturingFactionId,
    ...(subject.completedLevel === undefined
      ? {}
      : { completedLevel: subject.completedLevel }),
    active: subject.active,
    ...(construction === undefined ? {} : { construction }),
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

export function createStructureCaptureResolvedEvent(
  input: CreateStructureCaptureResolvedEventInput,
): StructureCaptureResolvedEvent {
  assertNonEmptyId(input.id, "simulation event id");
  assertTick(input.tick);
  if (
    input.result !== "STRUCTURE_TRANSFERRED" &&
    input.result !== "STRUCTURE_DESTROYED_ON_CAPTURE"
  ) {
    throw new Error(`unsupported structure capture result: ${String(input.result)}`);
  }
  return Object.freeze({
    id: input.id,
    tick: input.tick,
    kind: "STRUCTURE_CAPTURE_RESOLVED" as const,
    payload: Object.freeze({
      structure: freezeStructureCaptureSubject(input.structure),
      result: input.result,
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
