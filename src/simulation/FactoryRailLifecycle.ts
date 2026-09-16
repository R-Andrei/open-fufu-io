import type {
  CellId,
} from "../core/controller/ControllerApi";
import {
  planFactoryRailLoop,
  type FactoryGeneratedRailEdge,
  type FactoryRailLoopPlan,
  type FactoryRailLoopPlanningInput,
  type FactoryRailStation,
} from "./RailNetwork";

export interface FactoryRailStationInterfaceState {
  readonly structureId: string;
  readonly cellId: CellId;
}

type FactoryRailLoopPlanWithInterfaces = FactoryRailLoopPlan &
  Readonly<{
    stationInterfaces?: readonly FactoryRailStationInterfaceState[];
  }>;

export interface FactoryRailLoopSnapshotState {
  readonly snapshotId: string;
  readonly cells: readonly CellId[];
  readonly stationInterfaces?: readonly FactoryRailStationInterfaceState[];
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

function compareIdSequences(
  left: readonly string[],
  right: readonly string[],
): number {
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const compared = compareIds(left[index]!, right[index]!);
    if (compared !== 0) return compared;
  }
  return left.length - right.length;
}

function freezeStationInterfaces(
  entries: readonly FactoryRailStationInterfaceState[] | undefined,
): readonly FactoryRailStationInterfaceState[] | undefined {
  if (entries === undefined) return undefined;
  return Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        structureId: entry.structureId,
        cellId: entry.cellId,
      }),
    ),
  );
}

