import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  reducedRational,
  ruleScopeMatches,
  selectRuleContributionsForScope,
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { tryDebitFfy, type ExactFfyValue } from "./Economy";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  createMobileUnit,
  type MobileUnitCollectionState,
} from "./MobileUnits";
import { createNavigation, type NavigationTraversalPolicy } from "./Navigation";
import { removePopulation, type PopulationState } from "./Population";
import type { SimulationMap, SimulationTerrain } from "./SimulationMap";
import type { PersistentStructureState } from "./Structures";

export type TankChassisType = "TANK" | "HEAVY_ARTILLERY";

export interface TankExactHealth {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface TankOperationalState {
  readonly unitId: string;
  readonly health: TankExactHealth;
  readonly operatingAnchorCellId: number;
  readonly eligibleFromTick: number;
  readonly attackReadyAtTick: number;
}

export type TankProductionJobState =
  | {
      readonly factoryId: string;
      readonly ownerId: string;
      readonly chassisType: TankChassisType;
      readonly state: "BUILDING";
      readonly remainingTicks: number;
    }
  | {
      readonly factoryId: string;
      readonly ownerId: string;
      readonly chassisType: TankChassisType;
      readonly state: "WAITING_DEPLOYMENT";
    };

export interface StartTankProductionRequest {
  readonly ownerId: string;
  readonly factoryId: string;
}

export interface ResolveTankPopulationShotRequest {
  readonly attackerOwnerId: string;
  readonly chassisType: TankChassisType;
  readonly targetFactionId: string;
}

export interface TankPopulationShotResolution {
  readonly finalDamage: number;
  readonly casualties: number;
  readonly targetPopulation: PopulationState;
}

export interface AdmittedTankPopulationShot
  extends ResolveTankPopulationShotRequest {
  readonly attackerUnitId: string;
  readonly targetCellId: number;
}

export interface TankPopulationBatchTargetResolution {
  readonly targetFactionId: string;
  readonly totalDamage: number;
  readonly casualties: number;
  readonly targetPopulation: PopulationState;
}

export interface SuccessfulTankPopulationShot {
  readonly attackerUnitId: string;
  readonly targetFactionId: string;
  readonly targetCellId: number;
  readonly finalDamage: number;
}

export interface TankPopulationShotBatchResolution {
  readonly targets: readonly TankPopulationBatchTargetResolution[];
  readonly successfulShots: readonly SuccessfulTankPopulationShot[];
}

export type TankProductionFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "UNKNOWN_FACTORY"
  | "NOT_OWNER"
  | "FACTORY_INACTIVE"
  | "FACTORY_LEVEL_REQUIRED"
  | "FACTORY_CAPACITY"
  | "BUILD_NOT_PERMITTED"
  | "INSUFFICIENT_FFY";

export type StartTankProductionResult =
  | {
      readonly ok: true;
      readonly cost: number;
      readonly job: TankProductionJobState;
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: TankProductionFailureCode }>;
      readonly state: MatchState;
    };

export interface TankTerrainMovementTiming {
  readonly movementWorkPerTick: number;
  readonly edgeWeight: number;
}

export interface TankNavigationRoute {
  readonly cells: readonly number[];
  readonly edgeWeights: readonly number[];
  readonly totalWeight: number;
  readonly movementWorkPerTick: number;
}

export type TankNavigationRouteResult =
  | { readonly status: "FOUND"; readonly route: TankNavigationRoute }
  | { readonly status: "UNREACHABLE" }
  | { readonly status: "LIMIT_REACHED" };

interface ExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

