import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  BASELINE_PASSIVE_FFY_PER_SECOND,
  ECONOMY_TICKS_PER_SECOND,
} from "../src/simulation/Economy";
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

function originRules(
  traitIds: readonly (
    | "P07"
    | "P08"
    | "P14"
    | "P24"
    | "P33"
    | "P34"
    | "N04"
    | "N11"
  )[],
) {
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

function p08Rules() {
  return originRules(["P08"]);
}

function p14Rules() {
  return originRules(["P14"]);
}

function p24Rules() {
  return originRules(["P24"]);
}

function p33Rules() {
  return originRules(["P33"]);
}

function p34Rules() {
  return originRules(["P34"]);
}

function n04Rules() {
  return originRules(["N04"]);
}

function n11Rules() {
  return originRules(["N11"]);
}

function createP07RuntimeFixture(seed: string) {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 13,
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
        cellId: 12,
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
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-a", cellId: 11 }),
        ]),
      }),
    ],
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
  const loopCells = Object.freeze([1, 2, 3, 2, 1]);
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
          cellId: 5,
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
        cellId: 4,
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
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-a", cellId: 3 }),
        ]),
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

function createP34RuntimeFixture(
  seed: string,
  acquisitionPath: "GRANT" | "CAPTURE_TRANSFER",
) {
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width: 13,
      height: 1,
      factions: [
        { id: "alpha", rules: p34Rules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze(
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
  return createProspectiveMatchState(base, {
    structures: [
      {
        id: "factory-a",
        ownerId: "alpha",
        type: "FACTORY",
        cellId: 0,
        completedLevel: 1,
        active: true,
        acquisitionPath,
      },
      {
        id: "city-a",
        ownerId: "alpha",
        type: "CITY",
        cellId: 12,
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
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-a", cellId: 11 }),
        ]),
      }),
    ],
  });
}

function createExternalWartimeRuntimeFixture(seed: string, withP08: boolean) {
  const width = 7;
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width,
      height: 1,
      terrain: Array.from({ length: width }, () => "PLAINS" as const),
      initialOwners: [
        "alpha",
        "alpha",
        "alpha",
        "alpha",
        "alpha",
        "beta",
        "beta",
      ],
      factions: [
        { id: "alpha", rules: withP08 ? p08Rules() : emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze([1, 2, 3, 4, 3, 2, 1]);
  return createProspectiveMatchState(base, {
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
        id: "city-beta",
        ownerId: "beta",
        type: "CITY",
        cellId: 5,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
    factoryRailLoops: [
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-beta"]),
        servicedStructureIds: Object.freeze(["city-beta"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-beta", cellId: 4 }),
        ]),
      }),
    ],
  });
}

function createP14DesertRuntimeFixture(seed: string) {
  const width = 5;
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "DESERT"],
      initialOwners: ["alpha", "alpha", "beta", "beta", "beta"],
      factions: [
        { id: "alpha", rules: p14Rules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze([1, 2, 3, 2, 1]);
  return createProspectiveMatchState(base, {
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
        id: "city-beta",
        ownerId: "beta",
        type: "CITY",
        cellId: 4,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
    factoryRailLoops: [
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-beta"]),
        servicedStructureIds: Object.freeze(["city-beta"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-beta", cellId: 3 }),
        ]),
      }),
    ],
  });
}

function createN04MountainRuntimeFixture(seed: string) {
  const width = 5;
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "MOUNTAIN"],
      initialOwners: ["alpha", "alpha", "beta", "beta", "beta"],
      factions: [
        { id: "alpha", rules: n04Rules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze([1, 2, 3, 2, 1]);
  return createProspectiveMatchState(base, {
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
        id: "city-beta",
        ownerId: "beta",
        type: "CITY",
        cellId: 4,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
    factoryRailLoops: [
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-beta"]),
        servicedStructureIds: Object.freeze(["city-beta"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-beta", cellId: 3 }),
        ]),
      }),
    ],
  });
}

