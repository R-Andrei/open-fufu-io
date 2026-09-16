import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import {
  createMobileUnit,
  removeMobileUnit,
} from "../src/simulation/MobileUnits";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  advanceTankProductionPhase,
  tryStartTankProduction,
} from "../src/simulation/Tanks";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

describe("Tank production affordability certification", () => {
  it("keeps faction-score Tank replacement valuation on Tank-owned cost authority", () => {
    const tankSource = readFileSync(
      join(process.cwd(), "src", "simulation", "Tanks.ts"),
      "utf8",
    );
    const scoreSource = readFileSync(
      join(process.cwd(), "src", "simulation", "FactionScore.ts"),
      "utf8",
    );

    expect(tankSource).toContain(
      "export function baselineTankChassisReplacementCost",
    );
    expect(scoreSource).toContain("baselineTankChassisReplacementCost");
    expect(scoreSource).not.toContain(
      "function baselineTankChassisReplacementCost",
    );
  });

  it("accepts cost + 1 and debits exactly the canonical Tank cost", () => {
    const initial = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "tank-affordability-certification",
        width: 4,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "alpha", "beta"],
        initialStructureGrants: [
          {
            structureId: "alpha-factory",
            ownerId: "alpha",
            type: "FACTORY",
            cellId: 1,
            level: 1,
          },
        ],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const withSurplus = createProspectiveMatchState(initial, {
      factions: initial.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 250_001 } : faction,
      ),
    });

    const accepted = tryStartTankProduction(withSurplus, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
      strategicDestinationCellId: 2,
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Tank production admission");
    expect(accepted.cost).toBe(250_000);
    expect(
      accepted.state.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(1);
    expect(accepted.state.tankProductionJobs).toHaveLength(1);
  });

  it("reserves one producer output cell and holds completed Tanks READY_TO_DEPLOY until that exact slot clears", () => {
    const initial = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "issue178-fixed-producer-output-red",
        width: 5,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "alpha", "alpha", "beta"],
        initialStructureGrants: [
          {
            structureId: "alpha-factory",
            ownerId: "alpha",
            type: "FACTORY",
            cellId: 2,
            level: 1,
          },
        ],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const factory = initial.structures.find(
      (structure) => structure.id === "alpha-factory",
    );
    if (factory === undefined) throw new Error("expected Factory fixture");
    const outputCellId = (
      factory as unknown as { readonly outputCellId?: number }
    ).outputCellId;
    expect(outputCellId).toBeDefined();
    expect([1, 3]).toContain(outputCellId);
    if (outputCellId === undefined) throw new Error("expected reserved Factory output");

    const funded = createProspectiveMatchState(initial, {
      factions: initial.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 250_000 } : faction,
      ),
    });
    const admitted = tryStartTankProduction(funded, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
      strategicDestinationCellId: 0,
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) throw new Error("expected Tank production admission");

    let current = admitted.state;
    while (
      current.tankProductionJobs[0]?.state === "BUILDING" &&
      current.tankProductionJobs[0].remainingTicks > 1
    ) {
      current = advanceTankProductionPhase(current);
    }
    expect(current.tankProductionJobs[0]).toMatchObject({
      state: "BUILDING",
      remainingTicks: 1,
    });

    const blocker = createMobileUnit(
      current.map,
      current.factions.map((faction) => faction.id),
      {
        mobileUnits: current.mobileUnits,
        nextMobileUnitOrdinal: current.nextMobileUnitOrdinal,
      },
      {
        ownerId: "alpha",
        type: "TRAIN",
        movementClass: "RAIL",
        cellId: outputCellId,
      },
    );
    current = createProspectiveMatchState(current, {
      mobileUnits: blocker.mobileUnits,
      nextMobileUnitOrdinal: blocker.nextMobileUnitOrdinal,
    });

    const completedWhileBlocked = advanceTankProductionPhase(current);
    expect(completedWhileBlocked.mobileUnits).toEqual(blocker.mobileUnits);
    expect(completedWhileBlocked.tankProductionJobs).toHaveLength(1);
    expect(completedWhileBlocked.tankProductionJobs[0]).toMatchObject({
      state: "READY_TO_DEPLOY",
      factoryId: "alpha-factory",
    });

    const clearedUnits = removeMobileUnit(
      {
        mobileUnits: completedWhileBlocked.mobileUnits,
        nextMobileUnitOrdinal: completedWhileBlocked.nextMobileUnitOrdinal,
      },
      blocker.unit.id,
    );
    const cleared = createProspectiveMatchState(completedWhileBlocked, {
      mobileUnits: clearedUnits.mobileUnits,
      nextMobileUnitOrdinal: clearedUnits.nextMobileUnitOrdinal,
    });
    const deployed = advanceTankProductionPhase(cleared);
    expect(deployed.tankProductionJobs).toEqual([]);
    expect(deployed.mobileUnits).toHaveLength(1);
    expect(deployed.mobileUnits[0]).toMatchObject({
      ownerId: "alpha",
      type: "TANK",
      cellId: outputCellId,
      strategicDestinationCellId: 0,
    });
  });
});
