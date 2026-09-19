import path from "node:path";
import * as ts from "typescript";

import { originRuleProfileInput } from "../src/core/rules/OriginRuleManifest";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";
import {
  PRODUCTION_CONTROLLER_LIMITS,
  ProductionControllerHost,
  type ControllerRuntimeArtifact,
} from "../src/server/controller-runtime/ProductionControllerHost";
import {
  createControllerQuerySession,
  type ControllerQuerySession,
} from "../src/simulation/ControllerQueryProjection";
import { ControllerReferenceSession } from "../src/simulation/ControllerReferenceSession";
import {
  CONTROLLER_QUERY_LIMITS,
  InProcessTestControllerHost,
  evaluateControllerRound,
} from "../src/simulation/ControllerRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMobileUnit } from "../src/simulation/MobileUnits";
import { tryStartTankProduction } from "../src/simulation/Tanks";
import { TickEngine } from "../src/simulation/TickEngine";
import { tryStartWarshipProduction } from "../src/simulation/Warships";
import { createPopulationState } from "../src/simulation/Population";
import { matchStateAtWar } from "../src/simulation/HostilityState";
import { resolveTransportEndpointRouteForState } from "../src/simulation/Transports";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";
import { strategicBlastHash32 } from "../src/simulation/StrategicWeapons";

const ACTION_PROOFS = Object.freeze([
  "SDK",
  "IN_PROCESS",
  "PRODUCTION_ISOLATE",
  "TRUSTED_STAGING",
  "AUTHORITATIVE_ACCEPTANCE",
  "STATE_TRANSITION",
  "ATOMIC_REJECTION",
  "LOCATOR_VISIBILITY",
  "RUNTIME_PARITY",
] as const);

const CHECK_PROOFS = Object.freeze([
  "SDK",
  "IN_PROCESS",
  "PRODUCTION_ISOLATE",
  "AUTHORITATIVE_RESULT",
  "TRUSTED_READ_BUDGET",
  "MATERIALIZATION_BUDGET",
  "LOCATOR_VISIBILITY",
  "RUNTIME_PARITY",
] as const);

type RuntimeContext = Record<string, any>;

type ActionRow = Readonly<{
  name: string;
  owner: "#206" | "#208";
  inProcess(context: RuntimeContext): unknown;
  workerExpression: string;
  proofs: typeof ACTION_PROOFS;
}>;

type CheckRow = Readonly<{
  name: string;
  owner: "#206" | "#208";
  inProcess(context: RuntimeContext): unknown;
  workerExpression: string;
  proofs: typeof CHECK_PROOFS;
}>;

const ACTION_ROWS: readonly ActionRow[] = Object.freeze([
  {
    name: "structures.build",
    owner: "#206",
    inProcess: (context) => context.structures.build("FORT", 0),
    workerExpression: 'context.structures.build("FORT", 0)',
    proofs: ACTION_PROOFS,
  },
  {
    name: "structures.upgrade",
    owner: "#206",
    inProcess: (context) => context.structures.upgrade({ cellId: 0 }),
    workerExpression: "context.structures.upgrade({ cellId: 0 })",
    proofs: ACTION_PROOFS,
  },
  {
    name: "units.build",
    owner: "#206",
    inProcess: (context) => context.units.build("TANK", { cellId: 0 }, 1),
    workerExpression: 'context.units.build("TANK", { cellId: 0 }, 1)',
    proofs: ACTION_PROOFS,
  },
  {
    name: "units.move",
    owner: "#206",
    inProcess: (context) => context.units.move({ cellId: 0 }, 1),
    workerExpression: "context.units.move({ cellId: 0 }, 1)",
    proofs: ACTION_PROOFS,
  },
  {
    name: "transports.embark",
    owner: "#206",
    inProcess: (context) => context.transports.embark(0, 1, 1),
    workerExpression: "context.transports.embark(0, 1, 1)",
    proofs: ACTION_PROOFS,
  },
  {
    name: "transports.recall",
    owner: "#206",
    inProcess: (context) => context.transports.recall({ cellId: 0 }),
    workerExpression: "context.transports.recall({ cellId: 0 })",
    proofs: ACTION_PROOFS,
  },
  {
    name: "weapons.launch",
    owner: "#206",
    inProcess: (context) =>
      context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", 1),
    workerExpression:
      'context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", 1)',
    proofs: ACTION_PROOFS,
  },
  {
    name: "territory.relinquish",
    owner: "#206",
    inProcess: (context) =>
      context.territory.relinquish({ kind: "CELLS", ids: [0] }),
    workerExpression:
      'context.territory.relinquish({ kind: "CELLS", ids: [0] })',
    proofs: ACTION_PROOFS,
  },
  {
    name: "team.signal",
    owner: "#206",
    inProcess: (context) => context.team.signal("intent", { target: 1 }),
    workerExpression: 'context.team.signal("intent", { target: 1 })',
    proofs: ACTION_PROOFS,
  },
  {
    name: "capitulate",
    owner: "#206",
    inProcess: (context) => context.capitulate(),
    workerExpression: "context.capitulate()",
    proofs: ACTION_PROOFS,
  },
]);

const CHECK_ROWS: readonly CheckRow[] = Object.freeze([
  {
    name: "structures.checkBuild",
    owner: "#206",
    inProcess: (context) => context.structures.checkBuild("FORT", 0),
    workerExpression: 'context.structures.checkBuild("FORT", 0)',
    proofs: CHECK_PROOFS,
  },
  {
    name: "structures.checkUpgrade",
    owner: "#206",
    inProcess: (context) => context.structures.checkUpgrade({ cellId: 0 }),
    workerExpression: "context.structures.checkUpgrade({ cellId: 0 })",
    proofs: CHECK_PROOFS,
  },
  {
    name: "units.checkBuild",
    owner: "#206",
    inProcess: (context) =>
      context.units.checkBuild("TANK", { cellId: 0 }, 1),
    workerExpression:
      'context.units.checkBuild("TANK", { cellId: 0 }, 1)',
    proofs: CHECK_PROOFS,
  },
  {
    name: "transports.checkEmbark",
    owner: "#206",
    inProcess: (context) => context.transports.checkEmbark(0, 1, 1),
    workerExpression: "context.transports.checkEmbark(0, 1, 1)",
    proofs: CHECK_PROOFS,
  },
  {
    name: "weapons.checkLaunch",
    owner: "#206",
    inProcess: (context) =>
      context.weapons.checkLaunch({ cellId: 0 }, "ATOM_BOMB", 1),
    workerExpression:
      'context.weapons.checkLaunch({ cellId: 0 }, "ATOM_BOMB", 1)',
    proofs: CHECK_PROOFS,
  },
  {
    name: "territory.checkRelinquish",
    owner: "#206",
    inProcess: (context) =>
      context.territory.checkRelinquish({ kind: "CELLS", ids: [0] }),
    workerExpression:
      'context.territory.checkRelinquish({ kind: "CELLS", ids: [0] })',
    proofs: CHECK_PROOFS,
  },
]);

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function facadeState(seed: string) {
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
  return match.snapshot();
}

function facadeSession(seed: string): ControllerQuerySession {
  const state = facadeState(seed);
  const references = new ControllerReferenceSession(seed, state);
  return createControllerQuerySession(
    state,
    "alpha",
    CONTROLLER_QUERY_LIMITS,
    references,
  );
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = path.resolve("tsconfig.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error !== undefined) {
    throw new Error(formatDiagnostics([configFile.error]));
  }
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd(),
    { noEmit: true },
    configPath,
  );
  if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors));
  }
  return parsed.options;
}

