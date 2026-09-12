import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  isTerrainScopeId,
  reducedRational,
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { matchStateAtWar } from "./HostilityState";
import { landTerrainBaseSpec } from "./LandOperations";
import type { MatchState } from "./MatchState";
import { createNavigation, type NavigationTraversalPolicy } from "./Navigation";
import type { SimulationMap, SimulationTerrain } from "./SimulationMap";
import {
  tankCellTraversalTiming,
  tankOperatingLeashContains,
  tankTerrainMovementTiming,
  type TankChassisType,
} from "./Tanks";

export type TankAutonomousUnitTargetClass =
  | "TANK_CHASSIS"
  | "WARSHIP"
  | "TRAIN"
  | "POPULATION";

type TankAutonomousMobileTargetClass = Exclude<
  TankAutonomousUnitTargetClass,
  "POPULATION"
>;

export interface TankPursuitRouteRequest {
  readonly ownerId: string;
  readonly chassisType: TankChassisType;
  readonly currentCellId: number;
  readonly operatingAnchorCellId: number;
}

export interface TankAutonomousUnitTargetRequest extends TankPursuitRouteRequest {
  /** Unit IDs already established as lawfully observed by the caller. */
  readonly observedUnitIds: readonly string[];
  /** Cell IDs already established as lawfully observed by the caller. */
  readonly observedCellIds: readonly number[];
}

export type TankAutonomousUnitTargetSelection =
  | Readonly<{
      targetClass: TankAutonomousMobileTargetClass;
      unitId: string;
    }>
  | Readonly<{
      targetClass: "POPULATION";
      cellId: number;
    }>;

export interface TankPursuitRoutePlan {
  readonly destinationCellId: number;
  readonly cells: readonly number[];
  readonly edgeWeights: readonly number[];
  readonly movementWorkPerTick: number;
}

interface ExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

type RankedTarget =
  | Readonly<{
      targetClass: TankAutonomousMobileTargetClass;
      unitId: string;
      traversalWeight: number;
    }>
  | Readonly<{
      targetClass: "POPULATION";
      cellId: number;
      traversalWeight: number;
    }>;

interface TankFiringPosition {
  readonly cellId: number;
  readonly traversalWeight: number;
}

const TRAVERSABLE_TANK_TERRAINS = Object.freeze([
  "PLAINS",
  "HIGHLAND",
  "DESERT",
  "FOREST",
  "TUNDRA",
  "MARSH",
] as const satisfies readonly SimulationTerrain[]);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function leastCommonMultiple(left: bigint, right: bigint): bigint {
  if (left <= 0n || right <= 0n) {
    throw new Error("Tank targeting traversal denominators must be positive");
  }
  const result = (left / gcd(left, right)) * right;
  if (result <= 0n || result > MAX_SAFE_BIGINT) {
    throw new Error("Tank targeting traversal scale exceeds the safe-integer range");
  }
  return result;
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

function effectiveAttackRange(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
): ExactRatio {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_ATTACK_RANGE",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_ATTACK_RANGE,
    terms,
  );
  const baseline = chassisType === "HEAVY_ARTILLERY" ? 45n : 30n;
  const range = reducedRational(
    baseline * scale.numerator,
    scale.denominator,
  );
  if (range.numerator <= 0n || range.denominator <= 0n) {
    throw new Error("Tank attack range must resolve to a positive value");
  }
  return Object.freeze(range);
}

function halfTraversalTicks(
  movementWorkPerTick: number,
  edgeWeight: number,
): ExactRatio {
  return reducedRational(
    BigInt(edgeWeight),
    2n * BigInt(movementWorkPerTick),
  );
}

function traversalWeightScale(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
): bigint {
  let scale = 1n;
  for (const terrain of TRAVERSABLE_TANK_TERRAINS) {
    const timing = tankTerrainMovementTiming(
      state,
      ownerId,
      chassisType,
      terrain,
    );
    if (timing === undefined) continue;
    const half = halfTraversalTicks(
      timing.movementWorkPerTick,
      timing.edgeWeight,
    );
    scale = leastCommonMultiple(scale, half.denominator);
  }
  return scale;
}

function scaledHalfTraversalWeight(
  movementWorkPerTick: number,
  edgeWeight: number,
  scale: bigint,
): bigint {
  const half = halfTraversalTicks(movementWorkPerTick, edgeWeight);
  if (scale % half.denominator !== 0n) {
    throw new Error("Tank targeting traversal scale is not exact");
  }
  return half.numerator * (scale / half.denominator);
}

