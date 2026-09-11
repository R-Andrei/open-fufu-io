import type { ControllerDecision } from "../src/core/controller/ControllerApi";
import { controllerOutputHasExpectedStructure } from "../src/core/controller/ControllerOutputValidation";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  InProcessTestControllerHost,
  type ControllerRoundReceipt,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { tryPurchaseStructureBuild } from "../src/simulation/Structures";

function rulesWithTraits(traitIds: readonly OriginTraitId[] = []) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function controllerConstructionRuntime(
  seed: string,
  traitIds: readonly OriginTraitId[] = [],
) {
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "beta"],
      factions: [
        { id: "alpha", rules: rulesWithTraits(traitIds) },
        { id: "beta", rules: rulesWithTraits() },
      ],
    }),
  );
}

function syncReceipts(
  value:
    | readonly ControllerRoundReceipt[]
    | Promise<readonly ControllerRoundReceipt[]>,
): readonly ControllerRoundReceipt[] {
  expect(value).not.toBeInstanceOf(Promise);
  return value as readonly ControllerRoundReceipt[];
}

function alphaReceipt(receipts: readonly ControllerRoundReceipt[]) {
  const receipt = receipts.find((entry) => entry.factionId === "alpha")?.receipt;
  if (receipt === undefined) throw new Error("missing alpha receipt");
  return receipt;
}

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

  it("rejects construction commands with missing or wrongly typed required fields at the runtime trust boundary", () => {
    const malformed: readonly unknown[] = [
      {
        commands: [
          { kind: "BUILD_STRUCTURE", key: "missing-build-cell", structure: "FORT" },
        ],
      },
      {
        commands: [
          {
            kind: "BUILD_STRUCTURE",
            key: "wrong-build-cell",
            structure: "FORT",
            cellId: "0",
          },
        ],
      },
      {
        commands: [{ kind: "UPGRADE_STRUCTURE", key: "missing-upgrade-cell" }],
      },
      {
        commands: [
          { kind: "UPGRADE_STRUCTURE", key: "wrong-upgrade-cell", cellId: null },
        ],
      },
    ];

    expect(
      malformed.map((output) =>
        controllerOutputHasExpectedStructure("DECIDE", output),
      ),
    ).toEqual(malformed.map(() => false));
  });

  it("rejects duplicate construction command keys atomically before authoritative admission", () => {
    const match = controllerConstructionRuntime("controller-duplicate-key-cert");
    for (let tick = 0; tick < 750; tick += 1) match.tick();

    const receipts = syncReceipts(
      match.runControllerRound(
        new InProcessTestControllerHost({
          alpha() {
            return {
              commands: [
                {
                  kind: "BUILD_STRUCTURE" as const,
                  key: "duplicate-key",
                  structure: "FORT" as const,
                  cellId: 0,
                },
                {
                  kind: "BUILD_STRUCTURE" as const,
                  key: "duplicate-key",
                  structure: "FORT" as const,
                  cellId: 1,
                },
              ],
            };
          },
        }),
      ),
    );

    expect(alphaReceipt(receipts)).toMatchObject({
      accepted: false,
      failure: { code: "CONFLICTING_PROPOSAL", key: "duplicate-key" },
    });
    expect(match.acceptedInputs()).toEqual([]);
    expect(match.snapshot().structures).toEqual([]);
  });

  it("rolls back a multi-build proposal when the first build exhausts the N07 ownership cap", () => {
    const match = controllerConstructionRuntime("controller-cap-conflict-cert", ["N07"]);
    for (let tick = 0; tick < 750; tick += 1) match.tick();

    const receipts = syncReceipts(
      match.runControllerRound(
        new InProcessTestControllerHost({
          alpha() {
            return {
              commands: [
                {
                  kind: "BUILD_STRUCTURE" as const,
                  key: "first-fort",
                  structure: "FORT" as const,
                  cellId: 0,
                },
                {
                  kind: "BUILD_STRUCTURE" as const,
                  key: "second-fort",
                  structure: "FORT" as const,
                  cellId: 1,
                },
              ],
            };
          },
        }),
      ),
    );

    expect(alphaReceipt(receipts)).toMatchObject({
      accepted: false,
      failure: { code: "OWNERSHIP_CAP", key: "second-fort" },
    });
    expect(match.acceptedInputs()).toEqual([]);
    expect(match.snapshot().structures).toEqual([]);
  });

  it("rolls back a multi-build proposal when an earlier build consumes the target structure slot", () => {
    const match = controllerConstructionRuntime("controller-site-conflict-cert");
    for (let tick = 0; tick < 750; tick += 1) match.tick();

    const receipts = syncReceipts(
      match.runControllerRound(
        new InProcessTestControllerHost({
          alpha() {
            return {
              commands: [
                {
                  kind: "BUILD_STRUCTURE" as const,
                  key: "first-site-build",
                  structure: "FORT" as const,
                  cellId: 0,
                },
                {
                  kind: "BUILD_STRUCTURE" as const,
                  key: "second-site-build",
                  structure: "FORT" as const,
                  cellId: 0,
                },
              ],
            };
          },
        }),
      ),
    );

    expect(alphaReceipt(receipts)).toMatchObject({
      accepted: false,
      failure: { code: "CELL_OCCUPIED", key: "second-site-build" },
    });
    expect(match.acceptedInputs()).toEqual([]);
    expect(match.snapshot().structures).toEqual([]);
  });

  it("ignores hostile extra construction fields rather than allowing authority or identity injection", () => {
    const match = controllerConstructionRuntime("controller-extra-field-cert");
    for (let tick = 0; tick < 250; tick += 1) match.tick();

    const receipts = syncReceipts(
      match.runControllerRound(
        new InProcessTestControllerHost({
          alpha() {
            return {
              commands: [
                {
                  kind: "BUILD_STRUCTURE",
                  key: "extra-field-build",
                  structure: "FORT",
                  cellId: 0,
                  ownerId: "beta",
                  structureId: "controller-forged-id",
                },
              ],
            } as unknown as ControllerDecision;
          },
        }),
      ),
    );

    expect(alphaReceipt(receipts)).toMatchObject({ accepted: true });
    const accepted = match.acceptedInputs()[0]?.action;
    expect(accepted).toMatchObject({
      type: "PURCHASE_STRUCTURE_BUILD",
      ownerId: "alpha",
      structureType: "FORT",
      cellId: 0,
    });
    if (accepted?.type !== "PURCHASE_STRUCTURE_BUILD") {
      throw new Error("missing accepted controller build action");
    }
    expect(accepted.structureId).not.toBe("controller-forged-id");
  });
});