const BASE_TANK_BUILD_TICKS = 50;
const HEAVY_ARTILLERY_BUILD_TICKS = 100;
const BASE_TANK_MAX_HEALTH = 1_000n;
const TANK_MOVEMENT_TICKS_PER_SECOND = 10n;
const TANK_NAVIGATION_BASE_WORK = 468n;
const TANK_OPERATING_LEASH_CELLS = 100;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function failure(
  state: MatchState,
  code: TankProductionFailureCode,
): StartTankProductionResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function territorialContactCount(state: MatchState, ownerId: string): number {
  const active = new Set(
    state.factions
      .filter((faction) => faction.status === "ACTIVE")
      .map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < state.ownership.length; cellId += 1) {
    if (state.ownership[cellId] !== ownerId) continue;
    for (const neighbor of state.map.cardinalNeighbors(cellId)) {
      const neighborOwner = state.ownership[neighbor] ?? null;
      if (
        neighborOwner !== null &&
        neighborOwner !== ownerId &&
        active.has(neighborOwner)
      ) {
        contacts.add(neighborOwner);
      }
    }
  }
  return contacts.size;
}

function ruleDynamicState(state: MatchState, ownerId: string): RuleDynamicState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  return Object.freeze({
    ownedPersistentStructureCount: state.structures.filter(
      (structure) => structure.ownerId === ownerId,
    ).length,
    territorialContactCount: territorialContactCount(state, ownerId),
    peakTotalPopulation: owner.population.peakTotal,
  });
}

function exactMultiply(
  left: ExactFfyValue,
  numerator: bigint,
  denominator: bigint,
): ExactFfyValue {
  const reduced = reducedRational(
    left.numerator * numerator,
    left.denominator * denominator,
  );
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

function effectiveTankChassisType(
  state: MatchState,
  ownerId: string,
): TankChassisType {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_CHASSIS_PROFILE",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );
  if (terms.length === 0) return "TANK";
  if (terms.length !== 1) {
    throw new Error("Tank chassis profile must resolve to at most one transform");
  }
  const value = terms[0]?.value;
  if (
    value?.kind !== "SINGLETON" ||
    (value.value !== "HEAVY_ARTILLERY" && value.value !== "TANK")
  ) {
    throw new Error("Tank chassis profile resolved to an unsupported profile");
  }
  return value.value;
}

function effectiveTankMaxHealth(
  state: MatchState,
  ownerId: string,
): TankExactHealth {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_MAX_HEALTH",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_MAX_HEALTH,
    terms,
  );
  const health = reducedRational(
    BASE_TANK_MAX_HEALTH * scale.numerator,
    scale.denominator,
  );
  if (health.numerator <= 0n || health.denominator <= 0n) {
    throw new Error("Tank maximum health must resolve to a positive value");
  }
  return Object.freeze({
    numerator: health.numerator,
    denominator: health.denominator,
  });
}

function unitBuildPermitted(state: MatchState, ownerId: string): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "UNIT_BUILD_PERMISSION",
    scope,
    owner.rules.contributions,
  );
  if (
    contributions.some(
      (entry) => entry.conditions !== undefined && entry.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned Tank build permission requires an explicit Tank admission context",
    );
  }
  return reducePermissionRule(
    true,
    RULE_AXIS_REGISTRY.UNIT_BUILD_PERMISSION,
    contributions,
  );
}

function activeTankChassisCount(state: MatchState, ownerId: string): number {
  return state.mobileUnits.filter(
    (unit) =>
      unit.ownerId === ownerId &&
      (unit.type === "TANK" || unit.type === "HEAVY_ARTILLERY"),
  ).length;
}

export function tankPurchaseCost(activeTankChassis: number): number {
  if (
    !Number.isSafeInteger(activeTankChassis) ||
    activeTankChassis < 0 ||
    Object.is(activeTankChassis, -0)
  ) {
    throw new Error("active Tank chassis count must be a non-negative safe integer");
  }
  return Math.min(1_000_000, 250_000 * (activeTankChassis + 1));
}

function effectiveTankPurchaseCost(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
): ExactFfyValue {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_PURCHASE_FFY_COST",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );

  let cost: ExactFfyValue = Object.freeze({
    numerator: BigInt(tankPurchaseCost(activeTankChassisCount(state, ownerId))),
    denominator: 1n,
  });
  if (chassisType === "HEAVY_ARTILLERY") {
    cost = exactMultiply(cost, 3n, 2n);
  }
  if (terms.some((term) => term.stage === "TERMINAL")) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_PURCHASE_FFY_COST,
    terms,
  );
  return exactMultiply(cost, scale.numerator, scale.denominator);
}

