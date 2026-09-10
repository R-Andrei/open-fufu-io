import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { ControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import {
  evaluateControllerRound,
} from "../src/simulation/ControllerRuntime";
import type { MatchState } from "../src/simulation/MatchState";
import {
  compileSegments,
  createSegmentRuntimeIndex,
} from "../src/simulation/Segments";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import { TickEngine } from "../src/simulation/TickEngine";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
  type ControllerWorkerRequest,
} from "../src/server/controller-runtime/ProductionControllerHost";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";

function localSpatialState(): MatchState {
  const rules = compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
  const terrain = Object.freeze([
    "PLAINS",
    "PLAINS",
    "PLAINS",
    "PLAINS",
    "PLAINS",
    "PLAINS",
  ] as const);
  const segments = createSegmentRuntimeIndex(
    compileSegments({ width: 3, height: 2, terrain }),
  );
  const map = createSimulationMap({
    source: "ARTIFACT",
    width: 3,
    height: 2,
    terrain,
    segments,
  });
  const population = Object.freeze({
    total: 0,
    available: 0,
    committedOffensive: 0,
    committedCounterResponse: 0,
    aboardTransports: 0,
    peakTotal: 0,
    neutralSettlementHalfResidual: 0 as const,
  });

  return Object.freeze({
    seed: "controller-public-spatial-runtime",
    tick: 11,
    map,
    ownership: Object.freeze([null, "alpha", "beta", "beta", null, "alpha"]),
    fallout: Object.freeze([false, false, false, false, false, false]),
    factions: Object.freeze([
      Object.freeze({
        id: "alpha",
        status: "ACTIVE" as const,
        rules,
        population,
        testMarker: 0,
      }),
      Object.freeze({
        id: "beta",
        status: "ACTIVE" as const,
        rules,
        population,
        testMarker: 0,
      }),
    ]),
    structures: Object.freeze([]),
    mobileUnits: Object.freeze([]),
    nextMobileUnitOrdinal: 0,
    operations: Object.freeze([]),
    defensePriorities: Object.freeze([]),
    captureProgress: Object.freeze([]),
    counterResponseResiduals: Object.freeze([]),
    hostilityGrace: Object.freeze([]),
  });
}

function artifact(moduleSource: string): ControllerRuntimeArtifact {
  return Object.freeze({
    moduleSource,
    entrypoints: Object.freeze({ decide: "decide" }),
  });
}

