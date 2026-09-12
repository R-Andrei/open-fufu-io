import type { ControllerDecision } from "../src/core/controller/ControllerApi";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  createControllerQuerySession,
} from "../src/simulation/ControllerQueryProjection";
import {
  InProcessTestControllerHost,
  type ControllerHost,
  type ControllerHostInvocationResult,
  type LawfulControllerObservation,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function twoFactionRuntime(seed: string) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
    { controllerReferenceNamespace: `controller-runtime:${seed}` },
  );
}

function alphaReceipt(
  receipts: Awaited<ReturnType<MatchRuntime["runControllerRound"]>>,
) {
  const receipt = receipts.find((entry) => entry.factionId === "alpha")?.receipt;
  if (receipt === undefined) throw new Error("missing alpha controller receipt");
  return receipt;
}

function asyncCapitulationHost(completionOrder: string[]): ControllerHost {
  const host = {
    invoke(factionId: string, observation: LawfulControllerObservation) {
      const delayMs = factionId === "alpha" ? 5 : 0;
      return new Promise<ControllerHostInvocationResult<ControllerDecision>>(
        (resolve) => {
          setTimeout(() => {
            completionOrder.push(
              `${factionId}:${observation.factions.map((faction) => faction.status).join(",")}`,
            );
            resolve({
              ok: true,
              output: {
                commands: [
                  {
                    kind: "CAPITULATE",
                    key: `${factionId}-out`,
                  },
                ],
              },
            });
          }, delayMs);
        },
      );
    },
    chooseInfluence() {
      return Promise.resolve({ ok: true as const });
    },
    reconsiderInfluence() {
      return Promise.resolve({ ok: true as const });
    },
    chooseOrigins() {
      return Promise.resolve({ ok: true as const });
    },
  };
  return host as unknown as ControllerHost;
}

