import path from "node:path";
import * as ts from "typescript";
import type { CellSelector } from "../src/core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../src/core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../src/core/rules/RuleCompiler";
import { InProcessTestControllerHost } from "../src/simulation/ControllerRuntime";
import {
  calculateCounterResponseTick,
  canonicalCellSelectorKey,
  isLandSideCoastTerrain,
  landTerrainBaseSpec,
  resolveLandTick,
} from "../src/simulation/LandOperations";
import { MatchRuntime } from "../src/simulation/MatchRuntime";
import { createMicroSimulationSpec } from "../src/simulation/MicroSimulationHarness";

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
  expect(configFile.error ? formatDiagnostics([configFile.error]) : "").toBe("");
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    process.cwd(),
    { noEmit: true },
    configPath,
  );
  expect(formatDiagnostics(parsed.errors)).toBe("");
  return parsed.options;
}

function emptyRules() {
  return compileRuleProfile(RULE_AXIS_REGISTRY, { contributions: [] });
}

describe("land-operation focused contracts", () => {
  it("canonicalizes selector structure independently of source spelling", () => {
    const left: CellSelector = {
      kind: "UNION",
      selectors: [
        { kind: "CELLS", ids: [3, 1, 3] },
        {
          kind: "UNION",
          selectors: [
            { kind: "TERRAIN", terrain: "MARSH" },
            { kind: "CELLS", ids: [1, 3] },
          ],
        },
      ],
    };
    const right: CellSelector = {
      kind: "UNION",
      selectors: [
        { kind: "TERRAIN", terrain: "MARSH" },
        { kind: "CELLS", ids: [3, 1] },
      ],
    };

    expect(canonicalCellSelectorKey(left)).toBe(canonicalCellSelectorKey(right));
    expect(canonicalCellSelectorKey({ kind: "CELLS", ids: [9, 2, 9] })).toBe(
      canonicalCellSelectorKey({ kind: "CELLS", ids: [2, 9] }),
    );
  });

  it("keeps non-rule-scope terrain outside terrain rule evaluation", () => {
    expect(isTerrainScopeId("PLAINS")).toBe(true);
    expect(isTerrainScopeId("SHALLOW_WATER")).toBe(true);
    expect(isTerrainScopeId("DEEP_WATER")).toBe(false);
    expect(isTerrainScopeId("IMPASSABLE")).toBe(false);
  });

  it("typechecks the owned LandOperations dependency graph without inherited application code", () => {
    const program = ts.createProgram({
      rootNames: [path.resolve("src/simulation/LandOperations.ts")],
      options: compilerOptions(),
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(formatDiagnostics(diagnostics)).toBe("");

    const repositorySources = program
      .getSourceFiles()
      .map((sourceFile) => path.relative(process.cwd(), sourceFile.fileName))
      .filter((fileName) => !fileName.startsWith("node_modules"));
    expect(repositorySources).toContain(path.normalize("src/simulation/LandOperations.ts"));
    expect(repositorySources.some((fileName) => fileName.startsWith("src/server"))).toBe(false);
  });

  it("uses the canonical terrain baselines for land acquisition and pressure", () => {
    expect(landTerrainBaseSpec("MARSH")).toEqual({
      conquerable: true,
      populationBearing: true,
      landTraversable: true,
      acquisitionProgressMultiplier: 0.7,
      offensivePressureMultiplier: 0.9,
      defensivePressureMultiplier: 0.9,
    });
    expect(landTerrainBaseSpec("SHALLOW_WATER")).toMatchObject({
      conquerable: true,
      populationBearing: false,
      landTraversable: true,
      acquisitionProgressMultiplier: 0.7,
      offensivePressureMultiplier: 0.85,
      defensivePressureMultiplier: 0.85,
    });
    expect(landTerrainBaseSpec("DEEP_WATER")).toMatchObject({
      conquerable: false,
      populationBearing: false,
      landTraversable: false,
    });
  });

  it("keeps the canonical coast predicate on the land side of a Shallow/Deep Water boundary", () => {
    expect(isLandSideCoastTerrain("PLAINS", ["SHALLOW_WATER"])).toBe(true);
    expect(isLandSideCoastTerrain("PLAINS", ["DEEP_WATER"])).toBe(true);
    expect(isLandSideCoastTerrain("SHALLOW_WATER", ["DEEP_WATER"])).toBe(false);
    expect(isLandSideCoastTerrain("DEEP_WATER", ["SHALLOW_WATER"])).toBe(false);
  });

  it("resolves parity counter-response from one immutable pre-tick state", () => {
    expect(calculateCounterResponseTick(100, 100)).toEqual({
      attackingPopulationLost: 0.5,
      respondingPopulationLost: 0.5,
      attackEffectiveness: 1,
      responseEffectiveness: 1,
    });
  });

  it("reports every positive-pressure attack operation as manifested before any capture", () => {
    const match = new MatchRuntime(
      createMicroSimulationSpec({
        seed: "operation-pressure-manifestation-red",
        width: 2,
        height: 1,
        terrain: ["PLAINS", "PLAINS"],
        initialOwners: ["alpha", "beta"],
        factions: [
          { id: "alpha", rules: emptyRules() },
          { id: "beta", rules: emptyRules() },
        ],
      }),
      { controllerReferenceNamespace: "operation-pressure-manifestation-red" },
    );
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "alpha", amount: 2 });
    match.acceptAction({ type: "GRANT_POPULATION", factionId: "beta", amount: 20 });
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
    expect(receipts.find((entry) => entry.factionId === "alpha")?.receipt.accepted).toBe(
      true,
    );

    const before = match.snapshot();
    const operationIds = before.operations
      .filter((operation) => operation.kind === "ATTACK")
      .map((operation) => operation.id)
      .sort();
    expect(operationIds).toHaveLength(2);
    expect(before.ownership).toEqual(["alpha", "beta"]);

    const resolved = resolveLandTick(before, before.tick + 1);
    expect(resolved.ownership).toEqual(["alpha", "beta"]);

    const manifestationEvents = (resolved.events as readonly Array<{
      readonly kind: string;
      readonly payload: Readonly<{
        operationId?: string;
        attackedFactionId?: string;
      }>;
    }>).filter((event) => event.kind === "LAND_OPERATION_PRESSURE_RESOLVED");

    expect(
      manifestationEvents.map((event) => ({
        operationId: event.payload.operationId,
        attackedFactionId: event.payload.attackedFactionId,
      })),
    ).toEqual(
      operationIds.map((operationId) => ({
        operationId,
        attackedFactionId: "beta",
      })),
    );
  });
});