function createFieldConditionRuntimeFixture(
  seed: string,
  fieldType: "FORT" | "SAM_LAUNCHER",
) {
  const width = 5;
  const rules = fieldType === "FORT" ? p24Rules() : n11Rules();
  const base = createInitialMatchState(
    createMicroSimulationSpec({
      seed,
      width,
      height: 1,
      terrain: Array.from({ length: width }, () => "PLAINS" as const),
      initialOwners: ["alpha", "alpha", "beta", "beta", "alpha"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules: emptyRules() },
      ],
    }),
  );
  const loopCells = Object.freeze([1, 2, 1]);
  return createProspectiveMatchState(base, {
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
        id: "city-beta",
        ownerId: "beta",
        type: "CITY",
        cellId: 3,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
      {
        id: "field-a",
        ownerId: "alpha",
        type: fieldType,
        cellId: 4,
        completedLevel: 1,
        active: true,
        acquisitionPath: "GRANT",
      },
    ],
    factoryRailLoops: [
      createFactoryRailLoopLifecycleState("factory-a", {
        factoryId: "factory-a",
        targetStructureIds: Object.freeze(["city-beta"]),
        servicedStructureIds: Object.freeze(["city-beta"]),
        cells: loopCells,
        sharedExistingEdgeCount: 0,
        stationInterfaces: Object.freeze([
          Object.freeze({ structureId: "city-beta", cellId: 2 }),
        ]),
      }),
    ],
  });
}

