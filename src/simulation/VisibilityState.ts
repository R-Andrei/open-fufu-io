import { factionRelationBetween } from "../core/FactionRelations";
import type { CellId } from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import { ruleScopeMatches } from "../core/rules/RuleComposition";
import {
  materializeCompiledScalarScaleFactor,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromRangeFactor,
  type StructureRadialFieldProfile,
} from "../core/rules/StructureFieldGeometry";
import {
  isDirectRevealActive,
  isOwnedForestConcealmentCell,
  pruneExpiredDirectReveals,
  refreshDirectRevealRecords,
  resolveTacticalVisibility,
  type DirectRevealRecord,
} from "../core/visibility/TacticalVisibility";
import type { MatchFactionState, MatchState } from "./MatchState";
import type { PhysicalUnitSimulationEvent } from "./SimulationEvents";
import type { PersistentStructureState } from "./Structures";

const V1_SIMULATION_TICKS_PER_SECOND = 10 as const;
const OBSERVATION_POST_BASELINE_RADII = Object.freeze([
  40,
  55,
  70,
  85,
  100,
] as const);

interface ObservationFieldSource {
  readonly centerCellId: CellId;
  readonly profile: StructureRadialFieldProfile;
}

export interface TankTargetObservation {
  readonly observedUnitIds: readonly string[];
  readonly observedCellIds: readonly CellId[];
}

function factionById(
  state: MatchState,
  factionId: string,
): MatchFactionState | undefined {
  return state.factions.find((faction) => faction.id === factionId);
}

function factionIdentity(faction: MatchFactionState) {
  return Object.freeze({
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  });
}

function factionHasP45ForestConcealment(
  state: MatchState,
  factionId: string,
): boolean {
  return (
    factionById(state, factionId)?.rules.customDomains.some(
      (entry) =>
        entry.sourceKind === "ORIGIN" &&
        entry.sourceId === "P45" &&
        entry.domain === "FOREST_CONCEALMENT",
    ) ?? false
  );
}

