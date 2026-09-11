import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducedRational,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
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
  | "TRAIN";

export interface TankAutonomousUnitTargetRequest {
  readonly ownerId: string;
  readonly chassisType: TankChassisType;
  readonly currentCellId: number;
  readonly operatingAnchorCellId: number;
  /** Unit IDs already established as lawfully observed by the caller. */
  readonly observedUnitIds: readonly string[];
}

export interface TankAutonomousUnitTargetSelection {
  readonly targetClass: TankAutonomousUnitTargetClass;
  readonly unitId: string;
}

interface ExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface RankedTarget {
  readonly targetClass: TankAutonomousUnitTargetClass;
  readonly unitId: string;
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
  return Object.freeze({
    traversalWeight: (fromCellId: number, toCellId: number) => {
      if (
        !tankOperatingLeashContains(
          state.map,
          operatingAnchorCellId,
          fromCellId,
        ) ||
        !tankOperatingLeashContains(
          state.map,
          operatingAnchorCellId,
          toCellId,
        )
      ) {
        return undefined;
      }
      const fromTiming = tankCellTraversalTiming(
        state,
        ownerId,
        chassisType,
        fromCellId,
      );
      const toTiming = tankCellTraversalTiming(
        state,
        ownerId,
        chassisType,
        toCellId,
      );
      if (fromTiming === undefined || toTiming === undefined) return undefined;
      const weight =
        scaledHalfTraversalWeight(
          fromTiming.movementWorkPerTick,
          fromTiming.edgeWeight,
          scale,
        ) +
        scaledHalfTraversalWeight(
          toTiming.movementWorkPerTick,
          toTiming.edgeWeight,
          scale,
        );
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
): TankAutonomousUnitTargetClass | undefined {
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
  }
}

function minimumTraversalWeightToFiringPosition(
  state: MatchState,
  reachable: ReturnType<ReturnType<typeof createNavigation>["reachable"]>,
  operatingAnchorCellId: number,
  targetCellId: number,
  range: ExactRatio,
): number | undefined {
  let best: number | undefined;
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
    if (best === undefined || entry.totalWeight < best) {
      best = entry.totalWeight;
    }
  }
  return best;
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

  const observed = new Set(request.observedUnitIds);
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
    if (!observed.has(unit.id)) continue;
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
    const candidate = Object.freeze({
      targetClass,
      unitId: unit.id,
      traversalWeight,
    });
    if (
      best === undefined ||
      classRank(candidate.targetClass) < classRank(best.targetClass) ||
      (candidate.targetClass === best.targetClass &&
        (candidate.traversalWeight < best.traversalWeight ||
          (candidate.traversalWeight === best.traversalWeight &&
            compareIds(candidate.unitId, best.unitId) < 0)))
    ) {
      best = candidate;
    }
  }

  if (best === undefined) return undefined;
  return Object.freeze({
    targetClass: best.targetClass,
    unitId: best.unitId,
  });
}
