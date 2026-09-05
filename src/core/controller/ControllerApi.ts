// Public Open Fufu controller SDK contract.
//
// Canonical documentation:
// - docs/OPEN_FUFU_DESIGN.md — controller model and high-level constraints.
// - docs/CONTROLLER_MEMORY.md — persistent controller-memory contract.
// - docs/STRATEGIC_SPAWN.md — Strategic Spawn mechanics and resolver semantics.
// - docs/TERRAIN_AND_STRUCTURES.md — structure admission/grant/capture semantics.
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
export type StructureLevel = 1 | 2 | 3 | 4 | 5;

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
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

/** Every physical mobile-unit type that may appear in legal observation. */
export type MobileUnitType =
  | "TANK"
  | "HEAVY_ARTILLERY"
  | "WARSHIP"
  | "TRANSPORT_SHIP"
  | "TRADE_SHIP"
  | "TRAIN";

/** Chassis the ordinary controller may directly purchase. */
export type PurchasableUnitType = "TANK" | "WARSHIP";

/** Units the controller may strategically reposition with MOVE_UNIT. */
export type RepositionableUnitType = "TANK" | "HEAVY_ARTILLERY" | "WARSHIP";

export type MovementClass =
  | "LAND"
  | "TANK"
  | "HEAVY_ARTILLERY"
  | "NAVAL"
  | "TRANSPORT"
  | "RAIL";

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

/**
 * Introspection for surfaced rule-bearing values that do not yet justify a
 * first-class typed field. Controllers should prefer typed MechanicsApi methods
 * whenever one exists rather than rebuilding formulas from these keys.
 */
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

export interface TerritorialContactView {
  readonly id: string;
  readonly factionA: FactionId;
  readonly factionB: FactionId;
  readonly boundaryCellCount: number;
  readonly componentCount: number;
  readonly segmentIds: readonly SegmentId[];
  readonly terrainCounts: Readonly<Partial<Record<TerrainType, number>>>;
}

export type OperationalContactKind =
  | "TERRITORIAL"
  | "LAND_COMBAT"
  | "NAVAL_ENCOUNTER"
  | "AMPHIBIOUS";

