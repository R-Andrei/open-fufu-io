// Public Open Fufu controller SDK contract.
//
// This file deliberately does not expose inherited mutable Game/Player/Unit/
// Execution internals. Runtime adapters must project legal immutable observations
// into these types and validate returned decisions transactionally.

export type Tick = number;
export type CellId = number;
export type SegmentId = number;
export type FactionId = string;
export type OperationId = string;
export type UnitId = string;
export type StructureId = string;
export type DirectiveKey = string;
export type CommandKey = string;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type ControllerMemory = { [key: string]: JsonValue };

export type FactionStatus = "ACTIVE" | "CAPITULATED" | "DEFEATED";
export type TerrainType =
  | "PLAINS"
  | "HIGHLAND"
  | "MOUNTAIN"
  | "DESERT"
  | "FOREST"
  | "TUNDRA"
  | "MARSH"
  | "SHALLOW_WATER"
  | "DEEP_WATER"
  | "IMPASSABLE";

export type StructureType =
  | "CITY"
  | "FORT"
  | "PORT"
  | "FACTORY"
  | "MISSILE_SILO"
  | "SAM_LAUNCHER"
  | "OBSERVATION_POST"
  | "COMMAND_POST";

export type MobileUnitType =
  | "TANK"
  | "HEAVY_ARTILLERY"
  | "WARSHIP"
  | "TRANSPORT_SHIP"
  | "TRADE_SHIP"
  | "TRAIN";

export type StrategicWeaponType = "ATOM_BOMB" | "HYDROGEN_BOMB" | "MIRV";

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface GameView {
  readonly matchId: string;
  readonly tick: Tick;
  readonly decisionNumber: number;
  readonly ticksPerSecond: number;
  readonly decisionEveryTicks: number;
  readonly mapId: string;
  readonly mapVersion: string;
  readonly rulesetVersion: string;
  readonly controllerApiVersion: string;
  readonly spawnMode: "STRATEGIC" | "RANDOM" | "FIXED";
}

export interface PopulationView {
  readonly total: number;
  readonly available: number;
  readonly committedOffense: number;
  readonly committedCounterResponse: number;
  readonly aboardTransports: number;
  readonly capacity: number;
  readonly growthPerSecond: number;
  readonly utilization: number;
}

export interface OriginView {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly positiveTraitIds: readonly string[];
  readonly negativeTraitIds: readonly string[];
}

export type ModifierValue = number | boolean | string;

export interface EffectiveModifierSheet {
  readonly values: Readonly<Record<string, ModifierValue>>;
}

export interface FactionView {
  readonly id: FactionId;
  readonly displayName: string;
  readonly status: FactionStatus;
  readonly teamId?: string;
  readonly isMinorFaction: boolean;
  readonly origin?: OriginView;
  readonly effectiveModifiers: EffectiveModifierSheet;
  readonly territoryCells?: number;
  readonly population?: number;
  readonly capacity?: number;
  readonly ffy?: number;
}

export interface SelfFactionView extends FactionView {
  readonly isMinorFaction: false;
  readonly origin: OriginView;
  readonly populationState: PopulationView;
  readonly ffy: number;
}

export interface CellView {
  readonly id: CellId;
  readonly position: MapPoint;
  readonly terrain: TerrainType;
  readonly hasFallout: boolean;
  readonly conquerable: boolean;
  readonly populationBearing: boolean;
  readonly ownerId?: FactionId;
  readonly segmentId?: SegmentId;
  readonly isCoast: boolean;
  readonly isShoreline: boolean;
}

export interface SegmentView {
  readonly id: SegmentId;
  readonly cellCount: number;
  readonly populationBearingCellCount: number;
  readonly ownerShares: Readonly<Record<FactionId, number>>;
  readonly adjacentSegmentIds: readonly SegmentId[];
  readonly terrainCounts: Readonly<Partial<Record<TerrainType, number>>>;
}

export interface ContactView {
  readonly id: string;
  readonly factionA: FactionId;
  readonly factionB: FactionId;
  readonly boundaryCellCount: number;
  readonly componentCount: number;
  readonly segmentIds: readonly SegmentId[];
  readonly terrainCounts: Readonly<Partial<Record<TerrainType, number>>>;
}

