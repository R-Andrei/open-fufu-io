import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import ts from "typescript";
import {
  resolveHostilityGraceFromEvents,
  type HostilityStateLike,
} from "../src/simulation/HostilityState";
import {
  tryApplyPersistentDirectiveChangesWithEvents,
  type LandFactionStateLike,
  type LandOperationState,
} from "../src/simulation/LandOperations";
import type { PopulationState } from "../src/simulation/Population";
import {
  createFactionCapitulatedEvent,
  createPersistentDirectedHostilitySourceEndedEvent,
} from "../src/simulation/SimulationEvents";

const FORBIDDEN_LEGACY_IMPORT_TOKENS = [
  "GameImpl",
  "PlayerImpl",
  "UnitImpl",
  "AttackImpl",
  "AttackExecution",
  "ExecutionManager",
  "GameRunner",
] as const;

const SIMULATION_BOUNDARY_POLICY_PATH = join(
  process.cwd(),
  "validation",
  "simulation-boundaries.json",
);
const TSCONFIG_PATH = join(process.cwd(), "tsconfig.json");
const SIMULATION_EVENT_MODULE = "src/simulation/SimulationEvents.ts";
const MATCH_RUNTIME_MODULE = "src/simulation/MatchRuntime.ts";
const CONTROLLER_REFERENCE_MODULE =
  "src/simulation/ControllerReferenceSession.ts";

const ALLOWED_BOUNDARY_OWNERS = new Set([
  "CONTROLLER_ADAPTER",
  "OPERATIONAL_REFERENCE",
  "ECONOMY",
  "HOSTILITY",
  "LAND",
  "MAP_SUBSTRATE",
  "RUNTIME_CORE",
  "TEST_HARNESS",
  "MOBILE_UNITS",
  "POPULATION",
  "SIMULATION_EVENTS",
  "SPAWN",
  "STRUCTURES",
  "TANK",
  "VISIBILITY",
]);

const ALLOWED_EDGE_CLASSIFICATIONS = new Set([
  "CANONICAL_EVENT",
  "ORCHESTRATION",
  "CURRENT_STATE_READ",
  "SHARED_CONTRACT",
  "OPERATIONAL_REFERENCE",
  "TEST_HARNESS",
]);

interface SimulationImportEdge {
  readonly from: string;
  readonly to: string;
}

interface SimulationImportGraph {
  readonly modules: readonly string[];
  readonly edges: readonly SimulationImportEdge[];
}

interface SimulationBoundaryEdge {
  readonly from: string;
  readonly to: string;
  readonly classification: string;
  readonly rationale: string;
}

function loadCompilerOptions(): ts.CompilerOptions {
  const read = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
  if (read.error !== undefined) {
    throw new Error(
      ts.flattenDiagnosticMessageText(read.error.messageText, "\n"),
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    process.cwd(),
    undefined,
    TSCONFIG_PATH,
  );
  if (parsed.errors.length > 0) {
    throw new Error(
      parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
        .join("\n"),
    );
  }
  return parsed.options;
}

const SIMULATION_COMPILER_OPTIONS = loadCompilerOptions();

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

function repoPath(path: string): string {
  return relative(process.cwd(), path).replaceAll("\\", "/");
}

function moduleSpecifiersFromSource(
  path: string,
  source: string,
): readonly string[] {
  const parsed = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const result: string[] = [];

  for (const statement of parsed.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      result.push(statement.moduleSpecifier.text);
      continue;
    }
    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference)
    ) {
      const expression = statement.moduleReference.expression;
      if (expression === undefined || !ts.isStringLiteral(expression)) {
        throw new Error(`${path}: import-equals module reference must be literal`);
      }
      result.push(expression.text);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (
        !ts.isLiteralTypeNode(argument) ||
        !ts.isStringLiteral(argument.literal)
      ) {
        throw new Error(
          `${path}: import type module reference must be one string literal`,
        );
      }
      result.push(argument.literal.text);
    }
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) {
          throw new Error(
            `${path}: ${isDynamicImport ? "dynamic import" : "require"} module reference must be one string literal`,
          );
        }
        result.push(node.arguments[0].text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);

  return result;
}

