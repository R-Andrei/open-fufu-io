import { createNavigation, type NavigationTraversalPolicy } from "../src/simulation/Navigation";
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
