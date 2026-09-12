import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  isTerrainScopeId,
  reducedRational,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { landTerrainBaseSpec } from "./LandOperations";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import type { MobileUnitState } from "./MobileUnits";
import {
  createRadioactiveAttackAftershockResolvedEvent,
  createUnitAttackResolvedEvent,
  createUnitDestroyedEvent,
  type PhysicalUnitSimulationEvent,
  type RadioactiveAttackAftershockResolvedEvent,
  type UnitAttackDestructionCause,
  type UnitEventSubject,
} from "./SimulationEvents";
import type { SimulationTerrain } from "./SimulationMap";
import type {
  SuccessfulTankPopulationShot,
  TankExactHealth,
  TankOperationalState,
} from "./Tanks";

export interface AdmittedTankUnitAttack {
  readonly attackerUnitId: string;
  readonly targetUnitId: string;
}

export interface TankUnitAttackResolution {
  readonly state: MatchState;
  readonly events: readonly PhysicalUnitSimulationEvent[];
}

export interface TankPopulationAftershockResolution {
  readonly state: MatchState;
  readonly events: readonly RadioactiveAttackAftershockResolvedEvent[];
}

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

function unitEventSubject(unit: MobileUnitState): UnitEventSubject {
  return Object.freeze({
    unitId: unit.id,
    ownerId: unit.ownerId,
    unitType: unit.type,
    cellId: unit.cellId,
  });
}

function tankCombatEventId(
  kind: "ATTACK" | "DESTROYED",
  tick: number,
  ordinal: number,
  subjectUnitId: string,
  targetUnitId?: string,
): string {
  return JSON.stringify([
    "TANK_COMBAT",
    kind,
    tick,
    ordinal,
    subjectUnitId,
    ...(targetUnitId === undefined ? [] : [targetUnitId]),
  ]);
}

function tankAftershockEventId(
  tick: number,
  ordinal: number,
  attackerUnitId: string,
  targetCellId: number,
): string {
  return JSON.stringify([
    "TANK_COMBAT",
    "AFTERSHOCK",
    tick,
    ordinal,
    attackerUnitId,
    targetCellId,
  ]);
}

function compareAdmittedTankUnitAttacks(
  left: AdmittedTankUnitAttack,
  right: AdmittedTankUnitAttack,
): number {
  return (
    compareIds(left.attackerUnitId, right.attackerUnitId) ||
    compareIds(left.targetUnitId, right.targetUnitId)
  );
}

function addExactHealth(
  left: TankExactHealth,
  right: TankExactHealth,
): TankExactHealth {
  const sum = reducedRational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
  return Object.freeze({
    numerator: sum.numerator,
    denominator: sum.denominator,
  });
}

function subtractExactHealth(
  left: TankExactHealth,
  right: TankExactHealth,
): TankExactHealth {
  const difference = reducedRational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
  return Object.freeze({
    numerator: difference.numerator,
    denominator: difference.denominator,
  });
}

