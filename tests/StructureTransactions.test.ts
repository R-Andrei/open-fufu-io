import type { StructureType } from "../src/core/controller/ControllerApi";
import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import * as StructureTransactions from "../src/simulation/Structures";
import type { PersistentStructureState } from "../src/simulation/Structures";
import { TickEngine } from "../src/simulation/TickEngine";

interface TransactionSuccess {
  readonly ok: true;
  readonly factions: MatchState["factions"];
  readonly structures: MatchState["structures"];
}

interface TransactionFailure {
  readonly ok: false;
  readonly failure: Readonly<{ readonly code: string }>;
}

type TransactionResult = TransactionSuccess | TransactionFailure;

type TestTerrain = "PLAINS" | "TUNDRA" | "DEEP_WATER";

function rulesWith(
  traitIds: readonly OriginTraitId[] = [],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function requiredTransaction(
  name: "tryPurchaseStructureBuild" | "tryPurchaseStructureUpgrade",
): (state: MatchState, request: Record<string, unknown>) => TransactionResult {
  const value = (StructureTransactions as unknown as Record<string, unknown>)[name];
  if (typeof value !== "function") {
    throw new Error(`missing structure purchase transaction capability ${name}`);
  }
  return value as (
    state: MatchState,
    request: Record<string, unknown>,
  ) => TransactionResult;
}

function purchaseBuild(
  state: MatchState,
  request: {
    readonly structureId: string;
    readonly ownerId: string;
    readonly type: StructureType;
    readonly cellId: number;
  },
): TransactionResult {
  return requiredTransaction("tryPurchaseStructureBuild")(state, request);
}

function purchaseUpgrade(
  state: MatchState,
  request: {
    readonly structureId: string;
    readonly ownerId: string;
  },
): TransactionResult {
  return requiredTransaction("tryPurchaseStructureUpgrade")(state, request);
}

function stateFor(options: {
  readonly alphaRules?: ReturnType<typeof rulesWith>;
  readonly ffy?: number;
  readonly peakTotal?: number;
  readonly terrain?: readonly TestTerrain[];
  readonly owners?: readonly (string | null)[];
  readonly structures?: readonly PersistentStructureState[];
} = {}): MatchState {
  const terrain = options.terrain ?? ["PLAINS", "PLAINS", "PLAINS", "PLAINS"];
  const owners =
    options.owners ??
    terrain.map((_, index) => (index === terrain.length - 1 ? "beta" : "alpha"));
  if (owners.length !== terrain.length) {
    throw new Error("test ownership must match terrain length");
  }

  let state = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "structure-transaction-proof",
      width: terrain.length,
      height: 1,
      terrain,
      initialOwners: owners,
      factions: [
        { id: "alpha", rules: options.alphaRules ?? rulesWith() },
        { id: "beta", rules: rulesWith() },
      ],
    }),
  );

  state = createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === "alpha"
        ? {
            ...faction,
            ...(options.ffy === undefined ? {} : { ffy: options.ffy }),
            ...(options.peakTotal === undefined
              ? {}
              : {
                  population: {
                    ...faction.population,
                    peakTotal: options.peakTotal,
                  },
                }),
          }
        : faction,
    ),
    ...(options.structures === undefined
      ? {}
      : { structures: options.structures }),
  });
  return state;
}

function setAlphaFfy(state: MatchState, ffy: number): MatchState {
  return createProspectiveMatchState(state, {
    factions: state.factions.map((faction) =>
      faction.id === "alpha" ? { ...faction, ffy } : faction,
    ),
  });
}

function commitTransaction(
  state: MatchState,
  result: TransactionResult,
): MatchState {
  if (!result.ok) throw new Error(`transaction rejected: ${result.failure.code}`);
  return createProspectiveMatchState(state, {
    factions: result.factions,
    structures: result.structures,
  });
}

function alphaFfy(state: MatchState): number {
  const alpha = state.factions.find((faction) => faction.id === "alpha");
  if (alpha === undefined) throw new Error("missing alpha faction");
  return alpha.ffy;
}

function alphaPurchaseHistory(state: MatchState): readonly string[] {
  const alpha = state.factions.find((faction) => faction.id === "alpha");
  if (alpha === undefined) throw new Error("missing alpha faction");
  return (
    alpha as typeof alpha & {
      readonly successfulStructurePurchaseTypes: readonly string[];
    }
  ).successfulStructurePurchaseTypes;
}

