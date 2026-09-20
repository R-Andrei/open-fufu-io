import { describe, expect, it } from "vitest";

import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createAdvancedMatchState,
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";
import {
  advanceWarshipProductionPhase,
  advanceWarshipStrategicLauncherPhase,
  applyWarshipNavalXp,
  tryCommitWarshipStrategicLaunchCharge,
  tryStartWarshipProduction,
  warshipStrategicLauncherProfile,
} from "../src/simulation/Warships";

function rules(
  traits: readonly OriginTraitId[] = [],
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
              `issue215-cert:${rechargeEchoBp}`,
            ),
          ]),
    ],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function fixture(
  traits: readonly OriginTraitId[] = [],
  rechargeEchoBp = 0,
): MatchState {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: `issue215-cert:${traits.join(",")}:${rechargeEchoBp}`,
      width: 4,
      height: 2,
      terrain: [
        "DEEP_WATER",
        "PLAINS",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
      ],
      initialOwners: [null, "alpha", null, null, null, null, null, null],
      factions: [{ id: "alpha", rules: rules(traits, rechargeEchoBp) }],
    }),
  );
  return createProspectiveMatchState(base, {
    factions: base.factions.map((faction) =>
      Object.freeze({ ...faction, ffy: 2_000_000 }),
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
  traits: readonly OriginTraitId[] = [],
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
  if (!accepted.ok) throw new Error("expected Warship production");
  let state = accepted.state;
  for (let step = 0; step < 50; step += 1) {
    state = advanceWarshipProductionPhase(state);
  }
  return state;
}

function launcherState(state: MatchState, unitId: string) {
  return state.warshipOperationalStates.find(
    (entry) => entry.unitId === unitId,
  )?.strategicLauncher;
}

describe("issue #215 adversarial certification", () => {
  it("rejects restored Warship rank above the owner's effective cap while accepting P22 rank 5", () => {
    const ordinary = deployed();
    const ordinaryId = ordinary.mobileUnits[0]!.id;

    expect(() =>
      createProspectiveMatchState(ordinary, {
        warshipOperationalStates: ordinary.warshipOperationalStates.map(
          (entry) =>
            entry.unitId === ordinaryId
              ? Object.freeze({ ...entry, rank: 4, navalXp: 0 })
              : entry,
        ),
      }),
    ).toThrow(/rank cap|maximum rank/i);

    const p22 = deployed(["P22"]);
    const p22Id = p22.mobileUnits[0]!.id;
    const ranked = applyWarshipNavalXp(p22, p22Id, 400);
    expect(
      ranked.warshipOperationalStates.find((entry) => entry.unitId === p22Id),
    ).toMatchObject({ rank: 5, navalXp: 0 });
    expect(() =>
      createProspectiveMatchState(ranked, {
        warshipOperationalStates: ranked.warshipOperationalStates,
      }),
    ).not.toThrow();
    expect(() =>
      createProspectiveMatchState(ranked, {
        warshipOperationalStates: ranked.warshipOperationalStates.map(
          (entry) =>
            entry.unitId === p22Id
              ? Object.freeze({ ...entry, rank: 6, navalXp: 0 })
              : entry,
        ),
      }),
    ).toThrow(/rank cap|maximum rank/i);
  });

  it("rejects malformed/restored P29 launcher ownership and slot-capacity state", () => {
    const p29 = deployed(["P29"]);
    const unitId = p29.mobileUnits[0]!.id;
    const operational = p29.warshipOperationalStates[0]!;

    const {
      strategicLauncher: _removed,
      ...withoutLauncher
    } = operational;
    expect(() =>
      createProspectiveMatchState(p29, {
        warshipOperationalStates: [withoutLauncher],
      }),
    ).toThrow(/missing strategic launcher/i);

    expect(() =>
      createProspectiveMatchState(p29, {
        warshipOperationalStates: [
          Object.freeze({
            ...operational,
            strategicLauncher: Object.freeze({
              acceptedLaunchCount: 0,
              chargeSlots: Object.freeze([
                Object.freeze({ slotId: 1, state: "READY" as const }),
              ]),
            }),
          }),
        ],
      }),
    ).toThrow(/contiguous|capacity/i);

    const ordinary = deployed();
    const ordinaryOperational = ordinary.warshipOperationalStates[0]!;
    expect(() =>
      createProspectiveMatchState(ordinary, {
        warshipOperationalStates: [
          Object.freeze({
            ...ordinaryOperational,
            strategicLauncher: Object.freeze({
              acceptedLaunchCount: 0,
              chargeSlots: Object.freeze([
                Object.freeze({ slotId: 0, state: "READY" as const }),
              ]),
            }),
          }),
        ],
      }),
    ).toThrow(/non-P29/i);

    expect(warshipStrategicLauncherProfile(p29, unitId)).toBeDefined();
  });

  it("never substitutes a different ready P29 Warship when the exact launcher has no ready charge", () => {
    const first = deployed(["P29"]);
    const firstUnit = first.mobileUnits[0]!;
    const firstOperational = first.warshipOperationalStates[0]!;
    const created = createMobileUnit(
      first.map,
      first.factions.map((faction) => faction.id),
      first,
      {
        ownerId: "alpha",
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId: 3,
      },
    );
    const two = createProspectiveMatchState(first, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        firstOperational,
        Object.freeze({
          ...firstOperational,
          unitId: created.unit.id,
          operatingAnchorCellId: 3,
          strategicLauncher: Object.freeze({
            acceptedLaunchCount: 0,
            chargeSlots: Object.freeze([
              Object.freeze({ slotId: 0, state: "READY" as const }),
            ]),
          }),
        }),
      ],
    });

    const spent = tryCommitWarshipStrategicLaunchCharge(two, {
      ownerId: "alpha",
      unitId: firstUnit.id,
      weapon: "ATOM_BOMB",
    });
    expect(spent.ok).toBe(true);
    if (!spent.ok) throw new Error("expected first launcher charge spend");

    const exactRetry = tryCommitWarshipStrategicLaunchCharge(spent.state, {
      ownerId: "alpha",
      unitId: firstUnit.id,
      weapon: "ATOM_BOMB",
    });
    expect(exactRetry).toMatchObject({
      ok: false,
      failure: { code: "NO_READY_CHARGE" },
    });
    expect(exactRetry.state).toBe(spent.state);
    expect(
      launcherState(spent.state, created.unit.id)?.chargeSlots,
    ).toEqual([{ slotId: 0, state: "READY" }]);
  });

  it("spends slot 0 when multiple P29 charge slots are simultaneously READY", () => {
    let state = deployed(["P29"]);
    const unitId = state.mobileUnits[0]!.id;
    state = applyWarshipNavalXp(state, unitId, 100);

    for (let tick = 0; tick < 90; tick += 1) {
      state = createAdvancedMatchState(state, {});
      state = advanceWarshipStrategicLauncherPhase(state);
    }
    expect(launcherState(state, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "READY" },
      { slotId: 1, state: "READY" },
    ]);

    const committed = tryCommitWarshipStrategicLaunchCharge(state, {
      ownerId: "alpha",
      unitId,
      weapon: "ATOM_BOMB",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) throw new Error("expected multi-ready charge commit");
    expect(committed.binding.slotId).toBe(0);
    expect(launcherState(committed.state, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "RECHARGING", readyAtTick: 180 },
      { slotId: 1, state: "READY" },
    ]);
  });

  it("keeps an existing absolute recharge deadline when recharge modifiers later change", () => {
    const initial = deployed(["P29"]);
    const unitId = initial.mobileUnits[0]!.id;
    const spent = tryCommitWarshipStrategicLaunchCharge(initial, {
      ownerId: "alpha",
      unitId,
      weapon: "ATOM_BOMB",
    });
    expect(spent.ok).toBe(true);
    if (!spent.ok) throw new Error("expected charge spend");
    expect(launcherState(spent.state, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "RECHARGING", readyAtTick: 90 },
    ]);

    const changedRules = rules(["P29"], 500);
    let changed = createProspectiveMatchState(spent.state, {
      factions: spent.state.factions.map((faction) =>
        Object.freeze({ ...faction, rules: changedRules }),
      ),
    });
    expect(
      warshipStrategicLauncherProfile(changed, unitId)?.rechargeTicks,
    ).toBe(86);

    for (let tick = 0; tick < 89; tick += 1) {
      changed = createAdvancedMatchState(changed, {});
      changed = advanceWarshipStrategicLauncherPhase(changed);
    }
    expect(launcherState(changed, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "RECHARGING", readyAtTick: 90 },
    ]);

    changed = createAdvancedMatchState(changed, {});
    changed = advanceWarshipStrategicLauncherPhase(changed);
    expect(launcherState(changed, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "READY" },
    ]);
  });

  it("matures P29 charge state through ordinary TickEngine advancement without manual launcher calls", () => {
    const initial = deployed(["P29"], 9_000);
    const unitId = initial.mobileUnits[0]!.id;
    const profile = warshipStrategicLauncherProfile(initial, unitId);
    expect(profile?.rechargeTicks).toBe(9);

    const spent = tryCommitWarshipStrategicLaunchCharge(initial, {
      ownerId: "alpha",
      unitId,
      weapon: "ATOM_BOMB",
    });
    expect(spent.ok).toBe(true);
    if (!spent.ok) throw new Error("expected charge spend");

    const engine = new TickEngine();
    let state = spent.state;
    for (let tick = 0; tick < 8; tick += 1) {
      state = engine.advance(state, []);
    }
    expect(launcherState(state, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "RECHARGING", readyAtTick: 9 },
    ]);

    state = engine.advance(state, []);
    expect(launcherState(state, unitId)?.chargeSlots).toEqual([
      { slotId: 0, state: "READY" },
    ]);
  });
});
