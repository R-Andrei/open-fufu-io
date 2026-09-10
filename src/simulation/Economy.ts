import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  isTerrainScopeId,
  reducePermissionRule,
  reducedRational,
  selectRuleContributionsForScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type ExactRuleScaleFactor,
} from "../core/rules/RuleMaterialization";
import { landTerrainBaseSpec } from "./LandOperations";
import type { MatchFactionState, MatchState } from "./MatchState";

export const STARTING_FFY = 25_000;
export const BASELINE_PASSIVE_FFY_PER_SECOND = 1_000;
export const ECONOMY_TICKS_PER_SECOND = 10;

const BASELINE_PASSIVE_FFY_PER_TICK =
  BASELINE_PASSIVE_FFY_PER_SECOND / ECONOMY_TICKS_PER_SECOND;
const PASSIVE_FFY_DOMAIN = "PASSIVE_FFY_SOURCE";
const DESERT_FFY_BONUS_BP = 600;
const BASIS_POINTS = 10_000n;
const FFY_ALL_SCOPE = Object.freeze({
  kind: "FFY_FAMILY" as const,
  family: "ALL" as const,
});

interface ExactFfyValue {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface PassiveTerrainCounts {
  readonly capacity: number;
  readonly desertPopulationBearingCells: number;
}

function exactFfy(
  numerator: bigint,
  denominator: bigint = 1n,
): ExactFfyValue {
  const reduced = reducedRational(numerator, denominator);
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

function multiplyScales(
  left: ExactRuleScaleFactor,
  right: ExactRuleScaleFactor,
): ExactRuleScaleFactor {
  const reduced = reducedRational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
  return Object.freeze(reduced);
}

function floorPositiveScaledFfy(
  source: ExactFfyValue,
  scale: ExactRuleScaleFactor,
): number {
  const numerator = source.numerator * scale.numerator;
  const denominator = source.denominator * scale.denominator;
  if (denominator <= 0n) {
    throw new Error("FFY exact denominator must be positive");
  }
  if (numerator <= 0n) return 0;
  const whole = numerator / denominator;
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("finalized FFY award exceeds the safe-integer range");
  }
  return Number(whole);
}

export function materializeFfyBalance(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("FFY balance must be a non-negative safe integer");
  }
  return value;
}

function checkedCredit(balance: number, amount: number): number {
  materializeFfyBalance(balance);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("FFY award must be a non-negative safe integer");
  }
  const result = balance + amount;
  if (!Number.isSafeInteger(result)) {
    throw new Error("FFY balance exceeds the safe-integer range");
  }
  return result;
}

function hasPassiveOriginSource(
  faction: MatchFactionState,
  sourceId: "P52" | "P53",
): boolean {
  return faction.rules.customDomains.some(
    (entry) =>
      entry.sourceKind === "ORIGIN" &&
      entry.sourceId === sourceId &&
      entry.domain === PASSIVE_FFY_DOMAIN,
  );
}

function effectivePopulationBearingForTerrain(
  faction: MatchFactionState,
  terrain: MatchState["map"]["terrain"][number],
): boolean {
  const base = landTerrainBaseSpec(terrain).populationBearing;
  if (terrain === "TEST" || !isTerrainScopeId(terrain)) return base;

  const scope = { kind: "TERRAIN" as const, terrain };
  const contributions = selectRuleContributionsForScope(
    "TERRAIN_POPULATION_BEARING_PERMISSION",
    scope,
    faction.rules.contributions,
  );
  if (
    contributions.some(
      (contribution) =>
        contribution.conditions !== undefined &&
        contribution.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned Population-bearing permissions require an authoritative terrain-condition evaluator",
    );
  }
  return reducePermissionRule(
    base,
    RULE_AXIS_REGISTRY.TERRAIN_POPULATION_BEARING_PERMISSION,
    contributions,
  );
}

function derivePassiveTerrainCounts(
  state: MatchState,
): ReadonlyMap<string, PassiveTerrainCounts> {
  const factionsById = new Map(
    state.factions.map((faction) => [faction.id, faction] as const),
  );
  const mutable = new Map<
    string,
    { capacity: number; desertPopulationBearingCells: number }
  >(
    state.factions.map((faction) => [
      faction.id,
      { capacity: 0, desertPopulationBearingCells: 0 },
    ]),
  );
  const populationBearingMemo = new Map<string, boolean>();

  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    const ownerId = state.ownership[cellId] ?? null;
    if (ownerId === null) continue;
    const faction = factionsById.get(ownerId);
    if (faction === undefined) {
      throw new Error(`owned cell ${cellId} references unknown faction ${ownerId}`);
    }
    const terrain = state.map.terrainAt(cellId);
    const memoKey = `${ownerId}\u0000${terrain}`;
    let populationBearing = populationBearingMemo.get(memoKey);
    if (populationBearing === undefined) {
      populationBearing = effectivePopulationBearingForTerrain(faction, terrain);
      populationBearingMemo.set(memoKey, populationBearing);
    }
    if (!populationBearing) continue;

    const counts = mutable.get(ownerId)!;
    counts.capacity += 1;
    if (terrain === "DESERT") counts.desertPopulationBearingCells += 1;
  }

  return new Map(
    [...mutable.entries()].map(([factionId, counts]) => [
      factionId,
      Object.freeze({ ...counts }),
    ]),
  );
}

