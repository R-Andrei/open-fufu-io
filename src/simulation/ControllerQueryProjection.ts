import { factionRelationBetween } from "../core/FactionRelations";
import type {
  CellId,
  CellSelector,
  CellView,
  ControllerStructureFieldId,
  QueryPage,
  SegmentId,
  SegmentView,
  StructureFieldAffiliation,
  StructureFieldId,
  StructureType,
  TerrainType,
} from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  ruleScopeMatches,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import { materializeCompiledScalarScaleFactor } from "../core/rules/RuleMaterialization";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromAreaFactor,
  structureRadialFieldFromRangeFactor,
  type StructureRadialFieldProfile,
} from "../core/rules/StructureFieldGeometry";
import {
  isOwnedForestConcealmentCell,
  resolveTacticalVisibility,
} from "../core/visibility/TacticalVisibility";
import { landTerrainBaseSpec } from "./LandOperations";
import type { MatchFactionState, MatchState } from "./MatchState";
import type { SimulationTerrain } from "./SimulationMap";
import type { PersistentStructureState } from "./Structures";

export interface ControllerQueryBudgetLimits {
  readonly queriesPerDecision: number;
  readonly materializedCellsPerDecision: number;
}

export interface ControllerQueryUsage {
  readonly queries: number;
  readonly materializedCells: number;
}

export interface ControllerQuerySession {
  readonly cells: Readonly<{
    get(id: CellId): Promise<CellView | undefined>;
    query(selector: CellSelector, limit?: number): Promise<QueryPage<CellView>>;
    count(selector: CellSelector): Promise<number>;
    neighbors(id: CellId): Promise<readonly CellId[]>;
    boundary(selector: CellSelector, limit?: number): Promise<QueryPage<CellView>>;
    connectedComponents(selector: CellSelector): Promise<QueryPage<CellSelector>>;
    distance(a: CellId, b: CellId): Promise<number>;
  }>;
  readonly segments: Readonly<{
    get(id: SegmentId): Promise<SegmentView | undefined>;
    list(): Promise<readonly SegmentView[]>;
    cells(id: SegmentId): CellSelector;
  }>;
  usage(): ControllerQueryUsage;
}

type FieldScaling = "AREA" | "RANGE";

type StructureFieldDefinition = Readonly<{
  structureType: Extract<
    StructureType,
    "FORT" | "SAM_LAUNCHER" | "OBSERVATION_POST" | "COMMAND_POST"
  >;
  axis:
    | "STRUCTURE_FIELD_COVERAGE_AREA"
    | "STRUCTURE_INTERCEPTION_RANGE"
    | "STRUCTURE_OBSERVATION_RADIUS";
  scaling: FieldScaling;
  baselineRadii: readonly [number, number, number, number, number];
}>;

const STRUCTURE_FIELD_DEFINITIONS: Readonly<
  Record<ControllerStructureFieldId, StructureFieldDefinition>
> = Object.freeze({
  FORT: Object.freeze({
    structureType: "FORT",
    axis: "STRUCTURE_FIELD_COVERAGE_AREA",
    scaling: "AREA",
    baselineRadii: Object.freeze([30, 35, 40, 45, 50] as const),
  }),
  SAM_LAUNCHER: Object.freeze({
    structureType: "SAM_LAUNCHER",
    axis: "STRUCTURE_INTERCEPTION_RANGE",
    scaling: "RANGE",
    baselineRadii: Object.freeze([70, 80, 90, 100, 105] as const),
  }),
  OBSERVATION: Object.freeze({
    structureType: "OBSERVATION_POST",
    axis: "STRUCTURE_OBSERVATION_RADIUS",
    scaling: "RANGE",
    baselineRadii: Object.freeze([40, 55, 70, 85, 100] as const),
  }),
  COMMAND_POST: Object.freeze({
    structureType: "COMMAND_POST",
    axis: "STRUCTURE_FIELD_COVERAGE_AREA",
    scaling: "AREA",
    baselineRadii: Object.freeze([30, 35, 40, 45, 50] as const),
  }),
});

