import { factionRelationBetween } from "../core/FactionRelations";
import type { MatchState } from "./MatchState";
import { createNavigation, type NavigationTraversalPolicy } from "./Navigation";
import { tryCaptureTradeShip } from "./TradeShips";
import {
  warshipEffectiveGunRange,
  warshipNavalGunfireEnabled,
  warshipTerrainMovementTiming,
  type WarshipExactRange,
} from "./Warships";

export type WarshipAutonomousTargetClass =
  | "TRANSPORT_SHIP"
  | "WARSHIP"
  | "TRADE_SHIP";

export interface WarshipAutonomousTargetRequest {
  readonly unitId: string;
  readonly observedUnitIds: readonly string[];
}

export interface WarshipAutonomousTargetSelection {
  readonly targetClass: WarshipAutonomousTargetClass;
  readonly unitId: string;
}

export interface WarshipPursuitRouteRequest {
  readonly unitId: string;
}

export interface WarshipPursuitRoutePlan {
  readonly destinationCellId: number;
  readonly cells: readonly number[];
  readonly edgeWeights: readonly number[];
  readonly movementWorkPerTick: number;
}

export interface WarshipRoamingRouteRequest {
  readonly unitId: string;
}

interface WarshipSourceContext {
  readonly unit: MatchState["mobileUnits"][number];
  readonly operational: MatchState["warshipOperationalStates"][number];
}

interface EngagementPosition {
  readonly cellId: number;
  readonly traversalWeight: number;
}

interface RankedTarget {
  readonly targetClass: WarshipAutonomousTargetClass;
  readonly unitId: string;
  readonly distanceSquared: bigint;
}

const WARSHIP_OPERATING_LEASH_CELLS = 100;
const TRADE_CAPTURE_RANGE: WarshipExactRange = Object.freeze({
  numerator: 5n,
  denominator: 1n,
});

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function squaredCellDistance(
  state: MatchState,
  leftCellId: number,
  rightCellId: number,
): bigint {
  const left = state.map.positionOf(leftCellId);
  const right = state.map.positionOf(rightCellId);
  const dx = BigInt(right.x - left.x);
  const dy = BigInt(right.y - left.y);
  return dx * dx + dy * dy;
}

function cellWithinExactRange(
  state: MatchState,
  sourceCellId: number,
  targetCellId: number,
  range: WarshipExactRange,
): boolean {
  const squared = squaredCellDistance(state, sourceCellId, targetCellId);
  return (
    squared * range.denominator * range.denominator <=
    range.numerator * range.numerator
  );
}

function operatingLeashContains(
  state: MatchState,
  anchorCellId: number,
  cellId: number,
): boolean {
  const radius = BigInt(WARSHIP_OPERATING_LEASH_CELLS);
  return squaredCellDistance(state, anchorCellId, cellId) <= radius * radius;
}

function strategicTravelActive(
  unit: MatchState["mobileUnits"][number],
): boolean {
  return (
    unit.strategicDestinationCellId !== undefined &&
    unit.strategicDestinationCellId !== unit.cellId
  );
}

function sourceContext(
  state: MatchState,
  unitId: string,
): WarshipSourceContext | undefined {
  const unit = state.mobileUnits.find(
    (candidate) => candidate.id === unitId && candidate.type === "WARSHIP",
  );
  if (unit === undefined) return undefined;
  const operational = state.warshipOperationalStates.find(
    (candidate) => candidate.unitId === unit.id,
  );
  if (operational === undefined) return undefined;
  return Object.freeze({ unit, operational });
}

function targetClassForUnit(
  unit: MatchState["mobileUnits"][number],
): WarshipAutonomousTargetClass | undefined {
  switch (unit.type) {
    case "TRANSPORT_SHIP":
      return "TRANSPORT_SHIP";
    case "WARSHIP":
      return "WARSHIP";
    case "TRADE_SHIP":
      return "TRADE_SHIP";
    case "TANK":
    case "HEAVY_ARTILLERY":
    case "TRAIN":
      return undefined;
  }
}

function classRank(targetClass: WarshipAutonomousTargetClass): number {
  switch (targetClass) {
    case "TRANSPORT_SHIP":
      return 0;
    case "WARSHIP":
      return 1;
    case "TRADE_SHIP":
      return 2;
  }
}

function targetOwnerIsHostile(
  state: MatchState,
  ownerId: string,
  targetOwnerId: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  const targetOwner = state.factions.find(
    (faction) => faction.id === targetOwnerId,
  );
  return (
    owner !== undefined &&
    targetOwner !== undefined &&
    factionRelationBetween(
      relationIdentity(owner),
      relationIdentity(targetOwner),
    ) === "ENEMY"
  );
}

