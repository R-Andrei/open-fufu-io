import path from "node:path";
import * as ts from "typescript";
import type { CellSelector } from "../src/core/controller/ControllerApi";
import { isTerrainScopeId } from "../src/core/rules/RuleComposition";
import {
  calculateCounterResponseTick,
  canonicalCellSelectorKey,
  isLandSideCoastTerrain,
  landTerrainBaseSpec,
} from "../src/simulation/LandOperations";

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
});
