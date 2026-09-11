import {
  mapArtifactHash,
  materializeMapArtifact,
  type MapArtifactFile,
  type MapArtifactPackage,
} from "../src/simulation/MapArtifact";
import {
  canonicalFactoryRailLoopLifecycleSerialization,
  createFactoryRailLoopLifecycleState,
  planFactoryRailLoopsInCanonicalOrder,
  releaseFactoryRailLoopSnapshot,
  retainFactoryRailLoopSnapshot,
  stageFactoryRailLoopRegeneration,
  type FactoryRailLoopPlan,
  type FactoryRailLoopPlanningInput,
} from "../src/simulation/RailNetwork";

const CELL_COUNT = 4_800_000;
const WIDTH = 2_400;
const HEIGHT = 2_000;
const UTF8 = new TextEncoder();

const P = 0x10;
const R = 0x02;
const L = 0x08;

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported canonical test value: ${typeof value}`);
}

function uint32Le(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

function manifestV2() {
  return {
    format: "OPEN_FUFU_MAP",
    formatVersion: 2,
    mapId: "rail-map",
    mapVersion: "1",
    width: WIDTH,
    height: HEIGHT,
    segmentGeneratorVersion: 1,
    segmentCount: 1,
    sections: [
      { id: "terrain", encoding: "TERRAIN_U8_V1", path: "terrain.bin" },
      {
        id: "segmentMembership",
        encoding: "SEGMENT_MEMBERSHIP_U16LE_V1",
        path: "segments/membership.bin",
      },
      {
        id: "segmentMetadata",
        encoding: "SEGMENT_METADATA_U32LE_V1",
        path: "segments/metadata.bin",
      },
      {
        id: "segmentAdjacencyOffsets",
        encoding: "SEGMENT_ADJACENCY_OFFSETS_U32LE_V1",
        path: "segments/adjacency-offsets.bin",
      },
      {
        id: "segmentAdjacency",
        encoding: "SEGMENT_ADJACENCY_U16LE_V1",
        path: "segments/adjacency.bin",
      },
    ],
  } as const;
}

function manifestV3() {
  return {
    ...manifestV2(),
    formatVersion: 3,
    sections: [
      ...manifestV2().sections,
      {
        id: "railTopology",
        encoding: "RAIL_TOPOLOGY_U8_V1",
        path: "rail/topology.bin",
      },
    ],
  } as const;
}

function baseFiles(manifest: unknown): MapArtifactFile[] {
  return [
    { path: "manifest.json", bytes: UTF8.encode(canonicalJson(manifest)) },
    { path: "terrain.bin", bytes: new Uint8Array(CELL_COUNT) },
    {
      path: "segments/membership.bin",
      bytes: new Uint8Array(CELL_COUNT * 2),
    },
    {
      path: "segments/metadata.bin",
      bytes: uint32Le([0, CELL_COUNT, CELL_COUNT, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    },
    { path: "segments/adjacency-offsets.bin", bytes: uint32Le([0, 0]) },
    { path: "segments/adjacency.bin", bytes: new Uint8Array(0) },
  ];
}

function v2Package(): MapArtifactPackage {
  return { files: baseFiles(manifestV2()) };
}

function v3Package(railBytes?: Uint8Array): MapArtifactPackage {
  const rail = railBytes ?? new Uint8Array(CELL_COUNT);
  return {
    files: [
      ...baseFiles(manifestV3()),
      { path: "rail/topology.bin", bytes: rail },
    ],
  };
}

function materialize(packageValue: MapArtifactPackage) {
  return materializeMapArtifact(
    {
      mapId: "rail-map",
      mapVersion: "1",
      mapHash: mapArtifactHash(packageValue.files),
    },
    packageValue,
  );
}

type TestRailMap = ReturnType<typeof materialize> & {
  readonly rail: {
    isRailCell(cellId: number): boolean;
    neighbors(cellId: number): readonly number[];
    componentOf(cellId: number): number | null;
    shortestRoute(from: number, to: number): unknown;
  };
};

function loopPlan(factoryId: string, cells: readonly number[]): FactoryRailLoopPlan {
  return Object.freeze({
    factoryId,
    targetStructureIds: Object.freeze([`${factoryId}-target`]),
    servicedStructureIds: Object.freeze([`${factoryId}-target`]),
    cells: Object.freeze([...cells]),
    sharedExistingEdgeCount: 0,
  });
}

function factoryPlanningInput(options: {
  readonly factoryId: string;
  readonly outboundPortCellId: number;
  readonly inboundPortCellId: number;
  readonly stationId: string;
  readonly stationCellId: number;
}): FactoryRailLoopPlanningInput {
  const width = 9;
  const height = 5;
  const cells = Object.freeze(Array.from({ length: width * height }, (_, cellId) => cellId));
  return Object.freeze({
    factoryId: options.factoryId,
    width,
    height,
    outboundPortCellId: options.outboundPortCellId,
    inboundPortCellId: options.inboundPortCellId,
    influenceCellIds: cells,
    railBuildableCellIds: cells,
    stations: Object.freeze([
      Object.freeze({
        id: options.stationId,
        type: "CITY" as const,
        cellId: options.stationCellId,
        active: true,
        completedLevel: 1,
      }),
    ]),
    existingGeneratedEdges: Object.freeze([]),
  });
}

describe("production rail topology map-artifact source", () => {
  it(
    "materializes V3 rail bytes into the authoritative immutable map substrate",
    () => {
      const railBytes = new Uint8Array(CELL_COUNT);
      railBytes.set([P | R, P | L | R, P | L]);
      const packageValue = v3Package(railBytes);
      const map = materialize(packageValue) as TestRailMap;

      expect(map.formatVersion).toBe(3);
      expect(map.rail.isRailCell(0)).toBe(true);
      expect(map.rail.neighbors(1)).toEqual([2, 0]);
      expect(map.rail.componentOf(2)).toBe(0);
      expect(map.rail.shortestRoute(0, 2)).toEqual({
        status: "FOUND",
        distanceCells: 2,
        cells: [0, 1, 2],
      });

      railBytes.fill(0);
      expect(map.rail.shortestRoute(0, 2)).toEqual({
        status: "FOUND",
        distanceCells: 2,
        cells: [0, 1, 2],
      });
    },
    60_000,
  );

  it(
    "gives pre-rail V2 artifacts an empty rail topology without changing their identity",
    () => {
      const packageValue = v2Package();
      const expectedHash = mapArtifactHash(packageValue.files);
      const map = materialize(packageValue) as TestRailMap;

      expect(map.formatVersion).toBe(2);
      expect(map.mapHash).toBe(expectedHash);
      expect(map.rail.isRailCell(0)).toBe(false);
      expect(map.rail.componentOf(0)).toBeNull();
      expect(map.rail.shortestRoute(0, 0)).toEqual({
        status: "INVALID_ENDPOINT",
        endpoint: "BOTH",
      });
    },
    60_000,
  );

  it("binds rail topology bytes into artifact identity", () => {
    const left = new Uint8Array(CELL_COUNT);
    left.set([P | R, P | L]);
    const right = left.slice();
    right[0] = 0;
    right[1] = 0;

    expect(mapArtifactHash(v3Package(left).files)).not.toBe(
      mapArtifactHash(v3Package(right).files),
    );
  });

  it(
    "rejects malformed V3 rail payloads before state creation",
    () => {
      expect(() => materialize(v3Package(new Uint8Array(CELL_COUNT - 1)))).toThrow(
        /rail.*length/i,
      );

      const nonReciprocal = new Uint8Array(CELL_COUNT);
      nonReciprocal.set([P | R, P]);
      expect(() => materialize(v3Package(nonReciprocal))).toThrow(/reciprocal/i);
    },
    60_000,
  );
});

describe("Factory generated rail lifecycle state", () => {
  it("defers regeneration while old-loop snapshots remain, serializes them canonically, and commits atomically after the final release", () => {
    const oldLoop = loopPlan("factory-a", [18, 19, 20, 21, 22, 23, 24, 25, 26]);
    const nextLoop = loopPlan("factory-a", [18, 9, 10, 11, 12, 13, 14, 15, 16, 17, 26]);

    const immediate = stageFactoryRailLoopRegeneration(
      createFactoryRailLoopLifecycleState("factory-a", oldLoop),
      nextLoop,
    );
    expect(immediate.currentLoop).toEqual(nextLoop);
    expect(immediate.pendingLoop).toBeNull();

    let state = createFactoryRailLoopLifecycleState("factory-a", oldLoop);
    state = retainFactoryRailLoopSnapshot(state, "train-z");
    state = retainFactoryRailLoopSnapshot(state, "train-a");
    state = stageFactoryRailLoopRegeneration(state, nextLoop);

    expect(state.currentLoop).toEqual(oldLoop);
    expect(state.pendingLoop).toEqual(nextLoop);
    expect(state.retainedSnapshots.map((snapshot) => snapshot.snapshotId)).toEqual([
      "train-a",
      "train-z",
    ]);
    expect(state.retainedSnapshots.every((snapshot) => snapshot.cells === oldLoop.cells)).toBe(
      true,
    );

    let reordered = createFactoryRailLoopLifecycleState("factory-a", oldLoop);
    reordered = retainFactoryRailLoopSnapshot(reordered, "train-a");
    reordered = retainFactoryRailLoopSnapshot(reordered, "train-z");
    reordered = stageFactoryRailLoopRegeneration(reordered, nextLoop);
    expect(canonicalFactoryRailLoopLifecycleSerialization(reordered)).toBe(
      canonicalFactoryRailLoopLifecycleSerialization(state),
    );

    state = releaseFactoryRailLoopSnapshot(state, "train-a");
    expect(state.currentLoop).toEqual(oldLoop);
    expect(state.pendingLoop).toEqual(nextLoop);
    expect(state.retainedSnapshots.map((snapshot) => snapshot.snapshotId)).toEqual([
      "train-z",
    ]);

    state = releaseFactoryRailLoopSnapshot(state, "train-z");
    expect(state.currentLoop).toEqual(nextLoop);
    expect(state.pendingLoop).toBeNull();
    expect(state.retainedSnapshots).toEqual([]);
  });

  it("plans simultaneous Factory loops by ascending persistent ID so later Factories see earlier generated rail independent of input enumeration", () => {
    const factoryA = factoryPlanningInput({
      factoryId: "factory-a",
      outboundPortCellId: 18,
      inboundPortCellId: 26,
      stationId: "city-a",
      stationCellId: 22,
    });
    const factoryB = factoryPlanningInput({
      factoryId: "factory-b",
      outboundPortCellId: 4,
      inboundPortCellId: 40,
      stationId: "city-b",
      stationCellId: 13,
    });

    const reversedInput = planFactoryRailLoopsInCanonicalOrder([factoryB, factoryA]);
    const forwardInput = planFactoryRailLoopsInCanonicalOrder([factoryA, factoryB]);

    expect(reversedInput).toEqual(forwardInput);
    expect(reversedInput.map((plan) => plan.factoryId)).toEqual([
      "factory-a",
      "factory-b",
    ]);
    expect(reversedInput[0]?.sharedExistingEdgeCount).toBe(0);
    expect(reversedInput[1]?.sharedExistingEdgeCount).toBeGreaterThan(0);
  });
});