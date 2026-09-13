import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { resolveTankPopulationAftershocks } from "../src/simulation/TankCombat";
import { applyRadioactiveAttackAftershockEvents } from "../src/simulation/TerritoryEffects";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit, type MobileUnitState } from "../src/simulation/MobileUnits";
import type { StructureGrantRequest } from "../src/simulation/Structures";
import type { SuccessfulTankPopulationShot } from "../src/simulation/Tanks";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function fixture(options: {
  readonly width: number;
  readonly height: number;
  readonly terrain?: readonly string[];
  readonly ownership?: readonly (string | null)[];
  readonly alphaTraits?: readonly OriginTraitId[];
  readonly betaTraits?: readonly OriginTraitId[];
  readonly structures?: readonly StructureGrantRequest[];
}): MatchState {
  const cellCount = options.width * options.height;
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-p44-red",
      width: options.width,
      height: options.height,
      terrain:
        options.terrain ?? Array.from({ length: cellCount }, () => "PLAINS"),
      initialOwners:
        options.ownership ?? Array.from({ length: cellCount }, () => "beta"),
      initialStructureGrants: options.structures,
      factions: [
        { id: "alpha", rules: rulesWithTraits(options.alphaTraits) },
        { id: "beta", rules: rulesWithTraits(options.betaTraits) },
      ],
    }),
  );
}

