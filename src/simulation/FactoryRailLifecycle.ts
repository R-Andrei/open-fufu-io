import type { CellId } from "../core/controller/ControllerApi";
import {
  planFactoryRailLoop,
  type FactoryGeneratedRailEdge,
  type FactoryRailLoopPlan,
  type FactoryRailLoopPlanningInput,
} from "./RailNetwork";

export interface FactoryRailLoopSnapshotState {
  readonly snapshotId: string;
  readonly cells: readonly CellId[];
}

export interface FactoryRailLoopLifecycleState {
  readonly factoryId: string;
  readonly currentLoop: FactoryRailLoopPlan | null;
  readonly pendingLoop: FactoryRailLoopPlan | null;
  readonly retainedSnapshots: readonly FactoryRailLoopSnapshotState[];
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertLoopFactory(
  factoryId: string,
  loop: FactoryRailLoopPlan | null,
): void {
  if (loop !== null && loop.factoryId !== factoryId) {
    throw new Error(
      `Factory rail loop ${loop.factoryId} cannot belong to lifecycle ${factoryId}`,
    );
  }
}

function freezeSnapshots(
  snapshots: readonly FactoryRailLoopSnapshotState[],
): readonly FactoryRailLoopSnapshotState[] {
  return Object.freeze(
    snapshots
      .slice()
      .sort((left, right) => compareIds(left.snapshotId, right.snapshotId))
      .map((snapshot) =>
        Object.freeze({
          snapshotId: snapshot.snapshotId,
          cells: snapshot.cells,
        }),
      ),
  );
}

function createLifecycleState(input: {
  readonly factoryId: string;
  readonly currentLoop: FactoryRailLoopPlan | null;
  readonly pendingLoop: FactoryRailLoopPlan | null;
  readonly retainedSnapshots: readonly FactoryRailLoopSnapshotState[];
}): FactoryRailLoopLifecycleState {
  assertLoopFactory(input.factoryId, input.currentLoop);
  assertLoopFactory(input.factoryId, input.pendingLoop);
  return Object.freeze({
    factoryId: input.factoryId,
    currentLoop: input.currentLoop,
    pendingLoop: input.pendingLoop,
    retainedSnapshots: freezeSnapshots(input.retainedSnapshots),
  });
}

export function createFactoryRailLoopLifecycleState(
  factoryId: string,
  currentLoop: FactoryRailLoopPlan | null = null,
): FactoryRailLoopLifecycleState {
  return createLifecycleState({
    factoryId,
    currentLoop,
    pendingLoop: null,
    retainedSnapshots: [],
  });
}

export function retainFactoryRailLoopSnapshot(
  state: FactoryRailLoopLifecycleState,
  snapshotId: string,
): FactoryRailLoopLifecycleState {
  if (state.currentLoop === null) {
    throw new Error(`Factory ${state.factoryId} has no current rail loop to retain`);
  }
  if (
    state.retainedSnapshots.some(
      (snapshot) => snapshot.snapshotId === snapshotId,
    )
  ) {
    throw new Error(`duplicate Factory rail-loop snapshot ID: ${snapshotId}`);
  }
  return createLifecycleState({
    factoryId: state.factoryId,
    currentLoop: state.currentLoop,
    pendingLoop: state.pendingLoop,
    retainedSnapshots: [
      ...state.retainedSnapshots,
      Object.freeze({
        snapshotId,
        cells: state.currentLoop.cells,
      }),
    ],
  });
}

export function stageFactoryRailLoopRegeneration(
  state: FactoryRailLoopLifecycleState,
  nextLoop: FactoryRailLoopPlan,
): FactoryRailLoopLifecycleState {
  assertLoopFactory(state.factoryId, nextLoop);
  if (state.retainedSnapshots.length === 0) {
    return createLifecycleState({
      factoryId: state.factoryId,
      currentLoop: nextLoop,
      pendingLoop: null,
      retainedSnapshots: [],
    });
  }
  return createLifecycleState({
    factoryId: state.factoryId,
    currentLoop: state.currentLoop,
    pendingLoop: nextLoop,
    retainedSnapshots: state.retainedSnapshots,
  });
}

export function releaseFactoryRailLoopSnapshot(
  state: FactoryRailLoopLifecycleState,
  snapshotId: string,
): FactoryRailLoopLifecycleState {
  const retainedSnapshots = state.retainedSnapshots.filter(
    (snapshot) => snapshot.snapshotId !== snapshotId,
  );
  if (retainedSnapshots.length === state.retainedSnapshots.length) {
    throw new Error(`unknown Factory rail-loop snapshot ID: ${snapshotId}`);
  }
  if (retainedSnapshots.length === 0 && state.pendingLoop !== null) {
    return createLifecycleState({
      factoryId: state.factoryId,
      currentLoop: state.pendingLoop,
      pendingLoop: null,
      retainedSnapshots,
    });
  }
  return createLifecycleState({
    factoryId: state.factoryId,
    currentLoop: state.currentLoop,
    pendingLoop: state.pendingLoop,
    retainedSnapshots,
  });
}

function serializedLoop(loop: FactoryRailLoopPlan | null): unknown {
  if (loop === null) return null;
  return {
    factoryId: loop.factoryId,
    targetStructureIds: [...loop.targetStructureIds],
    servicedStructureIds: [...loop.servicedStructureIds],
    cells: [...loop.cells],
    sharedExistingEdgeCount: loop.sharedExistingEdgeCount,
  };
}

export function canonicalFactoryRailLoopLifecycleSerialization(
  state: FactoryRailLoopLifecycleState,
): string {
  return JSON.stringify({
    factoryId: state.factoryId,
    currentLoop: serializedLoop(state.currentLoop),
    pendingLoop: serializedLoop(state.pendingLoop),
    retainedSnapshots: [...state.retainedSnapshots]
      .sort((left, right) => compareIds(left.snapshotId, right.snapshotId))
      .map((snapshot) => ({
        snapshotId: snapshot.snapshotId,
        cells: [...snapshot.cells],
      })),
  });
}

function generatedEdgesForLoop(
  cells: readonly CellId[],
): readonly FactoryGeneratedRailEdge[] {
  const edges = new Map<string, FactoryGeneratedRailEdge>();
  for (let index = 1; index < cells.length; index += 1) {
    const left = cells[index - 1]!;
    const right = cells[index]!;
    if (left === right) continue;
    const a = Math.min(left, right);
    const b = Math.max(left, right);
    edges.set(`${a}:${b}`, Object.freeze({ a, b }));
  }
  return Object.freeze(
    [...edges.values()].sort((left, right) => left.a - right.a || left.b - right.b),
  );
}

export function planFactoryRailLoopsInCanonicalOrder(
  inputs: readonly FactoryRailLoopPlanningInput[],
): readonly FactoryRailLoopPlan[] {
  const ordered = inputs
    .slice()
    .sort((left, right) => compareIds(left.factoryId, right.factoryId));
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1]!.factoryId === ordered[index]!.factoryId) {
      throw new Error(`duplicate Factory rail planning ID: ${ordered[index]!.factoryId}`);
    }
  }

  const committedEdges = new Map<string, FactoryGeneratedRailEdge>();
  const plans: FactoryRailLoopPlan[] = [];
  for (const input of ordered) {
    const plan = planFactoryRailLoop({
      ...input,
      existingGeneratedEdges: Object.freeze([
        ...input.existingGeneratedEdges,
        ...committedEdges.values(),
      ]),
    });
    if (plan === null) continue;
    plans.push(plan);
    for (const edge of generatedEdgesForLoop(plan.cells)) {
      committedEdges.set(`${edge.a}:${edge.b}`, edge);
    }
  }
  return Object.freeze(plans);
}
