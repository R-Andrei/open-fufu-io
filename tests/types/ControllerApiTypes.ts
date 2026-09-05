import type {
  BuildUnitCommand,
  ControllerCommand,
  ControllerEvent,
  FactionsApi,
  HostilityMechanicsSpec,
  PersistentDirective,
  PurchasableUnitType,
  StructureBuildQuote,
  StructureView,
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

// @ts-expect-error Patrol is deliberately not a controller command.
const patrol: ControllerCommand = { kind: "PATROL", key: "patrol-1" };
// @ts-expect-error Unit orders are deliberately not persistent directives.
const unitOrder: PersistentDirective = { kind: "UNIT_ORDER", key: "u", unitId: "x" };
void patrol;
void unitOrder;