function typecheckFixture(source: string): string {
  const options = compilerOptions();
  const virtualPath = path.resolve(
    "tests/contracts/issue206-controller-facade.virtual.ts",
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
  return formatDiagnostics(ts.getPreEmitDiagnostics(program));
}

function workerArtifact(expression: string): ControllerRuntimeArtifact {
  return Object.freeze({
    moduleSource:
      "export function decide(context) {" +
      " const actionRef = " +
      expression +
      ";" +
      ' return { log: JSON.stringify({ type: typeof actionRef }) };' +
      " }",
    entrypoints: Object.freeze({ decide: "decide" }),
  });
}

function workerCheckArtifact(expression: string): ControllerRuntimeArtifact {
  return Object.freeze({
    moduleSource:
      "export function decide(context) {" +
      " try {" +
      " const result = " +
      expression +
      ";" +
      ' return { log: JSON.stringify({ result }) };' +
      " } catch (error) {" +
      ' return { log: JSON.stringify({ error: String(error?.message ?? error) }) };' +
      " }" +
      " }",
    entrypoints: Object.freeze({ decide: "decide" }),
  });
}

function stagedActions(result: unknown): readonly unknown[] {
  if (result === null || typeof result !== "object") return [];
  const value = (result as { readonly stagedActions?: unknown }).stagedActions;
  return Array.isArray(value) ? value : [];
}

describe("issue #206 facade proof matrix", () => {
  it("registers exactly 10 routine actions with every required proof obligation", () => {
    expect(ACTION_ROWS.map((row) => row.name)).toEqual([
      "structures.build",
      "structures.upgrade",
      "units.build",
      "units.move",
      "transports.embark",
      "transports.recall",
      "weapons.launch",
      "territory.relinquish",
      "team.signal",
      "capitulate",
    ]);
    for (const row of ACTION_ROWS) {
      expect(row.proofs, row.name).toEqual(ACTION_PROOFS);
    }
  });

  it("registers exactly 6 check* methods with every required proof obligation", () => {
    expect(CHECK_ROWS.map((row) => row.name)).toEqual([
      "structures.checkBuild",
      "structures.checkUpgrade",
      "units.checkBuild",
      "transports.checkEmbark",
      "weapons.checkLaunch",
      "territory.checkRelinquish",
    ]);
    for (const row of CHECK_ROWS) {
      expect(row.proofs, row.name).toEqual(CHECK_PROOFS);
    }
  });

  it("keeps the public SDK facade-only and removes exported raw routine command types", () => {
    const fixture = [
      'import type {',
      '  ActionRef,',
      '  ControllerDecision,',
      '  OpenFufuController,',
      '  StructureBuildQuote,',
      '  StructureUpgradeQuote,',
      '  UnitBuildQuote,',
      '  TransportEmbarkQuote,',
      '  WeaponLaunchQuote,',
      '  RelinquishQuote,',
      '} from "../../src/core/controller/ControllerApi";',
      '// @ts-expect-error raw routine command records are trusted implementation machinery only.',
      'import type { ControllerCommand } from "../../src/core/controller/ControllerApi";',
      'type Context = Parameters<OpenFufuController["decide"]>[0];',
      'declare const context: Context;',
      'const build: ActionRef = context.structures.build("FORT", 0);',
      'const upgrade: ActionRef = context.structures.upgrade({ cellId: 0 });',
      'const buildUnit: ActionRef = context.units.build("TANK", { cellId: 0 }, 1);',
      'const moveUnit: ActionRef = context.units.move({ cellId: 0 }, 1);',
      'const embark: ActionRef = context.transports.embark(0, 1, 1);',
      'const recall: ActionRef = context.transports.recall({ cellId: 0 });',
      'const launch: ActionRef = context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", 1);',
      'const relinquish: ActionRef = context.territory.relinquish({ kind: "CELLS", ids: [0] });',
      'const signal: ActionRef = context.team.signal("intent", { target: 1 });',
      'const capitulate: ActionRef = context.capitulate();',
      'const checkBuild: StructureBuildQuote = context.structures.checkBuild("FORT", 0);',
      'const checkUpgrade: StructureUpgradeQuote = context.structures.checkUpgrade({ cellId: 0 });',
      'const checkUnit: UnitBuildQuote = context.units.checkBuild("TANK", { cellId: 0 }, 1);',
      'const checkTransport: TransportEmbarkQuote = context.transports.checkEmbark(0, 1, 1);',
      'const checkWeapon: WeaponLaunchQuote = context.weapons.checkLaunch({ cellId: 0 }, "ATOM_BOMB", 1);',
      'const checkRelinquish: RelinquishQuote = context.territory.checkRelinquish({ kind: "CELLS", ids: [0] });',
      'type HasCommands = "commands" extends keyof ControllerDecision ? true : false;',
      'const hasCommands: HasCommands = false;',
      'void build; void upgrade; void buildUnit; void moveUnit; void embark;',
      'void recall; void launch; void relinquish; void signal; void capitulate;',
      'void checkBuild; void checkUpgrade; void checkUnit; void checkTransport;',
      'void checkWeapon; void checkRelinquish; void hasCommands;',
    ].join("\n");
    expect(typecheckFixture(fixture)).toBe("");
  });
});

describe("issue #206 trusted action staging parity RED", () => {
  it("stages every action out-of-band in the in-process host", async () => {
    for (const row of ACTION_ROWS) {
      let publicActionRef: unknown;
      const session = facadeSession("issue206-in-process-" + row.name);
      const host = new InProcessTestControllerHost({
        alpha(context) {
          publicActionRef = row.inProcess(context as unknown as RuntimeContext);
          return {};
        },
      });

      const result = await Promise.resolve(
        host.invoke("alpha", Object.freeze({}) as never, session),
      );

      expect.soft(result.ok, row.name + " invocation").toBe(true);
      expect.soft(typeof publicActionRef, row.name + " ActionRef").toBe("string");
      expect.soft(stagedActions(result), row.name + " staged actions").toHaveLength(1);
      if (result.ok && result.output !== undefined) {
        expect.soft(
          Object.prototype.hasOwnProperty.call(result.output, "commands"),
          row.name + " output must not contain commands",
        ).toBe(false);
      }
    }
  });

  it("stages every action out-of-band in the production isolate", async () => {
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      for (const row of ACTION_ROWS) {
        const session = facadeSession("issue206-worker-" + row.name);
        const host = new ProductionControllerHost(pool, {
          alpha: workerArtifact(row.workerExpression),
        });
        const result = await host.invoke(
          "alpha",
          Object.freeze({}) as never,
          session,
        );

        expect.soft(result.ok, row.name + " invocation").toBe(true);
        if (result.ok) {
          const log = JSON.parse(result.output?.log ?? "{}");
          expect.soft(log.type, row.name + " ActionRef").toBe("string");
          expect.soft(
            stagedActions(result),
            row.name + " staged actions",
          ).toHaveLength(1);
          if (result.output !== undefined) {
            expect.soft(
              Object.prototype.hasOwnProperty.call(result.output, "commands"),
              row.name + " output must not contain commands",
            ).toBe(false);
          }
        }
      }
    } finally {
      await pool.close();
    }
  }, 30_000);

  it("rejects injected legacy raw command arrays in both execution paths", async () => {
    const inProcess = new InProcessTestControllerHost({
      alpha() {
        return {
          commands: [
            {
              kind: "CAPITULATE",
              key: "legacy",
            },
          ],
        } as unknown as never;
      },
    });
    const inProcessResult = await Promise.resolve(
      inProcess.invoke(
        "alpha",
        Object.freeze({}) as never,
        facadeSession("issue206-legacy-in-process"),
      ),
    );
    expect(inProcessResult.ok).toBe(false);

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const artifact: ControllerRuntimeArtifact = Object.freeze({
        moduleSource:
          'export function decide() { return { commands: [{ kind: "CAPITULATE", key: "legacy" }] }; }',
        entrypoints: Object.freeze({ decide: "decide" }),
      });
      const production = new ProductionControllerHost(pool, { alpha: artifact });
      const productionResult = await production.invoke(
        "alpha",
        Object.freeze({}) as never,
        facadeSession("issue206-legacy-worker"),
      );
      expect(productionResult.ok).toBe(false);
    } finally {
      await pool.close();
    }
  }, 20_000);
});

describe("issue #206 units.checkBuild authoritative RED", () => {
  function producerFixture(seed: string, unit: "TANK" | "WARSHIP") {
    const rules = emptyRules();
    const isWarship = unit === "WARSHIP";
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed,
        width: 3,
        height: 1,
        terrain: isWarship
          ? ["DEEP_WATER", "PLAINS", "DEEP_WATER"]
          : ["PLAINS", "PLAINS", "PLAINS"],
        initialOwners: isWarship
          ? [null, "alpha", null]
          : ["alpha", "alpha", "alpha"],
        factions: [
          { id: "alpha", rules },
          { id: "beta", rules },
        ],
      }),
    );
    const producerId = isWarship ? "port-alpha" : "factory-alpha";
    const state = createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 1_000_000 } : faction,
      ),
      structures: [
        {
          id: producerId,
          ownerId: "alpha",
          type: isWarship ? "PORT" : "FACTORY",
          cellId: 1,
          outputCellId: 0,
          completedLevel: 1,
          active: true,
          acquisitionPath: "GRANT",
        },
      ],
    });
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession(seed, state),
    );
    return { state, session, producerId };
  }

  it.each(["TANK", "WARSHIP"] as const)(
    "matches canonical %s admission and charges one read without entity materialization",
    (requestedUnit) => {
      const { state, session, producerId } = producerFixture(
        "issue206-unit-check-" + requestedUnit,
        requestedUnit,
      );
      const destination = 2;
      const canonical =
        requestedUnit === "TANK"
          ? tryStartTankProduction(state, {
              ownerId: "alpha",
              factoryId: producerId,
              strategicDestinationCellId: destination,
            })
          : tryStartWarshipProduction(state, {
              ownerId: "alpha",
              portId: producerId,
            });
      expect(canonical.ok).toBe(true);
      if (!canonical.ok) throw new Error("expected canonical unit admission");

      const before = session.usage();
      const quote = (
        session.units as unknown as {
          checkBuild(
            type: "TANK" | "WARSHIP",
            producer: { cellId: number },
            destination: number,
          ): Record<string, unknown>;
        }
      ).checkBuild(requestedUnit, { cellId: 1 }, destination);

      expect(quote).toMatchObject({
        legal: true,
        cost: {
          ffyRequired: canonical.cost,
          ffySpent: canonical.cost,
          populationSpent: 0,
        },
        requestedUnit,
        resultingUnit:
          requestedUnit === "TANK" ? canonical.job.chassisType : "WARSHIP",
        buildTicks:
          requestedUnit === "TANK"
            ? canonical.job.remainingTicks
            : canonical.job.remainingTicks,
      });
      expect(typeof quote.producerId).toBe("string");
      const after = session.usage();
      expect(after.queries - before.queries).toBe(1);
      expect(
        after.materializedEntityViews - before.materializedEntityViews,
      ).toBe(0);
    },
  );

  it("does not fabricate producer identity or timing when the producer is unavailable", () => {
    const { session } = producerFixture(
      "issue206-unit-check-unavailable",
      "TANK",
    );
    const before = session.usage();
    const quote = (
      session.units as unknown as {
        checkBuild(
          type: "TANK",
          producer: { cellId: number },
          destination: number,
        ): Record<string, unknown>;
      }
    ).checkBuild("TANK", { cellId: 2 }, 0);

    expect(quote).toMatchObject({
      legal: false,
      requestedUnit: "TANK",
      cost: {
        ffySpent: 0,
        populationSpent: 0,
      },
    });
    expect(Object.prototype.hasOwnProperty.call(quote, "producerId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(quote, "buildTicks")).toBe(false);
    const after = session.usage();
    expect(after.queries - before.queries).toBe(1);
    expect(
      after.materializedEntityViews - before.materializedEntityViews,
    ).toBe(0);
  });
});


