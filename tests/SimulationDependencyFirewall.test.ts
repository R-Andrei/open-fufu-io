import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

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
    const simulationRoot = join(process.cwd(), "src", "simulation");
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

  it("routes hostility grace through canonical lifecycle events rather than snapshot reconciliation", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const events = readFileSync(join(simulationRoot, "SimulationEvents.ts"), "utf8");
    const land = readFileSync(join(simulationRoot, "LandOperations.ts"), "utf8");
    const hostility = readFileSync(join(simulationRoot, "HostilityState.ts"), "utf8");
    const tickEngine = readFileSync(join(simulationRoot, "TickEngine.ts"), "utf8");

    expect(events).toContain("PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED");
    expect(events).toContain("FACTION_CAPITULATED");
    expect(events).toContain("createPersistentDirectedHostilitySourceEndedEvent");
    expect(events).toContain("createFactionCapitulatedEvent");
    expect(land).toContain("tryApplyPersistentDirectiveChangesWithEvents");
    expect(hostility).toContain("resolveHostilityGraceFromEvents");
    expect(tickEngine).toContain("resolveHostilityGraceFromEvents");
    expect(tickEngine).not.toContain("reconcileHostilityGrace(");
  });
});