function factoryWorkCondition(
  condition: RuleCondition,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
): boolean {
  switch (condition.kind) {
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return condition.path === factory.acquisitionPath;
    case "TARGET_UNIT_IS":
      return condition.unit === chassisType;
    default:
      throw new Error(
        `Unsupported Tank-construction rule condition ${condition.kind}`,
      );
  }
}

function effectiveTankBuildTicks(
  state: MatchState,
  ownerId: string,
  factory: PersistentStructureState,
  chassisType: TankChassisType,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: "FACTORY",
  } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "STRUCTURE_UNIT_CONSTRUCTION_WORK_RATE",
      scope,
      ruleDynamicState(state, ownerId),
    ),
    (conditions) =>
      conditions.every((condition) =>
        factoryWorkCondition(condition, factory, chassisType),
      ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_UNIT_CONSTRUCTION_WORK_RATE,
    terms,
  );
  if (scale.numerator <= 0n || scale.denominator <= 0n) {
    throw new Error("Tank construction work rate must resolve to a positive value");
  }
  const baseTicks =
    chassisType === "HEAVY_ARTILLERY"
      ? HEAVY_ARTILLERY_BUILD_TICKS
      : BASE_TANK_BUILD_TICKS;
  const numerator = BigInt(baseTicks) * scale.denominator;
  const ticks = (numerator + scale.numerator - 1n) / scale.numerator;
  if (ticks <= 0n || ticks > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Tank build duration must resolve to a positive safe integer");
  }
  return Number(ticks);
}

function tankTerrainBaseSpeed(terrain: SimulationTerrain): ExactRatio | undefined {
  switch (terrain) {
    case "PLAINS":
      return Object.freeze({ numerator: 5n, denominator: 1n });
    case "HIGHLAND":
      return Object.freeze({ numerator: 4n, denominator: 1n });
    case "DESERT":
      return Object.freeze({ numerator: 9n, denominator: 2n });
    case "FOREST":
      return Object.freeze({ numerator: 13n, denominator: 4n });
    case "TUNDRA":
      return Object.freeze({ numerator: 15n, denominator: 4n });
    case "MARSH":
      return Object.freeze({ numerator: 5n, denominator: 2n });
    case "MOUNTAIN":
    case "SHALLOW_WATER":
    case "DEEP_WATER":
    case "IMPASSABLE":
    case "TEST":
      return undefined;
  }
}

function tankMovementProfile(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
): Readonly<{ scale: ExactRatio; chassisDenominator: bigint }> {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  if (chassisType !== "TANK" && chassisType !== "HEAVY_ARTILLERY") {
    throw new Error(`unsupported Tank chassis type: ${String(chassisType)}`);
  }

  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_MOVEMENT_SPEED",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_MOVEMENT_SPEED,
    terms,
  );
  if (scale.numerator <= 0n || scale.denominator <= 0n) {
    throw new Error("Tank movement speed must resolve to a positive value");
  }
  return Object.freeze({
    scale: Object.freeze({
      numerator: scale.numerator,
      denominator: scale.denominator,
    }),
    chassisDenominator: chassisType === "HEAVY_ARTILLERY" ? 2n : 1n,
  });
}

export function tankTerrainMovementTiming(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
  terrain: SimulationTerrain,
): TankTerrainMovementTiming | undefined {
  const baseSpeed = tankTerrainBaseSpeed(terrain);
  if (baseSpeed === undefined) return undefined;

  const profile = tankMovementProfile(state, ownerId, chassisType);
  const speed = reducedRational(
    baseSpeed.numerator * profile.scale.numerator,
    baseSpeed.denominator *
      profile.scale.denominator *
      profile.chassisDenominator,
  );
  if (speed.numerator <= 0n || speed.denominator <= 0n) {
    throw new Error("Tank movement speed must resolve to a positive value");
  }

  const movementWorkPerTick = speed.numerator;
  const edgeWeight = speed.denominator * TANK_MOVEMENT_TICKS_PER_SECOND;
  if (movementWorkPerTick > MAX_SAFE_BIGINT || edgeWeight > MAX_SAFE_BIGINT) {
    throw new Error("Tank movement timing exceeds the safe-integer range");
  }
  return Object.freeze({
    movementWorkPerTick: Number(movementWorkPerTick),
    edgeWeight: Number(edgeWeight),
  });
}