function moduleSpecifiers(path: string): readonly string[] {
  return moduleSpecifiersFromSource(path, readFileSync(path, "utf8"));
}

function resolveSimulationImport(
  importer: string,
  specifier: string,
  modulePaths: ReadonlySet<string>,
): string | undefined {
  const resolvedModule = ts.resolveModuleName(
    specifier,
    importer,
    SIMULATION_COMPILER_OPTIONS,
    ts.sys,
  ).resolvedModule;
  if (resolvedModule === undefined) return undefined;
  const normalized = repoPath(resolve(resolvedModule.resolvedFileName));
  return modulePaths.has(normalized) ? normalized : undefined;
}

function edgeKey(edge: SimulationImportEdge): string {
  return JSON.stringify([edge.from, edge.to]);
}

function simulationImportGraph(simulationRoot: string): SimulationImportGraph {
  const files = typescriptFiles(simulationRoot);
  const modules = files.map(repoPath).sort();
  const modulePaths = new Set(modules);
  const edges = new Map<string, SimulationImportEdge>();

  for (const file of files) {
    const from = repoPath(file);
    for (const specifier of moduleSpecifiers(file)) {
      const to = resolveSimulationImport(file, specifier, modulePaths);
      if (to === undefined) continue;
      const edge = Object.freeze({ from, to });
      edges.set(edgeKey(edge), edge);
    }
  }

  return Object.freeze({
    modules: Object.freeze(modules),
    edges: Object.freeze(
      [...edges.values()].sort(
        (left, right) =>
          left.from.localeCompare(right.from) || left.to.localeCompare(right.to),
      ),
    ),
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  errors: string[],
  label: string,
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    errors.push(
      `${label} keys must be exactly ${wanted.join(", ")}; got ${actual.join(", ")}`,
    );
  }
}

function loadSimulationBoundaryPolicy(): unknown {
  return JSON.parse(readFileSync(SIMULATION_BOUNDARY_POLICY_PATH, "utf8"));
}

function validateSimulationBoundaryPolicy(
  graph: SimulationImportGraph,
  value: unknown,
): string[] {
  const errors: string[] = [];
  if (!isPlainRecord(value)) return ["policy root must be an object"];

  exactKeys(errors, "policy root", value, [
    "canonicalContract",
    "crossOwnerImports",
    "moduleOwners",
    "schemaVersion",
  ]);

  if (value.schemaVersion !== 1) {
    errors.push("schemaVersion must be exactly 1");
  }
  if (value.canonicalContract !== "docs/SIMULATION_EVENTS.md") {
    errors.push("canonicalContract must be docs/SIMULATION_EVENTS.md");
  }
  if (!isPlainRecord(value.moduleOwners)) {
    errors.push("moduleOwners must be an object");
    return errors;
  }
  if (!Array.isArray(value.crossOwnerImports)) {
    errors.push("crossOwnerImports must be an array");
    return errors;
  }

  const moduleOwners = value.moduleOwners;
  const policyModules = Object.keys(moduleOwners).sort();
  const graphModules = [...graph.modules].sort();
  for (const modulePath of graphModules) {
    if (!Object.prototype.hasOwnProperty.call(moduleOwners, modulePath)) {
      errors.push(`missing module owner: ${modulePath}`);
    }
  }
  for (const modulePath of policyModules) {
    if (!graphModules.includes(modulePath)) {
      errors.push(`unknown/stale module owner: ${modulePath}`);
    }
    const owner = moduleOwners[modulePath];
    if (typeof owner !== "string" || !ALLOWED_BOUNDARY_OWNERS.has(owner)) {
      errors.push(`invalid module owner for ${modulePath}`);
    }
  }

  const requiredOwnerAnchors: Readonly<Record<string, string>> = {
    [SIMULATION_EVENT_MODULE]: "SIMULATION_EVENTS",
    [MATCH_RUNTIME_MODULE]: "RUNTIME_CORE",
    "src/simulation/TickEngine.ts": "RUNTIME_CORE",
    [CONTROLLER_REFERENCE_MODULE]: "OPERATIONAL_REFERENCE",
  };
  for (const [modulePath, expectedOwner] of Object.entries(
    requiredOwnerAnchors,
  )) {
    if (moduleOwners[modulePath] !== expectedOwner) {
      errors.push(`${modulePath} must be owned by ${expectedOwner}`);
    }
  }

  const actualEdges = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));
  const declaredEdges = new Map<string, SimulationBoundaryEdge>();

  for (let index = 0; index < value.crossOwnerImports.length; index += 1) {
    const candidate = value.crossOwnerImports[index];
    if (!isPlainRecord(candidate)) {
      errors.push(`crossOwnerImports[${index}] must be an object`);
      continue;
    }
    exactKeys(errors, `crossOwnerImports[${index}]`, candidate, [
      "classification",
      "from",
      "rationale",
      "to",
    ]);
    const { from, to, classification, rationale } = candidate;
    if (
      typeof from !== "string" ||
      typeof to !== "string" ||
      typeof classification !== "string" ||
      typeof rationale !== "string"
    ) {
      errors.push(`crossOwnerImports[${index}] fields must all be strings`);
      continue;
    }
    if (!ALLOWED_EDGE_CLASSIFICATIONS.has(classification)) {
      errors.push(`invalid edge classification: ${classification}`);
    }
    if (rationale.trim().length === 0) {
      errors.push(`edge rationale must be non-empty: ${from} -> ${to}`);
    }
    if (!graphModules.includes(from) || !graphModules.includes(to)) {
      errors.push(`edge references unknown module: ${from} -> ${to}`);
    }

    const key = edgeKey({ from, to });
    if (declaredEdges.has(key)) {
      errors.push(`duplicate policy edge: ${from} -> ${to}`);
    } else {
      declaredEdges.set(
        key,
        Object.freeze({ from, to, classification, rationale }),
      );
    }

    if (!actualEdges.has(key)) {
      errors.push(`stale policy edge: ${from} -> ${to}`);
    }

    const fromOwner = moduleOwners[from];
    const toOwner = moduleOwners[to];
    if (typeof fromOwner === "string" && fromOwner === toOwner) {
      errors.push(`same-owner edge must not be declared: ${from} -> ${to}`);
    }

    if (to === SIMULATION_EVENT_MODULE && classification !== "CANONICAL_EVENT") {
      errors.push(`SimulationEvents edge must be CANONICAL_EVENT: ${from}`);
    }
    if (
      classification === "CANONICAL_EVENT" &&
      to !== SIMULATION_EVENT_MODULE
    ) {
      errors.push(`CANONICAL_EVENT must target SimulationEvents: ${from} -> ${to}`);
    }

    const isOperationalReference =
      from === MATCH_RUNTIME_MODULE && to === CONTROLLER_REFERENCE_MODULE;
    if (
      isOperationalReference &&
      classification !== "OPERATIONAL_REFERENCE"
    ) {
      errors.push("MatchRuntime -> ControllerReferenceSession must use the R7 operational-reference classification");
    }
    if (
      classification === "OPERATIONAL_REFERENCE" &&
      !isOperationalReference
    ) {
      errors.push(`OPERATIONAL_REFERENCE is limited to the R7 seam: ${from} -> ${to}`);
    }
  }

  for (const edge of graph.edges) {
    const fromOwner = moduleOwners[edge.from];
    const toOwner = moduleOwners[edge.to];
    if (
      typeof fromOwner === "string" &&
      typeof toOwner === "string" &&
      fromOwner !== toOwner &&
      !declaredEdges.has(edgeKey(edge))
    ) {
      errors.push(`unclassified cross-owner import: ${edge.from} -> ${edge.to}`);
    }
  }

  return errors;
}

