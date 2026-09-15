import type {
  StructureLevel,
  StructureType,
} from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import { compileRuleProfile } from "../core/rules/RuleCompiler";
import { calculateFactionScore as calculateEconomyOnlyFactionScore } from "./Economy";
import {
  structureBuildPurchaseFfyPreview,
  structureUpgradePurchaseFfyPreview,
} from "./StructuresCore";

type FactionScoreState = Parameters<typeof calculateEconomyOnlyFactionScore>[0];

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

function baselineTankChassisReplacementCost(
  precedingChassisCount: number,
  chassisType: "TANK" | "HEAVY_ARTILLERY",
): bigint {
  if (
    !Number.isSafeInteger(precedingChassisCount) ||
    precedingChassisCount < 0 ||
    Object.is(precedingChassisCount, -0)
  ) {
    throw new Error(
      "preceding Tank chassis count must be a non-negative safe integer",
    );
  }
  const baseline = BigInt(
    Math.min(1_000_000, 250_000 * (precedingChassisCount + 1)),
  );
  return chassisType === "HEAVY_ARTILLERY"
    ? (baseline * 3n) / 2n
    : baseline;
}

function committedTankProductionReplacementCapital(
  state: FactionScoreState,
  factionId: string,
): bigint {
  const jobs = state.tankProductionJobs
    .filter((job) => job.ownerId === factionId)
    .slice()
    .sort((left, right) =>
      left.factoryId < right.factoryId
        ? -1
        : left.factoryId > right.factoryId
          ? 1
          : 0,
    );

  return jobs.reduce(
    (total, job, index) =>
      total + baselineTankChassisReplacementCost(index, job.chassisType),
    0n,
  );
}

function assertDeployedMilitaryPowerSliceSupported(
  state: FactionScoreState,
  factionId: string,
): void {
  if (
    state.mobileUnits.some(
      (unit) =>
        unit.ownerId === factionId &&
        (unit.type === "TANK" ||
          unit.type === "HEAVY_ARTILLERY" ||
          unit.type === "WARSHIP"),
    )
  ) {
    throw new Error(
      "Faction score deployed military replacement valuation is not materialized in this implementation slice",
    );
  }
}

/**
 * Authoritative combined faction-score seam. Structure replacement capital is
 * derived through Structure-owned ordinary purchase/upgrade cost truth under an
 * explicitly neutral rule profile, so acquisition history and faction modifiers
 * cannot alter baseline replacement value. Committed construction is valued at
 * its target level. Paid Tank/Heavy-Artillery production jobs retain baseline
 * sequential replacement capital; deployed military remains a later RED-first
 * slice.
 */
export function calculateFactionScore(
  state: FactionScoreState,
  factionId: string,
): number {
  const faction = state.factions.find((candidate) => candidate.id === factionId);
  if (faction === undefined) throw new Error(`unknown faction: ${factionId}`);
  if (faction.status !== "ACTIVE") return 0;

  assertDeployedMilitaryPowerSliceSupported(state, factionId);

  const currentPower =
    BigInt(faction.ffy) +
    structureReplacementCapital(state, factionId) +
    committedTankProductionReplacementCapital(state, factionId);
  if (currentPower > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Faction score current power exceeds the safe-integer range");
  }

  const scoringState = Object.freeze({
    ...state,
    factions: Object.freeze(
      state.factions.map((candidate) =>
        candidate.id === factionId
          ? Object.freeze({ ...candidate, ffy: Number(currentPower) })
          : candidate,
      ),
    ),
    structures: Object.freeze(
      state.structures.filter((structure) => structure.ownerId !== factionId),
    ),
  });

  return calculateEconomyOnlyFactionScore(scoringState, factionId);
}
