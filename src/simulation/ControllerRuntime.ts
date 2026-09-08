import type {
  CellView,
  ControllerDecision,
  ControllerMemory,
  DecisionFailure,
  DecisionReceipt,
  FactionStatus,
  PopulationView,
  SpawnInfluenceContext,
  SpawnInfluenceDecision,
  SpawnOriginContext,
  SpawnOriginDecision,
  SpawnReconsiderContext,
} from "../core/controller/ControllerApi";
import {
  materializeDirectiveChanges,
  tryApplyPersistentDirectiveChanges,
} from "./LandOperations";
import type { MatchState } from "./MatchState";
import type { PopulationState } from "./Population";
import type { SimulationAction } from "./TickEngine";

const MAX_CONTROLLER_MEMORY_BYTES = 131_072;
const utf8Encoder = new TextEncoder();

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
}

export type LawfulLandCellObservation = Readonly<
  Pick<CellView, "id" | "ownerId"> & {
    readonly terrain: CellView["terrain"] | "TEST";
  }
>;

export interface LawfulControllerObservation {
  readonly tick: number;
  readonly decisionNumber: number;
  readonly me: LawfulSelfFactionObservation;
  readonly factions: readonly LawfulFactionObservation[];
  readonly cells: readonly LawfulLandCellObservation[];
  readonly lastDecision?: DecisionReceipt;
}

export interface HostedLawfulControllerObservation
  extends LawfulControllerObservation {
  readonly memory: Readonly<ControllerMemory>;
}

export type ControllerHostFaultCode = "RUNTIME_ERROR" | "INVALID_OUTPUT";

export interface ControllerHostFault {
  readonly code: ControllerHostFaultCode;
}

export type ControllerHostInvocationResult<T> =
  | Readonly<{ readonly ok: true; readonly output?: T }>
  | Readonly<{ readonly ok: false; readonly fault: ControllerHostFault }>;

