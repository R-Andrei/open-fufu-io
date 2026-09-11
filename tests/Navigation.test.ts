import { createNavigation, type NavigationTraversalPolicy } from "../src/simulation/Navigation";
import {
  collectGeneratedRailReferences,
  createRailNetwork,
  planFactoryRailLoop,
  RAIL_CELL_PRESENT,
  RAIL_CONNECTION_BOTTOM,
  RAIL_CONNECTION_LEFT,
  RAIL_CONNECTION_RIGHT,
  RAIL_CONNECTION_TOP,
  shouldRegenerateFactoryRailLoop,
  type FactoryRailLoopPlanningInput,
  type FactoryRailStation,
} from "../src/simulation/RailNetwork";
import { createSimulationMap } from "../src/simulation/SimulationMap";

function syntheticMap(width: number, height: number) {
  return createSimulationMap({
    source: "SYNTHETIC",
    width,
    height,
    terrain: Array.from({ length: width * height }, () => "TEST" as const),
  });
}

function uniformPolicy(weight = 1): NavigationTraversalPolicy {
  return {
    traversalWeight: () => weight,
  };
}

function railNetwork(width: number, height: number, masks: readonly number[]) {
  return createRailNetwork(syntheticMap(width, height), Uint8Array.from(masks));
}

function gridCell(x: number, y: number, width: number): number {
  return y * width + x;
}

function allGridCells(width: number, height: number): readonly number[] {
  return Array.from({ length: width * height }, (_, cellId) => cellId);
}

function gridRow(width: number, y: number): readonly number[] {
  return Array.from({ length: width }, (_, x) => gridCell(x, y, width));
}

function factoryStation(
  id: string,
  x: number,
  y: number,
  width: number,
  type: "CITY" | "PORT" = "CITY",
): FactoryRailStation {
  return Object.freeze({
    id,
    type,
    cellId: gridCell(x, y, width),
    active: true,
    completedLevel: 1,
  });
}

function factoryPlanningInput(
  width: number,
  height: number,
  stations: readonly FactoryRailStation[],
  overrides: Partial<FactoryRailLoopPlanningInput> = {},
): FactoryRailLoopPlanningInput {
  const cells = allGridCells(width, height);
  return {
    factoryId: "factory-a",
    width,
    height,
    outboundPortCellId: gridCell(0, Math.floor(height / 2), width),
    inboundPortCellId: gridCell(width - 1, Math.floor(height / 2), width),
    influenceCellIds: cells,
    railBuildableCellIds: cells,
    stations,
    existingGeneratedEdges: [],
    ...overrides,
  };
}

