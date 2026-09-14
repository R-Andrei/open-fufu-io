import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createInitialMatchState, createProspectiveMatchState } from "../src/simulation/MatchState";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { advanceTankRepairIntentPhase } from "../src/simulation/TankRepair";
import { advanceTankProductionPhase } from "../src/simulation/Tanks";

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

function structure(id: string, cellId: number) {
  return {
    id, ownerId: "alpha", type: "FACTORY" as const, cellId,
    completedLevel: 1 as const, active: true, acquisitionPath: "GRANT" as const,
  };
}

describe("physical occupancy Tank integration", () => {
  it("skips occupied Factory-adjacent cells during Tank deployment", () => {
    const base = baseState("occupancy-tank-deployment", 5);
    const owners = base.factions.map((f) => f.id);
    const blocker = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TRAIN", movementClass: "RAIL", cellId: 1,
    });
    const prepared = createProspectiveMatchState(base, {
      structures: [structure("factory-a", 2)],
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
      tankProductionJobs: [{
        factoryId: "factory-a", ownerId: "alpha", chassisType: "TANK",
        strategicDestinationCellId: 4, state: "WAITING_DEPLOYMENT",
      }],
    });

    const advanced = advanceTankProductionPhase(prepared);
    expect(advanced.mobileUnits.find((u) => u.type === "TANK")?.cellId).toBe(3);
    expect(advanced.tankProductionJobs).toEqual([]);
  });

  it("does not assign Factory repair routes through occupied cells", () => {
    const base = baseState("occupancy-tank-repair", 15);
    const owners = base.factions.map((f) => f.id);
    const tank = createMobileUnit(base.map, owners, base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 14,
    });
    const blocker = createMobileUnit(base.map, owners, tank, {
      ownerId: "beta", type: "TRAIN", movementClass: "RAIL", cellId: 13,
    });
    const prepared = createProspectiveMatchState(base, {
      structures: [structure("factory-a", 0)],
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
      tankOperationalStates: [{
        unitId: tank.unit.id,
        health: { numerator: 500n, denominator: 1n },
        operatingAnchorCellId: 14,
        eligibleFromTick: 0,
        attackReadyAtTick: 0,
      }],
    });

    const advanced = advanceTankRepairIntentPhase(prepared);
    const operational = advanced.tankOperationalStates.find((o) => o.unitId === tank.unit.id);
    expect(operational?.repairFactoryId).toBeUndefined();
    expect(advanced.mobileUnits.find((u) => u.id === tank.unit.id)?.route).toBeUndefined();
  });
});
