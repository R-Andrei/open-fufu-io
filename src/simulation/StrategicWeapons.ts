import type { StrategicWeaponType } from "../core/controller/ControllerApi";
import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  selectRuleContributionsForScope,
  type RuleConditions,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  materializeCompiledScalarRule,
  materializeCompiledScalarScaleFactor,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { tryDebitFfy } from "./Economy";
import { applyOneShotDirectedHostility } from "./HostilityState";
import {
  createProspectiveMatchState,
  type MatchState,
  type StrategicBlastProfileState,
  type StrategicProjectileState,
} from "./MatchState";
import {
  effectiveStructureRechargeTicks,
  materializePersistentStructures,
  type PersistentStructureState,
  type StructureChargeSlotState,
} from "./Structures";

const BASE_WEAPON_FFY_COST = Object.freeze({
  ATOM_BOMB: 1_000_000,
  HYDROGEN_BOMB: 10_000_000,
  MIRV: 50_000_000,
} satisfies Readonly<Record<StrategicWeaponType, number>>);

const BASE_PROJECTILE_SPEED = Object.freeze({
  ATOM_BOMB: 100,
  HYDROGEN_BOMB: 100,
  MIRV: 150,
} satisfies Readonly<Record<StrategicWeaponType, number>>);

const BASE_WARHEAD_BLAST_RADIUS = Object.freeze({
  ATOM_BOMB: Object.freeze({ inner: 12, outer: 30 }),
  HYDROGEN_BOMB: Object.freeze({ inner: 80, outer: 100 }),
  MIRV: Object.freeze({ inner: 12, outer: 18 }),
} satisfies Readonly<
  Record<StrategicWeaponType, Readonly<{ inner: number; outer: number }>>
>);

const BASE_MIRV_CHILD_SPEED = 220;
const MIRV_DISTRIBUTION_RADIUS_CELLS = 750;
const MIRV_MINIMUM_CENTER_SPACING_CELLS = 55;
const MIRV_MAX_CHILDREN = 250;

const CANONICAL_WEAPON_ORDER = Object.freeze({
  ATOM_BOMB: 0,
  HYDROGEN_BOMB: 1,
  MIRV: 2,
} satisfies Readonly<Record<StrategicWeaponType, number>>);

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export interface StrategicLaunchRequest {
  readonly ownerId: string;
  readonly launcherId: string;
  readonly weapon: StrategicWeaponType;
  readonly targetCellId: number;
  readonly targetFactionId?: string;
}

export interface StrategicLaunchCommitRequest {
  readonly ownerId: string;
  readonly launcherId: string;
  readonly weapon: StrategicWeaponType;
  readonly targetCellId: number;
  readonly targetFactionId?: string;
}

export interface StrategicLaunchReservation {
  readonly chargeSlotId: number;
  readonly acceptedLaunchOrdinal: number;
}

export interface StrategicLaunchReservationCandidate {
  readonly sequence: number;
  readonly ownerId: string;
  readonly launcherId: string;
  readonly weapon: StrategicWeaponType;
  readonly targetCellId: number;
}

export type StrategicLaunchFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "UNKNOWN_LAUNCHER"
  | "NOT_OWNER"
  | "LAUNCHER_INACTIVE"
  | "LAUNCHER_LEVEL_REQUIRED"
  | "WEAPON_NOT_PERMITTED"
  | "INVALID_TARGET"
  | "NO_READY_CHARGE"
  | "INSUFFICIENT_FFY";

export type StrategicLaunchQuoteResult =
  | Readonly<{
      readonly ok: true;
      readonly ffyCost: number;
      readonly ffySpent: number;
      readonly chargeSlotId: number;
      readonly acceptedLaunchOrdinal: number;
      readonly launchCellId: number;
      readonly targetFactionId?: string;
    }>
  | Readonly<{
      readonly ok: false;
      readonly ffyCost: number;
      readonly failure: Readonly<{ readonly code: StrategicLaunchFailureCode }>;
    }>;

export type StrategicLaunchCommitResult =
  | Readonly<{
      readonly ok: true;
      readonly state: MatchState;
      readonly ffyCost: number;
      readonly projectile: StrategicProjectileState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly state: MatchState;
      readonly ffyCost: number;
      readonly failure: Readonly<{ readonly code: StrategicLaunchFailureCode }>;
    }>;

