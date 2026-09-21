import { describe, expect, it } from "vitest";

import type {
  StrategicWeaponType,
  StructureLevel,
} from "../src/core/controller/ControllerApi";
import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { resolvePassiveFfyTick } from "../src/simulation/Economy";
import {
  canonicalMatchStateSerialization,
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import * as StructuresRuntime from "../src/simulation/Structures";
import { TickEngine } from "../src/simulation/TickEngine";
import {
  advanceWarshipProductionPhase,
  applyWarshipNavalXp,
  removeWarshipUnits,
  tryStartWarshipProduction,
} from "../src/simulation/Warships";
import * as WarshipRuntime from "../src/simulation/Warships";

type ChargeSlot =
  | Readonly<{ slotId: number; state: "READY" }>
  | Readonly<{ slotId: number; state: "RECHARGING"; readyAtTick: number }>;

type LauncherProfile = Readonly<{
  launcherId: string;
  ownerId: string;
  launchCellId: number;
  effectiveSiloLevel: StructureLevel;
  weaponAccess: readonly StrategicWeaponType[];
  chargeCapacity: number;
  rechargeTicks: number;
  acceptedLaunchCount: number;
  chargeSlots: readonly ChargeSlot[];
}>;

type CommitResult =
  | Readonly<{
      ok: true;
      state: MatchState;
      binding: Readonly<{
        launcherId: string;
        launchCellId: number;
        weapon: StrategicWeaponType;
        slotId: number;
        acceptedLaunchOrdinal: number;
      }>;
    }>
  | Readonly<{
      ok: false;
      state: MatchState;
      failure: Readonly<{ code: string }>;
    }>;

function rulesWithTraits(
  traits: readonly OriginTraitId[],
  rechargeEchoBp = 0,
) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [
      ...origin.contributions,
      ...(rechargeEchoBp === 0
        ? []
        : [
            echoRuleContribution(
              "silo.recharge_time",
              "BENEFICIAL",
              rechargeEchoBp,
              `p29-red:recharge:${rechargeEchoBp}`,
            ),
          ]),
    ],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function fixture(
  traits: readonly OriginTraitId[] = ["P29"],
  rechargeEchoBp = 0,
): MatchState {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: `warship-p29-red:${traits.join(",")}:${rechargeEchoBp}`,
      width: 3,
      height: 2,
      terrain: [
        "DEEP_WATER",
        "PLAINS",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
      ],
      initialOwners: [null, "alpha", null, null, null, null],
      factions: [
        {
          id: "alpha",
          rules: rulesWithTraits(traits, rechargeEchoBp),
        },
      ],
    }),
  );
  return createProspectiveMatchState(base, {
    factions: base.factions.map((faction) =>
      Object.freeze({ ...faction, ffy: 500_000 }),
    ),
    structures: [
      {
        id: "port-alpha",
        ownerId: "alpha",
        type: "PORT",
        cellId: 1,
        outputCellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
  });
}

function deployed(
  traits: readonly OriginTraitId[] = ["P29"],
  rechargeEchoBp = 0,
): MatchState {
  const accepted = tryStartWarshipProduction(
    fixture(traits, rechargeEchoBp),
    {
      ownerId: "alpha",
      portId: "port-alpha",
      strategicDestinationCellId: 2,
    },
  );
  expect(accepted.ok).toBe(true);
  if (!accepted.ok) throw new Error("expected P29 Warship production admission");
  let state = accepted.state;
  for (let step = 0; step < 50; step += 1) {
    state = advanceWarshipProductionPhase(state);
  }
  expect(state.mobileUnits).toHaveLength(1);
  return state;
}

function siloProfileApi() {
  const api = StructuresRuntime as unknown as {
    effectiveMissileSiloStrategicProfile?: (
      state: MatchState,
      ownerId: string,
      level: StructureLevel,
    ) => Readonly<{
      level: StructureLevel;
      weaponAccess: readonly StrategicWeaponType[];
      chargeCapacity: number;
      rechargeTicks: number;
    }>;
  };
  if (api.effectiveMissileSiloStrategicProfile === undefined) {
    throw new TypeError("effective Missile Silo strategic profile is not implemented");
  }
  return api.effectiveMissileSiloStrategicProfile;
}

function launcherApi() {
  const api = WarshipRuntime as unknown as {
    warshipStrategicLauncherProfile?: (
      state: MatchState,
      unitId: string,
    ) => LauncherProfile | undefined;
    tryCommitWarshipStrategicLaunchCharge?: (
      state: MatchState,
      request: Readonly<{
        ownerId: string;
        unitId: string;
        weapon: StrategicWeaponType;
      }>,
    ) => CommitResult;
    advanceWarshipStrategicLauncherPhase?: (state: MatchState) => MatchState;
  };
  if (
    api.warshipStrategicLauncherProfile === undefined ||
    api.tryCommitWarshipStrategicLaunchCharge === undefined ||
    api.advanceWarshipStrategicLauncherPhase === undefined
  ) {
    throw new TypeError("P29 Warship strategic-launcher runtime is not implemented");
  }
  return api as Required<typeof api>;
}

function launcherState(state: MatchState, unitId: string): any {
  return (
    state.warshipOperationalStates.find((entry) => entry.unitId === unitId) as
      | (MatchState["warshipOperationalStates"][number] & {
          strategicLauncher?: Readonly<{
            acceptedLaunchCount: number;
            chargeSlots: readonly ChargeSlot[];
          }>;
        })
      | undefined
  )?.strategicLauncher;
}

function advanceLauncherTicks(state: MatchState, ticks: number): MatchState {
  const api = launcherApi();
  let current = state;
  for (let index = 0; index < ticks; index += 1) {
    current = createAdvancedMatchState(current, {});
    current = api.advanceWarshipStrategicLauncherPhase(current);
  }
  return current;
}

describe("P29 Warship mobile strategic launcher runtime", () => {
  it("extracts ordinary Missile Silo level access/capacity/recharge as one reusable Structure-owned profile", () => {
    const profile = siloProfileApi();
    const state = fixture(["P29"], 500);

    expect(profile(state, "alpha", 1)).toEqual({
      level: 1,
      weaponAccess: ["ATOM_BOMB"],
      chargeCapacity: 1,
      rechargeTicks: 86,
    });
    expect(profile(state, "alpha", 2)).toEqual({
      level: 2,
      weaponAccess: ["ATOM_BOMB"],
      chargeCapacity: 2,
      rechargeTicks: 86,
    });
    expect(profile(state, "alpha", 3)).toEqual({
      level: 3,
      weaponAccess: ["ATOM_BOMB", "HYDROGEN_BOMB"],
      chargeCapacity: 3,
      rechargeTicks: 86,
    });
    expect(profile(state, "alpha", 4)).toEqual({
      level: 4,
      weaponAccess: ["ATOM_BOMB", "HYDROGEN_BOMB"],
      chargeCapacity: 4,
      rechargeTicks: 86,
    });
    expect(profile(state, "alpha", 5)).toEqual({
      level: 5,
      weaponAccess: ["ATOM_BOMB", "HYDROGEN_BOMB", "MIRV"],
      chargeCapacity: 5,
      rechargeTicks: 86,
    });
  });

  it("activates a newly deployed P29 Warship as one serialized exact-cell L1 launcher with slot 0 READY", () => {
    const state = deployed();
    const unit = state.mobileUnits[0]!;
    expect(launcherState(state, unit.id)).toEqual({
      acceptedLaunchCount: 0,
      chargeSlots: [{ slotId: 0, state: "READY" }],
    });

    const profile = launcherApi().warshipStrategicLauncherProfile(state, unit.id);
    expect(profile).toEqual({
      launcherId: unit.id,
      ownerId: "alpha",
      launchCellId: unit.cellId,
      effectiveSiloLevel: 1,
      weaponAccess: ["ATOM_BOMB"],
      chargeCapacity: 1,
      rechargeTicks: 90,
      acceptedLaunchCount: 0,
      chargeSlots: [{ slotId: 0, state: "READY" }],
    });

    const serialized = JSON.parse(canonicalMatchStateSerialization(state)) as {
      warshipOperationalStates: readonly {
        unitId: string;
        strategicLauncher?: unknown;
      }[];
    };
    expect(serialized.warshipOperationalStates[0]?.strategicLauncher).toEqual({
      acceptedLaunchCount: 0,
      chargeSlots: [{ slotId: 0, state: "READY" }],
    });

    const ordinary = deployed([]);
    const ordinaryId = ordinary.mobileUnits[0]!.id;
    expect(launcherState(ordinary, ordinaryId)).toBeUndefined();
    expect(
      launcherApi().warshipStrategicLauncherProfile(ordinary, ordinaryId),
    ).toBeUndefined();
  });

  it("rejects unavailable/no-charge launches atomically, spends the lowest READY slot, and matures exactly at readyAtTick", () => {
    const api = launcherApi();
    const state = deployed();
    const unitId = state.mobileUnits[0]!.id;

    const unavailable = api.tryCommitWarshipStrategicLaunchCharge(state, {
      ownerId: "alpha",
      unitId,
      weapon: "HYDROGEN_BOMB",
    });
    expect(unavailable).toMatchObject({
      ok: false,
      failure: { code: "WEAPON_UNAVAILABLE" },
    });
    expect(unavailable.state).toBe(state);

    const accepted = api.tryCommitWarshipStrategicLaunchCharge(state, {
      ownerId: "alpha",
      unitId,
      weapon: "ATOM_BOMB",
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error("expected P29 Atom Bomb charge commit");
    expect(accepted.binding).toEqual({
      launcherId: unitId,
      launchCellId: 0,
      weapon: "ATOM_BOMB",
      slotId: 0,
      acceptedLaunchOrdinal: 0,
    });
    expect(launcherState(accepted.state, unitId)).toEqual({
      acceptedLaunchCount: 1,
      chargeSlots: [
        { slotId: 0, state: "RECHARGING", readyAtTick: 90 },
      ],
    });

    const noCharge = api.tryCommitWarshipStrategicLaunchCharge(
      accepted.state,
      {
        ownerId: "alpha",
        unitId,
        weapon: "ATOM_BOMB",
      },
    );
    expect(noCharge).toMatchObject({
      ok: false,
      failure: { code: "NO_READY_CHARGE" },
    });
    expect(noCharge.state).toBe(accepted.state);

    const beforeReady = advanceLauncherTicks(accepted.state, 89);
    expect(launcherState(beforeReady, unitId)).toEqual({
      acceptedLaunchCount: 1,
      chargeSlots: [
        { slotId: 0, state: "RECHARGING", readyAtTick: 90 },
      ],
    });

    const ready = advanceLauncherTicks(beforeReady, 1);
    expect(launcherState(ready, unitId)).toEqual({
      acceptedLaunchCount: 1,
      chargeSlots: [{ slotId: 0, state: "READY" }],
    });

    const second = api.tryCommitWarshipStrategicLaunchCharge(ready, {
      ownerId: "alpha",
      unitId,
      weapon: "ATOM_BOMB",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("expected recharged P29 launch");
    expect(second.binding.acceptedLaunchOrdinal).toBe(1);
    expect(second.binding.slotId).toBe(0);
  });

  it("preserves existing slots/deadlines/count on rank growth and creates only new capacity RECHARGING", () => {
    const api = launcherApi();
    const state = deployed(["P29"], 500);
    const unitId = state.mobileUnits[0]!.id;
    const spent = api.tryCommitWarshipStrategicLaunchCharge(state, {
      ownerId: "alpha",
      unitId,
      weapon: "ATOM_BOMB",
    });
    expect(spent.ok).toBe(true);
    if (!spent.ok) throw new Error("expected P29 launch before rank-up");
    expect(launcherState(spent.state, unitId)).toEqual({
      acceptedLaunchCount: 1,
      chargeSlots: [
        { slotId: 0, state: "RECHARGING", readyAtTick: 86 },
      ],
    });

    const ranked = applyWarshipNavalXp(spent.state, unitId, 100);
    expect(
      ranked.warshipOperationalStates.find((entry) => entry.unitId === unitId),
    ).toMatchObject({ rank: 2, navalXp: 0 });
    expect(launcherState(ranked, unitId)).toEqual({
      acceptedLaunchCount: 1,
      chargeSlots: [
        { slotId: 0, state: "RECHARGING", readyAtTick: 86 },
        { slotId: 1, state: "RECHARGING", readyAtTick: 86 },
      ],
    });
  });

  it("composes P22 to L5 without resetting launcher state and exposes full Silo weapon access", () => {
    const api = launcherApi();
    const state = deployed(["P22", "P29"]);
    const unitId = state.mobileUnits[0]!.id;
    const ranked = applyWarshipNavalXp(state, unitId, 400);

    expect(
      ranked.warshipOperationalStates.find((entry) => entry.unitId === unitId),
    ).toMatchObject({ rank: 5, navalXp: 0 });
    expect(launcherState(ranked, unitId)).toEqual({
      acceptedLaunchCount: 0,
      chargeSlots: [
        { slotId: 0, state: "READY" },
        { slotId: 1, state: "RECHARGING", readyAtTick: 90 },
        { slotId: 2, state: "RECHARGING", readyAtTick: 90 },
        { slotId: 3, state: "RECHARGING", readyAtTick: 90 },
        { slotId: 4, state: "RECHARGING", readyAtTick: 90 },
      ],
    });
    expect(api.warshipStrategicLauncherProfile(ranked, unitId)).toMatchObject({
      effectiveSiloLevel: 5,
      weaponAccess: ["ATOM_BOMB", "HYDROGEN_BOMB", "MIRV"],
      chargeCapacity: 5,
      acceptedLaunchCount: 0,
    });
  });

  it("uses the Warship current cell without resetting launcher state on movement, removes it on destruction, and never feeds P53", () => {
    const api = launcherApi();
    const state = deployed(["P29", "P53"]);
    const unitId = state.mobileUnits[0]!.id;
    const beforeLauncher = launcherState(state, unitId);

    const moved = new TickEngine().advance(state, []);
    expect(moved.mobileUnits.find((unit) => unit.id === unitId)?.cellId).toBe(3);
    expect(launcherState(moved, unitId)).toEqual(beforeLauncher);
    expect(api.warshipStrategicLauncherProfile(moved, unitId)?.launchCellId).toBe(3);

    const withoutWarship = removeWarshipUnits(moved, [unitId]);
    expect(api.warshipStrategicLauncherProfile(withoutWarship, unitId)).toBeUndefined();
    expect(
      withoutWarship.warshipOperationalStates.some(
        (entry) => entry.unitId === unitId,
      ),
    ).toBe(false);

    expect(resolvePassiveFfyTick(moved)).toEqual(
      resolvePassiveFfyTick(withoutWarship),
    );
  });
});