export type OperationKind = "ATTACK" | "NEUTRAL_EXPANSION" | "COUNTER_RESPONSE";
export type OperationStatus = "ACTIVE" | "STALLED" | "ENDING" | "ENDED";

export interface OperationView {
  readonly id: OperationId;
  readonly controllerKey?: DirectiveKey;
  readonly kind: OperationKind;
  readonly ownerId: FactionId;
  readonly targetFactionId?: FactionId;
  readonly committedPopulation: number;
  readonly status: OperationStatus;
  readonly source: CellSelector;
  readonly target: CellSelector;
}

export interface StructureView {
  readonly id: StructureId;
  readonly ownerId: FactionId;
  readonly type: StructureType;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly cellId: CellId;
  readonly active: boolean;
  readonly constructionRemainingTicks?: number;
  readonly health?: number;
  readonly maxHealth?: number;
}

export interface UnitView {
  readonly id: UnitId;
  readonly ownerId: FactionId;
  readonly type: MobileUnitType;
  readonly cellId: CellId;
  readonly active: boolean;
  readonly health?: number;
  readonly maxHealth?: number;
  readonly rank?: number;
  readonly carriedPopulation?: number;
}

export type CellSelector =
  | { readonly kind: "CELLS"; readonly ids: readonly CellId[] }
  | { readonly kind: "OWNER"; readonly factionId?: FactionId }
  | { readonly kind: "SEGMENT"; readonly segmentId: SegmentId }
  | { readonly kind: "TERRAIN"; readonly terrain: TerrainType }
  | { readonly kind: "FALLOUT"; readonly value: boolean }
  | { readonly kind: "POPULATION_BEARING"; readonly value: boolean }
  | { readonly kind: "CONQUERABLE"; readonly value: boolean }
  | { readonly kind: "COAST"; readonly value: boolean }
  | { readonly kind: "SHORELINE"; readonly value: boolean }
  | { readonly kind: "CIRCLE"; readonly center: CellId; readonly radius: number }
  | { readonly kind: "UNION"; readonly selectors: readonly CellSelector[] }
  | { readonly kind: "INTERSECTION"; readonly selectors: readonly CellSelector[] }
  | {
      readonly kind: "DIFFERENCE";
      readonly left: CellSelector;
      readonly right: CellSelector;
    };

export interface WeightRule {
  readonly selector: CellSelector;
  readonly weight: number;
}

export interface SpatialPolicy {
  readonly defaultWeight?: number;
  readonly rules?: readonly WeightRule[];
}

export interface QueryPage<T> {
  readonly items: readonly T[];
  readonly truncated: boolean;
}

export interface CellsApi {
  get(id: CellId): CellView | undefined;
  query(selector: CellSelector, limit?: number): QueryPage<CellView>;
  count(selector: CellSelector): number;
  neighbors(id: CellId): readonly CellId[];
  boundary(selector: CellSelector, limit?: number): QueryPage<CellView>;
  connectedComponents(
    selector: CellSelector,
    limit?: number,
  ): readonly CellSelector[];
  distance(a: CellId, b: CellId): number;
}

export interface SegmentsApi {
  get(id: SegmentId): SegmentView | undefined;
  list(): readonly SegmentView[];
  cells(id: SegmentId): CellSelector;
}

export interface ContactsApi {
  list(): readonly ContactView[];
  between(a: FactionId, b: FactionId): readonly ContactView[];
}

export interface FactionsApi {
  get(id: FactionId): FactionView | undefined;
  list(): readonly FactionView[];
}

export interface OperationsApi {
  get(id: OperationId): OperationView | undefined;
  own(): readonly OperationView[];
  incoming(): readonly OperationView[];
}

export interface StructuresApi {
  get(id: StructureId): StructureView | undefined;
  list(ownerId?: FactionId): readonly StructureView[];
}

export interface UnitsApi {
  get(id: UnitId): UnitView | undefined;
  list(ownerId?: FactionId): readonly UnitView[];
}