function tankCellCorridorPermitsTraversal(
  state: MatchState,
  ownerId: string,
  cellId: number,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  if (owner.status !== "ACTIVE") return false;

  const territoryOwnerId = state.ownership[cellId] ?? null;
  if (territoryOwnerId === null) return false;
  const territoryOwner = state.factions.find(
    (faction) => faction.id === territoryOwnerId,
  );
  return territoryOwner !== undefined && territoryOwner.status === "ACTIVE";
}

export function tankCellTraversalTiming(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
  cellId: number,
): TankTerrainMovementTiming | undefined {
  if (!state.map.isValidCellId(cellId)) {
    throw new Error("Tank traversal query requires a valid map cell");
  }
  if (!tankCellCorridorPermitsTraversal(state, ownerId, cellId)) {
    return undefined;
  }
  return tankTerrainMovementTiming(
    state,
    ownerId,
    chassisType,
    state.map.terrainAt(cellId),
  );
}

function tankTerrainHalfEdgeBaseWork(
  terrain: SimulationTerrain,
): bigint | undefined {
  const baseSpeed = tankTerrainBaseSpeed(terrain);
  if (baseSpeed === undefined) return undefined;
  const numerator =
    (TANK_MOVEMENT_TICKS_PER_SECOND / 2n) *
    TANK_NAVIGATION_BASE_WORK *
    baseSpeed.denominator;
  if (numerator % baseSpeed.numerator !== 0n) {
    throw new Error("Tank half-edge work normalization is not exact");
  }
  const work = numerator / baseSpeed.numerator;
  if (work <= 0n || work > MAX_SAFE_BIGINT) {
    throw new Error("Tank navigation timing exceeds the safe-integer range");
  }
  return work;
}

export function tankNavigationRoute(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
  startCellId: number,
  destinationCellId: number,
): TankNavigationRouteResult {
  if (
    !state.map.isValidCellId(startCellId) ||
    !state.map.isValidCellId(destinationCellId)
  ) {
    throw new Error("Tank navigation query requires valid map cells");
  }

  const profile = tankMovementProfile(state, ownerId, chassisType);
  const movementWork = TANK_NAVIGATION_BASE_WORK * profile.scale.numerator;
  if (movementWork <= 0n || movementWork > MAX_SAFE_BIGINT) {
    throw new Error("Tank navigation timing exceeds the safe-integer range");
  }
  const edgeMultiplier =
    profile.scale.denominator * profile.chassisDenominator;

  const edgeWeight = (fromCellId: number, toCellId: number): number | undefined => {
    if (
      !tankCellCorridorPermitsTraversal(state, ownerId, fromCellId) ||
      !tankCellCorridorPermitsTraversal(state, ownerId, toCellId)
    ) {
      return undefined;
    }
    const fromHalf = tankTerrainHalfEdgeBaseWork(
      state.map.terrainAt(fromCellId),
    );
    const toHalf = tankTerrainHalfEdgeBaseWork(
      state.map.terrainAt(toCellId),
    );
    if (fromHalf === undefined || toHalf === undefined) return undefined;
    const work = (fromHalf + toHalf) * edgeMultiplier;
    if (work <= 0n || work > MAX_SAFE_BIGINT) {
      throw new Error("Tank navigation timing exceeds the safe-integer range");
    }
    return Number(work);
  };

  if (
    !tankCellCorridorPermitsTraversal(state, ownerId, startCellId) ||
    !tankCellCorridorPermitsTraversal(state, ownerId, destinationCellId) ||
    tankTerrainHalfEdgeBaseWork(state.map.terrainAt(startCellId)) === undefined ||
    tankTerrainHalfEdgeBaseWork(state.map.terrainAt(destinationCellId)) === undefined
  ) {
    return Object.freeze({ status: "UNREACHABLE" as const });
  }

  const policy: NavigationTraversalPolicy = { traversalWeight: edgeWeight };
  const result = createNavigation(state.map).path(
    startCellId,
    destinationCellId,
    policy,
  );
  if (result.status !== "FOUND") {
    return Object.freeze({ status: result.status });
  }

  const cells = Object.freeze([...result.path.cells]);
  const edgeWeights = Object.freeze(
    cells.slice(1).map((cellId, index) => {
      const weight = edgeWeight(cells[index]!, cellId);
      if (weight === undefined) {
        throw new Error("Tank navigation returned an unavailable route edge");
      }
      return weight;
    }),
  );
  return Object.freeze({
    status: "FOUND" as const,
    route: Object.freeze({
      cells,
      edgeWeights,
      totalWeight: result.path.totalWeight,
      movementWorkPerTick: Number(movementWork),
    }),
  });
}

