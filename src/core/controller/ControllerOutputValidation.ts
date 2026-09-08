export type ControllerOutputKind =
  | "DECIDE"
  | "CHOOSE_INFLUENCE"
  | "RECONSIDER_INFLUENCE"
  | "CHOOSE_ORIGINS";

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

export function controllerOutputHasExpectedStructure(
  kind: ControllerOutputKind,
  output: unknown,
): output is Record<string, unknown> {
  if (!isPlainRecord(output) || !hasValidDiagnostics(output)) return false;

  switch (kind) {
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