interface StructureFieldSource {
  readonly centerCellId: CellId;
  readonly profile: StructureRadialFieldProfile;
}

interface StructureVisibilityContext {
  readonly requesterFactionId: string;
  readonly remoteObservationFields: readonly StructureFieldSource[];
  readonly enemyBlackoutFields: readonly StructureFieldSource[];
}

function orderedExplicitCellIds(
  state: MatchState,
  selector: Extract<CellSelector, { readonly kind: "CELLS" }>,
): readonly CellId[] {
  return Object.freeze(
    [...new Set(selector.ids.filter((id) => state.map.isValidCellId(id)))].sort(
      (left, right) => left - right,
    ),
  );
}

function cellConditionApplies(
  conditions: readonly RuleCondition[],
  terrain: TerrainType,
  hasFallout: boolean,
): boolean {
  return conditions.every((condition) => {
    switch (condition.kind) {
      case "SOURCE_TERRAIN_IS":
        return false;
      case "TARGET_TERRAIN_IS":
      case "EVENT_TERRAIN_IS":
      case "BUILD_TERRAIN_IS":
        return condition.terrain === terrain;
      case "TARGET_HAS_FALLOUT":
        return hasFallout;
      case "TARGET_LACKS_FALLOUT":
        return !hasFallout;
      default:
        return false;
    }
  });
}

function effectivePopulationBearing(
  state: MatchState,
  id: CellId,
  terrain: SimulationTerrain,
): boolean {
  const base = landTerrainBaseSpec(terrain).populationBearing;
  const ownerId = state.ownership[id] ?? null;
  if (ownerId === null || terrain === "TEST") return base;

  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) return base;

  let allowed = base;
  for (const entry of owner.rules.normalizedRules) {
    if (
      entry.axis !== "TERRAIN_POPULATION_BEARING_PERMISSION" ||
      !ruleScopeMatches(entry.scope, { kind: "TERRAIN", terrain }) ||
      (entry.conditions !== undefined &&
        !cellConditionApplies(entry.conditions, terrain, state.fallout[id] ?? false))
    ) {
      continue;
    }
    if (entry.value.kind !== "PROHIBIT_WINS") continue;
    if (entry.value.decision === "PROHIBIT") return false;
    allowed = true;
  }
  return allowed;
}

function isWater(terrain: SimulationTerrain): boolean {
  return terrain === "SHALLOW_WATER" || terrain === "DEEP_WATER";
}

function isCoast(state: MatchState, id: CellId): boolean {
  const terrain = state.map.terrainAt(id);
  return (
    landTerrainBaseSpec(terrain).landTraversable &&
    state.map
      .cardinalNeighbors(id)
      .some((neighbor) => isWater(state.map.terrainAt(neighbor)))
  );
}

function isShoreline(state: MatchState, id: CellId): boolean {
  const terrain = state.map.terrainAt(id);
  if (!isWater(terrain)) return false;
  return state.map.cardinalNeighbors(id).some((neighbor) => {
    const adjacent = state.map.terrainAt(neighbor);
    return (
      landTerrainBaseSpec(adjacent).landTraversable &&
      adjacent !== "SHALLOW_WATER"
    );
  });
}

function materializeCellView(
  state: MatchState,
  id: CellId,
): CellView | undefined {
  if (!state.map.isValidCellId(id)) return undefined;
  const terrain = state.map.terrainAt(id);
  if (terrain === "TEST") {
    throw new Error("TEST terrain has no public CellView representation");
  }
  const ownerId = state.ownership[id] ?? null;
  const segmentId = state.map.segments?.segmentIdOf(id);
  const base = landTerrainBaseSpec(terrain);
  return Object.freeze({
    id,
    position: state.map.positionOf(id),
    terrain,
    hasFallout: state.fallout[id] ?? false,
    conquerable: base.conquerable,
    populationBearing: effectivePopulationBearing(state, id, terrain),
    ...(ownerId === null ? {} : { ownerId }),
    ...(segmentId === undefined ? {} : { segmentId }),
    isCoast: isCoast(state, id),
    isShoreline: isShoreline(state, id),
  });
}