function structureCounts(state: MatchState): {
  readonly owned: ReadonlyMap<string, number>;
  readonly readyPersistentSiloCharges: ReadonlyMap<string, number>;
} {
  const owned = new Map(state.factions.map((faction) => [faction.id, 0]));
  const readyPersistentSiloCharges = new Map(
    state.factions.map((faction) => [faction.id, 0]),
  );

  for (const structure of state.structures) {
    if (!owned.has(structure.ownerId)) {
      throw new Error(
        `structure ${structure.id} references unknown owner ${structure.ownerId}`,
      );
    }
    owned.set(structure.ownerId, owned.get(structure.ownerId)! + 1);
    if (
      structure.active &&
      structure.type === "MISSILE_SILO" &&
      structure.chargeSlots !== undefined
    ) {
      const ready = structure.chargeSlots.filter(
        (slot) => slot.state === "READY",
      ).length;
      readyPersistentSiloCharges.set(
        structure.ownerId,
        readyPersistentSiloCharges.get(structure.ownerId)! + ready,
      );
    }
  }

  return Object.freeze({ owned, readyPersistentSiloCharges });
}

function staticAllFfyScale(
  faction: MatchFactionState,
  ownedPersistentStructureCount: number,
): ExactRuleScaleFactor {
  if (
    faction.rules.dynamicProviders.some(
      (provider) =>
        provider.axis === "FFY_EVENT_YIELD" &&
        provider.dependency === "TERRITORIAL_CONTACT_COUNT",
    )
  ) {
    throw new Error(
      "FFY_EVENT_YIELD requires Territorial Contact state unavailable to the current economy foundation",
    );
  }

  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      faction.rules,
      RULE_AXIS_REGISTRY,
      "FFY_EVENT_YIELD",
      FFY_ALL_SCOPE,
      {
        ownedPersistentStructureCount,
        territorialContactCount: 0,
        peakTotalPopulation: faction.population.peakTotal,
      },
    ),
    () => false,
  );

  if (terms.some((term) => term.stage === "TERMINAL")) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }
  return materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.FFY_EVENT_YIELD,
    terms,
  );
}

function desertShareScale(
  counts: PassiveTerrainCounts,
): ExactRuleScaleFactor {
  if (counts.capacity === 0 || counts.desertPopulationBearingCells === 0) {
    return Object.freeze({ numerator: 1n, denominator: 1n });
  }
  const capacity = BigInt(counts.capacity);
  const desert = BigInt(counts.desertPopulationBearingCells);
  const denominator = BASIS_POINTS * capacity;
  const numerator = denominator + BigInt(DESERT_FFY_BONUS_BP) * desert;
  return Object.freeze(reducedRational(numerator, denominator));
}

function passiveSources(
  faction: MatchFactionState,
  terrain: PassiveTerrainCounts,
  readyPersistentSiloCharges: number,
): readonly ExactFfyValue[] {
  const sources: ExactFfyValue[] = [
    exactFfy(BigInt(BASELINE_PASSIVE_FFY_PER_TICK)),
  ];

  if (hasPassiveOriginSource(faction, "P52")) {
    const emptyCapacity = Math.max(
      0,
      terrain.capacity - faction.population.total,
    );
    sources.push(exactFfy(BigInt(emptyCapacity), 2_500n));
  }
  if (hasPassiveOriginSource(faction, "P53")) {
    sources.push(exactFfy(BigInt(readyPersistentSiloCharges) * 200n));
  }
  return Object.freeze(sources);
}

/**
 * Resolve the canonical passive earning snapshot after accepted inputs and before
 * autonomous tick systems. Every passive source is finalized independently.
 */
export function resolvePassiveFfyTick(
  state: MatchState,
): readonly MatchFactionState[] {
  const terrainCounts = derivePassiveTerrainCounts(state);
  const structures = structureCounts(state);

  return state.factions.map((faction) => {
    if (faction.status !== "ACTIVE") return faction;

    const terrain = terrainCounts.get(faction.id);
    if (terrain === undefined) {
      throw new Error(`missing passive terrain counts for faction ${faction.id}`);
    }
    const ruleScale = staticAllFfyScale(
      faction,
      structures.owned.get(faction.id) ?? 0,
    );
    const fullScale = multiplyScales(ruleScale, desertShareScale(terrain));
    const sources = passiveSources(
      faction,
      terrain,
      structures.readyPersistentSiloCharges.get(faction.id) ?? 0,
    );
    const award = sources.reduce(
      (sum, source) => sum + floorPositiveScaledFfy(source, fullScale),
      0,
    );
    if (!Number.isSafeInteger(award)) {
      throw new Error("combined passive FFY award exceeds the safe-integer range");
    }
    return { ...faction, ffy: checkedCredit(faction.ffy, award) };
  });
}
