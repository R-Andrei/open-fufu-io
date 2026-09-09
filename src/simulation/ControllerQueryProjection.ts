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

export interface ControllerQueryCellIdentity {
  readonly id: CellId;
}

export interface ControllerQuerySession {
  readonly cells: Readonly<{
    get(id: CellId): Promise<CellView | undefined>;
    query(
      selector: CellSelector,
      limit?: number,
    ): Promise<QueryPage<ControllerQueryCellIdentity>>;
    neighbors(id: CellId): Promise<readonly CellId[]>;
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

  const get = async (id: CellId): Promise<CellView | undefined> => {
    beginQuery();
    const cell = materializeCellView(state, id);
    if (cell !== undefined) materializedCells += 1;
    return cell;
  };

  const query = async (
    selector: CellSelector,
    limit?: number,
  ): Promise<QueryPage<ControllerQueryCellIdentity>> => {
    beginQuery();
    if (selector.kind !== "CELLS") {
      throw new Error(`controller selector not implemented: ${selector.kind}`);
    }

    const matching = orderedExplicitCellIds(state, selector);
    const remainingMaterialization = Math.max(
      0,
      limits.materializedCellsPerDecision - materializedCells,
    );
    const requested =
      limit === undefined
        ? remainingMaterialization
        : Math.min(limit, remainingMaterialization);
    const selected = matching.slice(0, requested);
    const items = Object.freeze(
      selected.map((id) => Object.freeze({ id })),
    );
    materializedCells += items.length;

    return Object.freeze({
      items,
      truncated: matching.length > items.length,
    });
  };

  const neighbors = async (id: CellId): Promise<readonly CellId[]> => {
    beginQuery();
    return state.map.cardinalNeighbors(id);
  };

  const distance = async (a: CellId, b: CellId): Promise<number> => {
    beginQuery();
    const left = state.map.positionOf(a);
    const right = state.map.positionOf(b);
    return Math.hypot(left.x - right.x, left.y - right.y);
  };

  return Object.freeze({
    cells: Object.freeze({ get, query, neighbors, distance }),
    usage: () => Object.freeze({ queries, materializedCells }),
  });
}
