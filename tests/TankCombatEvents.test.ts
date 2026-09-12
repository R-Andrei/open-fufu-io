import type { MobileUnitType } from "../src/core/controller/ControllerApi";
import { echoRuleContribution } from "../src/core/rules/EchoRuleRegistry";
import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { RuleContribution } from "../src/core/rules/RuleComposition";
import { resolveAdmittedTankUnitAttacks } from "../src/simulation/TankCombat";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  createMobileUnit,
  type MobileUnitState,
} from "../src/simulation/MobileUnits";
import type {
  UnitAttackResolvedEvent,
  UnitDestroyedEvent,
} from "../src/simulation/SimulationEvents";
import type {
  TankExactHealth,
  TankOperationalState,
} from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";
import { resolveDirectRevealsFromPhysicalEvents } from "../src/simulation/VisibilityState";

function rules(
  traits: readonly OriginTraitId[] = [],
  additional: readonly RuleContribution[] = [],
) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [...origin.contributions, ...additional],
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function fixture(
  options: Readonly<{
    blueTraits?: readonly OriginTraitId[];
    blueAdditional?: readonly RuleContribution[];
    redTraits?: readonly OriginTraitId[];
    redAdditional?: readonly RuleContribution[];
  }> = {},
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-combat-events-red",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["blue", "blue", "green", "red"],
      factions: [
        {
          id: "blue",
          rules: rules(options.blueTraits, options.blueAdditional),
        },
        { id: "green", rules: rules() },
        {
          id: "red",
          rules: rules(options.redTraits, options.redAdditional),
        },
      ],
    }),
  );
}

function addUnit(
  state: MatchState,
  ownerId: string,
  type: "TANK" | "HEAVY_ARTILLERY" | "TRAIN",
  cellId: number,
  health: TankExactHealth = Object.freeze({ numerator: 1_000n, denominator: 1n }),
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId,
      type: type satisfies MobileUnitType,
      movementClass: type === "TRAIN" ? "RAIL" : "TANK",
      cellId,
    },
  );
  const tankOperationalStates: readonly TankOperationalState[] =
    type === "TRAIN"
      ? state.tankOperationalStates
      : Object.freeze([
          ...state.tankOperationalStates,
          Object.freeze({
            unitId: created.unit.id,
            health,
            operatingAnchorCellId: cellId,
            eligibleFromTick: 0,
            attackReadyAtTick: 0,
          }),
        ]);
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      tankOperationalStates,
    }),
  });
}

function tankHealth(
  state: MatchState,
  unitId: string,
): TankExactHealth | undefined {
  return state.tankOperationalStates.find((entry) => entry.unitId === unitId)?.health;
}

function attackEvents(
  events: ReturnType<typeof resolveAdmittedTankUnitAttacks>["events"],
): readonly UnitAttackResolvedEvent[] {
  return events.filter(
    (event): event is UnitAttackResolvedEvent =>
      event.kind === "UNIT_ATTACK_RESOLVED",
  );
}

function destroyedEvents(
  events: ReturnType<typeof resolveAdmittedTankUnitAttacks>["events"],
): readonly UnitDestroyedEvent[] {
  return events.filter(
    (event): event is UnitDestroyedEvent => event.kind === "UNIT_DESTROYED",
  );
}

