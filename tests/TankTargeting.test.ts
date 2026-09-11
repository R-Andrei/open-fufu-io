import { originRuleProfileInput, type OriginTraitId } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
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
import { selectTankAutonomousUnitTarget } from "../src/simulation/TankTargeting";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  const origin = originRuleProfileInput(traits);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function targetFixture(
  width: number,
  height: number,
  terrain: readonly string[],
  ownership: readonly (string | null)[],
  alphaTraits: readonly OriginTraitId[] = [],
): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "tank-targeting-red",
      width,
      height,
      terrain,
      initialOwners: ownership,
      factions: [
        { id: "alpha", rules: rulesWithTraits(alphaTraits) },
        { id: "beta", rules: rulesWithTraits() },
      ],
    }),
  );
}

function addUnit(
  state: MatchState,
  input: {
    readonly ownerId: string;
    readonly type: "TANK" | "HEAVY_ARTILLERY" | "WARSHIP" | "TRAIN";
    readonly movementClass: "TANK" | "HEAVY_ARTILLERY" | "NAVAL" | "RAIL";
    readonly cellId: number;
  },
): Readonly<{ state: MatchState; unit: MobileUnitState }> {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    {
      mobileUnits: state.mobileUnits,
      nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
    },
    input,
  );
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
    }),
  });
}

function select(
  state: MatchState,
  chassisType: "TANK" | "HEAVY_ARTILLERY",
  currentCellId: number,
  operatingAnchorCellId: number,
  observedUnitIds: readonly string[],
) {
  return selectTankAutonomousUnitTarget(state, {
    ownerId: "alpha",
    chassisType,
    currentCellId,
    operatingAnchorCellId,
    observedUnitIds,
  });
}

describe("Tank autonomous unit-target arbitration", () => {
  it("uses Tank-derived chassis -> Warship -> Train class priority before proximity", () => {
    let state = targetFixture(
      50,
      1,
      Array.from({ length: 50 }, () => "PLAINS"),
      Array.from({ length: 50 }, () => "alpha"),
    );
    const tank = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = tank.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 5,
    });
    state = warship.state;
    const train = addUnit(state, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 4,
    });
    state = train.state;

    expect(
      select(state, "TANK", 0, 0, [tank.unit.id, warship.unit.id, train.unit.id]),
    ).toEqual({ targetClass: "TANK_CHASSIS", unitId: tank.unit.id });
  });

  it("ignores an unobserved higher-priority unit", () => {
    let state = targetFixture(
      50,
      1,
      Array.from({ length: 50 }, () => "PLAINS"),
      Array.from({ length: 50 }, () => "alpha"),
    );
    const tank = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = tank.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 5,
    });
    state = warship.state;

    expect(select(state, "TANK", 0, 0, [warship.unit.id])).toEqual({
      targetClass: "WARSHIP",
      unitId: warship.unit.id,
    });
  });

  it("chooses lower traversal time to any legal firing position within one class", () => {
    const width = 41;
    const height = 41;
    const terrain = Array.from({ length: width * height }, (_, cellId) => {
      const y = Math.floor(cellId / width);
      return y >= 1 && y <= 10 ? "MARSH" : "PLAINS";
    });
    let state = targetFixture(
      width,
      height,
      terrain,
      Array.from({ length: width * height }, () => "alpha"),
    );
    const slower = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40 * width,
    });
    state = slower.state;
    const faster = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = faster.state;

    expect(select(state, "TANK", 0, 0, [slower.unit.id, faster.unit.id])).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: faster.unit.id,
    });
  });

  it("breaks equal traversal-time ties by stable unit identity", () => {
    const width = 41;
    const height = 41;
    let state = targetFixture(
      width,
      height,
      Array.from({ length: width * height }, () => "PLAINS"),
      Array.from({ length: width * height }, () => "alpha"),
    );
    const first = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40 * width,
    });
    state = first.state;
    const second = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 40,
    });
    state = second.state;

    expect(select(state, "TANK", 0, 0, [second.unit.id, first.unit.id])).toEqual({
      targetClass: "TANK_CHASSIS",
      unitId: first.unit.id,
    });
  });

  it("rejects a target outside the exact 100-cell operating leash", () => {
    let state = targetFixture(
      102,
      1,
      Array.from({ length: 102 }, () => "PLAINS"),
      Array.from({ length: 102 }, () => "alpha"),
    );
    const target = addUnit(state, {
      ownerId: "beta",
      type: "TANK",
      movementClass: "TANK",
      cellId: 101,
    });
    state = target.state;

    expect(select(state, "TANK", 0, 0, [target.unit.id])).toBeUndefined();
  });

  it("disables P43 Train raiding while retaining Warship anti-armor targeting and range", () => {
    const ownership = Array.from<(string | null)>({ length: 41 }, (_, index) =>
      index === 0 ? "alpha" : null,
    );
    let state = targetFixture(
      41,
      1,
      Array.from({ length: 41 }, () => "PLAINS"),
      ownership,
      ["P43"],
    );
    const train = addUnit(state, {
      ownerId: "beta",
      type: "TRAIN",
      movementClass: "RAIL",
      cellId: 20,
    });
    state = train.state;
    const warship = addUnit(state, {
      ownerId: "beta",
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: 40,
    });
    state = warship.state;

    expect(select(state, "HEAVY_ARTILLERY", 0, 0, [train.unit.id])).toBeUndefined();
    expect(
      select(state, "HEAVY_ARTILLERY", 0, 0, [train.unit.id, warship.unit.id]),
    ).toEqual({ targetClass: "WARSHIP", unitId: warship.unit.id });
  });
});
