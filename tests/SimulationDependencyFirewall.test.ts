import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_LEGACY_IMPORT_TOKENS = [
  "GameImpl",
  "PlayerImpl",
  "UnitImpl",
  "AttackImpl",
  "AttackExecution",
  "ExecutionManager",
  "GameRunner",
] as const;

function typescriptFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      result.push(...typescriptFiles(path));
    } else if (extname(entry.name) === ".ts") {
      result.push(path);
    }
  }
  return result.sort();
}

describe("simulation dependency firewall", () => {
  it("does not import broad inherited OpenFront runtime/domain objects", () => {
    const simulationRoot = fileURLToPath(new URL("../src/simulation", import.meta.url));
    const violations: string[] = [];

    for (const path of typescriptFiles(simulationRoot)) {
      const source = readFileSync(path, "utf8");
      const importDeclarations = source.match(/import[\s\S]*?from\s+["'][^"']+["'];?/g) ?? [];
      for (const declaration of importDeclarations) {
        for (const token of FORBIDDEN_LEGACY_IMPORT_TOKENS) {
          if (declaration.includes(token)) {
            violations.push(`${path}: ${token}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