describe("Tank physical combat events", () => {
  it("resolves simultaneous admitted Tank attacks on one Train into one destruction with every cause", () => {
    let state = fixture();
    const blue = addUnit(state, "blue", "TANK", 0);
    state = blue.state;
    const green = addUnit(state, "green", "TANK", 1);
    state = green.state;
    const train = addUnit(state, "red", "TRAIN", 3);
    state = train.state;

    const attacks = [
      { attackerUnitId: green.unit.id, targetUnitId: train.unit.id },
      { attackerUnitId: blue.unit.id, targetUnitId: train.unit.id },
    ] as const;

    const forward = resolveAdmittedTankUnitAttacks(state, attacks);
    const reversed = resolveAdmittedTankUnitAttacks(state, [...attacks].reverse());

    expect(reversed).toEqual(forward);
    expect(state.mobileUnits.some((unit) => unit.id === train.unit.id)).toBe(true);
    expect(forward.state.mobileUnits.some((unit) => unit.id === train.unit.id)).toBe(
      false,
    );
    expect(forward.state.mobileUnits.some((unit) => unit.id === blue.unit.id)).toBe(
      true,
    );
    expect(forward.state.mobileUnits.some((unit) => unit.id === green.unit.id)).toBe(
      true,
    );

    const resolvedAttacks = attackEvents(forward.events);
    expect(resolvedAttacks).toHaveLength(2);
    expect(
      resolvedAttacks.map((event) => [
        event.payload.attacker.unitId,
        event.payload.target.unitId,
      ]),
    ).toEqual([
      [blue.unit.id, train.unit.id],
      [green.unit.id, train.unit.id],
    ]);
    expect(new Set(resolvedAttacks.map((event) => event.id)).size).toBe(2);
    expect(resolvedAttacks.every((event) => event.tick === state.tick)).toBe(true);

    const destructions = destroyedEvents(forward.events);
    expect(destructions).toHaveLength(1);
    const destruction = destructions[0]!;
    expect(destruction.payload.unit).toEqual({
      unitId: train.unit.id,
      ownerId: train.unit.ownerId,
      unitType: "TRAIN",
      cellId: train.unit.cellId,
    });
    expect(
      destruction.payload.causes.map((cause) => cause.attacker.unitId),
    ).toEqual([blue.unit.id, green.unit.id]);

    for (const cause of destruction.payload.causes) {
      const causalAttack = resolvedAttacks.find(
        (event) => event.id === cause.attackEventId,
      );
      expect(causalAttack).toBeDefined();
      expect(causalAttack?.payload.attacker.unitId).toBe(cause.attacker.unitId);
      expect(causalAttack?.payload.target.unitId).toBe(train.unit.id);
    }

    expect(forward.state.hostilityGrace).toEqual(state.hostilityGrace);
    expect(forward.state.operations).toEqual(state.operations);
  });

  it("applies the baseline 250 HP anti-armor damage to an admitted Tank target", () => {
    let state = fixture();
    const attacker = addUnit(state, "blue", "TANK", 0);
    state = attacker.state;
    const target = addUnit(state, "red", "TANK", 3);
    state = target.state;

    const result = resolveAdmittedTankUnitAttacks(state, [
      { attackerUnitId: attacker.unit.id, targetUnitId: target.unit.id },
    ]);

    expect(tankHealth(result.state, target.unit.id)).toEqual({
      numerator: 750n,
      denominator: 1n,
    });
    expect(result.state.mobileUnits.some((unit) => unit.id === target.unit.id)).toBe(
      true,
    );
    expect(attackEvents(result.events)).toHaveLength(1);
    expect(destroyedEvents(result.events)).toHaveLength(0);
    expect(result.state.hostilityGrace).toEqual(state.hostilityGrace);
  });

  it("keeps effective Tank damage exact when an Echo produces fractional HP damage", () => {
    const damageEcho = echoRuleContribution(
      "unit.TANK.damage",
      "BENEFICIAL",
      500,
      "echo:test-tank-damage",
    );
    let state = fixture({ blueAdditional: [damageEcho] });
    const attacker = addUnit(state, "blue", "TANK", 0);
    state = attacker.state;
    const target = addUnit(state, "red", "TANK", 3);
    state = target.state;

    const result = resolveAdmittedTankUnitAttacks(state, [
      { attackerUnitId: attacker.unit.id, targetUnitId: target.unit.id },
    ]);

    expect(tankHealth(result.state, target.unit.id)).toEqual({
      numerator: 1_475n,
      denominator: 2n,
    });
  });

  it("resolves mutually lethal P43 Heavy Artillery attacks from the same frozen snapshot", () => {
    let state = fixture({ blueTraits: ["P43"], redTraits: ["P43"] });
    const blue = addUnit(state, "blue", "HEAVY_ARTILLERY", 0);
    state = blue.state;
    const red = addUnit(state, "red", "HEAVY_ARTILLERY", 3);
    state = red.state;

    const attacks = [
      { attackerUnitId: blue.unit.id, targetUnitId: red.unit.id },
      { attackerUnitId: red.unit.id, targetUnitId: blue.unit.id },
    ] as const;
    const forward = resolveAdmittedTankUnitAttacks(state, attacks);
    const reversed = resolveAdmittedTankUnitAttacks(state, [...attacks].reverse());

    expect(reversed).toEqual(forward);
    expect(
      forward.state.mobileUnits.some(
        (unit) => unit.id === blue.unit.id || unit.id === red.unit.id,
      ),
    ).toBe(false);
    expect(
      forward.state.tankOperationalStates.some(
        (entry) => entry.unitId === blue.unit.id || entry.unitId === red.unit.id,
      ),
    ).toBe(false);
    expect(attackEvents(forward.events)).toHaveLength(2);
    const destructions = destroyedEvents(forward.events);
    expect(destructions).toHaveLength(2);
    expect(
      destructions.map((event) => [
        event.payload.unit.unitId,
        event.payload.causes.map((cause) => cause.attacker.unitId),
      ]),
    ).toEqual([
      [blue.unit.id, [red.unit.id]],
      [red.unit.id, [blue.unit.id]],
    ]);
    expect(forward.state.hostilityGrace).toEqual(state.hostilityGrace);
  });
});