function compareExactHealth(
  left: TankExactHealth,
  right: TankExactHealth,
): number {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function effectiveTankAntiArmorDamage(
  state: MatchState,
  attacker: MobileUnitState,
): TankExactHealth {
  if (attacker.type !== "TANK" && attacker.type !== "HEAVY_ARTILLERY") {
    throw new Error(`unsupported Tank-derived attacker type: ${attacker.type}`);
  }
  const owner = state.factions.find((faction) => faction.id === attacker.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${attacker.ownerId}`);
  const scope = { kind: "UNIT", unit: "TANK" } as const;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_DAMAGE",
      scope,
      ruleDynamicState(state, attacker.ownerId),
    ),
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_DAMAGE,
    terms,
  );
  const baseDamage = attacker.type === "HEAVY_ARTILLERY" ? 1_000n : 250n;
  const damage = reducedRational(
    baseDamage * scale.numerator,
    scale.denominator,
  );
  if (damage.numerator < 0n || damage.denominator <= 0n) {
    throw new Error("Tank anti-armor damage must resolve to a non-negative value");
  }
  return Object.freeze({
    numerator: damage.numerator,
    denominator: damage.denominator,
  });
}

export function resolveAdmittedTankUnitAttacks(
  state: MatchState,
  attacks: readonly AdmittedTankUnitAttack[],
): TankUnitAttackResolution {
  const unitsById = new Map(state.mobileUnits.map((unit) => [unit.id, unit]));
  const operationalByUnitId = new Map(
    state.tankOperationalStates.map((entry) => [entry.unitId, entry]),
  );
  const factionsById = new Map(state.factions.map((faction) => [faction.id, faction]));
  const causesByTarget = new Map<
    string,
    readonly UnitAttackDestructionCause[]
  >();
  const damageByTarget = new Map<string, TankExactHealth>();
  const attackEvents: PhysicalUnitSimulationEvent[] = [];

  const orderedAttacks = [...attacks].sort(compareAdmittedTankUnitAttacks);
  for (let index = 0; index < orderedAttacks.length; index += 1) {
    const attack = orderedAttacks[index]!;
    const attacker = unitsById.get(attack.attackerUnitId);
    const target = unitsById.get(attack.targetUnitId);
    if (
      attacker === undefined ||
      (attacker.type !== "TANK" && attacker.type !== "HEAVY_ARTILLERY")
    ) {
      throw new Error(
        `admitted Tank unit attack requires a Tank-derived attacker: ${attack.attackerUnitId}`,
      );
    }
    if (target === undefined) {
      throw new Error(
        `admitted Tank unit attack requires an existing target: ${attack.targetUnitId}`,
      );
    }
    if (
      target.type !== "TRAIN" &&
      target.type !== "TANK" &&
      target.type !== "HEAVY_ARTILLERY"
    ) {
      throw new Error(
        `Tank unit attack physical resolver does not yet support target type ${target.type}`,
      );
    }
    if (target.type === "TRAIN" && attacker.type === "HEAVY_ARTILLERY") {
      throw new Error("Heavy Artillery cannot resolve an admitted Train attack");
    }

    const attackerOwner = factionsById.get(attacker.ownerId);
    const targetOwner = factionsById.get(target.ownerId);
    if (attackerOwner === undefined || targetOwner === undefined) {
      throw new Error("admitted Tank unit attack references an unknown unit owner");
    }
    if (
      factionRelationBetween(
        relationIdentity(attackerOwner),
        relationIdentity(targetOwner),
      ) !== "ENEMY"
    ) {
      throw new Error("admitted Tank unit attack requires an enemy target");
    }

    const event = createUnitAttackResolvedEvent({
      id: tankCombatEventId(
        "ATTACK",
        state.tick,
        index,
        attacker.id,
        target.id,
      ),
      tick: state.tick,
      attacker: unitEventSubject(attacker),
      target: unitEventSubject(target),
    });
    attackEvents.push(event);

    const existingCauses = causesByTarget.get(target.id) ?? [];
    causesByTarget.set(
      target.id,
      Object.freeze([
        ...existingCauses,
        Object.freeze({
          kind: "UNIT_ATTACK" as const,
          attackEventId: event.id,
          attacker: event.payload.attacker,
        }),
      ]),
    );

    if (target.type !== "TRAIN") {
      const targetOperational = operationalByUnitId.get(target.id);
      if (targetOperational === undefined) {
        throw new Error(
          `Tank-derived target is missing operational state: ${target.id}`,
        );
      }
      const damage = effectiveTankAntiArmorDamage(state, attacker);
      const existingDamage = damageByTarget.get(target.id);
      damageByTarget.set(
        target.id,
        existingDamage === undefined
          ? damage
          : addExactHealth(existingDamage, damage),
      );
    }
  }

  const destroyedUnitIds = new Set<string>();
  for (const targetId of causesByTarget.keys()) {
    if (unitsById.get(targetId)?.type === "TRAIN") {
      destroyedUnitIds.add(targetId);
    }
  }
  for (const [targetId, damage] of damageByTarget) {
    const operational = operationalByUnitId.get(targetId);
    if (operational === undefined) {
      throw new Error(
        `Tank-derived target is missing operational state: ${targetId}`,
      );
    }
    if (compareExactHealth(damage, operational.health) >= 0) {
      destroyedUnitIds.add(targetId);
    }
  }

  const destroyedIds = [...destroyedUnitIds].sort(compareIds);
  const destructionEvents: PhysicalUnitSimulationEvent[] = [];
  for (let index = 0; index < destroyedIds.length; index += 1) {
    const unitId = destroyedIds[index]!;
    const unit = unitsById.get(unitId);
    if (unit === undefined) {
      throw new Error(`destroyed unit is missing from combat snapshot: ${unitId}`);
    }
    destructionEvents.push(
      createUnitDestroyedEvent({
        id: tankCombatEventId("DESTROYED", state.tick, index, unit.id),
        tick: state.tick,
        unit: unitEventSubject(unit),
        causes: causesByTarget.get(unitId) ?? [],
      }),
    );
  }

  const nextTankOperationalStates = Object.freeze(
    state.tankOperationalStates
      .filter((entry) => !destroyedUnitIds.has(entry.unitId))
      .map((entry): TankOperationalState => {
        const damage = damageByTarget.get(entry.unitId);
        if (damage === undefined) return entry;
        return Object.freeze({
          ...entry,
          health: subtractExactHealth(entry.health, damage),
        });
      }),
  );
  const nextState =
    destroyedUnitIds.size === 0 && damageByTarget.size === 0
      ? state
      : createProspectiveMatchState(state, {
          mobileUnits: state.mobileUnits.filter(
            (unit) => !destroyedUnitIds.has(unit.id),
          ),
          tankOperationalStates: nextTankOperationalStates,
        });

  return Object.freeze({
    state: nextState,
    events: Object.freeze([...attackEvents, ...destructionEvents]),
  });
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
      const neighborOwnerId = state.ownership[neighbor] ?? null;
      if (
        neighborOwnerId !== null &&
        neighborOwnerId !== ownerId &&
        active.has(neighborOwnerId)
      ) {
        contacts.add(neighborOwnerId);
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
  dynamicState: RuleDynamicState,
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
      dynamicState,
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

function hasRadioactiveAftershock(
  faction: MatchState["factions"][number],
): boolean {
  return faction.rules.customDomains.some(
    (entry) => entry.domain === "RADIOACTIVE_ATTACK_AFTERSHOCK",
  );
}

function compareShots(
  left: SuccessfulTankPopulationShot,
  right: SuccessfulTankPopulationShot,
): number {
  return (
    compareIds(left.attackerUnitId, right.attackerUnitId) ||
    compareIds(left.targetFactionId, right.targetFactionId) ||
    left.targetCellId - right.targetCellId
  );
}

export function resolveTankPopulationAftershocks(
  state: MatchState,
  shots: readonly SuccessfulTankPopulationShot[],
): TankPopulationAftershockResolution {
  const structureCells = new Set(
    state.structures.map((structure) => structure.cellId),
  );
  const dynamicStateByFaction = new Map<string, RuleDynamicState>();
  const events: RadioactiveAttackAftershockResolvedEvent[] = [];

  const dynamicStateFor = (ownerId: string): RuleDynamicState => {
    const existing = dynamicStateByFaction.get(ownerId);
    if (existing !== undefined) return existing;
    const created = ruleDynamicState(state, ownerId);
    dynamicStateByFaction.set(ownerId, created);
    return created;
  };

  for (const shot of [...shots].sort(compareShots)) {
    if (!state.map.isValidCellId(shot.targetCellId)) {
      throw new Error("Tank Population aftershock requires a valid target cell");
    }
    const attackerUnit = state.mobileUnits.find(
      (unit) => unit.id === shot.attackerUnitId,
    );
    if (
      attackerUnit === undefined ||
      (attackerUnit.type !== "TANK" &&
        attackerUnit.type !== "HEAVY_ARTILLERY")
    ) {
      throw new Error(
        `Tank Population aftershock requires a Tank-derived attacker: ${shot.attackerUnitId}`,
      );
    }
    const attackerOwner = state.factions.find(
      (faction) => faction.id === attackerUnit.ownerId,
    );
    if (attackerOwner === undefined) {
      throw new Error(`unknown faction: ${attackerUnit.ownerId}`);
    }
    if (!hasRadioactiveAftershock(attackerOwner)) continue;

    const radius = attackerUnit.type === "HEAVY_ARTILLERY" ? 5 : 2;
    const cap = attackerUnit.type === "HEAVY_ARTILLERY" ? 50 : 10;
    const center = state.map.positionOf(shot.targetCellId);
    const candidates: Array<Readonly<{ cellId: number; distance: number }>> = [];

    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance > radius) continue;
        const cellId = state.map.cellIdAt(center.x + dx, center.y + dy);
        if (cellId === undefined || structureCells.has(cellId)) continue;
        const targetOwnerId = state.ownership[cellId] ?? null;
        if (targetOwnerId === null) continue;
        const targetOwner = state.factions.find(
          (faction) => faction.id === targetOwnerId,
        );
        if (
          targetOwner === undefined ||
          factionRelationBetween(
            relationIdentity(attackerOwner),
            relationIdentity(targetOwner),
          ) !== "ENEMY" ||
          !effectivePopulationBearing(
            state,
            targetOwner,
            cellId,
            dynamicStateFor(targetOwner.id),
          )
        ) {
          continue;
        }
        candidates.push(Object.freeze({ cellId, distance }));
      }
    }

    candidates.sort(
      (left, right) =>
        left.distance - right.distance || left.cellId - right.cellId,
    );
    const affectedCellIds = Object.freeze(
      candidates.slice(0, cap).map((candidate) => candidate.cellId),
    );
    events.push(
      createRadioactiveAttackAftershockResolvedEvent({
        id: tankAftershockEventId(
          state.tick,
          events.length,
          attackerUnit.id,
          shot.targetCellId,
        ),
        tick: state.tick,
        attacker: unitEventSubject(attackerUnit),
        targetCellId: shot.targetCellId,
        affectedCellIds,
      }),
    );
  }

  return Object.freeze({
    state,
    events: Object.freeze(events),
  });
}