export interface NavigationApi {
  path(
    from: CellId,
    to: CellId,
    movementClass: "LAND" | "TANK" | "HEAVY_ARTILLERY" | "NAVAL" | "TRANSPORT",
    maxCells?: number,
  ): readonly CellId[] | undefined;
  reachable(
    from: CellId,
    movementClass: "LAND" | "TANK" | "HEAVY_ARTILLERY" | "NAVAL" | "TRANSPORT",
    maxDistance: number,
  ): CellSelector;
}

export interface EconomyView {
  readonly ffy: number;
  readonly passiveFfyPerSecond: number;
}

export interface GrowthCalculation {
  readonly capacity: number;
  readonly population: number;
  readonly utilization: number;
  readonly growthPerSecond: number;
}

export interface CounterResponseCalculation {
  readonly attackingPopulationLost: number;
  readonly respondingPopulationLost: number;
}

export interface MechanicsApi {
  growth(population: number, capacity: number, factionId?: FactionId): GrowthCalculation;
  captureAdvantage(attackingPressure: number, defendingPressure: number): number;
  counterResponse(
    attackingPopulation: number,
    respondingPopulation: number,
    attackerId?: FactionId,
    responderId?: FactionId,
  ): CounterResponseCalculation;
  settlementPopulationCost(cellId: CellId, factionId?: FactionId): number;
  structureCost(type: StructureType, level: 1 | 2 | 3 | 4 | 5, factionId?: FactionId): number;
  structureBuildTicks(type: StructureType, level: 1 | 2 | 3 | 4 | 5): number;
  unitCost(type: MobileUnitType, factionId?: FactionId): number;
  weaponCost(type: StrategicWeaponType, factionId?: FactionId): number;
  canBuildStructure(type: StructureType, cellId: CellId, factionId?: FactionId): boolean;
  canMoveUnit(unitId: UnitId, targetCellId: CellId): boolean;
  canLaunchWeapon(
    launcherId: StructureId | UnitId,
    type: StrategicWeaponType,
    targetCellId: CellId,
  ): boolean;
}

export interface RulesView {
  readonly version: string;
  readonly values: Readonly<Record<string, number | boolean | string>>;
}

export interface ControllerLimitsView {
  readonly persistentMemoryBytes: number;
  readonly queriesPerDecision: number;
  readonly materializedCellsPerDecision: number;
  readonly directiveUpdatesPerDecision: number;
  readonly commandsPerDecision: number;
  readonly policyRulesPerDecision: number;
  readonly debugItemsPerDecision: number;
  readonly logBytesPerDecision: number;
}

export interface RandomApi {
  next(): number;
  keyed(key: string): number;
}

export type DecisionFailureCode =
  | "INVALID_TARGET"
  | "INSUFFICIENT_FFY"
  | "INSUFFICIENT_AVAILABLE_POPULATION"
  | "NO_LONGER_OWNED"
  | "OUT_OF_RANGE"
  | "TARGET_DESTROYED"
  | "COMMITMENT_LIMIT"
  | "INVALID_DIRECTIVE"
  | "INVALID_COMMAND"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "MEMORY_LIMIT"
  | "SANDBOX_VIOLATION";

export interface CommandReceipt {
  readonly key: CommandKey;
  readonly accepted: boolean;
  readonly code?: DecisionFailureCode;
  readonly detail?: string;
}

export interface DecisionReceipt {
  readonly decisionNumber: number;
  readonly accepted: boolean;
  readonly code?: DecisionFailureCode;
  readonly commands: readonly CommandReceipt[];
  readonly faultCount: number;
  readonly faulted: boolean;
}

export type ControllerEvent =
  | { readonly type: "CELL_CAPTURED"; readonly cellId: CellId; readonly byFactionId: FactionId }
  | { readonly type: "POPULATION_CHANGED"; readonly delta: number; readonly reason: string }
  | { readonly type: "FFY_CHANGED"; readonly delta: number; readonly reason: string }
  | { readonly type: "STRUCTURE_CHANGED"; readonly structureId: StructureId; readonly reason: string }
  | { readonly type: "UNIT_CHANGED"; readonly unitId: UnitId; readonly reason: string }
  | { readonly type: "OPERATION_CHANGED"; readonly operationId: OperationId; readonly reason: string }
  | { readonly type: "HOSTILITY_CHANGED"; readonly factionId: FactionId; readonly hostile: boolean }
  | { readonly type: "FACTION_STATUS_CHANGED"; readonly factionId: FactionId; readonly status: FactionStatus }
  | { readonly type: "STRATEGIC_WEAPON"; readonly weapon: StrategicWeaponType; readonly cellId: CellId; readonly reason: string };