function traversalPolicy(
  state: MatchState,
  source: WarshipSourceContext,
  enforceOperatingLeash: boolean,
): Readonly<{
  policy: NavigationTraversalPolicy;
  movementWorkPerTick: number;
}> {
  const timing = warshipTerrainMovementTiming(
    state,
    source.unit.ownerId,
    "DEEP_WATER",
  );
  if (timing === undefined) {
    throw new Error("Deep Water must be traversable for Warship pursuit");
  }
  const policy: NavigationTraversalPolicy = Object.freeze({
    traversalWeight(fromCellId: number, toCellId: number) {
      for (const cellId of [fromCellId, toCellId]) {
        if (
          state.map.terrainAt(cellId) !== "DEEP_WATER" ||
          (cellId !== source.unit.cellId &&
            (state.structures.some((structure) => structure.cellId === cellId) ||
              state.mobileUnits.some((unit) => unit.cellId === cellId))) ||
          (enforceOperatingLeash &&
            !operatingLeashContains(
              state,
              source.operational.operatingAnchorCellId,
              cellId,
            ))
        ) {
          return undefined;
        }
      }
      return timing.edgeWeight;
    },
  });
  return Object.freeze({
    policy,
    movementWorkPerTick: timing.movementWorkPerTick,
  });
}

function engagementRange(
  state: MatchState,
  sourceOwnerId: string,
  targetClass: WarshipAutonomousTargetClass,
): WarshipExactRange {
  return targetClass === "TRADE_SHIP"
    ? TRADE_CAPTURE_RANGE
    : warshipEffectiveGunRange(state, sourceOwnerId);
}

function minimumEngagementPosition(
  state: MatchState,
  reachable: ReturnType<ReturnType<typeof createNavigation>["reachable"]>,
  targetCellId: number,
  range: WarshipExactRange,
): EngagementPosition | undefined {
  let best: EngagementPosition | undefined;
  for (const entry of reachable.cells) {
    if (!cellWithinExactRange(state, entry.cellId, targetCellId, range)) continue;
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

function shouldReplaceBest(
  candidate: RankedTarget,
  best: RankedTarget | undefined,
): boolean {
  if (best === undefined) return true;
  const candidateRank = classRank(candidate.targetClass);
  const bestRank = classRank(best.targetClass);
  if (candidateRank !== bestRank) return candidateRank < bestRank;
  if (candidate.distanceSquared !== best.distanceSquared) {
    return candidate.distanceSquared < best.distanceSquared;
  }
  return compareIds(candidate.unitId, best.unitId) < 0;
}

function warshipRoamingHash(unitId: string, roamingOrdinal: number): number {
  let hash = 0x811c9dc5;
  const key = `${unitId}\u0000${roamingOrdinal}`;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function warshipRouteInsideOperatingLeash(
  state: MatchState,
  unitId: string,
  cells: readonly number[],
): boolean {
  const source = sourceContext(state, unitId);
  if (source === undefined) return false;
  return cells.every((cellId) =>
    operatingLeashContains(
      state,
      source.operational.operatingAnchorCellId,
      cellId,
    ),
  );
}

export function planWarshipRoamingRoute(
  state: MatchState,
  request: WarshipRoamingRouteRequest,
): WarshipPursuitRoutePlan | undefined {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.unitId !== "string" ||
    request.unitId.length === 0
  ) {
    throw new Error("Warship roaming planning requires a valid request");
  }
  const source = sourceContext(state, request.unitId);
  if (source === undefined) return undefined;
  if (strategicTravelActive(source.unit)) return undefined;

  const candidates: number[] = [];
  for (let y = 0; y < state.map.height; y += 1) {
    for (let x = 0; x < state.map.width; x += 1) {
      const cellId = state.map.cellIdAt(x, y);
      if (
        cellId === undefined ||
        cellId === source.unit.cellId ||
        state.map.terrainAt(cellId) !== "DEEP_WATER" ||
        !operatingLeashContains(
          state,
          source.operational.operatingAnchorCellId,
          cellId,
        )
      ) {
        continue;
      }
      candidates.push(cellId);
    }
  }
  candidates.sort((left, right) => left - right);
  if (candidates.length === 0) return undefined;

  const movement = traversalPolicy(state, source, true);
  const navigation = createNavigation(state.map);
  const startIndex =
    warshipRoamingHash(
      source.unit.id,
      source.operational.roamingOrdinal,
    ) % candidates.length;

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const destinationCellId =
      candidates[(startIndex + offset) % candidates.length]!;
    const path = navigation.path(
      source.unit.cellId,
      destinationCellId,
      movement.policy,
    );
    if (path.status !== "FOUND" || path.path.cells.length <= 1) continue;
    const cells = Object.freeze([...path.path.cells]);
    const edgeWeights = Object.freeze(
      cells.slice(1).map((cellId, index) => {
        const weight = movement.policy.traversalWeight(
          cells[index]!,
          cellId,
        );
        if (weight === undefined) {
          throw new Error("Warship roaming returned an unavailable route edge");
        }
        return weight;
      }),
    );
    return Object.freeze({
      destinationCellId,
      cells,
      edgeWeights,
      movementWorkPerTick: movement.movementWorkPerTick,
    });
  }
  return undefined;
}

export function selectWarshipAutonomousTarget(
  state: MatchState,
  request: WarshipAutonomousTargetRequest,
): WarshipAutonomousTargetSelection | undefined {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.unitId !== "string" ||
    request.unitId.length === 0 ||
    !Array.isArray(request.observedUnitIds)
  ) {
    throw new Error("Warship target selection requires a valid request");
  }
  const source = sourceContext(state, request.unitId);
  if (source === undefined) return undefined;
  const enforceOperatingLeash = !strategicTravelActive(source.unit);
  const observed = new Set(request.observedUnitIds);
  const movement = traversalPolicy(state, source, enforceOperatingLeash);
  const reachable = createNavigation(state.map).reachable(
    source.unit.cellId,
    Number.MAX_SAFE_INTEGER,
    movement.policy,
  );
  const gunfireEnabled = warshipNavalGunfireEnabled(
    state,
    source.unit.ownerId,
  );

  let best: RankedTarget | undefined;
  for (const target of state.mobileUnits) {
    if (target.id === source.unit.id || !observed.has(target.id)) continue;
    const targetClass = targetClassForUnit(target);
    if (targetClass === undefined) continue;
    if (
      !targetOwnerIsHostile(state, source.unit.ownerId, target.ownerId) ||
      (enforceOperatingLeash &&
        !operatingLeashContains(
          state,
          source.operational.operatingAnchorCellId,
          target.cellId,
        ))
    ) {
      continue;
    }
    if (targetClass === "TRADE_SHIP") {
      const capture = tryCaptureTradeShip(state, {
        unitId: target.id,
        capturingFactionId: source.unit.ownerId,
      });
      if (!capture.ok) continue;
    } else if (!gunfireEnabled) {
      continue;
    }

    const range = engagementRange(state, source.unit.ownerId, targetClass);
    if (
      minimumEngagementPosition(
        state,
        reachable,
        target.cellId,
        range,
      ) === undefined
    ) {
      continue;
    }
    const candidate: RankedTarget = Object.freeze({
      targetClass,
      unitId: target.id,
      distanceSquared: squaredCellDistance(
        state,
        source.unit.cellId,
        target.cellId,
      ),
    });
    if (shouldReplaceBest(candidate, best)) best = candidate;
  }

  return best === undefined
    ? undefined
    : Object.freeze({
        targetClass: best.targetClass,
        unitId: best.unitId,
      });
}

