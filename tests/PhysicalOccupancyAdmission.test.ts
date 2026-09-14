import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createInitialMatchState, createProspectiveMatchState } from "../src/simulation/MatchState";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructures,
} from "../src/simulation/StructuresCore";

function baseState(seed: string, width = 6) {
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

describe("physical occupancy admission", () => {
  it("rejects duplicate persistent-structure cells during materialization", () => {
    expect(() => materializePersistentStructures([
      {
        id: "city-a", ownerId: "alpha", type: "CITY", cellId: 2,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
      {
        id: "city-b", ownerId: "beta", type: "CITY", cellId: 2,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
    ])).toThrow(/occup/i);
  });

  it("rejects structure acquisition on a cell occupied by a mobile unit", () => {
    const base = baseState("occupancy-structure-admission");
    const created = createMobileUnit(base.map, base.factions.map((f) => f.id), base, {
      ownerId: "alpha", type: "TANK", movementClass: "TANK", cellId: 2,
    });
    const occupied = createProspectiveMatchState(base, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    });
    expect(evaluateStructureAcquisitionAdmission(occupied, {
      structureId: "factory-a", ownerId: "alpha", type: "FACTORY", cellId: 2,
      level: 1, acquisitionPath: "GRANT",
    })).toEqual({ ok: false, failure: { code: "CELL_OCCUPIED" } });
  });
});
