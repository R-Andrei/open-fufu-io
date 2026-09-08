import type { CellId } from "../core/controller/ControllerApi";
import type { SimulationMap } from "./SimulationMap";

/**
 * Deterministic non-negative path score increment supplied by a traversal domain.
 * Legal transitions must return a positive safe integer; `undefined` means blocked.
 * The concrete fixed-point unit remains owned by the caller/domain.
 */
export type TraversalWeight = number;

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
  readonly heap = new DeterministicMinHeap();

  private generation = 0;

  constructor(cellCount: number) {
    this.bestWeight = new Float64Array(cellCount);
    this.bestStamp = new Uint32Array(cellCount);
    this.predecessor = new Float64Array(cellCount);
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
          const cells: CellId[] = [];
          let cursor = to;
          while (cursor !== from) {
            cells.push(cursor);
            cursor = scratch.predecessor[cursor]!;
          }
          cells.push(from);
          cells.reverse();
          return {
            status: "FOUND",
            path: { cells, totalWeight: current.weight },
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

  return Object.freeze({ path, reachable });
}
