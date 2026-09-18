import path from "node:path";
import * as ts from "typescript";
import type {
  CaptureCalculation,
  ControllerEvent,
  FactionRef,
  FactionsApi,
  GrowthCalculation,
  HostilityMechanicsSpec,
  MechanicsApi,
  PersistentDirective,
  PopulationView,
  PurchasableUnitType,
  RelinquishQuote,
  SpawnInfluenceContext,
  StructureAcquisitionPath,
  StructureBuildQuote,
  StructureMechanicsSpec,
  StructureRef,
  StructureView,
  TransportMechanicsSpec,
  UnitAttackSpec,
  UnitRef,
} from "../src/core/controller/ControllerApi";

// Compile-time fixtures for #47's newly surfaced controller mechanics. This file
// is itself included in the focused compiler program below, so these assignments
// fail the owned contract test if the public API drifts.
const issue47PopulationState: PopulationView = {
  total: 500,
  available: 300,
  committedOffense: 200,
  committedCounterResponse: 0,
  aboardTransports: 0,
  capacity: 1_000,
  growthPerSecond: 10,
  utilization: 0.5,
  neutralSettlementHalfResidual: 1,
};
void issue47PopulationState;

const issue47GrowthProjection: GrowthCalculation = {
  capacity: 1_000,
  population: 700,
  utilization: 0.7,
  utilizationMultiplier: 1,
  growthPerSecond: 8.89,
};
void issue47GrowthProjection;

const issue47CaptureProjection: CaptureCalculation = {
  sourceCellId: 41,
  targetCellId: 42,
  inputAttackingPressure: 1,
  inputDefendingPressure: 1,
  effectiveAttackingPressure: 1,
  effectiveDefendingPressure: 0.9,
  advantage: 0.1,
  acquisitionProgressMultiplier: 0.7,
  requiredProgress: 1,
  progressPerSecond: 0.07,
  estimatedSecondsToCapture: 14.29,
  postCaptureAttackerPopulationLoss: 1,
  postCaptureAttackerPopulationDebitOrder: [
    "WINNING_OFFENSIVE_COMMITMENTS",
    "AVAILABLE",
  ],
};
void issue47CaptureProjection;

const issue47RelinquishQuote: RelinquishQuote = {
  legal: false,
  failureCode: "PERSISTENT_STRUCTURE_PRESENT",
  cost: {
    ffyRequired: 0,
    ffySpent: 0,
    populationSpent: 0,
  },
  selectedCellCount: 3,
  populationBearingCellCount: 2,
  capacityDelta: -2,
  appliesFallout: true,
};
void issue47RelinquishQuote;

const issue47RelinquishFromMechanics: ReturnType<
  MechanicsApi["relinquishQuote"]
> = issue47RelinquishQuote;
void issue47RelinquishFromMechanics;

// The historical ControllerApi type fixture used to live under tests/types, which
// is not an owned mutable validation surface. Keep those compile-time obligations
// here so API migrations remain RED-first without mutating inherited test support.
const fixtureTank: PurchasableUnitType = "TANK";
const fixtureWarship: PurchasableUnitType = "WARSHIP";
void fixtureTank;
void fixtureWarship;

// @ts-expect-error Heavy Artillery is a transformed Tank chassis, not directly purchasable.
const fixtureHeavy: PurchasableUnitType = "HEAVY_ARTILLERY";
// @ts-expect-error Trains are simulation-owned.
const fixtureTrain: PurchasableUnitType = "TRAIN";
// @ts-expect-error Trade Ships are simulation-owned.
const fixtureTrade: PurchasableUnitType = "TRADE_SHIP";
void fixtureHeavy;
void fixtureTrain;
void fixtureTrade;

const fixtureFactoryRef = "factory-1" as StructureRef;
const fixtureUnitRef = "unit-1" as UnitRef;
const fixtureFactionARef = "faction-a" as FactionRef;
const fixtureFactionBRef = "faction-b" as FactionRef;

const fixtureCapturedFactoryPath: StructureAcquisitionPath = "CAPTURE_TRANSFER";
void fixtureCapturedFactoryPath;

