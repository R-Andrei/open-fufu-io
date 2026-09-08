import type {
  ControllerDecision,
  ControllerMemory,
  SpawnInfluenceContext,
  SpawnInfluenceDecision,
  SpawnOriginContext,
  SpawnOriginDecision,
  SpawnReconsiderContext,
} from "../../core/controller/ControllerApi";
import type {
  ControllerHost,
  ControllerHostFaultCode,
  ControllerHostInvocationResult,
  LawfulControllerObservation,
} from "../../simulation/ControllerRuntime";

export const PRODUCTION_CONTROLLER_LIMITS = Object.freeze({
  persistentMemoryBytes: 131_072,
  isolateMemoryMb: 32,
  decideTimeoutMs: 20,
  spawnHookTimeoutMs: 50,
  moduleEvaluationTimeoutMs: 100,
  serializedDecisionBytes: 256 * 1024,
  queriesPerDecision: 128,
  materializedCellsPerDecision: 25_000,
  directiveUpdatesPerDecision: 128,
  commandsPerDecision: 64,
  policyRulesPerDecision: 256,
  debugItemsPerDecision: 256,
  logBytesPerDecision: 8 * 1024,
  eventsPerDecision: 512,
  teamSignalPayloadBytes: 1024,
});

export interface ControllerRuntimeArtifact {
  readonly moduleSource: string;
  readonly entrypoints: Readonly<{
    readonly decide: string;
    readonly chooseInfluence?: string;
    readonly reconsiderInfluence?: string;
    readonly chooseOrigins?: string;
  }>;
}

export type ControllerWorkerHook =
  | "DECIDE"
  | "CHOOSE_INFLUENCE"
  | "RECONSIDER_INFLUENCE"
  | "CHOOSE_ORIGINS";

export interface ControllerResourceUsage {
  readonly queries: number;
  readonly materializedCells: number;
}

export interface ControllerWorkerRequest {
  readonly factionId: string;
  readonly artifact: ControllerRuntimeArtifact;
  readonly hook: ControllerWorkerHook;
  readonly entrypoint: string;
  readonly context: unknown;
  readonly memoryJson: string;
  readonly timeoutMs: number;
  readonly moduleEvaluationTimeoutMs: number;
  readonly isolateMemoryMb: number;
}

export type ControllerWorkerFault =
  | "RUNTIME_ERROR"
  | "INVALID_OUTPUT"
  | "TIMEOUT"
  | "MEMORY_LIMIT"
  | "SANDBOX_VIOLATION"
  | "WORKER_DIED";

export type ControllerWorkerResponse =
  | Readonly<{
      readonly ok: true;
      readonly output?: unknown;
      readonly usage: ControllerResourceUsage;
    }>
  | Readonly<{
      readonly ok: false;
      readonly fault: ControllerWorkerFault;
    }>;

export interface ControllerWorkerPool {
  invoke(request: ControllerWorkerRequest): Promise<ControllerWorkerResponse>;
}

type ControllerOutputWithMemory = Readonly<{
  readonly memory?: ControllerMemory;
}>;

type OutputRecord = Record<string, unknown> & ControllerOutputWithMemory;

class InvalidTransportValueError extends Error {}

const utf8Encoder = new TextEncoder();

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOptionalString(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === "string";
}

