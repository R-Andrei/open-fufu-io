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
});