export interface ControllerHost {
  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
  ): ControllerHostInvocationResult<ControllerDecision>;
  chooseInfluence(
    factionId: string,
    context: SpawnInfluenceContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision>;
  reconsiderInfluence(
    factionId: string,
    context: SpawnReconsiderContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision>;
  chooseOrigins(
    factionId: string,
    context: SpawnOriginContext,
  ): ControllerHostInvocationResult<SpawnOriginDecision>;
}

export type InProcessController = (
  observation: LawfulControllerObservation,
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function canonicalizeControllerMemory(value: unknown): string {
  if (!isPlainRecord(value)) {
    throw new InvalidControllerValueError(
      "controller memory root must be a plain object",
    );
  }

  const serialized = canonicalizeMemoryValue(value, new Set<object>());
  if (utf8Encoder.encode(serialized).byteLength > MAX_CONTROLLER_MEMORY_BYTES) {
    throw new InvalidControllerValueError("controller memory exceeds quota");
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

function hostFault<T>(code: ControllerHostFaultCode): ControllerHostInvocationResult<T> {
  return Object.freeze({
    ok: false as const,
    fault: Object.freeze({ code }),
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
  ): ControllerHostInvocationResult<ControllerDecision> {
    const registration = this.controllers[factionId];
    if (registration === undefined) return hostSuccess();

    if (typeof registration === "function") {
      return this.executeInvocation(factionId, () => registration(observation));
    }

    return this.executeInvocation(factionId, (memory) =>
      registration.decide?.(projectHostedContext(observation, memory)),
    );
  }

  chooseInfluence(
    factionId: string,
    context: SpawnInfluenceContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision> {
    const registration = this.controllerCallbacks(factionId);
    return this.executeInvocation(factionId, (memory) =>
      registration?.chooseInfluence?.(projectHostedContext(context, memory)),
    );
  }

  reconsiderInfluence(
    factionId: string,
    context: SpawnReconsiderContext,
  ): ControllerHostInvocationResult<SpawnInfluenceDecision> {
    const registration = this.controllerCallbacks(factionId);
    return this.executeInvocation(factionId, (memory) =>
      registration?.reconsiderInfluence?.(projectHostedContext(context, memory)),
    );
  }

  chooseOrigins(
    factionId: string,
    context: SpawnOriginContext,
  ): ControllerHostInvocationResult<SpawnOriginDecision> {
    const registration = this.controllerCallbacks(factionId);
    return this.executeInvocation(factionId, (memory) =>
      registration?.chooseOrigins?.(projectHostedContext(context, memory)),
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
    const serialized = this.memoryByFaction.get(factionId) ?? "{}";
    return deepFreezePlainValue(JSON.parse(serialized) as ControllerMemory);
  }

  private executeInvocation<T extends ControllerOutputWithMemory>(
    factionId: string,
    invoke: (memory: Readonly<ControllerMemory>) => T | void,
  ): ControllerHostInvocationResult<T> {
    let output: T | void;
    try {
      output = invoke(this.controllerMemory(factionId));
    } catch {
      return hostFault("RUNTIME_ERROR");
    }

    if (output === undefined) return hostSuccess();
    if (!isPlainRecord(output)) return hostFault("INVALID_OUTPUT");

    try {
      let nextMemory: string | undefined;
      if (Object.prototype.hasOwnProperty.call(output, "memory")) {
        nextMemory = canonicalizeControllerMemory(output.memory);
      }

      const materialized = materializeControllerValue(
        output,
        new Set<object>(),
      ) as T;

      if (nextMemory !== undefined) {
        this.memoryByFaction.set(factionId, nextMemory);
      }
      return hostSuccess(materialized);
    } catch {
      return hostFault("INVALID_OUTPUT");
    }
  }
}

export interface ControllerRoundReceipt {
  readonly factionId: string;
  readonly receipt: DecisionReceipt;
}

export interface ControllerRoundEvaluation {
  readonly actions: readonly SimulationAction[];
  readonly receipts: readonly ControllerRoundReceipt[];
  readonly faultCounts: ReadonlyMap<string, number>;
}

interface ProposalEvaluation {
  readonly actions: readonly SimulationAction[];
  readonly failure?: DecisionFailure;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
  population: PopulationState,
): LawfulSelfFactionObservation {
  return Object.freeze({
    id,
    status,
    population: freezePopulationObservation(population),
  });
}

function freezeLandCellObservations(
  state: MatchState,
): readonly LawfulLandCellObservation[] {
  return Object.freeze(
    state.map.terrain.map((terrain, id) => {
      const ownerId = state.ownership[id] ?? null;
      return Object.freeze({
        id,
        terrain: terrain as LawfulLandCellObservation["terrain"],
        ...(ownerId === null ? {} : { ownerId }),
      });
    }),
  );
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

  return Object.freeze({
    tick: state.tick,
    decisionNumber,
    me: freezeSelfFactionObservation(me.id, me.status, me.population),
    factions,
    cells: freezeLandCellObservations(state),
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

  const actions: SimulationAction[] = [];
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
        type: "APPLY_PERSISTENT_DIRECTIVES" as const,
        factionId,
        changes,
      }),
    );
  }

  const commands = decision.commands ?? [];
  const seenKeys = new Set<string>();
  let capitulateKey: string | undefined;

  for (const command of commands) {
    if (seenKeys.has(command.key)) {
      return invalid("CONFLICTING_PROPOSAL", command.key);
    }
    seenKeys.add(command.key);

    if (command.kind !== "CAPITULATE") {
      return invalid("INVALID_COMMAND", command.key);
    }
    if (capitulateKey !== undefined) {
      return invalid("CONFLICTING_PROPOSAL", command.key);
    }
    capitulateKey = command.key;
  }

  if (capitulateKey !== undefined) {
    const faction = state.factions.find((candidate) => candidate.id === factionId);
    if (faction === undefined || faction.status !== "ACTIVE") {
      return invalid("INVALID_TARGET", capitulateKey);
    }
    actions.push(
      Object.freeze({
        type: "CAPITULATE_FACTION" as const,
        factionId,
      }),
    );
  }

  return Object.freeze({ actions: Object.freeze(actions) });
}

export function evaluateControllerRound(
  state: MatchState,
  host: ControllerHost,
  decisionNumber: number,
  previousReceipts: ReadonlyMap<string, DecisionReceipt>,
  previousFaultCounts: ReadonlyMap<string, number>,
): ControllerRoundEvaluation {
  const orderedFactionIds = [...state.factions]
    .map((faction) => faction.id)
    .sort(compareIds);
  const proposals = new Map<string, ControllerDecision | void>();
  const invocationFailures = new Map<string, DecisionFailure>();
  const faultCounts = new Map(previousFaultCounts);

  for (const factionId of orderedFactionIds) {
    const observation = projectLawfulControllerObservation(
      state,
      factionId,
      decisionNumber,
      previousReceipts.get(factionId),
    );
    try {
      const invocation = host.invoke(factionId, observation);
      if (invocation.ok) {
        proposals.set(factionId, invocation.output);
      } else {
        const nextFaultCount = (faultCounts.get(factionId) ?? 0) + 1;
        faultCounts.set(factionId, nextFaultCount);
        invocationFailures.set(
          factionId,
          Object.freeze({ code: "RUNTIME_ERROR" }),
        );
      }
    } catch {
      const nextFaultCount = (faultCounts.get(factionId) ?? 0) + 1;
      faultCounts.set(factionId, nextFaultCount);
      invocationFailures.set(
        factionId,
        Object.freeze({ code: "RUNTIME_ERROR" }),
      );
    }
  }

  const actions: SimulationAction[] = [];
  const receipts: ControllerRoundReceipt[] = [];
  const reservations = new Set<string>();

  for (const factionId of orderedFactionIds) {
    let failure = invocationFailures.get(factionId);
    let proposalActions: readonly SimulationAction[] = Object.freeze([]);

    if (failure === undefined) {
      const evaluated = evaluateProposal(state, factionId, proposals.get(factionId));
      failure = evaluated.failure;
      proposalActions = evaluated.actions;
    }

    if (failure === undefined) {
      for (const action of proposalActions) {
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

    if (failure === undefined) {
      for (const action of proposalActions) {
        if (action.type === "CAPITULATE_FACTION") {
          reservations.add(`faction-status:${action.factionId}`);
        }
        actions.push(action);
      }
    }

    const receipt = Object.freeze({
      decisionNumber,
      accepted: failure === undefined,
      ...(failure === undefined ? {} : { failure }),
      faultCount: faultCounts.get(factionId) ?? 0,
      faulted: false,
    });
    receipts.push(Object.freeze({ factionId, receipt }));
  }

  return Object.freeze({
    actions: Object.freeze(actions),
    receipts: Object.freeze(receipts),
    faultCounts,
  });
}
