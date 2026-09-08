import { readFileSync } from "node:fs";
import { OFFICIAL_AI_BASELINE_CHARACTER_PROFILE } from "../design/official-ai/character-configurations.config";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { OfficialAiControllerHost } from "../src/official-ai/OfficialAiController";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function tickUntil(
  match: MatchRuntime,
  predicate: () => boolean,
  maximumTicks = 30,
): void {
  for (let index = 0; index < maximumTicks; index += 1) {
    if (predicate()) return;
    match.tick();
  }
  if (!predicate()) throw new Error("Official AI fixture did not reach expected state");
}

describe("Official AI runtime foundation", () => {
  it("runs BASELINE_D0 through the lawful controller host and replays exactly", () => {
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "official-ai-baseline-expansion",
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", null],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    match.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 1,
    });
    match.tick();

    const receipts = match.runControllerRound(
      new OfficialAiControllerHost([
        {
          factionId: "alpha",
          profile: OFFICIAL_AI_BASELINE_CHARACTER_PROFILE,
        },
      ]),
    );

    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
    ).toBe(true);

    const directiveInput = match
      .acceptedInputs()
      .find((input) => input.action.type === "APPLY_PERSISTENT_DIRECTIVES");
    expect(directiveInput?.action).toMatchObject({
      type: "APPLY_PERSISTENT_DIRECTIVES",
      factionId: "alpha",
      changes: {
        set: [
          {
            kind: "LAND_OPERATION",
            operation: "NEUTRAL_EXPANSION",
            population: 1,
            source: { kind: "CELLS", ids: [0] },
            target: { kind: "CELLS", ids: [1] },
          },
        ],
      },
    });

    tickUntil(match, () => match.snapshot().ownership[1] === "alpha");

    const regenerated = MatchRuntime.regenerate(
      match.spec,
      match.acceptedInputs(),
      match.snapshot().tick,
    );
    expect(regenerated.snapshot()).toEqual(match.snapshot());
    expect(regenerated.stateFingerprint()).toBe(match.stateFingerprint());
  });

  it("imports only the lawful simulation controller boundary and no legacy bot runtime", () => {
    const source = readFileSync(
      "src/official-ai/OfficialAiController.ts",
      "utf8",
    );
    const simulationImports = [...source.matchAll(/from\s+["'](\.\.\/simulation\/[^"']+)["']/g)].map(
      (match) => match[1],
    );

    expect(simulationImports).toEqual(["../simulation/ControllerRuntime"]);
    for (const forbidden of [
      "MatchState",
      "LandOperations",
      "TickEngine",
      "GameImpl",
      "PlayerImpl",
      "UnitImpl",
      "AttackImpl",
      "AttackExecution",
      "ExecutionManager",
      "GameRunner",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
