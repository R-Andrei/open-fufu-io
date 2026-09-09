import type {
  BuildUnitCommand,
  CellId,
  ControllerCommand,
  ControllerContext,
  ControllerEvent,
  FactionId,
  FactionsApi,
  HostilityMechanicsSpec,
  MapPoint,
  PersistentDirective,
  PurchasableUnitType,
  SegmentId,
  StructureAcquisitionPath,
  StructureBuildQuote,
  StructureMechanicsSpec,
  StructureView,
  TerrainType,
  TransportMechanicsSpec,
  UnitAttackSpec,
} from "../../src/core/controller/ControllerApi";

const tank: PurchasableUnitType = "TANK";
const warship: PurchasableUnitType = "WARSHIP";
void tank;
void warship;

// @ts-expect-error Heavy Artillery is a transformed Tank chassis, not directly purchasable.
const heavy: PurchasableUnitType = "HEAVY_ARTILLERY";
// @ts-expect-error Trains are simulation-owned.
const train: PurchasableUnitType = "TRAIN";
// @ts-expect-error Trade Ships are simulation-owned.
const trade: PurchasableUnitType = "TRADE_SHIP";
void heavy;
void train;
void trade;

const buildTank: BuildUnitCommand = {
  kind: "BUILD_UNIT",
  key: "build-tank",
  unit: "TANK",
  producerId: "factory-1",
};
void buildTank;

const capturedFactoryPath: StructureAcquisitionPath = "CAPTURE_TRANSFER";
void capturedFactoryPath;

const conqueredFactorySpec: StructureMechanicsSpec = {
  type: "FACTORY",
  level: 1,
  repairRadius: 8,
  repairRateHpPerSecond: 150,
  simultaneousRepairCapacity: 1,
  trainEventBaseValueMultiplier: 1.5,
  tankConstructionSpeedMultiplier: 1.5,
};
void conqueredFactorySpec;

const cappedStructureQuote: StructureBuildQuote = {
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
void cappedStructureQuote;

const freeFirstPurchaseQuote: StructureBuildQuote = {
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
void freeFirstPurchaseQuote;

const freshDirectLevel5City: StructureView = {
  id: "city-p41",
  ownerId: "faction-a",
  type: "CITY",
  cellId: 43,
  active: false,
  construction: {
    targetLevel: 5,
    remainingTicks: 25,
  },
};
void freshDirectLevel5City;

const upgradingCity: StructureView = {
  id: "city-upgrading",
  ownerId: "faction-a",
  type: "CITY",
  completedLevel: 2,
  cellId: 44,
  active: true,
  construction: {
    targetLevel: 3,
    remainingTicks: 20,
  },
};
void upgradingCity;

const landingGrant: NonNullable<TransportMechanicsSpec["successfulLandingGrant"]> = {
  structure: "FORT",
  level: 1,
  placement: "EXACT_LANDING_CELL",
  activation: "IMMEDIATE_COMPLETED",
  failurePolicy: "SKIP_GRANT_KEEP_LANDING",
};
void landingGrant;

const move: ControllerCommand = {
  kind: "MOVE_UNIT",
  key: "move-1",
  unitId: "unit-1",
  destination: 42,
};
void move;

const embark: ControllerCommand = {
  kind: "EMBARK_TRANSPORT",
  key: "transport-1",
  sourceCellId: 10,
  targetCellId: 20,
  population: 100,
};
void embark;

const warQuery = (factions: FactionsApi): boolean =>
  factions.atWar("faction-a", "faction-b");
void warQuery;

const hostilitySpec: HostilityMechanicsSpec = {
  atWarGraceTicks: 600,
};
void hostilitySpec;

const populationAttack: UnitAttackSpec = {
  kind: "DAMAGE_POPULATION",
  rangeCells: 30,
  cooldownTicks: 30,
  damage: 250,
  requiresAtWar: true,
};
void populationAttack;

const warChanged: ControllerEvent = {
  type: "WAR_STATE_CHANGED",
  factionAId: "faction-a",
  factionBId: "faction-b",
  atWar: true,
};
void warChanged;

// #105: every map cell is locally addressable and ordinary static/public facts do
// not require an authoritative query. Political ownership is public; null means
// neutral and undefined means an invalid CellId. Segment CellIds are local indexed
// facts, while connectedComponents is intentionally absent from the V1 contract.
declare const issue105Context: ControllerContext;
const issue105Width: number = issue105Context.map.width;
const issue105Height: number = issue105Context.map.height;
const issue105CellCount: number = issue105Context.map.cellCount;
const issue105ValidCell: boolean = issue105Context.map.isValidCellId(0);
const issue105CellAt: CellId | undefined = issue105Context.map.cellIdAt(0, 0);
const issue105Position: Readonly<MapPoint> | undefined =
  issue105Context.map.positionOf(0);
const issue105Terrain: TerrainType | undefined = issue105Context.map.terrainAt(0);
const issue105Segment: SegmentId | undefined = issue105Context.map.segmentIdOf(0);
const issue105Neighbors: readonly CellId[] | undefined =
  issue105Context.map.cardinalNeighbors(0);
const issue105Owner: FactionId | null | undefined = issue105Context.cells.owner(0);
const issue105SegmentCellIds: readonly CellId[] | undefined =
  issue105Context.segments.cellIds(0);
// @ts-expect-error Dynamic connected-component enumeration is intentionally not a V1 API.
issue105Context.cells.connectedComponents({ kind: "CELLS", ids: [0] });
void issue105Width;
void issue105Height;
void issue105CellCount;
void issue105ValidCell;
void issue105CellAt;
void issue105Position;
void issue105Terrain;
void issue105Segment;
void issue105Neighbors;
void issue105Owner;
void issue105SegmentCellIds;

// @ts-expect-error Patrol is deliberately not a controller command.
const patrol: ControllerCommand = { kind: "PATROL", key: "patrol-1" };
// @ts-expect-error Unit orders are deliberately not persistent directives.
const unitOrder: PersistentDirective = { kind: "UNIT_ORDER", key: "u", unitId: "x" };
void patrol;
void unitOrder;