import {
  mapArtifactHash,
  materializeMapArtifact,
  type MapArtifactFile,
  type MapArtifactPackage,
} from "../src/simulation/MapArtifact";

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