export interface EventsApi {
  readonly sinceLastDecision: readonly ControllerEvent[];
}

export interface DebugPoint {
  readonly kind: "POINT";
  readonly cellId: CellId;
  readonly label?: string;
}

export interface DebugLine {
  readonly kind: "LINE";
  readonly from: CellId;
  readonly to: CellId;
  readonly label?: string;
}

export interface DebugRegion {
  readonly kind: "REGION";
  readonly selector: CellSelector;
  readonly label?: string;
}

export type DebugItem = DebugPoint | DebugLine | DebugRegion;

export interface LandOperationDirective {
  readonly kind: "LAND_OPERATION";
  readonly key: DirectiveKey;
  readonly operation: "ATTACK" | "NEUTRAL_EXPANSION";
  readonly population: number;
  readonly targetFactionId?: FactionId;
  readonly source: CellSelector;
  readonly target: CellSelector;
  readonly engagementPriority?: SpatialPolicy;
  readonly pressureWeight?: SpatialPolicy;
}

export interface DefensePriorityDirective {
  readonly kind: "DEFENSE_PRIORITY";
  readonly key: DirectiveKey;
  readonly priority: SpatialPolicy;
}

export interface CounterResponseDirective {
  readonly kind: "COUNTER_RESPONSE";
  readonly key: DirectiveKey;
  readonly incomingOperationId: OperationId;
  readonly population: number;
}

export type UnitOrder =
  | { readonly kind: "MOVE"; readonly destination: CellId }
  | { readonly kind: "PATROL"; readonly region: CellSelector }
  | { readonly kind: "RAID"; readonly region: CellSelector }
  | { readonly kind: "TARGET_UNIT"; readonly unitId: UnitId };

export interface UnitOrderDirective {
  readonly kind: "UNIT_ORDER";
  readonly key: DirectiveKey;
  readonly unitId: UnitId;
  readonly order: UnitOrder;
}

export type PersistentDirective =
  | LandOperationDirective
  | DefensePriorityDirective
  | CounterResponseDirective
  | UnitOrderDirective;

export interface DirectiveChanges {
  readonly set?: readonly PersistentDirective[];
  readonly end?: readonly DirectiveKey[];
}

export interface BuildStructureCommand {
  readonly kind: "BUILD_STRUCTURE";
  readonly key: CommandKey;
  readonly structure: StructureType;
  readonly cellId: CellId;
}

export interface UpgradeStructureCommand {
  readonly kind: "UPGRADE_STRUCTURE";
  readonly key: CommandKey;
  readonly structureId: StructureId;
}

export interface BuildUnitCommand {
  readonly kind: "BUILD_UNIT";
  readonly key: CommandKey;
  readonly unit: MobileUnitType;
  readonly producerId?: StructureId;
  readonly cellId?: CellId;
  readonly population?: number;
}

export interface LaunchWeaponCommand {
  readonly kind: "LAUNCH_WEAPON";
  readonly key: CommandKey;
  readonly launcherId: StructureId | UnitId;
  readonly weapon: StrategicWeaponType;
  readonly targetCellId: CellId;
  readonly targetFactionId?: FactionId;
}

export interface RelinquishCommand {
  readonly kind: "RELINQUISH";
  readonly key: CommandKey;
  readonly cells: CellSelector;
}

export interface TeamSignalCommand {
  readonly kind: "TEAM_SIGNAL";
  readonly key: CommandKey;
  readonly channel: string;
  readonly payload: JsonValue;
}

export interface CapitulateCommand {
  readonly kind: "CAPITULATE";
  readonly key: CommandKey;
}

export type ControllerCommand =
  | BuildStructureCommand
  | UpgradeStructureCommand
  | BuildUnitCommand
  | LaunchWeaponCommand
  | RelinquishCommand
  | TeamSignalCommand
  | CapitulateCommand;