const fixtureConqueredFactorySpec: StructureMechanicsSpec = {
  type: "FACTORY",
  level: 1,
  repairRadius: 8,
  repairRateHpPerSecond: 150,
  simultaneousRepairCapacity: 1,
  trainEventBaseValueMultiplier: 1.5,
  tankConstructionSpeedMultiplier: 1.5,
};
void fixtureConqueredFactorySpec;

const fixtureCappedStructureQuote: StructureBuildQuote = {
  legal: false,
  failureCode: "OWNERSHIP_CAP",
  cost: {
    ffyRequired: 50_000,
    ffySpent: 0,
    populationSpent: 0,
  },
  structure: "FORT",
  cellId: 42,
  resultingLevel: 1,
  buildTicks: 50,
  ownershipCap: 1,
};
void fixtureCappedStructureQuote;

const fixtureFreeFirstPurchaseQuote: StructureBuildQuote = {
  legal: true,
  cost: {
    ffyRequired: 100_000,
    ffySpent: 0,
    populationSpent: 0,
  },
  structure: "CITY",
  cellId: 43,
  resultingLevel: 1,
  buildTicks: 50,
};
void fixtureFreeFirstPurchaseQuote;

const fixtureFreshCityRef = "fixture:fresh-city" as StructureView["ref"];
const fixtureUpgradingCityRef =
  "fixture:upgrading-city" as StructureView["ref"];
const fixtureOwnerRef = "fixture:faction-a" as StructureView["ownerId"];

const fixtureFreshDirectLevel5City: StructureView = {
  ref: fixtureFreshCityRef,
  ownerId: fixtureOwnerRef,
  type: "CITY",
  cellId: 43,
  active: false,
  construction: {
    targetLevel: 5,
    remainingTicks: 25,
  },
};
void fixtureFreshDirectLevel5City;

const fixtureUpgradingCity: StructureView = {
  ref: fixtureUpgradingCityRef,
  ownerId: fixtureOwnerRef,
  type: "CITY",
  completedLevel: 2,
  cellId: 44,
  active: true,
  construction: {
    targetLevel: 3,
    remainingTicks: 20,
  },
};
void fixtureUpgradingCity;

const fixtureLandingGrant: NonNullable<
  TransportMechanicsSpec["successfulLandingGrant"]
> = {
  structure: "FORT",
  level: 1,
  placement: "EXACT_LANDING_CELL",
  activation: "IMMEDIATE_COMPLETED",
  failurePolicy: "SKIP_GRANT_KEEP_LANDING",
};
void fixtureLandingGrant;



const fixtureWarQuery = (factions: FactionsApi): boolean =>
  factions.atWar(fixtureFactionARef, fixtureFactionBRef);
void fixtureWarQuery;

const fixtureHostilitySpec: HostilityMechanicsSpec = {
  atWarGraceTicks: 600,
};
void fixtureHostilitySpec;

const fixturePopulationAttack: UnitAttackSpec = {
  kind: "DAMAGE_POPULATION",
  rangeCells: 30,
  cooldownTicks: 30,
  damage: 250,
  requiresAtWar: true,
};
void fixturePopulationAttack;

const fixtureWarChanged: ControllerEvent = {
  type: "WAR_STATE_CHANGED",
  factionAId: fixtureFactionARef,
  factionBId: fixtureFactionBRef,
  atWar: true,
};
void fixtureWarChanged;

const fixtureUnitOrder: PersistentDirective = {
  // @ts-expect-error Unit orders are deliberately not persistent directives.
  kind: "UNIT_ORDER",
  key: "u",
  unitId: "x",
};
void fixtureUnitOrder;

// Compile-time fixture for #107. Strategic Phase 1 must expose every player's
// public Spawn information through the single ControllerApi context.
export type Issue107SpawnParticipantContract =
  SpawnInfluenceContext["participants"][number];
export type Issue107SpawnParticipantOriginId =
  Issue107SpawnParticipantContract["origin"]["id"];
export type Issue107SpawnParticipantExactOriginCount =
  Issue107SpawnParticipantContract["profile"]["exactOriginCount"];
export type Issue107SpawnParticipantStartingPopulation =
  Issue107SpawnParticipantContract["startingPopulation"];