describe("Tank combat direct-reveal delivery", () => {
  it("reveals a resolved attacker only to the directly attacked faction for the V1 lifetime", () => {
    let state = fixture();
    const attacker = addUnit(state, "blue", "TANK", 0);
    state = attacker.state;
    const target = addUnit(state, "red", "TANK", 3);
    state = createProspectiveMatchState(target.state, {
      directReveals: [
        {
          viewerFactionId: "green",
          sourceKind: "UNIT",
          sourceId: "unrelated-unit",
          expiryExclusiveTick: 999,
        },
      ],
    });

    const combat = resolveAdmittedTankUnitAttacks(state, [
      { attackerUnitId: attacker.unit.id, targetUnitId: target.unit.id },
    ]);
    expect(combat.state.directReveals).toEqual(state.directReveals);

    expect(
      resolveDirectRevealsFromPhysicalEvents(
        combat.state,
        combat.events,
        state.tick,
      ),
    ).toEqual([
      {
        viewerFactionId: "green",
        sourceKind: "UNIT",
        sourceId: "unrelated-unit",
        expiryExclusiveTick: 999,
      },
      {
        viewerFactionId: "red",
        sourceKind: "UNIT",
        sourceId: attacker.unit.id,
        expiryExclusiveTick: state.tick + 150,
      },
    ]);
  });

  it("does not retain direct-reveal ghosts for attackers destroyed in the same physical batch", () => {
    let state = fixture({ blueTraits: ["P43"], redTraits: ["P43"] });
    const blue = addUnit(state, "blue", "HEAVY_ARTILLERY", 0);
    state = blue.state;
    const red = addUnit(state, "red", "HEAVY_ARTILLERY", 3);
    state = red.state;

    const combat = resolveAdmittedTankUnitAttacks(state, [
      { attackerUnitId: blue.unit.id, targetUnitId: red.unit.id },
      { attackerUnitId: red.unit.id, targetUnitId: blue.unit.id },
    ]);

    expect(
      resolveDirectRevealsFromPhysicalEvents(
        combat.state,
        combat.events,
        state.tick,
      ),
    ).toEqual([]);
  });

  it("prunes expired direct reveals even when the physical-event batch is empty", () => {
    const state = createProspectiveMatchState(fixture(), {
      directReveals: [
        {
          viewerFactionId: "red",
          sourceKind: "UNIT",
          sourceId: "blue-unit",
          expiryExclusiveTick: 1,
        },
      ],
    });

    expect(resolveDirectRevealsFromPhysicalEvents(state, [], 0)).toEqual(
      state.directReveals,
    );
    expect(resolveDirectRevealsFromPhysicalEvents(state, [], 1)).toEqual([]);
  });
});

