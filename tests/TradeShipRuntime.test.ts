import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  canonicalMatchStateSerialization,
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { tryLaunchTradeVoyage } from "../src/simulation/TradeShips";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

describe("authoritative Trade Ship voyage state", () => {
  it("launches on the shortest lawful delivery route and serializes the immutable economic snapshot", () => {
    const rules = emptyRules();
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "trade-voyage-launch-snapshot",
        width: 10,
        height: 1,
        terrain: [
          "PLAINS",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "DEEP_WATER",
          "PLAINS",
          "DEEP_WATER",
        ],
        initialOwners: [
          "alpha",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          "beta",
          null,
        ],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const withPorts = createProspectiveMatchState(base, {
      structures: [
        {
          id: "port-alpha",
          ownerId: "alpha",
          type: "PORT",
          cellId: 0,
          outputCellId: 1,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
        {
          id: "port-beta",
          ownerId: "beta",
          type: "PORT",
          cellId: 8,
          outputCellId: 9,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
      ],
    });

    const launched = tryLaunchTradeVoyage(withPorts, {
      ownerId: "alpha",
      sourcePortId: "port-alpha",
      destinationPortId: "port-beta",
    });

    expect(launched.ok).toBe(true);
    if (!launched.ok) throw new Error("expected Trade voyage launch");

    expect(launched.unit).toMatchObject({
      ownerId: "alpha",
      type: "TRADE_SHIP",
      movementClass: "NAVAL",
      cellId: 1,
      route: {
        destinationCellId: 3,
        cells: [1, 2, 3],
        edgeWeights: [1, 1],
        nextCellIndex: 1,
        edgeProgress: 0,
      },
    });

    expect(launched.state.tradeVoyages).toEqual([
      {
        unitId: launched.unit.id,
        economicSnapshot: {
          originalOwnerId: "alpha",
          sourcePortId: "port-alpha",
          launchDestinationPortId: "port-beta",
          valuationCellId: 8,
          plannedRouteLengthCells: 2,
          rawCargoFfy: 300,
          ownerSuccessValueFfy: 300,
        },
        firstHostileCaptureResolved: false,
      },
    ]);

    expect(JSON.parse(canonicalMatchStateSerialization(launched.state)).tradeVoyages).toEqual([
      {
        unitId: launched.unit.id,
        economicSnapshot: {
          originalOwnerId: "alpha",
          sourcePortId: "port-alpha",
          launchDestinationPortId: "port-beta",
          valuationCellId: 8,
          plannedRouteLengthCells: 2,
          rawCargoFfy: 300,
          ownerSuccessValueFfy: 300,
        },
        firstHostileCaptureResolved: false,
      },
    ]);
  });
});
