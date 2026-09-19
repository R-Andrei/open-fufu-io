import { createHomingCombatProjectile } from "./CombatProjectiles";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  selectWarshipAutonomousTarget,
} from "./WarshipTargeting";
import { projectWarshipTargetObservation } from "./VisibilityState";
import {
  warshipEffectiveGunDamage,
  warshipEffectiveGunRange,
} from "./Warships";

const WARSHIP_PROJECTILE_SPEED_CELLS_PER_SECOND = 75;
const WARSHIP_GUN_COOLDOWN_TICKS = 20;
const WARSHIP_GUN_PROFILE_ID = "WARSHIP_NAVAL_GUN";

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cellWithinExactRange(
  state: MatchState,
  sourceCellId: number,
  targetCellId: number,
  range: Readonly<{ numerator: bigint; denominator: bigint }>,
): boolean {
  const source = state.map.positionOf(sourceCellId);
  const target = state.map.positionOf(targetCellId);
  const dx = BigInt(target.x - source.x);
  const dy = BigInt(target.y - source.y);
  const distanceSquared = dx * dx + dy * dy;
  return (
    distanceSquared * range.denominator * range.denominator <=
    range.numerator * range.numerator
  );
}

/**
 * Resolves only Warship firing decisions from one frozen authoritative state.
 * It never applies impact damage: firing materializes target-bound projectiles,
 * while the generic projectile/impact phase owns later travel and arrival.
 */
export function resolveWarshipGunfireDecisions(state: MatchState): MatchState {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const observationByOwner = new Map<
    string,
    ReturnType<typeof projectWarshipTargetObservation>
  >();
  const operationalUpdates = new Map<
    string,
    MatchState["warshipOperationalStates"][number]
  >();
  const spawned = [];

  for (const operational of [...state.warshipOperationalStates].sort((left, right) =>
    compareIds(left.unitId, right.unitId),
  )) {
    if (operational.attackReadyAtTick > state.tick) continue;
    const source = unitsById.get(operational.unitId);
    if (source === undefined || source.type !== "WARSHIP") {
      throw new Error(
        `Warship gunfire operational state has no deployed source: ${operational.unitId}`,
      );
    }

    let observation = observationByOwner.get(source.ownerId);
    if (observation === undefined) {
      observation = projectWarshipTargetObservation(state, source.ownerId);
      observationByOwner.set(source.ownerId, observation);
    }
    const selected = selectWarshipAutonomousTarget(state, {
      unitId: source.id,
      observedUnitIds: observation.observedUnitIds,
    });
    if (
      selected === undefined ||
      selected.targetClass === "TRADE_SHIP"
    ) {
      continue;
    }
    const target = unitsById.get(selected.unitId);
    if (target === undefined) continue;

    const range = warshipEffectiveGunRange(state, source.ownerId);
    if (!cellWithinExactRange(state, source.cellId, target.cellId, range)) {
      continue;
    }
    if (operational.nextProjectileOrdinal >= Number.MAX_SAFE_INTEGER) {
      throw new Error(`Warship projectile ordinal is exhausted: ${source.id}`);
    }
    const nextReadyTick = state.tick + WARSHIP_GUN_COOLDOWN_TICKS;
    if (!Number.isSafeInteger(nextReadyTick)) {
      throw new Error("Warship gun cooldown exceeds safe-integer tick range");
    }

    const sourcePosition = state.map.positionOf(source.cellId);
    spawned.push(
      createHomingCombatProjectile({
        sourceUnitId: source.id,
        sourceOwnerId: source.ownerId,
        targetUnitId: target.id,
        projectileOrdinal: operational.nextProjectileOrdinal,
        profileId: WARSHIP_GUN_PROFILE_ID,
        position: Object.freeze({
          x: sourcePosition.x,
          y: sourcePosition.y,
        }),
        speedCellsPerSecond: WARSHIP_PROJECTILE_SPEED_CELLS_PER_SECOND,
        damage: warshipEffectiveGunDamage(state, source.ownerId),
        createdTick: state.tick,
      }),
    );
    operationalUpdates.set(
      operational.unitId,
      Object.freeze({
        ...operational,
        attackReadyAtTick: nextReadyTick,
        nextProjectileOrdinal: operational.nextProjectileOrdinal + 1,
      }),
    );
  }

  if (spawned.length === 0) return state;
  return createProspectiveMatchState(state, {
    combatProjectiles: Object.freeze([...state.combatProjectiles, ...spawned]),
    warshipOperationalStates: state.warshipOperationalStates.map(
      (operational) =>
        operationalUpdates.get(operational.unitId) ?? operational,
    ),
  });
}
