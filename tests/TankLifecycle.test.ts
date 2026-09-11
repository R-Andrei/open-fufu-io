import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import {
  tankPurchaseCost,
  tankWeaponRangeContains,
  tryStartTankProduction,
} from "../src/simulation/Tanks";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function productionFixture(ffy: number) {
  const rules = emptyRules();
  const state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-production-red",
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
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );

  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === "alpha" ? { ...faction, ffy } : faction,
    ),
  });
}

describe("baseline Tank lifecycle", () => {
  it("uses the exact active-chassis purchase-cost curve", () => {
    expect(tankPurchaseCost(0)).toBe(250_000);
    expect(tankPurchaseCost(1)).toBe(500_000);
    expect(tankPurchaseCost(2)).toBe(750_000);
    expect(tankPurchaseCost(3)).toBe(1_000_000);
    expect(tankPurchaseCost(4)).toBe(1_000_000);
  });

  it("uses an inclusive cell-center circle for weapon range", () => {
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 31,
      height: 2,
      terrain: Array.from({ length: 62 }, () => "PLAINS" as const),
    });

    expect(tankWeaponRangeContains(map, 0, 30, 30)).toBe(true);
    expect(tankWeaponRangeContains(map, 0, 61, 30)).toBe(false);
  });

  it("atomically admits an affordable Factory build and rejects cost - 1 without mutation", () => {
    const affordable = productionFixture(250_000);
    const accepted = tryStartTankProduction(affordable, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected Tank production admission");
    expect(accepted.cost).toBe(250_000);
    expect(
      accepted.state.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(0);
    expect(accepted.state.tankProductionJobs).toHaveLength(1);

    const unaffordable = productionFixture(249_999);
    const rejected = tryStartTankProduction(unaffordable, {
      ownerId: "alpha",
      factoryId: "alpha-factory",
    });

    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error("expected Tank production rejection");
    expect(rejected.failure.code).toBe("INSUFFICIENT_FFY");
    expect(rejected.state).toBe(unaffordable);
    expect(rejected.state.tankProductionJobs).toHaveLength(0);
    expect(
      rejected.state.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(249_999);
  });
});