function targetingTraversalPolicy(
  state: MatchState,
  ownerId: string,
  chassisType: TankChassisType,
  operatingAnchorCellId: number,
): NavigationTraversalPolicy {
  const scale = traversalWeightScale(state, ownerId, chassisType);
  const halfWeightByCell = new Map<number, bigint | undefined>();
  const halfWeightForCell = (cellId: number): bigint | undefined => {
    if (halfWeightByCell.has(cellId)) return halfWeightByCell.get(cellId);
    if (
      !tankOperatingLeashContains(
        state.map,
        operatingAnchorCellId,
        cellId,
      )
    ) {
      halfWeightByCell.set(cellId, undefined);
      return undefined;
    }
    const timing = tankCellTraversalTiming(
      state,
      ownerId,
      chassisType,
      cellId,
    );
    const halfWeight =
      timing === undefined
        ? undefined
        : scaledHalfTraversalWeight(
            timing.movementWorkPerTick,
            timing.edgeWeight,
            scale,
          );
    halfWeightByCell.set(cellId, halfWeight);
    return halfWeight;
  };

  return Object.freeze({
    traversalWeight: (fromCellId: number, toCellId: number) => {
      const fromHalfWeight = halfWeightForCell(fromCellId);
      const toHalfWeight = halfWeightForCell(toCellId);
      if (fromHalfWeight === undefined || toHalfWeight === undefined) {
        return undefined;
      }
      const weight = fromHalfWeight + toHalfWeight;
      if (weight <= 0n || weight > MAX_SAFE_BIGINT) {
        throw new Error("Tank targeting traversal weight exceeds the safe-integer range");
      }
      return Number(weight);
    },
  });
}

function cellWithinExactRange(
  map: SimulationMap,
  firingCellId: number,
  targetCellId: number,
  range: ExactRatio,
): boolean {
  const firing = map.positionOf(firingCellId);
  const target = map.positionOf(targetCellId);
  const dx = BigInt(target.x - firing.x);
  const dy = BigInt(target.y - firing.y);
  const distanceSquared = dx * dx + dy * dy;
  return (
    distanceSquared * range.denominator * range.denominator <=
    range.numerator * range.numerator
  );
}

function relationIdentity(
  faction: MatchState["factions"][number],
): Readonly<{ factionId: string; fixedTeamId?: string }> {
  return Object.freeze({
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  });
}

function targetClassForUnit(
  unitType: MatchState["mobileUnits"][number]["type"],
  chassisType: TankChassisType,
): TankAutonomousMobileTargetClass | undefined {
  switch (unitType) {
    case "TANK":
    case "HEAVY_ARTILLERY":
      return "TANK_CHASSIS";
    case "WARSHIP":
      return "WARSHIP";
    case "TRAIN":
      return chassisType === "HEAVY_ARTILLERY" ? undefined : "TRAIN";
    case "TRANSPORT_SHIP":
    case "TRADE_SHIP":
      return undefined;
  }
}

function classRank(targetClass: TankAutonomousUnitTargetClass): number {
  switch (targetClass) {
    case "TANK_CHASSIS":
      return 0;
    case "WARSHIP":
      return 1;
    case "TRAIN":
      return 2;
    case "POPULATION":
      return 3;
  }
}

function minimumFiringPosition(
  state: MatchState,
  reachable: ReturnType<ReturnType<typeof createNavigation>["reachable"]>,
  operatingAnchorCellId: number,
  targetCellId: number,
  range: ExactRatio,
): TankFiringPosition | undefined {
  let best: TankFiringPosition | undefined;
  for (const entry of reachable.cells) {
    if (
      !tankOperatingLeashContains(
        state.map,
        operatingAnchorCellId,
        entry.cellId,
      ) ||
      !cellWithinExactRange(state.map, entry.cellId, targetCellId, range)
    ) {
      continue;
    }
    if (
      best === undefined ||
      entry.totalWeight < best.traversalWeight ||
      (entry.totalWeight === best.traversalWeight && entry.cellId < best.cellId)
    ) {
      best = Object.freeze({
        cellId: entry.cellId,
        traversalWeight: entry.totalWeight,
      });
    }
  }
  return best;
}

function minimumTraversalWeightToFiringPosition(
  state: MatchState,
  reachable: ReturnType<ReturnType<typeof createNavigation>["reachable"]>,
  operatingAnchorCellId: number,
  targetCellId: number,
  range: ExactRatio,
): number | undefined {
  return minimumFiringPosition(
    state,
    reachable,
    operatingAnchorCellId,
    targetCellId,
    range,
  )?.traversalWeight;
}

