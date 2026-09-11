// Independent adversarial certification probes for issue #143.
import type { StructureType } from "../src/core/controller/ControllerApi";
import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  effectiveStructureConstructionTicks,
  evaluateStructureAcquisitionAdmission,
  materializePersistentStructureState,
  resolvePersistentStructureLifecycleTick,
  type PersistentStructureState,
} from "../src/simulation/Structures";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function p46Rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(["P46"]));
}

function fortAreaRules(magnitudeBp: number) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [
      echoRuleContribution(
        "fort.coverage_area",
        "BENEFICIAL",
        magnitudeBp,
        `cert:fort.coverage_area:${magnitudeBp}`,
      ),
    ],
  });
}

function oneFactionState(
  terrain: readonly ("PLAINS" | "TUNDRA" | "DEEP_WATER")[],
  rules = emptyRules(),
) {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "structure-certification",
      width: terrain.length,
      height: 1,
      terrain,
      initialOwners: terrain.map((value) =>
        value === "DEEP_WATER" ? null : "alpha",
      ),
      factions: [{ id: "alpha", rules }],
    }),
  );
}

describe("persistent structure adversarial certification", () => {
  it("rejects an active completed Missile Silo without its canonical charge bank", () => {
    expect(() =>
      materializePersistentStructureState({
        id: "silo-missing-bank",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      }),
    ).toThrow(/charge|slot/i);
  });

  it("rejects an active completed Missile Silo whose slot IDs do not equal 0..level-1", () => {
    expect(() =>
      materializePersistentStructureState({
        id: "silo-wrong-bank",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
        completedLevel: 1,
        active: true,
        chargeSlots: [{ slotId: 1, state: "READY" }],
        acquisitionPath: "GRANT",
      }),
    ).toThrow(/charge|slot/i);
  });

  it("rejects an unknown charge-slot state before authoritative materialization", () => {
    const malformedSlots = [
      { slotId: 0, state: "BROKEN" },
    ] as unknown as PersistentStructureState["chargeSlots"];

    expect(() =>
      materializePersistentStructureState({
        id: "silo-bad-slot-state",
        ownerId: "alpha",
        type: "MISSILE_SILO",
        cellId: 0,
        completedLevel: 1,
        active: true,
        chargeSlots: malformedSlots,
        acquisitionPath: "GRANT",
      }),
    ).toThrow(/state/i);
  });

  it("proves baseline construction duration for all eight persistent structure types", () => {
    const state = oneFactionState(["PLAINS"]);
    const expected = [
      ["CITY", 50],
      ["FORT", 50],
      ["PORT", 50],
      ["FACTORY", 100],
      ["MISSILE_SILO", 150],
      ["SAM_LAUNCHER", 150],
      ["OBSERVATION_POST", 50],
      ["COMMAND_POST", 100],
    ] as const satisfies readonly (readonly [StructureType, number])[];

    for (const [type, ticks] of expected) {
      expect(effectiveStructureConstructionTicks(state, "alpha", type)).toBe(ticks);
    }
  });

  it("keeps P46 Tundra permission separate from the Port Deep-Water interface", () => {
    const baseline = oneFactionState(["TUNDRA", "DEEP_WATER"]);
    const request = {
      structureId: "tundra-port",
      ownerId: "alpha",
      type: "PORT" as const,
      cellId: 0,
      level: 1 as const,
      acquisitionPath: "PURCHASE_BUILD" as const,
    };

    expect(evaluateStructureAcquisitionAdmission(baseline, request)).toEqual({
      ok: false,
      failure: { code: "BUILD_NOT_PERMITTED" },
    });

    const permitted = oneFactionState(
      ["TUNDRA", "DEEP_WATER"],
      p46Rules(),
    );
    expect(evaluateStructureAcquisitionAdmission(permitted, request)).toEqual({
      ok: true,
    });
  });

  it("enforces the global 10-cell center spacing for builds and grants without rechecking transfers", () => {
    const width = 30;
    const height = 20;
    const terrain = Array.from({ length: width * height }, () => "PLAINS" as const);
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "structure-certification-min-spacing",
        width,
        height,
        terrain,
        initialOwners: terrain.map(() => "alpha"),
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const anchorCellId = 5 * width + 5;
    const withAnchor = createProspectiveMatchState(state, {
      structures: [
        materializePersistentStructureState({
          id: "spacing-anchor",
          ownerId: "alpha",
          type: "CITY",
          cellId: anchorCellId,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
      ],
    });

    const admissionAt = (
      structureId: string,
      cellId: number,
      acquisitionPath: "PURCHASE_BUILD" | "GRANT",
    ) =>
      evaluateStructureAcquisitionAdmission(withAnchor, {
        structureId,
        ownerId: "alpha",
        type: "FORT",
        cellId,
        level: 1,
        acquisitionPath,
      });

    expect(admissionAt("straight-nine", 5 * width + 14, "PURCHASE_BUILD")).toEqual({
      ok: false,
      failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
    });
    expect(admissionAt("diagonal-under-ten", 12 * width + 11, "GRANT")).toEqual({
      ok: false,
      failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
    });
    expect(admissionAt("straight-ten", 5 * width + 15, "PURCHASE_BUILD")).toEqual({
      ok: true,
    });
    expect(admissionAt("diagonal-ten", 13 * width + 11, "GRANT")).toEqual({
      ok: true,
    });

    const closeCaptured = materializePersistentStructureState({
      id: "captured-close-port",
      ownerId: "beta",
      type: "PORT",
      cellId: 5 * width + 14,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    const transferState = createProspectiveMatchState(withAnchor, {
      structures: [...withAnchor.structures, closeCaptured],
    });
    expect(
      evaluateStructureAcquisitionAdmission(transferState, {
        structureId: closeCaptured.id,
        ownerId: "alpha",
        type: "PORT",
        cellId: closeCaptured.cellId,
        level: 1,
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    ).toEqual({ ok: true });
  });

  it("re-evaluates a transferred Fort field from the new owner's effective rules", async () => {
    const terrain = Array.from({ length: 50 }, () => "PLAINS" as const);
    const state = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "structure-certification-field-transfer",
        width: terrain.length,
        height: 1,
        terrain,
        initialOwners: terrain.map(() => "beta"),
        factions: [
          { id: "alpha", rules: fortAreaRules(10_000) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const withFort = createProspectiveMatchState(state, {
      structures: [
        materializePersistentStructureState({
          id: "captured-fort",
          ownerId: "beta",
          type: "FORT",
          cellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        }),
      ],
    });

    const before = createControllerQuerySession(withFort, "beta", {
      queriesPerDecision: 4,
      materializedCellsPerDecision: 4,
    });
    expect(
      await before.cells.count({
        kind: "STRUCTURE_FIELD_INSTANCE",
        structureId: "captured-fort",
        field: "FORT",
      }),
    ).toBe(31);

    const nextOwnership = terrain.map(() => "alpha");
    const transferredStructures = resolvePersistentStructureLifecycleTick(
      withFort,
      nextOwnership,
      1,
    );
    const transferred = createProspectiveMatchState(withFort, {
      ownership: nextOwnership,
      structures: transferredStructures,
    });
    const after = createControllerQuerySession(transferred, "alpha", {
      queriesPerDecision: 4,
      materializedCellsPerDecision: 4,
    });

    expect(transferred.structures[0]).toEqual(
      expect.objectContaining({
        id: "captured-fort",
        ownerId: "alpha",
        completedLevel: 1,
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    );
    expect(
      await after.cells.count({
        kind: "STRUCTURE_FIELD_INSTANCE",
        structureId: "captured-fort",
        field: "FORT",
      }),
    ).toBe(43);
  });
});