function expectRejectedWithoutMutation(
  state: MatchState,
  result: TransactionResult,
  code: string,
): void {
  expect(result).toEqual(
    expect.objectContaining({ ok: false, failure: { code } }),
  );
  expect(canonicalMatchStateSerialization(state)).toBe(
    canonicalMatchStateSerialization(state),
  );
}

describe("transactional persistent-structure purchases", () => {
  it("enforces cost-1 / exact-cost build affordability and atomically creates one inactive L1 build", () => {
    const below = stateFor({ ffy: 49_999 });
    const before = canonicalMatchStateSerialization(below);
    const rejected = purchaseBuild(below, {
      structureId: "fort-below",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
    });
    expect(rejected).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "INSUFFICIENT_FFY" },
      }),
    );
    expect(canonicalMatchStateSerialization(below)).toBe(before);

    const exact = stateFor({ ffy: 50_000 });
    const accepted = purchaseBuild(exact, {
      structureId: "fort-exact",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
    });
    expect(accepted.ok).toBe(true);
    const committed = commitTransaction(exact, accepted);
    expect(alphaFfy(committed)).toBe(0);
    expect(committed.structures).toEqual([
      expect.objectContaining({
        id: "fort-exact",
        ownerId: "alpha",
        type: "FORT",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 50 },
        acquisitionPath: "PURCHASE_BUILD",
      }),
    ]);
  });

  it("keeps build-cost composition exact across P09 then Echo specialization before the single FFY ceil", () => {
    const rules = rulesWith(
      ["P09"],
      [
        echoRuleContribution(
          "structure.FORT.build_cost",
          "BENEFICIAL",
          500,
          "test:fort-build-cost",
        ),
      ],
    );
    // 50,000 × 0.92 × 0.95 = 43,700 exactly.
    const below = stateFor({ alphaRules: rules, ffy: 43_699 });
    expect(
      purchaseBuild(below, {
        structureId: "fort-discount-below",
        ownerId: "alpha",
        type: "FORT",
        cellId: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "INSUFFICIENT_FFY" },
      }),
    );

    const exact = stateFor({ alphaRules: rules, ffy: 43_700 });
    const accepted = purchaseBuild(exact, {
      structureId: "fort-discount-exact",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
    });
    const committed = commitTransaction(exact, accepted);
    expect(alphaFfy(committed)).toBe(0);
  });

  it("honors P11 terminal zero cost while still requiring the canonical SAM ownership entitlement", () => {
    const locked = stateFor({
      alphaRules: rulesWith(["P11"]),
      ffy: 0,
      peakTotal: 24_999,
    });
    expect(
      purchaseBuild(locked, {
        structureId: "sam-locked",
        ownerId: "alpha",
        type: "SAM_LAUNCHER",
        cellId: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "OWNERSHIP_CAP" },
      }),
    );

    const unlocked = stateFor({
      alphaRules: rulesWith(["P11"]),
      ffy: 0,
      peakTotal: 25_000,
    });
    const accepted = purchaseBuild(unlocked, {
      structureId: "sam-free",
      ownerId: "alpha",
      type: "SAM_LAUNCHER",
      cellId: 0,
    });
    const committed = commitTransaction(unlocked, accepted);
    expect(alphaFfy(committed)).toBe(0);
    expect(committed.structures[0]).toEqual(
      expect.objectContaining({
        id: "sam-free",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 150 },
      }),
    );
  });

  it("persists P21 per-type purchase entitlement, ignores grants, and requires affordability before a free spend", () => {
    const rules = rulesWith(["P21"]);
    const initial = stateFor({ alphaRules: rules, ffy: 50_000 });
    const grant = StructureTransactions.tryMaterializeStructureGrant(initial, {
      structureId: "fort-grant",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
      level: 1,
    });
    expect(grant.ok).toBe(true);
    if (!grant.ok) throw new Error(grant.failure.code);
    const granted = createProspectiveMatchState(initial, {
      structures: grant.structures,
    });

    const firstPurchase = purchaseBuild(granted, {
      structureId: "fort-first-purchase",
      ownerId: "alpha",
      type: "FORT",
      cellId: 1,
    });
    const afterFirst = commitTransaction(granted, firstPurchase);
    expect(alphaFfy(afterFirst)).toBe(50_000);
    expect(alphaPurchaseHistory(afterFirst)).toEqual(["FORT"]);

    const secondPurchase = purchaseBuild(afterFirst, {
      structureId: "fort-second-purchase",
      ownerId: "alpha",
      type: "FORT",
      cellId: 2,
    });
    const afterSecond = commitTransaction(afterFirst, secondPurchase);
    expect(alphaFfy(afterSecond)).toBe(0);
    expect(alphaPurchaseHistory(afterSecond)).toEqual(["FORT"]);

    const unaffordable = stateFor({ alphaRules: rules, ffy: 49_999 });
    const before = canonicalMatchStateSerialization(unaffordable);
    expect(
      purchaseBuild(unaffordable, {
        structureId: "fort-unaffordable",
        ownerId: "alpha",
        type: "FORT",
        cellId: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "INSUFFICIENT_FFY" },
      }),
    );
    expect(canonicalMatchStateSerialization(unaffordable)).toBe(before);

    const nowAffordable = setAlphaFfy(unaffordable, 50_000);
    const laterAccepted = purchaseBuild(nowAffordable, {
      structureId: "fort-affordable",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
    });
    const afterLater = commitTransaction(nowAffordable, laterAccepted);
    expect(alphaFfy(afterLater)).toBe(50_000);
    expect(alphaPurchaseHistory(afterLater)).toEqual(["FORT"]);
  });

  it("composes P41 direct-L5 City purchase with P21 affordability-before-free-spend", () => {
    const rules = rulesWith(["P41", "P21"]);
    const below = stateFor({ alphaRules: rules, ffy: 1_994_999 });
    expect(
      purchaseBuild(below, {
        structureId: "city-p41-below",
        ownerId: "alpha",
        type: "CITY",
        cellId: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "INSUFFICIENT_FFY" },
      }),
    );

    const exact = stateFor({ alphaRules: rules, ffy: 1_995_000 });
    const accepted = purchaseBuild(exact, {
      structureId: "city-p41",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
    });
    const committed = commitTransaction(exact, accepted);
    expect(alphaFfy(committed)).toBe(1_995_000);
    expect(alphaPurchaseHistory(committed)).toEqual(["CITY"]);
    expect(committed.structures[0]).toEqual(
      expect.objectContaining({
        id: "city-p41",
        completedLevel: undefined,
        active: false,
        construction: { targetLevel: 5, remainingTicks: 50 },
      }),
    );
  });

  it("atomically prices P17 upgrades and leaves N06/max-level/already-upgrading rejections untouched", () => {
    const cityL1 = StructureTransactions.materializePersistentStructureState({
      id: "city-upgrade",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    const p17 = stateFor({
      alphaRules: rulesWith(["P17"]),
      ffy: 198_000,
      structures: [cityL1],
    });
    const accepted = purchaseUpgrade(p17, {
      structureId: "city-upgrade",
      ownerId: "alpha",
    });
    const committed = commitTransaction(p17, accepted);
    expect(alphaFfy(committed)).toBe(0);
    expect(committed.structures[0]).toEqual(
      expect.objectContaining({
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 50 },
      }),
    );

    const n06 = stateFor({
      alphaRules: rulesWith(["N06"]),
      ffy: 200_000,
      structures: [cityL1],
    });
    const n06Before = canonicalMatchStateSerialization(n06);
    expect(
      purchaseUpgrade(n06, {
        structureId: "city-upgrade",
        ownerId: "alpha",
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "UPGRADE_NOT_PERMITTED" },
      }),
    );
    expect(canonicalMatchStateSerialization(n06)).toBe(n06Before);

    const maxCity = StructureTransactions.materializePersistentStructureState({
      ...cityL1,
      id: "city-max",
      completedLevel: 5,
    });
    const maxState = stateFor({ ffy: 800_000, structures: [maxCity] });
    const maxBefore = canonicalMatchStateSerialization(maxState);
    expect(
      purchaseUpgrade(maxState, {
        structureId: "city-max",
        ownerId: "alpha",
      }),
    ).toEqual(
      expect.objectContaining({ ok: false, failure: { code: "MAX_LEVEL" } }),
    );
    expect(canonicalMatchStateSerialization(maxState)).toBe(maxBefore);

    const upgradingCity = StructureTransactions.materializePersistentStructureState({
      ...cityL1,
      id: "city-busy",
      construction: { targetLevel: 2, remainingTicks: 12 },
    });
    const busyState = stateFor({ ffy: 200_000, structures: [upgradingCity] });
    const busyBefore = canonicalMatchStateSerialization(busyState);
    expect(
      purchaseUpgrade(busyState, {
        structureId: "city-busy",
        ownerId: "alpha",
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "CONSTRUCTION_IN_PROGRESS" },
      }),
    );
    expect(canonicalMatchStateSerialization(busyState)).toBe(busyBefore);
  });

  it("rejects ownership, type-permission, and Port-interface failures before FFY mutation while P46 can expand terrain permission", () => {
    const existingFort = StructureTransactions.materializePersistentStructureState({
      id: "fort-existing",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    const capped = stateFor({
      alphaRules: rulesWith(["N07"]),
      ffy: 50_000,
      structures: [existingFort],
    });
    const cappedBefore = canonicalMatchStateSerialization(capped);
    expect(
      purchaseBuild(capped, {
        structureId: "fort-capped",
        ownerId: "alpha",
        type: "FORT",
        cellId: 1,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "OWNERSHIP_CAP" },
      }),
    );
    expect(canonicalMatchStateSerialization(capped)).toBe(cappedBefore);

    const noFactory = stateFor({
      alphaRules: rulesWith(["N09"]),
      ffy: 150_000,
    });
    const noFactoryBefore = canonicalMatchStateSerialization(noFactory);
    expect(
      purchaseBuild(noFactory, {
        structureId: "factory-forbidden",
        ownerId: "alpha",
        type: "FACTORY",
        cellId: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "BUILD_NOT_PERMITTED" },
      }),
    );
    expect(canonicalMatchStateSerialization(noFactory)).toBe(noFactoryBefore);

    const badPort = stateFor({
      ffy: 100_000,
      terrain: ["PLAINS", "PLAINS"],
      owners: ["alpha", "beta"],
    });
    const badPortBefore = canonicalMatchStateSerialization(badPort);
    expect(
      purchaseBuild(badPort, {
        structureId: "port-no-deep-water",
        ownerId: "alpha",
        type: "PORT",
        cellId: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
      }),
    );
    expect(canonicalMatchStateSerialization(badPort)).toBe(badPortBefore);

    const tundra = stateFor({
      alphaRules: rulesWith(["P46"]),
      ffy: 50_000,
      terrain: ["TUNDRA", "PLAINS"],
      owners: ["alpha", "beta"],
    });
    const tundraAccepted = purchaseBuild(tundra, {
      structureId: "fort-tundra",
      ownerId: "alpha",
      type: "FORT",
      cellId: 0,
    });
    const tundraCommitted = commitTransaction(tundra, tundraAccepted);
    expect(alphaFfy(tundraCommitted)).toBe(0);
    expect(tundraCommitted.structures[0]).toEqual(
      expect.objectContaining({ id: "fort-tundra", cellId: 0 }),
    );
  });

  it("keeps paid in-progress upgrade state and payment when capture transfers the structure later in the same tick", () => {
    const city = StructureTransactions.materializePersistentStructureState({
      id: "city-capture-upgrade",
      ownerId: "alpha",
      type: "CITY",
      cellId: 0,
      completedLevel: 1,
      active: true,
      acquisitionPath: "GRANT",
    });
    const initial = stateFor({ ffy: 200_000, structures: [city] });
    const upgraded = commitTransaction(
      initial,
      purchaseUpgrade(initial, {
        structureId: "city-capture-upgrade",
        ownerId: "alpha",
      }),
    );
    expect(alphaFfy(upgraded)).toBe(0);

    const nextOwnership = [...upgraded.ownership];
    nextOwnership[0] = "beta";
    const structures = StructureTransactions.resolvePersistentStructureLifecycleTick(
      upgraded,
      nextOwnership,
      upgraded.tick + 1,
    );
    const captured = createProspectiveMatchState(upgraded, {
      ownership: nextOwnership,
      structures,
    });

    expect(alphaFfy(captured)).toBe(0);
    expect(captured.structures[0]).toEqual(
      expect.objectContaining({
        id: "city-capture-upgrade",
        ownerId: "beta",
        completedLevel: 1,
        active: true,
        construction: { targetLevel: 2, remainingTicks: 49 },
        acquisitionPath: "CAPTURE_TRANSFER",
      }),
    );
  });

  it("uses accepted-input sequence for same-tick slot conflicts and rejects duplicate sequence identities", () => {
    const initial = stateFor({
      alphaRules: rulesWith(["P21", "N07"]),
      ffy: 50_000,
    });
    const engine = new TickEngine();
    const first = {
      tick: 1,
      sequence: 0,
      action: {
        type: "PURCHASE_STRUCTURE_BUILD",
        structureId: "fort-seq-a",
        ownerId: "alpha",
        structureType: "FORT",
        cellId: 0,
      },
    } as const;
    const second = {
      tick: 1,
      sequence: 1,
      action: {
        type: "PURCHASE_STRUCTURE_BUILD",
        structureId: "fort-seq-b",
        ownerId: "alpha",
        structureType: "FORT",
        cellId: 1,
      },
    } as const;
    const before = canonicalMatchStateSerialization(initial);
    expect(() =>
      engine.applyAcceptedInputs(initial, [first, second] as never),
    ).toThrow(/OWNERSHIP_CAP/i);
    expect(canonicalMatchStateSerialization(initial)).toBe(before);

    expect(() =>
      engine.applyAcceptedInputs(initial, [first, { ...first }] as never),
    ).toThrow(/duplicate accepted input sequence/i);
    expect(canonicalMatchStateSerialization(initial)).toBe(before);
  });

  it("records ordered purchases as replayable accepted inputs without allowing same-tick site or FFY double-spend", () => {
    const alphaRules = rulesWith(["P21"]);
    const spec = createMicroSimulationSpec({
      seed: "structure-purchase-replay",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "alpha", "beta"],
      factions: [
        { id: "alpha", rules: alphaRules },
        { id: "beta", rules: rulesWith() },
      ],
    });
    const runtime = new MatchRuntime(spec);
    for (let tick = 0; tick < 250; tick += 1) runtime.tick();
    expect(alphaFfy(runtime.snapshot())).toBe(50_000);

    const first = runtime.acceptAction({
      type: "PURCHASE_STRUCTURE_BUILD",
      structureId: "fort-runtime-a",
      ownerId: "alpha",
      structureType: "FORT",
      cellId: 0,
    } as never);
    const second = runtime.acceptAction({
      type: "PURCHASE_STRUCTURE_BUILD",
      structureId: "fort-runtime-b",
      ownerId: "alpha",
      structureType: "FORT",
      cellId: 1,
    } as never);
    expect(first.sequence).toBe(0);
    expect(second.sequence).toBe(1);

    expect(() =>
      runtime.acceptAction({
        type: "PURCHASE_STRUCTURE_BUILD",
        structureId: "fort-runtime-site-conflict",
        ownerId: "alpha",
        structureType: "FORT",
        cellId: 0,
      } as never),
    ).toThrow(/CELL_OCCUPIED/i);
    expect(() =>
      runtime.acceptAction({
        type: "PURCHASE_STRUCTURE_BUILD",
        structureId: "fort-runtime-balance-conflict",
        ownerId: "alpha",
        structureType: "FORT",
        cellId: 2,
      } as never),
    ).toThrow(/INSUFFICIENT_FFY/i);
    expect(runtime.acceptedInputs()).toHaveLength(2);

    runtime.tick();
    const finalState = runtime.snapshot();
    expect(finalState.tick).toBe(251);
    expect(alphaFfy(finalState)).toBe(100);
    expect(alphaPurchaseHistory(finalState)).toEqual(["FORT"]);
    expect(finalState.structures).toEqual([
      expect.objectContaining({
        id: "fort-runtime-a",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 49 },
      }),
      expect.objectContaining({
        id: "fort-runtime-b",
        active: false,
        construction: { targetLevel: 1, remainingTicks: 49 },
      }),
    ]);

    const regenerated = MatchRuntime.regenerate(
      spec,
      runtime.acceptedInputs(),
      finalState.tick,
    );
    expect(regenerated.snapshot()).toEqual(finalState);
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
    expect(regenerated.acceptedInputs()).toEqual(runtime.acceptedInputs());
  });
});