describe("issue #206 team.signal authoritative RED", () => {
  function teamSignalSpec(seed: string) {
    return createMicroSimulationSpec({
      seed,
      width: 5,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta", "delta", "gamma", "solo"],
      factions: [
        { id: "alpha", fixedTeamId: "team-a", rules: emptyRules() },
        { id: "beta", fixedTeamId: "team-a", rules: emptyRules() },
        { id: "delta", fixedTeamId: "team-a", rules: emptyRules() },
        { id: "gamma", fixedTeamId: "team-b", rules: emptyRules() },
        { id: "solo", rules: emptyRules() },
      ],
    });
  }

  function teamSignalRuntime(seed: string) {
    return new MatchRuntime(teamSignalSpec(seed), {
      controllerReferenceNamespace: seed,
    });
  }

  function contextEvents(context: unknown): readonly Readonly<Record<string, unknown>>[] {
    const events = (
      context as {
        readonly events?: {
          readonly sinceLastDecision?: readonly Readonly<Record<string, unknown>>[];
        };
      }
    ).events?.sinceLastDecision;
    return events === undefined ? Object.freeze([]) : events;
  }

  function noOpArtifact(): ControllerRuntimeArtifact {
    return Object.freeze({
      moduleSource: "export function decide() { return {}; }",
      entrypoints: Object.freeze({ decide: "decide" }),
    });
  }

  function signalArtifact(payload: string): ControllerRuntimeArtifact {
    return Object.freeze({
      moduleSource:
        "export function decide(context) {" +
        " context.team.signal(\"intent\", " +
        JSON.stringify(payload) +
        "); return {}; }",
      entrypoints: Object.freeze({ decide: "decide" }),
    });
  }

  it("delivers accepted signals only to other active fixed teammates on their next decision, in accepted-input order, then consumes them", async () => {
    const runtime = teamSignalRuntime("issue206-team-delivery");

    runtime.acceptAction({ type: "CAPITULATE_FACTION", factionId: "delta" });
    runtime.tick();

    const beforeSignal = runtime.snapshot();
    const beforeInputs = runtime.acceptedInputs().length;
    const sendHost = new InProcessTestControllerHost({
      alpha(context) {
        context.team.signal("first", { ordinal: 1 });
        context.team.signal("second", { ordinal: 2 });
        return {};
      },
    });
    const sendReceipts = await Promise.resolve(runtime.runControllerRound(sendHost));
    expect(
      sendReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(runtime.snapshot()).toEqual(beforeSignal);
    expect(runtime.acceptedInputs()).toHaveLength(beforeInputs + 2);
    expect(runtime.acceptedInputs().slice(-2).map((entry) => entry.action)).toEqual([
      {
        type: "TEAM_SIGNAL",
        senderFactionId: "alpha",
        channel: "first",
        payload: { ordinal: 1 },
      },
      {
        type: "TEAM_SIGNAL",
        senderFactionId: "alpha",
        channel: "second",
        payload: { ordinal: 2 },
      },
    ]);

    runtime.tick();

    const seen = new Map<string, readonly Readonly<Record<string, unknown>>[]>();
    const receiveHost = new InProcessTestControllerHost(
      Object.fromEntries(
        ["alpha", "beta", "delta", "gamma", "solo"].map((factionId) => [
          factionId,
          (context: unknown) => {
            seen.set(factionId, contextEvents(context));
            return {};
          },
        ]),
      ),
    );
    await Promise.resolve(runtime.runControllerRound(receiveHost));

    const alphaRef = runtime.controllerReferenceSession().issueFaction("alpha");
    expect(seen.get("beta")).toEqual([
      {
        type: "TEAM_SIGNAL_RECEIVED",
        fromFactionId: alphaRef,
        channel: "first",
        payload: { ordinal: 1 },
      },
      {
        type: "TEAM_SIGNAL_RECEIVED",
        fromFactionId: alphaRef,
        channel: "second",
        payload: { ordinal: 2 },
      },
    ]);
    expect(seen.get("alpha")).toEqual([]);
    expect(seen.get("delta")).toEqual([]);
    expect(seen.get("gamma")).toEqual([]);
    expect(seen.get("solo")).toEqual([]);

    runtime.tick();
    let betaLater: readonly Readonly<Record<string, unknown>>[] | undefined;
    await Promise.resolve(
      runtime.runControllerRound(
        new InProcessTestControllerHost({
          beta(context) {
            betaLater = contextEvents(context);
            return {};
          },
        }),
      ),
    );
    expect(betaLater).toEqual([]);
  });

  it("treats an unteamed sender with no eligible teammate as a lawful no-op", async () => {
    const runtime = teamSignalRuntime("issue206-team-no-recipient");
    const before = runtime.snapshot();
    const beforeInputs = runtime.acceptedInputs().length;
    const receipts = await Promise.resolve(
      runtime.runControllerRound(
        new InProcessTestControllerHost({
          solo(context) {
            context.team.signal("solo", { ok: true });
            return {};
          },
        }),
      ),
    );
    expect(
      receipts.find((entry) => entry.factionId === "solo")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(runtime.snapshot()).toEqual(before);
    expect(runtime.acceptedInputs()).toHaveLength(beforeInputs + 1);
    expect(runtime.acceptedInputs().at(-1)?.action).toEqual({
      type: "TEAM_SIGNAL",
      senderFactionId: "solo",
      channel: "solo",
      payload: { ok: true },
    });

    runtime.tick();
    const seen = new Map<string, readonly Readonly<Record<string, unknown>>[]>();
    await Promise.resolve(
      runtime.runControllerRound(
        new InProcessTestControllerHost(
          Object.fromEntries(
            ["alpha", "beta", "delta", "gamma", "solo"].map((factionId) => [
              factionId,
              (context: unknown) => {
                seen.set(factionId, contextEvents(context));
                return {};
              },
            ]),
          ),
        ),
      ),
    );
    for (const events of seen.values()) expect(events).toEqual([]);
  });

  it("reconstructs pending team-signal delivery from accepted inputs during replay", async () => {
    const seed = "issue206-team-replay";
    const spec = teamSignalSpec(seed);
    const runtime = new MatchRuntime(spec, {
      controllerReferenceNamespace: seed,
    });
    await Promise.resolve(
      runtime.runControllerRound(
        new InProcessTestControllerHost({
          alpha(context) {
            context.team.signal("replay", { value: 7 });
            return {};
          },
        }),
      ),
    );
    runtime.tick();

    const replay = MatchRuntime.regenerate(
      spec,
      runtime.acceptedInputs(),
      runtime.snapshot().tick,
      { controllerReferenceNamespace: seed },
    );
    let observed: readonly Readonly<Record<string, unknown>>[] | undefined;
    await Promise.resolve(
      replay.runControllerRound(
        new InProcessTestControllerHost({
          beta(context) {
            observed = contextEvents(context);
            return {};
          },
        }),
      ),
    );
    expect(observed).toEqual([
      {
        type: "TEAM_SIGNAL_RECEIVED",
        fromFactionId: replay.controllerReferenceSession().issueFaction("alpha"),
        channel: "replay",
        payload: { value: 7 },
      },
    ]);
  });

  it("copies next-decision team events into the production isolate", async () => {
    const runtime = teamSignalRuntime("issue206-team-worker-delivery");
    await Promise.resolve(
      runtime.runControllerRound(
        new InProcessTestControllerHost({
          alpha(context) {
            context.team.signal("worker", { target: 3 });
            return {};
          },
        }),
      ),
    );
    runtime.tick();

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const betaArtifact: ControllerRuntimeArtifact = Object.freeze({
        moduleSource:
          "export function decide(context) {" +
          " const events = context.events.sinceLastDecision;" +
          " if (events.length !== 1) throw new Error('missing team signal');" +
          " const event = events[0];" +
          " if (event.type !== 'TEAM_SIGNAL_RECEIVED' ||" +
          " event.channel !== 'worker' || event.payload.target !== 3)" +
          " throw new Error('wrong team signal');" +
          " context.capitulate();" +
          " return {};" +
          " }",
        entrypoints: Object.freeze({ decide: "decide" }),
      });
      const host = new ProductionControllerHost(pool, {
        alpha: noOpArtifact(),
        beta: betaArtifact,
        delta: noOpArtifact(),
        gamma: noOpArtifact(),
        solo: noOpArtifact(),
      });
      const beforeInputs = runtime.acceptedInputs().length;
      const receipts = await Promise.resolve(runtime.runControllerRound(host));
      expect(
        receipts.find((entry) => entry.factionId === "beta")?.receipt,
      ).toMatchObject({ accepted: true });
      expect(runtime.acceptedInputs()).toHaveLength(beforeInputs + 1);
      expect(runtime.acceptedInputs().at(-1)?.action).toEqual({
        type: "CAPITULATE_FACTION",
        factionId: "beta",
      });
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("enforces the existing UTF-8 JSON payload-byte limit equally in-process and in the production isolate", async () => {
    expect(PRODUCTION_CONTROLLER_LIMITS.teamSignalPayloadBytes).toBe(1_024);
    const cases = [
      { payload: "x".repeat(1_022), legal: true },
      { payload: "x".repeat(1_023), legal: false },
      { payload: "é".repeat(511), legal: true },
      { payload: "é".repeat(512), legal: false },
    ] as const;

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      for (const [index, entry] of cases.entries()) {
        const state = facadeState("issue206-team-payload-" + index);
        const inProcessSession = createControllerQuerySession(
          state,
          "alpha",
          CONTROLLER_QUERY_LIMITS,
          new ControllerReferenceSession(
            "issue206-team-payload-in-" + index,
            state,
          ),
        );
        const inProcess = new InProcessTestControllerHost({
          alpha(context) {
            context.team.signal("intent", entry.payload);
            return {};
          },
        });
        const inProcessResult = await Promise.resolve(
          inProcess.invoke("alpha", Object.freeze({}) as never, inProcessSession),
        );
        expect(inProcessResult.ok, "in-process case " + index).toBe(entry.legal);

        const workerSession = createControllerQuerySession(
          state,
          "alpha",
          CONTROLLER_QUERY_LIMITS,
          new ControllerReferenceSession(
            "issue206-team-payload-worker-" + index,
            state,
          ),
        );
        const production = new ProductionControllerHost(pool, {
          alpha: signalArtifact(entry.payload),
        });
        const productionResult = await production.invoke(
          "alpha",
          Object.freeze({}) as never,
          workerSession,
        );
        expect(productionResult.ok, "worker case " + index).toBe(entry.legal);
      }
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("rejects non-JSON team payloads in-process just as the worker transport already does", async () => {
    const state = facadeState("issue206-team-json-shape");
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-team-json-shape", state),
    );
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.team.signal("bad", Number.NaN as never);
        return {};
      },
    });
    const result = await Promise.resolve(
      host.invoke("alpha", Object.freeze({}) as never, session),
    );
    expect(result.ok).toBe(false);
  });
});


describe("issue #206 team.signal atomic rejection proof", () => {
  function atomicSignalRuntime(seed: string) {
    return new MatchRuntime(
      createMicroSimulationSpec({
        seed,
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        factions: [
          { id: "alpha", fixedTeamId: "red", rules: emptyRules() },
          { id: "beta", fixedTeamId: "red", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: seed },
    );
  }

  it("rejects a valid sibling plus over-limit signal atomically in-process and in the production isolate", async () => {
    const inProcess = atomicSignalRuntime("issue206-team-signal-atomic-in");
    const inBefore = inProcess.snapshot();
    const inInputs = inProcess.acceptedInputs().length;
    const inReceipts = await Promise.resolve(
      inProcess.runControllerRound(
        new InProcessTestControllerHost({
          alpha(context) {
            context.team.signal("first", { legal: true });
            context.team.signal("oversize", "a".repeat(1_023));
            return {};
          },
        }),
      ),
    );
    expect(
      inReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({
      accepted: false,
      failure: { code: "RUNTIME_ERROR" },
    });
    expect(inProcess.acceptedInputs()).toHaveLength(inInputs);
    expect(inProcess.snapshot()).toEqual(inBefore);

    const production = atomicSignalRuntime("issue206-team-signal-atomic-worker");
    const productionBefore = production.snapshot();
    const productionInputs = production.acceptedInputs().length;
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: Object.freeze({
          moduleSource:
            "export function decide(context) {" +
            " context.team.signal('first', { legal: true });" +
            " context.team.signal('oversize', 'a'.repeat(1023));" +
            " return {};" +
            " }",
          entrypoints: Object.freeze({ decide: "decide" }),
        }),
      });
      const receipts = await Promise.resolve(
        production.runControllerRound(host),
      );
      expect(
        receipts.find((entry) => entry.factionId === "alpha")?.receipt,
      ).toMatchObject({
        accepted: false,
        failure: { code: "RUNTIME_ERROR" },
      });
      expect(production.acceptedInputs()).toHaveLength(productionInputs);
      expect(production.snapshot()).toEqual(productionBefore);
    } finally {
      await pool.close();
    }
  }, 20_000);
});

describe("issue #206 Tank build and strategic-move authoritative RED", () => {
  function tankBuildState(seed: string) {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed,
        width: 5,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "DEEP_WATER"],
        initialOwners: ["alpha", "alpha", "alpha", "alpha", "alpha"],
        initialStructureGrants: [
          {
            structureId: "alpha-factory",
            ownerId: "alpha",
            type: "FACTORY",
            cellId: 1,
            level: 1,
          },
        ],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    return createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha" ? { ...faction, ffy: 250_000 } : faction,
      ),
    });
  }

  function manualTankState(seed: string) {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed,
        width: 4,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "DEEP_WATER"],
        initialOwners: ["alpha", "alpha", "alpha", "alpha"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const created = createMobileUnit(
      base.map,
      base.factions.map((faction) => faction.id),
      {
        mobileUnits: base.mobileUnits,
        nextMobileUnitOrdinal: base.nextMobileUnitOrdinal,
      },
      {
        ownerId: "alpha",
        type: "TANK",
        movementClass: "TANK",
        cellId: 0,
      },
    );
    return createProspectiveMatchState(base, {
      mobileUnits: created.mobileUnits,
      nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      tankOperationalStates: [
        {
          unitId: created.unit.id,
          health: { numerator: 1_000n, denominator: 1n },
          operatingAnchorCellId: 0,
          eligibleFromTick: 0,
          attackReadyAtTick: 1_000,
        },
      ],
    });
  }

  function tankRuntime(seed: string) {
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed,
        width: 5,
        height: 1,
        terrain: ["PLAINS", "PLAINS", "PLAINS", "PLAINS", "DEEP_WATER"],
        initialOwners: ["alpha", "alpha", "alpha", "alpha", "alpha"],
        initialStructureGrants: [
          {
            structureId: "alpha-factory",
            ownerId: "alpha",
            type: "FACTORY",
            cellId: 1,
            level: 1,
          },
        ],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: seed },
    );
    for (let tick = 0; tick < 2_250; tick += 1) runtime.tick();
    return runtime;
  }

  async function evaluateSingleAlphaAction(
    state: ReturnType<typeof tankBuildState>,
    seed: string,
    host: InProcessTestControllerHost | ProductionControllerHost,
  ) {
    const references = new ControllerReferenceSession(seed, state);
    return await Promise.resolve(
      evaluateControllerRound(
        state,
        host,
        0,
        new Map(),
        new Map(),
        new Map(),
        new Set(),
        references,
      ),
    );
  }

  it("converts Tank build to one trusted production action and the accepted-input executor commits the canonical job", async () => {
    const state = tankBuildState("issue206-tank-build-conversion");
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.units.build("TANK", { cellId: 1 }, 3);
        return {};
      },
    });
    const evaluated = await evaluateSingleAlphaAction(
      state,
      "issue206-tank-build-conversion",
      host,
    );
    expect(
      evaluated.receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    const proposed = evaluated.proposals.find(
      (entry) => entry.factionId === "alpha",
    )?.actions;
    expect(proposed).toEqual([
      {
        key: "action_1",
        action: {
          type: "START_TANK_PRODUCTION",
          ownerId: "alpha",
          factoryId: "alpha-factory",
          strategicDestinationCellId: 3,
        },
      },
    ]);

    const executed = new TickEngine().applyAcceptedInputs(state, [
      {
        tick: state.tick + 1,
        sequence: 0,
        action: {
          type: "START_TANK_PRODUCTION",
          ownerId: "alpha",
          factoryId: "alpha-factory",
          strategicDestinationCellId: 3,
        } as never,
      },
    ]);
    expect(executed.tankProductionJobs).toEqual([
      expect.objectContaining({
        factoryId: "alpha-factory",
        ownerId: "alpha",
        chassisType: "TANK",
        strategicDestinationCellId: 3,
        state: "BUILDING",
        remainingTicks: 50,
      }),
    ]);
    expect(
      executed.factions.find((faction) => faction.id === "alpha")?.ffy,
    ).toBe(0);
  });

  it("accepts Tank build end-to-end, advances work on the commit tick, and rejects same-Factory sibling overcommit atomically", async () => {
    const runtime = tankRuntime("issue206-tank-build-runtime");
    const before = runtime.snapshot();
    const beforeInputs = runtime.acceptedInputs().length;
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.units.build("TANK", { cellId: 1 }, 3);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(runtime.snapshot()).toEqual(before);
    expect(runtime.acceptedInputs()).toHaveLength(beforeInputs + 1);
    expect(runtime.acceptedInputs().at(-1)?.action).toMatchObject({
      type: "START_TANK_PRODUCTION",
      ownerId: "alpha",
      factoryId: "alpha-factory",
      strategicDestinationCellId: 3,
    });
    const after = runtime.tick();
    expect(after.tankProductionJobs).toEqual([
      expect.objectContaining({
        ownerId: "alpha",
        strategicDestinationCellId: 3,
        state: "BUILDING",
        remainingTicks: 49,
      }),
    ]);

    const rejected = tankRuntime("issue206-tank-build-atomic");
    const rejectedBefore = rejected.snapshot();
    const rejectedInputs = rejected.acceptedInputs().length;
    const siblingHost = new InProcessTestControllerHost({
      alpha(context) {
        context.units.build("TANK", { cellId: 1 }, 2);
        context.units.build("TANK", { cellId: 1 }, 3);
        return {};
      },
    });
    const rejectedReceipts = await Promise.resolve(
      rejected.runControllerRound(siblingHost),
    );
    expect(
      rejectedReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({
      accepted: false,
      failure: { code: "COMMITMENT_LIMIT", key: "action_2" },
    });
    expect(rejected.acceptedInputs()).toHaveLength(rejectedInputs);
    expect(rejected.snapshot()).toEqual(rejectedBefore);
    expect(rejected.tick().tankProductionJobs).toEqual([]);
  });

  it("commits the same Tank build through the production isolate", async () => {
    const runtime = tankRuntime("issue206-tank-build-worker");
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: workerArtifact(
          'context.units.build("TANK", { cellId: 1 }, 3)',
        ),
      });
      const receipts = await Promise.resolve(runtime.runControllerRound(host));
      expect(
        receipts.find((entry) => entry.factionId === "alpha")?.receipt,
      ).toMatchObject({ accepted: true });
      expect(runtime.acceptedInputs().at(-1)?.action).toMatchObject({
        type: "START_TANK_PRODUCTION",
        ownerId: "alpha",
        strategicDestinationCellId: 3,
      });
      expect(runtime.tick().tankProductionJobs).toEqual([
        expect.objectContaining({
          ownerId: "alpha",
          strategicDestinationCellId: 3,
          remainingTicks: 49,
        }),
      ]);
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("converts Tank move independently and the accepted-input executor retains the requested destination while rejecting intrinsically blocked terrain", async () => {
    const state = manualTankState("issue206-tank-move-conversion");
    const unit = state.mobileUnits[0]!;
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.units.move({ cellId: 0 }, 2);
        return {};
      },
    });
    const evaluated = await evaluateSingleAlphaAction(
      state,
      "issue206-tank-move-conversion",
      host,
    );
    expect(
      evaluated.receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(
      evaluated.proposals.find((entry) => entry.factionId === "alpha")?.actions,
    ).toEqual([
      {
        key: "action_1",
        action: {
          type: "SET_UNIT_STRATEGIC_DESTINATION",
          ownerId: "alpha",
          unitId: unit.id,
          destinationCellId: 2,
        },
      },
    ]);

    const executed = new TickEngine().applyAcceptedInputs(state, [
      {
        tick: state.tick + 1,
        sequence: 0,
        action: {
          type: "SET_UNIT_STRATEGIC_DESTINATION",
          ownerId: "alpha",
          unitId: unit.id,
          destinationCellId: 2,
        } as never,
      },
    ]);
    expect(
      executed.mobileUnits.find((candidate) => candidate.id === unit.id),
    ).toMatchObject({ strategicDestinationCellId: 2 });

    expect(() =>
      new TickEngine().applyAcceptedInputs(state, [
        {
          tick: state.tick + 1,
          sequence: 0,
          action: {
            type: "SET_UNIT_STRATEGIC_DESTINATION",
            ownerId: "alpha",
            unitId: unit.id,
            destinationCellId: 3,
          } as never,
        },
      ]),
    ).toThrow();
  });

  it("replaces a deployed Tank destination end-to-end and preserves production-worker parity for move staging", async () => {
    const runtime = tankRuntime("issue206-tank-move-runtime");
    const buildHost = new InProcessTestControllerHost({
      alpha(context) {
        context.units.build("TANK", { cellId: 1 }, 3);
        return {};
      },
    });
    const buildReceipts = await Promise.resolve(
      runtime.runControllerRound(buildHost),
    );
    expect(
      buildReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    runtime.tick();
    for (let tick = 0; tick < 49; tick += 1) runtime.tick();

    const deployed = runtime.snapshot().mobileUnits.find(
      (unit) => unit.ownerId === "alpha" && unit.type === "TANK",
    );
    expect(deployed).toBeDefined();
    if (deployed === undefined) throw new Error("expected deployed Tank");
    expect(deployed.strategicDestinationCellId).toBe(3);

    const beforeMoveInputs = runtime.acceptedInputs().length;
    const moveHost = new InProcessTestControllerHost({
      alpha(context) {
        context.units.move({ cellId: deployed.cellId }, 2);
        return {};
      },
    });
    const moveReceipts = await Promise.resolve(runtime.runControllerRound(moveHost));
    expect(
      moveReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(runtime.acceptedInputs()).toHaveLength(beforeMoveInputs + 1);
    expect(runtime.acceptedInputs().at(-1)?.action).toMatchObject({
      type: "SET_UNIT_STRATEGIC_DESTINATION",
      ownerId: "alpha",
      unitId: deployed.id,
      destinationCellId: 2,
    });
    const moved = runtime.tick().mobileUnits.find(
      (unit) => unit.id === deployed.id,
    );
    expect(moved?.strategicDestinationCellId).toBe(2);

    const workerState = manualTankState("issue206-tank-move-worker");
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const workerHost = new ProductionControllerHost(pool, {
        alpha: workerArtifact("context.units.move({ cellId: 0 }, 2)"),
      });
      const evaluated = await evaluateSingleAlphaAction(
        workerState,
        "issue206-tank-move-worker",
        workerHost,
      );
      expect(
        evaluated.receipts.find((entry) => entry.factionId === "alpha")?.receipt,
      ).toMatchObject({ accepted: true });
      expect(
        evaluated.proposals.find((entry) => entry.factionId === "alpha")?.actions,
      ).toEqual([
        {
          key: "action_1",
          action: {
            type: "SET_UNIT_STRATEGIC_DESTINATION",
            ownerId: "alpha",
            unitId: workerState.mobileUnits[0]!.id,
            destinationCellId: 2,
          },
        },
      ]);
    } finally {
      await pool.close();
    }
  }, 20_000);
});

