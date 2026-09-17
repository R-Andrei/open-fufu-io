import type {
  CellId,
} from "../core/controller/ControllerApi";
import type { SimulationMap } from "./SimulationMap";

/**
 * Deterministic non-negative path score increment supplied by a traversal domain.
 * Legal transitions must return a positive safe integer; `undefined` means blocked.
 * The concrete fixed-point unit remains owned by the caller/domain.
 */
export type TraversalWeight = number;
export type NavigationIntentWeight = number;

export interface NavigationTraversalPolicy {
  traversalWeight(from: CellId, to: CellId): TraversalWeight | undefined;
}

export interface NavigationSearchOptions {
  /** Computational guard, distinct from semantic traversal-weight bounds. */
  readonly maxSettledCells?: number;
}

export interface NavigationPath {
  readonly cells: readonly CellId[];
  readonly totalWeight: TraversalWeight;
}

export type NavigationPathResult =
  | { readonly status: "FOUND"; readonly path: NavigationPath }
  | { readonly status: "UNREACHABLE" }
  | { readonly status: "LIMIT_REACHED" };

export type NavigationPathTowardResult =
  | { readonly status: "FOUND"; readonly path: NavigationPath }
  | { readonly status: "BEST_EFFORT"; readonly path: NavigationPath }
  | { readonly status: "LIMIT_REACHED" };

export interface NavigationCandidate {
  readonly cellId: CellId;
  readonly intentWeight: NavigationIntentWeight;
}

export interface NavigationCandidateRoute {
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly sourceIntentWeight: NavigationIntentWeight;
  readonly targetIntentWeight: NavigationIntentWeight;
  readonly path: NavigationPath;
  readonly objectiveWeight: number;
}

export type NavigationCandidatePathResult =
  | { readonly status: "FOUND"; readonly route: NavigationCandidateRoute }
  | { readonly status: "UNREACHABLE" }
  | { readonly status: "LIMIT_REACHED" };

export interface ReachableCell {
  readonly cellId: CellId;
  readonly totalWeight: TraversalWeight;
}

export interface NavigationReachabilityResult {
  readonly cells: readonly ReachableCell[];
  readonly truncated: boolean;
}