export function tankOperatingLeashContains(
  map: SimulationMap,
  anchorCellId: number,
  candidateCellId: number,
): boolean {
  if (!map.isValidCellId(anchorCellId) || !map.isValidCellId(candidateCellId)) {
    throw new Error("Tank operating-leash query requires valid map cells");
  }
  const anchor = map.positionOf(anchorCellId);
  const candidate = map.positionOf(candidateCellId);
  const dx = candidate.x - anchor.x;
  const dy = candidate.y - anchor.y;
  return dx * dx + dy * dy <= TANK_OPERATING_LEASH_CELLS ** 2;
}

export function tankWeaponRangeContains(
  map: SimulationMap,
  attackerCellId: number,
  targetCellId: number,
  range: number,
): boolean {
  if (!map.isValidCellId(attackerCellId) || !map.isValidCellId(targetCellId)) {
    throw new Error("Tank weapon range query requires valid map cells");
  }
  if (!Number.isFinite(range) || range < 0) {
    throw new Error("Tank weapon range must be a finite non-negative value");
  }
  const attacker = map.positionOf(attackerCellId);
  const target = map.positionOf(targetCellId);
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  return dx * dx + dy * dy <= range * range;
}

export function resolveTankPopulationShot(
  state: MatchState,
  request: ResolveTankPopulationShotRequest,
): TankPopulationShotResolution {
  const attacker = state.factions.find(
    (faction) => faction.id === request.attackerOwnerId,
  );
  if (attacker === undefined) {
    throw new Error(`unknown faction: ${request.attackerOwnerId}`);
  }
  const target = state.factions.find(
    (faction) => faction.id === request.targetFactionId,
  );
  if (target === undefined) {
    throw new Error(`unknown faction: ${request.targetFactionId}`);
  }
  if (request.chassisType !== "TANK" && request.chassisType !== "HEAVY_ARTILLERY") {
    throw new Error(`unsupported Tank chassis type: ${String(request.chassisType)}`);
  }

  const baseDamage = request.chassisType === "HEAVY_ARTILLERY" ? 1_000n : 250n;
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      attacker.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_DAMAGE",
      scope,
      ruleDynamicState(state, request.attackerOwnerId),
    ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_DAMAGE,
    terms,
  );
  const scaledNumerator = baseDamage * scale.numerator;
  const finalDamageValue =
    scaledNumerator <= 0n ? 0n : scaledNumerator / scale.denominator;
  if (finalDamageValue > MAX_SAFE_BIGINT) {
    throw new Error("Tank Population damage exceeds the safe-integer range");
  }
  const finalDamage = Number(finalDamageValue);
  const casualties = Math.min(finalDamage, target.population.available);
  const targetPopulation = removePopulation(
    target.population,
    "AVAILABLE",
    casualties,
  );
  return Object.freeze({ finalDamage, casualties, targetPopulation });
}

