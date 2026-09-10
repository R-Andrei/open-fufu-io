import { createNavigation, type NavigationTraversalPolicy } from "../src/simulation/Navigation";
import {
  createRailNetwork,
  RAIL_CELL_PRESENT,
  RAIL_CONNECTION_BOTTOM,
  RAIL_CONNECTION_LEFT,
  RAIL_CONNECTION_RIGHT,
  RAIL_CONNECTION_TOP,
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
