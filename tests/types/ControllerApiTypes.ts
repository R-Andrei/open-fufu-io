import type {
  BuildUnitCommand,
  ControllerCommand,
  ControllerEvent,
  FactionsApi,
  HostilityMechanicsSpec,
  PersistentDirective,
  PurchasableUnitType,
  SamAntiShipAttackSpec,
  StructureAcquisitionPath,
  StructureBuildQuote,
  StructureMechanicsSpec,
  StructureView,
  TransportDestructionMechanicsSpec,
  TransportLandingCalculation,
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

const p27AntiShipAttack: SamAntiShipAttackSpec = {
  targetUnitTypes: ["TRANSPORT_SHIP", "WARSHIP"],
  damage: 250,
  rangeRule: "CURRENT_CELL_INSIDE_EFFECTIVE_SAM_RANGE",
  lineOfSightRequired: false,
  chargeConsumption: "ONE_READY_SAM_CHARGE_PER_SHOT",
  sharedChargePriority: "STRATEGIC_PROJECTILES_FIRST",
  firingCadence: "ONE_PASS_PER_TICK_SPEND_EACH_READY_CHARGE_AT_MOST_ONCE",
  batteryOrder: "ASCENDING_STABLE_STRUCTURE_ID",
  targetOrder: "TRANSPORT_THEN_DISTANCE_THEN_STABLE_UNIT_ID",
  requiresAtWar: false,
};
void p27AntiShipAttack;

const p27SamSpec: StructureMechanicsSpec = {
  type: "SAM_LAUNCHER",
  level: 3,
  chargeCapacity: 3,
  rechargeTicks: 600,
  interceptionRange: 80,
  canAttackShips: true,
  antiShipAttack: p27AntiShipAttack,
};
void p27SamSpec;

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
void p28DestructionSpec;

const n13LandingPolicy: Pick<
  TransportMechanicsSpec,
  "landingPopulationSurvivalFraction" | "landingPopulationRounding"
> = {
  landingPopulationSurvivalFraction: 0.5,
  landingPopulationRounding: "FLOOR",
};
void n13LandingPolicy;

const n13OddLanding: TransportLandingCalculation = {
  carriedPopulation: 5,
  survivalFraction: 0.5,
  survivingPopulation: 2,
  casualtyPopulation: 3,
  createsAmphibiousCommitment: true,
};
void n13OddLanding;

const n13ZeroSurvivorLanding: TransportLandingCalculation = {
  carriedPopulation: 1,
  survivalFraction: 0.5,
  survivingPopulation: 0,
  casualtyPopulation: 1,
  createsAmphibiousCommitment: false,
};
void n13ZeroSurvivorLanding;

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