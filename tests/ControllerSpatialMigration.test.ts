import { readFileSync } from "node:fs";
import { OFFICIAL_AI_BASELINE_CHARACTER_PROFILE } from "../design/official-ai/character-configurations.config";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { OfficialAiControllerHost } from "../src/official-ai/OfficialAiController";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import {
  CONTROLLER_QUERY_LIMITS,
  InProcessTestControllerHost,
  projectLawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createControllerSpatialSurface } from "../src/simulation/ControllerSpatialSurface";

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
    { controllerReferenceNamespace: "controller-spatial-migration" },
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
            if (
              context.map === undefined ||
              context.cells === undefined ||
              context.segments === undefined
            ) {
              throw new Error("current controller spatial surface missing");
            }
            expect(Array.isArray(context.cells)).toBe(false);
            expect(context.map.cellCount).toBe(2);
            expect(context.map.terrainAt(0)).toBe("PLAINS");
            expect(context.cells.owner(0)).toBe("alpha");
            expect(context.cells.owner(1)).toBeNull();
            expect(context.cells.owner(2)).toBeUndefined();
            expect(context.segments.cellIds(0)).toBeUndefined();
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

  it("declares opaque public refs, dual locators, find filters, and entity materialization limits", () => {
    const source = readFileSync("src/core/controller/ControllerApi.ts", "utf8");

    expect(source).toContain("export type FactionRef");
    expect(source).toContain("export type UnitRef");
    expect(source).toContain("export type StructureRef");
    expect(source).toContain("export type UnitLocator");
    expect(source).toContain("export type StructureLocator");
    expect(source).toContain("readonly ref: UnitRef;");
    expect(source).toContain("readonly ref: StructureRef;");
    expect(source).toContain("find(filter?: UnitFindFilter)");
    expect(source).toContain("find(filter?: StructureFindFilter)");
    expect(source).toContain("find(filter?: FactionFindFilter)");
    expect(source).toContain("materializedEntityViewsPerDecision");
  });

  it("projects global faction refs and the unit/structure discovery namespaces from one trusted query session", async () => {
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-public-entity-read-surface",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta", null],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: "controller-public-entity-read-surface" },
    );
    const session = createControllerQuerySession(
      match.snapshot(),
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      match.controllerReferenceSession(),
    );
    const surface = createControllerSpatialSurface(session) as unknown as {
      factions: {
        find(filter?: unknown): readonly {
          ref: string;
          status: string;
          relation: string;
          territoryCells: number;
        }[];
        get(ref: string): { ref: string; relation: string } | undefined;
        proximity(ref: string): number | undefined;
      };
      units: {
        find(filter?: unknown): Promise<{ items: readonly unknown[]; truncated: boolean }>;
      };
      structures: {
        find(filter?: unknown): Promise<{ items: readonly unknown[]; truncated: boolean }>;
      };
    };

    const factions = surface.factions.find();
    expect(factions).toHaveLength(2);
    expect(factions.map((faction) => faction.ref)).not.toContain("alpha");
    expect(factions.map((faction) => faction.ref)).not.toContain("beta");
    const self = factions.find((faction) => faction.relation === "SELF");
    const enemy = factions.find((faction) => faction.relation === "ENEMY");
    expect(self).toMatchObject({ status: "ACTIVE", territoryCells: 1 });
    expect(enemy).toMatchObject({ status: "ACTIVE", territoryCells: 1 });
    expect(surface.factions.get(enemy!.ref)?.ref).toBe(enemy!.ref);
    expect(surface.factions.proximity(enemy!.ref)).toBe(1);
    expect(await surface.units.find()).toEqual({ items: [], truncated: false });
    expect(await surface.structures.find()).toEqual({ items: [], truncated: false });
  });

  it("lets BASELINE_D0 preserve its existing expansion decision without the eager array", () => {
    const match = baselineFixture();
    const state = match.snapshot();
    const observation = projectLawfulControllerObservation(state, "alpha", 0);
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