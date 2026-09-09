import path from "node:path";
import * as ts from "typescript";
import type {
  CaptureCalculation,
  GrowthCalculation,
  MechanicsApi,
  PopulationView,
  RelinquishQuote,
  SpawnInfluenceContext,
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

const issue47RelinquishFromMechanics: ReturnType<MechanicsApi["relinquishQuote"]> =
  issue47RelinquishQuote;
void issue47RelinquishFromMechanics;

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
  return parsed.options;
}

describe("Open Fufu Controller API contract", () => {
  it("typechecks the owned contract fixtures without compiling inherited application code", () => {
    const options = compilerOptions();
    const fixturePaths = [
      path.resolve("tests/ControllerApiContract.test.ts"),
      path.resolve("tests/types/ControllerApiTypes.ts"),
    ];
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

const p27SamField: CellSelector = {
  kind: "STRUCTURE_FIELD_INSTANCE",
  structureId: "sam-p27",
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
const activeSam = context.structures
  .list(context.me.id)
  .find((structure) => structure.type === "SAM_LAUNCHER" && structure.active);
const antiShipCoveredCells =
  activeSam && samSpec.antiShipAttack
    ? context.cells.count({
        kind: "STRUCTURE_FIELD_INSTANCE",
        structureId: activeSam.id,
        field: samSpec.antiShipAttack.eligibilityField,
      })
    : 0;
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
  FactionId,
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
const owner: FactionId | null | undefined = context.cells.owner(0);
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
    const owner: FactionId | null | undefined =
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
      commands: [],
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
});