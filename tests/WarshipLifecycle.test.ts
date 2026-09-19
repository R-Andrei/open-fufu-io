import {
  originRuleProfileInput,
  type OriginTraitId,
} from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import {
  tryStartWarshipProduction,
  warshipStrategicNavigationRoute,
  warshipTerrainMovementTiming,
} from "../src/simulation/Warships";

function rulesWithTraits(traits: readonly OriginTraitId[] = []) {
  return compileRuleProfile(RULE_AXIS_REGISTRY, originRuleProfileInput(traits));
}

function movementFixture(
  terrain: readonly ("DEEP_WATER" | "SHALLOW_WATER")[],
  width: number,
  height: number,
  traits: readonly OriginTraitId[] = [],
) {
  return createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-navigation-red",
      width,
      height,
      terrain,
      initialOwners: terrain.map(() => null),
      factions: [{ id: "alpha", rules: rulesWithTraits(traits) }],
    }),
  );
}

function expectExactWarshipSpeed(
  timing: ReturnType<typeof warshipTerrainMovementTiming>,
  numerator: bigint,
  denominator: bigint,
) {
  expect(timing).toBeDefined();
  if (timing === undefined) {
    throw new Error("expected traversable Warship terrain");
  }
  expect(Number.isSafeInteger(timing.movementWorkPerTick)).toBe(true);
  expect(timing.movementWorkPerTick).toBeGreaterThan(0);
  expect(Number.isSafeInteger(timing.edgeWeight)).toBe(true);
  expect(timing.edgeWeight).toBeGreaterThan(0);
  expect(BigInt(timing.movementWorkPerTick) * 10n * denominator).toBe(
    BigInt(timing.edgeWeight) * numerator,
  );
}

function productionFixture() {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed: "warship-destination-admission-red",
      width: 4,
      height: 1,
      terrain: ["DEEP_WATER", "PLAINS", "SHALLOW_WATER", "DEEP_WATER"],
      initialOwners: [null, "alpha", null, null],
      factions: [{ id: "alpha", rules: rulesWithTraits() }],
    }),
  );
  return createProspectiveMatchState(base, {
    factions: base.factions.map((faction) => ({
      ...faction,
      ffy: 500_000,
    })),
    structures: [
      {
        id: "port-a",
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

describe("Warship strategic movement lifecycle", () => {
  it("admits only intrinsic Deep-Water production destinations without requiring connectivity", () => {
    const initial = productionFixture();

    const shallow = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 2,
    });
    expect(shallow).toMatchObject({
      ok: false,
      failure: { code: "INVALID_REQUEST" },
    });
    expect(shallow.state).toBe(initial);
    expect(shallow.state.warshipProductionJobs).toHaveLength(0);

    const disconnectedDeep = tryStartWarshipProduction(initial, {
      ownerId: "alpha",
      portId: "port-a",
      strategicDestinationCellId: 3,
    });
    expect(disconnectedDeep.ok).toBe(true);
    if (!disconnectedDeep.ok) {
      throw new Error("expected disconnected Deep-Water destination admission");
    }
    expect(disconnectedDeep.job.strategicDestinationCellId).toBe(3);
  });

  it("uses Deep Water only and exact effective Warship speed composition", () => {
    expectExactWarshipSpeed(
      warshipTerrainMovementTiming(
        movementFixture(["DEEP_WATER"], 1, 1),
        "alpha",
        "DEEP_WATER",
      ),
      10n,
      1n,
    );
    expect(
      warshipTerrainMovementTiming(
        movementFixture(["SHALLOW_WATER"], 1, 1),
        "alpha",
        "SHALLOW_WATER",
      ),
    ).toBeUndefined();

    expectExactWarshipSpeed(
      warshipTerrainMovementTiming(
        movementFixture(["DEEP_WATER"], 1, 1, ["P23"]),
        "alpha",
        "DEEP_WATER",
      ),
      12n,
      1n,
    );
    expectExactWarshipSpeed(
      warshipTerrainMovementTiming(
        movementFixture(["DEEP_WATER"], 1, 1, ["P30"]),
        "alpha",
        "DEEP_WATER",
      ),
      15n,
      1n,
    );
  });

  it("routes reachable destinations deterministically around Shallow Water", () => {
    const state = movementFixture(
      [
        "DEEP_WATER",
        "SHALLOW_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
      ],
      3,
      2,
    );
    const route = warshipStrategicNavigationRoute(state, "alpha", 0, 2);

    expect(route.status).toBe("FOUND");
    if (route.status !== "FOUND") {
      throw new Error("expected reachable Warship route");
    }
    expect(route.route.cells).toEqual([0, 3, 4, 5, 2]);
    expect(route.route.movementWorkPerTick).toBeGreaterThan(0);
    expect(route.route.edgeWeights).toHaveLength(4);
  });

  it("retains an unreachable legal Deep-Water destination behind a deterministic best-effort frontier", () => {
    const state = movementFixture(
      [
        "DEEP_WATER",
        "DEEP_WATER",
        "SHALLOW_WATER",
        "DEEP_WATER",
        "DEEP_WATER",
      ],
      5,
      1,
    );
    const route = warshipStrategicNavigationRoute(state, "alpha", 0, 4);

    expect(route.status).toBe("BEST_EFFORT");
    if (route.status !== "BEST_EFFORT") {
      throw new Error("expected best-effort Warship route");
    }
    expect(route.route.cells).toEqual([0, 1]);
  });
});