function populationPermissionConditionApplies(
  terrain: SimulationTerrain,
  targetHasFallout: boolean,
): (conditions: readonly RuleCondition[]) => boolean {
  return (conditions) =>
    conditions.every((condition) => {
      switch (condition.kind) {
        case "SOURCE_TERRAIN_IS":
        case "TARGET_TERRAIN_IS":
        case "EVENT_TERRAIN_IS":
        case "BUILD_TERRAIN_IS":
          return condition.terrain === terrain;
        case "TARGET_HAS_FALLOUT":
          return targetHasFallout;
        case "TARGET_LACKS_FALLOUT":
          return !targetHasFallout;
        default:
          return false;
      }
    });
}

function effectivePopulationBearing(
  state: MatchState,
  targetOwner: MatchState["factions"][number],
  cellId: number,
): boolean {
  const terrain = state.map.terrainAt(cellId);
  const base = landTerrainBaseSpec(terrain).populationBearing;
  if (terrain === "TEST" || !isTerrainScopeId(terrain)) return base;

  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      targetOwner.rules,
      RULE_AXIS_REGISTRY,
      "TERRAIN_POPULATION_BEARING_PERMISSION",
      { kind: "TERRAIN", terrain },
      ruleDynamicState(state, targetOwner.id),
    ),
    populationPermissionConditionApplies(
      terrain,
      state.fallout[cellId] ?? false,
    ),
  );

  let allowed = base;
  for (const term of terms) {
    if (term.value.kind !== "PROHIBIT_WINS") continue;
    if (term.value.decision === "PROHIBIT") return false;
    allowed = true;
  }
  return allowed;
}

function shouldReplaceBest(
  candidate: RankedTarget,
  best: RankedTarget | undefined,
): boolean {
  if (best === undefined) return true;
  const candidateRank = classRank(candidate.targetClass);
  const bestRank = classRank(best.targetClass);
  if (candidateRank !== bestRank) return candidateRank < bestRank;
  if (candidate.traversalWeight !== best.traversalWeight) {
    return candidate.traversalWeight < best.traversalWeight;
  }
  if (candidate.targetClass === "POPULATION" && best.targetClass === "POPULATION") {
    return candidate.cellId < best.cellId;
  }
  if (candidate.targetClass !== "POPULATION" && best.targetClass !== "POPULATION") {
    return compareIds(candidate.unitId, best.unitId) < 0;
  }
  return false;
}