function materializeSegmentView(
  state: MatchState,
  id: SegmentId,
): SegmentView | undefined {
  const segments = state.map.segments;
  if (
    segments === undefined ||
    !Number.isSafeInteger(id) ||
    id < 0 ||
    id >= segments.segmentCount
  ) {
    return undefined;
  }

  const span = segments.cells(id);
  let populationBearingCellCount = 0;
  const ownerCounts: Record<string, number> = {};
  const terrainCounts: Partial<Record<TerrainType, number>> = {};

  for (let index = 0; index < span.length; index += 1) {
    const cellId = span.at(index);
    const terrain = state.map.terrainAt(cellId);
    if (terrain === "TEST") {
      throw new Error("Segment runtime cannot summarize TEST terrain");
    }
    terrainCounts[terrain] = (terrainCounts[terrain] ?? 0) + 1;
    if (effectivePopulationBearing(state, cellId, terrain)) {
      populationBearingCellCount += 1;
    }
    const ownerId = state.ownership[cellId] ?? null;
    if (ownerId !== null) ownerCounts[ownerId] = (ownerCounts[ownerId] ?? 0) + 1;
  }

  const ownerShares: Record<string, number> = {};
  for (const ownerId of Object.keys(ownerCounts).sort()) {
    ownerShares[ownerId] = ownerCounts[ownerId]! / span.length;
  }

  return Object.freeze({
    id,
    cellCount: span.length,
    populationBearingCellCount,
    ownerShares: Object.freeze(ownerShares),
    adjacentSegmentIds: Object.freeze([...segments.adjacentSegmentIds(id)]),
    terrainCounts: Object.freeze(terrainCounts),
  });
}

function factionIdentity(faction: MatchFactionState) {
  return {
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  };
}

function factionById(state: MatchState, factionId: string): MatchFactionState | undefined {
  return state.factions.find((faction) => faction.id === factionId);
}

function factionHasP45ForestConcealment(
  state: MatchState,
  factionId: string,
): boolean {
  return (
    factionById(state, factionId)?.rules.customDomains.some(
      (entry) =>
        entry.sourceKind === "ORIGIN" &&
        entry.sourceId === "P45" &&
        entry.domain === "FOREST_CONCEALMENT",
    ) ?? false
  );
}

function factionHasP49EnemyBlackout(
  state: MatchState,
  factionId: string,
): boolean {
  const faction = factionById(state, factionId);
  if (faction === undefined) return false;
  return faction.rules.normalizedRules.some(
    (entry) =>
      entry.axis === "STRUCTURE_EFFECT_PROFILE" &&
      ruleScopeMatches(entry.scope, {
        kind: "STRUCTURE",
        structure: "OBSERVATION_POST",
      }) &&
      entry.value.kind === "SINGLETON" &&
      entry.value.value === "ENEMY_BLACKOUT",
  );
}

function effectiveStructureFieldProfile(
  state: MatchState,
  structure: PersistentStructureState,
  field: ControllerStructureFieldId,
): StructureRadialFieldProfile | undefined {
  const definition = STRUCTURE_FIELD_DEFINITIONS[field];
  if (
    !structure.active ||
    structure.completedLevel === undefined ||
    structure.type !== definition.structureType
  ) {
    return undefined;
  }

  const owner = factionById(state, structure.ownerId);
  if (owner === undefined) {
    throw new Error(`structure ${structure.id} has unknown owner ${structure.ownerId}`);
  }
  const scope = {
    kind: "STRUCTURE",
    structure: structure.type,
  } as const;
  if (
    owner.rules.dynamicProviders.some(
      (provider) =>
        provider.axis === definition.axis &&
        ruleScopeMatches(provider.scope, scope) &&
        provider.dependency === "TERRITORIAL_CONTACT_COUNT",
    )
  ) {
    throw new Error(
      `${definition.axis} requires Territorial Contact state unavailable to controller field projection`,
    );
  }

  const factor = materializeCompiledScalarScaleFactor(
    owner.rules,
    RULE_AXIS_REGISTRY,
    definition.axis,
    scope,
    {
      ownedPersistentStructureCount: state.structures.filter(
        (candidate) => candidate.ownerId === owner.id,
      ).length,
      territorialContactCount: 0,
      peakTotalPopulation: owner.population.peakTotal,
    },
  );
  const baselineRadius = definition.baselineRadii[structure.completedLevel - 1];
  return definition.scaling === "AREA"
    ? structureRadialFieldFromAreaFactor(
        baselineRadius,
        factor.numerator,
        factor.denominator,
      )
    : structureRadialFieldFromRangeFactor(
        baselineRadius,
        factor.numerator,
        factor.denominator,
      );
}

