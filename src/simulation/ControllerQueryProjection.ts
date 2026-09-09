import type {
  CellId,
  CellSelector,
  CellView,
  QueryPage,
  TerrainType,
} from "../core/controller/ControllerApi";
import {
  ruleScopeMatches,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import { landTerrainBaseSpec } from "./LandOperations";
import type { MatchState } from "./MatchState";
import type { SimulationTerrain } from "./SimulationMap";

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
  usage(): ControllerQueryUsage;
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

type SelectorMatcher = (id: CellId) => boolean;

function compileSelectorMatcher(
  state: MatchState,
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
        compileSelectorMatcher(state, child),
      );
      return (id) => children.some((child) => child(id));
    }
    case "INTERSECTION": {
      const children = selector.selectors.map((child) =>
        compileSelectorMatcher(state, child),
      );
      return (id) => children.every((child) => child(id));
    }
    case "DIFFERENCE": {
      const left = compileSelectorMatcher(state, selector.left);
      const right = compileSelectorMatcher(state, selector.right);
      return (id) => left(id) && !right(id);
    }
    case "SEGMENT":
    case "STRUCTURE_FIELD":
    case "STRUCTURE_FIELD_INSTANCE":
      throw new Error(`controller selector not implemented: ${selector.kind}`);
  }
}

function orderedSelectorCellIds(
  state: MatchState,
  selector: CellSelector,
): readonly CellId[] {
  if (selector.kind === "CELLS") return orderedExplicitCellIds(state, selector);
  const matches = compileSelectorMatcher(state, selector);
  const ids: CellId[] = [];
  for (let id = 0; id < state.map.cellCount; id += 1) {
    if (matches(id)) ids.push(id);
  }
  return Object.freeze(ids);
}

function boundedOrderedSelectorCellIds(
  state: MatchState,
  selector: CellSelector,
  maxMatches: number,
): readonly CellId[] {
  if (selector.kind === "CELLS") {
    return Object.freeze(orderedExplicitCellIds(state, selector).slice(0, maxMatches));
  }
  const matches = compileSelectorMatcher(state, selector);
  const ids: CellId[] = [];
  for (let id = 0; id < state.map.cellCount && ids.length < maxMatches; id += 1) {
    if (matches(id)) ids.push(id);
  }
  return Object.freeze(ids);
}

function countSelectorCells(state: MatchState, selector: CellSelector): number {
  if (selector.kind === "CELLS") return orderedExplicitCellIds(state, selector).length;
  const matches = compileSelectorMatcher(state, selector);
  let count = 0;
  for (let id = 0; id < state.map.cellCount; id += 1) {
    if (matches(id)) count += 1;
  }
  return count;
}

function boundedOrderedBoundaryIds(
  state: MatchState,
  selector: CellSelector,
  maxMatches: number,
): readonly CellId[] {
  const matches = compileSelectorMatcher(state, selector);
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
    const cell = materializeCellView(state, id);
    if (cell !== undefined) materializedCells += 1;
    return cell;
  };

  const query = async (
    selector: CellSelector,
    limit?: number,
  ): Promise<QueryPage<CellView>> => {
    beginQuery();
    const requested = requestedMaterialization(limit);
    return materializePage(
      boundedOrderedSelectorCellIds(state, selector, requested + 1),
      requested,
    );
  };

  const count = async (selector: CellSelector): Promise<number> => {
    beginQuery();
    return countSelectorCells(state, selector);
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
      boundedOrderedBoundaryIds(state, selector, requested + 1),
      requested,
    );
  };

  const connectedComponents = async (
    selector: CellSelector,
  ): Promise<QueryPage<CellSelector>> => {
    beginQuery();
    const components = orderedComponents(state, orderedSelectorCellIds(state, selector));
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
    usage: () => Object.freeze({ queries, materializedCells }),
  });
}