describe("issue #206 Transport facade authoritative RED", () => {
  function transportRules(
    traits: Parameters<typeof originRuleProfileInput>[0] = [],
  ) {
    const origin = originRuleProfileInput(traits);
    return compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: origin.contributions,
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
  }

  function transportState(
    seed: string,
    options: {
      readonly traits?: Parameters<typeof originRuleProfileInput>[0];
      readonly ffy?: number;
      readonly population?: number;
    } = {},
  ) {
    const population = options.population ?? 1_000;
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed,
        width: 3,
        height: 2,
        terrain: [
          "PLAINS",
          "SHALLOW_WATER",
          "SHALLOW_WATER",
          "PLAINS",
          "PLAINS",
          "PLAINS",
        ],
        initialOwners: ["alpha", null, null, "alpha", "alpha", "beta"],
        factions: [
          { id: "alpha", rules: transportRules(options.traits) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    return createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha"
          ? {
              ...faction,
              ffy: options.ffy ?? 1_000_000,
              population: createPopulationState({
                total: population,
                available: population,
                committedOffensive: 0,
                committedCounterResponse: 0,
                aboardTransports: 0,
                peakTotal: population,
                neutralSettlementHalfResidual: 0,
              }),
            }
          : faction,
      ),
    });
  }

  function transportSession(
    seed: string,
    options: {
      readonly traits?: Parameters<typeof originRuleProfileInput>[0];
      readonly ffy?: number;
      readonly population?: number;
    } = {},
  ) {
    const state = transportState(seed, options);
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession(seed, state),
    );
    return { state, session };
  }

  function checkTransportEmbark(
    session: ControllerQuerySession,
    sourceCellId: number,
    targetCellId: number,
    population: number,
  ): Record<string, unknown> {
    return (
      session.transports as unknown as {
        checkEmbark(
          sourceCellId: number,
          targetCellId: number,
          population: number,
        ): Record<string, unknown>;
      }
    ).checkEmbark(sourceCellId, targetCellId, population);
  }

  function transportRuntime(
    seed: string,
    traits: Parameters<typeof originRuleProfileInput>[0] = [],
  ) {
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed,
        width: 3,
        height: 2,
        terrain: [
          "PLAINS",
          "SHALLOW_WATER",
          "SHALLOW_WATER",
          "PLAINS",
          "PLAINS",
          "PLAINS",
        ],
        initialOwners: ["alpha", null, null, "alpha", "alpha", "beta"],
        factions: [
          { id: "alpha", rules: transportRules(traits) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: seed },
    );
    runtime.acceptAction({
      type: "GRANT_POPULATION",
      factionId: "alpha",
      amount: 1_000,
    });
    runtime.tick();
    return runtime;
  }

  it("derives the lawful coast set from the authored inland political component and charges one read", () => {
    const { state, session } = transportSession("issue206-transport-component");
    const canonical = resolveTransportEndpointRouteForState(state, {
      sourceCellId: 3,
      targetCellId: 5,
      embarkCoastCellIds: [0, 4],
      landingCoastCellIds: [5],
    });
    expect(canonical).toMatchObject({
      status: "FOUND",
      route: {
        sourceCellId: 3,
        targetCellId: 5,
        embarkCellId: 1,
        landingCellId: 2,
      },
    });

    const before = session.usage();
    const quote = checkTransportEmbark(session, 3, 5, 100);
    expect(quote).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 0,
        ffySpent: 0,
        populationSpent: 0,
      },
      sourceCellId: 3,
      targetCellId: 5,
      populationCommitted: 100,
      resultingUnit: "TRANSPORT_SHIP",
    });
    const after = session.usage();
    expect(after.queries - before.queries).toBe(1);
    expect(
      after.materializedEntityViews - before.materializedEntityViews,
    ).toBe(0);
  });

  it("does not borrow a disconnected same-owner coast outside the authored source component", () => {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed: "issue206-transport-component-exclusion",
        width: 8,
        height: 1,
        terrain: [
          "PLAINS",
          "PLAINS",
          "SHALLOW_WATER",
          "IMPASSABLE",
          "PLAINS",
          "SHALLOW_WATER",
          "SHALLOW_WATER",
          "PLAINS",
        ],
        initialOwners: [
          "alpha",
          "alpha",
          null,
          null,
          "alpha",
          null,
          null,
          "beta",
        ],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    const state = createProspectiveMatchState(base, {
      factions: base.factions.map((faction) =>
        faction.id === "alpha"
          ? {
              ...faction,
              population: createPopulationState({
                total: 100,
                available: 100,
                committedOffensive: 0,
                committedCounterResponse: 0,
                aboardTransports: 0,
                peakTotal: 100,
                neutralSettlementHalfResidual: 0,
              }),
            }
          : faction,
      ),
    });
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession(
        "issue206-transport-component-exclusion",
        state,
      ),
    );

    expect(
      resolveTransportEndpointRouteForState(state, {
        sourceCellId: 0,
        targetCellId: 7,
        embarkCoastCellIds: [1],
        landingCoastCellIds: [7],
      }).status,
    ).toBe("UNREACHABLE");
    expect(
      resolveTransportEndpointRouteForState(state, {
        sourceCellId: 0,
        targetCellId: 7,
        embarkCoastCellIds: [1, 4],
        landingCoastCellIds: [7],
      }).status,
    ).toBe("FOUND");

    expect(checkTransportEmbark(session, 0, 7, 10)).toMatchObject({
      legal: false,
      cost: { ffySpent: 0, populationSpent: 0 },
    });
  });

  it("composes P37 and N15 into the authoritative embark FFY quote", () => {
    const { session } = transportSession("issue206-transport-cost", {
      traits: ["P37", "N15"],
      ffy: 1_000,
    });
    expect(checkTransportEmbark(session, 3, 5, 100)).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 750,
        ffySpent: 750,
        populationSpent: 0,
      },
      populationCommitted: 100,
    });
  });

  it("rejects unavailable Population and disconnected endpoint geometry without mutation", () => {
    const { state, session } = transportSession(
      "issue206-transport-check-rejections",
    );
    const fingerprint = JSON.stringify({
      factions: state.factions,
      units: state.mobileUnits,
    });
    expect(checkTransportEmbark(session, 3, 5, 1_001)).toMatchObject({
      legal: false,
      failureCode: "INSUFFICIENT_AVAILABLE_POPULATION",
      cost: { ffySpent: 0, populationSpent: 0 },
    });
    expect(
      JSON.stringify({ factions: state.factions, units: state.mobileUnits }),
    ).toBe(fingerprint);
  });

  it("matches a lawful embark quote through the production isolate", async () => {
    const { session } = transportSession("issue206-transport-worker");
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: workerCheckArtifact(
          "context.transports.checkEmbark(3, 5, 100)",
        ),
      });
      const result = await host.invoke(
        "alpha",
        Object.freeze({}) as never,
        session,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const log = JSON.parse(result.output?.log ?? "{}");
      expect(log.error).toBeUndefined();
      expect(log.result).toMatchObject({
        legal: true,
        cost: {
          ffyRequired: 0,
          ffySpent: 0,
          populationSpent: 0,
        },
        sourceCellId: 3,
        targetCellId: 5,
        populationCommitted: 100,
        resultingUnit: "TRANSPORT_SHIP",
      });
      expect(session.usage().queries).toBe(1);
      expect(session.usage().materializedEntityViews).toBe(0);
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("commits lawful embark atomically into Population, physical unit, route, and replay-owned operation state", async () => {
    const runtime = transportRuntime("issue206-transport-embark-commit");
    const before = runtime.snapshot();
    const beforeAccepted = runtime.acceptedInputs().length;
    const beforeAlpha = before.factions.find((faction) => faction.id === "alpha");
    expect(beforeAlpha?.population.available).toBe(1_000);
    expect(beforeAlpha?.population.aboardTransports).toBe(0);

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.transports.embark(3, 5, 100);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(runtime.acceptedInputs()).toHaveLength(beforeAccepted + 1);
    expect(runtime.acceptedInputs().at(-1)?.action).toMatchObject({
      type: "EMBARK_TRANSPORT",
      ownerId: "alpha",
      sourceCellId: 3,
      targetCellId: 5,
      population: 100,
    });
    expect(runtime.snapshot()).toEqual(before);

    const after = runtime.tick();
    const alpha = after.factions.find((faction) => faction.id === "alpha");
    expect(alpha?.population.available).toBe(900);
    expect(alpha?.population.aboardTransports).toBe(100);
    const transport = after.mobileUnits.find(
      (unit) => unit.type === "TRANSPORT_SHIP" && unit.ownerId === "alpha",
    );
    expect(transport).toMatchObject({
      cellId: 1,
      strategicDestinationCellId: 5,
      route: {
        destinationCellId: 2,
        cells: [1, 2],
      },
    });
    expect(
      (after as unknown as {
        readonly transportOperations?: readonly Readonly<Record<string, unknown>>[];
      }).transportOperations,
    ).toEqual([
      expect.objectContaining({
        unitId: transport?.id,
        sourceCellId: 3,
        targetCellId: 5,
        embarkCellId: 1,
        landingCellId: 2,
        carriedPopulation: 100,
        phase: "OUTBOUND",
      }),
    ]);
  });

  it("rejects sibling embark oversubscription atomically without committing the first sibling", async () => {
    const runtime = transportRuntime("issue206-transport-embark-atomic");
    const before = runtime.snapshot();
    const beforeAccepted = runtime.acceptedInputs().length;
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.transports.embark(3, 5, 600);
        context.transports.embark(3, 5, 600);
        return {};
      },
    });

    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted,
    ).toBe(false);
    expect(runtime.acceptedInputs()).toHaveLength(beforeAccepted);
    expect(runtime.snapshot()).toEqual(before);
    expect(runtime.tick().mobileUnits).toEqual(before.mobileUnits);
  });

  it("commits the same lawful embark through the production worker path", async () => {
    const runtime = transportRuntime("issue206-transport-worker-commit");
    const beforeAccepted = runtime.acceptedInputs().length;
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: workerArtifact("context.transports.embark(3, 5, 100)"),
      });
      const receipts = await Promise.resolve(runtime.runControllerRound(host));
      expect(
        receipts.find((entry) => entry.factionId === "alpha")?.receipt,
      ).toMatchObject({ accepted: true });
      expect(runtime.acceptedInputs()).toHaveLength(beforeAccepted + 1);
      const after = runtime.tick();
      expect(
        after.mobileUnits.some(
          (unit) =>
            unit.type === "TRANSPORT_SHIP" &&
            unit.ownerId === "alpha" &&
            unit.cellId === 1,
        ),
      ).toBe(true);
      expect(
        after.factions.find((faction) => faction.id === "alpha")?.population
          .aboardTransports,
      ).toBe(100);
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("recall fixes the approved minimum-cost return endpoint and tie-break in replay state", async () => {
    const runtime = transportRuntime("issue206-transport-recall");
    const embarkHost = new InProcessTestControllerHost({
      alpha(context) {
        context.transports.embark(3, 5, 100);
        return {};
      },
    });
    const embarkReceipts = await Promise.resolve(
      runtime.runControllerRound(embarkHost),
    );
    expect(
      embarkReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    const outbound = runtime.tick();
    const transport = outbound.mobileUnits.find(
      (unit) => unit.type === "TRANSPORT_SHIP" && unit.ownerId === "alpha",
    );
    expect(transport?.cellId).toBe(1);

    const recallHost = new InProcessTestControllerHost({
      alpha(context) {
        context.transports.recall({ cellId: 1 });
        return {};
      },
    });
    const recallReceipts = await Promise.resolve(
      runtime.runControllerRound(recallHost),
    );
    expect(
      recallReceipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });
    expect(runtime.acceptedInputs().at(-1)?.action).toMatchObject({
      type: "RETURN_TRANSPORT",
      ownerId: "alpha",
      transportId: transport?.id,
    });

    const returning = runtime.tick();
    expect(
      (returning as unknown as {
        readonly transportOperations?: readonly Readonly<Record<string, unknown>>[];
      }).transportOperations,
    ).toEqual([
      expect.objectContaining({
        unitId: transport?.id,
        carriedPopulation: 100,
        phase: "RETURNING",
        returnWaterCellId: 1,
        returnCoastCellId: 0,
      }),
    ]);
  });
});