export function resolveTankPopulationShotBatch(
  state: MatchState,
  shots: readonly AdmittedTankPopulationShot[],
): TankPopulationShotBatchResolution {
  const damageByTarget = new Map<string, bigint>();
  const successfulShots: SuccessfulTankPopulationShot[] = [];

  for (const shot of shots) {
    const resolution = resolveTankPopulationShot(state, shot);
    const total =
      (damageByTarget.get(shot.targetFactionId) ?? 0n) +
      BigInt(resolution.finalDamage);
    if (total > MAX_SAFE_BIGINT) {
      throw new Error("Tank Population batch damage exceeds the safe-integer range");
    }
    damageByTarget.set(shot.targetFactionId, total);
    if (resolution.finalDamage > 0) {
      successfulShots.push(
        Object.freeze({
          attackerUnitId: shot.attackerUnitId,
          targetFactionId: shot.targetFactionId,
          targetCellId: shot.targetCellId,
          finalDamage: resolution.finalDamage,
        }),
      );
    }
  }

  successfulShots.sort((left, right) => {
    const attackerOrder = compareIds(left.attackerUnitId, right.attackerUnitId);
    if (attackerOrder !== 0) return attackerOrder;
    const factionOrder = compareIds(left.targetFactionId, right.targetFactionId);
    if (factionOrder !== 0) return factionOrder;
    return left.targetCellId - right.targetCellId;
  });

  const targets = [...damageByTarget.entries()]
    .sort(([left], [right]) => compareIds(left, right))
    .map(([targetFactionId, totalDamageValue]) => {
      const target = state.factions.find(
        (faction) => faction.id === targetFactionId,
      );
      if (target === undefined) {
        throw new Error(`unknown faction: ${targetFactionId}`);
      }
      const totalDamage = Number(totalDamageValue);
      const casualties = Math.min(totalDamage, target.population.available);
      return Object.freeze({
        targetFactionId,
        totalDamage,
        casualties,
        targetPopulation: removePopulation(
          target.population,
          "AVAILABLE",
          casualties,
        ),
      });
    });

  return Object.freeze({
    targets: Object.freeze(targets),
    successfulShots: Object.freeze(successfulShots),
  });
}

