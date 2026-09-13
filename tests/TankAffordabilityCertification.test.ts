import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { tryStartTankProduction } from "../src/simulation/Tanks";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

describe("Tank production affordability certification", () => {
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
});
