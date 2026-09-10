import { OFFICIAL_AI_BASELINE_CHARACTER_PROFILE } from "../design/official-ai/character-configurations.config";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { OfficialAiControllerHost } from "../src/official-ai/OfficialAiController";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import {
  CONTROLLER_QUERY_LIMITS,
  InProcessTestControllerHost,
  projectLawfulControllerObservation,
  type LawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function baselineFixture() {
  const match = new MatchRuntime(
    createMicroSimulationSpec({
      seed: "controller-spatial-migration",
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
  return match;
}

describe("controller spatial API migration", () => {
  it("removes the eager cell array from the raw lawful observation", () => {
    const match = baselineFixture();
    const observation = projectLawfulControllerObservation(
      match.snapshot(),
      "alpha",
      0,
    );

    expect(Object.prototype.hasOwnProperty.call(observation, "cells")).toBe(false);
  });

  it("gives in-process controllers the current local map/cells/segments surface", () => {
    const match = baselineFixture();
    let spatialSurfaceSeen = false;

    const receipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha: {
          decide(context) {
            const spatial = context as unknown as {
              readonly map: {
                readonly cellCount: number;
                terrainAt(id: number): string | undefined;
              };
              readonly cells: {
                owner(id: number): string | null | undefined;
              };
              readonly segments: {
                cellIds(id: number): readonly number[] | undefined;
              };
            };
            expect(Array.isArray(spatial.cells)).toBe(false);
            expect(spatial.map.cellCount).toBe(2);
            expect(spatial.map.terrainAt(0)).toBe("PLAINS");
            expect(spatial.cells.owner(0)).toBe("alpha");
            expect(spatial.cells.owner(1)).toBeNull();
            expect(spatial.cells.owner(2)).toBeUndefined();
            expect(spatial.segments.cellIds(0)).toBeUndefined();
            spatialSurfaceSeen = true;
            return { commands: [] };
          },
        },
      }),
    );

    expect(spatialSurfaceSeen).toBe(true);
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
      true,
    );
  });

  it("lets BASELINE_D0 preserve its existing expansion decision without the eager array", () => {
    const match = baselineFixture();
    const state = match.snapshot();
    const projected = projectLawfulControllerObservation(state, "alpha", 0);
    const { cells: _obsoleteCells, ...withoutObsoleteCells } = projected as LawfulControllerObservation & {
      readonly cells?: unknown;
    };
    const observation = Object.freeze(
      withoutObsoleteCells,
    ) as LawfulControllerObservation;
    const querySession = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
    );
    const host = new OfficialAiControllerHost([
      {
        factionId: "alpha",
        profile: OFFICIAL_AI_BASELINE_CHARACTER_PROFILE,
      },
    ]);

    const result = host.invoke("alpha", observation, querySession);

    expect(result).toEqual({
      ok: true,
      output: {
        directives: {
          set: [
            {
              kind: "LAND_OPERATION",
              key: "official-ai:BASELINE_D0:neutral-expansion",
              operation: "NEUTRAL_EXPANSION",
              population: 1,
              source: { kind: "CELLS", ids: [0] },
              target: { kind: "CELLS", ids: [1] },
            },
          ],
        },
      },
    });
  });
});