function factionHasP49EnemyBlackout(
  state: MatchState,
  factionId: string,
): boolean {
  const faction = factionById(state, factionId);
  if (faction === undefined) return false;
  return faction.rules.normalizedRules.some(
    (entry) =>
      entry.axis === "STRUCTURE_EFFECT_PROFILE" &&
      ruleScopeMatches(entry.scope, {
        kind: "STRUCTURE",
        structure: "OBSERVATION_POST",
      }) &&
      entry.value.kind === "SINGLETON" &&
      entry.value.value === "ENEMY_BLACKOUT",
  );
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

function createDynamicStateResolver(state: MatchState) {
  const cache = new Map<string, RuleDynamicState>();
  return (ownerId: string): RuleDynamicState => {
    const cached = cache.get(ownerId);
    if (cached !== undefined) return cached;
    const owner = factionById(state, ownerId);
    if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
    const resolved = Object.freeze({
      ownedPersistentStructureCount: state.structures.filter(
        (structure) => structure.ownerId === ownerId,
      ).length,
      territorialContactCount: territorialContactCount(state, ownerId),
      peakTotalPopulation: owner.population.peakTotal,
    });
    cache.set(ownerId, resolved);
    return resolved;
  };
}

function tankObservationField(
  state: MatchState,
  unit: MatchState["mobileUnits"][number],
  dynamicState: (ownerId: string) => RuleDynamicState,
): ObservationFieldSource {
  const owner = factionById(state, unit.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${unit.ownerId}`);
  const scale = materializeCompiledScalarScaleFactor(
    owner.rules,
    RULE_AXIS_REGISTRY,
    "UNIT_ATTACK_RANGE",
    { kind: "UNIT", unit: "TANK" },
    dynamicState(owner.id),
  );
  const baselineRadius = unit.type === "HEAVY_ARTILLERY" ? 45 : 30;
  return Object.freeze({
    centerCellId: unit.cellId,
    profile: structureRadialFieldFromRangeFactor(
      baselineRadius,
      scale.numerator,
      scale.denominator,
    ),
  });
}

function observationPostField(
  state: MatchState,
  structure: PersistentStructureState,
  dynamicState: (ownerId: string) => RuleDynamicState,
): ObservationFieldSource | undefined {
  if (
    structure.type !== "OBSERVATION_POST" ||
    !structure.active ||
    structure.completedLevel === undefined
  ) {
    return undefined;
  }
  const owner = factionById(state, structure.ownerId);
  if (owner === undefined) {
    throw new Error(`structure ${structure.id} has unknown owner ${structure.ownerId}`);
  }
  const scale = materializeCompiledScalarScaleFactor(
    owner.rules,
    RULE_AXIS_REGISTRY,
    "STRUCTURE_OBSERVATION_RADIUS",
    { kind: "STRUCTURE", structure: "OBSERVATION_POST" },
    dynamicState(owner.id),
  );
  const baselineRadius = OBSERVATION_POST_BASELINE_RADII[structure.completedLevel - 1];
  if (baselineRadius === undefined) {
    throw new Error(`Observation Post ${structure.id} has unsupported completed level`);
  }
  return Object.freeze({
    centerCellId: structure.cellId,
    profile: structureRadialFieldFromRangeFactor(
      baselineRadius,
      scale.numerator,
      scale.denominator,
    ),
  });
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error("observation radius ceilDiv requires non-negative/positive inputs");
  }
  return (numerator + denominator - 1n) / denominator;
}

function floorSqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("observation radius square root cannot be negative");
  if (value < 2n) return value;
  let current = 1n << (BigInt(value.toString(2).length) + 1n >> 1n);
  while (true) {
    const next = (current + value / current) >> 1n;
    if (next >= current) return current;
    current = next;
  }
}

function fieldBoundingRadius(profile: StructureRadialFieldProfile): number {
  if (profile.empty) return 0;
  const squaredCeiling = ceilDiv(
    profile.squaredRadiusNumerator,
    profile.squaredRadiusDenominator,
  );
  let radius = floorSqrt(squaredCeiling);
  if (radius * radius < squaredCeiling) radius += 1n;
  if (radius > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("observation radius exceeds safe-integer range");
  }
  return Number(radius);
}

function addFieldCells(
  state: MatchState,
  source: ObservationFieldSource,
  cells: Set<CellId>,
): void {
  if (source.profile.empty) return;
  const center = state.map.positionOf(source.centerCellId);
  const radius = fieldBoundingRadius(source.profile);
  const minX = Math.max(0, center.x - radius);
  const maxX = Math.min(state.map.width - 1, center.x + radius);
  const minY = Math.max(0, center.y - radius);
  const maxY = Math.min(state.map.height - 1, center.y + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cellId = state.map.cellIdAt(x, y);
      if (
        cellId !== undefined &&
        structureRadialFieldContainsCell(
          source.profile,
          center.x,
          center.y,
          x,
          y,
        )
      ) {
        cells.add(cellId);
      }
    }
  }
}

function p45ConcealsCell(
  state: MatchState,
  viewerFactionId: string,
  cellId: CellId,
): boolean {
  const holderId = state.ownership[cellId] ?? undefined;
  if (
    holderId === undefined ||
    holderId === viewerFactionId ||
    !factionHasP45ForestConcealment(state, holderId)
  ) {
    return false;
  }
  return isOwnedForestConcealmentCell(
    state.map.terrainAt(cellId),
    holderId,
    holderId,
  );
}

function activeUnitDirectReveal(
  state: MatchState,
  viewerFactionId: string,
  unitId: string,
): boolean {
  return state.directReveals.some(
    (record) =>
      record.viewerFactionId === viewerFactionId &&
      record.sourceKind === "UNIT" &&
      record.sourceId === unitId &&
      isDirectRevealActive(state.tick, record.expiryExclusiveTick),
  );
}

/**
 * Derives the lawful current unit/cell observation sets consumed by autonomous
 * Tank targeting. Direct reveal is source-specific and therefore never adds the
 * source cell to observedCellIds.
 */
export function projectTankTargetObservation(
  state: MatchState,
  viewerFactionId: string,
): TankTargetObservation {
  const viewer = factionById(state, viewerFactionId);
  if (viewer === undefined) throw new Error(`unknown faction: ${viewerFactionId}`);
  const dynamicState = createDynamicStateResolver(state);
  const ordinarySources: ObservationFieldSource[] = [];
  const blackoutSources: ObservationFieldSource[] = [];

  for (const unit of state.mobileUnits) {
    if (
      unit.ownerId !== viewerFactionId ||
      (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY")
    ) {
      continue;
    }
    const operational = state.tankOperationalStates.find(
      (entry) => entry.unitId === unit.id,
    );
    if (operational === undefined || operational.eligibleFromTick > state.tick) {
      continue;
    }
    ordinarySources.push(tankObservationField(state, unit, dynamicState));
  }

  for (const structure of state.structures) {
    if (structure.type !== "OBSERVATION_POST") continue;
    const source = observationPostField(state, structure, dynamicState);
    if (source === undefined) continue;
    const blackout = factionHasP49EnemyBlackout(state, structure.ownerId);
    if (structure.ownerId === viewerFactionId && !blackout) {
      ordinarySources.push(source);
      continue;
    }
    if (!blackout) continue;
    const owner = factionById(state, structure.ownerId);
    if (
      owner !== undefined &&
      factionRelationBetween(factionIdentity(viewer), factionIdentity(owner)) ===
        "ENEMY"
    ) {
      blackoutSources.push(source);
    }
  }

  const ordinaryCells = new Set<CellId>();
  const blackoutCells = new Set<CellId>();
  for (const source of ordinarySources) addFieldCells(state, source, ordinaryCells);
  for (const source of blackoutSources) addFieldCells(state, source, blackoutCells);

  const observedCellIds = Object.freeze(
    [...ordinaryCells]
      .filter(
        (cellId) =>
          !blackoutCells.has(cellId) &&
          !p45ConcealsCell(state, viewerFactionId, cellId),
      )
      .sort((left, right) => left - right),
  );

  const observedUnitIds = Object.freeze(
    state.mobileUnits
      .filter((unit) => {
        const concealed =
          blackoutCells.has(unit.cellId) ||
          p45ConcealsCell(state, viewerFactionId, unit.cellId);
        return resolveTacticalVisibility({
          selfOwned: unit.ownerId === viewerFactionId,
          explicitPublic: false,
          directRevealActive: activeUnitDirectReveal(
            state,
            viewerFactionId,
            unit.id,
          ),
          concealed,
          remotelyObserved: ordinaryCells.has(unit.cellId),
        }).visible;
      })
      .map((unit) => unit.id)
      .sort(),
  );

  return Object.freeze({ observedUnitIds, observedCellIds });
}

/**
 * Applies physical-combat visibility consequences after the producer has
 * committed its owned state. Attack facts refresh source-specific reveal for
 * the directly attacked faction; destruction facts prevent reveal ghosts.
 */
export function resolveDirectRevealsFromPhysicalEvents(
  state: Readonly<Pick<MatchState, "directReveals">>,
  events: readonly PhysicalUnitSimulationEvent[],
  currentTick: number,
): readonly DirectRevealRecord[] {
  let directReveals = pruneExpiredDirectReveals(
    state.directReveals,
    currentTick,
  );
  const destroyedUnitIds = new Set<string>();

  for (const event of events) {
    if (event.kind === "UNIT_DESTROYED") {
      destroyedUnitIds.add(event.payload.unit.unitId);
      continue;
    }

    directReveals = refreshDirectRevealRecords(
      directReveals,
      {
        resolved: true,
        hostile: true,
        identifiableSource: true,
        attackedFactionIds: [event.payload.target.ownerId],
      },
      "UNIT",
      event.payload.attacker.unitId,
      event.tick,
      V1_SIMULATION_TICKS_PER_SECOND,
    );
  }

  if (destroyedUnitIds.size === 0) return directReveals;

  return Object.freeze(
    directReveals.filter(
      (record) =>
        record.sourceKind !== "UNIT" ||
        !destroyedUnitIds.has(record.sourceId),
    ),
  );
}
