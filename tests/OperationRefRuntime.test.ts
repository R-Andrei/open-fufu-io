import path from "node:path";
import * as ts from "typescript";

import type { OperationRef } from "../src/core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";
import {
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
} from "../src/server/controller-runtime/ProductionControllerHost";
import { createControllerQuerySession } from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  CONTROLLER_QUERY_LIMITS,
  InProcessTestControllerHost,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import type { MatchState } from "../src/simulation/MatchState";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { TickEngine } from "../src/simulation/TickEngine";

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function pressureScenario() {
  const match = new MatchRuntime(
    createMicroSimulationSpec({
      seed: "operation-ref-runtime",
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta", "gamma"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
        { id: "gamma", rules: emptyRules() },
      ],
    }),
    { controllerReferenceNamespace: "operation-ref-runtime" },
  );
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "alpha",
    amount: 2,
  });
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "beta",
    amount: 20,
  });
  match.acceptAction({
    type: "GRANT_POPULATION",
    factionId: "gamma",
    amount: 20,
  });
  match.tick();

  const receipts = match.runControllerRound(
    new InProcessTestControllerHost({
      alpha() {
        return {
          directives: {
            set: [
              {
                kind: "LAND_OPERATION",
                key: "pressure-a",
                operation: "ATTACK",
                population: 1,
                targetFactionId: "beta",
                source: { kind: "CELLS", ids: [0] },
                target: { kind: "CELLS", ids: [1] },
              },
              {
                kind: "LAND_OPERATION",
                key: "pressure-b",
                operation: "ATTACK",
                population: 1,
                targetFactionId: "beta",
                source: { kind: "CELLS", ids: [0] },
                target: { kind: "CELLS", ids: [1] },
              },
            ],
          },
        };
      },
    }),
  );
  expect(
    receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
  ).toBe(true);

  const before = match.snapshot();
  const pendingInputs = match
    .acceptedInputs()
    .filter((input) => input.tick === before.tick + 1);
  const engine = new TickEngine();
  const materialized = engine.applyAcceptedInputs(before, pendingInputs);
  const operationIds = materialized.operations
    .map((operation) => operation.id)
    .sort();
  expect(operationIds).toHaveLength(2);
  return Object.freeze({
    match,
    before,
    pendingInputs,
    engine,
    materialized,
    operationIds,
  });
}

type OperationReadView = Readonly<Record<string, unknown>> & {
  readonly ref: OperationRef;
};

type OperationReadSurface = Readonly<{
  get(ref: OperationRef): OperationReadView | undefined;
  own(): readonly OperationReadView[];
  incoming(): readonly OperationReadView[];
}>;

function operationsOf(
  session: ReturnType<typeof createControllerQuerySession>,
): OperationReadSurface {
  return (session as unknown as { readonly operations: OperationReadSurface })
    .operations;
}

async function waitForWorkerReplacement(
  pool: ControllerProcessWorkerPool,
  priorPid: number,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (pool.workerProcessIds()[0] !== priorPid) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for controller worker replacement");
}

function formatTsDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}

function controllerApiCompilerOptions(): ts.CompilerOptions {
  const configPath = path.resolve("tsconfig.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error !== undefined) {
    throw new Error(formatTsDiagnostics([configFile.error]));
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd(),
    { noEmit: true },
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(formatTsDiagnostics(parsed.errors));
  }
  return parsed.options;
}

function typecheckIssue178Fixture(source: string): string {
  const options = controllerApiCompilerOptions();
  const virtualPath = path.resolve(
    "tests/contracts/issue178-umbrella.virtual.ts",
  );
  const baseHost = ts.createCompilerHost(options);
  const isVirtual = (fileName: string) =>
    path.resolve(fileName) === virtualPath;
  const host: ts.CompilerHost = {
    ...baseHost,
    fileExists(fileName) {
      return isVirtual(fileName) || baseHost.fileExists(fileName);
    },
    readFile(fileName) {
      return isVirtual(fileName) ? source : baseHost.readFile(fileName);
    },
    getSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    ) {
      if (isVirtual(fileName)) {
        return ts.createSourceFile(fileName, source, languageVersion, true);
      }
      return baseHost.getSourceFile(
        fileName,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      );
    },
  };
  const program = ts.createProgram({ rootNames: [virtualPath], options, host });
  return formatTsDiagnostics(ts.getPreEmitDiagnostics(program));
}