export interface Navigation {
  path(
    from: CellId,
    to: CellId,
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationPathResult;

  pathToward(
    from: CellId,
    to: CellId,
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationPathTowardResult;

  pathBetweenCandidates(
    sources: readonly NavigationCandidate[],
    targets: readonly NavigationCandidate[],
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationCandidatePathResult;

  reachable(
    from: CellId,
    maxWeight: TraversalWeight,
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationReachabilityResult;
}

interface HeapEntry {
  readonly cellId: CellId;
  readonly weight: TraversalWeight;
}

class DeterministicMinHeap {
  private readonly cellIds: CellId[] = [];
  private readonly weights: TraversalWeight[] = [];

  clear(): void {
    this.cellIds.length = 0;
    this.weights.length = 0;
  }

  push(cellId: CellId, weight: TraversalWeight): void {
    let index = this.cellIds.length;
    this.cellIds.push(cellId);
    this.weights.push(weight);

    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): HeapEntry | undefined {
    const size = this.cellIds.length;
    if (size === 0) return undefined;

    const result: HeapEntry = {
      cellId: this.cellIds[0]!,
      weight: this.weights[0]!,
    };

    if (size === 1) {
      this.cellIds.pop();
      this.weights.pop();
      return result;
    }

    this.cellIds[0] = this.cellIds.pop()!;
    this.weights[0] = this.weights.pop()!;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < this.cellIds.length && this.less(left, smallest)) {
        smallest = left;
      }
      if (right < this.cellIds.length && this.less(right, smallest)) {
        smallest = right;
      }
      if (smallest === index) break;

      this.swap(index, smallest);
      index = smallest;
    }

    return result;
  }

  private less(left: number, right: number): boolean {
    const leftWeight = this.weights[left]!;
    const rightWeight = this.weights[right]!;
    if (leftWeight !== rightWeight) return leftWeight < rightWeight;
    return this.cellIds[left]! < this.cellIds[right]!;
  }

  private swap(left: number, right: number): void {
    [this.cellIds[left], this.cellIds[right]] = [
      this.cellIds[right]!,
      this.cellIds[left]!,
    ];
    [this.weights[left], this.weights[right]] = [
      this.weights[right]!,
      this.weights[left]!,
    ];
  }
}

class NavigationScratch {
  readonly bestWeight: Float64Array;
  readonly bestStamp: Uint32Array;
  readonly predecessor: Float64Array;
  readonly bestSourceIntentWeight: Float64Array;
  readonly bestSourceCellId: Float64Array;
  readonly heap = new DeterministicMinHeap();

  private generation = 0;

  constructor(cellCount: number) {
    this.bestWeight = new Float64Array(cellCount);
    this.bestStamp = new Uint32Array(cellCount);
    this.predecessor = new Float64Array(cellCount);
    this.bestSourceIntentWeight = new Float64Array(cellCount);
    this.bestSourceCellId = new Float64Array(cellCount);
  }

  begin(): number {
    this.heap.clear();
    this.generation += 1;
    if (this.generation > 0xffff_ffff) {
      this.bestStamp.fill(0);
      this.generation = 1;
    }
    return this.generation;
  }
}

function assertTraversalWeight(weight: number): void {
  if (!Number.isSafeInteger(weight) || weight <= 0) {
    throw new Error("traversal weight must be a positive safe integer");
  }
}

function assertIntentWeight(weight: number): void {
  if (!Number.isSafeInteger(weight) || weight < 0) {
    throw new Error("intent weight must be a non-negative safe integer");
  }
}

function assertMaxWeight(maxWeight: number): void {
  if (!Number.isSafeInteger(maxWeight) || maxWeight < 0) {
    throw new Error("maxWeight must be a non-negative safe integer");
  }
}

function maxSettledCells(options: NavigationSearchOptions | undefined): number {
  const limit = options?.maxSettledCells;
  if (limit === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error("maxSettledCells must be a positive safe integer");
  }
  return limit;
}

function checkedCumulativeWeight(
  base: TraversalWeight,
  increment: TraversalWeight,
): TraversalWeight {
  const total = base + increment;
  if (!Number.isSafeInteger(total)) {
    throw new Error("cumulative traversal weight exceeds safe integer range");
  }
  return total;
}

function checkedObjectiveWeight(
  left: number,
  right: number,
): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new Error("navigation objective weight exceeds safe integer range");
  }
  return total;
}