const utf8Encoder = new TextEncoder();

function fnv1a32LengthPrefixed(
  values: readonly (string | number)[],
): number {
  let hash = 0x811c9dc5;
  for (const value of values) {
    if (
      typeof value === "number" &&
      (!Number.isSafeInteger(value) || Object.is(value, -0))
    ) {
      throw new Error("strategic blast hash numeric key must be an exact integer");
    }
    const payload = utf8Encoder.encode(String(value));
    const length = payload.length >>> 0;
    const bytes = new Uint8Array(4 + payload.length);
    bytes[0] = length & 0xff;
    bytes[1] = (length >>> 8) & 0xff;
    bytes[2] = (length >>> 16) & 0xff;
    bytes[3] = (length >>> 24) & 0xff;
    bytes.set(payload, 4);
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

export function strategicBlastHash32(
  domain: string,
  matchSeed: string,
  ...canonicalKeys: readonly (string | number)[]
): number {
  return fnv1a32LengthPrefixed([
    domain,
    "STRATEGIC_BLAST_V1",
    matchSeed,
    ...canonicalKeys,
  ]);
}

function strategicRuleConditionsApplyToWarhead(
  conditions: RuleConditions,
): boolean {
  return conditions.every(
    (condition) => condition.kind === "PROJECTILE_IS_WARHEAD",
  );
}

function exactPositiveSafeNumber(value: bigint, label: string): number {
  if (value <= 0n || value > MAX_SAFE_BIGINT) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return Number(value);
}

function effectiveWarheadProjectileSpeed(
  state: MatchState,
  ownerId: string,
  weapon: StrategicWeaponType,
  baseSpeed = BASE_PROJECTILE_SPEED[weapon],
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const effective = materializeCompiledScalarRule(
    baseSpeed,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "WEAPON_PROJECTILE_SPEED",
    { kind: "WEAPON", weapon },
    ruleDynamicState(state, ownerId),
    strategicRuleConditionsApplyToWarhead,
  );
  if (!Number.isFinite(effective) || effective <= 0) {
    throw new Error("strategic warhead projectile speed must resolve positive");
  }
  return effective;
}

function effectiveWarheadBlastProfile(
  state: MatchState,
  ownerId: string,
  weapon: StrategicWeaponType,
): StrategicBlastProfileState {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scale = materializeCompiledScalarScaleFactor(
    owner.rules,
    RULE_AXIS_REGISTRY,
    "WEAPON_BLAST_AREA",
    { kind: "WEAPON", weapon },
    ruleDynamicState(state, ownerId),
  );
  if (scale.numerator <= 0n || scale.denominator <= 0n) {
    throw new Error("strategic blast-area scale must resolve positive");
  }
  const baseline = BASE_WARHEAD_BLAST_RADIUS[weapon];
  return Object.freeze({
    profileVersion: "STRATEGIC_BLAST_V1" as const,
    innerNumerator: exactPositiveSafeNumber(
      BigInt(baseline.inner * baseline.inner) * scale.numerator,
      "strategic blast inner numerator",
    ),
    outerNumerator: exactPositiveSafeNumber(
      BigInt(baseline.outer * baseline.outer) * scale.numerator,
      "strategic blast outer numerator",
    ),
    profileDenominator: exactPositiveSafeNumber(
      scale.denominator,
      "strategic blast profile denominator",
    ),
  });
}

function isMirvLandTerrain(terrain: MatchState["map"]["terrain"][number]): boolean {
  return (
    terrain !== "SHALLOW_WATER" &&
    terrain !== "DEEP_WATER" &&
    terrain !== "IMPASSABLE"
  );
}

function squaredCellDistance(
  state: MatchState,
  leftCellId: number,
  rightCellId: number,
): number {
  const left = state.map.positionOf(leftCellId);
  const right = state.map.positionOf(rightCellId);
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function canonicalMirvChildTargets(
  state: MatchState,
  primaryTargetCellId: number,
  targetFactionId: string | undefined,
): readonly number[] {
  const selected = [primaryTargetCellId];
  if (targetFactionId === undefined) return Object.freeze(selected);

  const primary = state.map.positionOf(primaryTargetCellId);
  const radius = MIRV_DISTRIBUTION_RADIUS_CELLS;
  const radiusSquared = radius * radius;
  const minX = Math.max(0, primary.x - radius);
  const maxX = Math.min(state.map.width - 1, primary.x + radius);
  const minY = Math.max(0, primary.y - radius);
  const maxY = Math.min(state.map.height - 1, primary.y + radius);
  const candidates: number[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cellId = state.map.cellIdAt(x, y);
      if (
        cellId === undefined ||
        cellId === primaryTargetCellId ||
        state.ownership[cellId] !== targetFactionId ||
        !isMirvLandTerrain(state.map.terrainAt(cellId))
      ) {
        continue;
      }
      const dx = x - primary.x;
      const dy = y - primary.y;
      if (dx * dx + dy * dy <= radiusSquared) {
        candidates.push(cellId);
      }
    }
  }

  candidates.sort((left, right) => {
    const distanceOrder =
      squaredCellDistance(state, primaryTargetCellId, left) -
      squaredCellDistance(state, primaryTargetCellId, right);
    return distanceOrder || left - right;
  });

  const spacingSquared =
    MIRV_MINIMUM_CENTER_SPACING_CELLS * MIRV_MINIMUM_CENTER_SPACING_CELLS;
  for (const candidate of candidates) {
    if (
      selected.every(
        (existing) =>
          squaredCellDistance(state, existing, candidate) >= spacingSquared,
      )
    ) {
      selected.push(candidate);
      if (selected.length >= MIRV_MAX_CHILDREN) break;
    }
  }
  return Object.freeze(selected);
}

function mirvUseEntitlementAvailable(
  state: MatchState,
  ownerId: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  return (
    owner !== undefined &&
    factionHasCustomRuleDomain(state, ownerId, "MIRV_USE_ENTITLEMENT") &&
    owner.mirvUseEntitlementConsumed !== true
  );
}

function failure(
  ffyCost: number,
  code: StrategicLaunchFailureCode,
): StrategicLaunchQuoteResult {
  return Object.freeze({
    ok: false as const,
    ffyCost,
    failure: Object.freeze({ code }),
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

function weaponUsePermitted(
  state: MatchState,
  ownerId: string,
  weapon: StrategicWeaponType,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "WEAPON", weapon } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "WEAPON_USE_PERMISSION",
    scope,
    owner.rules.contributions,
  );
  if (
    contributions.some(
      (entry) => entry.conditions !== undefined && entry.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned strategic-weapon permission requires an explicit launch context",
    );
  }
  return reducePermissionRule(
    true,
    RULE_AXIS_REGISTRY.WEAPON_USE_PERMISSION,
    contributions,
  );
}

function factionHasCustomRuleDomain(
  state: MatchState,
  ownerId: string,
  domain: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  return (
    owner?.rules.customDomains.some((entry) => entry.domain === domain) ?? false
  );
}

function effectiveWeaponFfyCost(
  state: MatchState,
  ownerId: string,
  weapon: StrategicWeaponType,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const effective = materializeCompiledScalarRule(
    BASE_WEAPON_FFY_COST[weapon],
    owner.rules,
    RULE_AXIS_REGISTRY,
    "WEAPON_PURCHASE_FFY_COST",
    { kind: "WEAPON", weapon },
    ruleDynamicState(state, ownerId),
  );
  if (
    !Number.isSafeInteger(effective) ||
    effective < 0 ||
    Object.is(effective, -0)
  ) {
    throw new Error("strategic weapon FFY cost must resolve to a non-negative safe integer");
  }
  return effective;
}

function requiredSiloLevel(weapon: StrategicWeaponType): number {
  switch (weapon) {
    case "ATOM_BOMB":
      return 1;
    case "HYDROGEN_BOMB":
      return 3;
    case "MIRV":
      return 5;
  }
}

function lowestReadyCharge(
  launcher: PersistentStructureState,
): StructureChargeSlotState | undefined {
  return [...(launcher.chargeSlots ?? [])]
    .filter((slot) => slot.state === "READY")
    .sort((left, right) => left.slotId - right.slotId)[0];
}

export function canonicalStrategicLaunchReservations(
  state: MatchState,
  candidates: readonly StrategicLaunchReservationCandidate[],
): ReadonlyMap<number, StrategicLaunchReservation> {
  const byLauncher = new Map<string, StrategicLaunchReservationCandidate[]>();
  const seenSequences = new Set<number>();

  for (const candidate of candidates) {
    if (
      !Number.isSafeInteger(candidate.sequence) ||
      candidate.sequence < 0 ||
      Object.is(candidate.sequence, -0) ||
      seenSequences.has(candidate.sequence)
    ) {
      throw new Error("strategic reservation candidates require unique non-negative sequences");
    }
    seenSequences.add(candidate.sequence);
    const launcher = state.structures.find(
      (structure) => structure.id === candidate.launcherId,
    );
    if (
      launcher === undefined ||
      launcher.type !== "MISSILE_SILO" ||
      launcher.ownerId !== candidate.ownerId
    ) {
      throw new Error(
        `accepted strategic reservation lost launcher ${candidate.launcherId}`,
      );
    }
    const group = byLauncher.get(candidate.launcherId);
    if (group === undefined) {
      byLauncher.set(candidate.launcherId, [candidate]);
    } else {
      group.push(candidate);
    }
  }

  const reservations = new Map<number, StrategicLaunchReservation>();
  for (const [launcherId, group] of byLauncher) {
    const launcher = state.structures.find(
      (structure) => structure.id === launcherId,
    );
    if (launcher === undefined) {
      throw new Error(`strategic reservation lost launcher ${launcherId}`);
    }
    const readySlots = [...(launcher.chargeSlots ?? [])]
      .filter((slot) => slot.state === "READY")
      .sort((left, right) => left.slotId - right.slotId);
    if (group.length > readySlots.length) {
      throw new Error(
        `accepted strategic launch batch oversubscribed launcher ${launcherId}`,
      );
    }
    const canonical = [...group].sort((left, right) => {
      const weaponOrder =
        CANONICAL_WEAPON_ORDER[left.weapon] - CANONICAL_WEAPON_ORDER[right.weapon];
      if (weaponOrder !== 0) return weaponOrder;
      if (left.targetCellId !== right.targetCellId) {
        return left.targetCellId - right.targetCellId;
      }
      return left.sequence - right.sequence;
    });
    const baseOrdinal = launcher.acceptedLaunchCount ?? 0;
    for (let index = 0; index < canonical.length; index += 1) {
      const candidate = canonical[index]!;
      const charge = readySlots[index]!;
      reservations.set(
        candidate.sequence,
        Object.freeze({
          chargeSlotId: charge.slotId,
          acceptedLaunchOrdinal: baseOrdinal + index,
        }),
      );
    }
  }
  return reservations;
}

export function quoteStrategicLaunch(
  state: MatchState,
  request: StrategicLaunchRequest,
): StrategicLaunchQuoteResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.launcherId !== "string" ||
    request.launcherId.length === 0 ||
    (request.weapon !== "ATOM_BOMB" &&
      request.weapon !== "HYDROGEN_BOMB" &&
      request.weapon !== "MIRV") ||
    !Number.isSafeInteger(request.targetCellId) ||
    Object.is(request.targetCellId, -0)
  ) {
    return failure(0, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return failure(0, "UNKNOWN_OWNER");

  const ffyCost = effectiveWeaponFfyCost(state, request.ownerId, request.weapon);
  const launcher = state.structures.find(
    (structure) => structure.id === request.launcherId,
  );
  if (launcher === undefined || launcher.type !== "MISSILE_SILO") {
    return failure(ffyCost, "UNKNOWN_LAUNCHER");
  }
  if (launcher.ownerId !== request.ownerId) {
    return failure(ffyCost, "NOT_OWNER");
  }
  if (!launcher.active || launcher.completedLevel === undefined) {
    return failure(ffyCost, "LAUNCHER_INACTIVE");
  }
  if (launcher.completedLevel < requiredSiloLevel(request.weapon)) {
    return failure(ffyCost, "LAUNCHER_LEVEL_REQUIRED");
  }
  if (!weaponUsePermitted(state, request.ownerId, request.weapon)) {
    return failure(ffyCost, "WEAPON_NOT_PERMITTED");
  }
  if (
    request.weapon === "MIRV" &&
    factionHasCustomRuleDomain(state, request.ownerId, "MIRV_USE_ENTITLEMENT") &&
    !mirvUseEntitlementAvailable(state, request.ownerId)
  ) {
    return failure(ffyCost, "WEAPON_NOT_PERMITTED");
  }
  if (!state.map.isValidCellId(request.targetCellId)) {
    return failure(ffyCost, "INVALID_TARGET");
  }

  let targetFactionId = request.targetFactionId;
  if (targetFactionId !== undefined) {
    const target = state.factions.find((faction) => faction.id === targetFactionId);
    if (target === undefined || target.status !== "ACTIVE") {
      return failure(ffyCost, "INVALID_TARGET");
    }
  } else {
    targetFactionId = state.ownership[request.targetCellId] ?? undefined;
  }

  const charge = lowestReadyCharge(launcher);
  if (charge === undefined) return failure(ffyCost, "NO_READY_CHARGE");

  const debit = tryDebitFfy(owner.ffy, {
    numerator: BigInt(ffyCost),
    denominator: 1n,
  });
  if (!debit.ok) return failure(ffyCost, "INSUFFICIENT_FFY");

  const ffySpent =
    request.weapon === "MIRV" &&
    mirvUseEntitlementAvailable(state, request.ownerId)
      ? 0
      : debit.cost;

  return Object.freeze({
    ok: true as const,
    ffyCost: debit.cost,
    ffySpent,
    chargeSlotId: charge.slotId,
    acceptedLaunchOrdinal: launcher.acceptedLaunchCount ?? 0,
    launchCellId: launcher.cellId,
    ...(targetFactionId === undefined ? {} : { targetFactionId }),
  });
}

export function tryCommitStrategicLaunch(
  state: MatchState,
  request: StrategicLaunchCommitRequest,
  transitionTick: number,
  reservation?: StrategicLaunchReservation,
): StrategicLaunchCommitResult {
  if (
    !Number.isSafeInteger(transitionTick) ||
    transitionTick < 0 ||
    Object.is(transitionTick, -0)
  ) {
    throw new Error("strategic launch transition tick must be a non-negative safe integer");
  }
  const quote = quoteStrategicLaunch(state, request);
  if (!quote.ok) {
    return Object.freeze({
      ok: false as const,
      state,
      ffyCost: quote.ffyCost,
      failure: quote.failure,
    });
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  const launcher = state.structures.find(
    (structure) => structure.id === request.launcherId,
  );
  if (owner === undefined || launcher === undefined) {
    throw new Error("strategic launch quote/commit state diverged");
  }

  const chargeSlotId = reservation?.chargeSlotId ?? quote.chargeSlotId;
  const acceptedLaunchOrdinal =
    reservation?.acceptedLaunchOrdinal ?? quote.acceptedLaunchOrdinal;
  if (
    !Number.isSafeInteger(chargeSlotId) ||
    chargeSlotId < 0 ||
    Object.is(chargeSlotId, -0) ||
    !Number.isSafeInteger(acceptedLaunchOrdinal) ||
    acceptedLaunchOrdinal < 0 ||
    Object.is(acceptedLaunchOrdinal, -0)
  ) {
    throw new Error("strategic launch reservation must contain exact non-negative integers");
  }
  const reservedCharge = (launcher.chargeSlots ?? []).find(
    (slot) => slot.slotId === chargeSlotId,
  );
  if (reservedCharge === undefined || reservedCharge.state !== "READY") {
    return Object.freeze({
      ok: false as const,
      state,
      ffyCost: quote.ffyCost,
      failure: Object.freeze({ code: "NO_READY_CHARGE" as const }),
    });
  }
  if (
    state.strategicProjectiles.some(
      (projectile) =>
        projectile.launcherId === launcher.id &&
        projectile.acceptedLaunchOrdinal === acceptedLaunchOrdinal,
    )
  ) {
    throw new Error("strategic launch reservation reused an accepted launch identity");
  }

  const debit = tryDebitFfy(owner.ffy, {
    numerator: BigInt(quote.ffySpent),
    denominator: 1n,
  });
  if (!debit.ok) {
    throw new Error("strategic launch quote/commit FFY state diverged");
  }
  const rechargeTicks = effectiveStructureRechargeTicks(
    state,
    request.ownerId,
    "MISSILE_SILO",
  );
  const chargeSlots = Object.freeze(
    (launcher.chargeSlots ?? []).map((slot) =>
      slot.slotId === chargeSlotId
        ? Object.freeze({
            slotId: slot.slotId,
            state: "RECHARGING" as const,
            readyAtTick: transitionTick + rechargeTicks,
          })
        : slot,
    ),
  );
  const acceptedLaunchCount = Math.max(
    launcher.acceptedLaunchCount ?? 0,
    acceptedLaunchOrdinal + 1,
  );
  const structures = materializePersistentStructures(
    state.structures.map((structure) =>
      structure.id === launcher.id
        ? {
            ...structure,
            chargeSlots,
            acceptedLaunchCount,
          }
        : structure,
    ),
  );

  const blastSeed = strategicBlastHash32(
    "strategic-blast-root",
    state.seed,
    launcher.id,
    acceptedLaunchOrdinal,
    request.weapon,
    request.targetCellId,
  );
  const blastProfile = effectiveWarheadBlastProfile(
    state,
    request.ownerId,
    request.weapon,
  );
  const mirvPayload =
    request.weapon === "MIRV"
      ? Object.freeze({
          childSpeedCellsPerSecond: effectiveWarheadProjectileSpeed(
            state,
            request.ownerId,
            "MIRV",
            BASE_MIRV_CHILD_SPEED,
          ),
          distributionRadiusCells: MIRV_DISTRIBUTION_RADIUS_CELLS,
          minimumCenterSpacingCells: MIRV_MINIMUM_CENTER_SPACING_CELLS,
          children: Object.freeze(
            canonicalMirvChildTargets(
              state,
              request.targetCellId,
              quote.targetFactionId,
            ).map((targetCellId, childIndex) =>
              Object.freeze({
                targetCellId,
                blastSeed: strategicBlastHash32(
                  "strategic-blast-child",
                  state.seed,
                  blastSeed,
                  childIndex,
                ),
              }),
            ),
          ),
        })
      : undefined;
  const projectile: StrategicProjectileState = Object.freeze({
    id: `strategic:${launcher.id}:${acceptedLaunchOrdinal}`,
    ownerId: request.ownerId,
    launcherId: launcher.id,
    weapon: request.weapon,
    launchCellId: quote.launchCellId,
    targetCellId: request.targetCellId,
    ...(quote.targetFactionId === undefined
      ? {}
      : { targetFactionId: quote.targetFactionId }),
    acceptedLaunchOrdinal,
    consumedChargeSlotId: chargeSlotId,
    launchedAtTick: transitionTick,
    speedCellsPerSecond:
      request.weapon === "MIRV"
        ? BASE_PROJECTILE_SPEED.MIRV
        : effectiveWarheadProjectileSpeed(
            state,
            request.ownerId,
            request.weapon,
          ),
    blastProfile,
    blastSeed,
    ...(mirvPayload === undefined ? {} : { mirvPayload }),
  });

  const consumesMirvEntitlement =
    request.weapon === "MIRV" &&
    mirvUseEntitlementAvailable(state, request.ownerId);
  const factions = state.factions.map((faction) =>
    faction.id === owner.id
      ? {
          ...faction,
          ffy: debit.balance,
          ...(consumesMirvEntitlement
            ? { mirvUseEntitlementConsumed: true as const }
            : {}),
        }
      : faction,
  );
  let hostilityGrace = state.hostilityGrace;
  if (quote.targetFactionId !== undefined) {
    const target = state.factions.find(
      (faction) => faction.id === quote.targetFactionId,
    );
    if (
      target !== undefined &&
      factionRelationBetween(
        {
          factionId: owner.id,
          ...(owner.fixedTeamId === undefined
            ? {}
            : { fixedTeamId: owner.fixedTeamId }),
        },
        {
          factionId: target.id,
          ...(target.fixedTeamId === undefined
            ? {}
            : { fixedTeamId: target.fixedTeamId }),
        },
      ) === "ENEMY"
    ) {
      hostilityGrace = applyOneShotDirectedHostility(
        state,
        owner.id,
        target.id,
        transitionTick,
      );
    }
  }

  const next = createProspectiveMatchState(state, {
    factions,
    structures,
    strategicProjectiles: Object.freeze([
      ...state.strategicProjectiles,
      projectile,
    ]),
    hostilityGrace,
  });
  return Object.freeze({
    ok: true as const,
    state: next,
    ffyCost: debit.cost,
    projectile,
  });
}
