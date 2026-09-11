import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import { createInitialMatchState } from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function collidingStructureState(structureId: string) {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "controller-reference-value-collision",
      width: 1,
      height: 1,
      terrain: ["PLAINS"],
      initialOwners: ["alpha"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
      initialStructureGrants: [
        {
          structureId,
          ownerId: "alpha",
          type: "FACTORY",
          cellId: 0,
          level: 1,
        },
      ],
    }),
  );
}

describe("controller reference session certification", () => {
  it("never exposes the underlying authoritative identity as the public ref value", () => {
    const authoritativeId = "ofr1:collision-match:0:s:0";
    const session = new ControllerReferenceSession(
      "collision-match",
      collidingStructureState(authoritativeId),
    );

    const ref = session.issue("alpha", "STRUCTURE", authoritativeId);
    expect(ref).toBeDefined();
    expect(ref).not.toBe(authoritativeId);
    expect(session.resolve("alpha", "STRUCTURE", ref!)).toBe(authoritativeId);
  });
});