describe("P07 Factory Train runtime dispatch", () => {
  it("dispatches P07 immediately with exactly one primary and no persisted phase state", () => {
    const { prepared, loopCells } = createP07RuntimeFixture(
      "factory-train-runtime-p07-first",
    );

    const advanced = new TickEngine().advance(prepared, []);
    const epoch = advanced.factoryTrainEpochs[0]!;

    expect(epoch).toMatchObject({
      factoryId: "factory-a",
      ownerId: "alpha",
      turnaroundRemainingActiveTicks: 0,
    });
    expect(epoch).not.toHaveProperty("p07PrimaryDispatchPhase");
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

  it("returns the next P07 primary after exactly 40 active turnaround ticks with no bonus Train", () => {
    const { prepared } = createP07RuntimeFixture(
      "factory-train-runtime-p07-cadence",
    );
    const engine = new TickEngine();
    let current = engine.advance(prepared, []);

    let completionGuard = 0;
    while (
      current.factoryTrainEpochs[0]?.activePrimaryTrainId !== null &&
      completionGuard < 20
    ) {
      current = engine.advance(current, []);
      completionGuard += 1;
    }
    expect(completionGuard).toBeLessThan(20);
    expect(current.factoryTrainEpochs[0]).toMatchObject({
      activePrimaryTrainId: null,
      turnaroundRemainingActiveTicks: 40,
    });
    expect(current.mobileUnits.filter((unit) => unit.type === "TRAIN")).toHaveLength(0);
    expect(current.trainServices).toHaveLength(0);

    for (let elapsed = 1; elapsed <= 39; elapsed += 1) {
      current = engine.advance(current, []);
    }
    expect(current.factoryTrainEpochs[0]).toMatchObject({
      activePrimaryTrainId: null,
      turnaroundRemainingActiveTicks: 1,
    });
    expect(current.mobileUnits.filter((unit) => unit.type === "TRAIN")).toHaveLength(0);

    current = engine.advance(current, []);
    expect(current.factoryTrainEpochs[0]?.turnaroundRemainingActiveTicks).toBe(0);
    expect(current.factoryTrainEpochs[0]?.activePrimaryTrainId).not.toBeNull();
    expect(current.mobileUnits.filter((unit) => unit.type === "TRAIN")).toHaveLength(1);
    expect(current.trainServices).toHaveLength(1);
    expect(current.trainServices[0]?.isPrimary).toBe(true);
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

describe("P34 Factory Train runtime dispatch", () => {
  it("snapshots 1.50x base cargo only for a conquered Factory", () => {
    const granted = new TickEngine().advance(
      createP34RuntimeFixture("factory-train-runtime-p34-granted", "GRANT"),
      [],
    );
    const conquered = new TickEngine().advance(
      createP34RuntimeFixture(
        "factory-train-runtime-p34-conquered",
        "CAPTURE_TRANSFER",
      ),
      [],
    );

    expect(granted.trainServices).toHaveLength(1);
    expect(granted.trainServices[0]?.dispatchSnapshot.baseCargoFfy).toEqual({
      numerator: 10_000n,
      denominator: 1n,
    });
    expect(conquered.trainServices).toHaveLength(1);
    expect(conquered.trainServices[0]?.dispatchSnapshot.baseCargoFfy).toEqual({
      numerator: 15_000n,
      denominator: 1n,
    });
  });
});

describe("Factory Train runtime event-location settlement", () => {
  it("applies P14 from the canonical Desert station cell", () => {
    const prepared = createP14DesertRuntimeFixture(
      "factory-train-runtime-p14-desert-location",
    );
    const alphaBefore = prepared.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;
    const passivePerTick =
      BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;

    const advanced = new TickEngine().advance(prepared, []);

    expect(advanced.mobileUnits.find((unit) => unit.type === "TRAIN")?.cellId).toBe(3);
    expect(
      advanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(alphaBefore + passivePerTick + 13_300);
  });

  it("applies N04 from the canonical Mountain station cell", () => {
    const prepared = createN04MountainRuntimeFixture(
      "factory-train-runtime-n04-mountain-location",
    );
    const alphaBefore = prepared.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;
    const passivePerTick =
      BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;

    const advanced = new TickEngine().advance(prepared, []);

    expect(advanced.mobileUnits.find((unit) => unit.type === "TRAIN")?.cellId).toBe(3);
    expect(
      advanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(alphaBefore + passivePerTick + 5_000);
  });

  it("applies P24 when the station cell lies inside the Train owner's Fort field", () => {
    const prepared = createFieldConditionRuntimeFixture(
      "factory-train-runtime-p24-fort-field",
      "FORT",
    );
    const alphaBefore = prepared.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;
    const passivePerTick =
      BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;

    const advanced = new TickEngine().advance(prepared, []);

    expect(
      advanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(alphaBefore + passivePerTick + 12_000);
  });

  it("applies N11 hard zero when the station cell lies inside the Train owner's SAM field", () => {
    const prepared = createFieldConditionRuntimeFixture(
      "factory-train-runtime-n11-sam-field",
      "SAM_LAUNCHER",
    );
    const alphaBefore = prepared.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;
    const passivePerTick =
      BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;

    const advanced = new TickEngine().advance(prepared, []);

    expect(
      advanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(alphaBefore + passivePerTick);
  });
});

describe("P08 Factory Train runtime settlement", () => {
  it("samples current atWar after dispatch and replaces only the wartime multiplier", () => {
    const baselinePeace = createExternalWartimeRuntimeFixture(
      "factory-train-runtime-wartime-baseline",
      false,
    );
    const p08Peace = createExternalWartimeRuntimeFixture(
      "factory-train-runtime-wartime-p08",
      true,
    );
    const passivePerTick =
      BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;

    const baselineDispatched = new TickEngine().advance(baselinePeace, []);
    const p08Dispatched = new TickEngine().advance(p08Peace, []);
    expect(baselineDispatched.trainServices).toHaveLength(1);
    expect(p08Dispatched.trainServices).toHaveLength(1);

    const wartimeGrace = [
      {
        sideA: { kind: "FACTION" as const, id: "alpha" },
        sideB: { kind: "FACTION" as const, id: "beta" },
        expiresAtTickExclusive: 100,
      },
    ];
    const baselineWartime = createProspectiveMatchState(baselineDispatched, {
      hostilityGrace: wartimeGrace,
    });
    const p08Wartime = createProspectiveMatchState(p08Dispatched, {
      hostilityGrace: wartimeGrace,
    });
    const baselineBeforeEvent = baselineWartime.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;
    const p08BeforeEvent = p08Wartime.factions.find(
      (faction) => faction.id === "alpha",
    )!.ffy;

    const baselineAdvanced = new TickEngine().advance(baselineWartime, []);
    const p08Advanced = new TickEngine().advance(p08Wartime, []);

    expect(
      baselineAdvanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(baselineBeforeEvent + passivePerTick + 5_000);
    expect(
      p08Advanced.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(p08BeforeEvent + passivePerTick + 10_000);
  });
});