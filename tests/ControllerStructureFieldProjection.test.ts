import { readFileSync } from "node:fs";
import {
  STRUCTURE_FIELD_AFFILIATIONS as CONTROLLER_FIELD_AFFILIATIONS,
  STRUCTURE_FIELD_IDS as CONTROLLER_FIELD_IDS,
} from "../src/core/controller/ControllerApi";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  STRUCTURE_FIELD_AFFILIATIONS,
  STRUCTURE_FIELD_IDS,
} from "../src/core/rules/RuleComposition";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

describe("controller structure-field projection", () => {
  it("re-exports the exact canonical rule-condition field vocabulary", () => {
    expect(CONTROLLER_FIELD_IDS).toBe(STRUCTURE_FIELD_IDS);
    expect(CONTROLLER_FIELD_AFFILIATIONS).toBe(STRUCTURE_FIELD_AFFILIATIONS);
    expect([...CONTROLLER_FIELD_IDS]).toEqual([
      "FORT",
      "SAM_LAUNCHER",
      "COMMAND_POST",
    ]);
    expect(CONTROLLER_FIELD_IDS).not.toContain("SAM" as never);
  });

  it("surfaces one opaque authoritative STRUCTURE_FIELD selector", () => {
    const source = readFileSync(
      "src/core/controller/ControllerApi.ts",
      "utf8",
    );
    expect(source).toContain('readonly kind: "STRUCTURE_FIELD";');
    expect(source).toContain("readonly field: ControllerStructureFieldId;");
    expect(source).toContain("readonly referenceFactionId: FactionId;");
    expect(source).toContain("readonly affiliation: StructureFieldAffiliation;");
    expect(source).toContain(
      "controllers must not approximate this with CIRCLE",
    );
  });

  it("surfaces authoritative per-structure field selection for P27", () => {
    const source = readFileSync(
      "src/core/controller/ControllerApi.ts",
      "utf8",
    );
    expect(source).toContain('readonly kind: "STRUCTURE_FIELD_INSTANCE";');
    expect(source).toContain("readonly structureId: StructureId;");
    expect(source).toContain("readonly field: StructureFieldId;");
    expect(source).toContain(
      'readonly eligibilityField: Extract<StructureFieldId, "SAM_LAUNCHER">;',
    );
    expect(source).toContain(
      "numeric interceptionRange is ergonomic only",
    );
  });

  it("keeps P45-concealed structure fields indistinguishable from unknown IDs across aggregate Cells APIs", async () => {
    const alphaRules = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [],
    });
    const betaOrdinaryRules = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [],
    });
    const betaP45Rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P45"]),
    );
    const terrain = [
      "PLAINS",
      ...Array.from({ length: 24 }, () => "FOREST" as const),
    ] as const;
    const initialOwners = [
      "alpha",
      ...Array.from({ length: 24 }, () => "beta" as const),
    ] as const;

    const makeState = (betaRules: typeof betaOrdinaryRules) =>
      new MatchRuntime(
        createMicroSimulationSpec({
          seed: "controller-field-visibility-red",
          width: 5,
          height: 5,
          terrain,
          initialOwners,
          factions: [
            { id: "alpha", rules: alphaRules },
            { id: "beta", rules: betaRules },
          ],
          initialStructureGrants: [
            {
              structureId: "alpha-observer",
              ownerId: "alpha",
              type: "OBSERVATION_POST",
              cellId: 0,
              level: 1,
            },
            {
              structureId: "beta-fort",
              ownerId: "beta",
              type: "FORT",
              cellId: 12,
              level: 1,
            },
          ],
        }),
      ).snapshot();

    const visibleState = makeState(betaOrdinaryRules);
    const concealedState = makeState(betaP45Rules);
    const limits = {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    } as const;
    const fortField = {
      kind: "STRUCTURE_FIELD_INSTANCE",
      structureId: "beta-fort",
      field: "FORT",
    } as const;
    const unknownFortField = {
      kind: "STRUCTURE_FIELD_INSTANCE",
      structureId: "does-not-exist",
      field: "FORT",
    } as const;
    const aggregateBetaFortField = {
      kind: "STRUCTURE_FIELD",
      field: "FORT",
      referenceFactionId: "beta",
      affiliation: "SELF",
    } as const;

    const visible = createControllerQuerySession(visibleState, "alpha", limits);
    expect((await visible.cells.query(fortField)).items.map((cell) => cell.id)).toEqual(
      Array.from({ length: 25 }, (_, id) => id),
    );

    const concealed = createControllerQuerySession(
      concealedState,
      "alpha",
      limits,
    );
    expect(await concealed.cells.query(fortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(await concealed.cells.query(unknownFortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(await concealed.cells.count(fortField)).toBe(0);
    expect(await concealed.cells.count(unknownFortField)).toBe(0);
    expect(await concealed.cells.boundary(fortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(await concealed.cells.boundary(unknownFortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(await concealed.cells.connectedComponents(fortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(await concealed.cells.connectedComponents(unknownFortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(await concealed.cells.query(aggregateBetaFortField)).toEqual({
      items: [],
      truncated: false,
    });

    const self = createControllerQuerySession(concealedState, "beta", limits);
    expect((await self.cells.query(fortField)).items.map((cell) => cell.id)).toEqual(
      Array.from({ length: 25 }, (_, id) => id),
    );
  });
});