describe("issue #206 territory relinquishment authoritative RED", () => {
  function rulesWithTraits(traits: readonly ("P35")[] = []) {
    const origin = originRuleProfileInput(traits);
    return compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: origin.contributions,
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
  }

  function territoryFixture(
    seed: string,
    options: {
      readonly p35?: boolean;
      readonly withStructure?: boolean;
    } = {},
  ) {
    const alphaRules = options.p35 ? rulesWithTraits(["P35"]) : emptyRules();
    const spec = createMicroSimulationSpec({
      seed,
      width: 3,
      height: 1,
      terrain: ["PLAINS", "PLAINS", "PLAINS"],
      initialOwners: ["alpha", "alpha", "beta"],
      factions: [
        { id: "alpha", rules: alphaRules },
        { id: "beta", rules: emptyRules() },
      ],
      ...(options.withStructure
        ? {
            initialStructureGrants: [
              {
                structureId: "fort-alpha",
                ownerId: "alpha",
                type: "FORT" as const,
                cellId: 1,
                level: 1 as const,
              },
            ],
          }
        : {}),
    });
    const state = createInitialMatchState(spec);
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession(seed, state),
    );
    return { spec, state, session };
  }

  it("quotes exact selected Capacity loss and charges one read without entity materialization", () => {
    const { session } = territoryFixture("issue206-relinquish-check");
    const before = session.usage();
    const quote = (
      session.territory as unknown as {
        checkRelinquish(cells: {
          kind: "CELLS";
          ids: readonly number[];
        }): Record<string, unknown>;
      }
    ).checkRelinquish({ kind: "CELLS", ids: [1, 0, 1] });

    expect(quote).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 0,
        ffySpent: 0,
        populationSpent: 0,
      },
      selectedCellCount: 2,
      populationBearingCellCount: 2,
      capacityDelta: -2,
      appliesFallout: false,
    });
    const after = session.usage();
    expect(after.queries - before.queries).toBe(1);
    expect(
      after.materializedEntityViews - before.materializedEntityViews,
    ).toBe(0);
  });

  it("rejects the whole selected set when one cell contains a persistent structure", () => {
    const { session } = territoryFixture(
      "issue206-relinquish-structure",
      { withStructure: true },
    );
    const quote = (
      session.territory as unknown as {
        checkRelinquish(cells: {
          kind: "CELLS";
          ids: readonly number[];
        }): Record<string, unknown>;
      }
    ).checkRelinquish({ kind: "CELLS", ids: [0, 1] });

    expect(quote).toMatchObject({
      legal: false,
      failureCode: "PERSISTENT_STRUCTURE_PRESENT",
      cost: { ffySpent: 0, populationSpent: 0 },
      selectedCellCount: 2,
    });
  });

  it("commits lawful neutralization atomically and applies P35 Fallout only after success", async () => {
    const { spec } = territoryFixture(
      "issue206-relinquish-p35",
      { p35: true },
    );
    const runtime = new MatchRuntime(spec, {
      controllerReferenceNamespace: "issue206-relinquish-p35",
    });
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.territory.relinquish({ kind: "CELLS", ids: [0, 1] });
        return {};
      },
    });

    const before = runtime.snapshot();
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt).toMatchObject({
      accepted: true,
    });
    expect(runtime.snapshot().ownership).toEqual(before.ownership);
    expect(runtime.snapshot().fallout).toEqual(before.fallout);

    const after = runtime.tick();
    expect(after.ownership).toEqual([null, null, "beta"]);
    expect(after.fallout).toEqual([true, true, false]);
    expect(after.factions.find((faction) => faction.id === "alpha")?.population)
      .toEqual(before.factions.find((faction) => faction.id === "alpha")?.population);
  });

  it("rejects a mixed valid/structured relinquishment atomically with no territorial mutation", async () => {
    const { spec } = territoryFixture(
      "issue206-relinquish-atomic",
      { withStructure: true },
    );
    const runtime = new MatchRuntime(spec, {
      controllerReferenceNamespace: "issue206-relinquish-atomic",
    });
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.territory.relinquish({ kind: "CELLS", ids: [0, 1] });
        return {};
      },
    });

    const before = runtime.snapshot();
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt).toMatchObject({
      accepted: false,
      failure: { code: "PERSISTENT_STRUCTURE_PRESENT" },
    });
    const after = runtime.tick();
    expect(after.ownership).toEqual(before.ownership);
    expect(after.fallout).toEqual(before.fallout);
    expect(after.structures).toEqual(before.structures);
  });
});

