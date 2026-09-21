import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import type { ControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  evaluateControllerRound,
} from "../src/simulation/ControllerRuntime";
import * as Economy from "../src/simulation/Economy";
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
        displayName: "Alpha Republic",
        isMinorFaction: false,
        origin: Object.freeze({
          id: "origin-alpha",
          displayName: "Alpha Origin",
          version: "1",
          positiveTraitIds: Object.freeze(["P01"]),
          negativeTraitIds: Object.freeze(["N01"]),
        }),
        status: "ACTIVE" as const,
        rules,
        population,
        ffy: 25_000,
        lifetimeGrossPositiveFfyEarned: 0,
        successfulStructurePurchaseTypes: Object.freeze([]),
        testMarker: 0,
      }),
      Object.freeze({
        id: "beta",
        displayName: "Beta Goons",
        isMinorFaction: true,
        status: "ACTIVE" as const,
        rules,
        population,
        ffy: 25_000,
        lifetimeGrossPositiveFfyEarned: 0,
        successfulStructurePurchaseTypes: Object.freeze([]),
        testMarker: 0,
      }),
    ]),
    structures: Object.freeze([]),
    mobileUnits: Object.freeze([]),
    nextMobileUnitOrdinal: 0,
    factoryRailLoops: Object.freeze([]),
    factoryTrainEpochs: Object.freeze([]),
    trainServices: Object.freeze([]),
    tankProductionJobs: Object.freeze([]),
    tankOperationalStates: Object.freeze([]),
    directReveals: Object.freeze([]),
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
  it("keeps the authoritative faction-score producer out of Economy", () => {
    expect(Economy).not.toHaveProperty("calculateFactionScore");
  });

  it("serves map, public ownership, and canonical Segment cells synchronously inside the isolate", async () => {
    const state = localSpatialState();
    const references = new ControllerReferenceSession(
      "controller-public-spatial-local-read",
      state,
    );
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide(context) {
            const factions = context.factions.find();
            const self = factions.find((candidate) => candidate.relation === "SELF");
            const enemy = factions.find((candidate) => candidate.relation === "ENEMY");
            const checks = [
              self !== undefined,
              enemy !== undefined,
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
              context.cells.owner(1) === self?.ref,
              context.cells.owner(2) === enemy?.ref,
              context.cells.owner(6) === undefined,
              JSON.stringify(context.segments.cellIds(0)) === "[0,1,2,3,4,5]",
              context.segments.cellIds(1) === undefined,
            ];
            if (checks.every(Boolean)) context.capitulate();
            return {};
          }
        `),
        beta: artifact("export function decide() { return {}; }"),
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
          references,
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

  it("preserves authoritative faction metadata through the production isolate without Minor score placeholders", async () => {
    const state = localSpatialState();
    const references = new ControllerReferenceSession(
      "controller-public-faction-metadata-worker-red",
      state,
    );
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide(context) {
            const factions = context.factions.find();
            const self = factions.find((candidate) => candidate.relation === "SELF");
            const enemy = factions.find((candidate) => candidate.relation === "ENEMY");
            const valid =
              self?.displayName === "Alpha Republic" &&
              self?.isMinorFaction === false &&
              self?.origin?.id === "origin-alpha" &&
              self?.origin?.displayName === "Alpha Origin" &&
              typeof self?.score === "number" &&
              enemy?.displayName === "Beta Goons" &&
              enemy?.isMinorFaction === true &&
              !Object.prototype.hasOwnProperty.call(enemy, "score") &&
              !Object.prototype.hasOwnProperty.call(enemy, "origin");
            if (valid) context.capitulate();
            return {};
          }
        `),
        beta: artifact("export function decide() { return {}; }"),
      });

      const evaluated = await Promise.resolve(
        evaluateControllerRound(
          state,
          host,
          41,
          new Map(),
          new Map(),
          new Map(),
          new Set(),
          references,
        ),
      );

      expect(evaluated.actions).toEqual([
        { type: "CAPITULATE_FACTION", factionId: "alpha" },
      ]);
    } finally {
      await pool.close();
    }
  });

  it("does not retain removed connectedComponents as a hidden production isolate capability", async () => {
    const state = localSpatialState();
    const references = new ControllerReferenceSession(
      "controller-public-spatial-removed-components",
      state,
    );
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export async function decide(context) {
            await context.cells.connectedComponents({ kind: "CELLS", ids: [0] });
            context.capitulate();
            return {};
          }
        `),
        beta: artifact("export function decide() { return {}; }"),
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
          references,
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

  it("bridges ref-valued faction, unit, and structure reads through copied production IPC", async () => {
    const factionRef = "ofr1:controller-worker-read:f:000000000001";
    const unitRef = Object.freeze({
      type: "UNIT" as const,
      token: "ofr1:controller-worker-read:u:000000000001",
    });
    const structureRef = Object.freeze({
      type: "STRUCTURE" as const,
      token: "ofr1:controller-worker-read:s:000000000001",
    });
    const unitView = Object.freeze({
      ref: unitRef,
      ownerId: "beta",
      type: "TANK" as const,
      cellId: 4,
      active: true,
      repositionable: true,
    });
    const structureView = Object.freeze({
      ref: structureRef,
      ownerId: "beta",
      type: "FORT" as const,
      completedLevel: 1 as const,
      cellId: 5,
      active: true,
    });
    const publicSpatialState = localSpatialState();
    const queryCalls: unknown[] = [];
    let usage = {
      queries: 0,
      materializedCells: 0,
      materializedEntityViews: 0,
    };
    const recordQuery = (materializedEntityViews = 0): void => {
      usage = {
        ...usage,
        queries: usage.queries + 1,
        materializedEntityViews:
          usage.materializedEntityViews + materializedEntityViews,
      };
    };
    const querySession = {
      publicSpatial: Object.freeze({
        map: publicSpatialState.map,
        ownership: publicSpatialState.ownership,
      }),
      publicFactions: Object.freeze({
        requesterFactionId: "alpha",
        entries: Object.freeze([
          Object.freeze({
            authoritativeId: "beta",
            ref: factionRef,
            displayName: "Beta Goons",
            status: "ACTIVE" as const,
            relation: "ENEMY" as const,
            isMinorFaction: true,
          }),
        ]),
      }),
      units: {
        async find(filter?: unknown) {
          queryCalls.push({ namespace: "units", operation: "find", filter });
          recordQuery(1);
          return { items: [unitView], truncated: false };
        },
      },
      structures: {
        async get(locator: unknown) {
          queryCalls.push({ namespace: "structures", operation: "get", locator });
          recordQuery(1);
          return structureView;
        },
      },
      usage() {
        return usage;
      },
    } as unknown as ControllerQuerySession;

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const response = await pool.invoke(
        workerRequest(`
          export async function decide(context) {
            const surfaceTypes = {
              factionsFind: typeof context.factions?.find,
              unitsFind: typeof context.units?.find,
              structuresGet: typeof context.structures?.get,
            };
            if (Object.values(surfaceTypes).some((value) => value !== "function")) {
              return { log: JSON.stringify({ surfaceTypes }) };
            }

            const factions = context.factions.find({ relation: "ENEMY" });
            const units = await context.units.find({
              faction: factions[0].ref,
              limit: 1,
            });
            const structure = await context.structures.get({
              ref: ${JSON.stringify(structureRef)},
            });
            let factionMutationBlocked = false;
            let unitMutationBlocked = false;
            let structureMutationBlocked = false;
            try {
              factions[0].relation = "ALLY";
            } catch {
              factionMutationBlocked = true;
            }
            try {
              units.items[0].cellId = 99;
            } catch {
              unitMutationBlocked = true;
            }
            try {
              structure.cellId = 99;
            } catch {
              structureMutationBlocked = true;
            }
            return {
              log: JSON.stringify({
                surfaceTypes,
                factionRef: factions[0].ref,
                unitRef: units.items[0].ref,
                structureRef: structure.ref,
                factionMutationBlocked,
                unitMutationBlocked,
                structureMutationBlocked,
              }),
            };
          }
        `),
        querySession,
      );

      expect(response.ok).toBe(true);
      if (!response.ok) throw new Error("expected successful entity-read worker probe");
      expect(JSON.parse(response.output?.log ?? "{}")).toEqual({
        surfaceTypes: {
          factionsFind: "function",
          unitsFind: "function",
          structuresGet: "function",
        },
        factionRef,
        unitRef,
        structureRef,
        factionMutationBlocked: true,
        unitMutationBlocked: true,
        structureMutationBlocked: true,
      });
      expect(response.usage).toEqual({
        queries: 3,
        materializedCells: 0,
      });
      expect(
        (
          response.usage as typeof response.usage & {
            readonly materializedEntityViews: number;
          }
        ).materializedEntityViews,
      ).toBe(2);
      expect(queryCalls).toEqual([
        {
          namespace: "units",
          operation: "find",
          filter: { faction: factionRef, limit: 1 },
        },
        {
          namespace: "structures",
          operation: "get",
          locator: { ref: structureRef },
        },
      ]);
    } finally {
      await pool.close();
    }
  });

  it("uses FactionRef values for production-isolate ownership reads", async () => {
    const state = localSpatialState();
    const references = new ControllerReferenceSession(
      "controller-public-spatial-ownership-ref-red",
      state,
    );
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: artifact(`
          export function decide(context) {
            const factions = context.factions.find();
            const self = factions.find((candidate) => candidate.relation === "SELF");
            const enemy = factions.find((candidate) => candidate.relation === "ENEMY");
            const valid =
              self !== undefined &&
              enemy !== undefined &&
              self.ref !== "alpha" &&
              enemy.ref !== "beta" &&
              context.cells.owner(1) === self.ref &&
              context.cells.owner(2) === enemy.ref;
            if (valid) context.capitulate();
            return {};
          }
        `),
        beta: artifact("export function decide() { return {}; }"),
      });

      const evaluated = await Promise.resolve(
        evaluateControllerRound(
          state,
          host,
          6,
          new Map(),
          new Map(),
          new Map(),
          new Set(),
          references,
        ),
      );

      expect(evaluated.actions).toEqual([
        { type: "CAPITULATE_FACTION", factionId: "alpha" },
      ]);
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
    const alphaRef = "ofr1:controller-worker-cache:f:000000000001";
    const betaRef = "ofr1:controller-worker-cache:f:000000000002";
    const publicFactions = Object.freeze({
      requesterFactionId: "alpha",
      entries: Object.freeze([
        Object.freeze({
          authoritativeId: "alpha",
          ref: alphaRef,
          displayName: "Alpha Republic",
          status: "ACTIVE" as const,
          relation: "SELF" as const,
          isMinorFaction: false,
          score: 1000,
        }),
        Object.freeze({
          authoritativeId: "beta",
          ref: betaRef,
          displayName: "Beta Republic",
          status: "ACTIVE" as const,
          relation: "ENEMY" as const,
          isMinorFaction: false,
          score: 1000,
        }),
      ]),
    });
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
      publicFactions,
      usage: () => Object.freeze({ queries: 0, materializedCells: 0 }),
    }) as unknown as ControllerQuerySession;

    const request = workerRequest(`
      export function decide(context) {
        return {
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
          log: `4800000:PLAINS:${alphaRef}:${alphaRef}:${alphaRef}`,
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
        publicFactions,
        usage: () => Object.freeze({ queries: 0, materializedCells: 0 }),
      }) as unknown as ControllerQuerySession;
      const replaced = await pool.invoke(request, replacementSession);
      expect(replaced).toEqual({
        ok: true,
        output: {
          log: `4800000:PLAINS:${betaRef}:${betaRef}:${betaRef}`,
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