describe("target-owned deterministic navigation", () => {
  it("returns both endpoints and cumulative traversal weight for a reachable path", () => {
    const navigation = createNavigation(syntheticMap(3, 1));

    expect(navigation.path(0, 2, uniformPolicy(2))).toEqual({
      status: "FOUND",
      path: {
        cells: [0, 1, 2],
        totalWeight: 4,
      },
    });
  });

  it("minimizes cumulative traversal weight rather than hop count", () => {
    const navigation = createNavigation(syntheticMap(3, 2));
    const policy: NavigationTraversalPolicy = {
      traversalWeight(from, to) {
        return from === 1 || to === 1 ? 5 : 1;
      },
    };

    expect(navigation.path(0, 2, policy)).toEqual({
      status: "FOUND",
      path: {
        cells: [0, 3, 4, 5, 2],
        totalWeight: 4,
      },
    });
  });

  it("treats injected blocked transitions as unreachable topology", () => {
    const navigation = createNavigation(syntheticMap(3, 1));
    const policy: NavigationTraversalPolicy = {
      traversalWeight(from, to) {
        if ((from === 1 && to === 2) || (from === 2 && to === 1)) {
          return undefined;
        }
        return 1;
      },
    };

    expect(navigation.path(0, 2, policy)).toEqual({ status: "UNREACHABLE" });
  });

  it("resolves equal-weight routes deterministically through stable CellId ordering", () => {
    const expected = {
      status: "FOUND",
      path: {
        cells: [0, 1, 3],
        totalWeight: 2,
      },
    } as const;

    for (let run = 0; run < 20; run += 1) {
      const navigation = createNavigation(syntheticMap(2, 2));
      expect(navigation.path(0, 3, uniformPolicy())).toEqual(expected);
    }
  });

  it("returns reachable cells ordered by cumulative weight then CellId with an inclusive bound", () => {
    const navigation = createNavigation(syntheticMap(3, 2));

    expect(navigation.reachable(0, 2, uniformPolicy())).toEqual({
      cells: [
        { cellId: 0, totalWeight: 0 },
        { cellId: 1, totalWeight: 1 },
        { cellId: 3, totalWeight: 1 },
        { cellId: 2, totalWeight: 2 },
        { cellId: 4, totalWeight: 2 },
      ],
      truncated: false,
    });

    expect(navigation.reachable(0, 0, uniformPolicy())).toEqual({
      cells: [{ cellId: 0, totalWeight: 0 }],
      truncated: false,
    });
  });

  it("supports asymmetric directed traversal policies", () => {
    const navigation = createNavigation(syntheticMap(2, 1));
    const policy: NavigationTraversalPolicy = {
      traversalWeight(from, to) {
        return from === 0 && to === 1 ? 1 : undefined;
      },
    };

    expect(navigation.path(0, 1, policy)).toEqual({
      status: "FOUND",
      path: { cells: [0, 1], totalWeight: 1 },
    });
    expect(navigation.path(1, 0, policy)).toEqual({ status: "UNREACHABLE" });
  });

  it("returns the origin path with zero weight when start equals destination", () => {
    const navigation = createNavigation(syntheticMap(1, 1));

    expect(navigation.path(0, 0, uniformPolicy())).toEqual({
      status: "FOUND",
      path: { cells: [0], totalWeight: 0 },
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid traversal weight %s",
    (weight) => {
      const navigation = createNavigation(syntheticMap(2, 1));
      expect(() =>
        navigation.path(0, 1, {
          traversalWeight: () => weight,
        }),
      ).toThrow(/traversal weight/i);
    },
  );

  it("rejects invalid cell ids and invalid semantic/work bounds", () => {
    const navigation = createNavigation(syntheticMap(2, 1));

    expect(() => navigation.path(-1, 1, uniformPolicy())).toThrow(/CellId/i);
    expect(() => navigation.path(0, 2, uniformPolicy())).toThrow(/CellId/i);
    expect(() => navigation.reachable(0, -1, uniformPolicy())).toThrow(/maxWeight/i);
    expect(() => navigation.reachable(0, 1.5, uniformPolicy())).toThrow(/maxWeight/i);
    expect(() =>
      navigation.path(0, 1, uniformPolicy(), { maxSettledCells: 0 }),
    ).toThrow(/maxSettledCells/i);
  });

  it("reports computational limits without pretending the destination is unreachable", () => {
    const navigation = createNavigation(syntheticMap(3, 1));

    expect(
      navigation.path(0, 2, uniformPolicy(), { maxSettledCells: 2 }),
    ).toEqual({ status: "LIMIT_REACHED" });

    expect(
      navigation.path(0, 2, uniformPolicy(), { maxSettledCells: 3 }),
    ).toEqual({
      status: "FOUND",
      path: { cells: [0, 1, 2], totalWeight: 2 },
    });

    expect(
      navigation.reachable(0, 10, uniformPolicy(), { maxSettledCells: 2 }),
    ).toEqual({
      cells: [
        { cellId: 0, totalWeight: 0 },
        { cellId: 1, totalWeight: 1 },
      ],
      truncated: true,
    });

    expect(
      navigation.reachable(0, 1, uniformPolicy(), { maxSettledCells: 2 }),
    ).toEqual({
      cells: [
        { cellId: 0, totalWeight: 0 },
        { cellId: 1, totalWeight: 1 },
      ],
      truncated: false,
    });
  });
});

describe("target-owned deterministic rail routing", () => {
  const P = RAIL_CELL_PRESENT;
  const T = RAIL_CONNECTION_TOP;
  const R = RAIL_CONNECTION_RIGHT;
  const B = RAIL_CONNECTION_BOTTOM;
  const L = RAIL_CONNECTION_LEFT;

  it("uses explicit reciprocal rail cells for connectivity, component identity, distance, and path reconstruction", () => {
    const rail = railNetwork(3, 1, [P | R, P | L | R, P | L]);

    expect(rail.isRailCell(0)).toBe(true);
    expect(rail.isRailCell(2)).toBe(true);
    expect(rail.isRailCell(3)).toBe(false);
    expect(rail.neighbors(1)).toEqual([2, 0]);
    expect(rail.areConnected(0, 1)).toBe(true);
    expect(rail.areConnected(0, 2)).toBe(false);
    expect(rail.componentOf(0)).toBe(0);
    expect(rail.componentOf(2)).toBe(0);
    expect(rail.shortestRoute(0, 2)).toEqual({
      status: "FOUND",
      distanceCells: 2,
      cells: [0, 1, 2],
    });
    expect(rail.shortestRoute(2, 0)).toEqual({
      status: "FOUND",
      distanceCells: 2,
      cells: [2, 1, 0],
    });
  });

  it("distinguishes invalid/non-rail endpoints from disconnected rail components", () => {
    const rail = railNetwork(4, 1, [P | R, P | L, 0, P]);

    expect(rail.shortestRoute(0, 3)).toEqual({ status: "DISCONNECTED" });
    expect(rail.shortestRoute(0, 2)).toEqual({
      status: "INVALID_ENDPOINT",
      endpoint: "TO",
    });
    expect(rail.shortestRoute(-1, 4)).toEqual({
      status: "INVALID_ENDPOINT",
      endpoint: "BOTH",
    });
    expect(rail.componentOf(2)).toBeNull();
  });

  it("returns a finite zero-distance route for an isolated rail endpoint routed to itself", () => {
    const rail = railNetwork(1, 1, [P]);

    expect(rail.componentOf(0)).toBe(0);
    expect(rail.shortestRoute(0, 0)).toEqual({
      status: "FOUND",
      distanceCells: 0,
      cells: [0],
    });
  });

  it("resolves equal-cost alternatives by top, right, bottom, left rail order", () => {
    const masks = [P | R | B, P | L | B, P | T | R, P | T | L];
    const expected = {
      status: "FOUND",
      distanceCells: 2,
      cells: [0, 1, 3],
    } as const;

    for (let run = 0; run < 20; run += 1) {
      expect(railNetwork(2, 2, masks).shortestRoute(0, 3)).toEqual(expected);
    }
  });

  it("rejects malformed, non-reciprocal, and out-of-bounds topology", () => {
    expect(() => railNetwork(1, 1, [P | 0x20])).toThrow(/unsupported.*rail/i);
    expect(() => railNetwork(1, 1, [R])).toThrow(/present/i);
    expect(() => railNetwork(1, 1, [P | T])).toThrow(/outside.*map/i);
    expect(() => railNetwork(2, 1, [P | R, P])).toThrow(/reciprocal/i);
  });

  it("handles a dense production-shaped graph without per-query topology rebuilding", () => {
    const width = 256;
    const height = 256;
    const masks = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cellId = y * width + x;
        let mask = P;
        if (y > 0) mask |= T;
        if (x + 1 < width) mask |= R;
        if (y + 1 < height) mask |= B;
        if (x > 0) mask |= L;
        masks[cellId] = mask;
      }
    }
    const rail = createRailNetwork(syntheticMap(width, height), masks);
    const route = rail.shortestRoute(0, masks.length - 1);

    expect(route.status).toBe("FOUND");
    if (route.status !== "FOUND") throw new Error("expected dense route");
    expect(route.distanceCells).toBe((width - 1) + (height - 1));
    expect(route.cells).toHaveLength(route.distanceCells + 1);
    expect(route.cells[0]).toBe(0);
    expect(route.cells.at(-1)).toBe(masks.length - 1);
    expect(rail.componentOf(masks.length - 1)).toBe(0);
  });
});

describe("Factory generated rail-loop planning", () => {
  it("creates no loop for zero eligible stations and includes every eligible station when at most five exist", () => {
    const width = 13;
    const height = 7;
    expect(planFactoryRailLoop(factoryPlanningInput(width, height, []))).toBeNull();

    const result = planFactoryRailLoop(
      factoryPlanningInput(width, height, [
        factoryStation("city-a", 3, 3, width),
        factoryStation("city-b", 6, 3, width, "PORT"),
        factoryStation("city-c", 9, 3, width),
        Object.freeze({
          ...factoryStation("inactive", 4, 4, width),
          active: false,
        }),
        Object.freeze({
          ...factoryStation("unfinished", 8, 4, width),
          completedLevel: undefined,
        }),
      ]),
    );

    expect(result).not.toBeNull();
    expect(result?.targetStructureIds).toEqual(["city-a", "city-b", "city-c"]);
    expect(result?.servicedStructureIds).toEqual(["city-a", "city-b", "city-c"]);
    expect(result?.cells[0]).toBe(gridCell(0, 3, width));
    expect(result?.cells.at(-1)).toBe(gridCell(12, 3, width));
  });

  it("uses exactly five construction targets when more exist while servicing every additional station that lies on the chosen loop", () => {
    const width = 31;
    const height = 11;
    const straightStations = [
      factoryStation("line-a", 5, 5, width),
      factoryStation("line-b", 10, 5, width),
      factoryStation("line-c", 12, 5, width),
      factoryStation("line-d", 15, 5, width),
      factoryStation("line-e", 20, 5, width),
      factoryStation("line-f", 25, 5, width),
    ];
    const far = factoryStation("far-detour", 15, 10, width);
    const result = planFactoryRailLoop(
      factoryPlanningInput(width, height, [...straightStations, far]),
    );

    expect(result).not.toBeNull();
    expect(result?.targetStructureIds).toHaveLength(5);
    expect(result?.targetStructureIds).not.toContain("far-detour");
    expect(result?.servicedStructureIds).toEqual(
      straightStations.map((entry) => entry.id),
    );
    expect(result?.servicedStructureIds).toHaveLength(6);
    expect(result?.servicedStructureIds).not.toContain("far-detour");
  });

  it("breaks equal-cost visit-order ties by canonical structure ID independent of input enumeration", () => {
    const width = 5;
    const height = 5;
    const a = factoryStation("a-station", 2, 1, width);
    const b = factoryStation("b-station", 2, 3, width);
    const base = {
      outboundPortCellId: gridCell(0, 2, width),
      inboundPortCellId: gridCell(4, 2, width),
    };

    const forward = planFactoryRailLoop(
      factoryPlanningInput(width, height, [b, a], base),
    );
    const reversed = planFactoryRailLoop(
      factoryPlanningInput(width, height, [a, b], base),
    );

    expect(forward?.targetStructureIds).toEqual(["a-station", "b-station"]);
    expect(reversed).toEqual(forward);
  });

  it("requires an existing generated rail edge when an intersecting valid loop exists, but falls back to an independent loop when intersection is impossible", () => {
    const width = 9;
    const height = 5;
    const target = factoryStation("center", 4, 2, width);
    const existingEdge = Object.freeze({
      a: gridCell(4, 0, width),
      b: gridCell(5, 0, width),
    });
    const common = {
      outboundPortCellId: gridCell(0, 2, width),
      inboundPortCellId: gridCell(8, 2, width),
      existingGeneratedEdges: [existingEdge],
    };

    const intersecting = planFactoryRailLoop(
      factoryPlanningInput(width, height, [target], common),
    );
    expect(intersecting).not.toBeNull();
    expect(intersecting?.sharedExistingEdgeCount).toBeGreaterThanOrEqual(1);
    const edgeIndex = intersecting?.cells.findIndex(
      (entry, index, cells) =>
        index + 1 < cells.length &&
        ((entry === existingEdge.a && cells[index + 1] === existingEdge.b) ||
          (entry === existingEdge.b && cells[index + 1] === existingEdge.a)),
    );
    expect(edgeIndex).toBeGreaterThanOrEqual(0);

    const disconnectedBuildable = [
      ...gridRow(width, 2),
      existingEdge.a,
      existingEdge.b,
    ];
    const independent = planFactoryRailLoop(
      factoryPlanningInput(width, height, [target], {
        ...common,
        railBuildableCellIds: disconnectedBuildable,
      }),
    );
    expect(independent).not.toBeNull();
    expect(independent?.sharedExistingEdgeCount).toBe(0);
    expect(independent?.cells).toEqual(gridRow(width, 2));
  });

  it("regenerates only for a new off-loop eligible station while current service remains below five", () => {
    expect(
      shouldRegenerateFactoryRailLoop({
        currentLoopCells: [10, 11, 12, 13],
        currentServicedStructureIds: ["a", "b", "c", "d"],
        newStationCellId: 99,
      }),
    ).toBe(true);
    expect(
      shouldRegenerateFactoryRailLoop({
        currentLoopCells: [10, 11, 12, 13],
        currentServicedStructureIds: ["a", "b", "c", "d"],
        newStationCellId: 12,
      }),
    ).toBe(false);
    expect(
      shouldRegenerateFactoryRailLoop({
        currentLoopCells: [10, 11, 12, 13],
        currentServicedStructureIds: ["a", "b", "c", "d", "e"],
        newStationCellId: 99,
      }),
    ).toBe(false);
  });

  it("reference-counts shared physical rail edges across Factory loops and retained in-flight snapshots", () => {
    const references = collectGeneratedRailReferences([
      { contributorId: "factory:a", cells: [0, 1, 2, 3] },
      { contributorId: "factory:b", cells: [4, 1, 2, 5] },
      { contributorId: "train:old-snapshot", cells: [2, 3] },
    ]);

    expect(references).toContainEqual({
      a: 1,
      b: 2,
      referenceCount: 2,
      contributorIds: ["factory:a", "factory:b"],
    });
    expect(references).toContainEqual({
      a: 2,
      b: 3,
      referenceCount: 2,
      contributorIds: ["factory:a", "train:old-snapshot"],
    });
    expect(references.find((edge) => edge.a === 0 && edge.b === 1)?.referenceCount).toBe(1);
  });
});
