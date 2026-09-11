import path from "node:path";
import * as ts from "typescript";

import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import {
  InProcessTestControllerHost,
  type ControllerRoundReceipt,
} from "../src/simulation/ControllerRuntime";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

interface QuoteCost {
  readonly ffyRequired: number;
  readonly ffySpent: number;
  readonly populationSpent: number;
}

interface BuildQuote {
  readonly legal: boolean;
  readonly failureCode?: string;
  readonly cost: QuoteCost;
  readonly structure: string;
  readonly cellId: number;
  readonly resultingLevel: number;
  readonly buildTicks: number;
}

interface UpgradeQuote {
  readonly legal: boolean;
  readonly failureCode?: string;
  readonly cost: QuoteCost;
  readonly cellId: number;
  readonly currentLevel?: number;
  readonly resultingLevel?: number;
  readonly buildTicks?: number;
}

interface ConstructionMechanicsSurface {
  structureBuildQuote(structure: string, cellId: number): BuildQuote;
  structureUpgradeQuote(cellId: number): UpgradeQuote;
}

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

function structureRuntime(seed: string) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function grantedFortRuntime(seed: string, level: 1 | 2 | 3 | 4 | 5 = 1) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "fort-alpha-internal",
          ownerId: "alpha",
          type: "FORT",
          cellId: 0,
          level,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function hiddenForeignFortRuntime(seed: string) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "fort-beta-internal",
          ownerId: "beta",
          type: "FORT",
          cellId: 1,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function observedForeignFortRuntime(seed: string) {
  const rules = emptyRules();
  return new MatchRuntime(
    createMicroSimulationSpec({
      seed,
      width: 2,
      height: 1,
      terrain: ["PLAINS", "PLAINS"],
      initialOwners: ["alpha", "beta"],
      initialStructureGrants: [
        {
          structureId: "observer-alpha-internal",
          ownerId: "alpha",
          type: "OBSERVATION_POST",
          cellId: 0,
          level: 1,
        },
        {
          structureId: "fort-beta-internal",
          ownerId: "beta",
          type: "FORT",
          cellId: 1,
          level: 1,
        },
      ],
      factions: [
        { id: "alpha", rules },
        { id: "beta", rules },
      ],
    }),
  );
}

function syncReceipts(
  value:
    | readonly ControllerRoundReceipt[]
    | Promise<readonly ControllerRoundReceipt[]>,
): readonly ControllerRoundReceipt[] {
  expect(value).not.toBeInstanceOf(Promise);
  return value as readonly ControllerRoundReceipt[];
}

function alphaReceipt(receipts: readonly ControllerRoundReceipt[]) {
  const receipt = receipts.find((entry) => entry.factionId === "alpha")?.receipt;
  if (receipt === undefined) throw new Error("missing alpha receipt");
  return receipt;
}

function quoteForAlpha<T>(
  match: MatchRuntime,
  read: (mechanics: ConstructionMechanicsSurface) => T,
): T {
  let quote: T | undefined;
  const receipts = syncReceipts(
    match.runControllerRound(
      new InProcessTestControllerHost({
        alpha(observation) {
          const mechanics = (
            observation as unknown as {
              readonly mechanics: ConstructionMechanicsSurface;
            }
          ).mechanics;
          quote = read(mechanics);
          return { commands: [] };
        },
      }),
    ),
  );
  expect(alphaReceipt(receipts)).toMatchObject({
    accepted: true,
    faultCount: 0,
  });
  if (quote === undefined) throw new Error("controller quote was not captured");
  return quote;
}

function buildHost(cellId: number, key: string) {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        commands: [
          {
            kind: "BUILD_STRUCTURE" as const,
            key,
            structure: "FORT" as const,
            cellId,
          },
        ],
      };
    },
  });
}

