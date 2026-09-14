import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createFactoryRailLoopLifecycleState } from "../src/simulation/FactoryRailLifecycle";
import { createInitialMatchState, createProspectiveMatchState } from "../src/simulation/MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  createMobileUnit,
  setMobileUnitStrategicDestination,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { tankNavigationRoute } from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";

function baseState(seed: string, width: number) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(createMicroSimulationSpec({
    seed,
    width,
    height: 1,
    terrain: Array.from({ length: width }, () => "PLAINS" as const),
    initialOwners: Array.from({ length: width }, () => "alpha"),
    factions: [{ id: "alpha", rules }, { id: "beta", rules }],
  }));
}

function structure(id: string, type: "CITY" | "FACTORY", cellId: number) {
  return {
    id, ownerId: "alpha", type, cellId,
    completedLevel: 1 as const, active: true, acquisitionPath: "GRANT" as const,
  };
}

describe("physical occupancy transition integration", () => {
  it("does not let a retained Tank route enter a newly occupied cell", () => {
    const base = baseState("occupancy-tank-transition", 4);
    const owners = base.factions.map((f) => f.id);
    const created = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 0,
    });
    const withMover = createProspectiveMatchState(base, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    });
    const plan = tankNavigationRoute(withMover, "alpha", "TANK", 0, 3);
    if (plan.status !== "FOUND") throw new Error("expected Tank route fixture");
    const strategic = setMobileUnitStrategicDestination(base.map, created.unit, 3);
    const routed = assignMobileUnitRoute(base.map, strategic, {
      cells: plan.route.cells, edgeWeights: plan.route.edgeWeights,
    });
    const partial = advanceMobileUnit(routed, plan.route.edgeWeights[0]! - 1).unit;
    const prepared = createProspectiveMatchState(base, {
      structures: [structure("city-blocker", "CITY", 1)],
      mobileUnits: [partial],
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      tankOperationalStates: [{
        unitId: partial.id,
        health: { numerator: 1000n, denominator: 1n },
        operatingAnchorCellId: 0,
        eligibleFromTick: 0,
        attackReadyAtTick: 0,
      }],
    });

    const advanced = new TickEngine().advance(prepared, []);
    expect(advanced.mobileUnits.find((u) => u.id === partial.id)?.cellId).toBe(0);
  });

  it("keeps a Factory Train behind a stationary occupier instead of tunneling through it", () => {
    const base = baseState("occupancy-train-transition", 13);
    const owners = base.factions.map((f) => f.id);
    const blocker = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 2,
    });
    const loopCells = Object.freeze(Array.from({ length: 11 }, (_, i) => i + 1));
    const prepared = createProspectiveMatchState(base, {
      structures: [
        structure("factory-a", "FACTORY", 0),
        structure("city-a", "CITY", 12),
      ],
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
      factoryRailLoops: [createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-a", cellId: 11 }),
        ]),
      })],
    });

    const advanced = new TickEngine().advance(prepared, []);
    expect(advanced.mobileUnits.find((u) => u.type === "TRAIN")?.cellId).toBe(1);
    expect(advanced.mobileUnits.find((u) => u.id === blocker.unit.id)?.cellId).toBe(2);
  });
});