function clonePolicy(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function attackOperation(
  id: string,
  controllerKey: string,
  ownerId: string,
  targetFactionId: string,
): LandOperationState {
  return Object.freeze({
    id,
    controllerKey,
    kind: "ATTACK" as const,
    ownerId,
    targetFactionId,
    committedPopulation: 1,
    source: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([0]) }),
    target: Object.freeze({ kind: "CELLS" as const, ids: Object.freeze([1]) }),
  });
}

function population(options: {
  readonly available?: number;
  readonly offensive?: number;
  readonly counter?: number;
} = {}): PopulationState {
  const available = options.available ?? 0;
  const committedOffensive = options.offensive ?? 0;
  const committedCounterResponse = options.counter ?? 0;
  const total = available + committedOffensive + committedCounterResponse;
  return Object.freeze({
    total,
    available,
    committedOffensive,
    committedCounterResponse,
    aboardTransports: 0,
    peakTotal: total,
    neutralSettlementHalfResidual: 0,
  });
}

const testRules = Object.freeze({}) as LandFactionStateLike["rules"];

function hostilityState(options: {
  readonly factions?: HostilityStateLike["factions"];
  readonly operations?: readonly LandOperationState[];
} = {}): HostilityStateLike {
  return Object.freeze({
    tick: 4,
    factions:
      options.factions ??
      Object.freeze([
        Object.freeze({ id: "alpha", status: "ACTIVE" as const }),
        Object.freeze({ id: "beta", status: "ACTIVE" as const }),
      ]),
    operations: options.operations ?? Object.freeze([]),
    hostilityGrace: Object.freeze([]),
  });
}