export type Issue107SpawnParticipantEffectiveModifiers =
  Issue107SpawnParticipantContract["effectiveModifiers"]["values"];
export type Issue107SpawnSegmentsContract = SpawnInfluenceContext["segments"];

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

  expect(configFile.error ? formatDiagnostics([configFile.error]) : "").toBe(
    "",
  );

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

describe("Open Fufu Controller API contract", () => {
  it("typechecks the owned contract fixtures without compiling inherited application code", () => {
    const options = compilerOptions();
    const fixturePaths = [path.resolve("tests/ControllerApiContract.test.ts")];
    const program = ts.createProgram({
      rootNames: fixturePaths,
      options,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(formatDiagnostics(diagnostics)).toBe("");

    const repositorySources = program
      .getSourceFiles()
      .map((sourceFile) => path.relative(process.cwd(), sourceFile.fileName))
      .filter((fileName) => !fileName.startsWith("node_modules"));

    for (const fixturePath of fixturePaths) {
      expect(repositorySources).toContain(
        path.relative(process.cwd(), fixturePath),
      );
    }
    expect(repositorySources).toContain(
      path.normalize("src/core/controller/ControllerApi.ts"),
    );
    expect(
      repositorySources.some((fileName) => fileName.startsWith("src/server")),
    ).toBe(false);
  });

  it("typechecks the naval and amphibious effective-mechanics projection", () => {
    const options = compilerOptions();
    const virtualFixturePath = path.resolve(
      "tests/contracts/issue50-controller-api.virtual.ts",
    );
    const virtualFixtureSource = `
import type {
  CellSelector,
  ControllerMemory,
  OpenFufuController,
  SamAntiShipAttackSpec,
  StructureMechanicsSpec,
  StructureRef,
  TransportDestructionMechanicsSpec,
  TransportLandingCalculation,
  TransportMechanicsSpec,
} from "../../src/core/controller/ControllerApi";

type FixtureMemory = ControllerMemory & { readonly marker: number };
type DecisionContext = Parameters<OpenFufuController<FixtureMemory>["decide"]>[0];

const p27AntiShipAttack: SamAntiShipAttackSpec = {
  targetUnitTypes: ["TRANSPORT_SHIP", "WARSHIP"],
  damage: 250,
  eligibilityField: "SAM_LAUNCHER",
  lineOfSightRequired: false,
  chargeConsumption: "ONE_READY_SAM_CHARGE_PER_SHOT",
  sharedChargePriority: "STRATEGIC_PROJECTILES_FIRST",
  firingCadence: "ONE_PASS_PER_TICK_SPEND_EACH_READY_CHARGE_AT_MOST_ONCE",
  batteryOrder: "ASCENDING_STABLE_STRUCTURE_ID",
  targetOrder: "TRANSPORT_THEN_DISTANCE_THEN_STABLE_UNIT_ID",
  requiresAtWar: false,
};

const p27SamRef = "sam-p27" as StructureRef;
const p27SamField: CellSelector = {
  kind: "STRUCTURE_FIELD_INSTANCE",
  structureId: p27SamRef,
  field: p27AntiShipAttack.eligibilityField,
};

const p27SamSpec: StructureMechanicsSpec = {
  type: "SAM_LAUNCHER",
  level: 3,
  chargeCapacity: 3,
  rechargeTicks: 600,
  interceptionRange: 80,
  canAttackShips: true,
  antiShipAttack: p27AntiShipAttack,
};

const p28DestructionSpec: TransportDestructionMechanicsSpec = {
  carriedPopulationLoss: "REMOVE_ALL_FROM_PREVIOUS_OWNER",
  creditedPopulationTransfer: {
    trigger: "HOSTILE_CREDITED_DESTRUCTION",
    amount: "CARRIED_POPULATION_AT_DESTRUCTION",
    recipient: "CREDITED_DESTROYER",
    destination: "AVAILABLE_POPULATION",
    capacityHandling: "ALLOW_OVER_CAPACITY",
    sameSideCreditQualifies: false,
    uncreditedDestructionQualifies: false,
  },
};

const n13LandingPolicy: Pick<
  TransportMechanicsSpec,
  "landingPopulationSurvivalFraction" | "landingPopulationRounding"
> = {
  landingPopulationSurvivalFraction: 0.5,
  landingPopulationRounding: "FLOOR",
};

const n13OddLanding: TransportLandingCalculation = {
  carriedPopulation: 5,
  survivalFraction: 0.5,
  survivingPopulation: 2,
  casualtyPopulation: 3,
  createsAmphibiousCommitment: true,
};

const n13ZeroSurvivorLanding: TransportLandingCalculation = {
  carriedPopulation: 1,
  survivalFraction: 0.5,
  survivingPopulation: 0,
  casualtyPopulation: 1,
  createsAmphibiousCommitment: false,
};

declare const context: DecisionContext;
const samSpec = context.mechanics.structureTypeSpec(
  "SAM_LAUNCHER",
  1,
  context.me.id,
);
const antiShipCoveredCells = samSpec.antiShipAttack
  ? context.cells.count({
      kind: "STRUCTURE_FIELD_INSTANCE",
      structureId: p27SamRef,
      field: samSpec.antiShipAttack.eligibilityField,
    })
  : Promise.resolve(0);
const landing = context.mechanics.transportLanding(5, context.me.id);
const destruction = context.mechanics.transportDestructionSpec(context.me.id);

void p27SamField;
void p27SamSpec;
void p28DestructionSpec;
void n13LandingPolicy;
void n13OddLanding;
void n13ZeroSurvivorLanding;
void antiShipCoveredCells;
void landing.survivingPopulation;
void destruction.creditedPopulationTransfer?.destination;
`;

    const baseHost = ts.createCompilerHost(options);
    const isVirtualFixture = (fileName: string): boolean =>
      path.resolve(fileName) === virtualFixturePath;
    const host: ts.CompilerHost = {
      ...baseHost,
      fileExists(fileName) {
        return isVirtualFixture(fileName) || baseHost.fileExists(fileName);
      },
      readFile(fileName) {
        return isVirtualFixture(fileName)
          ? virtualFixtureSource
          : baseHost.readFile(fileName);
      },
      getSourceFile(
        fileName,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      ) {
        if (isVirtualFixture(fileName)) {
          return ts.createSourceFile(
            fileName,
            virtualFixtureSource,
            languageVersion,
            true,
          );
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
      rootNames: [virtualFixturePath],
      options,
      host,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(formatDiagnostics(diagnostics)).toBe("");
    expect(program.getSourceFile(virtualFixturePath)).toBeDefined();
    expect(
      program
        .getSourceFiles()
        .map((sourceFile) => path.relative(process.cwd(), sourceFile.fileName))
        .filter((fileName) => !fileName.startsWith("node_modules")),
    ).toContain(path.normalize("src/core/controller/ControllerApi.ts"));
  });

  it("requires local public map/ownership access plus asynchronous derived queries", () => {
    const options = compilerOptions();
    const virtualFixturePath = path.resolve(
      "tests/contracts/issue105-full-map-controller-api.virtual.ts",
    );
    const virtualFixtureSource = `
import type {
  CellId,
  CellSelector,
  CellView,
  ControllerMemory,
  FactionRef,
  MapPoint,
  OpenFufuController,
  QueryPage,
  SegmentId,
  SegmentView,
  TerrainType,
} from "../../src/core/controller/ControllerApi";

type FixtureMemory = ControllerMemory & { readonly marker: number };
type DecisionContext = Parameters<OpenFufuController<FixtureMemory>["decide"]>[0];

declare const context: DecisionContext;
const mapWidth: number = context.map.width;
const mapHeight: number = context.map.height;
const mapCellCount: number = context.map.cellCount;
const validCell: boolean = context.map.isValidCellId(0);
const cellAt: CellId | undefined = context.map.cellIdAt(0, 0);
const position: Readonly<MapPoint> | undefined = context.map.positionOf(0);
const terrain: TerrainType | undefined = context.map.terrainAt(0);
const segmentId: SegmentId | undefined = context.map.segmentIdOf(0);
const neighbors: readonly CellId[] | undefined = context.map.cardinalNeighbors(0);
const owner: FactionRef | null | undefined = context.cells.owner(0);
const segmentCellIds: readonly CellId[] | undefined = context.segments.cellIds(0);
const getResult: Promise<CellView | undefined> = context.cells.get(0);
const queryResult: Promise<QueryPage<CellView>> = context.cells.query({ kind: "CELLS", ids: [0] });
const countResult: Promise<number> = context.cells.count({ kind: "CELLS", ids: [0] });
const neighborsResult: Promise<readonly number[]> = context.cells.neighbors(0);
const boundaryResult: Promise<QueryPage<CellView>> = context.cells.boundary({ kind: "CELLS", ids: [0] });
const distanceResult: Promise<number> = context.cells.distance(0, 1);
const segmentGetResult: Promise<SegmentView | undefined> = context.segments.get(0);
const segmentListResult: Promise<readonly SegmentView[]> = context.segments.list();
const segmentSelector: CellSelector = context.segments.cells(0);
// @ts-expect-error Dynamic connected-component enumeration is intentionally not a V1 API.
context.cells.connectedComponents({ kind: "CELLS", ids: [0] });

const controller: OpenFufuController<FixtureMemory> = {
  async chooseInfluence(context) {
    const totalCells: number = context.map.cellCount;
    const candidates = await context.cells.query(
      { kind: "POPULATION_BEARING", value: true },
      context.profile.influenceSlotCount,
    );
    void totalCells;
    return {
      centers: candidates.items.map((cell) => cell.id),
      memory: { ...context.memory, marker: context.game.decisionNumber },
    };
  },
  async reconsiderInfluence(context) {
    const owner: FactionRef | null | undefined =
      context.cells.owner(context.currentInfluenceCenters[0] ?? -1);
    await context.cells.get(context.currentInfluenceCenters[0] ?? -1);
    void owner;
    return {
      centers: context.currentInfluenceCenters,
      memory: { ...context.memory, marker: context.game.decisionNumber },
    };
  },
  async chooseOrigins(context) {
    const segmentCellIds: readonly CellId[] | undefined = context.segments.cellIds(0);
    await context.cells.count({ kind: "POPULATION_BEARING", value: true });
    void segmentCellIds;
    return {
      origins: context.influenceCenters.slice(0, context.profile.exactOriginCount),
      memory: { ...context.memory, marker: context.game.decisionNumber },
    };
  },
  async decide(context) {
    context.map.terrainAt(0);
    context.cells.owner(0);
    context.segments.cellIds(0);
    await context.segments.list();
    return {
      memory: { ...context.memory, marker: context.game.decisionNumber },
    };
  },
};

void mapWidth;
void mapHeight;
void mapCellCount;
void validCell;
void cellAt;
void position;
void terrain;
void segmentId;
void neighbors;
void owner;
void segmentCellIds;
void getResult;
void queryResult;
void countResult;
void neighborsResult;
void boundaryResult;
void distanceResult;
void segmentGetResult;
void segmentListResult;
void segmentSelector;
void controller;
`;

    const baseHost = ts.createCompilerHost(options);
    const isVirtualFixture = (fileName: string): boolean =>
      path.resolve(fileName) === virtualFixturePath;
    const host: ts.CompilerHost = {
      ...baseHost,
      fileExists(fileName) {
        return isVirtualFixture(fileName) || baseHost.fileExists(fileName);
      },
      readFile(fileName) {
        return isVirtualFixture(fileName)
          ? virtualFixtureSource
          : baseHost.readFile(fileName);
      },
      getSourceFile(
        fileName,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      ) {
        if (isVirtualFixture(fileName)) {
          return ts.createSourceFile(
            fileName,
            virtualFixtureSource,
            languageVersion,
            true,
          );
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
      rootNames: [virtualFixturePath],
      options,
      host,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(formatDiagnostics(diagnostics)).toBe("");
    expect(program.getSourceFile(virtualFixturePath)).toBeDefined();
  });

  it("excludes authoritative identity aliases from the entire exported controller type graph", () => {
    const apiPath = path.resolve("src/core/controller/ControllerApi.ts");
    const sourceText = ts.sys.readFile(apiPath);
    expect(sourceText).toBeDefined();
    if (sourceText === undefined) throw new Error("ControllerApi.ts is unreadable");

    const source = ts.createSourceFile(
      apiPath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const declarations = new Map<string, ts.Declaration>();
    const exportedRoots = new Set<string>();
    const forbiddenAliases = new Set([
      "FactionId",
      "UnitId",
      "StructureId",
      "OperationId",
    ]);
    const safePublicRefs = new Set([
      "FactionRef",
      "UnitRef",
      "StructureRef",
      "OperationRef",
    ]);
    const rawIdentityFieldNames = new Set([
      "factionId",
      "factionAId",
      "factionBId",
      "ownerId",
      "byFactionId",
      "fromFactionId",
      "targetFactionId",
      "referenceFactionId",
      "unitId",
      "structureId",
      "operationId",
      "producerId",
      "launcherId",
      "incomingOperationId",
    ]);

    const namedDeclaration = (declaration: ts.Declaration): string | undefined => {
      const name = (declaration as ts.NamedDeclaration).name;
      return name !== undefined && ts.isIdentifier(name) ? name.text : undefined;
    };
    const isExported = (node: ts.Node): boolean =>
      ts.canHaveModifiers(node) &&
      (ts.getModifiers(node)?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) ?? false);

    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const name = namedDeclaration(declaration);
          if (name === undefined) continue;
          declarations.set(name, declaration);
          if (isExported(statement)) exportedRoots.add(name);
        }
        continue;
      }
      if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isFunctionDeclaration(statement)
      ) {
        const name = namedDeclaration(statement);
        if (name === undefined) continue;
        declarations.set(name, statement);
        if (isExported(statement)) exportedRoots.add(name);
      }
    }

    const violations = new Set<string>();
    const visited = new Set<string>();
    const isRawStringIdentityType = (type: ts.TypeNode | undefined): boolean => {
      if (type === undefined) return false;
      if (type.kind === ts.SyntaxKind.StringKeyword) return true;
      if (ts.isParenthesizedTypeNode(type)) {
        return isRawStringIdentityType(type.type);
      }
      if (ts.isUnionTypeNode(type)) {
        return type.types.some((member) => isRawStringIdentityType(member));
      }
      if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
        const name = type.typeName.text;
        if (safePublicRefs.has(name)) return false;
        if (forbiddenAliases.has(name)) return true;
        const declaration = declarations.get(name);
        if (declaration === undefined) return false;
        return ts.isTypeAliasDeclaration(declaration)
          ? isRawStringIdentityType(declaration.type)
          : false;
      }
      return false;
    };

    const visitDeclaration = (name: string, route: readonly string[]): void => {
      if (visited.has(name)) return;
      visited.add(name);
      const declaration = declarations.get(name);
      if (declaration === undefined) return;
      const nextRoute = [...route, name];

      const walk = (node: ts.Node): void => {
        if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
          const referenced = node.typeName.text;
          if (forbiddenAliases.has(referenced)) {
            violations.add(`${nextRoute.join(" -> ")} -> ${referenced}`);
          } else if (declarations.has(referenced)) {
            visitDeclaration(referenced, nextRoute);
          }
        } else if (
          ts.isExpressionWithTypeArguments(node) &&
          ts.isIdentifier(node.expression)
        ) {
          const referenced = node.expression.text;
          if (forbiddenAliases.has(referenced)) {
            violations.add(`${nextRoute.join(" -> ")} -> ${referenced}`);
          } else if (declarations.has(referenced)) {
            visitDeclaration(referenced, nextRoute);
          }
        }

        if (ts.isPropertySignature(node) || ts.isParameter(node)) {
          const memberName =
            node.name !== undefined && ts.isIdentifier(node.name)
              ? node.name.text
              : node.name !== undefined && ts.isStringLiteral(node.name)
                ? node.name.text
                : undefined;
          if (
            memberName !== undefined &&
            rawIdentityFieldNames.has(memberName) &&
            isRawStringIdentityType(node.type)
          ) {
            violations.add(
              `${nextRoute.join(" -> ")} -> ${memberName}: ${node.type?.getText(source) ?? "<missing>"}`,
            );
          }
        }

        ts.forEachChild(node, walk);
      };

      walk(declaration);
    };

    for (const root of exportedRoots) visitDeclaration(root, []);

    expect([...violations].sort()).toEqual([]);
  });
});