import path from "node:path";
import * as ts from "typescript";

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}

describe("Open Fufu Controller API contract", () => {
  it("typechecks the owned contract fixture without compiling inherited application code", () => {
    const configPath = path.resolve("tsconfig.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

    expect(
      configFile.error ? formatDiagnostics([configFile.error]) : "",
    ).toBe("");

    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      process.cwd(),
      { noEmit: true },
      configPath,
    );

    expect(formatDiagnostics(parsed.errors)).toBe("");

    const fixturePath = path.resolve(
      "tests/contracts/controller-api.typecheck.ts",
    );
    const program = ts.createProgram({
      rootNames: [fixturePath],
      options: parsed.options,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(formatDiagnostics(diagnostics)).toBe("");

    const repositorySources = program
      .getSourceFiles()
      .map((sourceFile) => path.relative(process.cwd(), sourceFile.fileName))
      .filter((fileName) => !fileName.startsWith("node_modules"));

    expect(repositorySources).toContain(
      path.normalize("tests/contracts/controller-api.typecheck.ts"),
    );
    expect(repositorySources).toContain(
      path.normalize("src/core/controller/ControllerApi.ts"),
    );
    expect(
      repositorySources.some((fileName) => fileName.startsWith("src/server")),
    ).toBe(false);
  });
});
