import type {
  ControllerStructureFieldId,
  StructureFieldAffiliation,
  StructureFieldId,
  TerrainType,
} from "./ControllerApi";

export type ControllerOutputKind =
  | "DECIDE"
  | "CHOOSE_INFLUENCE"
  | "RECONSIDER_INFLUENCE"
  | "CHOOSE_ORIGINS";

const TERRAIN_TYPES = {
  PLAINS: true,
  HIGHLAND: true,
  MOUNTAIN: true,
  DESERT: true,
  FOREST: true,
  TUNDRA: true,
  MARSH: true,
  SHALLOW_WATER: true,
  DEEP_WATER: true,
  IMPASSABLE: true,
} as const satisfies Readonly<Record<TerrainType, true>>;

const CONTROLLER_STRUCTURE_FIELD_IDS = {
  FORT: true,
  SAM_LAUNCHER: true,
  COMMAND_POST: true,
  OBSERVATION: true,
} as const satisfies Readonly<Record<ControllerStructureFieldId, true>>;

const STRUCTURE_FIELD_IDS = {
  FORT: true,
  SAM_LAUNCHER: true,
  COMMAND_POST: true,
} as const satisfies Readonly<Record<StructureFieldId, true>>;

const STRUCTURE_FIELD_AFFILIATIONS = {
  SELF: true,
  SELF_OR_FIXED_TEAMMATE: true,
} as const satisfies Readonly<Record<StructureFieldAffiliation, true>>;

function isVocabularyValue(
  vocabulary: Readonly<Record<string, true>>,
  value: unknown,
): boolean {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(vocabulary, value)
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isEntityRef(
  value: unknown,
  type: "UNIT" | "STRUCTURE" | "OPERATION",
): boolean {
  return (
    isPlainRecord(value) &&
    value.type === type &&
    typeof value.token === "string" &&
    value.token.length > 0
  );
}


function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCellId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
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
      return isVocabularyValue(TERRAIN_TYPES, value.terrain);
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
        isVocabularyValue(CONTROLLER_STRUCTURE_FIELD_IDS, value.field) &&
        typeof value.referenceFactionId === "string" &&
        isVocabularyValue(STRUCTURE_FIELD_AFFILIATIONS, value.affiliation)
      );
    case "STRUCTURE_FIELD_INSTANCE":
      return (
        isEntityRef(value.structureId, "STRUCTURE") &&
        isVocabularyValue(STRUCTURE_FIELD_IDS, value.field)
      );
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
      return (
        isEntityRef(value.incomingOperation, "OPERATION") &&
        value.incomingOperationId === undefined &&
        isFiniteNumber(value.population)
      );
    default:
      return false;
  }
}

function isDebugSubject(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.kind !== "string") return false;

  switch (value.kind) {
    case "CELL":
    case "SEGMENT":
      return isFiniteNumber(value.id);
    case "FACTION":
      return typeof value.id === "string";
    case "OPERATION":
      return isEntityRef(value.id, "OPERATION");
    case "UNIT":
      return isEntityRef(value.id, "UNIT");
    case "STRUCTURE":
      return isEntityRef(value.id, "STRUCTURE");
    default:
      return false;
  }
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
        !Object.prototype.hasOwnProperty.call(output, "commands") &&
        hasValidDirectiveChanges(output)
      );
    case "CHOOSE_INFLUENCE":
    case "RECONSIDER_INFLUENCE":
      return Array.isArray(output.centers) && output.centers.every(isFiniteNumber);
    case "CHOOSE_ORIGINS":
      return Array.isArray(output.origins) && output.origins.every(isFiniteNumber);
  }
}