export interface OperationalContactView {
  readonly id: string;
  readonly factionA: FactionId;
  readonly factionB: FactionId;
  readonly kinds: readonly OperationalContactKind[];
  readonly area: CellSelector;
  readonly segmentIds: readonly SegmentId[];
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

export interface ChargeStateView {
  readonly ready: number;
  readonly capacity: number;
  /** One remaining-tick value for each currently recharging charge. */
  readonly rechargeRemainingTicks: readonly number[];
}

/**
 * In-progress construction state for one physical persistent structure.
 * Fresh construction may have no completed level yet. During an upgrade the
 * previous completed level may remain active while construction targets the next level.
 */
export interface StructureConstructionView {
  readonly targetLevel: StructureLevel;
  readonly remainingTicks: number;
}

export interface StructureView {
  readonly id: StructureId;
  readonly ownerId: FactionId;
  readonly type: StructureType;
  /** Last fully completed level; absent while a never-completed fresh build is in progress. */
  readonly completedLevel?: StructureLevel;
  readonly cellId: CellId;
  /** Whether this structure currently contributes its completed-level mechanics. */
  readonly active: boolean;
  /** Present while a fresh build or upgrade is still progressing. */
  readonly construction?: StructureConstructionView;
  readonly health?: number;
  readonly maxHealth?: number;
  /** Present for legally observable charge-bearing structures such as Silos/SAMs. */
  readonly chargeState?: ChargeStateView;
}

export interface UnitView {
  readonly id: UnitId;
  readonly ownerId: FactionId;
  readonly type: MobileUnitType;
  readonly cellId: CellId;
  readonly active: boolean;
  /** True only for Tank/Heavy-Artillery/Warship units the owner may MOVE_UNIT. */
  readonly repositionable: boolean;
  /** Present when a legally observable controller-issued move is still active. */
  readonly movementDestinationCellId?: CellId;
  readonly health?: number;
  readonly maxHealth?: number;
  readonly rank?: number;
  readonly carriedPopulation?: number;
  /** Present when an explicit rule makes this unit a charge-bearing launcher. */
  readonly strategicWeaponChargeState?: ChargeStateView;
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
  | {
      readonly kind: "CIRCLE";
      readonly center: CellId;
      readonly radius: number;
    }
  | { readonly kind: "UNION"; readonly selectors: readonly CellSelector[] }
  | {
      readonly kind: "INTERSECTION";
      readonly selectors: readonly CellSelector[];
    }
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
  territorial(): readonly TerritorialContactView[];
  territorialBetween(
    a: FactionId,
    b: FactionId,
  ): readonly TerritorialContactView[];
  operational(): readonly OperationalContactView[];
  operationalBetween(
    a: FactionId,
    b: FactionId,
  ): readonly OperationalContactView[];
}

export interface FactionsApi {
  get(id: FactionId): FactionView | undefined;
  list(): readonly FactionView[];
  /** Symmetric team-normalized current war state; see OPEN_FUFU_DESIGN.md. */
  atWar(a: FactionId, b: FactionId): boolean;
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
    movementClass: MovementClass,
    maxCells?: number,
  ): readonly CellId[] | undefined;
  reachable(
    from: CellId,
    movementClass: MovementClass,
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

export interface CaptureCalculation {
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly inputAttackingPressure: number;
  readonly inputDefendingPressure: number;
  readonly effectiveAttackingPressure: number;
  readonly effectiveDefendingPressure: number;
  readonly advantage: number;
  readonly acquisitionProgressMultiplier: number;
  readonly requiredProgress: number;
  readonly progressPerSecond: number;
  readonly estimatedSecondsToCapture?: number;
}

export interface SettlementCalculation {
  readonly targetCellId: CellId;
  readonly inputPressure: number;
  readonly effectivePressure: number;
  readonly acquisitionProgressMultiplier: number;
  readonly requiredProgress: number;
  readonly progressPerSecond: number;
  readonly estimatedSecondsToSettle?: number;
  readonly populationCost: number;
}

export interface CounterResponseCalculation {
  readonly attackingPopulationLost: number;
  readonly respondingPopulationLost: number;
  readonly attackEffectiveness: number;
  readonly responseEffectiveness: number;
}

export interface EffectiveActionCost {
  /** FFY that must be available for the action to satisfy affordability. */
  readonly ffyRequired: number;
  /** FFY actually consumed when the quoted action commits; zero for an illegal quote. */
  readonly ffySpent: number;
  /** Available Population permanently consumed on commit; zero for an illegal quote. */
  readonly populationSpent: number;
}

/**
 * Exact single-action result against the current immutable observation snapshot.
 * A quote is not a reservation and does not account for other actions submitted in
 * the same later decision; aggregate FFY/Population use, ownership-slot reservations,
 * or conflicting actions can therefore still make the complete atomic proposal reject.
 * When legal=false, ffySpent and populationSpent are always zero; ffyRequired may
 * remain non-zero to expose the effective affordability requirement independently.
 */
export interface ActionQuote {
  readonly legal: boolean;
  readonly failureCode?: DecisionFailureCode;
  readonly detail?: string;
  readonly cost: EffectiveActionCost;
}

export interface StructureBuildQuote extends ActionQuote {
  readonly structure: StructureType;
  readonly cellId: CellId;
  readonly resultingLevel: StructureLevel;
  readonly buildTicks: number;
  /** Effective hard ownership cap when this structure type is capped for the faction. */
  readonly ownershipCap?: number;
}

export interface StructureUpgradeQuote extends ActionQuote {
  readonly structureId: StructureId;
  readonly currentLevel: StructureLevel;
  readonly resultingLevel: StructureLevel;
  readonly buildTicks: number;
}

export interface UnitBuildQuote extends ActionQuote {
  readonly requestedUnit: PurchasableUnitType;
  readonly resultingUnit: MobileUnitType;
  readonly producerId: StructureId;
  readonly buildTicks: number;
  /** Effective hard ownership cap when this unit type is capped for the faction. */
  readonly ownershipCap?: number;
}

export interface MoveUnitQuote extends ActionQuote {
  readonly unitId: UnitId;
  readonly destination: CellId;
}

export interface TransportEmbarkQuote extends ActionQuote {
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly populationCommitted: number;
  readonly resultingUnit: "TRANSPORT_SHIP";
}

export interface WeaponLaunchQuote extends ActionQuote {
  readonly launcherId: StructureId | UnitId;
  readonly weapon: StrategicWeaponType;
  readonly targetCellId: CellId;
  readonly chargeConsumed: boolean;
}

export interface TerrainMechanicsSpec {
  readonly terrain: TerrainType;
  readonly hasFallout: boolean;
  readonly conquerable: boolean;
  readonly populationBearing: boolean;
  /** Terrain/Origin permission only; exact placement still requires a build quote. */
  readonly persistentStructureTerrainEligible: boolean;
  readonly acquisitionProgressMultiplier: number;
  readonly offensivePressureMultiplier: number;
  readonly defensivePressureMultiplier: number;
  readonly movementMultipliers: Readonly<
    Partial<Record<MovementClass, number>>
  >;
}

export type ObservationStructureEffect = "NONE" | "REVEAL" | "ENEMY_BLACKOUT";

export interface StructureMechanicsSpec {
  readonly type: StructureType;
  readonly level: StructureLevel;
  readonly populationGrowthAdditiveMultiplier?: number;
  readonly offensivePressureMultiplier?: number;
  readonly defensivePressureMultiplier?: number;
  readonly coverageRadius?: number;
  readonly repairRadius?: number;
  readonly repairRateHpPerSecond?: number;
  readonly simultaneousRepairCapacity?: number;
  readonly chargeCapacity?: number;
  readonly rechargeTicks?: number;
  readonly interceptionRange?: number;
  readonly observationRadius?: number;
  readonly observationEffect?: ObservationStructureEffect;
  readonly canAttackShips?: boolean;
  readonly weaponAccess?: readonly StrategicWeaponType[];
}

export type UnitAttackKind =
  | "DAMAGE_UNIT"
  | "DAMAGE_POPULATION"
  | "INTERCEPT_TRAIN"
  | "CAPTURE_TRADE_SHIP";

export interface UnitAttackSpec {
  readonly kind: UnitAttackKind;
  readonly rangeCells: number;
  readonly cooldownTicks?: number;
  readonly damage?: number;
  readonly targetUnitTypes?: readonly MobileUnitType[];
  /** True when this autonomous attack is legal only against a side currently atWar. */
  readonly requiresAtWar?: boolean;
}

export interface UnitMechanicsSpec {
  readonly type: MobileUnitType;
  readonly directlyPurchasable: boolean;
  readonly repositionable: boolean;
  readonly movementClass: MovementClass;
  readonly baseSpeedCellsPerSecond: number;
  readonly maxHealth?: number;
  readonly repairRetreatHealthFraction?: number;
  readonly maximumRank?: number;
  readonly attacks: readonly UnitAttackSpec[];
  /** Present when this unit type/instance is an effective strategic launcher. */
  readonly strategicWeaponAccess?: readonly StrategicWeaponType[];
  readonly strategicWeaponChargeCapacity?: number;
  readonly strategicWeaponRechargeTicks?: number;
}

export type TransportEmbarkSourceRule =
  | "OWNED_COAST_OR_SHORE"
  | "OWNED_ACTIVE_PORT";

export interface TransportMechanicsSpec {
  readonly unit: UnitMechanicsSpec;
  readonly activeOwnershipCap: number;
  readonly embarkSourceRule: TransportEmbarkSourceRule;
  readonly landingPopulationSurvivalFraction: number;
  readonly returnPopulationSurvivalFraction: number;
  /** Conditional post-landing grant contract; admission can still skip the grant. */
  readonly successfulLandingGrant?: {
    readonly structure: StructureType;
    readonly level: StructureLevel;
    readonly placement: "EXACT_LANDING_CELL";
    readonly activation: "IMMEDIATE_COMPLETED";
    readonly failurePolicy: "SKIP_GRANT_KEEP_LANDING";
  };
}

export interface StrategicWeaponMechanicsSpec {
  readonly type: StrategicWeaponType;
  readonly projectileSpeedCellsPerSecond: number;
  readonly postSeparationProjectileSpeedCellsPerSecond?: number;
  readonly separationProgressFraction?: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly maxWarheads: number;
  readonly distributionRadius?: number;
  readonly minimumWarheadSpacing?: number;
  readonly usesRemaining?: number;
  readonly waterNukesEnabled: boolean;
  readonly deepWaterCoreRadius?: number;
}

export interface HostilityMechanicsSpec {
  /** Post-directed-hostility grace period under the current ruleset. */
  readonly atWarGraceTicks: number;
}

export interface MechanicsApi {
  growth(
    population: number,
    capacity: number,
    factionId?: FactionId,
  ): GrowthCalculation;

  capture(
    sourceCellId: CellId,
    targetCellId: CellId,
    attackingPressure: number,
    defendingPressure: number,
    attackerId?: FactionId,
    defenderId?: FactionId,
  ): CaptureCalculation;

  settlement(
    targetCellId: CellId,
    pressure: number,
    factionId?: FactionId,
  ): SettlementCalculation;

  counterResponse(
    attackingPopulation: number,
    respondingPopulation: number,
    attackerId?: FactionId,
    responderId?: FactionId,
  ): CounterResponseCalculation;

  hostilitySpec(): HostilityMechanicsSpec;

  terrainSpec(
    terrain: TerrainType,
    hasFallout: boolean,
    factionId?: FactionId,
  ): TerrainMechanicsSpec;

  structureTypeSpec(
    type: StructureType,
    level: StructureLevel,
    factionId?: FactionId,
  ): StructureMechanicsSpec;
  /**
   * Effective currently active mechanics for a physical structure.
   * Fresh inactive construction has no completed mechanics yet and returns undefined;
   * an upgrade returns the previous completed level's active mechanics until completion.
   */
  structureSpec(structureId: StructureId): StructureMechanicsSpec | undefined;

  unitTypeSpec(
    type: MobileUnitType,
    factionId?: FactionId,
  ): UnitMechanicsSpec;
  unitSpec(unitId: UnitId): UnitMechanicsSpec;
  transportSpec(factionId?: FactionId): TransportMechanicsSpec;

  weaponSpec(
    type: StrategicWeaponType,
    factionId?: FactionId,
  ): StrategicWeaponMechanicsSpec;

  structureBuildQuote(
    type: StructureType,
    cellId: CellId,
    factionId?: FactionId,
  ): StructureBuildQuote;
  structureUpgradeQuote(
    structureId: StructureId,
  ): StructureUpgradeQuote;
  unitBuildQuote(
    type: PurchasableUnitType,
    producerId: StructureId,
    factionId?: FactionId,
  ): UnitBuildQuote;
  moveUnitQuote(unitId: UnitId, destination: CellId): MoveUnitQuote;
  transportEmbarkQuote(
    sourceCellId: CellId,
    targetCellId: CellId,
    population: number,
    factionId?: FactionId,
  ): TransportEmbarkQuote;
  weaponLaunchQuote(
    launcherId: StructureId | UnitId,
    type: StrategicWeaponType,
    targetCellId: CellId,
    targetFactionId?: FactionId,
  ): WeaponLaunchQuote;
}

export interface RulesView {
  readonly version: string;
  readonly values: Readonly<Record<string, number | boolean | string>>;
}

export interface ControllerLimitsView {
  readonly persistentMemoryBytes: number;
  readonly serializedDecisionBytes: number;
  readonly queriesPerDecision: number;
  readonly materializedCellsPerDecision: number;
  readonly directiveUpdatesPerDecision: number;
  readonly commandsPerDecision: number;
  readonly policyRulesPerDecision: number;
  readonly debugItemsPerDecision: number;
  readonly logBytesPerDecision: number;
  readonly eventsPerDecision: number;
  readonly teamSignalPayloadBytes: number;
}

export interface RandomApi {
  next(): number;
  keyed(key: string): number;
}

export type DecisionFailureCode =
  | "INVALID_TARGET"
  | "INVALID_SOURCE"
  | "INVALID_PRODUCER"
  | "INVALID_LAUNCHER"
  | "INSUFFICIENT_FFY"
  | "INSUFFICIENT_AVAILABLE_POPULATION"
  | "NO_LONGER_OWNED"
  | "OUT_OF_RANGE"
  | "TARGET_DESTROYED"
  | "COMMITMENT_LIMIT"
  | "OWNERSHIP_CAP"
  | "CONFLICTING_PROPOSAL"
  | "INVALID_DIRECTIVE"
  | "INVALID_COMMAND"
  | "RUNTIME_ERROR"
  | "TIMEOUT"
  | "MEMORY_LIMIT"
  | "SANDBOX_VIOLATION";

export interface DecisionFailure {
  readonly code: DecisionFailureCode;
  /** Present when one keyed command/directive is the canonical cause. */
  readonly key?: CommandKey | DirectiveKey;
  readonly detail?: string;
}

// If several game-facing conditions are invalid, the authoritative validator
// reports one failure using its versioned deterministic validation order.
// Controllers should use quotes/legality helpers rather than depend on which
// invalid condition wins that diagnostic ordering.

/**
 * Receipt for the previous normal controller decision.
 *
 * Game-facing directives and commands form one atomic proposal evaluated against
 * the same authoritative pre-decision snapshot. accepted=true means the complete
 * proposal committed. accepted=false means none of its game-facing changes did.
 * A successfully validated memory replacement commits independently as defined by
 * docs/CONTROLLER_MEMORY.md.
 */
export interface DecisionReceipt {
  readonly decisionNumber: number;
  readonly accepted: boolean;
  readonly failure?: DecisionFailure;
  /** Total normal-runtime faults accumulated so far in this match. */
  readonly faultCount: number;
  /** True once the runtime circuit breaker has faulted the controller for the match. */
  readonly faulted: boolean;
}

export type ControllerEvent =
  | {
      readonly type: "CELL_CAPTURED";
      readonly cellId: CellId;
      readonly byFactionId: FactionId;
    }
  | {
      readonly type: "POPULATION_CHANGED";
      readonly delta: number;
      readonly reason: string;
    }
  | {
      readonly type: "FFY_CHANGED";
      readonly delta: number;
      readonly reason: string;
    }
  | {
      readonly type: "STRUCTURE_CHANGED";
      readonly structureId: StructureId;
      readonly reason: string;
    }
  | {
      readonly type: "UNIT_CHANGED";
      readonly unitId: UnitId;
      readonly reason: string;
    }
  | {
      readonly type: "OPERATION_CHANGED";
      readonly operationId: OperationId;
      readonly reason: string;
    }
  | {
      readonly type: "WAR_STATE_CHANGED";
      readonly factionAId: FactionId;
      readonly factionBId: FactionId;
      readonly atWar: boolean;
    }
  | {
      readonly type: "FACTION_STATUS_CHANGED";
      readonly factionId: FactionId;
      readonly status: FactionStatus;
    }
  | {
      readonly type: "STRATEGIC_WEAPON";
      readonly weapon: StrategicWeaponType;
      readonly cellId: CellId;
      readonly reason: string;
    }
  | {
      readonly type: "TEAM_SIGNAL_RECEIVED";
      readonly fromFactionId: FactionId;
      readonly channel: string;
      readonly payload: JsonValue;
    };

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

export interface DebugMetric {
  readonly kind: "METRIC";
  readonly name: string;
  readonly value: number | string | boolean;
}

export type DebugSubject =
  | { readonly kind: "FACTION"; readonly id: FactionId }
  | { readonly kind: "SEGMENT"; readonly id: SegmentId }
  | { readonly kind: "OPERATION"; readonly id: OperationId }
  | { readonly kind: "UNIT"; readonly id: UnitId }
  | { readonly kind: "STRUCTURE"; readonly id: StructureId }
  | { readonly kind: "CELL"; readonly id: CellId };

export interface DebugAnnotation {
  readonly kind: "ANNOTATION";
  readonly subject: DebugSubject;
  readonly label: string;
  readonly value?: number | string | boolean;
}

export type DebugItem =
  | DebugPoint
  | DebugLine
  | DebugRegion
  | DebugMetric
  | DebugAnnotation;

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

export type PersistentDirective =
  | LandOperationDirective
  | DefensePriorityDirective
  | CounterResponseDirective;

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
  readonly unit: PurchasableUnitType;
  readonly producerId: StructureId;
}

/**
 * Strategic repositioning only. Once moving/arrived, autonomous unit logic owns
 * roaming, target acquisition, pursuit, firing/capture/interception, and repair
 * retreat. No patrol/raid/target-unit controller modes exist in V1. MOVE_UNIT
 * does not itself create or refresh atWar.
 */
export interface MoveUnitCommand {
  readonly kind: "MOVE_UNIT";
  readonly key: CommandKey;
  readonly unitId: UnitId;
  readonly destination: CellId;
}

/**
 * Creates one Transport operation carrying the committed Population from a legal
 * embark source toward a legal landing target. Pathing and landing are autonomous.
 * A hostile accepted target is direct hostility under the game-wide atWar rules.
 */
export interface EmbarkTransportCommand {
  readonly kind: "EMBARK_TRANSPORT";
  readonly key: CommandKey;
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly population: number;
}

/** Abort an active owned Transport and return it by autonomous legal routing. */
export interface ReturnTransportCommand {
  readonly kind: "RETURN_TRANSPORT";
  readonly key: CommandKey;
  readonly unitId: UnitId;
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

/**
 * Broadcasts a bounded deterministic signal to legal fixed teammates. An
 * accepted signal is never observable during the sending invocation; recipients
 * may observe it no earlier than their next eligible controller decision.
 */
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
  | MoveUnitCommand
  | EmbarkTransportCommand
  | ReturnTransportCommand
  | LaunchWeaponCommand
  | RelinquishCommand
  | TeamSignalCommand
  | CapitulateCommand;

/**
 * One normal callback result.
 *
 * memory is validated/committed under the separate Controller Memory contract.
 * directives + commands are one atomic game-facing proposal. If any game-facing
 * part is illegal, none of those game-facing changes commit. debug/log are
 * diagnostics and do not create simulation state.
 */
export interface ControllerDecision<
  M extends ControllerMemory = ControllerMemory,
> {
  readonly memory?: M;
  readonly directives?: DirectiveChanges;
  readonly commands?: readonly ControllerCommand[];
  readonly debug?: readonly DebugItem[];
  readonly log?: string;
}

export interface ControllerContext<
  M extends ControllerMemory = ControllerMemory,
> {
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

export type SpawnOriginValidationCode =
  | "WRONG_ORIGIN_COUNT"
  | "INVALID_CELL"
  | "OUTSIDE_INFLUENCE"
  | "SPAWN_INELIGIBLE"
  | "DUPLICATE_ORIGIN";

export interface SpawnOriginValidation {
  readonly valid: boolean;
  readonly code?: SpawnOriginValidationCode;
  readonly slotIndex?: number;
}

/**
 * Local Phase-3 validation only. Foreign exact-origin spacing/conflict acceptance
 * cannot be predicted here because all factions resolve simultaneously.
 */
export interface SpawnOriginApi {
  isValidOriginChoice(cellId: CellId, slotIndex: number): boolean;
  validateOriginChoices(origins: readonly CellId[]): SpawnOriginValidation;
}

export interface SpawnBaseContext<
  M extends ControllerMemory = ControllerMemory,
> {
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

export interface SpawnInfluenceContext<
  M extends ControllerMemory = ControllerMemory,
> extends SpawnBaseContext<M> {
  readonly phase: "INFLUENCE";
}

export interface SpawnReconsiderContext<
  M extends ControllerMemory = ControllerMemory,
> extends SpawnBaseContext<M> {
  readonly phase: "RECONSIDER";
  readonly currentInfluenceCenters: readonly CellId[];
  readonly revealedFactions: readonly SpawnFactionView[];
}

export interface SpawnOriginContext<
  M extends ControllerMemory = ControllerMemory,
> extends SpawnBaseContext<M> {
  readonly phase: "ORIGIN";
  readonly influenceCenters: readonly CellId[];
  readonly revealedFactions: readonly SpawnFactionView[];
  readonly spawn: SpawnOriginApi;
}

export interface SpawnInfluenceDecision<
  M extends ControllerMemory = ControllerMemory,
> {
  readonly centers: readonly CellId[];
  readonly memory?: M;
  readonly debug?: readonly DebugItem[];
  readonly log?: string;
}

export interface SpawnOriginDecision<
  M extends ControllerMemory = ControllerMemory,
> {
  readonly origins: readonly CellId[];
  readonly memory?: M;
  readonly debug?: readonly DebugItem[];
  readonly log?: string;
}

/**
 * V1 player-controller entry contract.
 *
 * All callbacks execute against immutable deterministic snapshots. Normal
 * directives/commands form one atomic game-facing proposal. Omitted persistent
 * directives remain active until explicitly ended. Module/global state is not
 * guaranteed to survive between callbacks; use explicit controller memory.
 *
 * The three spawn callbacks are invoked only for Strategic Spawn. Random and
 * Fixed Spawn bypass player-controller spawn choice hooks entirely.
 */
export interface OpenFufuController<
  M extends ControllerMemory = ControllerMemory,
> {
  chooseInfluence?(
    context: SpawnInfluenceContext<M>,
  ): SpawnInfluenceDecision<M> | void;

  reconsiderInfluence?(
    context: SpawnReconsiderContext<M>,
  ): SpawnInfluenceDecision<M> | void;

  chooseOrigins?(context: SpawnOriginContext<M>): SpawnOriginDecision<M> | void;

  decide(context: ControllerContext<M>): ControllerDecision<M> | void;
}