function fieldSourceForStructure(
  state: MatchState,
  structure: PersistentStructureState,
  field: ControllerStructureFieldId,
): StructureFieldSource | undefined {
  const profile = effectiveStructureFieldProfile(state, structure, field);
  if (profile === undefined) return undefined;
  return Object.freeze({ centerCellId: structure.cellId, profile });
}

function fieldSourceContainsCell(
  state: MatchState,
  source: StructureFieldSource,
  cellId: CellId,
): boolean {
  const center = state.map.positionOf(source.centerCellId);
  const candidate = state.map.positionOf(cellId);
  return structureRadialFieldContainsCell(
    source.profile,
    center.x,
    center.y,
    candidate.x,
    candidate.y,
  );
}

function anyFieldSourceContainsCell(
  state: MatchState,
  sources: readonly StructureFieldSource[],
  cellId: CellId,
): boolean {
  return sources.some((source) => fieldSourceContainsCell(state, source, cellId));
}

function createStructureVisibilityContext(
  state: MatchState,
  requesterFactionId: string,
): StructureVisibilityContext {
  const requester = factionById(state, requesterFactionId);
  if (requester === undefined) {
    throw new Error(`unknown controller faction: ${requesterFactionId}`);
  }

  const remoteObservationFields: StructureFieldSource[] = [];
  const enemyBlackoutFields: StructureFieldSource[] = [];
  for (const structure of state.structures) {
    if (structure.type !== "OBSERVATION_POST") continue;
    const source = fieldSourceForStructure(state, structure, "OBSERVATION");
    if (source === undefined) continue;
    const blackout = factionHasP49EnemyBlackout(state, structure.ownerId);
    if (structure.ownerId === requesterFactionId && !blackout) {
      remoteObservationFields.push(source);
      continue;
    }
    if (!blackout) continue;
    const owner = factionById(state, structure.ownerId);
    if (owner === undefined) continue;
    if (
      factionRelationBetween(factionIdentity(requester), factionIdentity(owner)) ===
      "ENEMY"
    ) {
      enemyBlackoutFields.push(source);
    }
  }

  return Object.freeze({
    requesterFactionId,
    remoteObservationFields: Object.freeze(remoteObservationFields),
    enemyBlackoutFields: Object.freeze(enemyBlackoutFields),
  });
}

function p45ConcealsCellFromRequester(
  state: MatchState,
  context: StructureVisibilityContext,
  cellId: CellId,
): boolean {
  const holderId = state.ownership[cellId] ?? undefined;
  if (
    holderId === undefined ||
    holderId === context.requesterFactionId ||
    !factionHasP45ForestConcealment(state, holderId)
  ) {
    return false;
  }
  return isOwnedForestConcealmentCell(
    state.map.terrainAt(cellId),
    holderId,
    holderId,
  );
}

function structureIsLawfullyVisible(
  state: MatchState,
  context: StructureVisibilityContext,
  structure: PersistentStructureState,
): boolean {
  const explicitPublic =
    structure.type === "OBSERVATION_POST" &&
    factionHasP49EnemyBlackout(state, structure.ownerId);
  const concealed =
    p45ConcealsCellFromRequester(state, context, structure.cellId) ||
    anyFieldSourceContainsCell(
      state,
      context.enemyBlackoutFields,
      structure.cellId,
    );
  const remotelyObserved = anyFieldSourceContainsCell(
    state,
    context.remoteObservationFields,
    structure.cellId,
  );

  return resolveTacticalVisibility({
    selfOwned: structure.ownerId === context.requesterFactionId,
    explicitPublic,
    // Direct-reveal records are not yet present in MatchState. Do not invent an
    // ID-addressable substitute at this projection boundary.
    directRevealActive: false,
    concealed,
    remotelyObserved,
  }).visible;
}

