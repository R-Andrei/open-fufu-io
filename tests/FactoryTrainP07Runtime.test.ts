import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createFactoryRailLoopLifecycleState } from "../src/simulation/FactoryRailLifecycle";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function originRules(traitIds: readonly ("P07" | "P33")[]) {
  const origin = originRuleProfileInput(traitIds);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
}

function p07Rules() {
  return originRules(["P07"]);
}

function p33Rules() {
  return originRules(["P33"]);
}

function createP07RuntimeFixture(
  seed: string,
  phase?: 0 | 1 | 2 | 3,
) {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 12,
      height: 1,
      factions: [
        { id: "alpha", rules: p07Rules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze(
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
  const prepared = createProspectiveMatchState(base, {
    structures: [
      {
        id: "factory-a",
        ownerId: "alpha",
        type: "FACTORY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
      {
        id: "city-a",
        ownerId: "alpha",
        type: "CITY",
        cellId: 10,
        completedLevel: 1,
        active: false,
        acquisitionPath: "GRANT",
      },
    ],
    factoryRailLoops: [
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
      }),
    ],
    ...(phase === undefined
      ? {}
      : {
          factoryTrainEpochs: [
            {
              factoryId: "factory-a",
              ownerId: "alpha",
              activePrimaryTrainId: null,
              turnaroundRemainingActiveTicks: 0,
              p07PrimaryDispatchPhase: phase,
            },
          ],
        }),
  });
  return { prepared, loopCells };
}

function createP33RuntimeFixture(seed: string, withInterception: boolean) {
  const width = 30;
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width,
      height: 1,
      terrain: Array.from({ length: width }, () => "PLAINS" as const),
      initialOwners: Array.from({ length: width }, () => "alpha"),
      factions: [
        { id: "alpha", rules: p33Rules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze([0, 1, 2, 3, 4]);
  const tankState = withInterception
    ? createMobileUnit(
        base.map,
        base.factions.map((faction) => faction.id),
        {
          mobileUnits: base.mobileUnits,
          nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
        },
        {
          ownerId: "beta",
          type: "TANK",
          movementClass: "TANK",
          cellId: 2,
        },
      )
    : null;
  const prepared = createProspectiveMatchState(base, {
    structures: [
      {
        id: "factory-a",
        ownerId: "alpha",
        type: "FACTORY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
      {
        id: "city-a",
        ownerId: "alpha",
        type: "CITY",
        cellId: 2,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
    factoryRailLoops: [
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-a"]),
        servicedStructureIds: Object.freeze(["city-a"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
      }),
    ],
    ...(tankState === null
      ? {}
      : {
          mobileUnits: tankState.mobileUnits,
          nextMobileUnitOrdinal: tankState.nextMobileUnitOrdinal,
          tankOperationalStates: [
            {
              unitId: tankState.unit.id,
              health: { numerator: 1_000n, denominator: 1n },
              operatingAnchorCellId: tankState.unit.cellId,
              eligibleFromTick: 0,
              attackReadyAtTick: 0,
            },
          ],
        }),
  });
  return prepared;
}

describe("P07 Factory Train runtime dispatch", () => {
  it("advances a fresh P07 primary dispatch from phase 0 to phase 1 without a bonus", () => {
    const { prepared, loopCells } = createP07RuntimeFixture(
      "factory-train-runtime-p07-first",
    );

    const advanced = new TickEngine().advance(prepared, []);
    const epoch = advanced.factoryTrainEpochs[0]!;

    expect(epoch).toMatchObject({
      factoryId: "factory-a",
      ownerId: "alpha",
      p07PrimaryDispatchPhase: 1,
      turnaroundRemainingActiveTicks: 0,
    });
    expect(epoch.activePrimaryTrainId).not.toBeNull();
    expect(advanced.mobileUnits).toHaveLength(1);
    expect(advanced.trainServices).toHaveLength(1);
    expect(advanced.trainServices[0]).toMatchObject({
      trainId: epoch.activePrimaryTrainId,
      factoryId: "factory-a",
      isPrimary: true,
      dispatchSnapshot: {
        factoryId: "factory-a",
        dispatchOwnerId: "alpha",
        factoryLevel: 1,
      },
    });
    expect(advanced.factoryRailLoops[0]?.retainedSnapshots).toEqual([
      expect.objectContaining({
        snapshotId: epoch.activePrimaryTrainId,
        cells: loopCells,
      }),
    ]);
  });

  it("dispatches the P07 phase-3 bonus simultaneously on the same loop without occupying the primary slot", () => {
    const { prepared, loopCells } = createP07RuntimeFixture(
      "factory-train-runtime-p07-fourth",
      3,
    );

    const advanced = new TickEngine().advance(prepared, []);
    const epoch = advanced.factoryTrainEpochs[0]!;
    const primaryService = advanced.trainServices.find(
      (service) => service.isPrimary,
    );
    const bonusService = advanced.trainServices.find(
      (service) => !service.isPrimary,
    );

    expect(epoch).toMatchObject({
      factoryId: "factory-a",
      ownerId: "alpha",
      p07PrimaryDispatchPhase: 0,
      turnaroundRemainingActiveTicks: 0,
    });
    expect(epoch.activePrimaryTrainId).not.toBeNull();
    expect(advanced.mobileUnits).toHaveLength(2);
    expect(advanced.trainServices).toHaveLength(2);
    expect(primaryService).toMatchObject({
      trainId: epoch.activePrimaryTrainId,
      factoryId: "factory-a",
      isPrimary: true,
      dispatchSnapshot: {
        factoryId: "factory-a",
        dispatchOwnerId: "alpha",
        factoryLevel: 1,
      },
    });
    expect(bonusService).toMatchObject({
      factoryId: "factory-a",
      isPrimary: false,
      dispatchSnapshot: primaryService?.dispatchSnapshot,
    });
    expect(bonusService?.trainId).not.toBe(primaryService?.trainId);

    const primaryTrain = advanced.mobileUnits.find(
      (unit) => unit.id === primaryService?.trainId,
    );
    const bonusTrain = advanced.mobileUnits.find(
      (unit) => unit.id === bonusService?.trainId,
    );
    expect(primaryTrain).toBeDefined();
    expect(bonusTrain).toBeDefined();
    expect(primaryTrain?.ownerId).toBe("alpha");
    expect(bonusTrain?.ownerId).toBe("alpha");
    expect(primaryTrain?.route?.cells).toEqual(loopCells);
    expect(bonusTrain?.route?.cells).toEqual(loopCells);
    expect(primaryTrain?.route).toMatchObject({
      nextCellIndex: bonusTrain?.route?.nextCellIndex,
      edgeProgress: bonusTrain?.route?.edgeProgress,
    });

    const snapshots = advanced.factoryRailLoops[0]?.retainedSnapshots ?? [];
    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.snapshotId).sort()).toEqual(
      [primaryService?.trainId, bonusService?.trainId].sort(),
    );
    expect(snapshots.every((snapshot) =>
      snapshot.cells.length === loopCells.length &&
      snapshot.cells.every((cellId, index) => cellId === loopCells[index]),
    )).toBe(true);
  });
});

describe("P33 Factory Train runtime settlement", () => {
  it("grants exactly 20 Population for a surviving L1 City station event", () => {
    const prepared = createP33RuntimeFixture(
      "factory-train-runtime-p33-survives",
      false,
    );
    expect(prepared.factions[0]?.population.total).toBe(0);

    const advanced = new TickEngine().advance(prepared, []);

    expect(advanced.mobileUnits.some((unit) => unit.type === "TRAIN")).toBe(true);
    expect(advanced.factions[0]?.population.total).toBe(20);
    expect(advanced.factions[0]?.population.available).toBe(20);
  });

  it("does not grant P33 Population when same-tick Tank interception cancels the City event", () => {
    const prepared = createP33RuntimeFixture(
      "factory-train-runtime-p33-intercepted",
      true,
    );

    const advanced = new TickEngine().advance(prepared, []);

    expect(advanced.mobileUnits.some((unit) => unit.type === "TRAIN")).toBe(false);
    expect(advanced.factions[0]?.population.total).toBe(0);
    expect(advanced.factions[0]?.population.available).toBe(0);
  });
});