function addAttacker(
  state: MatchState,
  type: "TANK" | "HEAVY_ARTILLERY",
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    {
      ownerId: "alpha",
      type,
      movementClass: type,
      cellId: 0,
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

function shot(
  unit: MobileUnitState,
  targetCellId: number,
): SuccessfulTankPopulationShot {
  return Object.freeze({
    attackerUnitId: unit.id,
    targetFactionId: "beta",
    targetCellId,
    finalDamage: unit.type === "HEAVY_ARTILLERY" ? 1_000 : 250,
  });
}

function applyAftershocks(
  state: MatchState,
  events: ReturnType<typeof resolveTankPopulationAftershocks>["events"],
): MatchState {
  const territorial = applyRadioactiveAttackAftershockEvents(
    {
      ownership: state.ownership,
      fallout: state.fallout,
    },
    events,
  );
  if (
    territorial.ownership === state.ownership &&
    territorial.fallout === state.fallout
  ) {
    return state;
  }
  return createProspectiveMatchState(state, territorial);
}

function orderedManhattanCells(
  state: MatchState,
  centerCellId: number,
  radius: number,
): number[] {
  const center = state.map.positionOf(centerCellId);
  return Array.from({ length: state.map.cellCount }, (_, cellId) => cellId)
    .map((cellId) => {
      const position = state.map.positionOf(cellId);
      return {
        cellId,
        distance:
          Math.abs(position.x - center.x) + Math.abs(position.y - center.y),
      };
    })
    .filter((entry) => entry.distance <= radius)
    .sort((left, right) => left.distance - right.distance || left.cellId - right.cellId)
    .map((entry) => entry.cellId);
}

describe("P44 Tank Population aftershock", () => {
  it("emits the resolved baseline footprint before the territorial consumer applies Fallout", () => {
    let state = fixture({
      width: 5,
      height: 5,
      alphaTraits: ["P44"],
      structures: [
        {
          structureId: "beta-city",
          ownerId: "beta",
          type: "CITY",
          cellId: 7,
          level: 1,
        },
      ],
    });
    const attacker = addAttacker(state, "TANK");
    state = attacker.state;
    const originalOwnership = state.ownership;
    const originalFallout = state.fallout;

    const result = resolveTankPopulationAftershocks(state, [shot(attacker.unit, 12)]);

    expect(result.state).toBe(state);
    expect(state.ownership).toBe(originalOwnership);
    expect(state.fallout).toBe(originalFallout);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      tick: state.tick,
      kind: "RADIOACTIVE_ATTACK_AFTERSHOCK_RESOLVED",
      payload: {
        attacker: {
          unitId: attacker.unit.id,
          ownerId: attacker.unit.ownerId,
          unitType: "TANK",
          cellId: attacker.unit.cellId,
        },
        targetCellId: 12,
        affectedCellIds: [12, 11, 13, 17, 2, 6, 8, 10, 14, 16],
      },
    });
    expect(Object.isFrozen(result.events[0])).toBe(true);
    expect(Object.isFrozen(result.events[0]?.payload)).toBe(true);
    expect(Object.isFrozen(result.events[0]?.payload.affectedCellIds)).toBe(true);

    const applied = applyAftershocks(state, result.events);
    for (const cellId of result.events[0]!.payload.affectedCellIds) {
      expect(applied.ownership[cellId]).toBeNull();
      expect(applied.fallout[cellId]).toBe(true);
    }
    expect(applied.ownership[7]).toBe("beta");
    expect(applied.fallout[7]).toBe(false);
    expect(applied.structures).toEqual(state.structures);
    expect(applied.factions).toEqual(state.factions);
    expect(applied.operations).toEqual(state.operations);
  });

  it("uses the target owner's effective P48 population-bearing permission before event emission", () => {
    const terrain = ["PLAINS", "SHALLOW_WATER", "PLAINS"];

    let ordinary = fixture({ width: 3, height: 1, terrain, alphaTraits: ["P44"] });
    const ordinaryAttacker = addAttacker(ordinary, "TANK");
    ordinary = ordinaryAttacker.state;
    expect(
      resolveTankPopulationAftershocks(ordinary, [shot(ordinaryAttacker.unit, 0)])
        .events[0]?.payload.affectedCellIds,
    ).toEqual([0, 2]);

    let blessed = fixture({
      width: 3,
      height: 1,
      terrain,
      alphaTraits: ["P44"],
      betaTraits: ["P48"],
    });
    const blessedAttacker = addAttacker(blessed, "TANK");
    blessed = blessedAttacker.state;
    expect(
      resolveTankPopulationAftershocks(blessed, [shot(blessedAttacker.unit, 0)])
        .events[0]?.payload.affectedCellIds,
    ).toEqual([0, 1, 2]);
  });

  it("uses P43 Heavy Artillery radius 5 and cap 50 before event emission", () => {
    let state = fixture({
      width: 11,
      height: 11,
      alphaTraits: ["P43", "P44"],
    });
    const attacker = addAttacker(state, "HEAVY_ARTILLERY");
    state = attacker.state;
    const expected = orderedManhattanCells(state, 60, 5).slice(0, 50);

    const result = resolveTankPopulationAftershocks(state, [shot(attacker.unit, 60)]);

    expect(result.events[0]?.payload.affectedCellIds).toEqual(expected);
    expect(result.events[0]?.payload.affectedCellIds).toHaveLength(50);
  });

  it("computes overlapping events from one frozen snapshot and applies their union independent of shot order", () => {
    let state = fixture({ width: 5, height: 5, alphaTraits: ["P44"] });
    const first = addAttacker(state, "TANK");
    state = first.state;
    const second = addAttacker(state, "TANK");
    state = second.state;
    const shots = [shot(first.unit, 12), shot(second.unit, 13)];

    const forward = resolveTankPopulationAftershocks(state, shots);
    const reversed = resolveTankPopulationAftershocks(state, [...shots].reverse());

    expect(reversed).toEqual(forward);
    expect(forward.state).toBe(state);
    expect(
      forward.events.map((event) => ({
        attackerUnitId: event.payload.attacker.unitId,
        targetCellId: event.payload.targetCellId,
        affectedCellIds: event.payload.affectedCellIds,
      })),
    ).toEqual([
      {
        attackerUnitId: first.unit.id,
        targetCellId: 12,
        affectedCellIds: [12, 7, 11, 13, 17, 2, 6, 8, 10, 14],
      },
      {
        attackerUnitId: second.unit.id,
        targetCellId: 13,
        affectedCellIds: [13, 8, 12, 14, 18, 3, 7, 9, 11, 17],
      },
    ]);

    const forwardApplied = applyAftershocks(state, forward.events);
    const reversedApplied = applyAftershocks(state, [...forward.events].reverse());
    expect(reversedApplied.ownership).toEqual(forwardApplied.ownership);
    expect(reversedApplied.fallout).toEqual(forwardApplied.fallout);
    const neutralized = forwardApplied.ownership.filter((ownerId) => ownerId === null);
    expect(neutralized).toHaveLength(13);
    expect(forward.events[0]?.payload.affectedCellIds).toContain(12);
    expect(forward.events[1]?.payload.affectedCellIds).toContain(12);
  });

  it("emits no aftershock and performs no territorial mutation when the attacker lacks P44", () => {
    let state = fixture({ width: 3, height: 1 });
    const attacker = addAttacker(state, "TANK");
    state = attacker.state;

    const result = resolveTankPopulationAftershocks(state, [shot(attacker.unit, 1)]);

    expect(result.events).toEqual([]);
    expect(result.state).toBe(state);
    expect(applyAftershocks(state, result.events)).toBe(state);
  });
});
