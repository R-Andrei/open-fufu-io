import { describe, expect, it } from "vitest";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createInitialMatchState,
  createProspectiveMatchState,
  type MatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  assignMobileUnitRoute,
  createMobileUnit,
  setMobileUnitStrategicDestination,
} from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";

function rules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput([]));
}

function fixture(seed: string, width: number): MatchState {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width,
      height: 1,
      terrain: Array.from({ length: width }, () => "DEEP_WATER" as const),
      initialOwners: Array.from({ length: width }, () => null),
      factions: [
        { id: "alpha", rules: rules() },
        { id: "beta", rules: rules() },
      ],
    }),
  );
}

function addWarship(
  state: MatchState,
  input: Readonly<{
    ownerId: string;
    cellId: number;
    strategicDestinationCellId?: number;
    roamingOrdinal?: number;
    routeCells?: readonly number[];
  }>,
) {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId: input.ownerId,
      type: "WARSHIP",
      movementClass: "NAVAL",
      cellId: input.cellId,
    },
  );
  let unit = created.unit;
  if (input.strategicDestinationCellId !== undefined) {
    unit = setMobileUnitStrategicDestination(
      state.map,
      unit,
      input.strategicDestinationCellId,
    );
  }
  if (input.routeCells !== undefined) {
    unit = assignMobileUnitRoute(state.map, unit, {
      cells: input.routeCells,
      edgeWeights: input.routeCells.slice(1).map(() => 1),
    });
  }
  const mobileUnits = created.mobileUnits.map((candidate) =>
    candidate.id === unit.id ? unit : candidate,
  );
  return Object.freeze({
    unit,
    state: createProspectiveMatchState(state, {
      mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      warshipOperationalStates: [
        ...state.warshipOperationalStates,
        Object.freeze({
          unitId: unit.id,
          health: Object.freeze({ numerator: 1_000n, denominator: 1n }),
          operatingAnchorCellId: input.cellId,
          attackReadyAtTick: state.tick,
          nextProjectileOrdinal: 0,
          roamingOrdinal: input.roamingOrdinal ?? 0,
        }),
      ],
    }),
  });
}

function addTransport(state: MatchState, ownerId: string, cellId: number) {
  const created = createMobileUnit(
    state.map,
    state.factions.map((faction) => faction.id),
    state,
    {
      ownerId,
      type: "TRANSPORT_SHIP",
      movementClass: "TRANSPORT",
      cellId,
    },
  );
  return Object.freeze({
    unit: created.unit,
    state: createProspectiveMatchState(state, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      transportOperationalStates: [
        ...state.transportOperationalStates,
        Object.freeze({
          unitId: created.unit.id,
          carriedPopulation: 0,
        }),
      ],
    }),
  });
}

describe("Warship autonomous movement intent", () => {
  it("pursuit overrides retained strategic travel and strategic travel resumes after the target disappears", () => {
    let state = fixture("warship-pursuit-strategic-resume-red", 300);
    const source = addWarship(state, {
      ownerId: "alpha",
      cellId: 150,
      strategicDestinationCellId: 299,
    });
    state = source.state;
    const target = addTransport(state, "beta", 0);
    state = createProspectiveMatchState(target.state, {
      directReveals: [
        Object.freeze({
          viewerFactionId: "alpha",
          sourceKind: "UNIT" as const,
          sourceId: target.unit.id,
          expiryExclusiveTick: 100,
        }),
      ],
    });

    const engine = new TickEngine();
    const pursued = engine.advance(state, []);
    const pursuedSource = pursued.mobileUnits.find(
      (unit) => unit.id === source.unit.id,
    )!;
    expect(pursuedSource.cellId).toBe(149);
    expect(pursuedSource.strategicDestinationCellId).toBe(299);
    expect(
      pursued.warshipOperationalStates.find(
        (entry) => entry.unitId === source.unit.id,
      )?.operatingAnchorCellId,
    ).toBe(150);

    const targetRemoved = createProspectiveMatchState(pursued, {
      mobileUnits: pursued.mobileUnits.filter(
        (unit) => unit.id !== target.unit.id,
      ),
      transportOperationalStates: pursued.transportOperationalStates.filter(
        (entry) => entry.unitId !== target.unit.id,
      ),
      directReveals: [],
    });
    const resumed = engine.advance(targetRemoved, []);
    const resumedSource = resumed.mobileUnits.find(
      (unit) => unit.id === source.unit.id,
    )!;
    expect(resumedSource.cellId).toBe(150);
    expect(resumedSource.strategicDestinationCellId).toBe(299);
  });

  it("continues an existing lawful roaming route without incrementing the roaming ordinal", () => {
    let state = fixture("warship-existing-roam-red", 30);
    const source = addWarship(state, {
      ownerId: "alpha",
      cellId: 10,
      roamingOrdinal: 4,
      routeCells: [10, 11, 12, 13],
    });
    state = source.state;

    const advanced = new TickEngine().advance(state, []);
    expect(
      advanced.mobileUnits.find((unit) => unit.id === source.unit.id)?.cellId,
    ).toBe(11);
    expect(
      advanced.warshipOperationalStates.find(
        (entry) => entry.unitId === source.unit.id,
      )?.roamingOrdinal,
    ).toBe(4);
  });

  it("selects a deterministic roaming waypoint for an idle settled Warship and increments once", () => {
    const initialA = addWarship(
      fixture("warship-new-roam-red", 31),
      { ownerId: "alpha", cellId: 15 },
    ).state;
    const initialB = addWarship(
      fixture("warship-new-roam-red", 31),
      { ownerId: "alpha", cellId: 15 },
    ).state;

    const advancedA = new TickEngine().advance(initialA, []);
    const advancedB = new TickEngine().advance(initialB, []);

    const unitA = advancedA.mobileUnits.find((unit) => unit.type === "WARSHIP")!;
    const unitB = advancedB.mobileUnits.find((unit) => unit.type === "WARSHIP")!;
    expect(unitA.cellId).not.toBe(15);
    expect(unitB.cellId).toBe(unitA.cellId);
    expect(unitB.route).toEqual(unitA.route);
    expect(advancedA.warshipOperationalStates[0]?.roamingOrdinal).toBe(1);
    expect(advancedB.warshipOperationalStates[0]?.roamingOrdinal).toBe(1);
  });
});
