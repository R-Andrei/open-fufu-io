import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { tryPurchaseStructureBuild } from "../src/simulation/Structures";

describe("structure transaction certification", () => {
  it("consumes custom purchase semantics by domain rather than Origin source id", () => {
    const alphaRules = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [],
      customDomains: [
        {
          sourceKind: "ORIGIN",
          sourceId: "CERT_ALIAS_FIRST_PURCHASE",
          domain: "FIRST_STRUCTURE_PURCHASE_ZERO_FFY",
        },
        {
          sourceKind: "ORIGIN",
          sourceId: "CERT_ALIAS_DIRECT_CITY",
          domain: "DIRECT_LEVEL5_CITY_PURCHASE",
        },
      ],
    });
    const betaRules = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [],
    });
    const initial = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "structure-transaction-certification-domain",
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        factions: [
          { id: "alpha", rules: alphaRules },
          { id: "beta", rules: betaRules },
        ],
      }),
    );
    const state = createProspectiveMatchState(initial, {
      factions: initial.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 1_995_000 } : faction,
      ),
    });

    const purchased = tryPurchaseStructureBuild(state, {
      structureId: "city-domain-semantics",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
    });

    expect(purchased.ok).toBe(true);
    if (!purchased.ok) throw new Error(purchased.failure.code);
    const alpha = purchased.factions.find((faction) => faction.id === "alpha");
    expect(alpha?.ffy).toBe(1_995_000);
    expect(alpha?.successfulStructurePurchaseTypes).toEqual(["CITY"]);
    expect(purchased.structures).toEqual([
      expect.objectContaining({
        id: "city-domain-semantics",
        type: "CITY",
        ownerId: "alpha",
        active: false,
        construction: { targetLevel: 5, remainingTicks: 50 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
    ]);
    expect(purchased.structures[0]?.completedLevel).toBeUndefined();
  });
});