describe("controller runtime production-host foundation", () => {
  it("awaits asynchronous host results while preserving same-prestate deterministic commit order", async () => {
    const runtime = twoFactionRuntime("async-host-order");
    const completionOrder: string[] = [];

    const receipts = await runtime.runControllerRound(
      asyncCapitulationHost(completionOrder),
    );

    expect(completionOrder).toEqual([
      "beta:ACTIVE,ACTIVE",
      "alpha:ACTIVE,ACTIVE",
    ]);
    expect(receipts.map((entry) => [entry.factionId, entry.receipt.accepted])).toEqual([
      ["alpha", true],
      ["beta", true],
    ]);
    expect(runtime.acceptedInputs().map((input) => input.action)).toEqual([
      { type: "CAPITULATE_FACTION", factionId: "alpha" },
      { type: "CAPITULATE_FACTION", factionId: "beta" },
    ]);
  });

  it("keeps an asynchronous controller round atomic against tick and same-tick re-entry", async () => {
    const runtime = twoFactionRuntime("async-host-atomicity");
    let resolveAlpha: ((result: ControllerHostInvocationResult<ControllerDecision>) => void) | undefined;
    const host = {
      invoke(factionId: string) {
        if (factionId === "alpha") {
          return new Promise<ControllerHostInvocationResult<ControllerDecision>>(
            (resolve) => {
              resolveAlpha = resolve;
            },
          );
        }
        return Promise.resolve({ ok: true as const });
      },
      chooseInfluence() {
        return Promise.resolve({ ok: true as const });
      },
      reconsiderInfluence() {
        return Promise.resolve({ ok: true as const });
      },
      chooseOrigins() {
        return Promise.resolve({ ok: true as const });
      },
    } as unknown as ControllerHost;

    const pending = runtime.runControllerRound(host);

    expect(() => runtime.tick()).toThrow(/controller round.*in progress/i);
    expect(() => runtime.runControllerRound(host)).toThrow(
      /controller round.*in progress/i,
    );

    if (resolveAlpha === undefined) throw new Error("alpha invocation did not start");
    resolveAlpha({ ok: true });
    await pending;

    expect(runtime.snapshot().tick).toBe(0);
    expect(() => runtime.runControllerRound(host)).toThrow(/already executed/i);
  });

  it("faults a controller on the fifth consecutive normal-runtime fault and skips later invocation", async () => {
    const runtime = twoFactionRuntime("controller-circuit-consecutive");
    let alphaInvocations = 0;
    const host = new InProcessTestControllerHost({
      alpha() {
        alphaInvocations += 1;
        throw new Error("normal runtime fault");
      },
    });

    let fifthReceipt;
    for (let index = 0; index < 5; index += 1) {
      fifthReceipt = alphaReceipt(await runtime.runControllerRound(host));
      runtime.tick();
    }

    expect(fifthReceipt).toMatchObject({
      faultCount: 5,
      faulted: true,
    });

    const afterFaulted = alphaReceipt(await runtime.runControllerRound(host));
    expect(alphaInvocations).toBe(5);
    expect(afterFaulted).toMatchObject({
      faultCount: 5,
      faulted: true,
    });
  });

  it("resets consecutive normal-runtime faults after a successful invocation", async () => {
    const runtime = twoFactionRuntime("controller-circuit-reset");
    let alphaInvocations = 0;
    const host = new InProcessTestControllerHost({
      alpha() {
        alphaInvocations += 1;
        if (alphaInvocations === 5) return { commands: [] };
        throw new Error("normal runtime fault");
      },
    });

    let fourthAfterSuccess;
    let fifthAfterSuccess;
    for (let index = 0; index < 10; index += 1) {
      const receipt = alphaReceipt(await runtime.runControllerRound(host));
      if (index === 8) fourthAfterSuccess = receipt;
      if (index === 9) fifthAfterSuccess = receipt;
      runtime.tick();
    }

    expect(fourthAfterSuccess).toMatchObject({
      faultCount: 8,
      faulted: false,
    });
    expect(fifthAfterSuccess).toMatchObject({
      faultCount: 9,
      faulted: true,
    });
  });

  it("faults a controller on its twentieth total normal-runtime fault even when faults are non-consecutive", async () => {
    const runtime = twoFactionRuntime("controller-circuit-total");
    let alphaInvocations = 0;
    const host = new InProcessTestControllerHost({
      alpha() {
        alphaInvocations += 1;
        if (alphaInvocations % 2 === 0) return { commands: [] };
        throw new Error("normal runtime fault");
      },
    });

    let twentiethFault;
    for (let index = 0; index < 39; index += 1) {
      twentiethFault = alphaReceipt(await runtime.runControllerRound(host));
      runtime.tick();
    }

    expect(twentiethFault).toMatchObject({
      faultCount: 20,
      faulted: true,
    });
  });

  it("keeps Strategic Spawn hook failures outside the normal-play circuit breaker", async () => {
    const runtime = twoFactionRuntime("spawn-fault-separation");
    const host = new InProcessTestControllerHost({
      alpha: {
        chooseInfluence() {
          throw new Error("spawn hook fault");
        },
        decide() {
          return { commands: [] };
        },
      },
    });

    for (let index = 0; index < 20; index += 1) {
      const result = await host.chooseInfluence(
        "alpha",
        { phase: "INFLUENCE", memory: {} } as never,
      );
      expect(result.ok).toBe(false);
    }

    expect(alphaReceipt(await runtime.runControllerRound(host))).toMatchObject({
      faultCount: 0,
      faulted: false,
    });
  });

  it("projects bounded CELLS queries deterministically and accounts exact usage", async () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-query-red",
        width: 2,
        height: 2,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-query-red" },
    );
    const session = createControllerQuerySession(runtime.snapshot(), "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });

    const page = await session.cells.query(
      { kind: "CELLS", ids: [3, 1, 2] },
      2,
    );

    expect(page.items.map((cell) => cell.id)).toEqual([1, 2]);
    expect(page.truncated).toBe(true);
    expect(session.usage()).toEqual({ queries: 1, materializedCells: 2 });
  });

  it("projects immutable full CellView data and canonical local geometry", async () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-cell-view-red",
        width: 2,
        height: 2,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS"],
        initialOwners: ["alpha", null, null, null],
        initialFallout: [false, false, false, false],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-cell-view-red" },
    );
    const session = createControllerQuerySession(runtime.snapshot(), "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });

    const cell = await session.cells.get(0);
    const neighbors = await session.cells.neighbors(0);
    const distance = await session.cells.distance(0, 3);

    expect(cell).toEqual({
      id: 0,
      position: { x: 0, y: 0 },
      terrain: "PLAINS",
      hasFallout: false,
      conquerable: true,
      populationBearing: true,
      ownerId: "alpha",
      isCoast: false,
      isShoreline: false,
    });
    expect(Object.isFrozen(cell)).toBe(true);
    expect(Object.isFrozen(cell?.position)).toBe(true);
    expect(neighbors).toEqual([1, 2]);
    expect(Object.isFrozen(neighbors)).toBe(true);
    expect(distance).toBeCloseTo(Math.SQRT2);
    expect(session.usage()).toEqual({ queries: 3, materializedCells: 1 });
  });

  it("projects deterministic CellView queries, counts, boundaries, and connected components", async () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-spatial-query-red",
        width: 5,
        height: 5,
        terrain: Array.from({ length: 25 }, () => "PLAINS"),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-spatial-query-red" },
    );
    const session = createControllerQuerySession(runtime.snapshot(), "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });

    const selector = { kind: "CELLS", ids: [24, 12, 0, 1] } as const;
    const page = await session.cells.query(selector, 3);
    const count = await session.cells.count(selector);
    const boundary = await session.cells.boundary({
      kind: "CELLS",
      ids: [6, 7, 8, 11, 12, 13, 16, 17, 18],
    });
    const components = await session.cells.connectedComponents({
      kind: "CELLS",
      ids: [24, 5, 1, 0],
    });

    expect(page.items.map((cell) => cell.id)).toEqual([0, 1, 12]);
    expect(page.items[0]).toMatchObject({
      position: { x: 0, y: 0 },
      terrain: "PLAINS",
      conquerable: true,
      populationBearing: true,
    });
    expect(page.truncated).toBe(true);
    expect(Object.isFrozen(page.items[0])).toBe(true);
    expect(count).toBe(4);
    expect(boundary.items.map((cell) => cell.id)).toEqual([
      6, 7, 8, 11, 13, 16, 17, 18,
    ]);
    expect(boundary.truncated).toBe(false);
    expect(components).toEqual({
      items: [
        { kind: "CELLS", ids: [0, 1, 5] },
        { kind: "CELLS", ids: [24] },
      ],
      truncated: false,
    });
    expect(session.usage()).toEqual({ queries: 4, materializedCells: 15 });
  });

  it("projects established non-structure selectors and set composition", async () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-selector-red",
        width: 3,
        height: 3,
        terrain: [
          "PLAINS",
          "FOREST",
          "DEEP_WATER",
          "TUNDRA",
          "SHALLOW_WATER",
          "MOUNTAIN",
          "IMPASSABLE",
          "MARSH",
          "PLAINS",
        ],
        initialOwners: ["alpha", "beta", null, null, "alpha", "beta", null, null, "alpha"],
        initialFallout: [false, false, false, true, false, false, false, false, false],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-selector-red" },
    );
    const session = createControllerQuerySession(runtime.snapshot(), "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });
    const ids = async (
      selector: Parameters<typeof session.cells.query>[0],
    ): Promise<number[]> =>
      (await session.cells.query(selector)).items.map((cell) => cell.id);

    expect(await ids({ kind: "OWNER", factionId: "alpha" })).toEqual([0, 4, 8]);
    expect(await ids({ kind: "OWNER" })).toEqual([2, 3, 6, 7]);
    expect(await ids({ kind: "TERRAIN", terrain: "PLAINS" })).toEqual([0, 8]);
    expect(await ids({ kind: "FALLOUT", value: true })).toEqual([3]);
    expect(await ids({ kind: "POPULATION_BEARING", value: true })).toEqual([
      0, 1, 5, 7, 8,
    ]);
    expect(await ids({ kind: "CONQUERABLE", value: false })).toEqual([2, 6]);
    expect(await ids({ kind: "COAST", value: true })).toEqual([1, 3, 5, 7]);
    expect(await ids({ kind: "SHORELINE", value: true })).toEqual([2, 4]);
    expect(await ids({ kind: "CIRCLE", center: 4, radius: 1 })).toEqual([
      1, 3, 4, 5, 7,
    ]);
    expect(
      await ids({
        kind: "UNION",
        selectors: [
          { kind: "TERRAIN", terrain: "PLAINS" },
          { kind: "FALLOUT", value: true },
        ],
      }),
    ).toEqual([0, 3, 8]);
    expect(
      await ids({
        kind: "INTERSECTION",
        selectors: [
          { kind: "OWNER", factionId: "alpha" },
          { kind: "POPULATION_BEARING", value: true },
        ],
      }),
    ).toEqual([0, 8]);
    expect(
      await ids({
        kind: "DIFFERENCE",
        left: { kind: "OWNER", factionId: "alpha" },
        right: { kind: "TERRAIN", terrain: "PLAINS" },
      }),
    ).toEqual([4]);
    expect(session.usage()).toEqual({ queries: 12, materializedCells: 34 });
  });

  it("enforces the exact 128-query per-decision ceiling", async () => {
    const rules = emptyRules();
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-query-budget-red",
        width: 1,
        height: 1,
        terrain: ["PLAINS"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-query-budget-red" },
    );
    const session = createControllerQuerySession(runtime.snapshot(), "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });
    const selector = { kind: "CELLS", ids: [] } as const;

    for (let index = 0; index < 127; index += 1) {
      await session.cells.count(selector);
    }
    expect(session.usage()).toEqual({ queries: 127, materializedCells: 0 });

    await session.cells.count(selector);
    expect(session.usage()).toEqual({ queries: 128, materializedCells: 0 });

    await expect(session.cells.count(selector)).rejects.toThrow(
      /query budget exhausted/i,
    );
    expect(session.usage()).toEqual({ queries: 128, materializedCells: 0 });
  });

  it("enforces the exact 25,000-cell shared materialization ceiling", async () => {
    const rules = emptyRules();
    const cellIds = Array.from({ length: 25_001 }, (_, id) => id);
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-materialization-budget-red",
        width: 25_001,
        height: 1,
        terrain: Array.from({ length: 25_001 }, () => "PLAINS"),
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-materialization-budget-red" },
    );
    const state = runtime.snapshot();
    const makeSession = () =>
      createControllerQuerySession(state, "alpha", {
        queriesPerDecision: 128,
        materializedCellsPerDecision: 25_000,
      });

    const below = makeSession();
    const belowPage = await below.cells.query({ kind: "CELLS", ids: cellIds.slice(0, 24_999) });
    expect(belowPage.items).toHaveLength(24_999);
    expect(belowPage.truncated).toBe(false);
    expect(below.usage()).toEqual({ queries: 1, materializedCells: 24_999 });

    const exact = makeSession();
    const exactPage = await exact.cells.query({ kind: "CELLS", ids: cellIds.slice(0, 25_000) });
    expect(exactPage.items).toHaveLength(25_000);
    expect(exactPage.truncated).toBe(false);
    expect(exact.usage()).toEqual({ queries: 1, materializedCells: 25_000 });

    const above = makeSession();
    const abovePage = await above.cells.query({ kind: "CELLS", ids: cellIds });
    expect(abovePage.items).toHaveLength(25_000);
    expect(abovePage.truncated).toBe(true);
    expect(above.usage()).toEqual({ queries: 1, materializedCells: 25_000 });

    const mixed = makeSession();
    expect(await mixed.cells.get(0)).toBeDefined();
    const remainder = await mixed.cells.query({
      kind: "CELLS",
      ids: cellIds.slice(1, 25_001),
    });
    expect(remainder.items).toHaveLength(24_999);
    expect(remainder.truncated).toBe(true);
    expect(mixed.usage()).toEqual({ queries: 2, materializedCells: 25_000 });
    await expect(mixed.cells.get(0)).rejects.toThrow();
    expect(mixed.usage()).toEqual({ queries: 3, materializedCells: 25_000 });
  });

  it("projects canonical Segment summaries, selectors, membership, and synthetic absence", async () => {
    const [{ compileSegments, createSegmentRuntimeIndex }, { createSimulationMap }] =
      await Promise.all([
        import("../src/simulation/Segments"),
        import("../src/simulation/SimulationMap"),
      ]);
    const rules = emptyRules();
    const terrain = [
      "PLAINS", "PLAINS", "PLAINS", "PLAINS",
      "PLAINS", "PLAINS", "PLAINS", "PLAINS",
      "DEEP_WATER", "DEEP_WATER", "DEEP_WATER", "DEEP_WATER",
      "DEEP_WATER", "DEEP_WATER", "DEEP_WATER", "DEEP_WATER",
    ] as const;
    const owners = [
      "alpha", "alpha", "alpha", "alpha",
      "beta", "beta", null, null,
      null, null, null, null,
      null, null, null, null,
    ] as const;
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "controller-segment-red",
        width: 4,
        height: 4,
        terrain,
        initialOwners: owners,
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
      { controllerReferenceNamespace: "controller-segment-red" },
    );
    const compiled = compileSegments({ width: 4, height: 4, terrain });
    const map = createSimulationMap({
      source: "SYNTHETIC",
      width: 4,
      height: 4,
      terrain,
      segments: createSegmentRuntimeIndex(compiled),
    });
    const state = Object.freeze({ ...runtime.snapshot(), map });
    const session = createControllerQuerySession(state, "alpha", {
      queriesPerDecision: 128,
      materializedCellsPerDecision: 25_000,
    });

    const list = await session.segments.list();
    expect(list).toEqual([
      {
        id: 0,
        cellCount: 8,
        populationBearingCellCount: 8,
        ownerShares: { alpha: 0.5, beta: 0.25 },
        adjacentSegmentIds: [1],
        terrainCounts: { PLAINS: 8 },
      },
      {
        id: 1,
        cellCount: 8,
        populationBearingCellCount: 0,
        ownerShares: {},
        adjacentSegmentIds: [0],
        terrainCounts: { DEEP_WATER: 8 },
      },
    ]);
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list[0])).toBe(true);
    expect(Object.isFrozen(list[0]?.ownerShares)).toBe(true);
    expect(Object.isFrozen(list[0]?.terrainCounts)).toBe(true);
    expect(Object.isFrozen(list[0]?.adjacentSegmentIds)).toBe(true);
    expect(await session.segments.get(1)).toEqual(list[1]);

    const selector = session.segments.cells(0);
    expect(selector).toEqual({ kind: "SEGMENT", segmentId: 0 });
    expect(Object.isFrozen(selector)).toBe(true);
    const firstSegmentCells = await session.cells.query(selector);
    expect(firstSegmentCells.items.map((cell) => cell.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(firstSegmentCells.truncated).toBe(false);
    expect((await session.cells.get(8))?.segmentId).toBe(1);
    expect(session.usage()).toEqual({ queries: 4, materializedCells: 9 });

    const tiny = createControllerQuerySession(
      twoFactionRuntime("controller-segmentless-synthetic").snapshot(),
      "alpha",
      {
        queriesPerDecision: 128,
        materializedCellsPerDecision: 25_000,
      },
    );
    expect(await tiny.segments.list()).toEqual([]);
    expect(tiny.usage()).toEqual({ queries: 1, materializedCells: 0 });
  });
});