describe("TickEngine Tank combat integration", () => {
  it("fires reciprocal baseline Tank attacks on cadence and refreshes only reciprocal direct reveals", () => {
    let state = fixture();
    const blue = addUnit(state, "blue", "TANK", 0);
    state = blue.state;
    const red = addUnit(state, "red", "TANK", 3);
    state = red.state;
    const engine = new TickEngine();

    state = engine.advance(state, []);

    expect(state.tick).toBe(1);
    expect(tankHealth(state, blue.unit.id)).toEqual({
      numerator: 750n,
      denominator: 1n,
    });
    expect(tankHealth(state, red.unit.id)).toEqual({
      numerator: 750n,
      denominator: 1n,
    });
    expect(
      state.tankOperationalStates.find((entry) => entry.unitId === blue.unit.id)
        ?.attackReadyAtTick,
    ).toBe(11);
    expect(
      state.tankOperationalStates.find((entry) => entry.unitId === red.unit.id)
        ?.attackReadyAtTick,
    ).toBe(11);
    expect(state.directReveals).toEqual([
      {
        viewerFactionId: "blue",
        sourceKind: "UNIT",
        sourceId: red.unit.id,
        expiryExclusiveTick: 151,
      },
      {
        viewerFactionId: "red",
        sourceKind: "UNIT",
        sourceId: blue.unit.id,
        expiryExclusiveTick: 151,
      },
    ]);

    while (state.tick < 10) state = engine.advance(state, []);
    expect(tankHealth(state, blue.unit.id)).toEqual({
      numerator: 750n,
      denominator: 1n,
    });
    expect(tankHealth(state, red.unit.id)).toEqual({
      numerator: 750n,
      denominator: 1n,
    });
    expect(state.directReveals.map((record) => record.expiryExclusiveTick)).toEqual([
      151,
      151,
    ]);

    state = engine.advance(state, []);
    expect(state.tick).toBe(11);
    expect(tankHealth(state, blue.unit.id)).toEqual({
      numerator: 500n,
      denominator: 1n,
    });
    expect(tankHealth(state, red.unit.id)).toEqual({
      numerator: 500n,
      denominator: 1n,
    });
    expect(
      state.tankOperationalStates.find((entry) => entry.unitId === blue.unit.id)
        ?.attackReadyAtTick,
    ).toBe(21);
    expect(
      state.tankOperationalStates.find((entry) => entry.unitId === red.unit.id)
        ?.attackReadyAtTick,
    ).toBe(21);
    expect(state.directReveals.map((record) => record.expiryExclusiveTick)).toEqual([
      161,
      161,
    ]);
    expect(state.directReveals.some((record) => record.viewerFactionId === "green")).toBe(
      false,
    );
  });

  it("commits mutually lethal Heavy Artillery attacks from the frozen post-movement TickEngine snapshot", () => {
    let state = fixture({ blueTraits: ["P43"], redTraits: ["P43"] });
    const lethalHealth = Object.freeze({ numerator: 1_000n, denominator: 1n });
    const blue = addUnit(state, "blue", "HEAVY_ARTILLERY", 0, lethalHealth);
    state = blue.state;
    const red = addUnit(state, "red", "HEAVY_ARTILLERY", 3, lethalHealth);
    state = red.state;

    const advanced = new TickEngine().advance(state, []);

    expect(advanced.tick).toBe(1);
    expect(
      advanced.mobileUnits.some(
        (unit) => unit.id === blue.unit.id || unit.id === red.unit.id,
      ),
    ).toBe(false);
    expect(
      advanced.tankOperationalStates.some(
        (entry) => entry.unitId === blue.unit.id || entry.unitId === red.unit.id,
      ),
    ).toBe(false);
    expect(advanced.directReveals).toEqual([]);
  });

  it("physically intercepts a retained hostile Train without creating or refreshing atWar", () => {
    let state = fixture();
    const blue = addUnit(state, "blue", "TANK", 0);
    state = blue.state;
    const train = addUnit(state, "red", "TRAIN", 3);
    state = train.state;
    const hostilityBefore = state.hostilityGrace;

    const advanced = new TickEngine().advance(state, []);

    expect(advanced.tick).toBe(1);
    expect(
      advanced.mobileUnits.some((unit) => unit.id === train.unit.id),
    ).toBe(false);
    expect(
      advanced.tankOperationalStates.find((entry) => entry.unitId === blue.unit.id)
        ?.attackReadyAtTick,
    ).toBe(11);
    expect(advanced.directReveals).toEqual([
      {
        viewerFactionId: "red",
        sourceKind: "UNIT",
        sourceId: blue.unit.id,
        expiryExclusiveTick: 151,
      },
    ]);
    expect(advanced.hostilityGrace).toEqual(hostilityBefore);
  });

  it("keeps P43 Heavy Artillery from acquiring or intercepting Trains", () => {
    let state = fixture({ blueTraits: ["P43"] });
    const blue = addUnit(state, "blue", "HEAVY_ARTILLERY", 0);
    state = blue.state;
    const train = addUnit(state, "red", "TRAIN", 3);
    state = train.state;

    const advanced = new TickEngine().advance(state, []);

    expect(advanced.tick).toBe(1);
    expect(
      advanced.mobileUnits.some((unit) => unit.id === train.unit.id),
    ).toBe(true);
    expect(
      advanced.tankOperationalStates.find((entry) => entry.unitId === blue.unit.id)
        ?.retainedTarget,
    ).toBeUndefined();
    expect(
      advanced.tankOperationalStates.find((entry) => entry.unitId === blue.unit.id)
        ?.attackReadyAtTick,
    ).toBe(0);
    expect(advanced.directReveals).toEqual([]);
  });
});
