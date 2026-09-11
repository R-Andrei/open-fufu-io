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
import { createProspectiveMatchState } from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { materializePersistentStructureState } from "../src/simulation/Structures";

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

  it("defines #149 construction addressing as requester-scoped and cell-addressed", () => {
    const source = readFileSync(
      "src/core/controller/ControllerApi.ts",
      "utf8",
    );

    const upgradeCommandStart = source.indexOf(
      "export interface UpgradeStructureCommand",
    );
    const upgradeCommandEnd = source.indexOf(
      "export interface BuildUnitCommand",
      upgradeCommandStart,
    );
    const upgradeCommand = source.slice(upgradeCommandStart, upgradeCommandEnd);
    expect(upgradeCommand).toContain("readonly cellId: CellId;");
    expect(upgradeCommand).not.toContain("structureId");

    const buildQuoteStart = source.indexOf("structureBuildQuote(");
    const buildQuoteEnd = source.indexOf(
      "): StructureBuildQuote;",
      buildQuoteStart,
    );
    const buildQuote = source.slice(
      buildQuoteStart,
      buildQuoteEnd + "): StructureBuildQuote;".length,
    );
    expect(buildQuote).toContain("structureType: StructureType");
    expect(buildQuote).toContain("cellId: CellId");
    expect(buildQuote).not.toContain("factionId");

    const upgradeQuoteStart = source.indexOf("structureUpgradeQuote(");
    const upgradeQuoteEnd = source.indexOf(
      "): StructureUpgradeQuote;",
      upgradeQuoteStart,
    );
    const upgradeQuote = source.slice(
      upgradeQuoteStart,
      upgradeQuoteEnd + "): StructureUpgradeQuote;".length,
    );
    expect(upgradeQuote).toContain("cellId: CellId");
    expect(upgradeQuote).not.toContain("structureId");

    const failureCodeStart = source.indexOf("export type DecisionFailureCode");
    const failureCodeEnd = source.indexOf(
      "export interface DecisionFailure",
      failureCodeStart,
    );
    const failureCodes = source.slice(failureCodeStart, failureCodeEnd);
    expect(failureCodes).toContain('| "MAX_LEVEL"');
  });

  it("defines #149 structure observation as optional ID-less CellView data", () => {
    const source = readFileSync(
      "src/core/controller/ControllerApi.ts",
      "utf8",
    );
    const structureStart = source.indexOf(
      "export interface ControllerStructureView",
    );
    const structureEnd = source.indexOf(
      "export interface StructureView",
      structureStart,
    );
    const structureView = source.slice(structureStart, structureEnd);
    expect(structureStart).toBeGreaterThanOrEqual(0);
    expect(structureView).toContain("readonly ownerId: FactionId;");
    expect(structureView).toContain("readonly type: StructureType;");
    expect(structureView).toContain("readonly cellId: CellId;");
    expect(structureView).toContain("readonly completedLevel?: StructureLevel;");
    expect(structureView).toContain("readonly active: boolean;");
    expect(structureView).toContain(
      "readonly construction?: StructureConstructionView;",
    );
    expect(structureView).toContain("readonly chargeState?: ChargeStateView;");
    expect(structureView).not.toContain("readonly id:");
    expect(structureView).not.toContain("health");

    const cellStart = source.indexOf("export interface CellView");
    const cellEnd = source.indexOf("export interface SegmentView", cellStart);
    const cellView = source.slice(cellStart, cellEnd);
    expect(cellView).toContain("readonly structure?: ControllerStructureView;");
  });

  it("projects fresh, upgrading, and Silo lifecycle state without internal structure identity", async () => {
    const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
    const base = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-cell-structure-lifecycle-red",
        width: 3,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", "alpha", "alpha"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    ).snapshot();
    const state = createProspectiveMatchState(base, {
      structures: [
        materializePersistentStructureState({
          id: "fresh-city-internal",
          ownerId: "alpha",
          type: "CITY",
          cellId: 0,
          active: false,
          construction: { targetLevel: 1, remainingTicks: 17 },
          acquisitionPath: "PURCHASE_BUILD",
        }),
        materializePersistentStructureState({
          id: "upgrading-fort-internal",
          ownerId: "alpha",
          type: "FORT",
          cellId: 1,
          completedLevel: 1,
          active: true,
          construction: { targetLevel: 2, remainingTicks: 9 },
          acquisitionPath: "GRANT",
        }),
        materializePersistentStructureState({
          id: "silo-internal",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 2,
          completedLevel: 2,
          active: true,
          chargeSlots: [
            { slotId: 0, state: "READY" },
            { slotId: 1, state: "RECHARGING", readyAtTick: base.tick + 7 },
          ],
          acquisitionPath: "GRANT",
        }),
      ],
    });
    const session = createControllerQuerySession(state, "alpha", {
      queriesPerDecision: 16,
      materializedCellsPerDecision: 16,
    });

    const fresh = (await session.cells.get(0))?.structure;
    expect(fresh).toEqual({
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      active: false,
      construction: { targetLevel: 1, remainingTicks: 17 },
    });
    expect(fresh).not.toHaveProperty("id");
    expect(fresh).not.toHaveProperty("completedLevel");
    expect(Object.isFrozen(fresh)).toBe(true);
    expect(Object.isFrozen(fresh?.construction)).toBe(true);

    const upgrading = (await session.cells.get(1))?.structure;
    expect(upgrading).toEqual({
      ownerId: "alpha",
      type: "FORT",
      cellId: 1,
      completedLevel: 1,
      active: true,
      construction: { targetLevel: 2, remainingTicks: 9 },
    });
    expect(upgrading).not.toHaveProperty("id");

    const silo = (await session.cells.get(2))?.structure;
    expect(silo).toEqual({
      ownerId: "alpha",
      type: "MISSILE_SILO",
      cellId: 2,
      completedLevel: 2,
      active: true,
      chargeState: {
        ready: 1,
        capacity: 2,
        rechargeRemainingTicks: [7],
      },
    });
    expect(silo).not.toHaveProperty("id");
    expect(Object.isFrozen(silo?.chargeState)).toBe(true);
    expect(Object.isFrozen(silo?.chargeState?.rechargeRemainingTicks)).toBe(true);
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
    const visibleFortCell = await visible.cells.get(12);
    expect(visibleFortCell?.structure).toEqual({
      ownerId: "beta",
      type: "FORT",
      cellId: 12,
      completedLevel: 1,
      active: true,
    });
    expect(visibleFortCell?.structure).not.toHaveProperty("id");

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
    const concealedFortCell = await concealed.cells.get(12);
    expect(concealedFortCell).toMatchObject({ id: 12, ownerId: "beta" });
    expect(concealedFortCell).not.toHaveProperty("structure");

    const self = createControllerQuerySession(concealedState, "beta", limits);
    expect((await self.cells.query(fortField)).items.map((cell) => cell.id)).toEqual(
      Array.from({ length: 25 }, (_, id) => id),
    );
    expect((await self.cells.get(12))?.structure).toEqual({
      ownerId: "beta",
      type: "FORT",
      cellId: 12,
      completedLevel: 1,
      active: true,
    });
  });

  it("makes a P49 blackout field public while suppressing remote observation through it", async () => {
    const alphaRules = compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: [],
    });
    const betaP49Rules = compileRuleProfile(
      RULE_AXIS_REGISTRY,
      originRuleProfileInput(["P49"]),
    );
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-p49-visibility-red",
        width: 100,
        height: 1,
        terrain: Array.from({ length: 100 }, () => "PLAINS" as const),
        initialOwners: [
          "alpha",
          ...Array.from({ length: 99 }, () => "beta" as const),
        ],
        factions: [
          { id: "alpha", rules: alphaRules },
          { id: "beta", rules: betaP49Rules },
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
            cellId: 20,
            level: 1,
          },
          {
            structureId: "beta-blackout",
            ownerId: "beta",
            type: "OBSERVATION_POST",
            cellId: 60,
            level: 1,
          },
        ],
      }),
    );
    const session = createControllerQuerySession(runtime.snapshot(), "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });
    const fortField = {
      kind: "STRUCTURE_FIELD_INSTANCE",
      structureId: "beta-fort",
      field: "FORT",
    } as const;
    const publicBlackoutField = {
      kind: "STRUCTURE_FIELD",
      field: "OBSERVATION",
      referenceFactionId: "beta",
      affiliation: "SELF",
    } as const;

    expect(await session.cells.query(fortField)).toEqual({
      items: [],
      truncated: false,
    });
    expect(
      (await session.cells.query(publicBlackoutField)).items.map((cell) => cell.id),
    ).toEqual(Array.from({ length: 80 }, (_, offset) => offset + 20));
  });
});