import path from "node:path";
import * as ts from "typescript";

import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { ControllerProcessWorkerPool } from "../src/server/controller-runtime/ControllerProcessWorkerPool";
import {
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
} from "../src/simulation/ControllerRuntime";
import {
  createInitialMatchState,
  createProspectiveMatchState,
} from "../src/simulation/MatchState";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { tryStartTankProduction } from "../src/simulation/Tanks";
import { tryStartWarshipProduction } from "../src/simulation/Warships";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

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
    owner: "#208",
    inProcess: (context) => context.transports.embark(0, 1, 1),
    workerExpression: "context.transports.embark(0, 1, 1)",
    proofs: ACTION_PROOFS,
  },
  {
    name: "transports.recall",
    owner: "#208",
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
    owner: "#208",
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
              destinationCellId: destination,
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