function workerRequest(moduleSource: string): ControllerWorkerRequest {
  return Object.freeze({
    factionId: "alpha",
    artifact: artifact(moduleSource),
    hook: "DECIDE",
    entrypoint: "decide",
    context: Object.freeze({ tick: 7 }),
    memoryJson: "{}",
    timeoutMs: 20_000,
    moduleEvaluationTimeoutMs: 100,
    isolateMemoryMb: 32,
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for controller worker replacement");
}

describe("controller local public spatial runtime", () => {
  it("serves map, public ownership, and canonical Segment cells synchronously inside the isolate", async () => {
    const state = localSpatialState();
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide(context) {
            const checks = [
              context.map.width === 3,
              context.map.height === 2,
              context.map.cellCount === 6,
              context.map.isValidCellId(5) === true,
              context.map.isValidCellId(6) === false,
              context.map.cellIdAt(2, 1) === 5,
              context.map.cellIdAt(3, 1) === undefined,
              JSON.stringify(context.map.positionOf(5)) === '{"x":2,"y":1}',
              context.map.positionOf(6) === undefined,
              context.map.terrainAt(5) === "PLAINS",
              context.map.terrainAt(6) === undefined,
              context.map.segmentIdOf(5) === 0,
              context.map.segmentIdOf(6) === undefined,
              JSON.stringify(context.map.cardinalNeighbors(1)) === "[0,2,4]",
              context.map.cardinalNeighbors(6) === undefined,
              context.cells.owner(0) === null,
              context.cells.owner(1) === "alpha",
              context.cells.owner(2) === "beta",
              context.cells.owner(6) === undefined,
              JSON.stringify(context.segments.cellIds(0)) === "[0,1,2,3,4,5]",
              context.segments.cellIds(1) === undefined,
            ];
            return checks.every(Boolean)
              ? {
                  commands: [
                    { kind: "CAPITULATE", key: "local-public-spatial-ok" },
                  ],
                }
              : { commands: [] };
          }
        `),
        beta: artifact("export function decide() { return { commands: [] }; }"),
      });

      const evaluated = await Promise.resolve(
        evaluateControllerRound(
          state,
          host,
          4,
          new Map(),
          new Map(),
          new Map(),
          new Set(),
        ),
      );

      expect(evaluated.actions).toEqual([
        { type: "CAPITULATE_FACTION", factionId: "alpha" },
      ]);
      expect(
        evaluated.receipts.find((entry) => entry.factionId === "alpha")?.receipt,
      ).toMatchObject({ accepted: true, faultCount: 0, faulted: false });
    } finally {
      await pool.close();
    }
  });

  it("does not retain removed connectedComponents as a hidden production isolate capability", async () => {
    const state = localSpatialState();
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export async function decide(context) {
            await context.cells.connectedComponents({ kind: "CELLS", ids: [0] });
            return {
              commands: [
                { kind: "CAPITULATE", key: "removed-components-capability" },
              ],
            };
          }
        `),
        beta: artifact("export function decide() { return { commands: [] }; }"),
      });

      const evaluated = await Promise.resolve(
        evaluateControllerRound(
          state,
          host,
          5,
          new Map(),
          new Map(),
          new Map(),
          new Set(),
        ),
      );

      expect(evaluated.actions).toEqual([]);
      expect(
        evaluated.receipts.find((entry) => entry.factionId === "alpha")?.receipt,
      ).toEqual({
        decisionNumber: 5,
        accepted: false,
        failure: { code: "RUNTIME_ERROR" },
        faultCount: 1,
        faulted: false,
      });
    } finally {
      await pool.close();
    }
  });

  it("preserves the immutable ownership revision across a tick with no ownership change", () => {
    const state = localSpatialState();
    const advanced = new TickEngine().advance(state, []);

    expect(advanced.ownership).toBe(state.ownership);
    expect(advanced.ownership).toEqual(state.ownership);
  });

  it("reuses a production-shaped public spatial revision and replaces extreme ownership churn coherently", async () => {
    const width = 2_400;
    const height = 2_000;
    const cellCount = width * height;
    let terrainReads = 0;
    let allowTerrainReads = true;
    const map = Object.freeze({
      width,
      height,
      cellCount,
      terrainAt() {
        if (!allowTerrainReads) {
          throw new Error("static map raster was rebuilt for an unchanged map");
        }
        terrainReads += 1;
        return "PLAINS" as const;
      },
      segments: undefined,
    }) as unknown as MatchState["map"];

    const ownershipRevision = (
      ownerId: string,
      onRead: () => void,
    ): MatchState["ownership"] => {
      const target = new Array<string | null>(cellCount);
      return new Proxy(target, {
        get(array, property, receiver) {
          if (typeof property === "string" && /^\d+$/.test(property)) {
            onRead();
            return ownerId;
          }
          return Reflect.get(array, property, receiver);
        },
      });
    };

    let firstOwnershipReads = 0;
    let allowFirstOwnershipReads = true;
    const firstOwnership = ownershipRevision("alpha", () => {
      if (!allowFirstOwnershipReads) {
        throw new Error("unchanged ownership revision was rescanned");
      }
      firstOwnershipReads += 1;
    });
    const firstSession = Object.freeze({
      publicSpatial: Object.freeze({ map, ownership: firstOwnership }),
      usage: () => Object.freeze({ queries: 0, materializedCells: 0 }),
    }) as unknown as ControllerQuerySession;

    const request = workerRequest(`
      export function decide(context) {
        return {
          commands: [],
          log: [
            context.map.cellCount,
            context.map.terrainAt(0),
            context.cells.owner(0),
            context.cells.owner(2400000),
            context.cells.owner(4799999),
          ].join(":"),
        };
      }
    `);

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const first = await pool.invoke(request, firstSession);
      expect(first).toEqual({
        ok: true,
        output: {
          commands: [],
          log: "4800000:PLAINS:alpha:alpha:alpha",
        },
        usage: { queries: 0, materializedCells: 0 },
      });
      expect(terrainReads).toBe(cellCount);
      expect(firstOwnershipReads).toBe(cellCount);

      allowTerrainReads = false;
      allowFirstOwnershipReads = false;
      const repeated = await pool.invoke(request, firstSession);
      expect(repeated).toEqual(first);
      expect(terrainReads).toBe(cellCount);
      expect(firstOwnershipReads).toBe(cellCount);

      let replacementOwnershipReads = 0;
      const replacementSession = Object.freeze({
        publicSpatial: Object.freeze({
          map,
          ownership: ownershipRevision("beta", () => {
            replacementOwnershipReads += 1;
          }),
        }),
        usage: () => Object.freeze({ queries: 0, materializedCells: 0 }),
      }) as unknown as ControllerQuerySession;
      const replaced = await pool.invoke(request, replacementSession);
      expect(replaced).toEqual({
        ok: true,
        output: {
          commands: [],
          log: "4800000:PLAINS:beta:beta:beta",
        },
        usage: { queries: 0, materializedCells: 0 },
      });
      expect(terrainReads).toBe(cellCount);
      expect(replacementOwnershipReads).toBe(cellCount);

      const replacedWorkerPid = pool.workerProcessIds()[0];
      if (replacedWorkerPid === undefined) throw new Error("expected worker pid");
      process.kill(replacedWorkerPid, "SIGKILL");
      await waitFor(() => pool.workerProcessIds()[0] !== replacedWorkerPid);

      const recovered = await pool.invoke(request, replacementSession);
      expect(recovered).toEqual(replaced);
      expect(terrainReads).toBe(cellCount);
      expect(replacementOwnershipReads).toBe(cellCount);
    } finally {
      await pool.close();
    }
  }, 20_000);
});
