import type {
  ControllerDecision,
  ControllerMemory,
  DecisionFailure,
  DecisionReceipt,
  EconomyView,
  FactionStatus,
  PopulationView,
  SpawnInfluenceContext,
  SpawnInfluenceDecision,
  SpawnOriginContext,
  SpawnOriginDecision,
  SpawnReconsiderContext,
  StructureType,
} from "../core/controller/ControllerApi";
import {
  controllerOutputHasExpectedStructure,
  type ControllerOutputKind,
} from "../core/controller/ControllerOutputValidation";
import {
  createControllerQuerySession,
  type ControllerQuerySession,
} from "./ControllerQueryProjection";
import {
  createControllerSpatialSurface,
  type ControllerSpatialSurface,
} from "./ControllerSpatialSurface";
import {
  ECONOMY_TICKS_PER_SECOND,
  resolvePassiveFfyTick,
} from "./Economy";
import {
  materializeDirectiveChanges,
  tryApplyPersistentDirectiveChanges,
} from "./LandOperations";
import type { MatchState } from "./MatchState";
import type { PopulationState } from "./Population";
import type { SimulationAction } from "./TickEngine";

export {
  createControllerSpatialSurface,
  type ControllerSpatialSurface,
} from "./ControllerSpatialSurface";
export type { ControllerQuerySession } from "./ControllerQueryProjection";

export const CONTROLLER_MEMORY_MAX_BYTES = 131_072;
const MAX_CONSECUTIVE_NORMAL_RUNTIME_FAULTS = 5;
const MAX_TOTAL_NORMAL_RUNTIME_FAULTS = 20;
const utf8Encoder = new TextEncoder();
const passiveFfyPerSecondCache = new WeakMap<
  MatchState,
  ReadonlyMap<string, number>
>();

export const CONTROLLER_QUERY_LIMITS = Object.freeze({
  queriesPerDecision: 128,
  materializedCellsPerDecision: 25_000,
});

type ControllerHostFaultClassification = "INVALID_OUTPUT";

export interface LawfulFactionObservation {
  readonly id: string;
  readonly status: FactionStatus;
}

export type LawfulPopulationObservation = Readonly<
  Pick<
    PopulationView,
    | "total"
    | "available"
    | "committedOffense"
    | "committedCounterResponse"
    | "aboardTransports"
    | "neutralSettlementHalfResidual"
  >
>;

export interface LawfulSelfFactionObservation extends LawfulFactionObservation {
  readonly population: LawfulPopulationObservation;
  readonly ffy: number;
}

export interface LawfulControllerObservation {
  readonly tick: number;
  readonly decisionNumber: number;
  readonly me: LawfulSelfFactionObservation;
  readonly factions: readonly LawfulFactionObservation[];
  readonly economy: Readonly<EconomyView>;
  readonly lastDecision?: DecisionReceipt;
}

export interface LawfulInProcessControllerObservation
  extends LawfulControllerObservation {
  readonly map?: ControllerSpatialSurface["map"];
  readonly cells?: ControllerSpatialSurface["cells"];
  readonly segments?: ControllerSpatialSurface["segments"];
}

export interface HostedLawfulControllerObservation
  extends LawfulInProcessControllerObservation {
  readonly memory: Readonly<ControllerMemory>;
}

export type ControllerHostFaultCode =
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "MEMORY_LIMIT"
  | "SANDBOX_VIOLATION";

export interface ControllerHostFault {
  readonly code: ControllerHostFaultCode;
}

export type ControllerHostInvocationResult<T> =
  | Readonly<{ readonly ok: true; readonly output?: T }>
  | Readonly<{ readonly ok: false; readonly fault: ControllerHostFault }>;

export type ControllerHostInvocation<T> =
  | ControllerHostInvocationResult<T>
  | Promise<ControllerHostInvocationResult<T>>;

export interface ControllerHost {
  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
    querySession?: ControllerQuerySession,
  ): ControllerHostInvocation<ControllerDecision>;
  chooseInfluence(
    factionId: string,
    context: SpawnInfluenceContext,
  ): ControllerHostInvocation<SpawnInfluenceDecision>;
  reconsiderInfluence(
    factionId: string,
    context: SpawnReconsiderContext,
  ): ControllerHostInvocation<SpawnInfluenceDecision>;
  chooseOrigins(
    factionId: string,
    context: SpawnOriginContext,
  ): ControllerHostInvocation<SpawnOriginDecision>;
}