export function selectTankAutonomousUnitTarget(
  state: MatchState,
  request: TankAutonomousUnitTargetRequest,
): TankAutonomousUnitTargetSelection | undefined {
  if (
    !state.map.isValidCellId(request.currentCellId) ||
    !state.map.isValidCellId(request.operatingAnchorCellId)
  ) {
    throw new Error("Tank target selection requires valid current and anchor cells");
  }
  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${request.ownerId}`);
  if (
    tankCellTraversalTiming(
      state,
      request.ownerId,
      request.chassisType,
      request.currentCellId,
    ) === undefined
  ) {
    return undefined;
  }

  const observedUnits = new Set(request.observedUnitIds);
  const observedCells = new Set(request.observedCellIds);
  const range = effectiveAttackRange(
    state,
    request.ownerId,
    request.chassisType,
  );
  const reachable = createNavigation(state.map).reachable(
    request.currentCellId,
    Number.MAX_SAFE_INTEGER,
    targetingTraversalPolicy(
      state,
      request.ownerId,
      request.chassisType,
      request.operatingAnchorCellId,
    ),
  );

  let best: RankedTarget | undefined;
  for (const unit of state.mobileUnits) {
    if (!observedUnits.has(unit.id)) continue;
    const targetClass = targetClassForUnit(unit.type, request.chassisType);
    if (targetClass === undefined) continue;
    const targetOwner = state.factions.find(
      (faction) => faction.id === unit.ownerId,
    );
    if (
      targetOwner === undefined ||
      factionRelationBetween(
        relationIdentity(owner),
        relationIdentity(targetOwner),
      ) !== "ENEMY" ||
      !tankOperatingLeashContains(
        state.map,
        request.operatingAnchorCellId,
        unit.cellId,
      )
    ) {
      continue;
    }
    const traversalWeight = minimumTraversalWeightToFiringPosition(
      state,
      reachable,
      request.operatingAnchorCellId,
      unit.cellId,
      range,
    );
    if (traversalWeight === undefined) continue;
    const candidate: RankedTarget = Object.freeze({
      targetClass,
      unitId: unit.id,
      traversalWeight,
    });
    if (shouldReplaceBest(candidate, best)) best = candidate;
  }

  for (const cellId of observedCells) {
    if (
      !state.map.isValidCellId(cellId) ||
      !tankOperatingLeashContains(
        state.map,
        request.operatingAnchorCellId,
        cellId,
      )
    ) {
      continue;
    }
    const targetOwnerId = state.ownership[cellId] ?? null;
    if (targetOwnerId === null) continue;
    const targetOwner = state.factions.find(
      (faction) => faction.id === targetOwnerId,
    );
    if (
      targetOwner === undefined ||
      factionRelationBetween(
        relationIdentity(owner),
        relationIdentity(targetOwner),
      ) !== "ENEMY" ||
      !matchStateAtWar(state, request.ownerId, targetOwner.id) ||
      !effectivePopulationBearing(state, targetOwner, cellId)
    ) {
      continue;
    }
    const traversalWeight = minimumTraversalWeightToFiringPosition(
      state,
      reachable,
      request.operatingAnchorCellId,
      cellId,
      range,
    );
    if (traversalWeight === undefined) continue;
    const candidate: RankedTarget = Object.freeze({
      targetClass: "POPULATION",
      cellId,
      traversalWeight,
    });
    if (shouldReplaceBest(candidate, best)) best = candidate;
  }

  if (best === undefined) return undefined;
  if (best.targetClass === "POPULATION") {
    return Object.freeze({
      targetClass: "POPULATION",
      cellId: best.cellId,
    });
  }
  return Object.freeze({
    targetClass: best.targetClass,
    unitId: best.unitId,
  });
}

export function planTankPursuitRoute(
  state: MatchState,
  request: TankPursuitRouteRequest,
  target: TankAutonomousUnitTargetSelection,
): TankPursuitRoutePlan | undefined {
  if (
    !state.map.isValidCellId(request.currentCellId) ||
    !state.map.isValidCellId(request.operatingAnchorCellId)
  ) {
    throw new Error("Tank pursuit planning requires valid current and anchor cells");
  }
  if (state.factions.every((faction) => faction.id !== request.ownerId)) {
    throw new Error(`unknown faction: ${request.ownerId}`);
  }
  if (
    tankCellTraversalTiming(
      state,
      request.ownerId,
      request.chassisType,
      request.currentCellId,
    ) === undefined
  ) {
    return undefined;
  }

  let targetCellId: number;
  if (target.targetClass === "POPULATION") {
    if (!state.map.isValidCellId(target.cellId)) return undefined;
    targetCellId = target.cellId;
  } else {
    const targetUnit = state.mobileUnits.find((unit) => unit.id === target.unitId);
    if (
      targetUnit === undefined ||
      targetClassForUnit(targetUnit.type, request.chassisType) !== target.targetClass
    ) {
      return undefined;
    }
    targetCellId = targetUnit.cellId;
  }
  if (
    !tankOperatingLeashContains(
      state.map,
      request.operatingAnchorCellId,
      targetCellId,
    )
  ) {
    return undefined;
  }

  const range = effectiveAttackRange(
    state,
    request.ownerId,
    request.chassisType,
  );
  const policy = targetingTraversalPolicy(
    state,
    request.ownerId,
    request.chassisType,
    request.operatingAnchorCellId,
  );
  const navigation = createNavigation(state.map);
  const reachable = navigation.reachable(
    request.currentCellId,
    Number.MAX_SAFE_INTEGER,
    policy,
  );
  const firingPosition = minimumFiringPosition(
    state,
    reachable,
    request.operatingAnchorCellId,
    targetCellId,
    range,
  );
  if (firingPosition === undefined) return undefined;

  const path = navigation.path(
    request.currentCellId,
    firingPosition.cellId,
    policy,
  );
  if (path.status !== "FOUND") return undefined;
  const cells = Object.freeze([...path.path.cells]);
  const edgeWeights = Object.freeze(
    cells.slice(1).map((cellId, index) => {
      const weight = policy.traversalWeight(cells[index]!, cellId);
      if (weight === undefined) {
        throw new Error("Tank pursuit returned an unavailable route edge");
      }
      return weight;
    }),
  );
  const movementWork = traversalWeightScale(
    state,
    request.ownerId,
    request.chassisType,
  );
  if (movementWork <= 0n || movementWork > MAX_SAFE_BIGINT) {
    throw new Error("Tank pursuit movement work exceeds the safe-integer range");
  }
  return Object.freeze({
    destinationCellId: firingPosition.cellId,
    cells,
    edgeWeights,
    movementWorkPerTick: Number(movementWork),
  });
}