export interface ControllerDecision<M extends ControllerMemory = ControllerMemory> {
  readonly memory?: M;
  readonly directives?: DirectiveChanges;
  readonly commands?: readonly ControllerCommand[];
  readonly debug?: readonly DebugItem[];
  readonly log?: string;
}

export interface ControllerContext<M extends ControllerMemory = ControllerMemory> {
  readonly game: GameView;
  readonly me: SelfFactionView;
  readonly factions: FactionsApi;
  readonly cells: CellsApi;
  readonly segments: SegmentsApi;
  readonly contacts: ContactsApi;
  readonly operations: OperationsApi;
  readonly structures: StructuresApi;
  readonly units: UnitsApi;
  readonly navigation: NavigationApi;
  readonly economy: EconomyView;
  readonly rules: RulesView;
  readonly mechanics: MechanicsApi;
  readonly events: EventsApi;
  readonly lastDecision?: DecisionReceipt;
  readonly random: RandomApi;
  readonly limits: ControllerLimitsView;
  readonly memory: Readonly<M>;
}

export interface SpawnProfileView {
  readonly influenceSlotCount: number;
  readonly exactOriginCount: number;
  readonly influenceAreaCells: readonly number[];
  readonly initialTerritoryPopulationBearingCells: number;
  readonly footprintShape: "COMPACT" | "STAR";
}

export interface SpawnFactionView {
  readonly id: FactionId;
  readonly displayName: string;
  readonly influenceCenters: readonly CellId[];
}

export interface SpawnBaseContext<M extends ControllerMemory = ControllerMemory> {
  readonly game: GameView;
  readonly me: SelfFactionView;
  readonly cells: CellsApi;
  readonly rules: RulesView;
  readonly mechanics: MechanicsApi;
  readonly random: RandomApi;
  readonly limits: ControllerLimitsView;
  readonly memory: Readonly<M>;
  readonly profile: SpawnProfileView;
}

export interface SpawnInfluenceContext<M extends ControllerMemory = ControllerMemory>
  extends SpawnBaseContext<M> {
  readonly phase: "INFLUENCE";
}

export interface SpawnReconsiderContext<M extends ControllerMemory = ControllerMemory>
  extends SpawnBaseContext<M> {
  readonly phase: "RECONSIDER";
  readonly currentInfluenceCenters: readonly CellId[];
  readonly revealedFactions: readonly SpawnFactionView[];
}

export interface SpawnOriginContext<M extends ControllerMemory = ControllerMemory>
  extends SpawnBaseContext<M> {
  readonly phase: "ORIGIN";
  readonly influenceCenters: readonly CellId[];
  readonly revealedFactions: readonly SpawnFactionView[];
}

export interface SpawnInfluenceDecision<M extends ControllerMemory = ControllerMemory> {
  readonly centers: readonly CellId[];
  readonly memory?: M;
  readonly debug?: readonly DebugItem[];
  readonly log?: string;
}

export interface SpawnOriginDecision<M extends ControllerMemory = ControllerMemory> {
  readonly origins: readonly CellId[];
  readonly memory?: M;
  readonly debug?: readonly DebugItem[];
  readonly log?: string;
}

/**
 * V1 player-controller entry contract.
 *
 * All callbacks execute against immutable deterministic snapshots. Returned
 * changes are proposals only; the authoritative match validates and commits
 * them transactionally. Omitted persistent directives remain active until
 * explicitly ended. Module/global state is not guaranteed to survive between
 * callbacks; use the explicit JSON-like memory object instead.
 */
export interface OpenFufuController<M extends ControllerMemory = ControllerMemory> {
  chooseInfluence?(
    context: SpawnInfluenceContext<M>,
  ): SpawnInfluenceDecision<M> | void;

  reconsiderInfluence?(
    context: SpawnReconsiderContext<M>,
  ): SpawnInfluenceDecision<M> | void;

  chooseOrigins?(context: SpawnOriginContext<M>): SpawnOriginDecision<M> | void;

  decide(context: ControllerContext<M>): ControllerDecision<M> | void;
}
