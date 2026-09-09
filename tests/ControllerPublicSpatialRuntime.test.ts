import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  evaluateControllerRound,
} from "../src/simulation/ControllerRuntime";
import type { MatchState } from "../src/simulation/MatchState";
import {
  compileSegments,
  createSegmentRuntimeIndex,
} from "../src/simulation/Segments";
import { createSimulationMap } from "../src/simulation/SimulationMap";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
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
});