export function createNavigation(map: SimulationMap): Navigation {
  const scratchPool: NavigationScratch[] = [];

  const assertCellId = (cellId: CellId): void => {
    if (!map.isValidCellId(cellId)) {
      throw new Error(`CellId is outside the navigation map: ${String(cellId)}`);
    }
  };

  const acquireScratch = (): NavigationScratch =>
    scratchPool.pop() ?? new NavigationScratch(map.cellCount);

  const releaseScratch = (scratch: NavigationScratch): void => {
    scratchPool.push(scratch);
  };

  const transitionWeight = (
    policy: NavigationTraversalPolicy,
    from: CellId,
    to: CellId,
  ): TraversalWeight | undefined => {
    const weight = policy.traversalWeight(from, to);
    if (weight === undefined) return undefined;
    assertTraversalWeight(weight);
    return weight;
  };

  const reconstructPath = (
    scratch: NavigationScratch,
    from: CellId,
    destination: CellId,
    totalWeight: TraversalWeight,
  ): NavigationPath => {
    const cells: CellId[] = [];
    let cursor = destination;
    while (cursor !== from) {
      cells.push(cursor);
      cursor = scratch.predecessor[cursor]!;
    }
    cells.push(from);
    cells.reverse();
    return { cells, totalWeight };
  };

  const normalizeCandidates = (
    candidates: readonly NavigationCandidate[],
    label: string,
  ): readonly NavigationCandidate[] => {
    if (!Array.isArray(candidates)) {
      throw new Error(`${label} candidates must be an array`);
    }
    const bestByCell = new Map<CellId, NavigationIntentWeight>();
    for (let index = 0; index < candidates.length; index += 1) {
      if (!(index in candidates)) {
        throw new Error(`${label} candidates must be a dense array`);
      }
      const candidate = candidates[index];
      if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error(`${label} candidate must be an object`);
      }
      assertCellId(candidate.cellId);
      assertIntentWeight(candidate.intentWeight);
      const current = bestByCell.get(candidate.cellId);
      if (current === undefined || candidate.intentWeight < current) {
        bestByCell.set(candidate.cellId, candidate.intentWeight);
      }
    }
    return Object.freeze(
      [...bestByCell.entries()]
        .sort(([left], [right]) => left - right)
        .map(([cellId, intentWeight]) => Object.freeze({ cellId, intentWeight })),
    );
  };

  const path = (
    from: CellId,
    to: CellId,
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationPathResult => {
    assertCellId(from);
    assertCellId(to);
    const settlementLimit = maxSettledCells(options);

    if (from === to) {
      return {
        status: "FOUND",
        path: { cells: [from], totalWeight: 0 },
      };
    }

    const scratch = acquireScratch();
    try {
      const generation = scratch.begin();
      scratch.bestStamp[from] = generation;
      scratch.bestWeight[from] = 0;
      scratch.predecessor[from] = from;
      scratch.heap.push(from, 0);

      let settledCells = 0;
      while (true) {
        const current = scratch.heap.pop();
        if (current === undefined) return { status: "UNREACHABLE" };

        if (
          scratch.bestStamp[current.cellId] !== generation ||
          scratch.bestWeight[current.cellId] !== current.weight
        ) {
          continue;
        }

        if (settledCells >= settlementLimit) {
          return { status: "LIMIT_REACHED" };
        }
        settledCells += 1;

        if (current.cellId === to) {
          return {
            status: "FOUND",
            path: reconstructPath(scratch, from, to, current.weight),
          };
        }

        for (const neighbor of map.cardinalNeighbors(current.cellId)) {
          const increment = transitionWeight(policy, current.cellId, neighbor);
          if (increment === undefined) continue;

          const candidate = checkedCumulativeWeight(current.weight, increment);
          const known =
            scratch.bestStamp[neighbor] === generation
              ? scratch.bestWeight[neighbor]!
              : Number.POSITIVE_INFINITY;

          if (candidate >= known) continue;

          scratch.bestStamp[neighbor] = generation;
          scratch.bestWeight[neighbor] = candidate;
          scratch.predecessor[neighbor] = current.cellId;
          scratch.heap.push(neighbor, candidate);
        }
      }
    } finally {
      releaseScratch(scratch);
    }
  };

  const pathToward = (
    from: CellId,
    to: CellId,
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationPathTowardResult => {
    assertCellId(from);
    assertCellId(to);
    const settlementLimit = maxSettledCells(options);

    if (from === to) {
      return {
        status: "FOUND",
        path: { cells: [from], totalWeight: 0 },
      };
    }

    const targetX = to % map.width;
    const targetY = Math.floor(to / map.width);
    const squaredDistance = (cellId: CellId): number => {
      const dx = (cellId % map.width) - targetX;
      const dy = Math.floor(cellId / map.width) - targetY;
      const distance = dx * dx + dy * dy;
      if (!Number.isSafeInteger(distance)) {
        throw new Error("cell-center squared distance exceeds safe integer range");
      }
      return distance;
    };

    const scratch = acquireScratch();
    try {
      const generation = scratch.begin();
      scratch.bestStamp[from] = generation;
      scratch.bestWeight[from] = 0;
      scratch.predecessor[from] = from;
      scratch.heap.push(from, 0);

      let bestCellId = from;
      let bestDistance = squaredDistance(from);
      let bestTraversalWeight = 0;
      let settledCells = 0;

      while (true) {
        const current = scratch.heap.pop();
        if (current === undefined) {
          return {
            status: "BEST_EFFORT",
            path: reconstructPath(
              scratch,
              from,
              bestCellId,
              bestTraversalWeight,
            ),
          };
        }

        if (
          scratch.bestStamp[current.cellId] !== generation ||
          scratch.bestWeight[current.cellId] !== current.weight
        ) {
          continue;
        }

        if (settledCells >= settlementLimit) {
          return { status: "LIMIT_REACHED" };
        }
        settledCells += 1;

        if (current.cellId === to) {
          return {
            status: "FOUND",
            path: reconstructPath(scratch, from, to, current.weight),
          };
        }

        const distance = squaredDistance(current.cellId);
        if (
          distance < bestDistance ||
          (distance === bestDistance &&
            (current.weight < bestTraversalWeight ||
              (current.weight === bestTraversalWeight &&
                current.cellId < bestCellId)))
        ) {
          bestCellId = current.cellId;
          bestDistance = distance;
          bestTraversalWeight = current.weight;
        }

        for (const neighbor of map.cardinalNeighbors(current.cellId)) {
          const increment = transitionWeight(policy, current.cellId, neighbor);
          if (increment === undefined) continue;

          const candidate = checkedCumulativeWeight(current.weight, increment);
          const known =
            scratch.bestStamp[neighbor] === generation
              ? scratch.bestWeight[neighbor]!
              : Number.POSITIVE_INFINITY;

          if (candidate >= known) continue;

          scratch.bestStamp[neighbor] = generation;
          scratch.bestWeight[neighbor] = candidate;
          scratch.predecessor[neighbor] = current.cellId;
          scratch.heap.push(neighbor, candidate);
        }
      }
    } finally {
      releaseScratch(scratch);
    }
  };

  const pathBetweenCandidates = (
    sourceCandidates: readonly NavigationCandidate[],
    targetCandidates: readonly NavigationCandidate[],
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationCandidatePathResult => {
    const sources = normalizeCandidates(sourceCandidates, "source");
    const targets = normalizeCandidates(targetCandidates, "target");
    const settlementLimit = maxSettledCells(options);
    if (sources.length === 0 || targets.length === 0) {
      return { status: "UNREACHABLE" };
    }

    const targetIntentByCell = new Map<CellId, NavigationIntentWeight>(
      targets.map((candidate) => [candidate.cellId, candidate.intentWeight]),
    );
    const scratch = acquireScratch();
    try {
      const generation = scratch.begin();
      for (const source of sources) {
        scratch.bestStamp[source.cellId] = generation;
        scratch.bestWeight[source.cellId] = source.intentWeight;
        scratch.bestSourceIntentWeight[source.cellId] = source.intentWeight;
        scratch.bestSourceCellId[source.cellId] = source.cellId;
        scratch.predecessor[source.cellId] = source.cellId;
        scratch.heap.push(source.cellId, source.intentWeight);
      }

      let bestRoute: NavigationCandidateRoute | undefined;
      let bestIntentWeight = Number.POSITIVE_INFINITY;
      let settledCells = 0;

      while (true) {
        const current = scratch.heap.pop();
        if (current === undefined) {
          return bestRoute === undefined
            ? { status: "UNREACHABLE" }
            : { status: "FOUND", route: bestRoute };
        }

        if (
          scratch.bestStamp[current.cellId] !== generation ||
          scratch.bestWeight[current.cellId] !== current.weight
        ) {
          continue;
        }

        if (bestRoute !== undefined && current.weight > bestRoute.objectiveWeight) {
          return { status: "FOUND", route: bestRoute };
        }
        if (settledCells >= settlementLimit) {
          return { status: "LIMIT_REACHED" };
        }
        settledCells += 1;

        const sourceIntentWeight = scratch.bestSourceIntentWeight[current.cellId]!;
        const sourceCellId = scratch.bestSourceCellId[current.cellId]!;
        const routeWeight = current.weight - sourceIntentWeight;
        const targetIntentWeight = targetIntentByCell.get(current.cellId);

        if (targetIntentWeight !== undefined) {
          const objectiveWeight = checkedObjectiveWeight(
            current.weight,
            targetIntentWeight,
          );
          const intentWeight = checkedObjectiveWeight(
            sourceIntentWeight,
            targetIntentWeight,
          );
          const targetCellId = current.cellId;
          const isBetter =
            bestRoute === undefined ||
            objectiveWeight < bestRoute.objectiveWeight ||
            (objectiveWeight === bestRoute.objectiveWeight &&
              (intentWeight < bestIntentWeight ||
                (intentWeight === bestIntentWeight &&
                  (routeWeight < bestRoute.path.totalWeight ||
                    (routeWeight === bestRoute.path.totalWeight &&
                      (sourceCellId < bestRoute.sourceCellId ||
                        (sourceCellId === bestRoute.sourceCellId &&
                          targetCellId < bestRoute.targetCellId)))))));

          if (isBetter) {
            bestIntentWeight = intentWeight;
            bestRoute = {
              sourceCellId,
              targetCellId,
              sourceIntentWeight,
              targetIntentWeight,
              path: reconstructPath(
                scratch,
                sourceCellId,
                targetCellId,
                routeWeight,
              ),
              objectiveWeight,
            };
          }
        }

        for (const neighbor of map.cardinalNeighbors(current.cellId)) {
          const increment = transitionWeight(policy, current.cellId, neighbor);
          if (increment === undefined) continue;

          const candidateWeight = checkedCumulativeWeight(current.weight, increment);
          const known = scratch.bestStamp[neighbor] === generation;
          const knownWeight = known
            ? scratch.bestWeight[neighbor]!
            : Number.POSITIVE_INFINITY;
          const knownSourceIntentWeight = known
            ? scratch.bestSourceIntentWeight[neighbor]!
            : Number.POSITIVE_INFINITY;
          const knownSourceCellId = known
            ? scratch.bestSourceCellId[neighbor]!
            : Number.POSITIVE_INFINITY;

          const isBetter =
            candidateWeight < knownWeight ||
            (candidateWeight === knownWeight &&
              (sourceIntentWeight < knownSourceIntentWeight ||
                (sourceIntentWeight === knownSourceIntentWeight &&
                  sourceCellId < knownSourceCellId)));
          if (!isBetter) continue;

          const needsHeapEntry = candidateWeight < knownWeight;
          scratch.bestStamp[neighbor] = generation;
          scratch.bestWeight[neighbor] = candidateWeight;
          scratch.bestSourceIntentWeight[neighbor] = sourceIntentWeight;
          scratch.bestSourceCellId[neighbor] = sourceCellId;
          scratch.predecessor[neighbor] = current.cellId;
          if (needsHeapEntry) {
            scratch.heap.push(neighbor, candidateWeight);
          }
        }
      }
    } finally {
      releaseScratch(scratch);
    }
  };

  const reachable = (
    from: CellId,
    maxWeight: TraversalWeight,
    policy: NavigationTraversalPolicy,
    options?: NavigationSearchOptions,
  ): NavigationReachabilityResult => {
    assertCellId(from);
    assertMaxWeight(maxWeight);
    const settlementLimit = maxSettledCells(options);

    const scratch = acquireScratch();
    try {
      const generation = scratch.begin();
      scratch.bestStamp[from] = generation;
      scratch.bestWeight[from] = 0;
      scratch.heap.push(from, 0);

      const cells: ReachableCell[] = [];
      let settledCells = 0;

      while (true) {
        const current = scratch.heap.pop();
        if (current === undefined) {
          return { cells, truncated: false };
        }

        if (
          scratch.bestStamp[current.cellId] !== generation ||
          scratch.bestWeight[current.cellId] !== current.weight
        ) {
          continue;
        }

        if (current.weight > maxWeight) {
          return { cells, truncated: false };
        }
        if (settledCells >= settlementLimit) {
          return { cells, truncated: true };
        }

        settledCells += 1;
        cells.push({
          cellId: current.cellId,
          totalWeight: current.weight,
        });

        for (const neighbor of map.cardinalNeighbors(current.cellId)) {
          const increment = transitionWeight(policy, current.cellId, neighbor);
          if (increment === undefined) continue;

          const candidate = checkedCumulativeWeight(current.weight, increment);
          const known =
            scratch.bestStamp[neighbor] === generation
              ? scratch.bestWeight[neighbor]!
              : Number.POSITIVE_INFINITY;

          if (candidate >= known) continue;

          scratch.bestStamp[neighbor] = generation;
          scratch.bestWeight[neighbor] = candidate;
          scratch.heap.push(neighbor, candidate);
        }
      }
    } finally {
      releaseScratch(scratch);
    }
  };

  return Object.freeze({ path, pathToward, pathBetweenCandidates, reachable });
}
