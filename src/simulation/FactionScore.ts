import type {
  StructureLevel,
  StructureType,
} from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../core/rules/RuleCompiler";
import { calculateFactionScoreFromPreparedPowerState } from "./Economy";
import {
  structureBuildPurchaseFfyPreview,
  structureUpgradePurchaseFfyPreview,
} from "./StructuresCore";
import {
  baselineTankChassisReplacementCost,
  type TankChassisType,
} from "./Tanks";

type FactionScoreState = Parameters<
  typeof calculateFactionScoreFromPreparedPowerState
>[0];

const BASELINE_REPLACEMENT_RULES = compileRuleProfile(RULE_AXIS_REGISTRY, {
  contributions: [],
});

function baselineStructureCostState(
  state: FactionScoreState,
  factionId: string,
): FactionScoreState {
  return Object.freeze({
    ...state,
    factions: Object.freeze(
      state.factions.map((faction) =>
        faction.id === factionId
          ? Object.freeze({
              ...faction,
              ffy: Number.MAX_SAFE_INTEGER,
              rules: BASELINE_REPLACEMENT_RULES,
              successfulStructurePurchaseTypes: Object.freeze([]),
            })
          : faction,
      ),
    ),
  });
}

function cumulativeBaselineStructureCost(
  state: FactionScoreState,
  factionId: string,
  type: StructureType,
  targetLevel: StructureLevel,
): bigint {
  let total = BigInt(
    structureBuildPurchaseFfyPreview(state, factionId, type).ffyRequired,
  );
  for (let level = 2; level <= targetLevel; level += 1) {
    total += BigInt(
      structureUpgradePurchaseFfyPreview(
        state,
        factionId,
        type,
        level as StructureLevel,
      ).ffyRequired,
    );
  }
  return total;
}

function structureReplacementCapital(
  state: FactionScoreState,
  factionId: string,
): bigint {
  const baselineState = baselineStructureCostState(state, factionId);
  const costByState = new Map<string, bigint>();
  let total = 0n;

  for (const structure of state.structures) {
    if (structure.ownerId !== factionId) continue;
    const replacementLevel =
      structure.construction?.targetLevel ?? structure.completedLevel;
    if (replacementLevel === undefined) {
      throw new Error(
        `structure ${structure.id} has no level-bearing replacement state`,
      );
    }
    const key = `${structure.type}:${replacementLevel}`;
    let cost = costByState.get(key);
    if (cost === undefined) {
      cost = cumulativeBaselineStructureCost(
        baselineState,
        factionId,
        structure.type,
        replacementLevel,
      );
      costByState.set(key, cost);
    }
    total += cost;
  }

  return total;
}

function tankDerivedReplacementCapital(
  state: FactionScoreState,
  factionId: string,
): bigint {
  let chassisType: TankChassisType | undefined;
  let chassisCount = 0;

  const includeChassis = (candidate: TankChassisType): void => {
    if (chassisType === undefined) {
      chassisType = candidate;
    } else if (chassisType !== candidate) {
      throw new Error(
        "Faction score Tank-derived portfolio contains mixed chassis profiles",
      );
    }
    chassisCount += 1;
  };

  for (const unit of state.mobileUnits) {
    if (unit.ownerId !== factionId) continue;
    if (unit.type === "TANK" || unit.type === "HEAVY_ARTILLERY") {
      includeChassis(unit.type);
    }
  }
  for (const job of state.tankProductionJobs) {
    if (job.ownerId === factionId) includeChassis(job.chassisType);
  }

  if (chassisType === undefined) return 0n;

  let total = 0n;
  for (let index = 0; index < chassisCount; index += 1) {
    total += BigInt(baselineTankChassisReplacementCost(index, chassisType));
  }
  return total;
}

function warshipReplacementCapital(
  state: FactionScoreState,
  factionId: string,
): bigint {
  let warshipCount = 0;
  for (const unit of state.mobileUnits) {
    if (unit.ownerId === factionId && unit.type === "WARSHIP") {
      warshipCount += 1;
    }
  }

  let total = 0n;
  for (let index = 0; index < warshipCount; index += 1) {
    total += BigInt(Math.min(1_000_000, 250_000 * (index + 1)));
  }
  return total;
}

/**
 * Authoritative combined faction-score seam. Structure replacement capital is
 * derived through Structure-owned ordinary purchase/upgrade cost truth under an
 * explicitly neutral rule profile, so acquisition history and faction modifiers
 * cannot alter baseline replacement value. Committed construction is valued at
 * its target level. Committed and deployed Tank-derived chassis form one baseline
 * sequential replacement portfolio; Heavy Artillery keeps its canonical 1.5x
 * chassis multiplier. Deployed Warships use their ordinary baseline sequential
 * replacement curve; committed Warship construction is not represented until an
 * authoritative naval production state exists for the score to consume.
 */
export function calculateFactionScore(
  state: FactionScoreState,
  factionId: string,
): number {
  const faction = state.factions.find((candidate) => candidate.id === factionId);
  if (faction === undefined) throw new Error(`unknown faction: ${factionId}`);
  if (faction.isMinorFaction) {
    throw new Error("Minor Factions have no authoritative V1 combined score");
  }
  if (faction.status !== "ACTIVE") return 0;

  const currentPower =
    BigInt(faction.ffy) +
    structureReplacementCapital(state, factionId) +
    tankDerivedReplacementCapital(state, factionId) +
    warshipReplacementCapital(state, factionId);
  if (currentPower > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Faction score current power exceeds the safe-integer range");
  }

  const scoringState = Object.freeze({
    ...state,
    // The canonical N denominator is the fixed starting Major-Faction roster;
    // Minor Factions are actors but are not score participants.
    factions: Object.freeze(
      state.factions
        .filter((candidate) => !candidate.isMinorFaction)
        .map((candidate) =>
          candidate.id === factionId
            ? Object.freeze({ ...candidate, ffy: Number(currentPower) })
            : candidate,
        ),
    ),
    structures: Object.freeze(
      state.structures.filter((structure) => structure.ownerId !== factionId),
    ),
    mobileUnits: Object.freeze(
      state.mobileUnits.filter(
        (unit) =>
          unit.ownerId !== factionId ||
          (unit.type !== "TANK" &&
            unit.type !== "HEAVY_ARTILLERY" &&
            unit.type !== "WARSHIP"),
      ),
    ),
    tankProductionJobs: Object.freeze(
      state.tankProductionJobs.filter((job) => job.ownerId !== factionId),
    ),
  });

  return calculateFactionScoreFromPreparedPowerState(scoringState, factionId);
}