export function tryStartTankProduction(
  state: MatchState,
  request: StartTankProductionRequest,
): StartTankProductionResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.factoryId !== "string" ||
    request.factoryId.length === 0
  ) {
    return failure(state, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return failure(state, "UNKNOWN_OWNER");
  const factory = state.structures.find(
    (structure) => structure.id === request.factoryId,
  );
  if (factory === undefined || factory.type !== "FACTORY") {
    return failure(state, "UNKNOWN_FACTORY");
  }
  if (factory.ownerId !== request.ownerId) return failure(state, "NOT_OWNER");
  if (!factory.active) return failure(state, "FACTORY_INACTIVE");
  if (factory.completedLevel === undefined || factory.completedLevel < 1) {
    return failure(state, "FACTORY_LEVEL_REQUIRED");
  }
  if (
    (state.tankProductionJobs ?? []).some(
      (job) => job.factoryId === request.factoryId,
    )
  ) {
    return failure(state, "FACTORY_CAPACITY");
  }
  if (!unitBuildPermitted(state, request.ownerId)) {
    return failure(state, "BUILD_NOT_PERMITTED");
  }

  const chassisType = effectiveTankChassisType(state, request.ownerId);
  const debit = tryDebitFfy(
    owner.ffy,
    effectiveTankPurchaseCost(state, request.ownerId, chassisType),
  );
  if (!debit.ok) return failure(state, "INSUFFICIENT_FFY");

  const job = Object.freeze({
    factoryId: factory.id,
    ownerId: request.ownerId,
    chassisType,
    state: "BUILDING" as const,
    remainingTicks: effectiveTankBuildTicks(
      state,
      request.ownerId,
      factory,
      chassisType,
    ),
  });
  const factions = state.factions.map((faction) =>
    faction.id === request.ownerId
      ? Object.freeze({ ...faction, ffy: debit.balance })
      : faction,
  );
  const jobs = Object.freeze(
    [...(state.tankProductionJobs ?? []), job].sort((left, right) =>
      compareIds(left.factoryId, right.factoryId),
    ),
  );
  const next = createProspectiveMatchState(state, {
    factions,
    tankProductionJobs: jobs,
  });
  return Object.freeze({
    ok: true,
    cost: debit.cost,
    job,
    state: next,
  });
}

function tankChassisCanTraverse(terrain: SimulationTerrain): boolean {
  switch (terrain) {
    case "PLAINS":
    case "HIGHLAND":
    case "DESERT":
    case "FOREST":
    case "TUNDRA":
    case "MARSH":
      return true;
    case "MOUNTAIN":
    case "SHALLOW_WATER":
    case "DEEP_WATER":
    case "IMPASSABLE":
    case "TEST":
      return false;
  }
}

function tankDeploymentCell(
  state: MatchState,
  factory: PersistentStructureState,
  job: TankProductionJobState,
): number | undefined {
  return [...state.map.cardinalNeighbors(factory.cellId)]
    .filter(
      (cellId) =>
        state.ownership[cellId] === job.ownerId &&
        tankChassisCanTraverse(state.map.terrainAt(cellId)),
    )
    .sort((left, right) => left - right)[0];
}

function waitingDeploymentJob(
  job: TankProductionJobState,
): TankProductionJobState {
  return Object.freeze({
    factoryId: job.factoryId,
    ownerId: job.ownerId,
    chassisType: job.chassisType,
    state: "WAITING_DEPLOYMENT" as const,
  });
}

export function advanceTankProductionPhase(state: MatchState): MatchState {
  let units: MobileUnitCollectionState = Object.freeze({
    mobileUnits: state.mobileUnits,
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  });
  const operationalStates = [...state.tankOperationalStates];
  const nextJobs: TankProductionJobState[] = [];
  const ownerIds = state.factions.map((faction) => faction.id);
  const jobs = [...state.tankProductionJobs].sort((left, right) =>
    compareIds(left.factoryId, right.factoryId),
  );

  for (const job of jobs) {
    const factory = state.structures.find(
      (structure) => structure.id === job.factoryId,
    );
    if (
      factory === undefined ||
      factory.type !== "FACTORY" ||
      factory.ownerId !== job.ownerId
    ) {
      continue;
    }

    if (!factory.active || factory.completedLevel === undefined) {
      nextJobs.push(job);
      continue;
    }

    const deploy = (): boolean => {
      const cellId = tankDeploymentCell(state, factory, job);
      if (cellId === undefined) return false;
      const created = createMobileUnit(state.map, ownerIds, units, {
        ownerId: job.ownerId,
        type: job.chassisType,
        movementClass: job.chassisType,
        cellId,
      });
      units = created;
      const eligibleFromTick = state.tick + 1;
      if (!Number.isSafeInteger(eligibleFromTick)) {
        throw new Error("Tank activation tick exceeds the safe-integer range");
      }
      operationalStates.push(
        Object.freeze({
          unitId: created.unit.id,
          health: effectiveTankMaxHealth(state, job.ownerId),
          operatingAnchorCellId: cellId,
          eligibleFromTick,
          attackReadyAtTick: eligibleFromTick,
        }),
      );
      return true;
    };

    if (job.state === "WAITING_DEPLOYMENT") {
      if (!deploy()) nextJobs.push(job);
      continue;
    }

    if (job.remainingTicks > 1) {
      nextJobs.push(
        Object.freeze({
          factoryId: job.factoryId,
          ownerId: job.ownerId,
          chassisType: job.chassisType,
          state: "BUILDING" as const,
          remainingTicks: job.remainingTicks - 1,
        }),
      );
      continue;
    }

    if (!deploy()) nextJobs.push(waitingDeploymentJob(job));
  }

  return createProspectiveMatchState(state, {
    mobileUnits: units.mobileUnits,
    nextMobileUnitOrdinal: units.nextMobileUnitOrdinal,
    tankProductionJobs: nextJobs,
    tankOperationalStates: operationalStates,
  });
}
