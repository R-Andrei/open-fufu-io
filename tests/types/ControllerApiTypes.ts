import type {
  BuildUnitCommand,
  ControllerCommand,
  PersistentDirective,
  PurchasableUnitType,
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

// @ts-expect-error Patrol is deliberately not a controller command.
const patrol: ControllerCommand = { kind: "PATROL", key: "patrol-1" };
// @ts-expect-error Unit orders are deliberately not persistent directives.
const unitOrder: PersistentDirective = { kind: "UNIT_ORDER", key: "u", unitId: "x" };
void patrol;
void unitOrder;
