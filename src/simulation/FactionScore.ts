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
type TankDerivedChassis = "TANK" | "HEAVY_ARTILLERY";

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
  chassisType: TankDerivedChassis,
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

function tankDerivedReplacementCapital(
  state: FactionScoreState,
  factionId: string,
): bigint {
  let chassisType: TankDerivedChassis | undefined;
  let chassisCount = 0;

  const includeChassis = (candidate: TankDerivedChassis): void => {
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
    total += baselineTankChassisReplacementCost(index, chassisType);
  }
  return total;
}

function assertWarshipPowerSliceSupported(
  state: FactionScoreState,
  factionId: string,
): void {
  if (
    state.mobileUnits.some(
      (unit) => unit.ownerId === factionId && unit.type === "WARSHIP",
    )
  ) {
    throw new Error(
      "Faction score Warship replacement valuation is not materialized in this implementation slice",
    );
  }
}

/**
 * Authoritative combined faction-score seam. Structure replacement capital is
 * derived through Structure-owned ordinary purchase/upgrade cost truth under an
 * explicitly neutral rule profile, so acquisition history and faction modifiers
 * cannot alter baseline replacement value. Committed construction is valued at
 * its target level. Committed and deployed Tank-derived chassis form one baseline
 * sequential replacement portfolio; Heavy Artillery keeps its canonical 1.5x
 * chassis multiplier. Warships remain a later RED-first slice.
 */
export function calculateFactionScore(
  state: FactionScoreState,
  factionId: string,
): number {
  const faction = state.factions.find((candidate) => candidate.id === factionId);
  if (faction === undefined) throw new Error(`unknown faction: ${factionId}`);
  if (faction.status !== "ACTIVE") return 0;

  assertWarshipPowerSliceSupported(state, factionId);

  const currentPower =
    BigInt(faction.ffy) +
    structureReplacementCapital(state, factionId) +
    tankDerivedReplacementCapital(state, factionId);
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
    mobileUnits: Object.freeze(
      state.mobileUnits.filter(
        (unit) =>
          unit.ownerId !== factionId ||
          (unit.type !== "TANK" && unit.type !== "HEAVY_ARTILLERY"),
      ),
    ),
    tankProductionJobs: Object.freeze(
      state.tankProductionJobs.filter((job) => job.ownerId !== factionId),
    ),
  });

  return calculateEconomyOnlyFactionScore(scoringState, factionId);
}
