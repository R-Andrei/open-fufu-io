import { reducedRational } from "../core/rules/RuleComposition";
import {
  createHomingCombatProjectile,
  type HomingCombatProjectileImpact,
} from "./CombatProjectiles";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import { applyTransportDamage } from "./Transports";
import {
  createProjectileImpactResolvedEvent,
  createUnitDestroyedEvent,
  type PhysicalUnitSimulationEvent,
  type UnitEventSubject,
} from "./SimulationEvents";
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


export interface WarshipProjectileImpactResolution {
  readonly state: MatchState;
  readonly events: readonly PhysicalUnitSimulationEvent[];
  readonly unresolvedImpacts: readonly HomingCombatProjectileImpact[];
}

function compareProjectileImpacts(
  left: HomingCombatProjectileImpact,
  right: HomingCombatProjectileImpact,
): number {
  return (
    compareIds(left.sourceUnitId, right.sourceUnitId) ||
    left.projectileOrdinal - right.projectileOrdinal ||
    compareIds(left.targetUnitId, right.targetUnitId)
  );
}

function projectileEventSubject(
  impact: HomingCombatProjectileImpact,
): Readonly<{
  sourceUnitId: string;
  sourceOwnerId: string;
  projectileOrdinal: number;
  profileId: string;
}> {
  return Object.freeze({
    sourceUnitId: impact.sourceUnitId,
    sourceOwnerId: impact.sourceOwnerId,
    projectileOrdinal: impact.projectileOrdinal,
    profileId: impact.profileId,
  });
}

function unitEventSubject(
  unit: MatchState["mobileUnits"][number],
): UnitEventSubject {
  return Object.freeze({
    unitId: unit.id,
    ownerId: unit.ownerId,
    unitType: unit.type,
    cellId: unit.cellId,
  });
}

