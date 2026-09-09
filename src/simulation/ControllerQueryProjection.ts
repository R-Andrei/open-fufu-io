import type {
  CellId,
  CellSelector,
  QueryPage,
} from "../core/controller/ControllerApi";
import type { MatchState } from "./MatchState";

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
    query(
      selector: CellSelector,
      limit?: number,
    ): Promise<QueryPage<ControllerQueryCellIdentity>>;
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

  return Object.freeze({
    cells: Object.freeze({ query }),
    usage: () => Object.freeze({ queries, materializedCells }),
  });
}
