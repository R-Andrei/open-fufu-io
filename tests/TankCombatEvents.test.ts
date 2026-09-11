import type { MobileUnitType } from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
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

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: [],
    dynamicProviders: [],
    customDomains: [],
  });
}

function fixture(): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-combat-events-red",
      width: 4,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["blue", "blue", "green", "red"],
      factions: [
        { id: "blue", rules: rules() },
        { id: "green", rules: rules() },
        { id: "red", rules: rules() },
      ],
    }),
  );
}

function addUnit(
  state: MatchState,
  ownerId: string,
  type: "TANK" | "TRAIN",
  cellId: number,
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
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    }),
  });
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
});