function hasOptionalNumber(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || isFiniteNumber(record[key]);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return true;
  }
  if (isFiniteNumber(value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isCellSelector(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.kind !== "string") return false;

  switch (value.kind) {
    case "CELLS":
      return Array.isArray(value.ids) && value.ids.every(isFiniteNumber);
    case "OWNER":
      return hasOptionalString(value, "factionId");
    case "SEGMENT":
      return isFiniteNumber(value.segmentId);
    case "TERRAIN":
      return typeof value.terrain === "string";
    case "FALLOUT":
    case "POPULATION_BEARING":
    case "CONQUERABLE":
    case "COAST":
    case "SHORELINE":
      return typeof value.value === "boolean";
    case "CIRCLE":
      return isFiniteNumber(value.center) && isFiniteNumber(value.radius);
    case "STRUCTURE_FIELD":
      return (
        typeof value.field === "string" &&
        typeof value.referenceFactionId === "string" &&
        typeof value.affiliation === "string"
      );
    case "STRUCTURE_FIELD_INSTANCE":
      return typeof value.structureId === "string" && typeof value.field === "string";
    case "UNION":
    case "INTERSECTION":
      return Array.isArray(value.selectors) && value.selectors.every(isCellSelector);
    case "DIFFERENCE":
      return isCellSelector(value.left) && isCellSelector(value.right);
    default:
      return false;
  }
}

function isSpatialPolicy(value: unknown): boolean {
  if (!isPlainRecord(value) || !hasOptionalNumber(value, "defaultWeight")) {
    return false;
  }
  if (value.rules === undefined) return true;
  if (!Array.isArray(value.rules)) return false;
  return value.rules.every(
    (rule) =>
      isPlainRecord(rule) &&
      isCellSelector(rule.selector) &&
      isFiniteNumber(rule.weight),
  );
}

function isPersistentDirective(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.kind !== "string" || typeof value.key !== "string") {
    return false;
  }

  switch (value.kind) {
    case "LAND_OPERATION":
      return (
        (value.operation === "ATTACK" || value.operation === "NEUTRAL_EXPANSION") &&
        isFiniteNumber(value.population) &&
        hasOptionalString(value, "targetFactionId") &&
        isCellSelector(value.source) &&
        isCellSelector(value.target) &&
        (value.engagementPriority === undefined || isSpatialPolicy(value.engagementPriority)) &&
        (value.pressureWeight === undefined || isSpatialPolicy(value.pressureWeight))
      );
    case "DEFENSE_PRIORITY":
      return isSpatialPolicy(value.priority);
    case "COUNTER_RESPONSE":
      return typeof value.incomingOperationId === "string" && isFiniteNumber(value.population);
    default:
      return false;
  }
}

function isDebugSubject(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "CELL") return isFiniteNumber(value.id);
  return (
    (value.kind === "FACTION" ||
      value.kind === "SEGMENT" ||
      value.kind === "OPERATION" ||
      value.kind === "UNIT" ||
      value.kind === "STRUCTURE") &&
    typeof value.id === "string"
  );
}

function isDebugValue(value: unknown): boolean {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  );
}

function isDebugItem(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.kind !== "string") return false;

  switch (value.kind) {
    case "POINT":
      return isFiniteNumber(value.cellId) && hasOptionalString(value, "label");
    case "LINE":
      return (
        isFiniteNumber(value.from) &&
        isFiniteNumber(value.to) &&
        hasOptionalString(value, "label")
      );
    case "REGION":
      return isCellSelector(value.selector) && hasOptionalString(value, "label");
    case "METRIC":
      return typeof value.name === "string" && isDebugValue(value.value) && value.value !== undefined;
    case "ANNOTATION":
      return (
        isDebugSubject(value.subject) &&
        typeof value.label === "string" &&
        isDebugValue(value.value)
      );
    default:
      return false;
  }
}

function isControllerCommand(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.kind !== "string" || typeof value.key !== "string") {
    return false;
  }

  switch (value.kind) {
    case "BUILD_STRUCTURE":
      return typeof value.structure === "string" && isFiniteNumber(value.cellId);
    case "UPGRADE_STRUCTURE":
      return typeof value.structureId === "string";
    case "BUILD_UNIT":
      return typeof value.unit === "string" && typeof value.producerId === "string";
    case "MOVE_UNIT":
      return typeof value.unitId === "string" && isFiniteNumber(value.destination);
    case "EMBARK_TRANSPORT":
      return (
        isFiniteNumber(value.sourceCellId) &&
        isFiniteNumber(value.targetCellId) &&
        isFiniteNumber(value.population)
      );
    case "RETURN_TRANSPORT":
      return typeof value.unitId === "string";
    case "LAUNCH_WEAPON":
      return (
        typeof value.launcherId === "string" &&
        typeof value.weapon === "string" &&
        isFiniteNumber(value.targetCellId) &&
        hasOptionalString(value, "targetFactionId")
      );
    case "RELINQUISH":
      return isCellSelector(value.cells);
    case "TEAM_SIGNAL":
      return typeof value.channel === "string" && isJsonValue(value.payload);
    case "CAPITULATE":
      return true;
    default:
      return false;
  }
}

