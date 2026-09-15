import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createInitialMatchState, createProspectiveMatchState } from "../src/simulation/MatchState";
import {
  advanceMobileUnits,
  assignMobileUnitRoute,
  createMobileUnit,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import { planTankPursuitRoute } from "../src/simulation/TankTargeting";
import { tankNavigationRoute, tankStrategicNavigationRoute } from "../src/simulation/Tanks";

function baseState(seed: string) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(createMicroSimulationSpec({
    seed,
    width: 5,
    height: 2,
    terrain: Array.from({ length: 10 }, () => "PLAINS" as const),
    initialOwners: Array.from({ length: 10 }, () => "alpha"),
    factions: [{ id: "alpha", rules }, { id: "beta", rules }],
  }));
}

describe("physical occupancy movement", () => {
  it("routes normal and strategic Tank navigation around current physical occupiers", () => {
    const base = baseState("occupancy-tank-navigation");
    const owners = base.factions.map((f) => f.id);
    const mover = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const blocker = createMobileUnit(base.map, owners, mover, {
      ownerId: "beta", type: "TRAIN", movementClass: "RAIL", cellId: 1,
    });
    const occupied = createProspectiveMatchState(base, {
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
    });

    const normal = tankNavigationRoute(occupied, "alpha", "TANK", 0, 4);
    expect(normal.status).toBe("FOUND");
    if (normal.status === "FOUND") expect(normal.route.cells).not.toContain(1);

    const strategic = tankStrategicNavigationRoute(occupied, "alpha", "TANK", 0, 4);
    expect(strategic.status).not.toBe("LIMIT_REACHED");
    if (strategic.status !== "LIMIT_REACHED") {
      expect(strategic.route.cells).not.toContain(1);
    }
  });

  it("routes autonomous Tank pursuit around current physical occupiers", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const base = createInitialMatchState(createMicroSimulationSpec({
      seed: "occupancy-tank-pursuit",
      width: 40,
      height: 2,
      terrain: Array.from({ length: 80 }, () => "PLAINS" as const),
      initialOwners: Array.from({ length: 80 }, () => "alpha"),
      factions: [{ id: "alpha", rules }, { id: "beta", rules }],
    }));
    const owners = base.factions.map((f) => f.id);
    const mover = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const blocker = createMobileUnit(base.map, owners, mover, {
      ownerId: "beta", type: "TRAIN", movementClass: "RAIL", cellId: 1,
    });
    const target = createMobileUnit(base.map, owners, blocker, {
      ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 39,
    });
    const occupied = createProspectiveMatchState(base, {
      mobileUnits: target.mobileUnits,
      nextMobileUnitOrdinal: target.nextMobileUnitOrdinal,
    });

    const route = planTankPursuitRoute(
      occupied,
      {
        ownerId: "alpha",
        chassisType: "TANK",
        currentCellId: 0,
        operatingAnchorCellId: 0,
      },
      { targetClass: "TANK_CHASSIS", unitId: target.unit.id },
    );

    expect(route).toBeDefined();
    expect(route?.cells).not.toContain(1);
  });

  it("prevents multi-edge movement from tunneling through a stationary occupier", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
    });
    const owners = ["alpha", "beta"] as const;
    const mover = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const blocker = createMobileUnit(map, owners, mover, {
      ownerId: "beta", type: "TRAIN", movementClass: "RAIL", cellId: 2,
    });
    const routed = assignMobileUnitRoute(map, mover.unit, {
      cells: [0, 1, 2, 3], edgeWeights: [1, 1, 1],
    });

    const advanced = advanceMobileUnits([routed, blocker.unit], {
      [routed.id]: 3,
      [blocker.unit.id]: 0,
    });
    expect(advanced.find((u) => u.id === routed.id)?.cellId).toBe(1);
    expect(advanced.find((u) => u.id === blocker.unit.id)?.cellId).toBe(2);
  });

  it("rejects same-tick claims to the same previously empty cell symmetrically", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
    });
    const owners = ["alpha", "beta"] as const;
    const left = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const right = createMobileUnit(map, owners, left, {
      ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 2,
    });
    const leftRouted = assignMobileUnitRoute(map, left.unit, {
      cells: [0, 1], edgeWeights: [1],
    });
    const rightRouted = assignMobileUnitRoute(map, right.unit, {
      cells: [2, 1], edgeWeights: [1],
    });

    const advanced = advanceMobileUnits([rightRouted, leftRouted], {
      [leftRouted.id]: 1,
      [rightRouted.id]: 1,
    });

    expect(advanced.find((u) => u.id === leftRouted.id)).toMatchObject({
      cellId: 0,
      route: { nextCellIndex: 1, edgeProgress: 0 },
    });
    expect(advanced.find((u) => u.id === rightRouted.id)).toMatchObject({
      cellId: 2,
      route: { nextCellIndex: 1, edgeProgress: 0 },
    });
  });

  it("arbitrates a later same-tick cell entry after each mover has advanced one uncontested cell", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 5,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS"],
    });
    const owners = ["alpha", "beta"] as const;
    const left = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TRAIN", movementClass: "RAIL", cellId: 0,
    });
    const right = createMobileUnit(map, owners, left, {
      ownerId: "beta", type: "TRAIN", movementClass: "RAIL", cellId: 4,
    });
    const leftRouted = assignMobileUnitRoute(map, left.unit, {
      cells: [0, 1, 2], edgeWeights: [1, 1],
    });
    const rightRouted = assignMobileUnitRoute(map, right.unit, {
      cells: [4, 3, 2], edgeWeights: [1, 1],
    });

    const advanced = advanceMobileUnits([leftRouted, rightRouted], {
      [leftRouted.id]: 2,
      [rightRouted.id]: 2,
    });

    expect(advanced.find((u) => u.id === leftRouted.id)).toMatchObject({
      cellId: 1,
      route: { nextCellIndex: 2, edgeProgress: 0 },
    });
    expect(advanced.find((u) => u.id === rightRouted.id)).toMatchObject({
      cellId: 3,
      route: { nextCellIndex: 2, edgeProgress: 0 },
    });
  });

  it("does not let an upstream contention create a false downstream contention", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 3,
      height: 2,
      terrain: Array.from({ length: 6 }, () => "PLAINS" as const),
    });
    const owners = ["alpha", "beta"] as const;
    const through = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const upstream = createMobileUnit(map, owners, through, {
      ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 4,
    });
    const downstream = createMobileUnit(map, owners, upstream, {
      ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 5,
    });
    const throughRouted = assignMobileUnitRoute(map, through.unit, {
      cells: [0, 1, 2], edgeWeights: [1, 1],
    });
    const upstreamRouted = assignMobileUnitRoute(map, upstream.unit, {
      cells: [4, 1], edgeWeights: [1],
    });
    const downstreamRouted = assignMobileUnitRoute(map, downstream.unit, {
      cells: [5, 2], edgeWeights: [1],
    });

    const advanced = advanceMobileUnits(
      [downstreamRouted, throughRouted, upstreamRouted],
      {
        [throughRouted.id]: 2,
        [upstreamRouted.id]: 1,
        [downstreamRouted.id]: 1,
      },
    );

    expect(advanced.find((u) => u.id === throughRouted.id)).toMatchObject({
      cellId: 0,
      route: { nextCellIndex: 1, edgeProgress: 0 },
    });
    expect(advanced.find((u) => u.id === upstreamRouted.id)).toMatchObject({
      cellId: 4,
      route: { nextCellIndex: 1, edgeProgress: 0 },
    });
    expect(advanced.find((u) => u.id === downstreamRouted.id)?.cellId).toBe(2);
  });

  it("prevents cyclic multi-edge head-on pass-through", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
    });
    const owners = ["alpha", "beta"] as const;
    const left = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TRAIN", movementClass: "RAIL", cellId: 0,
    });
    const right = createMobileUnit(map, owners, left, {
      ownerId: "beta", type: "TRAIN", movementClass: "RAIL", cellId: 3,
    });
    const leftRouted = assignMobileUnitRoute(map, left.unit, {
      cells: [0, 1, 2], edgeWeights: [1, 1],
    });
    const rightRouted = assignMobileUnitRoute(map, right.unit, {
      cells: [3, 2, 1], edgeWeights: [1, 1],
    });

    const advanced = advanceMobileUnits([rightRouted, leftRouted], {
      [leftRouted.id]: 2,
      [rightRouted.id]: 2,
    });

    expect(advanced.find((u) => u.id === leftRouted.id)).toMatchObject({
      cellId: 0,
      route: { nextCellIndex: 1, edgeProgress: 0 },
    });
    expect(advanced.find((u) => u.id === rightRouted.id)).toMatchObject({
      cellId: 3,
      route: { nextCellIndex: 1, edgeProgress: 0 },
    });
  });

  it("keeps every tick-start occupied cell unavailable even when its occupier leaves", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
    });
    const owners = ["alpha", "beta"] as const;
    const follower = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const leader = createMobileUnit(map, owners, follower, {
      ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 1,
    });
    const followerRouted = assignMobileUnitRoute(map, follower.unit, {
      cells: [0, 1], edgeWeights: [1],
    });
    const leaderRouted = assignMobileUnitRoute(map, leader.unit, {
      cells: [1, 2], edgeWeights: [1],
    });

    const advanced = advanceMobileUnits([followerRouted, leaderRouted], {
      [followerRouted.id]: 1,
      [leaderRouted.id]: 1,
    });

    expect(advanced.find((u) => u.id === followerRouted.id)?.cellId).toBe(0);
    expect(advanced.find((u) => u.id === leaderRouted.id)?.cellId).toBe(2);
  });

  it("prevents head-on swaps without choosing a hidden unit priority", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
    });
    const owners = ["alpha", "beta"] as const;
    const left = createMobileUnit(map, owners, {
      mobileUnits: Object.freeze([]), nextMobileUnitOrdinal: 0,
    }, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const right = createMobileUnit(map, owners, left, {
      ownerId: "beta", type: "TANK", movementClass: "TANK", cellId: 1,
    });
    const leftRouted = assignMobileUnitRoute(map, left.unit, {
      cells: [0, 1], edgeWeights: [1],
    });
    const rightRouted = assignMobileUnitRoute(map, right.unit, {
      cells: [1, 0], edgeWeights: [1],
    });

    const advanced = advanceMobileUnits([leftRouted, rightRouted], {
      [leftRouted.id]: 1,
      [rightRouted.id]: 1,
    });

    expect(advanced.find((u) => u.id === leftRouted.id)?.cellId).toBe(0);
    expect(advanced.find((u) => u.id === rightRouted.id)?.cellId).toBe(1);
  });
});
