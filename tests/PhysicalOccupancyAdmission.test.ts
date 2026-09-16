import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createInitialMatchState, createProspectiveMatchState } from "../src/simulation/MatchState";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { resolvePersistentStructureLifecycleTick } from "../src/simulation/Structures";
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

  it("rejects duplicate persistent-structure identities during materialization", () => {
    expect(() => materializePersistentStructures([
      {
        id: "city-a", ownerId: "alpha", type: "CITY", cellId: 2,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
      {
        id: "city-a", ownerId: "beta", type: "CITY", cellId: 3,
        completedLevel: 1, active: true, acquisitionPath: "GRANT",
      },
    ])).toThrow(/identity|conflict|duplicate/i);
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

  it("rejects Factory acquisition when no legal Tank output cell can be designated", () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const state = createInitialMatchState(createMicroSimulationSpec({
      seed: "producer-output-no-fallback-red",
      width: 3,
      height: 1,
      terrain: ["DEEP_WATER", "PLAINS", "DEEP_WATER"],
      initialOwners: [null, "alpha", null],
      factions: [{ id: "alpha", rules }],
    }));

    expect(evaluateStructureAcquisitionAdmission(state, {
      structureId: "factory-no-output",
      ownerId: "alpha",
      type: "FACTORY",
      cellId: 1,
      level: 1,
      acquisitionPath: "GRANT",
    })).toEqual({
      ok: false,
      failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
    });
  });

  it("preserves designated producer output through construction completion", () => {
    const base = baseState("producer-output-lifecycle-red", 3);
    const constructing = createProspectiveMatchState(base, {
      structures: [
        {
          id: "factory-lifecycle",
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 1,
          outputCellId: 0,
          active: false,
          construction: { targetLevel: 1, remainingTicks: 1 },
          acquisitionPath: "PURCHASE_BUILD",
        },
      ],
    });

    const completed = resolvePersistentStructureLifecycleTick(constructing, [], 1);
    expect(completed[0]).toEqual(expect.objectContaining({
      id: "factory-lifecycle",
      completedLevel: 1,
      active: true,
      outputCellId: 0,
    }));
  });
});
