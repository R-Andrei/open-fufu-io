import type { StrategicWeaponType } from "../core/controller/ControllerApi";
import { factionRelationBetween } from "../core/FactionRelations";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  selectRuleContributionsForScope,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  materializeCompiledScalarRule,
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

const BASE_ATOM_PROJECTILE_SPEED = 100;

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
  readonly weapon: "ATOM_BOMB";
  readonly targetCellId: number;
  readonly targetFactionId?: string;
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

function baselineAtomBlastProfile(): StrategicBlastProfileState {
  return Object.freeze({
    profileVersion: "STRATEGIC_BLAST_V1" as const,
    innerNumerator: 12 * 12,
    outerNumerator: 30 * 30,
    profileDenominator: 1,
  });
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

  return Object.freeze({
    ok: true as const,
    ffyCost: debit.cost,
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

  const debit = tryDebitFfy(owner.ffy, {
    numerator: BigInt(quote.ffyCost),
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
      slot.slotId === quote.chargeSlotId
        ? Object.freeze({
            slotId: slot.slotId,
            state: "RECHARGING" as const,
            readyAtTick: transitionTick + rechargeTicks,
          })
        : slot,
    ),
  );
  const acceptedLaunchCount = quote.acceptedLaunchOrdinal + 1;
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

  const projectile: StrategicProjectileState = Object.freeze({
    id: `strategic:${launcher.id}:${quote.acceptedLaunchOrdinal}`,
    ownerId: request.ownerId,
    launcherId: launcher.id,
    weapon: request.weapon,
    launchCellId: quote.launchCellId,
    targetCellId: request.targetCellId,
    ...(quote.targetFactionId === undefined
      ? {}
      : { targetFactionId: quote.targetFactionId }),
    acceptedLaunchOrdinal: quote.acceptedLaunchOrdinal,
    consumedChargeSlotId: quote.chargeSlotId,
    launchedAtTick: transitionTick,
    speedCellsPerSecond: BASE_ATOM_PROJECTILE_SPEED,
    blastProfile: baselineAtomBlastProfile(),
    blastSeed: strategicBlastHash32(
      "strategic-blast-root",
      state.seed,
      launcher.id,
      quote.acceptedLaunchOrdinal,
      request.weapon,
      request.targetCellId,
    ),
  });

  const factions = state.factions.map((faction) =>
    faction.id === owner.id ? { ...faction, ffy: debit.balance } : faction,
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