function hasValidDiagnostics(output: Record<string, unknown>): boolean {
  if (output.debug !== undefined) {
    if (!Array.isArray(output.debug) || !output.debug.every(isDebugItem)) return false;
  }
  return output.log === undefined || typeof output.log === "string";
}

function hasValidDirectiveChanges(output: Record<string, unknown>): boolean {
  if (output.directives === undefined) return true;
  if (!isPlainRecord(output.directives)) return false;
  const set = output.directives.set;
  const end = output.directives.end;
  return (
    (set === undefined || (Array.isArray(set) && set.every(isPersistentDirective))) &&
    (end === undefined || (Array.isArray(end) && end.every((key) => typeof key === "string")))
  );
}

function outputHasExpectedStructure(
  hook: ControllerWorkerHook,
  output: Record<string, unknown>,
): boolean {
  if (!hasValidDiagnostics(output)) return false;

  switch (hook) {
    case "DECIDE":
      return (
        hasValidDirectiveChanges(output) &&
        (output.commands === undefined ||
          (Array.isArray(output.commands) && output.commands.every(isControllerCommand)))
      );
    case "CHOOSE_INFLUENCE":
    case "RECONSIDER_INFLUENCE":
      return Array.isArray(output.centers) && output.centers.every(isFiniteNumber);
    case "CHOOSE_ORIGINS":
      return Array.isArray(output.origins) && output.origins.every(isFiniteNumber);
  }
}

function cloneFrozenTransportValue(
  value: unknown,
  ancestors = new Set<object>(),
): unknown {
  if (value === null) return null;

  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new InvalidTransportValueError("transport number must be finite");
      }
      return Object.is(value, -0) ? 0 : value;
    case "object":
      break;
    default:
      throw new InvalidTransportValueError("transport value is not copied data");
  }

  if (ancestors.has(value)) {
    throw new InvalidTransportValueError("transport value must be acyclic");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const clone: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new InvalidTransportValueError("transport array must not be sparse");
        }
        clone.push(cloneFrozenTransportValue(value[index], ancestors));
      }
      return Object.freeze(clone);
    }

    if (!isPlainRecord(value)) {
      throw new InvalidTransportValueError("transport object must be a plain record");
    }

    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      clone[key] = cloneFrozenTransportValue(value[key], ancestors);
    }
    return Object.freeze(clone);
  } finally {
    ancestors.delete(value);
  }
}

function cloneWorkerContext(context: object): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(context)) {
    throw new InvalidTransportValueError("worker context must be a plain record");
  }

  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(context)) {
    if (key === "memory") continue;
    clone[key] = cloneFrozenTransportValue(
      (context as Record<string, unknown>)[key],
    );
  }
  return Object.freeze(clone);
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
        throw new InvalidTransportValueError("controller memory number must be finite");
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case "string":
      return JSON.stringify(value);
    case "object":
      break;
    default:
      throw new InvalidTransportValueError("controller memory is not JSON-shaped");
  }

  if (ancestors.has(value)) {
    throw new InvalidTransportValueError("controller memory must be acyclic");
  }
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const entries: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new InvalidTransportValueError(
            "controller memory arrays must not be sparse",
          );
        }
        entries.push(canonicalizeMemoryValue(value[index], ancestors));
      }
      return `[${entries.join(",")}]`;
    }

    if (!isPlainRecord(value)) {
      throw new InvalidTransportValueError(
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
    throw new InvalidTransportValueError(
      "controller memory root must be a plain object",
    );
  }

  const serialized = canonicalizeMemoryValue(value, new Set<object>());
  if (
    utf8Encoder.encode(serialized).byteLength >
    PRODUCTION_CONTROLLER_LIMITS.persistentMemoryBytes
  ) {
    throw new InvalidTransportValueError("controller memory exceeds quota");
  }
  return serialized;
}