function ownerMatchesFieldAffiliation(
  state: MatchState,
  referenceFactionId: string,
  candidateOwnerId: string,
  affiliation: StructureFieldAffiliation,
): boolean {
  if (candidateOwnerId === referenceFactionId) return true;
  if (affiliation === "SELF") return false;
  const reference = factionById(state, referenceFactionId);
  const candidate = factionById(state, candidateOwnerId);
  if (reference === undefined || candidate === undefined) return false;
  return (
    factionRelationBetween(factionIdentity(reference), factionIdentity(candidate)) ===
    "ALLY"
  );
}

function visibleStructureFieldSources(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: Extract<CellSelector, { readonly kind: "STRUCTURE_FIELD" }>,
): readonly StructureFieldSource[] {
  const sources: StructureFieldSource[] = [];
  for (const structure of state.structures) {
    if (
      !ownerMatchesFieldAffiliation(
        state,
        selector.referenceFactionId,
        structure.ownerId,
        selector.affiliation,
      ) ||
      !structureIsLawfullyVisible(state, context, structure)
    ) {
      continue;
    }
    const source = fieldSourceForStructure(state, structure, selector.field);
    if (source !== undefined) sources.push(source);
  }
  return Object.freeze(sources);
}

function visibleStructureFieldInstanceSource(
  state: MatchState,
  context: StructureVisibilityContext,
  structureId: string,
  field: StructureFieldId,
): StructureFieldSource | undefined {
  const structure = state.structures.find((candidate) => candidate.id === structureId);
  if (
    structure === undefined ||
    !structureIsLawfullyVisible(state, context, structure)
  ) {
    return undefined;
  }
  return fieldSourceForStructure(state, structure, field);
}

type SelectorMatcher = (id: CellId) => boolean;

function compileSelectorMatcher(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
): SelectorMatcher {
  switch (selector.kind) {
    case "CELLS": {
      const ids = new Set(orderedExplicitCellIds(state, selector));
      return (id) => ids.has(id);
    }
    case "OWNER": {
      const ownerId = selector.factionId ?? null;
      return (id) => (state.ownership[id] ?? null) === ownerId;
    }
    case "SEGMENT": {
      const segments = state.map.segments;
      if (segments === undefined) return () => false;
      return (id) => segments.segmentIdOf(id) === selector.segmentId;
    }
    case "TERRAIN":
      return (id) => state.map.terrainAt(id) === selector.terrain;
    case "FALLOUT":
      return (id) => (state.fallout[id] ?? false) === selector.value;
    case "POPULATION_BEARING":
      return (id) => {
        const terrain = state.map.terrainAt(id);
        return effectivePopulationBearing(state, id, terrain) === selector.value;
      };
    case "CONQUERABLE":
      return (id) =>
        landTerrainBaseSpec(state.map.terrainAt(id)).conquerable === selector.value;
    case "COAST":
      return (id) => isCoast(state, id) === selector.value;
    case "SHORELINE":
      return (id) => isShoreline(state, id) === selector.value;
    case "CIRCLE": {
      const center = state.map.positionOf(selector.center);
      const radiusSquared = selector.radius * selector.radius;
      return (id) => {
        const position = state.map.positionOf(id);
        const dx = position.x - center.x;
        const dy = position.y - center.y;
        return dx * dx + dy * dy <= radiusSquared;
      };
    }
    case "UNION": {
      const children = selector.selectors.map((child) =>
        compileSelectorMatcher(state, context, child),
      );
      return (id) => children.some((child) => child(id));
    }
    case "INTERSECTION": {
      const children = selector.selectors.map((child) =>
        compileSelectorMatcher(state, context, child),
      );
      return (id) => children.every((child) => child(id));
    }
    case "DIFFERENCE": {
      const left = compileSelectorMatcher(state, context, selector.left);
      const right = compileSelectorMatcher(state, context, selector.right);
      return (id) => left(id) && !right(id);
    }
    case "STRUCTURE_FIELD": {
      const sources = visibleStructureFieldSources(state, context, selector);
      return (id) => anyFieldSourceContainsCell(state, sources, id);
    }
    case "STRUCTURE_FIELD_INSTANCE": {
      const source = visibleStructureFieldInstanceSource(
        state,
        context,
        selector.structureId,
        selector.field,
      );
      return source === undefined
        ? () => false
        : (id) => fieldSourceContainsCell(state, source, id);
    }
  }
}

