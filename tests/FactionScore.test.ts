import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { calculateFactionScore } from "../src/simulation/Economy";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createInitialMatchState } from "../src/simulation/MatchState";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function scoreState(initialOwners: readonly (string | null)[]) {
  const rules = emptyRules();
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "faction-score-red",
      width: initialOwners.length,
      height: 1,
      terrain: initialOwners.map(() => "PLAINS"),
      initialOwners,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

describe("authoritative faction strength score", () => {
  it("scores an all-domain reference-baseline faction at exactly 1000", () => {
    const state = scoreState(["alpha", "beta"]);

    expect(calculateFactionScore(state, "alpha")).toBe(1000);
  });

  it("applies square-root diminishing returns to territory before composition", () => {
    const state = scoreState(["alpha", "alpha", "alpha", "beta"]);

    // T = 3 * 2 / 4 = 1.5, while E = P = 1 at tick 0.
    // floor(300 * sqrt(1.5) + 250 + 450) = 1067.
    expect(calculateFactionScore(state, "alpha")).toBe(1067);
  });
});