describe("simulation dependency firewall", () => {
  it("does not import broad inherited OpenFront runtime/domain objects", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const violations: string[] = [];

    for (const path of typescriptFiles(simulationRoot)) {
      const source = readFileSync(path, "utf8");
      const importDeclarations =
        source.match(/import[\s\S]*?from\s+["'][^"']+["'];?/g) ?? [];
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

  it("cannot bypass dependency classification with alternate module-loading syntax", () => {
    expect(
      moduleSpecifiersFromSource(
        "fixture.ts",
        'import value = require("./Value"); const other = require("./Other"); import("./Dynamic"); type TypeOnly = import("./TypeOnly").Thing;',
      ),
    ).toEqual(["./Value", "./Other", "./Dynamic", "./TypeOnly"]);
    expect(() =>
      moduleSpecifiersFromSource(
        "fixture.ts",
        'const path = "./Dynamic"; import(path);',
      ),
    ).toThrow(/dynamic import.*string literal/i);
    expect(() =>
      moduleSpecifiersFromSource(
        "fixture.ts",
        'const path = "./Other"; require(path);',
      ),
    ).toThrow(/require.*string literal/i);
  });

  it("does not drop configured internal path aliases", () => {
    expect(
      moduleSpecifiersFromSource(
        "fixture.ts",
        'import type { EconomyState } from "src/simulation/Economy";',
      ),
    ).toEqual(["src/simulation/Economy"]);

    const importer = join(process.cwd(), "src", "simulation", "Structures.ts");
    expect(
      resolveSimulationImport(
        importer,
        "src/simulation/Economy",
        new Set(["src/simulation/Economy.ts"]),
      ),
    ).toBe("src/simulation/Economy.ts");
  });

  it("uses TypeScript extension substitution for simulation imports", () => {
    const importer = join(process.cwd(), "src", "simulation", "Structures.ts");
    expect(
      resolveSimulationImport(
        importer,
        "./Economy.js",
        new Set(["src/simulation/Economy.ts"]),
      ),
    ).toBe("src/simulation/Economy.ts");
  });

  it("requires an exhaustive reviewed simulation-boundary classification", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const graph = simulationImportGraph(simulationRoot);
    const policy = loadSimulationBoundaryPolicy();

    expect(validateSimulationBoundaryPolicy(graph, policy)).toEqual([]);
    expect(graph.modules).toHaveLength(34);
    expect(graph.edges).toHaveLength(115);
  });

  it("rejects unclassified, stale, duplicate, and misclassified architecture policy", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const graph = simulationImportGraph(simulationRoot);
    const policy = loadSimulationBoundaryPolicy();

    const newModuleGraph: SimulationImportGraph = Object.freeze({
      modules: Object.freeze([
        ...graph.modules,
        "src/simulation/NewDomain.ts",
      ].sort()),
      edges: graph.edges,
    });
    expect(
      validateSimulationBoundaryPolicy(newModuleGraph, policy),
    ).toContain("missing module owner: src/simulation/NewDomain.ts");

    const unclassifiedEdge: SimulationImportEdge = Object.freeze({
      from: "src/simulation/Economy.ts",
      to: "src/simulation/Structures.ts",
    });
    const newEdgeGraph: SimulationImportGraph = Object.freeze({
      modules: graph.modules,
      edges: Object.freeze(
        [...graph.edges, unclassifiedEdge].sort(
          (left, right) =>
            left.from.localeCompare(right.from) ||
            left.to.localeCompare(right.to),
        ),
      ),
    });
    expect(validateSimulationBoundaryPolicy(newEdgeGraph, policy)).toContain(
      "unclassified cross-owner import: src/simulation/Economy.ts -> src/simulation/Structures.ts",
    );

    const stale = clonePolicy(policy);
    stale.crossOwnerImports.push({
      from: "src/simulation/Economy.ts",
      to: "src/simulation/Structures.ts",
      classification: "CURRENT_STATE_READ",
      rationale: "adversarial stale entry",
    });
    expect(validateSimulationBoundaryPolicy(graph, stale)).toContain(
      "stale policy edge: src/simulation/Economy.ts -> src/simulation/Structures.ts",
    );

    const duplicate = clonePolicy(policy);
    duplicate.crossOwnerImports.push({
      ...duplicate.crossOwnerImports[0],
    });
    expect(validateSimulationBoundaryPolicy(graph, duplicate)).toContain(
      `duplicate policy edge: ${duplicate.crossOwnerImports[0].from} -> ${duplicate.crossOwnerImports[0].to}`,
    );

    const eventMisclassification = clonePolicy(policy);
    const eventEdge = eventMisclassification.crossOwnerImports.find(
      (edge: SimulationBoundaryEdge) => edge.to === SIMULATION_EVENT_MODULE,
    );
    eventEdge.classification = "CURRENT_STATE_READ";
    expect(
      validateSimulationBoundaryPolicy(graph, eventMisclassification),
    ).toContain(
      `SimulationEvents edge must be CANONICAL_EVENT: ${eventEdge.from}`,
    );

    const operationalMisclassification = clonePolicy(policy);
    const operationalEdge = operationalMisclassification.crossOwnerImports.find(
      (edge: SimulationBoundaryEdge) =>
        edge.from === MATCH_RUNTIME_MODULE &&
        edge.to === CONTROLLER_REFERENCE_MODULE,
    );
    operationalEdge.classification = "ORCHESTRATION";
    expect(
      validateSimulationBoundaryPolicy(graph, operationalMisclassification),
    ).toContain(
      "MatchRuntime -> ControllerReferenceSession must use the R7 operational-reference classification",
    );

    const wrongAnchor = clonePolicy(policy);
    wrongAnchor.moduleOwners[SIMULATION_EVENT_MODULE] = "ECONOMY";
    expect(validateSimulationBoundaryPolicy(graph, wrongAnchor)).toContain(
      "src/simulation/SimulationEvents.ts must be owned by SIMULATION_EVENTS",
    );

    const extraRootField = clonePolicy(policy);
    extraRootField.unreviewedEscapeHatch = true;
    expect(
      validateSimulationBoundaryPolicy(graph, extraRootField).some((error) =>
        error.startsWith("policy root keys must be exactly"),
      ),
    ).toBe(true);
  });

  it("routes hostility grace through canonical lifecycle events rather than snapshot reconciliation", () => {
    const simulationRoot = join(process.cwd(), "src", "simulation");
    const events = readFileSync(join(simulationRoot, "SimulationEvents.ts"), "utf8");
    const land = readFileSync(join(simulationRoot, "LandOperations.ts"), "utf8");
    const hostility = readFileSync(join(simulationRoot, "HostilityState.ts"), "utf8");
    const tickEngine = readFileSync(join(simulationRoot, "TickEngine.ts"), "utf8");

    expect(events).toContain("PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED");
    expect(events).toContain("FACTION_CAPITULATED");
    expect(events).toContain(
      "createPersistentDirectedHostilitySourceEndedEvent",
    );
    expect(events).toContain("createFactionCapitulatedEvent");
    expect(land).toContain("tryApplyPersistentDirectiveChangesWithEvents");
    expect(hostility).toContain("resolveHostilityGraceFromEvents");
    expect(tickEngine).toContain("resolveHostilityGraceFromEvents");
    expect(tickEngine).not.toContain("reconcileHostilityGrace(");
  });

  it("materializes minimal immutable hostility lifecycle facts", () => {
    const ended = createPersistentDirectedHostilitySourceEndedEvent({
      id: "opaque-ended-source",
      tick: 5,
      sourceSide: { kind: "FACTION", id: "alpha" },
      targetSide: { kind: "FIXED_TEAM", id: "blue" },
    });
    expect(ended).toEqual({
      id: "opaque-ended-source",
      tick: 5,
      kind: "PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED",
      payload: {
        sourceSide: { kind: "FACTION", id: "alpha" },
        targetSide: { kind: "FIXED_TEAM", id: "blue" },
      },
    });
    expect(Object.keys(ended.payload).sort()).toEqual([
      "sourceSide",
      "targetSide",
    ]);
    expect(ended.payload).not.toHaveProperty("atWar");
    expect(ended.payload).not.toHaveProperty("expiresAtTickExclusive");
    expect(Object.isFrozen(ended)).toBe(true);
    expect(Object.isFrozen(ended.payload)).toBe(true);
    expect(Object.isFrozen(ended.payload.sourceSide)).toBe(true);
    expect(Object.isFrozen(ended.payload.targetSide)).toBe(true);
    expect(() =>
      createPersistentDirectedHostilitySourceEndedEvent({
        id: "same-side",
        tick: 5,
        sourceSide: { kind: "FACTION", id: "alpha" },
        targetSide: { kind: "FACTION", id: "alpha" },
      }),
    ).toThrow(/distinct|side/i);

    const capitulated = createFactionCapitulatedEvent({
      id: "opaque-capitulation",
      tick: 5,
      factionId: "alpha",
    });
    expect(capitulated).toEqual({
      id: "opaque-capitulation",
      tick: 5,
      kind: "FACTION_CAPITULATED",
      payload: { factionId: "alpha" },
    });
    expect(Object.keys(capitulated.payload)).toEqual(["factionId"]);
    expect(Object.isFrozen(capitulated)).toBe(true);
    expect(Object.isFrozen(capitulated.payload)).toBe(true);
  });

  it("starts grace only after the last current source and rejects duplicate or stale delivery", () => {
    const event = createPersistentDirectedHostilitySourceEndedEvent({
      id: "ended-alpha-beta",
      tick: 5,
      sourceSide: { kind: "FACTION", id: "alpha" },
      targetSide: { kind: "FACTION", id: "beta" },
    });

    expect(resolveHostilityGraceFromEvents(hostilityState(), [event], 5)).toEqual([
      {
        sideA: { kind: "FACTION", id: "alpha" },
        sideB: { kind: "FACTION", id: "beta" },
        expiresAtTickExclusive: 605,
      },
    ]);

    expect(
      resolveHostilityGraceFromEvents(
        hostilityState({
          operations: Object.freeze([
            attackOperation("another-attack", "another-key", "alpha", "beta"),
          ]),
        }),
        [event],
        5,
      ),
    ).toEqual([]);

    expect(() =>
      resolveHostilityGraceFromEvents(hostilityState(), [event, event], 5),
    ).toThrow(/duplicate/i);
    expect(() =>
      resolveHostilityGraceFromEvents(
        hostilityState(),
        [
          createPersistentDirectedHostilitySourceEndedEvent({
            id: "stale-ended-alpha-beta",
            tick: 4,
            sourceSide: { kind: "FACTION", id: "alpha" },
            targetSide: { kind: "FACTION", id: "beta" },
          }),
        ],
        5,
      ),
    ).toThrow(/tick/i);
  });

  it("preserves ended COUNTER_RESPONSE side identity after its incoming ATTACK disappears", () => {
    const factions = Object.freeze([
      Object.freeze({
        id: "alpha",
        status: "ACTIVE" as const,
        rules: testRules,
        population: population({ offensive: 1 }),
      }),
      Object.freeze({
        id: "beta",
        status: "ACTIVE" as const,
        rules: testRules,
        population: population({ counter: 1 }),
      }),
    ]);
    const attack = attackOperation(
      "attack-alpha-beta",
      "alpha-attack",
      "alpha",
      "beta",
    );
    const counter = Object.freeze({
      id: "counter-beta-alpha",
      controllerKey: "beta-counter",
      kind: "COUNTER_RESPONSE" as const,
      ownerId: "beta",
      incomingOperationId: attack.id,
      committedPopulation: 1,
    });
    const state = Object.freeze({
      factions,
      operations: Object.freeze([attack, counter]),
      defensePriorities: Object.freeze([]),
    });

    const applied = tryApplyPersistentDirectiveChangesWithEvents(
      state,
      "alpha",
      { end: ["alpha-attack"] },
      { transitionTick: 5, acceptedInputSequence: 7 },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(applied.operations).toEqual([counter]);
    expect(applied.events).toHaveLength(2);
    expect(applied.events.map((event) => event.payload)).toEqual([
      {
        sourceSide: { kind: "FACTION", id: "alpha" },
        targetSide: { kind: "FACTION", id: "beta" },
      },
      {
        sourceSide: { kind: "FACTION", id: "beta" },
        targetSide: { kind: "FACTION", id: "alpha" },
      },
    ]);
    expect(new Set(applied.events.map((event) => event.id)).size).toBe(2);
    expect(applied.events.every((event) => event.tick === 5)).toBe(true);

    const repeated = tryApplyPersistentDirectiveChangesWithEvents(
      state,
      "alpha",
      { end: ["alpha-attack"] },
      { transitionTick: 5, acceptedInputSequence: 7 },
    );
    expect(repeated).toEqual(applied);

    const differentSequence = tryApplyPersistentDirectiveChangesWithEvents(
      state,
      "alpha",
      { end: ["alpha-attack"] },
      { transitionTick: 5, acceptedInputSequence: 8 },
    );
    expect(differentSequence.ok).toBe(true);
    if (!differentSequence.ok) return;
    expect(differentSequence.events.map((event) => event.id)).not.toEqual(
      applied.events.map((event) => event.id),
    );
  });

  it("derives capitulation consequences from current team state without embedding policy in the fact", () => {
    const teamState = hostilityState({
      factions: Object.freeze([
        Object.freeze({
          id: "alpha",
          status: "CAPITULATED" as const,
          fixedTeamId: "red",
        }),
        Object.freeze({
          id: "bravo",
          status: "ACTIVE" as const,
          fixedTeamId: "red",
        }),
        Object.freeze({
          id: "charlie",
          status: "ACTIVE" as const,
          fixedTeamId: "blue",
        }),
      ]),
      operations: Object.freeze([
        attackOperation("alpha-attack", "alpha-key", "alpha", "charlie"),
      ]),
    });
    const teamEvent = createFactionCapitulatedEvent({
      id: "capitulated-alpha-team",
      tick: 5,
      factionId: "alpha",
    });
    expect(resolveHostilityGraceFromEvents(teamState, [teamEvent], 5)).toEqual([
      {
        sideA: { kind: "FIXED_TEAM", id: "blue" },
        sideB: { kind: "FIXED_TEAM", id: "red" },
        expiresAtTickExclusive: 605,
      },
    ]);

    const finalSideState = hostilityState({
      factions: Object.freeze([
        Object.freeze({ id: "alpha", status: "CAPITULATED" as const }),
        Object.freeze({ id: "beta", status: "ACTIVE" as const }),
      ]),
      operations: Object.freeze([
        attackOperation("alpha-attack", "alpha-key", "alpha", "beta"),
      ]),
    });
    const finalSideEvent = createFactionCapitulatedEvent({
      id: "capitulated-alpha-final",
      tick: 5,
      factionId: "alpha",
    });
    expect(
      resolveHostilityGraceFromEvents(finalSideState, [finalSideEvent], 5),
    ).toEqual([]);
  });
});