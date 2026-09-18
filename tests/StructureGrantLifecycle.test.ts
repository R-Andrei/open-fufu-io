import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createInitialMatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import type { PersistentStructureState } from "../src/simulation/Structures";
import { tryMaterializeStructureGrant } from "../src/simulation/StructuresCore";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

type SiloWithChargeSlots = PersistentStructureState & {
  readonly chargeSlots?: readonly {
    readonly slotId: number;
    readonly state: "READY" | "RECHARGING";
    readonly readyAtTick?: number;
  }[];
};

describe("persistent structure grant lifecycle", () => {
  it("starts a granted L1 Missile Silo with deterministic READY slot 0 and fingerprints it", () => {
    const rules = emptyRules();
    const spec = createMicroSimulationSpec({
      seed: "silo-grant-charge-bank",
      width: 2,
      height: 2,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "beta", "beta"],
      initialStructureGrants: [
        {
          structureId: "alpha-silo",
          ownerId: "alpha",
          type: "MISSILE_SILO",
          cellId: 0,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    });
    const dependencies = {
      controllerReferenceNamespace: "silo-grant-charge-bank",
    } as const;

    const runtime = new MatchRuntime(spec, dependencies);
    const structure = runtime.snapshot().structures[0] as
      | SiloWithChargeSlots
      | undefined;

    expect(structure?.chargeSlots).toEqual([{ slotId: 0, state: "READY" }]);
    expect(JSON.parse(runtime.stateFingerprint()).structures[0].chargeSlots).toEqual([
      { slotId: 0, state: "READY" },
    ]);

    const regenerated = MatchRuntime.regenerate(spec, [], 0, dependencies);
    expect(regenerated.snapshot()).toEqual(runtime.snapshot());
    expect(regenerated.stateFingerprint()).toBe(runtime.stateFingerprint());
  });

  it("rejects a Factory grant when its only non-water output candidate is Mountain", () => {
    const rules = emptyRules();
    const state = createInitialMatchState(createMicroSimulationSpec({
      seed: "factory-output-mountain-red",
      width: 3,
      height: 1,
      terrain: ["MOUNTAIN", "PLAINS", "DEEP_WATER"],
      initialOwners: ["alpha", "alpha", null],
      factions: [{ id: "alpha", rules }],
    }));

    expect(tryMaterializeStructureGrant(state, {
      structureId: "factory-mountain-output",
      ownerId: "alpha",
      type: "FACTORY",
      cellId: 1,
      level: 1,
    })).toEqual({
      ok: false,
      failure: { code: "PLACEMENT_GEOMETRY_UNAVAILABLE" },
    });
  });
});
