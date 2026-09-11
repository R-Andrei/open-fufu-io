import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  isTerrainScopeId,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { landTerrainBaseSpec } from "./LandOperations";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import type { SimulationTerrain } from "./SimulationMap";
import type { SuccessfulTankPopulationShot } from "./Tanks";

export interface TankPopulationAftershockEffect {
  readonly attackerUnitId: string;
  readonly targetCellId: number;
  readonly affectedCellIds: readonly number[];
}

export interface TankPopulationAftershockResolution {
  readonly state: MatchState;
  readonly effects: readonly TankPopulationAftershockEffect[];
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
  const aftershockCells = new Set<number>();
  const effects: TankPopulationAftershockEffect[] = [];

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
    for (const cellId of affectedCellIds) aftershockCells.add(cellId);
    effects.push(
      Object.freeze({
        attackerUnitId: shot.attackerUnitId,
        targetCellId: shot.targetCellId,
        affectedCellIds,
      }),
    );
  }

  let nextState = state;
  if (aftershockCells.size > 0) {
    const ownership = [...state.ownership];
    const fallout = [...state.fallout];
    for (const cellId of [...aftershockCells].sort((left, right) => left - right)) {
      ownership[cellId] = null;
      fallout[cellId] = true;
    }
    nextState = createProspectiveMatchState(state, { ownership, fallout });
  }

  return Object.freeze({
    state: nextState,
    effects: Object.freeze(effects),
  });
}