function upgradeHost(cellId: number, key: string) {
  return new InProcessTestControllerHost({
    alpha() {
      return {
        commands: [
          {
            kind: "UPGRADE_STRUCTURE" as const,
            key,
            cellId,
          },
        ],
      };
    },
  });
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
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

function typecheckVirtualControllerApiFixture(source: string): string {
  const options = controllerApiCompilerOptions();
  const virtualPath = path.resolve(
    "tests/contracts/issue149-construction-quotes.virtual.ts",
  );
  const baseHost = ts.createCompilerHost(options);
  const isVirtual = (fileName: string) => path.resolve(fileName) === virtualPath;
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
  const program = ts.createProgram({
    rootNames: [virtualPath],
    options,
    host,
  });
  return formatDiagnostics(ts.getPreEmitDiagnostics(program));
}

describe("controller construction quotes and precise public failures", () => {
  it("types precise public structure failures and optional unavailable upgrade metadata", () => {
    const diagnostics = typecheckVirtualControllerApiFixture(`
import type {
  DecisionFailureCode,
  StructureUpgradeQuote,
} from "../../src/core/controller/ControllerApi";

const precise: readonly DecisionFailureCode[] = [
  "CELL_NOT_OWNED",
  "CELL_OCCUPIED",
  "BUILD_NOT_PERMITTED",
  "PLACEMENT_GEOMETRY_UNAVAILABLE",
  "NOT_OWNER",
  "CONSTRUCTION_IN_PROGRESS",
  "UPGRADE_NOT_PERMITTED",
];

type IsOptionalKey<T, K extends keyof T> = {} extends Pick<T, K> ? true : false;
const currentOptional: IsOptionalKey<StructureUpgradeQuote, "currentLevel"> = true;
const resultingOptional: IsOptionalKey<StructureUpgradeQuote, "resultingLevel"> = true;
const ticksOptional: IsOptionalKey<StructureUpgradeQuote, "buildTicks"> = true;
void precise;
void currentOptional;
void resultingOptional;
void ticksOptional;
`);
    expect(diagnostics).toBe("");
  });

  it("quotes an unaffordable self build exactly without spending or mutating", () => {
    const match = structureRuntime("controller-build-quote-unaffordable-red");
    const before = match.stateFingerprint();

    const quote = quoteForAlpha(match, (mechanics) =>
      mechanics.structureBuildQuote("FORT", 0),
    );

    expect(quote).toEqual({
      legal: false,
      failureCode: "INSUFFICIENT_FFY",
      cost: {
        ffyRequired: 50_000,
        ffySpent: 0,
        populationSpent: 0,
      },
      structure: "FORT",
      cellId: 0,
      resultingLevel: 1,
      buildTicks: 50,
    });
    expect(match.stateFingerprint()).toBe(before);
    expect(match.acceptedInputs()).toEqual([]);
  });

  it("quotes an affordable self build and upgrade from the immutable decision snapshot", () => {
    const buildMatch = structureRuntime("controller-build-quote-affordable-red");
    for (let tick = 0; tick < 250; tick += 1) buildMatch.tick();
    const buildQuote = quoteForAlpha(buildMatch, (mechanics) =>
      mechanics.structureBuildQuote("FORT", 0),
    );
    expect(buildQuote).toEqual({
      legal: true,
      cost: {
        ffyRequired: 50_000,
        ffySpent: 50_000,
        populationSpent: 0,
      },
      structure: "FORT",
      cellId: 0,
      resultingLevel: 1,
      buildTicks: 50,
    });

    const upgradeMatch = grantedFortRuntime(
      "controller-upgrade-quote-affordable-red",
    );
    for (let tick = 0; tick < 750; tick += 1) upgradeMatch.tick();
    const upgradeQuote = quoteForAlpha(upgradeMatch, (mechanics) =>
      mechanics.structureUpgradeQuote(0),
    );
    expect(upgradeQuote).toEqual({
      legal: true,
      cost: {
        ffyRequired: 100_000,
        ffySpent: 100_000,
        populationSpent: 0,
      },
      cellId: 0,
      currentLevel: 1,
      resultingLevel: 2,
      buildTicks: 50,
    });
  });

  it("keeps a hidden foreign structure indistinguishable from an empty target cell", () => {
    const hiddenQuote = quoteForAlpha(
      hiddenForeignFortRuntime("controller-hidden-upgrade-quote-red"),
      (mechanics) => mechanics.structureUpgradeQuote(1),
    );
    const emptyQuote = quoteForAlpha(
      structureRuntime("controller-empty-upgrade-quote-red"),
      (mechanics) => mechanics.structureUpgradeQuote(1),
    );

    expect(hiddenQuote).toEqual(emptyQuote);
    expect(hiddenQuote).toMatchObject({
      legal: false,
      cost: { ffySpent: 0, populationSpent: 0 },
      cellId: 1,
    });
    expect(hiddenQuote).not.toHaveProperty("currentLevel");
    expect(hiddenQuote).not.toHaveProperty("resultingLevel");
    expect(hiddenQuote).not.toHaveProperty("buildTicks");
  });

  it("returns precise NOT_OWNER when the foreign structure is lawfully observed", () => {
    const quote = quoteForAlpha(
      observedForeignFortRuntime("controller-visible-foreign-upgrade-quote-red"),
      (mechanics) => mechanics.structureUpgradeQuote(1),
    );

    expect(quote).toMatchObject({
      legal: false,
      failureCode: "NOT_OWNER",
      cellId: 1,
      currentLevel: 1,
      cost: { ffySpent: 0, populationSpent: 0 },
    });
  });

  it("does not invent a level beyond L5 in a MAX_LEVEL quote", () => {
    const quote = quoteForAlpha(
      grantedFortRuntime("controller-max-level-upgrade-quote-red", 5),
      (mechanics) => mechanics.structureUpgradeQuote(0),
    );

    expect(quote).toMatchObject({
      legal: false,
      failureCode: "MAX_LEVEL",
      cellId: 0,
      currentLevel: 5,
      cost: { ffySpent: 0, populationSpent: 0 },
    });
    expect(quote).not.toHaveProperty("resultingLevel");
  });

  it("preserves precise construction-state failure in both quote and admission", () => {
    const match = structureRuntime("controller-construction-in-progress-red");
    for (let tick = 0; tick < 250; tick += 1) match.tick();
    expect(
      alphaReceipt(syncReceipts(match.runControllerRound(buildHost(0, "build-fort")))),
    ).toMatchObject({ accepted: true });
    match.tick();

    const quote = quoteForAlpha(match, (mechanics) =>
      mechanics.structureUpgradeQuote(0),
    );
    expect(quote).toMatchObject({
      legal: false,
      failureCode: "CONSTRUCTION_IN_PROGRESS",
      cellId: 0,
    });

    match.tick();
    const receipt = alphaReceipt(
      syncReceipts(match.runControllerRound(upgradeHost(0, "upgrade-building"))),
    );
    expect(receipt).toMatchObject({
      accepted: false,
      failure: {
        code: "CONSTRUCTION_IN_PROGRESS",
        key: "upgrade-building",
      },
    });
  });

  it("preserves precise public build and visible-foreign upgrade failures at admission", () => {
    const buildMatch = structureRuntime("controller-cell-not-owned-red");
    for (let tick = 0; tick < 250; tick += 1) buildMatch.tick();
    const buildReceipt = alphaReceipt(
      syncReceipts(
        buildMatch.runControllerRound(buildHost(1, "build-on-foreign-cell")),
      ),
    );
    expect(buildReceipt).toMatchObject({
      accepted: false,
      failure: {
        code: "CELL_NOT_OWNED",
        key: "build-on-foreign-cell",
      },
    });

    const upgradeMatch = observedForeignFortRuntime(
      "controller-visible-not-owner-red",
    );
    const upgradeReceipt = alphaReceipt(
      syncReceipts(
        upgradeMatch.runControllerRound(upgradeHost(1, "upgrade-visible-foreign")),
      ),
    );
    expect(upgradeReceipt).toMatchObject({
      accepted: false,
      failure: {
        code: "NOT_OWNER",
        key: "upgrade-visible-foreign",
      },
    });
  });

  it("keeps hidden foreign and empty upgrade admission failures indistinguishable", () => {
    const hiddenReceipt = alphaReceipt(
      syncReceipts(
        hiddenForeignFortRuntime("controller-hidden-admission-red").runControllerRound(
          upgradeHost(1, "hidden-target"),
        ),
      ),
    );
    const emptyReceipt = alphaReceipt(
      syncReceipts(
        structureRuntime("controller-empty-admission-red").runControllerRound(
          upgradeHost(1, "empty-target"),
        ),
      ),
    );

    expect(hiddenReceipt.failure?.code).toBe(emptyReceipt.failure?.code);
    expect(hiddenReceipt.failure?.code).toBe("INVALID_TARGET");
    expect(hiddenReceipt.accepted).toBe(false);
    expect(emptyReceipt.accepted).toBe(false);
  });
});