function orderedSelectorCellIds(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
): readonly CellId[] {
  if (selector.kind === "CELLS") return orderedExplicitCellIds(state, selector);
  const matches = compileSelectorMatcher(state, context, selector);
  const ids: CellId[] = [];
  for (let id = 0; id < state.map.cellCount; id += 1) {
    if (matches(id)) ids.push(id);
  }
  return Object.freeze(ids);
}

function boundedOrderedSelectorCellIds(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
  maxMatches: number,
): readonly CellId[] {
  if (selector.kind === "CELLS") {
    return Object.freeze(orderedExplicitCellIds(state, selector).slice(0, maxMatches));
  }
  const matches = compileSelectorMatcher(state, context, selector);
  const ids: CellId[] = [];
  for (let id = 0; id < state.map.cellCount && ids.length < maxMatches; id += 1) {
    if (matches(id)) ids.push(id);
  }
  return Object.freeze(ids);
}

function countSelectorCells(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
): number {
  if (selector.kind === "CELLS") return orderedExplicitCellIds(state, selector).length;
  const matches = compileSelectorMatcher(state, context, selector);
  let count = 0;
  for (let id = 0; id < state.map.cellCount; id += 1) {
    if (matches(id)) count += 1;
  }
  return count;
}

function boundedOrderedBoundaryIds(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
  maxMatches: number,
): readonly CellId[] {
  const matches = compileSelectorMatcher(state, context, selector);
  const candidates =
    selector.kind === "CELLS"
      ? orderedExplicitCellIds(state, selector)
      : undefined;
  const ids: CellId[] = [];
  const consider = (id: CellId): void => {
    if (
      matches(id) &&
      state.map.cardinalNeighbors(id).some((neighbor) => !matches(neighbor))
    ) {
      ids.push(id);
    }
  };

  if (candidates !== undefined) {
    for (const id of candidates) {
      if (ids.length >= maxMatches) break;
      consider(id);
    }
  } else {
    for (let id = 0; id < state.map.cellCount && ids.length < maxMatches; id += 1) {
      consider(id);
    }
  }
  return Object.freeze(ids);
}

function orderedComponents(
  state: MatchState,
  selected: readonly CellId[],
): readonly (readonly CellId[])[] {
  const unvisited = new Set(selected);
  const components: (readonly CellId[])[] = [];

  for (const start of selected) {
    if (!unvisited.delete(start)) continue;
    const queue: CellId[] = [start];
    const ids: CellId[] = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const id = queue[cursor]!;
      ids.push(id);
      for (const neighbor of state.map.cardinalNeighbors(id)) {
        if (unvisited.delete(neighbor)) queue.push(neighbor);
      }
    }
    ids.sort((left, right) => left - right);
    components.push(Object.freeze(ids));
  }

  return Object.freeze(components);
}

