import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

describe("target mobile-unit runtime foundation", () => {
  it("reserves authoritative empty mobile-unit state and identity allocation state", () => {
    const rules = emptyRules();
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "mobile-unit-foundation-red",
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const unitState = state as typeof state & {
      readonly mobileUnits?: readonly unknown[];
      readonly nextMobileUnitOrdinal?: number;
    };

    expect(unitState.mobileUnits).toEqual([]);
    expect(unitState.nextMobileUnitOrdinal).toBe(0);

    const serialized = JSON.parse(
      canonicalMatchStateSerialization(state),
    ) as Record<string, unknown>;
    expect(serialized.mobileUnits).toEqual([]);
    expect(serialized.nextMobileUnitOrdinal).toBe(0);
  });
});