export type InProcessController = (
  observation: LawfulInProcessControllerObservation,
) => ControllerDecision | void;

export interface InProcessTestControllerCallbacks {
  readonly chooseInfluence?: (
    context: SpawnInfluenceContext,
  ) => SpawnInfluenceDecision | void;
  readonly reconsiderInfluence?: (
    context: SpawnReconsiderContext,
  ) => SpawnInfluenceDecision | void;
  readonly chooseOrigins?: (
    context: SpawnOriginContext,
  ) => SpawnOriginDecision | void;
  readonly decide?: (
    observation: HostedLawfulControllerObservation,
  ) => ControllerDecision | void;
}

export type InProcessTestControllerRegistration =
  | InProcessController
  | InProcessTestControllerCallbacks;

type ControllerOutputWithMemory = Readonly<{
  memory?: ControllerMemory;
}>;

class InvalidControllerValueError extends Error {}
export class ControllerMemoryLimitError extends InvalidControllerValueError {}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.getOwnPropertySymbols(value).length === 0
  );
}

function canonicalizeMemoryValue(
  value: unknown,
  ancestors: Set<object>,
): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new InvalidControllerValueError("controller memory number must be finite");
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "string":
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new InvalidControllerValueError("controller memory is not JSON-shaped");
  }

  if (ancestors.has(value)) {
    throw new InvalidControllerValueError("controller memory must be acyclic");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const entries: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new InvalidControllerValueError(
            "controller memory arrays must not be sparse",
          );
        }
        entries.push(canonicalizeMemoryValue(value[index], ancestors));
      }
      return `[${entries.join(",")}]`;
    }

    if (!isPlainRecord(value)) {
      throw new InvalidControllerValueError(
        "controller memory objects must be plain records",
      );
    }

    const entries = Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalizeMemoryValue(value[key], ancestors)}`,
      );
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeControllerMemory(value: unknown): string {
  if (!isPlainRecord(value)) {
    throw new InvalidControllerValueError(
      "controller memory root must be a plain object",
    );
  }

  const serialized = canonicalizeMemoryValue(value, new Set<object>());
  if (utf8Encoder.encode(serialized).byteLength > CONTROLLER_MEMORY_MAX_BYTES) {
    throw new ControllerMemoryLimitError("controller memory exceeds quota");
  }
  return serialized;
}

function deepFreezePlainValue<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) deepFreezePlainValue(entry, seen);
    return Object.freeze(value);
  }

  if (isPlainRecord(value)) {
    for (const key of Object.keys(value)) {
      deepFreezePlainValue(value[key], seen);
    }
    return Object.freeze(value);
  }

  return value;
}

export function decodeControllerMemory(
  serialized: string,
): Readonly<ControllerMemory> {
  return deepFreezePlainValue(JSON.parse(serialized) as ControllerMemory);
}

function cloneLegalValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== "object") return value;

  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const entry of value) clone.push(cloneLegalValue(entry, seen));
    return Object.freeze(clone) as T;
  }

  if (!isPlainRecord(value)) return value;

  const clone: Record<string, unknown> = {};
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    Object.defineProperty(clone, key, {
      value: cloneLegalValue(value[key], seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return Object.freeze(clone) as T;
}

function projectHostedContext<T extends object>(
  context: T,
  memory: Readonly<ControllerMemory>,
): T & { readonly memory: Readonly<ControllerMemory> } {
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(context)) {
    if (key === "memory") continue;
    Object.defineProperty(clone, key, {
      value: cloneLegalValue((context as Record<string, unknown>)[key]),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(clone, "memory", {
    value: memory,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return Object.freeze(clone) as T & {
    readonly memory: Readonly<ControllerMemory>;
  };
}

function projectInProcessObservation(
  observation: LawfulControllerObservation,
  querySession?: ControllerQuerySession,
): LawfulInProcessControllerObservation {
  if (querySession === undefined) return observation;
  return Object.freeze({
    ...observation,
    ...createControllerSpatialSurface(querySession),
  });
}

function materializeControllerValue(
  value: unknown,
  ancestors: Set<object>,
): unknown {
  if (value === null) return null;

  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new InvalidControllerValueError(
          "controller output number must be finite",
        );
      }
      return value;
    case "object":
      break;
    default:
      throw new InvalidControllerValueError(
        "controller output must be transport-safe data",
      );
  }

  if (ancestors.has(value)) {
    throw new InvalidControllerValueError("controller output must be acyclic");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const clone: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new InvalidControllerValueError(
            "controller output arrays must not be sparse",
          );
        }
        clone.push(materializeControllerValue(value[index], ancestors));
      }
      return Object.freeze(clone);
    }

    if (!isPlainRecord(value)) {
      throw new InvalidControllerValueError(
        "controller output objects must be plain records",
      );
    }

    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      Object.defineProperty(clone, key, {
        value: materializeControllerValue(value[key], ancestors),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return Object.freeze(clone);
  } finally {
    ancestors.delete(value);
  }
}

function hostSuccess<T>(
  output?: T,
): ControllerHostInvocationResult<T> {
  return output === undefined
    ? Object.freeze({ ok: true as const })
    : Object.freeze({ ok: true as const, output });
}

function hostFault<T>(
  code: ControllerHostFaultCode,
  classification?: ControllerHostFaultClassification,
): ControllerHostInvocationResult<T> {
  const fault = { code } as ControllerHostFault & {
    readonly classification?: ControllerHostFaultClassification;
  };
  if (classification !== undefined) {
    Object.defineProperty(fault, "classification", {
      value: classification,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze({
    ok: false as const,
    fault: Object.freeze(fault),
  });
}

function freezeControllerRegistration(
  registration: InProcessTestControllerRegistration,
): InProcessTestControllerRegistration {
  return typeof registration === "function"
    ? registration
    : Object.freeze({ ...registration });
}

export class InProcessTestControllerHost implements ControllerHost {
  private readonly controllers: Readonly<
    Record<string, InProcessTestControllerRegistration>
  >;
  private readonly memoryByFaction = new Map<string, string>();

  constructor(
    controllers: Readonly<Record<string, InProcessTestControllerRegistration>>,
  ) {
    this.controllers = Object.freeze(
      Object.fromEntries(
        Object.entries(controllers).map(([factionId, registration]) => [
          factionId,
          freezeControllerRegistration(registration),
        ]),
      ),
    );
  }

  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
    querySession?: ControllerQuerySession,
  ): ControllerHostInvocationResult<ControllerDecision> {
    const registration = this.controllers[factionId];
    if (registration === undefined) return hostSuccess();
    const inProcessObservation = projectInProcessObservation(
      observation,
      querySession,
    );

    if (typeof registration === "function") {
      return this.executeInvocation<ControllerDecision>(
        factionId,
        "DECIDE",
        () => registration(inProcessObservation),
      );
    }

    return this.executeInvocation<ControllerDecision>(
      factionId,
      "DECIDE",
      (memory) =>
        registration.decide?.(
          projectHostedContext(inProcessObservation, memory),
        ),
    );
  }

  chooseInfluence(
    factionId: string,
    context: SpawnInfluenceContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision> {
    const registration = this.controllerCallbacks(factionId);
    return this.executeInvocation<SpawnInfluenceDecision>(
      factionId,
      "CHOOSE_INFLUENCE",
      (memory) => registration?.chooseInfluence?.(projectHostedContext(context, memory)),
    );
  }

  reconsiderInfluence(
    factionId: string,
    context: SpawnReconsiderContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision> {
    const registration = this.controllerCallbacks(factionId);
    return this.executeInvocation<SpawnInfluenceDecision>(
      factionId,
      "RECONSIDER_INFLUENCE",
      (memory) => registration?.reconsiderInfluence?.(projectHostedContext(context, memory)),
    );
  }

  chooseOrigins(
    factionId: string,
    context: SpawnOriginContext,
  ): ControllerHostInvocationResult<SpawnOriginDecision> {
    const registration = this.controllerCallbacks(factionId);
    return this.executeInvocation<SpawnOriginDecision>(
      factionId,
      "CHOOSE_ORIGINS",
      (memory) => registration?.chooseOrigins?.(projectHostedContext(context, memory)),
    );
  }

  private controllerCallbacks(
    factionId: string,
  ): InProcessTestControllerCallbacks | undefined {
    const registration = this.controllers[factionId];
    return registration !== undefined && typeof registration !== "function"
      ? registration
      : undefined;
  }

  private controllerMemory(factionId: string): Readonly<ControllerMemory> {
    return decodeControllerMemory(this.memoryByFaction.get(factionId) ?? "{}");
  }

  private executeInvocation<T extends ControllerOutputWithMemory>(
    factionId: string,
    outputKind: ControllerOutputKind,
    invoke: (memory: Readonly<ControllerMemory>) => T | void,
  ): ControllerHostInvocationResult<T> {
    let output: T | void;
    try {
      output = invoke(this.controllerMemory(factionId));
    } catch {
      return hostFault("RUNTIME_ERROR");
    }

    if (output === undefined) return hostSuccess();
    if (!isPlainRecord(output)) {
      return hostFault("RUNTIME_ERROR", "INVALID_OUTPUT");
    }

    try {
      const materialized = materializeControllerValue(
        output,
        new Set<object>(),
      ) as T;
      if (!controllerOutputHasExpectedStructure(outputKind, materialized)) {
        return hostFault("RUNTIME_ERROR", "INVALID_OUTPUT");
      }

      let nextMemory: string | undefined;
      if (Object.prototype.hasOwnProperty.call(materialized, "memory")) {
        nextMemory = canonicalizeControllerMemory(materialized.memory);
      }

      if (nextMemory !== undefined) {
        this.memoryByFaction.set(factionId, nextMemory);
      }
      return hostSuccess(materialized);
    } catch (error) {
      return error instanceof ControllerMemoryLimitError
        ? hostFault("MEMORY_LIMIT")
        : hostFault("RUNTIME_ERROR", "INVALID_OUTPUT");
    }
  }
}

export interface ControllerRoundReceipt {
  readonly factionId: string;
  readonly receipt: DecisionReceipt;
}

export interface DeferredControllerStructureBuildAction {
  readonly type: "CONTROLLER_PURCHASE_STRUCTURE_BUILD";
  readonly ownerId: string;
  readonly structureType: StructureType;
  readonly cellId: number;
}

export interface DeferredControllerStructureUpgradeAction {
  readonly type: "CONTROLLER_PURCHASE_STRUCTURE_UPGRADE";
  readonly ownerId: string;
  readonly cellId: number;
}

export type ControllerProposedSimulationAction =
  | SimulationAction
  | DeferredControllerStructureBuildAction
  | DeferredControllerStructureUpgradeAction;

export interface ControllerProposedAction {
  readonly key?: string;
  readonly action: ControllerProposedSimulationAction;
}

export interface ControllerProposalActions {
  readonly factionId: string;
  readonly actions: readonly ControllerProposedAction[];
}

export interface ControllerRoundEvaluation {
  readonly actions: readonly SimulationAction[];
  readonly proposals: readonly ControllerProposalActions[];
  readonly receipts: readonly ControllerRoundReceipt[];
  readonly faultCounts: ReadonlyMap<string, number>;
  readonly consecutiveFaultCounts: ReadonlyMap<string, number>;
  readonly faultedFactionIds: ReadonlySet<string>;
}

interface ProposalEvaluation {
  readonly actions: readonly ControllerProposedAction[];
  readonly failure?: DecisionFailure;
}

interface InvocationOutcome {
  readonly factionId: string;
  readonly invocation?: ControllerHostInvocationResult<ControllerDecision>;
  readonly threw?: true;
  readonly skipped?: true;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as Promise<T>).then === "function"
  );
}

function freezeFactionObservation(
  id: string,
  status: FactionStatus,
): LawfulFactionObservation {
  return Object.freeze({ id, status });
}

function freezePopulationObservation(
  population: PopulationState,
): LawfulPopulationObservation {
  return Object.freeze({
    total: population.total,
    available: population.available,
    committedOffense: population.committedOffensive,
    committedCounterResponse: population.committedCounterResponse,
    aboardTransports: population.aboardTransports,
    neutralSettlementHalfResidual: population.neutralSettlementHalfResidual,
  });
}

function freezeSelfFactionObservation(
  id: string,
  status: FactionStatus,
  ffy: number,
  population: PopulationState,
): LawfulSelfFactionObservation {
  return Object.freeze({
    id,
    status,
    ffy,
    population: freezePopulationObservation(population),
  });
}

function realizedPassiveFfyPerSecondByFaction(
  state: MatchState,
): ReadonlyMap<string, number> {
  const cached = passiveFfyPerSecondCache.get(state);
  if (cached !== undefined) return cached;

  const currentById = new Map(
    state.factions.map((faction) => [faction.id, faction] as const),
  );
  const rates = new Map<string, number>();
  for (const projected of resolvePassiveFfyTick(state)) {
    const current = currentById.get(projected.id);
    if (current === undefined) {
      throw new Error(`passive FFY projection returned unknown faction ${projected.id}`);
    }
    const perTick = projected.ffy - current.ffy;
    const perSecond = perTick * ECONOMY_TICKS_PER_SECOND;
    if (!Number.isSafeInteger(perSecond) || perSecond < 0) {
      throw new Error(
        `passive FFY projection is outside the safe non-negative integer range for ${projected.id}`,
      );
    }
    rates.set(projected.id, perSecond);
  }
  passiveFfyPerSecondCache.set(state, rates);
  return rates;
}

export function projectLawfulControllerObservation(
  state: MatchState,
  factionId: string,
  decisionNumber: number,
  lastDecision?: DecisionReceipt,
): LawfulControllerObservation {
  const me = state.factions.find((faction) => faction.id === factionId);
  if (me === undefined) {
    throw new Error(`unknown controller faction: ${factionId}`);
  }

  const factions = Object.freeze(
    [...state.factions]
      .sort((left, right) => compareIds(left.id, right.id))
      .map((faction) => freezeFactionObservation(faction.id, faction.status)),
  );
  const passiveFfyPerSecond = realizedPassiveFfyPerSecondByFaction(state).get(
    factionId,
  );
  if (passiveFfyPerSecond === undefined) {
    throw new Error(`missing passive FFY projection for faction ${factionId}`);
  }
  const economy = Object.freeze({
    ffy: me.ffy,
    passiveFfyPerSecond,
  });

  return Object.freeze({
    tick: state.tick,
    decisionNumber,
    me: freezeSelfFactionObservation(me.id, me.status, me.ffy, me.population),
    factions,
    economy,
    ...(lastDecision === undefined ? {} : { lastDecision }),
  });
}

function invalid(
  code: DecisionFailure["code"],
  key?: string,
): ProposalEvaluation {
  return Object.freeze({
    actions: Object.freeze([]),
    failure: Object.freeze({ code, ...(key === undefined ? {} : { key }) }),
  });
}

function evaluateProposal(
  state: MatchState,
  factionId: string,
  decision: ControllerDecision | void,
): ProposalEvaluation {
  if (decision === undefined) {
    return Object.freeze({ actions: Object.freeze([]) });
  }

  const actions: ControllerProposedAction[] = [];
  const directiveSet = decision.directives?.set ?? [];
  const directiveEnd = decision.directives?.end ?? [];
  if (directiveSet.length > 0 || directiveEnd.length > 0) {
    let changes;
    try {
      changes = materializeDirectiveChanges({
        ...(directiveSet.length === 0 ? {} : { set: directiveSet }),
        ...(directiveEnd.length === 0 ? {} : { end: directiveEnd }),
      });
    } catch {
      return invalid(
        "INVALID_DIRECTIVE",
        directiveSet[0]?.key ?? directiveEnd[0],
      );
    }
    const applied = tryApplyPersistentDirectiveChanges(state, factionId, changes);
    if (!applied.ok) {
      return Object.freeze({ actions: Object.freeze([]), failure: applied.failure });
    }
    actions.push(
      Object.freeze({
        action: Object.freeze({
          type: "APPLY_PERSISTENT_DIRECTIVES" as const,
          factionId,
          changes,
        }),
      }),
    );
  }

  const commands = decision.commands ?? [];
  const seenKeys = new Set<string>();
  let hasCapitulation = false;

  for (const command of commands) {
    if (seenKeys.has(command.key)) {
      return invalid("CONFLICTING_PROPOSAL", command.key);
    }
    seenKeys.add(command.key);

    if (command.kind === "CAPITULATE") {
      if (hasCapitulation) {
        return invalid("CONFLICTING_PROPOSAL", command.key);
      }
      const faction = state.factions.find((candidate) => candidate.id === factionId);
      if (faction === undefined || faction.status !== "ACTIVE") {
        return invalid("INVALID_TARGET", command.key);
      }
      hasCapitulation = true;
      actions.push(
        Object.freeze({
          key: command.key,
          action: Object.freeze({
            type: "CAPITULATE_FACTION" as const,
            factionId,
          }),
        }),
      );
      continue;
    }

    if (command.kind === "BUILD_STRUCTURE") {
      actions.push(
        Object.freeze({
          key: command.key,
          action: Object.freeze({
            type: "CONTROLLER_PURCHASE_STRUCTURE_BUILD" as const,
            ownerId: factionId,
            structureType: command.structure,
            cellId: command.cellId,
          }),
        }),
      );
      continue;
    }

    if (command.kind === "UPGRADE_STRUCTURE") {
      actions.push(
        Object.freeze({
          key: command.key,
          action: Object.freeze({
            type: "CONTROLLER_PURCHASE_STRUCTURE_UPGRADE" as const,
            ownerId: factionId,
            cellId: command.cellId,
          }),
        }),
      );
      continue;
    }

    return invalid("INVALID_COMMAND", command.key);
  }

  return Object.freeze({ actions: Object.freeze(actions) });
}

function recordNormalRuntimeFault(
  factionId: string,
  faultCounts: Map<string, number>,
  consecutiveFaultCounts: Map<string, number>,
  faultedFactionIds: Set<string>,
): void {
  const total = (faultCounts.get(factionId) ?? 0) + 1;
  const consecutive = (consecutiveFaultCounts.get(factionId) ?? 0) + 1;
  faultCounts.set(factionId, total);
  consecutiveFaultCounts.set(factionId, consecutive);
  if (
    consecutive >= MAX_CONSECUTIVE_NORMAL_RUNTIME_FAULTS ||
    total >= MAX_TOTAL_NORMAL_RUNTIME_FAULTS
  ) {
    faultedFactionIds.add(factionId);
  }
}

function finalizeControllerRound(
  state: MatchState,
  decisionNumber: number,
  orderedFactionIds: readonly string[],
  outcomes: readonly InvocationOutcome[],
  previousFaultCounts: ReadonlyMap<string, number>,
  previousConsecutiveFaultCounts: ReadonlyMap<string, number>,
  previousFaultedFactionIds: ReadonlySet<string>,
): ControllerRoundEvaluation {
  const proposals = new Map<string, ControllerDecision | void>();
  const invocationFailures = new Map<string, DecisionFailure>();
  const faultCounts = new Map(previousFaultCounts);
  const consecutiveFaultCounts = new Map(previousConsecutiveFaultCounts);
  const faultedFactionIds = new Set(previousFaultedFactionIds);

  for (const outcome of outcomes) {
    if (outcome.skipped === true) {
      invocationFailures.set(
        outcome.factionId,
        Object.freeze({ code: "RUNTIME_ERROR" }),
      );
      continue;
    }

    const invocation = outcome.invocation;
    if (outcome.threw === true || invocation === undefined) {
      recordNormalRuntimeFault(
        outcome.factionId,
        faultCounts,
        consecutiveFaultCounts,
        faultedFactionIds,
      );
      invocationFailures.set(
        outcome.factionId,
        Object.freeze({ code: "RUNTIME_ERROR" }),
      );
      continue;
    }
    if (!invocation.ok) {
      recordNormalRuntimeFault(
        outcome.factionId,
        faultCounts,
        consecutiveFaultCounts,
        faultedFactionIds,
      );
      invocationFailures.set(
        outcome.factionId,
        Object.freeze({ code: invocation.fault.code }),
      );
      continue;
    }

    consecutiveFaultCounts.set(outcome.factionId, 0);
    proposals.set(outcome.factionId, invocation.output);
  }

  const actions: SimulationAction[] = [];
  const proposalActions: ControllerProposalActions[] = [];
  const receipts: ControllerRoundReceipt[] = [];
  const reservations = new Set<string>();

  for (const factionId of orderedFactionIds) {
    let failure = invocationFailures.get(factionId);
    let evaluatedActions: readonly ControllerProposedAction[] = Object.freeze([]);

    if (failure === undefined) {
      const evaluated = evaluateProposal(state, factionId, proposals.get(factionId));
      failure = evaluated.failure;
      evaluatedActions = evaluated.actions;
    }

    if (failure === undefined) {
      for (const proposed of evaluatedActions) {
        const action = proposed.action;
        const reservation =
          action.type === "CAPITULATE_FACTION"
            ? `faction-status:${action.factionId}`
            : undefined;
        if (reservation !== undefined && reservations.has(reservation)) {
          failure = Object.freeze({ code: "CONFLICTING_PROPOSAL" });
          break;
        }
      }
    }

    const acceptedActions =
      failure === undefined ? evaluatedActions : Object.freeze([]);
    if (failure === undefined) {
      for (const proposed of acceptedActions) {
        const action = proposed.action;
        if (action.type === "CAPITULATE_FACTION") {
          reservations.add(`faction-status:${action.factionId}`);
        }
        if (
          action.type !== "CONTROLLER_PURCHASE_STRUCTURE_BUILD" &&
          action.type !== "CONTROLLER_PURCHASE_STRUCTURE_UPGRADE"
        ) {
          actions.push(action);
        }
      }
    }
    proposalActions.push(
      Object.freeze({
        factionId,
        actions: Object.freeze([...acceptedActions]),
      }),
    );

    const receipt = Object.freeze({
      decisionNumber,
      accepted: failure === undefined,
      ...(failure === undefined ? {} : { failure }),
      faultCount: faultCounts.get(factionId) ?? 0,
      faulted: faultedFactionIds.has(factionId),
    });
    receipts.push(Object.freeze({ factionId, receipt }));
  }

  return Object.freeze({
    actions: Object.freeze(actions),
    proposals: Object.freeze(proposalActions),
    receipts: Object.freeze(receipts),
    faultCounts,
    consecutiveFaultCounts,
    faultedFactionIds,
  });
}

export function evaluateControllerRound(
  state: MatchState,
  host: ControllerHost,
  decisionNumber: number,
  previousReceipts: ReadonlyMap<string, DecisionReceipt>,
  previousFaultCounts: ReadonlyMap<string, number>,
  previousConsecutiveFaultCounts: ReadonlyMap<string, number> = new Map(),
  previousFaultedFactionIds: ReadonlySet<string> = new Set(),
): ControllerRoundEvaluation | Promise<ControllerRoundEvaluation> {
  const orderedFactionIds = [...state.factions]
    .map((faction) => faction.id)
    .sort(compareIds);
  const outcomes: Array<InvocationOutcome | Promise<InvocationOutcome>> = [];
  let hasAsyncInvocation = false;

  for (const factionId of orderedFactionIds) {
    if (previousFaultedFactionIds.has(factionId)) {
      outcomes.push(Object.freeze({ factionId, skipped: true as const }));
      continue;
    }

    const observation = projectLawfulControllerObservation(
      state,
      factionId,
      decisionNumber,
      previousReceipts.get(factionId),
    );
    const querySession = createControllerQuerySession(
      state,
      factionId,
      CONTROLLER_QUERY_LIMITS,
    );

    try {
      const invocation = host.invoke(factionId, observation, querySession);
      if (isPromiseLike(invocation)) {
        hasAsyncInvocation = true;
        outcomes.push(
          Promise.resolve(invocation).then(
            (resolved) => Object.freeze({ factionId, invocation: resolved }),
            () => Object.freeze({ factionId, threw: true as const }),
          ),
        );
      } else {
        outcomes.push(Object.freeze({ factionId, invocation }));
      }
    } catch {
      outcomes.push(Object.freeze({ factionId, threw: true as const }));
    }
  }

  const finalize = (resolvedOutcomes: readonly InvocationOutcome[]) =>
    finalizeControllerRound(
      state,
      decisionNumber,
      orderedFactionIds,
      resolvedOutcomes,
      previousFaultCounts,
      previousConsecutiveFaultCounts,
      previousFaultedFactionIds,
    );

  if (!hasAsyncInvocation) {
    return finalize(outcomes as readonly InvocationOutcome[]);
  }

  return Promise.all(outcomes.map((outcome) => Promise.resolve(outcome))).then(
    finalize,
  );
}