function loopStationInterfaces(
  loop: FactoryRailLoopPlan,
): readonly FactoryRailStationInterfaceState[] | undefined {
  return (loop as FactoryRailLoopPlanWithInterfaces).stationInterfaces;
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
      .map((snapshot) => {
        const stationInterfaces = freezeStationInterfaces(snapshot.stationInterfaces);
        return Object.freeze({
          snapshotId: snapshot.snapshotId,
          cells: snapshot.cells,
          ...(stationInterfaces === undefined ? {} : { stationInterfaces }),
        });
      }),
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
  const stationInterfaces = freezeStationInterfaces(
    loopStationInterfaces(state.currentLoop),
  );
  return createLifecycleState({
    factoryId: state.factoryId,
    currentLoop: state.currentLoop,
    pendingLoop: state.pendingLoop,
    retainedSnapshots: [
      ...state.retainedSnapshots,
      Object.freeze({
        snapshotId,
        cells: state.currentLoop.cells,
        ...(stationInterfaces === undefined ? {} : { stationInterfaces }),
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

function serializedStationInterfaces(
  entries: readonly FactoryRailStationInterfaceState[] | undefined,
): unknown {
  if (entries === undefined) return undefined;
  return entries.map((entry) => ({
    structureId: entry.structureId,
    cellId: entry.cellId,
  }));
}

function serializedLoop(loop: FactoryRailLoopPlan | null): unknown {
  if (loop === null) return null;
  const stationInterfaces = serializedStationInterfaces(loopStationInterfaces(loop));
  return {
    factoryId: loop.factoryId,
    targetStructureIds: [...loop.targetStructureIds],
    servicedStructureIds: [...loop.servicedStructureIds],
    cells: [...loop.cells],
    sharedExistingEdgeCount: loop.sharedExistingEdgeCount,
    ...(stationInterfaces === undefined ? {} : { stationInterfaces }),
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
      .map((snapshot) => {
        const stationInterfaces = serializedStationInterfaces(snapshot.stationInterfaces);
        return {
          snapshotId: snapshot.snapshotId,
          cells: [...snapshot.cells],
          ...(stationInterfaces === undefined ? {} : { stationInterfaces }),
        };
      }),
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

type InterfacePlannedLoop = Readonly<{
  plan: FactoryRailLoopPlan;
  stationInterfaces: readonly FactoryRailStationInterfaceState[];
}>;

function eligibleFactoryStations(
  input: FactoryRailLoopPlanningInput,
): readonly FactoryRailStation[] {
  const influenceCells = new Set(input.influenceCellIds);
  return Object.freeze(
    input.stations
      .filter(
        (station) =>
          station.active &&
          station.completedLevel !== undefined &&
          Number.isSafeInteger(station.completedLevel) &&
          station.completedLevel >= 1 &&
          influenceCells.has(station.cellId),
      )
      .slice()
      .sort((left, right) => compareIds(left.id, right.id)),
  );
}

function canonicalAdjacentCells(
  width: number,
  height: number,
  cellId: CellId,
): readonly CellId[] {
  const x = cellId % width;
  const y = Math.floor(cellId / width);
  const result: CellId[] = [];
  if (y > 0) result.push(cellId - width);
  if (x + 1 < width) result.push(cellId + 1);
  if (y + 1 < height) result.push(cellId + width);
  if (x > 0) result.push(cellId - 1);
  return Object.freeze(result);
}

function enumerateSelections<T>(
  values: readonly T[],
  count: number,
  visitor: (selection: readonly T[]) => void,
): void {
  const selection: T[] = [];
  const visit = (startIndex: number): void => {
    if (selection.length === count) {
      visitor(selection.slice());
      return;
    }
    const remaining = count - selection.length;
    for (let index = startIndex; index <= values.length - remaining; index += 1) {
      selection.push(values[index]!);
      visit(index + 1);
      selection.pop();
    }
  };
  visit(0);
}

function routeDirectionKey(cells: readonly CellId[], width: number): string {
  let key = "";
  for (let index = 1; index < cells.length; index += 1) {
    const previous = cells[index - 1]!;
    const current = cells[index]!;
    if (current === previous - width) key += "0";
    else if (current === previous + 1) key += "1";
    else if (current === previous + width) key += "2";
    else if (current === previous - 1) key += "3";
    else throw new Error("Factory rail loop contains a non-cardinal transition");
  }
  return key;
}

function compareInterfacePlans(
  left: FactoryRailLoopPlan,
  right: FactoryRailLoopPlan,
  width: number,
): number {
  const leftSharesRail = left.sharedExistingEdgeCount > 0;
  const rightSharesRail = right.sharedExistingEdgeCount > 0;
  if (leftSharesRail !== rightSharesRail) return leftSharesRail ? -1 : 1;

  const leftDistance = left.cells.length - 1;
  const rightDistance = right.cells.length - 1;
  if (leftDistance !== rightDistance) return leftDistance - rightDistance;
  if (left.sharedExistingEdgeCount !== right.sharedExistingEdgeCount) {
    return right.sharedExistingEdgeCount - left.sharedExistingEdgeCount;
  }
  const targetsCompared = compareIdSequences(
    left.targetStructureIds,
    right.targetStructureIds,
  );
  if (targetsCompared !== 0) return targetsCompared;
  return compareIds(
    routeDirectionKey(left.cells, width),
    routeDirectionKey(right.cells, width),
  );
}

function routeStationInterfaces(
  input: FactoryRailLoopPlanningInput,
  eligibleStations: readonly FactoryRailStation[],
  pathableCells: ReadonlySet<CellId>,
  routeCells: readonly CellId[],
): readonly FactoryRailStationInterfaceState[] {
  const firstRouteIndex = new Map<CellId, number>();
  for (let index = 0; index < routeCells.length; index += 1) {
    if (!firstRouteIndex.has(routeCells[index]!)) {
      firstRouteIndex.set(routeCells[index]!, index);
    }
  }

  const entries: Array<FactoryRailStationInterfaceState & { routeIndex: number }> = [];
  for (const station of eligibleStations) {
    let bestCellId: CellId | undefined;
    let bestRouteIndex = Number.POSITIVE_INFINITY;
    for (const candidateCellId of canonicalAdjacentCells(
      input.width,
      input.height,
      station.cellId,
    )) {
      if (!pathableCells.has(candidateCellId)) continue;
      const routeIndex = firstRouteIndex.get(candidateCellId);
      if (routeIndex === undefined || routeIndex >= bestRouteIndex) continue;
      bestCellId = candidateCellId;
      bestRouteIndex = routeIndex;
    }
    if (bestCellId === undefined) continue;
    entries.push({
      structureId: station.id,
      cellId: bestCellId,
      routeIndex: bestRouteIndex,
    });
  }

  entries.sort(
    (left, right) =>
      left.routeIndex - right.routeIndex || compareIds(left.structureId, right.structureId),
  );
  return Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        structureId: entry.structureId,
        cellId: entry.cellId,
      }),
    ),
  );
}

function planFactoryRailLoopWithInterfaces(
  input: FactoryRailLoopPlanningInput,
): FactoryRailLoopPlan | null {
  const eligibleStations = eligibleFactoryStations(input);
  if (eligibleStations.length === 0) return null;

  const occupiedStationCells = new Set(input.stations.map((station) => station.cellId));
  const pathableCells = new Set(
    input.railBuildableCellIds.filter((cellId) => !occupiedStationCells.has(cellId)),
  );
  const interfaceCandidates = new Map<string, readonly CellId[]>();
  for (const station of eligibleStations) {
    interfaceCandidates.set(
      station.id,
      canonicalAdjacentCells(input.width, input.height, station.cellId).filter((cellId) =>
        pathableCells.has(cellId),
      ),
    );
  }

  const targetCount = Math.min(5, eligibleStations.length);
  let best: InterfacePlannedLoop | undefined;

  enumerateSelections(eligibleStations, targetCount, (selectedStations) => {
    const assignments = new Map<string, CellId>();
    const visitInterfaces = (stationIndex: number): void => {
      if (stationIndex === selectedStations.length) {
        const proxyStations = selectedStations.map((station) =>
          Object.freeze({
            ...station,
            cellId: assignments.get(station.id)!,
          }),
        );
        const selectedInterfaceCells = proxyStations.map((station) => station.cellId);
        const plan = planFactoryRailLoop({
          ...input,
          influenceCellIds: Object.freeze([
            ...input.influenceCellIds,
            ...selectedInterfaceCells,
          ]),
          railBuildableCellIds: Object.freeze([...pathableCells]),
          stations: Object.freeze(proxyStations),
        });
        if (plan === null) return;

        const stationInterfaces = routeStationInterfaces(
          input,
          eligibleStations,
          pathableCells,
          plan.cells,
        );
        const servicedStructureIds = Object.freeze(
          stationInterfaces.map((entry) => entry.structureId),
        );
        const planWithInterfaces = Object.freeze({
          ...plan,
          servicedStructureIds,
          stationInterfaces,
        }) as FactoryRailLoopPlan;
        const candidate: InterfacePlannedLoop = Object.freeze({
          plan: planWithInterfaces,
          stationInterfaces,
        });
        if (
          best === undefined ||
          compareInterfacePlans(candidate.plan, best.plan, input.width) < 0
        ) {
          best = candidate;
        }
        return;
      }

      const station = selectedStations[stationIndex]!;
      const candidates = interfaceCandidates.get(station.id) ?? [];
      for (const cellId of candidates) {
        assignments.set(station.id, cellId);
        visitInterfaces(stationIndex + 1);
      }
      assignments.delete(station.id);
    };

    visitInterfaces(0);
  });

  return best?.plan ?? null;
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
    const plan = planFactoryRailLoopWithInterfaces({
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