function actionFacadeRuntime(seed: string) {
  const match = new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      factions: [
        { id: "alpha", rules: emptyRules() },
        { id: "beta", rules: emptyRules() },
      ],
    }),
    { controllerReferenceNamespace: seed },
  );
  for (let tick = 0; tick < 250; tick += 1) match.tick();
  return match;
}

describe("OperationRef manifestation and lawful read vertical", () => {
  it("creates two beta-only OPERATION reveals on the first positive-pressure tick and none prospectively", () => {
    const scenario = pressureScenario();

    expect(scenario.materialized.directReveals).toEqual([]);
    expect(scenario.materialized.ownership).toEqual(["alpha", "beta", "gamma"]);

    const advanced = scenario.engine.advance(
      scenario.before,
      scenario.pendingInputs,
    );
    expect(advanced.tick).toBe(scenario.before.tick + 1);
    expect(advanced.ownership).toEqual(["alpha", "beta", "gamma"]);
    expect(
      advanced.directReveals.map((entry) => ({
        viewerFactionId: entry.viewerFactionId,
        sourceKind: entry.sourceKind,
        sourceId: entry.sourceId,
        expiryExclusiveTick: entry.expiryExclusiveTick,
      })),
    ).toEqual(
      scenario.operationIds.map((operationId) => ({
        viewerFactionId: "beta",
        sourceKind: "OPERATION",
        sourceId: operationId,
        expiryExclusiveTick: advanced.tick + 150,
      })),
    );
    expect(
      advanced.directReveals.some((entry) => entry.viewerFactionId === "gamma"),
    ).toBe(false);
  });

  it("delivers first Operation reveal once to the attacked viewer and suppresses ordinary refresh duplicates", () => {
    const scenario = pressureScenario();
    const first = scenario.match.tick();
    expect(first.directReveals).toHaveLength(2);

    let betaEvents: readonly Readonly<Record<string, unknown>>[] = [];
    let gammaEvents: readonly Readonly<Record<string, unknown>>[] = [];
    scenario.match.runControllerRound(
      new InProcessTestControllerHost({
        beta(context) {
          betaEvents = context.events.sinceLastDecision;
          return {};
        },
        gamma(context) {
          gammaEvents = context.events.sinceLastDecision;
          return {};
        },
      }),
    );

    expect(betaEvents).toHaveLength(2);
    for (const event of betaEvents) {
      expect(event).toMatchObject({
        type: "HOSTILE_SOURCE_REVEALED",
        source: { type: "OPERATION" },
      });
      const source = event.source as
        | { readonly type?: unknown; readonly token?: unknown }
        | undefined;
      expect(scenario.operationIds).not.toContain(source?.token);
    }
    expect(gammaEvents).toEqual([]);

    scenario.match.tick();
    let refreshedBetaEvents: readonly Readonly<Record<string, unknown>>[] = [];
    scenario.match.runControllerRound(
      new InProcessTestControllerHost({
        beta(context) {
          refreshedBetaEvents = context.events.sinceLastDecision;
          return {};
        },
      }),
    );
    expect(
      refreshedBetaEvents.filter(
        (event) => event.type === "HOSTILE_SOURCE_REVEALED",
      ),
    ).toEqual([]);
  });

  it("projects self and manifested foreign operations through stable viewer-scoped refs without raw OperationIds", async () => {
    const scenario = pressureScenario();
    const advanced = scenario.engine.advance(
      scenario.before,
      scenario.pendingInputs,
    );
    const references = new ControllerReferenceSession(
      "operation-ref-read",
      advanced,
    );

    const alpha = createControllerQuerySession(
      advanced,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const beta = createControllerQuerySession(
      advanced,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const gamma = createControllerQuerySession(
      advanced,
      "gamma",
      CONTROLLER_QUERY_LIMITS,
      references,
    );

    const alphaOwn = operationsOf(alpha).own();
    const betaIncoming = operationsOf(beta).incoming();
    const gammaIncoming = operationsOf(gamma).incoming();

    expect(alphaOwn).toHaveLength(2);
    expect(betaIncoming).toHaveLength(2);
    expect(gammaIncoming).toEqual([]);
    expect(alphaOwn.map((view) => view.ref.token)).toEqual(
      [...alphaOwn.map((view) => view.ref.token)].sort(),
    );
    expect(betaIncoming.map((view) => view.ref.token)).toEqual(
      [...betaIncoming.map((view) => view.ref.token)].sort(),
    );

    for (const view of [...alphaOwn, ...betaIncoming]) {
      expect(view).toHaveProperty("ref");
      expect(view).not.toHaveProperty("id");
      expect(view.ref.type).toBe("OPERATION");
      expect(scenario.operationIds).not.toContain(view.ref.token);
    }

    const betaRef = betaIncoming[0]!.ref;
    expect(operationsOf(beta).get(betaRef)).toEqual(betaIncoming[0]);
    expect(operationsOf(beta).get(alphaOwn[0]!.ref)).toBeUndefined();
    expect(
      operationsOf(beta).get({
        type: "OPERATION",
        token: "fabricated-operation-ref",
      } as OperationRef),
    ).toBeUndefined();

    const otherMatchReferences = new ControllerReferenceSession(
      "operation-ref-read-other-match",
      advanced,
    );
    const otherMatchBeta = createControllerQuerySession(
      advanced,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      otherMatchReferences,
    );
    const foreignMatchRef = operationsOf(otherMatchBeta).incoming()[0]!.ref;
    expect(operationsOf(beta).get(foreignMatchRef)).toBeUndefined();

    const refreshed = Object.freeze({
      ...advanced,
      tick: advanced.tick + 1,
      directReveals: Object.freeze(
        advanced.directReveals.map((entry) =>
          Object.freeze({
            ...entry,
            expiryExclusiveTick: entry.expiryExclusiveTick + 25,
          }),
        ),
      ),
    }) as MatchState;
    references.reconcile(refreshed);
    const refreshedBeta = createControllerQuerySession(
      refreshed,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    expect(operationsOf(refreshedBeta).incoming()[0]!.ref).toBe(betaRef);

    const expiryTick = Math.max(
      ...refreshed.directReveals.map((entry) => entry.expiryExclusiveTick),
    );
    const expired = Object.freeze({
      ...refreshed,
      tick: expiryTick,
    }) as MatchState;
    references.reconcile(expired);
    const expiredBeta = createControllerQuerySession(
      expired,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    expect(operationsOf(expiredBeta).incoming()).toEqual([]);
    expect(operationsOf(expiredBeta).get(betaRef)).toBeUndefined();

    const ended = Object.freeze({
      ...expired,
      operations: Object.freeze([]),
    }) as MatchState;
    references.reconcile(ended);
    const endedBeta = createControllerQuerySession(
      ended,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    expect(operationsOf(endedBeta).incoming()).toEqual([]);
    expect(operationsOf(endedBeta).get(betaRef)).toBeUndefined();
  });

  it("shares the existing 128 trusted-read ceiling without consuming the Unit/Structure materialization budget", async () => {
    const scenario = pressureScenario();
    const advanced = scenario.engine.advance(
      scenario.before,
      scenario.pendingInputs,
    );
    const references = new ControllerReferenceSession(
      "operation-ref-budget",
      advanced,
    );
    const session = createControllerQuerySession(
      advanced,
      "beta",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const operations = operationsOf(session);

    await session.units.count();
    for (let index = 0; index < 127; index += 1) {
      expect(operations.incoming()).toHaveLength(2);
    }
    expect(session.usage()).toMatchObject({
      queries: 128,
      materializedEntityViews: 0,
    });
    expect(() => operations.incoming()).toThrow();
  });

  it("keeps OperationRefs usable through ControllerMemory across real production worker replacement", async () => {
    const scenario = pressureScenario();
    const advanced = scenario.engine.advance(
      scenario.before,
      scenario.pendingInputs,
    );
    const references = new ControllerReferenceSession(
      "operation-ref-worker",
      advanced,
    );
    const querySession = () =>
      createControllerQuerySession(
        advanced,
        "beta",
        CONTROLLER_QUERY_LIMITS,
        references,
      );

    const artifact = Object.freeze({
      moduleSource: `
        export function decide(context) {
          if (context.memory.operationRef === undefined) {
            const refs = context.events.sinceLastDecision
              .filter((event) =>
                event.type === "HOSTILE_SOURCE_REVEALED" &&
                event.source?.type === "OPERATION"
              )
              .map((event) => event.source);
            if (refs.length !== 2) throw new Error("expected two manifested operation events");
            const views = refs.map((ref) => context.operations.get(ref));
            if (views.some((view) => view === undefined)) {
              throw new Error("event-acquired operation ref did not resolve");
            }
            if (views.some((view) => Object.prototype.hasOwnProperty.call(view, "id"))) {
              throw new Error("raw operation id crossed worker boundary");
            }
            return {
              memory: { operationRef: refs[0] },
              log: JSON.stringify({ phase: "stored", refs }),
            };
          }
          const view = context.operations.get(context.memory.operationRef);
          return {
            memory: context.memory,
            log: JSON.stringify({
              phase: "resolved",
              stored: context.memory.operationRef,
              resolved: view?.ref,
              hasId: view === undefined ? false : Object.prototype.hasOwnProperty.call(view, "id"),
            }),
          };
        }
      `,
      entrypoints: Object.freeze({ decide: "decide" }),
    }) satisfies ControllerRuntimeArtifact;

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    const host = new ProductionControllerHost(pool, { beta: artifact });
    const acquisitionSession = querySession();
    const acquisitionRefs = operationsOf(acquisitionSession)
      .incoming()
      .map((view) => view.ref);
    const observation = Object.freeze({
      tick: advanced.tick,
      decisionNumber: 1,
      events: Object.freeze({
        sinceLastDecision: Object.freeze(
          acquisitionRefs.map((source) =>
            Object.freeze({
              type: "HOSTILE_SOURCE_REVEALED" as const,
              source,
            }),
          ),
        ),
      }),
    }) as unknown as Parameters<ProductionControllerHost["invoke"]>[1];
    try {
      const first = await host.invoke("beta", observation, querySession());
      expect(first.ok).toBe(true);
      if (!first.ok)
        throw new Error("expected first OperationRef worker invocation");
      const stored = JSON.parse(first.output?.log ?? "{}");
      expect(stored.phase).toBe("stored");
      expect(stored.refs).toHaveLength(2);
      for (const ref of stored.refs as Array<{ type: string; token: string }>) {
        expect(ref.type).toBe("OPERATION");
        expect(scenario.operationIds).not.toContain(ref.token);
      }

      const priorPid = pool.workerProcessIds()[0];
      if (priorPid === undefined) throw new Error("expected worker pid");
      process.kill(priorPid, "SIGKILL");
      await waitForWorkerReplacement(pool, priorPid);

      const second = await host.invoke("beta", observation, querySession());
      expect(second.ok).toBe(true);
      if (!second.ok)
        throw new Error("expected replacement-worker OperationRef invocation");
      const resolved = JSON.parse(second.output?.log ?? "{}");
      expect(resolved).toEqual({
        phase: "resolved",
        stored: stored.refs[0],
        resolved: stored.refs[0],
        hasId: false,
      });
    } finally {
      await pool.close();
    }
  }, 20_000);
});

describe("issue #178 final public facade and ref migration RED", () => {
  it("typechecks the ref-only SDK, beginner action facade, check* surface, and hostile-source event", () => {
    const diagnostics = typecheckIssue178Fixture(`
import type {
  ActionRef,
  ControllerDecision,
  ControllerEvent,
  CounterResponseDirective,
  DirectiveKey,
  FactionReadView,
  FactionRef,
  OpenFufuController,
  OperationalContactView,
  OperationRef,
  OperationView,
  StructureRef,
  TerritorialContactView,
  UnitRef,
} from "../../src/core/controller/ControllerApi";
// @ts-expect-error authoritative faction IDs are not part of the public SDK.
import type { FactionId } from "../../src/core/controller/ControllerApi";
// @ts-expect-error authoritative operation IDs are not part of the public SDK.
import type { OperationId } from "../../src/core/controller/ControllerApi";
// @ts-expect-error authoritative unit IDs are not part of the public SDK.
import type { UnitId } from "../../src/core/controller/ControllerApi";
// @ts-expect-error authoritative structure IDs are not part of the public SDK.
import type { StructureId } from "../../src/core/controller/ControllerApi";
// @ts-expect-error routine one-shot CommandKey is not player-authored public API.
import type { CommandKey } from "../../src/core/controller/ControllerApi";

type Context = Parameters<OpenFufuController["decide"]>[0];
declare const context: Context;
declare const factionRef: FactionRef;
declare const structureRef: StructureRef;
declare const unitRef: UnitRef;
declare const operationRef: OperationRef;

const publicOwner: FactionRef | null | undefined = context.cells.owner(0);
const publicFaction: FactionReadView | undefined = context.factions.get(factionRef);
if (publicFaction !== undefined) {
  const name: string = publicFaction.displayName;
  const minor: boolean = publicFaction.isMinorFaction;
  const score: number | undefined = publicFaction.score;
  void name;
  void minor;
  void score;
}
type FactionLeaksFfy = "ffy" extends keyof FactionReadView ? true : false;
type FactionLeaksPopulation = "population" extends keyof FactionReadView ? true : false;
type FactionLeaksCapacity = "capacity" extends keyof FactionReadView ? true : false;
type FactionLeaksModifiers = "effectiveModifiers" extends keyof FactionReadView ? true : false;
const noFfy: FactionLeaksFfy = false;
const noPopulation: FactionLeaksPopulation = false;
const noCapacity: FactionLeaksCapacity = false;
const noModifiers: FactionLeaksModifiers = false;

const build: ActionRef = context.structures.build("FORT", 0);
const upgrade: ActionRef = context.structures.upgrade({ ref: structureRef });
const buildUnit: ActionRef = context.units.build("TANK", { ref: structureRef }, 4);
const moveUnit: ActionRef = context.units.move({ ref: unitRef }, 5);
const embark: ActionRef = context.transports.embark(6, 7, 25);
const recall: ActionRef = context.transports.recall({ ref: unitRef });
const launch: ActionRef = context.weapons.launch({ ref: structureRef }, "ATOM_BOMB", 8, factionRef);
const relinquish: ActionRef = context.territory.relinquish({ kind: "CELLS", ids: [9] });
const signal: ActionRef = context.team.signal("intent", { target: 9 });
const capitulate: ActionRef = context.capitulate();

Promise.resolve(context.structures.checkBuild("FORT", 0));
Promise.resolve(context.structures.checkUpgrade({ ref: structureRef }));
Promise.resolve(context.units.checkBuild("TANK", { ref: structureRef }, 4));
Promise.resolve(context.weapons.checkLaunch({ ref: structureRef }, "ATOM_BOMB", 8, factionRef));
Promise.resolve(context.transports.checkEmbark(6, 7, 25));
Promise.resolve(context.territory.checkRelinquish({ kind: "CELLS", ids: [9] }));

const counter: CounterResponseDirective = {
  kind: "COUNTER_RESPONSE",
  key: "counter" as DirectiveKey,
  incomingOperation: operationRef,
  population: 10,
};
void counter;

declare const operation: OperationView;
const operationPublicRef: OperationRef = operation.ref;
const operationOwner: FactionRef = operation.ownerId;
const ownDirectiveKey: DirectiveKey | undefined = operation.directiveKey;
type OperationHasId = "id" extends keyof OperationView ? true : false;
type OperationHasControllerKey = "controllerKey" extends keyof OperationView ? true : false;
const noOperationIdField: OperationHasId = false;
const noControllerKey: OperationHasControllerKey = false;

type TerritorialHasId = "id" extends keyof TerritorialContactView ? true : false;
type OperationalHasId = "id" extends keyof OperationalContactView ? true : false;
const noTerritorialId: TerritorialHasId = false;
const noOperationalId: OperationalHasId = false;

type HasRawCommands = "commands" extends keyof ControllerDecision ? true : false;
const noRawCommands: HasRawCommands = false;
type HostileReveal = Extract<ControllerEvent, { type: "HOSTILE_SOURCE_REVEALED" }>;
const hostileRevealType: HostileReveal["type"] = "HOSTILE_SOURCE_REVEALED";

void publicOwner;
void build;
void upgrade;
void buildUnit;
void moveUnit;
void embark;
void recall;
void launch;
void relinquish;
void signal;
void capitulate;
void operationPublicRef;
void operationOwner;
void ownDirectiveKey;
void noFfy;
void noPopulation;
void noCapacity;
void noModifiers;
void noOperationIdField;
void noControllerKey;
void noTerritorialId;
void noOperationalId;
void noRawCommands;
void hostileRevealType;
`);

    expect(diagnostics).toBe("");
  });

  it("stages one-shot actions through protected facade methods and rejects legacy raw command arrays", () => {
    const match = actionFacadeRuntime("issue178-action-facade-red");
    let actionRef: unknown;
    const facadeReceipts = match.runControllerRound(
      new InProcessTestControllerHost({
        alpha(observation) {
          const structures = (
            observation as unknown as {
              readonly structures: {
                build(type: "FORT", cellId: number): unknown;
              };
            }
          ).structures;
          actionRef = structures.build("FORT", 0);
          return {};
        },
      }),
    );
    expect(facadeReceipts).not.toBeInstanceOf(Promise);
    const facadeReceipt = (
      facadeReceipts as readonly {
        factionId: string;
        receipt: { accepted: boolean };
      }[]
    ).find((entry) => entry.factionId === "alpha")?.receipt;
    expect(typeof actionRef).toBe("string");
    expect(facadeReceipt?.accepted).toBe(true);
    expect(
      match
        .acceptedInputs()
        .some((input) => input.action.type === "PURCHASE_STRUCTURE_BUILD"),
    ).toBe(true);

    const legacy = actionFacadeRuntime("issue178-command-array-rejected-red");
    const before = legacy.stateFingerprint();
    const legacyReceipts = legacy.runControllerRound(
      new InProcessTestControllerHost({
        alpha() {
          return {
            commands: [
              {
                kind: "BUILD_STRUCTURE" as const,
                key: "legacy-command",
                structure: "FORT" as const,
                cellId: 0,
              },
            ],
          } as unknown as never;
        },
      }),
    );
    expect(legacyReceipts).not.toBeInstanceOf(Promise);
    const legacyReceipt = (
      legacyReceipts as readonly {
        factionId: string;
        receipt: { accepted: boolean };
      }[]
    ).find((entry) => entry.factionId === "alpha")?.receipt;
    expect(legacyReceipt?.accepted).toBe(false);
    expect(legacy.stateFingerprint()).toBe(before);
    expect(legacy.acceptedInputs()).toEqual([]);
  });

  it("charges every check* call to the same 128 trusted-read ceiling", () => {
    const match = actionFacadeRuntime("issue178-check-budget-red");
    const state = match.snapshot();
    const references = new ControllerReferenceSession(
      "issue178-check-budget",
      state,
    );
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      references,
    );
    const structures = (
      session as unknown as {
        readonly structures: {
          checkBuild(type: "FORT", cellId: number): unknown;
        };
      }
    ).structures;

    for (let index = 0; index < 128; index += 1) {
      expect(() => structures.checkBuild("FORT", 0)).not.toThrow();
    }
    expect(session.usage().queries).toBe(128);
    expect(() => structures.checkBuild("FORT", 0)).toThrow();
  });
});
