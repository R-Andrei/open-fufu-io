import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import {
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructureState,
} from "../src/simulation/Structures";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function stateForTerrain(terrain: readonly ("PLAINS" | "SHALLOW_WATER" | "DEEP_WATER")[]) {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "structure-lifecycle-red",
      width: terrain.length,
      height: 1,
      terrain,
      initialOwners: terrain.map((cell) => (cell === "PLAINS" ? "alpha" : null)),
      factions: [{ id: "alpha", rules }],
    }),
  );
}

describe("persistent structure construction lifecycle", () => {
  it("progresses fresh construction once per tick and activates atomically on the exact boundary", () => {
    const base = stateForTerrain(["PLAINS"]);
    const constructing = createProspectiveMatchState(base, {
      structures: [
        materializePersistentStructureState({
          id: "city-a",
          ownerId: "alpha",
          type: "CITY",
          cellId: 0,
          active: false,
          construction: { targetLevel: 1, remainingTicks: 2 },
          acquisitionPath: "PURCHASE_BUILD",
        }),
      ],
    });
    const engine = new TickEngine();

    const oneBefore = engine.advance(constructing, []);
    expect(oneBefore.structures).toEqual([
      expect.objectContaining({
        id: "city-a",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 1 },
      }),
    ]);
    expect(oneBefore.structures[0]?.completedLevel).toBeUndefined();

    const completed = engine.advance(oneBefore, []);
    expect(completed.structures).toEqual([
      expect.objectContaining({
        id: "city-a",
        active: true,
        completedLevel: 1,
      }),
    ]);
    expect(completed.structures[0]?.construction).toBeUndefined();

    const after = engine.advance(completed, []);
    expect(after.structures).toEqual(completed.structures);
  });

  it("admits an exact-cell Port only with a cardinal Deep-Water interface", () => {
    const deepCoast = stateForTerrain(["PLAINS", "DEEP_WATER"]);
    const deepAdmission = evaluateStructureAcquisitionAdmission(deepCoast, {
      structureId: "port-deep",
      ownerId: "alpha",
      type: "PORT",
      cellId: 0,
      level: 1,
      acquisitionPath: "PURCHASE_BUILD",
    });
    expect(deepAdmission).toEqual({ ok: true });

    const shallowOnly = stateForTerrain(["PLAINS", "SHALLOW_WATER"]);
    const shallowAdmission = evaluateStructureAcquisitionAdmission(shallowOnly, {
      structureId: "port-shallow",
      ownerId: "alpha",
      type: "PORT",
      cellId: 0,
      level: 1,
      acquisitionPath: "PURCHASE_BUILD",
    });
    expect(shallowAdmission).toEqual({
      ok: false,
      failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
    });
  });

  it("keeps general coast projection land-sided even when Shallow Water borders Deep Water", async () => {
    const state = stateForTerrain(["PLAINS", "SHALLOW_WATER", "DEEP_WATER"]);
    const session = createControllerQuerySession(state, "alpha", {
      queriesPerDecision: 8,
      materializedCellsPerDecision: 8,
    });

    expect((await session.cells.get(0))?.isCoast).toBe(true);
    expect((await session.cells.get(1))?.isCoast).toBe(false);
    expect((await session.cells.get(1))?.isShoreline).toBe(true);
  });
});
