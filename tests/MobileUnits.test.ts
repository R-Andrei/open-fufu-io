import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import {
  advanceMobileUnit,
  advanceMobileUnits,
  assignMobileUnitRoute,
  createMobileUnit,
  createMobileUnitSpatialIndex,
  materializeMobileUnitCollection,
  removeMobileUnit,
  snapshotMobileUnitForProjection,
  type MobileUnitCollectionState,
  type MobileUnitState,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createSimulationMap } from "../src/simulation/SimulationMap";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function syntheticMap(width = 4, height = 2) {
  return createSimulationMap({
    source: "SYNTHETIC",
    width,
    height,
    terrain: Array.from({ length: width * height }, () => "TEST" as const),
  });
}

function emptyCollection(): MobileUnitCollectionState {
  return Object.freeze({
    mobileUnits: Object.freeze([]),
    nextMobileUnitOrdinal: 0,
  });
}

function createBaseMatch(seed: string) {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 4,
      height: 2,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

describe("target mobile-unit runtime foundation", () => {
  it("reserves authoritative empty mobile-unit state and identity allocation state", () => {
    const state = createBaseMatch("mobile-unit-empty-state");

    expect(state.mobileUnits).toEqual([]);
    expect(state.nextMobileUnitOrdinal).toBe(0);

    const serialized = JSON.parse(
      canonicalMatchStateSerialization(state),
    ) as Record<string, unknown>;
    expect(serialized.mobileUnits).toEqual([]);
    expect(serialized.nextMobileUnitOrdinal).toBe(0);
  });

  it("allocates deterministic non-reused identities and materializes units in stable identity order", () => {
    const map = syntheticMap();
    const owners = ["alpha", "beta"] as const;

    const firstRunA = createMobileUnit(map, owners, emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const firstRunB = createMobileUnit(map, owners, firstRunA, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 4,
    });

    const secondRunA = createMobileUnit(map, owners, emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const secondRunB = createMobileUnit(map, owners, secondRunA, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 4,
    });

    expect(firstRunA.unit.id).toBe(secondRunA.unit.id);
    expect(firstRunB.unit.id).toBe(secondRunB.unit.id);
    expect(firstRunA.unit.id).not.toBe(firstRunB.unit.id);
    expect(firstRunB.nextMobileUnitOrdinal).toBe(2);

    const afterRemoval = removeMobileUnit(firstRunB, firstRunA.unit.id);
    expect(afterRemoval.mobileUnits.map((unit) => unit.id)).toEqual([
      firstRunB.unit.id,
    ]);
    expect(afterRemoval.nextMobileUnitOrdinal).toBe(2);

    const afterRecreate = createMobileUnit(map, owners, afterRemoval, {
      ownerId: "alpha",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 1,
    });
    expect(afterRecreate.unit.id).not.toBe(firstRunA.unit.id);
    expect(afterRecreate.unit.id).not.toBe(firstRunB.unit.id);
    expect(afterRecreate.nextMobileUnitOrdinal).toBe(3);

    const reversed = materializeMobileUnitCollection(map, owners, {
      mobileUnits: [...afterRecreate.mobileUnits].reverse(),
      nextMobileUnitOrdinal: afterRecreate.nextMobileUnitOrdinal,
    });
    expect(reversed.mobileUnits.map((unit) => unit.id)).toEqual(
      afterRecreate.mobileUnits.map((unit) => unit.id),
    );
    expect(Object.isFrozen(reversed)).toBe(true);
    expect(Object.isFrozen(reversed.mobileUnits)).toBe(true);
    expect(reversed.mobileUnits.every(Object.isFrozen)).toBe(true);
  });

  it("rejects malformed creation, allocator, identity, and route state at target-owned boundaries", () => {
    const map = syntheticMap(3, 2);
    const owners = ["alpha", "beta"] as const;
    const created = createMobileUnit(map, owners, emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });

    expect(() =>
      createMobileUnit(map, owners, created, {
        ownerId: "missing",
        type: "TANK",
        movementClass: "TANK",
        cellId: 0,
      }),
    ).toThrow(/owner/i);
    expect(() =>
      createMobileUnit(map, owners, created, {
        ownerId: "alpha",
        type: "INVALID" as never,
        movementClass: "TANK",
        cellId: 0,
      }),
    ).toThrow(/unit type/i);
    expect(() =>
      createMobileUnit(map, owners, created, {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "INVALID" as never,
        cellId: 0,
      }),
    ).toThrow(/movement class/i);
    expect(() =>
      createMobileUnit(map, owners, created, {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId: 6,
      }),
    ).toThrow(/CellId/i);

    expect(() =>
      assignMobileUnitRoute(map, created.unit, {
        cells: [1, 2],
        edgeWeights: [10],
      }),
    ).toThrow(/current cell/i);
    expect(() =>
      assignMobileUnitRoute(map, created.unit, {
        cells: [0, 2],
        edgeWeights: [10],
      }),
    ).toThrow(/cardinal/i);
    expect(() =>
      assignMobileUnitRoute(map, created.unit, {
        cells: [0, 1],
        edgeWeights: [0],
      }),
    ).toThrow(/edge weight/i);
    expect(() =>
      assignMobileUnitRoute(map, created.unit, {
        cells: [0, 1],
        edgeWeights: [],
      }),
    ).toThrow(/edge weight/i);

    expect(() =>
      materializeMobileUnitCollection(map, owners, {
        mobileUnits: [created.unit, created.unit],
        nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      }),
    ).toThrow(/duplicate/i);
    expect(() =>
      materializeMobileUnitCollection(map, owners, {
        mobileUnits: created.mobileUnits,
        nextMobileUnitOrdinal: 0,
      }),
    ).toThrow(/ordinal/i);

    const malformedRoute = {
      ...created.unit,
      route: {
        destinationCellId: 1,
        cells: [0, 1],
        edgeWeights: [10],
        nextCellIndex: 1,
        edgeProgress: 10,
      },
    } as MobileUnitState;
    expect(() =>
      materializeMobileUnitCollection(map, owners, {
        mobileUnits: [malformedRoute],
        nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      }),
    ).toThrow(/progress/i);
  });

  it("rejects sparse authoritative mobile-unit and route arrays", () => {
    const map = syntheticMap(3, 1);
    const sparseUnits = new Array<MobileUnitState>(1);

    expect(() =>
      materializeMobileUnitCollection(map, ["alpha"], {
        mobileUnits: sparseUnits,
        nextMobileUnitOrdinal: 1,
      }),
    ).toThrow(/mobileUnits|sparse|dense/i);

    const created = createMobileUnit(map, ["alpha"], emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const sparseCells = new Array<number>(3);
    sparseCells[0] = 0;
    sparseCells[2] = 2;
    expect(() =>
      assignMobileUnitRoute(map, created.unit, {
        cells: sparseCells,
        edgeWeights: [10, 10],
      }),
    ).toThrow(/cells|sparse|dense/i);
    expect(() =>
      assignMobileUnitRoute(map, created.unit, {
        cells: [0, 1],
        edgeWeights: new Array<number>(1),
      }),
    ).toThrow(/edgeWeights|sparse|dense/i);
  });

  it("strips undeclared state even from already-frozen unit and route objects", () => {
    const map = syntheticMap(3, 1);
    const owners = ["alpha"] as const;
    const created = createMobileUnit(map, owners, emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const routed = assignMobileUnitRoute(map, created.unit, {
      cells: [0, 1, 2],
      edgeWeights: [10, 10],
    });
    const pollutedRoute = Object.freeze({
      ...routed.route!,
      shadowProgress: 999,
    });
    const pollutedUnit = Object.freeze({
      ...routed,
      route: pollutedRoute,
      hiddenHealth: 999,
    }) as MobileUnitState;

    const normalized = materializeMobileUnitCollection(map, owners, {
      mobileUnits: [pollutedUnit],
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    });
    const normalizedUnit = normalized.mobileUnits[0]!;

    expect(normalizedUnit).not.toBe(pollutedUnit);
    expect("hiddenHealth" in normalizedUnit).toBe(false);
    expect(normalizedUnit.route).not.toBe(pollutedRoute);
    expect("shadowProgress" in normalizedUnit.route!).toBe(false);
  });

  it("advances exact integer fixed-point work through fractional and multi-edge movement without float accumulation", () => {
    const map = syntheticMap(4, 1);
    const created = createMobileUnit(map, ["alpha"], emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const routed = assignMobileUnitRoute(map, created.unit, {
      cells: [0, 1, 2, 3],
      edgeWeights: [10, 10, 10],
    });

    const halfEdge = advanceMobileUnit(routed, 5);
    expect(halfEdge.unit.cellId).toBe(0);
    expect(halfEdge.unit.route).toMatchObject({
      nextCellIndex: 1,
      edgeProgress: 5,
    });
    expect(halfEdge.unusedWork).toBe(0);

    const multiEdge = advanceMobileUnit(halfEdge.unit, 20);
    expect(multiEdge.unit.cellId).toBe(2);
    expect(multiEdge.unit.route).toMatchObject({
      nextCellIndex: 3,
      edgeProgress: 5,
    });

    const oneBeforeArrival = advanceMobileUnit(multiEdge.unit, 4);
    expect(oneBeforeArrival.unit.cellId).toBe(2);
    expect(oneBeforeArrival.unit.route).toMatchObject({
      nextCellIndex: 3,
      edgeProgress: 9,
    });
    expect(oneBeforeArrival.unusedWork).toBe(0);

    const exactArrival = advanceMobileUnit(multiEdge.unit, 5);
    expect(exactArrival.unit.cellId).toBe(3);
    expect(exactArrival.unit.route).toBeUndefined();
    expect(exactArrival.unusedWork).toBe(0);

    const oneAfterArrival = advanceMobileUnit(multiEdge.unit, 6);
    expect(oneAfterArrival.unit.cellId).toBe(3);
    expect(oneAfterArrival.unit.route).toBeUndefined();
    expect(oneAfterArrival.unusedWork).toBe(1);

    const overshoot = advanceMobileUnit(routed, 35);
    expect(overshoot.unit.cellId).toBe(3);
    expect(overshoot.unit.route).toBeUndefined();
    expect(overshoot.unusedWork).toBe(5);

    expect(() => advanceMobileUnit(routed, -1)).toThrow(/movement work/i);
    expect(() => advanceMobileUnit(routed, 1.5)).toThrow(/movement work/i);
    expect(() => advanceMobileUnit(routed, Number.NaN)).toThrow(/movement work/i);
    expect(() => advanceMobileUnit(routed, Number.POSITIVE_INFINITY)).toThrow(
      /movement work/i,
    );
    expect(() => advanceMobileUnit(routed, -0)).toThrow(/movement work/i);
  });

  it("advances simultaneous units in stable identity order independent of input enumeration", () => {
    const map = syntheticMap();
    const first = createMobileUnit(map, ["alpha", "beta"], emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const second = createMobileUnit(map, ["alpha", "beta"], first, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 4,
    });
    const tank = assignMobileUnitRoute(map, first.unit, {
      cells: [0, 1, 2, 3],
      edgeWeights: [10, 10, 10],
    });
    const train = assignMobileUnitRoute(map, second.unit, {
      cells: [4, 5, 6, 7],
      edgeWeights: [10, 10, 10],
    });
    const work = {
      [tank.id]: 15,
      [train.id]: 25,
    } as const;

    const forward = advanceMobileUnits([tank, train], work);
    const reversed = advanceMobileUnits([train, tank], work);

    expect(reversed).toEqual(forward);
    expect(forward.map((unit) => unit.id)).toEqual([tank.id, train.id]);
    expect(forward.map((unit) => unit.cellId)).toEqual([1, 6]);
    expect(forward.map((unit) => unit.route?.edgeProgress)).toEqual([5, 5]);
  });

  it("maintains deterministic spatial queries and returns copy-safe projection sources", () => {
    const map = syntheticMap(3, 1);
    const first = createMobileUnit(map, ["alpha", "beta"], emptyCollection(), {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const second = createMobileUnit(map, ["alpha", "beta"], first, {
      ownerId: "alpha",
      type: "HEAVY_ARTILLERY",
      movementClass: "HEAVY_ARTILLERY",
      cellId: 0,
    });
    const indexBefore = createMobileUnitSpatialIndex(second.mobileUnits);

    expect(indexBefore.atCell(0).map((unit) => unit.id)).toEqual(
      second.mobileUnits.map((unit) => unit.id),
    );
    expect(indexBefore.ownedBy("alpha").map((unit) => unit.id)).toEqual(
      second.mobileUnits.map((unit) => unit.id),
    );
    expect(indexBefore.get(first.unit.id)).toBe(second.mobileUnits[0]);

    const routed = assignMobileUnitRoute(map, first.unit, {
      cells: [0, 1],
      edgeWeights: [10],
    });
    const moved = advanceMobileUnit(routed, 10).unit;
    const afterMovement = materializeMobileUnitCollection(
      map,
      ["alpha", "beta"],
      {
        mobileUnits: [second.unit, moved],
        nextMobileUnitOrdinal: second.nextMobileUnitOrdinal,
      },
    );
    const indexAfter = createMobileUnitSpatialIndex(afterMovement.mobileUnits);

    expect(indexAfter.atCell(0).map((unit) => unit.id)).toEqual([second.unit.id]);
    expect(indexAfter.atCell(1).map((unit) => unit.id)).toEqual([first.unit.id]);
    expect(indexBefore.atCell(0)).toHaveLength(2);

    const afterRemoval = removeMobileUnit(afterMovement, first.unit.id);
    const indexAfterRemoval = createMobileUnitSpatialIndex(afterRemoval.mobileUnits);
    expect(indexAfterRemoval.get(first.unit.id)).toBeUndefined();
    expect(indexAfterRemoval.atCell(1)).toEqual([]);
    expect(indexAfterRemoval.atCell(0).map((unit) => unit.id)).toEqual([
      second.unit.id,
    ]);

    const projected = snapshotMobileUnitForProjection(routed);
    expect(projected).toEqual({
      id: routed.id,
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
      movementDestinationCellId: 1,
    });
    expect(projected).not.toBe(routed);
    expect(Object.isFrozen(projected)).toBe(true);
    expect("route" in projected).toBe(false);
  });

  it("serializes in-flight state canonically, restores it, preserves allocator state, and makes movement fingerprint-visible", () => {
    const base = createBaseMatch("mobile-unit-serialization");
    const owners = base.factions.map((faction) => faction.id);
    const first = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
    });
    const second = createMobileUnit(base.map, owners, first, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 4,
    });
    const routed = assignMobileUnitRoute(base.map, first.unit, {
      cells: [0, 1, 2],
      edgeWeights: [10, 20],
    });
    const partial = advanceMobileUnit(routed, 5).unit;

    const forward = createProspectiveMatchState(base, {
      mobileUnits: [partial, second.unit],
      nextMobileUnitOrdinal: second.nextMobileUnitOrdinal,
    });
    const reversed = createProspectiveMatchState(base, {
      mobileUnits: [second.unit, partial],
      nextMobileUnitOrdinal: second.nextMobileUnitOrdinal,
    });

    const forwardSerialization = canonicalMatchStateSerialization(forward);
    expect(canonicalMatchStateSerialization(reversed)).toBe(forwardSerialization);

    const serialized = JSON.parse(forwardSerialization) as {
      mobileUnits: Array<Record<string, unknown>>;
      nextMobileUnitOrdinal: number;
    };
    expect(serialized.nextMobileUnitOrdinal).toBe(2);
    expect(serialized.mobileUnits[0]).toMatchObject({
      id: partial.id,
      ownerId: "alpha",
      type: "TANK",
      movementClass: "TANK",
      cellId: 0,
      route: {
        destinationCellId: 2,
        cells: [0, 1, 2],
        edgeWeights: [10, 20],
        nextCellIndex: 1,
        edgeProgress: 5,
      },
    });

    const restored = createProspectiveMatchState(base, {
      mobileUnits: serialized.mobileUnits as unknown as MobileUnitState[],
      nextMobileUnitOrdinal: serialized.nextMobileUnitOrdinal,
    });
    expect(canonicalMatchStateSerialization(restored)).toBe(forwardSerialization);
    expect(restored.mobileUnits).toEqual(forward.mobileUnits);
    expect(restored.mobileUnits[0]).not.toBe(forward.mobileUnits[0]);
    expect(Object.isFrozen(restored.mobileUnits[0]?.route?.cells)).toBe(true);

    const moved = advanceMobileUnit(partial, 5).unit;
    const movedState = createProspectiveMatchState(base, {
      mobileUnits: [moved, second.unit],
      nextMobileUnitOrdinal: second.nextMobileUnitOrdinal,
    });
    expect(canonicalMatchStateSerialization(movedState)).not.toBe(
      forwardSerialization,
    );

    const removed = removeMobileUnit(forward, partial.id);
    expect(removed.nextMobileUnitOrdinal).toBe(2);
    const removedState = createProspectiveMatchState(base, removed);
    expect(canonicalMatchStateSerialization(removedState)).not.toBe(
      forwardSerialization,
    );
  });
});