export function createControllerQuerySession(
  state: MatchState,
  requesterFactionId: string,
  limits: ControllerQueryBudgetLimits,
): ControllerQuerySession {
  if (!state.factions.some((faction) => faction.id === requesterFactionId)) {
    throw new Error(`unknown controller faction: ${requesterFactionId}`);
  }
  const visibility = createStructureVisibilityContext(state, requesterFactionId);

  let queries = 0;
  let materializedCells = 0;

  const beginQuery = (): void => {
    if (queries >= limits.queriesPerDecision) {
      throw new Error("controller query budget exhausted");
    }
    queries += 1;
  };

  const remainingMaterialization = (): number =>
    Math.max(0, limits.materializedCellsPerDecision - materializedCells);

  const requestedMaterialization = (limit?: number): number =>
    limit === undefined
      ? remainingMaterialization()
      : Math.min(limit, remainingMaterialization());

  const materializePage = (
    ids: readonly CellId[],
    limit?: number,
  ): QueryPage<CellView> => {
    const requested = requestedMaterialization(limit);
    const selected = ids.slice(0, requested);
    const items = Object.freeze(
      selected.map((id) => {
        const cell = materializeCellView(state, id);
        if (cell === undefined) throw new Error(`invalid materialized cell ${id}`);
        return cell;
      }),
    );
    materializedCells += items.length;
    return Object.freeze({
      items,
      truncated: ids.length > items.length,
    });
  };

  const get = async (id: CellId): Promise<CellView | undefined> => {
    beginQuery();
    if (!state.map.isValidCellId(id)) return undefined;
    if (remainingMaterialization() === 0) {
      throw new Error("controller materialization budget exhausted");
    }
    const cell = materializeCellView(state, id);
    if (cell === undefined) throw new Error(`invalid materialized cell ${id}`);
    materializedCells += 1;
    return cell;
  };

  const query = async (
    selector: CellSelector,
    limit?: number,
  ): Promise<QueryPage<CellView>> => {
    beginQuery();
    const requested = requestedMaterialization(limit);
    return materializePage(
      boundedOrderedSelectorCellIds(
        state,
        visibility,
        selector,
        requested + 1,
      ),
      requested,
    );
  };

  const count = async (selector: CellSelector): Promise<number> => {
    beginQuery();
    return countSelectorCells(state, visibility, selector);
  };

  const neighbors = async (id: CellId): Promise<readonly CellId[]> => {
    beginQuery();
    return state.map.cardinalNeighbors(id);
  };

  const boundary = async (
    selector: CellSelector,
    limit?: number,
  ): Promise<QueryPage<CellView>> => {
    beginQuery();
    const requested = requestedMaterialization(limit);
    return materializePage(
      boundedOrderedBoundaryIds(
        state,
        visibility,
        selector,
        requested + 1,
      ),
      requested,
    );
  };

  const connectedComponents = async (
    selector: CellSelector,
  ): Promise<QueryPage<CellSelector>> => {
    beginQuery();
    const components = orderedComponents(
      state,
      orderedSelectorCellIds(state, visibility, selector),
    );
    const items: CellSelector[] = [];
    let truncated = false;
    for (const ids of components) {
      if (ids.length > remainingMaterialization()) {
        truncated = true;
        break;
      }
      items.push(Object.freeze({ kind: "CELLS" as const, ids }));
      materializedCells += ids.length;
    }
    return Object.freeze({ items: Object.freeze(items), truncated });
  };

  const distance = async (a: CellId, b: CellId): Promise<number> => {
    beginQuery();
    const left = state.map.positionOf(a);
    const right = state.map.positionOf(b);
    return Math.hypot(left.x - right.x, left.y - right.y);
  };

  const getSegment = async (
    id: SegmentId,
  ): Promise<SegmentView | undefined> => {
    beginQuery();
    return materializeSegmentView(state, id);
  };

  const listSegments = async (): Promise<readonly SegmentView[]> => {
    beginQuery();
    const segments = state.map.segments;
    if (segments === undefined) return Object.freeze([]);
    return Object.freeze(
      Array.from({ length: segments.segmentCount }, (_, id) => {
        const view = materializeSegmentView(state, id);
        if (view === undefined) throw new Error(`invalid SegmentId ${id}`);
        return view;
      }),
    );
  };

  const segmentCells = (id: SegmentId): CellSelector =>
    Object.freeze({ kind: "SEGMENT" as const, segmentId: id });

  return Object.freeze({
    cells: Object.freeze({
      get,
      query,
      count,
      neighbors,
      boundary,
      connectedComponents,
      distance,
    }),
    segments: Object.freeze({
      get: getSegment,
      list: listSegments,
      cells: segmentCells,
    }),
    usage: () => Object.freeze({ queries, materializedCells }),
  });
}