function hostSuccess<T>(output?: T): ControllerHostInvocationResult<T> {
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

function normalizeWorkerFault<T>(fault: ControllerWorkerFault): ControllerHostInvocationResult<T> {
  return hostFault(fault === "INVALID_OUTPUT" ? "INVALID_OUTPUT" : "RUNTIME_ERROR");
}

function validUsage(usage: ControllerResourceUsage): boolean {
  return (
    Number.isInteger(usage.queries) &&
    usage.queries >= 0 &&
    Number.isInteger(usage.materializedCells) &&
    usage.materializedCells >= 0
  );
}

function spatialPolicyRuleCount(value: unknown): number {
  if (!isPlainRecord(value)) return 0;
  return Array.isArray(value.rules) ? value.rules.length : 0;
}

function directivePolicyRuleCount(value: unknown): number {
  if (!isPlainRecord(value)) return 0;
  if (value.kind === "LAND_OPERATION") {
    return (
      spatialPolicyRuleCount(value.engagementPriority) +
      spatialPolicyRuleCount(value.pressureWeight)
    );
  }
  if (value.kind === "DEFENSE_PRIORITY") {
    return spatialPolicyRuleCount(value.priority);
  }
  return 0;
}

function outputWithinResourceCeilings(output: OutputRecord): boolean {
  if (Object.prototype.hasOwnProperty.call(output, "commands")) {
    if (!Array.isArray(output.commands)) return false;
    if (output.commands.length > PRODUCTION_CONTROLLER_LIMITS.commandsPerDecision) {
      return false;
    }
  }

  if (Object.prototype.hasOwnProperty.call(output, "directives")) {
    if (!isPlainRecord(output.directives)) return false;
    const set = output.directives.set;
    const end = output.directives.end;
    if (set !== undefined && !Array.isArray(set)) return false;
    if (end !== undefined && !Array.isArray(end)) return false;
    const updates = (Array.isArray(set) ? set.length : 0) + (Array.isArray(end) ? end.length : 0);
    if (updates > PRODUCTION_CONTROLLER_LIMITS.directiveUpdatesPerDecision) {
      return false;
    }

    if (Array.isArray(set)) {
      let policyRules = 0;
      for (const directive of set) {
        policyRules += directivePolicyRuleCount(directive);
        if (policyRules > PRODUCTION_CONTROLLER_LIMITS.policyRulesPerDecision) {
          return false;
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(output, "debug")) {
    if (!Array.isArray(output.debug)) return false;
    if (output.debug.length > PRODUCTION_CONTROLLER_LIMITS.debugItemsPerDecision) {
      return false;
    }
  }

  if (Object.prototype.hasOwnProperty.call(output, "log")) {
    if (typeof output.log !== "string") return false;
    if (
      utf8Encoder.encode(output.log).byteLength >
      PRODUCTION_CONTROLLER_LIMITS.logBytesPerDecision
    ) {
      return false;
    }
  }

  return true;
}

export class ProductionControllerHost implements ControllerHost {
  private readonly memoryByFaction = new Map<string, string>();

  constructor(
    private readonly pool: ControllerWorkerPool,
    private readonly artifacts: Readonly<Record<string, ControllerRuntimeArtifact>>,
  ) {}

  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
  ): Promise<ControllerHostInvocationResult<ControllerDecision>> {
    return this.invokeHook(
      factionId,
      "DECIDE",
      observation,
      "decide",
      PRODUCTION_CONTROLLER_LIMITS.decideTimeoutMs,
    );
  }

  chooseInfluence(
    factionId: string,
    context: SpawnInfluenceContext,
  ): Promise<ControllerHostInvocationResult<SpawnInfluenceDecision>> {
    return this.invokeOptionalSpawnHook(
      factionId,
      "CHOOSE_INFLUENCE",
      context,
      "chooseInfluence",
    );
  }

  reconsiderInfluence(
    factionId: string,
    context: SpawnReconsiderContext,
  ): Promise<ControllerHostInvocationResult<SpawnInfluenceDecision>> {
    return this.invokeOptionalSpawnHook(
      factionId,
      "RECONSIDER_INFLUENCE",
      context,
      "reconsiderInfluence",
    );
  }

  chooseOrigins(
    factionId: string,
    context: SpawnOriginContext,
  ): Promise<ControllerHostInvocationResult<SpawnOriginDecision>> {
    return this.invokeOptionalSpawnHook(
      factionId,
      "CHOOSE_ORIGINS",
      context,
      "chooseOrigins",
    );
  }

  private invokeOptionalSpawnHook<T extends ControllerOutputWithMemory>(
    factionId: string,
    hook: Exclude<ControllerWorkerHook, "DECIDE">,
    context: object,
    entrypointKey: "chooseInfluence" | "reconsiderInfluence" | "chooseOrigins",
  ): Promise<ControllerHostInvocationResult<T>> {
    const artifact = this.artifacts[factionId];
    if (artifact === undefined) return Promise.resolve(hostFault("RUNTIME_ERROR"));
    const entrypoint = artifact.entrypoints[entrypointKey];
    if (entrypoint === undefined) return Promise.resolve(hostSuccess());
    return this.invokeWorker<T>(
      factionId,
      artifact,
      hook,
      entrypoint,
      context,
      PRODUCTION_CONTROLLER_LIMITS.spawnHookTimeoutMs,
    );
  }

  private invokeHook<T extends ControllerOutputWithMemory>(
    factionId: string,
    hook: ControllerWorkerHook,
    context: object,
    entrypointKey: keyof ControllerRuntimeArtifact["entrypoints"],
    timeoutMs: number,
  ): Promise<ControllerHostInvocationResult<T>> {
    const artifact = this.artifacts[factionId];
    if (artifact === undefined) return Promise.resolve(hostFault("RUNTIME_ERROR"));
    const entrypoint = artifact.entrypoints[entrypointKey];
    if (entrypoint === undefined) return Promise.resolve(hostFault("RUNTIME_ERROR"));
    return this.invokeWorker<T>(
      factionId,
      artifact,
      hook,
      entrypoint,
      context,
      timeoutMs,
    );
  }

  private async invokeWorker<T extends ControllerOutputWithMemory>(
    factionId: string,
    artifact: ControllerRuntimeArtifact,
    hook: ControllerWorkerHook,
    entrypoint: string,
    context: object,
    timeoutMs: number,
  ): Promise<ControllerHostInvocationResult<T>> {
    let requestContext: Readonly<Record<string, unknown>>;
    try {
      requestContext = cloneWorkerContext(context);
    } catch {
      return hostFault("RUNTIME_ERROR");
    }

    let response: ControllerWorkerResponse;
    try {
      response = await this.pool.invoke(
        Object.freeze({
          factionId,
          artifact,
          hook,
          entrypoint,
          context: requestContext,
          memoryJson: this.memoryByFaction.get(factionId) ?? "{}",
          timeoutMs,
          moduleEvaluationTimeoutMs:
            PRODUCTION_CONTROLLER_LIMITS.moduleEvaluationTimeoutMs,
          isolateMemoryMb: PRODUCTION_CONTROLLER_LIMITS.isolateMemoryMb,
        }),
      );
    } catch {
      return hostFault("RUNTIME_ERROR");
    }

    if (!response.ok) return normalizeWorkerFault(response.fault);
    if (!validUsage(response.usage)) return hostFault("RUNTIME_ERROR");

    if (
      response.usage.queries > PRODUCTION_CONTROLLER_LIMITS.queriesPerDecision ||
      response.usage.materializedCells >
        PRODUCTION_CONTROLLER_LIMITS.materializedCellsPerDecision
    ) {
      return hostFault("RUNTIME_ERROR");
    }

    if (response.output === undefined) return hostSuccess();

    let materialized: unknown;
    try {
      materialized = cloneFrozenTransportValue(response.output);
    } catch {
      return hostFault("INVALID_OUTPUT");
    }
    if (!isPlainRecord(materialized)) return hostFault("INVALID_OUTPUT");

    const serialized = JSON.stringify(materialized);
    if (
      utf8Encoder.encode(serialized).byteLength >
      PRODUCTION_CONTROLLER_LIMITS.serializedDecisionBytes
    ) {
      return hostFault("INVALID_OUTPUT");
    }

    const output = materialized as OutputRecord;
    if (!outputHasExpectedStructure(hook, output)) {
      return hostFault("INVALID_OUTPUT");
    }

    let nextMemory: string | undefined;
    if (Object.prototype.hasOwnProperty.call(output, "memory")) {
      try {
        nextMemory = canonicalizeControllerMemory(output.memory);
      } catch {
        return hostFault("INVALID_OUTPUT");
      }
    }

    if (!outputWithinResourceCeilings(output)) {
      return hostFault("RUNTIME_ERROR");
    }

    if (nextMemory !== undefined) {
      this.memoryByFaction.set(factionId, nextMemory);
    }

    return hostSuccess(output as T);
  }
}
