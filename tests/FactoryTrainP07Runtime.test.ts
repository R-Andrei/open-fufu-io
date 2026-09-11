import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { createFactoryRailLoopLifecycleState } from "../src/simulation/FactoryRailLifecycle";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function p07Rules() {
  const origin = originRuleProfileInput(["P07"]);
  return compileRuleProfile(RULE_AXIS_REGISTRY, {
    contributions: origin.contributions,
    dynamicProviders: origin.dynamicProviders,
    customDomains: origin.customDomains,
  });
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