export function planWarshipPursuitRoute(
  state: MatchState,
  request: WarshipPursuitRouteRequest,
  target: WarshipAutonomousTargetSelection,
): WarshipPursuitRoutePlan | undefined {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.unitId !== "string" ||
    request.unitId.length === 0
  ) {
    throw new Error("Warship pursuit planning requires a valid request");
  }
  const source = sourceContext(state, request.unitId);
  if (source === undefined) return undefined;
  const targetUnit = state.mobileUnits.find(
    (candidate) => candidate.id === target.unitId,
  );
  if (
    targetUnit === undefined ||
    targetClassForUnit(targetUnit) !== target.targetClass
  ) {
    return undefined;
  }
  const enforceOperatingLeash = !strategicTravelActive(source.unit);
  if (
    enforceOperatingLeash &&
    !operatingLeashContains(
      state,
      source.operational.operatingAnchorCellId,
      targetUnit.cellId,
    )
  ) {
    return undefined;
  }

  const movement = traversalPolicy(state, source, enforceOperatingLeash);
  const navigation = createNavigation(state.map);
  const reachable = navigation.reachable(
    source.unit.cellId,
    Number.MAX_SAFE_INTEGER,
    movement.policy,
  );
  const position = minimumEngagementPosition(
    state,
    reachable,
    targetUnit.cellId,
    engagementRange(state, source.unit.ownerId, target.targetClass),
  );
  if (position === undefined) return undefined;
  const path = navigation.path(
    source.unit.cellId,
    position.cellId,
    movement.policy,
  );
  if (path.status !== "FOUND") return undefined;
  const cells = Object.freeze([...path.path.cells]);
  const edgeWeights = Object.freeze(
    cells.slice(1).map((cellId, index) => {
      const weight = movement.policy.traversalWeight(
        cells[index]!,
        cellId,
      );
      if (weight === undefined) {
        throw new Error("Warship pursuit returned an unavailable route edge");
      }
      return weight;
    }),
  );
  return Object.freeze({
    destinationCellId: position.cellId,
    cells,
    edgeWeights,
    movementWorkPerTick: movement.movementWorkPerTick,
  });
}