function subtractWarshipHealth(
  health: MatchState["warshipOperationalStates"][number]["health"],
  damage: HomingCombatProjectileImpact["damage"],
): MatchState["warshipOperationalStates"][number]["health"] {
  const reduced = reducedRational(
    health.numerator * damage.denominator -
      damage.numerator * health.denominator,
    health.denominator * damage.denominator,
  );
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

function warshipProjectileEventId(
  kind: "IMPACT" | "DESTROYED",
  tick: number,
  impact: HomingCombatProjectileImpact,
): string {
  return JSON.stringify([
    "WARSHIP_PROJECTILE",
    kind,
    tick,
    impact.sourceUnitId,
    impact.projectileOrdinal,
    impact.targetUnitId,
  ]);
}

/**
 * Consumes ordered projectile arrivals whose current target is a Warship.
 * Live non-Warship targets remain unresolved for their focused destruction
 * owner; missing targets are consumed harmlessly because an earlier ordered
 * impact has already removed them.
 */
export function resolveWarshipProjectileImpacts(
  state: MatchState,
  impacts: readonly HomingCombatProjectileImpact[],
): WarshipProjectileImpactResolution {
  let mobileUnits = [...state.mobileUnits];
  let operationalStates = [...state.warshipOperationalStates];
  const events: PhysicalUnitSimulationEvent[] = [];
  const unresolvedImpacts: HomingCombatProjectileImpact[] = [];
  let changed = false;

  for (const impact of [...impacts].sort(compareProjectileImpacts)) {
    const target = mobileUnits.find((unit) => unit.id === impact.targetUnitId);
    if (target === undefined) {
      continue;
    }
    if (target.type !== "WARSHIP") {
      unresolvedImpacts.push(impact);
      continue;
    }
    const operationalIndex = operationalStates.findIndex(
      (entry) => entry.unitId === target.id,
    );
    if (operationalIndex < 0) {
      throw new Error(
        `projectile-targeted Warship is missing operational state: ${target.id}`,
      );
    }
    const operational = operationalStates[operationalIndex]!;
    const impactEvent = createProjectileImpactResolvedEvent({
      id: warshipProjectileEventId("IMPACT", state.tick, impact),
      tick: state.tick,
      projectile: projectileEventSubject(impact),
      target: unitEventSubject(target),
    });
    events.push(impactEvent);

    const nextHealth = subtractWarshipHealth(operational.health, impact.damage);
    changed = true;
    if (nextHealth.numerator <= 0n) {
      const destructionEvent = createUnitDestroyedEvent({
        id: warshipProjectileEventId("DESTROYED", state.tick, impact),
        tick: state.tick,
        unit: unitEventSubject(target),
        causes: [
          Object.freeze({
            kind: "PROJECTILE_IMPACT" as const,
            impactEventId: impactEvent.id,
            projectile: projectileEventSubject(impact),
          }),
        ],
      });
      events.push(destructionEvent);
      mobileUnits = mobileUnits.filter((unit) => unit.id !== target.id);
      operationalStates = operationalStates.filter(
        (entry) => entry.unitId !== target.id,
      );
      continue;
    }

    operationalStates[operationalIndex] = Object.freeze({
      ...operational,
      health: nextHealth,
    });
  }

  return Object.freeze({
    state:
      changed
        ? createProspectiveMatchState(state, {
            mobileUnits: Object.freeze(mobileUnits),
            warshipOperationalStates: Object.freeze(operationalStates),
          })
        : state,
    events: Object.freeze(events),
    unresolvedImpacts: Object.freeze(unresolvedImpacts),
  });
}



/**
 * Resolves one globally ordered Naval gun projectile-impact stream across the
 * focused Warship and Transport damage owners. Other target classes remain
 * unresolved for their owning subsystem.
 */
export function resolveWarshipNavalProjectileImpacts(
  state: MatchState,
  impacts: readonly HomingCombatProjectileImpact[],
): WarshipProjectileImpactResolution {
  let current = state;
  const events: PhysicalUnitSimulationEvent[] = [];
  const unresolvedImpacts: HomingCombatProjectileImpact[] = [];

  for (const impact of [...impacts].sort(compareProjectileImpacts)) {
    if (impact.profileId !== WARSHIP_GUN_PROFILE_ID) {
      unresolvedImpacts.push(impact);
      continue;
    }
    const target = current.mobileUnits.find(
      (unit) => unit.id === impact.targetUnitId,
    );
    if (target === undefined) {
      continue;
    }

    if (target.type === "WARSHIP") {
      const resolved = resolveWarshipProjectileImpacts(current, [impact]);
      current = resolved.state;
      events.push(...resolved.events);
      unresolvedImpacts.push(...resolved.unresolvedImpacts);
      continue;
    }

    if (target.type === "TRANSPORT_SHIP") {
      const impactEvent = createProjectileImpactResolvedEvent({
        id: warshipProjectileEventId("IMPACT", current.tick, impact),
        tick: current.tick,
        projectile: projectileEventSubject(impact),
        target: unitEventSubject(target),
      });
      const damaged = applyTransportDamage(current, {
        transportId: target.id,
        damage: impact.damage,
        causeClass: "NAVAL_GUNFIRE",
        creditedDestroyerFactionId: impact.sourceOwnerId,
      });
      current = damaged.state;
      events.push(impactEvent);

      if (damaged.destructionResult !== null) {
        events.push(
          createUnitDestroyedEvent({
            id: warshipProjectileEventId("DESTROYED", current.tick, impact),
            tick: current.tick,
            unit: unitEventSubject(target),
            causes: [
              Object.freeze({
                kind: "PROJECTILE_IMPACT" as const,
                impactEventId: impactEvent.id,
                projectile: projectileEventSubject(impact),
              }),
            ],
          }),
        );
      }
      continue;
    }

    unresolvedImpacts.push(impact);
  }

  return Object.freeze({
    state: current,
    events: Object.freeze(events),
    unresolvedImpacts: Object.freeze(unresolvedImpacts),
  });
}