describe("issue #206 strategic weapon baseline RED", () => {
  function strategicRules(withP53 = false) {
    if (!withP53) return emptyRules();
    const origin = originRuleProfileInput(["P53"]);
    return compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: origin.contributions,
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
  }

  function strategicState(seed: string, ffy = 2_000_000) {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed,
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        initialStructureGrants: [
          {
            structureId: "silo-alpha",
            ownerId: "alpha",
            type: "MISSILE_SILO",
            cellId: 0,
            level: 1,
          },
        ],
        factions: [
          { id: "alpha", rules: strategicRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    return createProspectiveMatchState(base, {
      factions: Object.freeze(
        base.factions.map((faction) =>
          faction.id === "alpha"
            ? Object.freeze({ ...faction, ffy })
            : faction,
        ),
      ),
    });
  }

  function strategicSession(seed: string, ffy = 2_000_000) {
    const state = strategicState(seed, ffy);
    return {
      state,
      session: createControllerQuerySession(
        state,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        new ControllerReferenceSession(seed, state),
      ),
    };
  }

  function strategicRuntime(seed: string) {
    return new MatchRuntime(
      createMicroSimulationSpec({
        seed,
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        initialStructureGrants: [
          {
            structureId: "silo-alpha",
            ownerId: "alpha",
            type: "MISSILE_SILO",
            cellId: 0,
            level: 1,
          },
        ],
        factions: [
          { id: "alpha", rules: strategicRules(true) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: seed },
    );
  }

  function advanceUntilFfy(runtime: MatchRuntime, minimum: number): void {
    let guard = 0;
    while (
      (runtime.snapshot().factions.find((faction) => faction.id === "alpha")
        ?.ffy ?? 0) < minimum
    ) {
      runtime.tick();
      guard += 1;
      if (guard > 10_000) {
        throw new Error("strategic weapon fixture failed to accumulate FFY");
      }
    }
  }

  it("quotes a lawful L1 Atom launch through an opaque launcher ref with one trusted read", () => {
    const { session } = strategicSession("issue206-weapon-check");
    const before = session.usage();
    const quote = (
      session.weapons as unknown as {
        checkLaunch(
          launcher: { readonly cellId: number },
          weapon: "ATOM_BOMB",
          targetCellId: number,
        ): Record<string, unknown>;
      }
    ).checkLaunch({ cellId: 0 }, "ATOM_BOMB", 1);

    expect(quote).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 1_000_000,
        ffySpent: 1_000_000,
        populationSpent: 0,
      },
      weapon: "ATOM_BOMB",
      targetCellId: 1,
      chargeConsumed: true,
    });
    expect(typeof quote.launcherId).toBe("string");
    expect(quote.launcherId).not.toBe("silo-alpha");
    const after = session.usage();
    expect(after.queries - before.queries).toBe(1);
    expect(after.materializedEntityViews - before.materializedEntityViews).toBe(0);
  });

  it("matches the lawful strategic launch quote in the production isolate", async () => {
    const { session } = strategicSession("issue206-weapon-worker");
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const host = new ProductionControllerHost(pool, {
        alpha: workerCheckArtifact(
          'context.weapons.checkLaunch({ cellId: 0 }, "ATOM_BOMB", 1)',
        ),
      });
      const result = await host.invoke(
        "alpha",
        Object.freeze({}) as never,
        session,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const log = JSON.parse(result.output?.log ?? "{}");
      expect(log.error).toBeUndefined();
      expect(log.result).toMatchObject({
        legal: true,
        cost: {
          ffyRequired: 1_000_000,
          ffySpent: 1_000_000,
          populationSpent: 0,
        },
        weapon: "ATOM_BOMB",
        targetCellId: 1,
        chargeConsumed: true,
      });
      expect(typeof log.result.launcherId).toBe("string");
      expect(result.usage?.queries).toBeUndefined();
      expect(session.usage().queries).toBe(1);
      expect(session.usage().materializedEntityViews).toBe(0);
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("commits one lawful Atom launch as FFY + charge + identity + projectile + hostility state", async () => {
    const runtime = strategicRuntime("issue206-weapon-commit");
    advanceUntilFfy(runtime, 1_000_000);
    const before = runtime.snapshot();
    const beforeFfy =
      before.factions.find((faction) => faction.id === "alpha")?.ffy ?? 0;
    const beforeCharge = before.structures[0]?.chargeSlots?.[0];
    expect(beforeCharge).toEqual({ slotId: 0, state: "READY" });

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", 1);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt).toMatchObject({
      accepted: true,
    });

    const accepted = runtime.acceptedInputs().at(-1)?.action as
      | Readonly<Record<string, unknown>>
      | undefined;
    expect(accepted).toMatchObject({
      type: "LAUNCH_STRATEGIC_WEAPON",
      ownerId: "alpha",
      launcherId: "silo-alpha",
      weapon: "ATOM_BOMB",
      targetCellId: 1,
    });
    expect(runtime.snapshot()).toEqual(before);

    const commitTick = before.tick + 1;
    const after = runtime.tick();
    const afterAlpha =
      after.factions.find((faction) => faction.id === "alpha");
    expect(afterAlpha?.ffy).toBeLessThan(beforeFfy);
    expect(after.structures[0]?.chargeSlots?.[0]).toEqual({
      slotId: 0,
      state: "RECHARGING",
      readyAtTick: commitTick + 90,
    });
    expect(
      (after.structures[0] as unknown as { acceptedLaunchCount?: number })
        .acceptedLaunchCount,
    ).toBe(1);
    const projectiles = (
      after as unknown as {
        strategicProjectiles?: readonly Readonly<Record<string, unknown>>[];
      }
    ).strategicProjectiles;
    expect(projectiles).toHaveLength(1);
    expect(projectiles?.[0]).toMatchObject({
      ownerId: "alpha",
      launcherId: "silo-alpha",
      weapon: "ATOM_BOMB",
      targetCellId: 1,
      acceptedLaunchOrdinal: 0,
      speedCellsPerSecond: 100,
      blastProfile: {
        profileVersion: "STRATEGIC_BLAST_V1",
        innerNumerator: 144,
        outerNumerator: 900,
        profileDenominator: 1,
      },
      blastSeed: 3_808_051_912,
    });
    expect(matchStateAtWar(after, "alpha", "beta")).toBe(true);
  });

  it("rejects two sibling Atom launches from one L1 ready charge atomically", async () => {
    const runtime = strategicRuntime("issue206-weapon-charge-atomic");
    advanceUntilFfy(runtime, 2_000_000);
    const before = runtime.snapshot();

    let firstActionRef: string | undefined;
    let secondActionRef: string | undefined;
    const host = new InProcessTestControllerHost({
      alpha(context) {
        firstActionRef = context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", 1);
        secondActionRef = context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", 1);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(firstActionRef).toBeDefined();
    expect(secondActionRef).toBeDefined();
    expect(secondActionRef).not.toBe(firstActionRef);
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({
      accepted: false,
      failure: { key: secondActionRef },
    });
    expect(runtime.acceptedInputs()).toEqual([]);
    expect(runtime.snapshot()).toEqual(before);
    expect(runtime.tick().structures[0]?.chargeSlots?.[0]).toEqual({
      slotId: 0,
      state: "READY",
    });
  });

  function compiledStrategicOriginRules(
    traits: Parameters<typeof originRuleProfileInput>[0],
  ) {
    const origin = originRuleProfileInput(traits);
    return compileRuleProfile(RULE_AXIS_REGISTRY, {
      contributions: origin.contributions,
      dynamicProviders: origin.dynamicProviders,
      customDomains: origin.customDomains,
    });
  }

  function strategicStateAtLevel(
    seed: string,
    level: 1 | 2 | 3 | 4 | 5,
    traits: Parameters<typeof originRuleProfileInput>[0] = [],
    ffy = 20_000_000,
  ) {
    const base = createInitialMatchState(
      createMicroSimulationSpec({
        seed,
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        initialStructureGrants: [
          {
            structureId: "silo-alpha",
            ownerId: "alpha",
            type: "MISSILE_SILO",
            cellId: 0,
            level,
          },
        ],
        factions: [
          { id: "alpha", rules: compiledStrategicOriginRules(traits) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
    );
    return createProspectiveMatchState(base, {
      factions: Object.freeze(
        base.factions.map((faction) =>
          faction.id === "alpha"
            ? Object.freeze({ ...faction, ffy })
            : faction,
        ),
      ),
    });
  }

  function fundedStrategicRuntime(
    seed: string,
    level: 1 | 2 | 3 | 4 | 5,
    traits: Parameters<typeof originRuleProfileInput>[0] = [],
  ) {
    const fundingSiloCount = 8;
    const fundingSiloSpacing = 10;
    const firstTargetCellId = fundingSiloCount * fundingSiloSpacing + 1;
    const secondTargetCellId = firstTargetCellId + 1;
    const width = secondTargetCellId + 1;
    const uniqueTraits = Object.freeze([
      ...new Set<Parameters<typeof originRuleProfileInput>[0][number]>([
        "P53",
        ...traits,
      ]),
    ]);
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed,
        width,
        height: 1,
        terrain: Array.from({ length: width }, () => "PLAINS"),
        initialOwners: Array.from({ length: width }, (_, cellId) =>
          cellId < firstTargetCellId ? "alpha" : "beta",
        ),
        initialStructureGrants: [
          {
            structureId: "silo-alpha",
            ownerId: "alpha",
            type: "MISSILE_SILO",
            cellId: 0,
            level,
          },
          ...Array.from({ length: fundingSiloCount }, (_, index) => ({
            structureId: "funding-silo-" + index,
            ownerId: "alpha",
            type: "MISSILE_SILO" as const,
            cellId: (index + 1) * fundingSiloSpacing,
            level: 5 as const,
          })),
        ],
        factions: [
          { id: "alpha", rules: compiledStrategicOriginRules(uniqueTraits) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: seed },
    );
    return { runtime, firstTargetCellId, secondTargetCellId };
  }

  function mirvDistributionRuntime(
    seed: string,
    traits: Parameters<typeof originRuleProfileInput>[0] = [],
  ) {
    const width = 271;
    const primaryTargetCellId = 150;
    const nearestTargetCellId = 208;
    const spacingConflictCellId = 210;
    const tiedLowerCellId = 30;
    const tiedHigherCellId = 270;
    const betaTargetCells = new Set([
      primaryTargetCellId,
      nearestTargetCellId,
      spacingConflictCellId,
      tiedLowerCellId,
      tiedHigherCellId,
    ]);
    const uniqueTraits = Object.freeze([
      ...new Set<Parameters<typeof originRuleProfileInput>[0][number]>([
        "P53",
        ...traits,
      ]),
    ]);
    const runtime = new MatchRuntime(
      createMicroSimulationSpec({
        seed,
        width,
        height: 1,
        terrain: Array.from({ length: width }, () => "PLAINS"),
        initialOwners: Array.from({ length: width }, (_, cellId) =>
          betaTargetCells.has(cellId) ? "beta" : "alpha",
        ),
        initialStructureGrants: [
          {
            structureId: "silo-alpha",
            ownerId: "alpha",
            type: "MISSILE_SILO",
            cellId: 0,
            level: 5,
          },
          ...Array.from({ length: 8 }, (_, index) => ({
            structureId: "funding-silo-" + index,
            ownerId: "alpha",
            type: "MISSILE_SILO" as const,
            cellId: 40 + index * 10,
            level: 5 as const,
          })),
        ],
        factions: [
          { id: "alpha", rules: compiledStrategicOriginRules(uniqueTraits) },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: seed },
    );
    return {
      runtime,
      primaryTargetCellId,
      spacingConflictCellId,
      expectedChildTargetCellIds: Object.freeze([
        primaryTargetCellId,
        nearestTargetCellId,
        tiedLowerCellId,
        tiedHigherCellId,
      ]),
    };
  }

  it("enforces the L3 Hydrogen access boundary and preserves production-isolate check parity", async () => {
    const l2 = strategicStateAtLevel(
      "issue206-hydrogen-l2-check",
      2,
      [],
      20_000_000,
    );
    const l2Session = createControllerQuerySession(
      l2,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-hydrogen-l2-check", l2),
    );
    expect(
      l2Session.weapons.checkLaunch(
        { cellId: 0 },
        "HYDROGEN_BOMB",
        1,
      ),
    ).toMatchObject({
      legal: false,
      chargeConsumed: false,
    });

    const l3 = strategicStateAtLevel(
      "issue206-hydrogen-l3-check",
      3,
      [],
      20_000_000,
    );
    const l3Session = createControllerQuerySession(
      l3,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-hydrogen-l3-check", l3),
    );
    const before = l3Session.usage();
    expect(
      l3Session.weapons.checkLaunch(
        { cellId: 0 },
        "HYDROGEN_BOMB",
        1,
      ),
    ).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 10_000_000,
        ffySpent: 10_000_000,
        populationSpent: 0,
      },
      weapon: "HYDROGEN_BOMB",
      chargeConsumed: true,
    });
    expect(l3Session.usage().queries - before.queries).toBe(1);

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const workerState = strategicStateAtLevel(
        "issue206-hydrogen-worker",
        3,
        [],
        20_000_000,
      );
      const workerSession = createControllerQuerySession(
        workerState,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        new ControllerReferenceSession("issue206-hydrogen-worker", workerState),
      );
      const host = new ProductionControllerHost(pool, {
        alpha: workerCheckArtifact(
          'context.weapons.checkLaunch({ cellId: 0 }, "HYDROGEN_BOMB", 1)',
        ),
      });
      const result = await host.invoke(
        "alpha",
        Object.freeze({}) as never,
        workerSession,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const log = JSON.parse(result.output?.log ?? "{}");
      expect(log.error).toBeUndefined();
      expect(log.result).toMatchObject({
        legal: true,
        cost: {
          ffyRequired: 10_000_000,
          ffySpent: 10_000_000,
          populationSpent: 0,
        },
        weapon: "HYDROGEN_BOMB",
        chargeConsumed: true,
      });
      expect(workerSession.usage().queries).toBe(1);
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("commits an L3 Hydrogen launch with its launch-bound baseline motion and blast profile", async () => {
    const { runtime, firstTargetCellId } = fundedStrategicRuntime(
      "issue206-hydrogen-commit",
      3,
    );
    advanceUntilFfy(runtime, 10_000_000);

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch(
          { cellId: 0 },
          "HYDROGEN_BOMB",
          firstTargetCellId,
        );
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const after = runtime.tick();
    const projectile = after.strategicProjectiles.find(
      (entry) => entry.launcherId === "silo-alpha",
    );
    expect(projectile).toMatchObject({
      weapon: "HYDROGEN_BOMB",
      targetCellId: firstTargetCellId,
      acceptedLaunchOrdinal: 0,
      consumedChargeSlotId: 0,
      speedCellsPerSecond: 100,
      blastProfile: {
        profileVersion: "STRATEGIC_BLAST_V1",
        innerNumerator: 6_400,
        outerNumerator: 10_000,
        profileDenominator: 1,
      },
    });
  }, 20_000);

  it("canonicalizes multi-charge sibling Atom launch identity independently of source order", async () => {
    const { runtime, firstTargetCellId, secondTargetCellId } =
      fundedStrategicRuntime("issue206-weapon-canonical-order", 3);
    advanceUntilFfy(runtime, 2_000_000);

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch(
          { cellId: 0 },
          "ATOM_BOMB",
          secondTargetCellId,
        );
        context.weapons.launch(
          { cellId: 0 },
          "ATOM_BOMB",
          firstTargetCellId,
        );
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const after = runtime.tick();
    const first = after.strategicProjectiles.find(
      (entry) =>
        entry.launcherId === "silo-alpha" &&
        entry.targetCellId === firstTargetCellId,
    );
    const second = after.strategicProjectiles.find(
      (entry) =>
        entry.launcherId === "silo-alpha" &&
        entry.targetCellId === secondTargetCellId,
    );
    expect(first).toMatchObject({
      acceptedLaunchOrdinal: 0,
      consumedChargeSlotId: 0,
    });
    expect(second).toMatchObject({
      acceptedLaunchOrdinal: 1,
      consumedChargeSlotId: 1,
    });
    expect(
      after.structures.find((structure) => structure.id === "silo-alpha")
        ?.acceptedLaunchCount,
    ).toBe(2);
  }, 20_000);

  it("binds P10 warhead speed at accepted Atom launch commit", async () => {
    const { runtime, firstTargetCellId } = fundedStrategicRuntime(
      "issue206-p10-atom-speed",
      1,
      ["P10"],
    );
    advanceUntilFfy(runtime, 1_000_000);

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch({ cellId: 0 }, "ATOM_BOMB", firstTargetCellId);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const projectile = runtime
      .tick()
      .strategicProjectiles.find((entry) => entry.launcherId === "silo-alpha");
    expect(projectile).toMatchObject({
      weapon: "ATOM_BOMB",
      speedCellsPerSecond: 200,
    });
  }, 20_000);

  it("applies P25 Hydrogen-only permission, cost, and exact 3/2 blast-area binding", async () => {
    const state = strategicStateAtLevel(
      "issue206-p25-check",
      3,
      ["P25"],
      20_000_000,
    );
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-p25-check", state),
    );
    expect(
      session.weapons.checkLaunch({ cellId: 0 }, "ATOM_BOMB", 1),
    ).toMatchObject({
      legal: false,
      chargeConsumed: false,
    });
    expect(
      session.weapons.checkLaunch({ cellId: 0 }, "HYDROGEN_BOMB", 1),
    ).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 15_000_000,
        ffySpent: 15_000_000,
        populationSpent: 0,
      },
      chargeConsumed: true,
    });

    const { runtime, firstTargetCellId } = fundedStrategicRuntime(
      "issue206-p25-hydrogen-profile",
      3,
      ["P25"],
    );
    advanceUntilFfy(runtime, 15_000_000);
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch(
          { cellId: 0 },
          "HYDROGEN_BOMB",
          firstTargetCellId,
        );
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const projectile = runtime
      .tick()
      .strategicProjectiles.find((entry) => entry.launcherId === "silo-alpha");
    expect(projectile).toMatchObject({
      weapon: "HYDROGEN_BOMB",
      speedCellsPerSecond: 100,
      blastProfile: {
        profileVersion: "STRATEGIC_BLAST_V1",
        innerNumerator: 19_200,
        outerNumerator: 30_000,
        profileDenominator: 2,
      },
    });
  }, 20_000);

  it("enforces L5 MIRV access and preserves production-isolate check parity", async () => {
    const l4 = strategicStateAtLevel(
      "issue206-mirv-l4-check",
      4,
      [],
      60_000_000,
    );
    const l4Session = createControllerQuerySession(
      l4,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-mirv-l4-check", l4),
    );
    expect(
      l4Session.weapons.checkLaunch({ cellId: 0 }, "MIRV", 1),
    ).toMatchObject({
      legal: false,
      chargeConsumed: false,
    });

    const l5 = strategicStateAtLevel(
      "issue206-mirv-l5-check",
      5,
      [],
      60_000_000,
    );
    const l5Session = createControllerQuerySession(
      l5,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-mirv-l5-check", l5),
    );
    const before = l5Session.usage();
    expect(
      l5Session.weapons.checkLaunch({ cellId: 0 }, "MIRV", 1),
    ).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 50_000_000,
        ffySpent: 50_000_000,
        populationSpent: 0,
      },
      weapon: "MIRV",
      chargeConsumed: true,
    });
    expect(l5Session.usage().queries - before.queries).toBe(1);

    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      const workerState = strategicStateAtLevel(
        "issue206-mirv-worker",
        5,
        [],
        60_000_000,
      );
      const workerSession = createControllerQuerySession(
        workerState,
        "alpha",
        CONTROLLER_QUERY_LIMITS,
        new ControllerReferenceSession("issue206-mirv-worker", workerState),
      );
      const host = new ProductionControllerHost(pool, {
        alpha: workerCheckArtifact(
          'context.weapons.checkLaunch({ cellId: 0 }, "MIRV", 1)',
        ),
      });
      const result = await host.invoke(
        "alpha",
        Object.freeze({}) as never,
        workerSession,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const log = JSON.parse(result.output?.log ?? "{}");
      expect(log.error).toBeUndefined();
      expect(log.result).toMatchObject({
        legal: true,
        cost: {
          ffyRequired: 50_000_000,
          ffySpent: 50_000_000,
          populationSpent: 0,
        },
        weapon: "MIRV",
        chargeConsumed: true,
      });
      expect(workerSession.usage().queries).toBe(1);
    } finally {
      await pool.close();
    }
  }, 20_000);

  it("commits an L5 MIRV with launch-bound carrier, child payload, target snapshot, and stable child seed", async () => {
    const seed = "issue206-mirv-commit";
    const {
      runtime,
      primaryTargetCellId,
      spacingConflictCellId,
      expectedChildTargetCellIds,
    } = mirvDistributionRuntime(seed);
    advanceUntilFfy(runtime, 50_000_000);

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch({ cellId: 0 }, "MIRV", primaryTargetCellId);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const after = runtime.tick();
    const projectile = after.strategicProjectiles.find(
      (entry) => entry.launcherId === "silo-alpha",
    ) as
      | (typeof after.strategicProjectiles[number] & {
          readonly mirvPayload?: {
            readonly childSpeedCellsPerSecond: number;
            readonly distributionRadiusCells: number;
            readonly minimumCenterSpacingCells: number;
            readonly children: readonly {
              readonly targetCellId: number;
              readonly blastSeed: number;
            }[];
          };
        })
      | undefined;
    const rootSeed = strategicBlastHash32(
      "strategic-blast-root",
      seed,
      "silo-alpha",
      0,
      "MIRV",
      primaryTargetCellId,
    );
    expect(projectile).toMatchObject({
      weapon: "MIRV",
      targetCellId: primaryTargetCellId,
      targetFactionId: "beta",
      acceptedLaunchOrdinal: 0,
      consumedChargeSlotId: 0,
      speedCellsPerSecond: 150,
      blastProfile: {
        profileVersion: "STRATEGIC_BLAST_V1",
        innerNumerator: 144,
        outerNumerator: 324,
        profileDenominator: 1,
      },
      blastSeed: rootSeed,
      mirvPayload: {
        childSpeedCellsPerSecond: 220,
        distributionRadiusCells: 750,
        minimumCenterSpacingCells: 55,
        children: expectedChildTargetCellIds.map((targetCellId, childIndex) => ({
          targetCellId,
          blastSeed: strategicBlastHash32(
            "strategic-blast-child",
            seed,
            rootSeed,
            childIndex,
          ),
        })),
      },
    });
    expect(
      projectile?.mirvPayload?.children.some(
        (child) => child.targetCellId === spacingConflictCellId,
      ),
    ).toBe(false);
  }, 20_000);

  it("applies P10 only to launch-bound MIRV child warheads, not the carrier", async () => {
    const { runtime, firstTargetCellId } = fundedStrategicRuntime(
      "issue206-p10-mirv-speed",
      5,
      ["P10"],
    );
    advanceUntilFfy(runtime, 50_000_000);

    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch({ cellId: 0 }, "MIRV", firstTargetCellId);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const after = runtime.tick();
    const projectile = after.strategicProjectiles.find(
      (entry) => entry.launcherId === "silo-alpha",
    ) as
      | (typeof after.strategicProjectiles[number] & {
          readonly mirvPayload?: {
            readonly childSpeedCellsPerSecond: number;
          };
        })
      | undefined;
    expect(projectile).toMatchObject({
      weapon: "MIRV",
      speedCellsPerSecond: 150,
      mirvPayload: {
        childSpeedCellsPerSecond: 440,
      },
    });
  }, 20_000);

  it("quotes P26 MIRV with ordinary affordability and zero successful spend", () => {
    const insufficient = strategicStateAtLevel(
      "issue206-p26-insufficient",
      5,
      ["P26"],
      49_999_999,
    );
    const insufficientSession = createControllerQuerySession(
      insufficient,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-p26-insufficient", insufficient),
    );
    expect(
      insufficientSession.weapons.checkLaunch({ cellId: 0 }, "MIRV", 1),
    ).toMatchObject({
      legal: false,
      failureCode: "INSUFFICIENT_FFY",
      cost: {
        ffyRequired: 50_000_000,
        ffySpent: 0,
        populationSpent: 0,
      },
      chargeConsumed: false,
    });

    const sufficient = strategicStateAtLevel(
      "issue206-p26-sufficient",
      5,
      ["P26"],
      50_000_000,
    );
    const sufficientSession = createControllerQuerySession(
      sufficient,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-p26-sufficient", sufficient),
    );
    expect(
      sufficientSession.weapons.checkLaunch({ cellId: 0 }, "MIRV", 1),
    ).toMatchObject({
      legal: true,
      cost: {
        ffyRequired: 50_000_000,
        ffySpent: 0,
        populationSpent: 0,
      },
      chargeConsumed: true,
    });
  });

  it("consumes P26 only on a successful MIRV commit and rejects later use", async () => {
    const { runtime, firstTargetCellId } = fundedStrategicRuntime(
      "issue206-p26-commit",
      5,
      ["P26"],
    );
    advanceUntilFfy(runtime, 50_000_000);
    const beforeFfy =
      runtime.snapshot().factions.find((faction) => faction.id === "alpha")
        ?.ffy ?? 0;
    const host = new InProcessTestControllerHost({
      alpha(context) {
        context.weapons.launch({ cellId: 0 }, "MIRV", firstTargetCellId);
        return {};
      },
    });
    const receipts = await Promise.resolve(runtime.runControllerRound(host));
    expect(
      receipts.find((entry) => entry.factionId === "alpha")?.receipt,
    ).toMatchObject({ accepted: true });

    const after = runtime.tick();
    const afterAlpha = after.factions.find((faction) => faction.id === "alpha");
    expect(afterAlpha?.ffy ?? 0).toBeGreaterThanOrEqual(beforeFfy);

    const postSession = createControllerQuerySession(
      after,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-p26-post", after),
    );
    expect(
      postSession.weapons.checkLaunch(
        { cellId: 0 },
        "MIRV",
        firstTargetCellId,
      ),
    ).toMatchObject({
      legal: false,
      chargeConsumed: false,
    });
  }, 20_000);

  it("keeps P25 MIRV prohibition effective after the baseline MIRV facade exists", () => {
    const state = strategicStateAtLevel(
      "issue206-p25-mirv-prohibition",
      5,
      ["P25"],
      100_000_000,
    );
    const session = createControllerQuerySession(
      state,
      "alpha",
      CONTROLLER_QUERY_LIMITS,
      new ControllerReferenceSession("issue206-p25-mirv-prohibition", state),
    );
    expect(
      session.weapons.checkLaunch({ cellId: 0 }, "MIRV", 1),
    ).toMatchObject({
      legal: false,
      chargeConsumed: false,
    });
  });

});

describe("issue #206 check* parity and shared-budget RED", () => {
  it("exposes every check* in-process and charges exactly one trusted read", () => {
    for (const row of CHECK_ROWS) {
      const session = facadeSession("issue206-check-in-process-" + row.name);
      const before = session.usage().queries;
      let value: unknown;
      let thrown: unknown;
      try {
        value = row.inProcess(session as unknown as RuntimeContext);
      } catch (error) {
        thrown = error;
      }

      expect.soft(thrown, row.name + " should be callable").toBeUndefined();
      expect.soft(value, row.name + " result").toBeDefined();
      expect.soft(
        session.usage().queries - before,
        row.name + " trusted read charge",
      ).toBe(1);
    }
  });

  it("exposes every synchronous check* in the production isolate with one shared trusted read", async () => {
    const pool = new ControllerProcessWorkerPool({ size: 1 });
    try {
      for (const row of CHECK_ROWS) {
        const session = facadeSession("issue206-check-worker-" + row.name);
        const before = session.usage().queries;
        const host = new ProductionControllerHost(pool, {
          alpha: workerCheckArtifact(row.workerExpression),
        });
        const result = await host.invoke(
          "alpha",
          Object.freeze({}) as never,
          session,
        );

        expect.soft(result.ok, row.name + " invocation").toBe(true);
        if (result.ok) {
          const log = JSON.parse(result.output?.log ?? "{}");
          expect.soft(log.error, row.name + " bridge error").toBeUndefined();
          expect.soft(log.result, row.name + " result").toBeDefined();
        }
        expect.soft(
          session.usage().queries - before,
          row.name + " trusted read charge",
        ).toBe(1);
      }
    } finally {
      await pool.close();
    }
  }, 30_000);
});
