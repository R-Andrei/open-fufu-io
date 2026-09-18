import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  reducePermissionRule,
  reducedRational,
  selectRuleContributionsForScope,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeCompiledCapRule,
  materializeCompiledScalarRule,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import { tryDebitFfy, type ExactFfyValue } from "./Economy";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  createMobileUnit,
  type MobileUnitCollectionState,
} from "./MobileUnits";
import { removePopulation } from "./Population";
import type { PersistentStructureState } from "./Structures";

export type WarshipProductionJobState =
  | {
      readonly portId: string;
      readonly ownerId: string;
      readonly state: "BUILDING";
      readonly remainingTicks: number;
    }
  | {
      readonly portId: string;
      readonly ownerId: string;
      readonly state: "READY_TO_DEPLOY";
    };

export interface StartWarshipProductionRequest {
  readonly ownerId: string;
  readonly portId: string;
}

export type WarshipProductionFailureCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_OWNER"
  | "UNKNOWN_PORT"
  | "NOT_OWNER"
  | "PORT_INACTIVE"
  | "PORT_LEVEL_REQUIRED"
  | "BUILD_NOT_PERMITTED"
  | "OWNERSHIP_CAP"
  | "PORT_CAPACITY"
  | "INSUFFICIENT_FFY"
  | "INSUFFICIENT_POPULATION";

export type StartWarshipProductionResult =
  | {
      readonly ok: true;
      readonly cost: number;
      readonly job: WarshipProductionJobState;
      readonly state: MatchState;
    }
  | {
      readonly ok: false;
      readonly failure: Readonly<{ code: WarshipProductionFailureCode }>;
      readonly state: MatchState;
    };

const BASE_WARSHIP_BUILD_TICKS = 50;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure(
  state: MatchState,
  code: WarshipProductionFailureCode,
): StartWarshipProductionResult {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code }),
    state,
  });
}

function activeWarshipCount(state: MatchState, ownerId: string): number {
  return state.mobileUnits.filter(
    (unit) => unit.ownerId === ownerId && unit.type === "WARSHIP",
  ).length;
}

function committedWarshipCount(state: MatchState, ownerId: string): number {
  return state.warshipProductionJobs.filter((job) => job.ownerId === ownerId).length;
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

function warshipBuildPermitted(state: MatchState, ownerId: string): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "WARSHIP" } as const satisfies RuleScope;
  const contributions = selectRuleContributionsForScope(
    "UNIT_BUILD_PERMISSION",
    scope,
    owner.rules.contributions,
  );
  if (
    contributions.some(
      (entry) => entry.conditions !== undefined && entry.conditions.length > 0,
    )
  ) {
    throw new Error(
      "conditioned Warship build permission requires an explicit Warship admission context",
    );
  }
  return reducePermissionRule(
    true,
    RULE_AXIS_REGISTRY.UNIT_BUILD_PERMISSION,
    contributions,
  );
}

function effectiveWarshipOwnershipCap(state: MatchState, ownerId: string): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  return materializeCompiledCapRule(
    Number.MAX_SAFE_INTEGER,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "UNIT_OWNERSHIP_CAP",
    { kind: "UNIT", unit: "WARSHIP" },
    ruleDynamicState(state, ownerId),
  );
}

function exactMultiply(
  left: ExactFfyValue,
  numerator: bigint,
  denominator: bigint,
): ExactFfyValue {
  const reduced = reducedRational(
    left.numerator * numerator,
    left.denominator * denominator,
  );
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

function effectiveWarshipFfyCost(
  state: MatchState,
  ownerId: string,
): ExactFfyValue {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const scope = { kind: "UNIT", unit: "WARSHIP" } as const satisfies RuleScope;
  const terms = conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      "UNIT_PURCHASE_FFY_COST",
      scope,
      ruleDynamicState(state, ownerId),
    ),
  );

  const baseline: ExactFfyValue = Object.freeze({
    numerator: BigInt(warshipPurchaseCost(activeWarshipCount(state, ownerId))),
    denominator: 1n,
  });
  if (terms.some((term) => term.stage === "TERMINAL")) {
    return Object.freeze({ numerator: 0n, denominator: 1n });
  }
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.UNIT_PURCHASE_FFY_COST,
    terms,
  );
  return exactMultiply(baseline, scale.numerator, scale.denominator);
}

function effectiveWarshipPopulationCost(
  state: MatchState,
  ownerId: string,
): number {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  const cost = materializeCompiledScalarRule(
    0,
    owner.rules,
    RULE_AXIS_REGISTRY,
    "UNIT_PURCHASE_POPULATION_COST",
    { kind: "UNIT", unit: "WARSHIP" },
    ruleDynamicState(state, ownerId),
  );
  if (!Number.isSafeInteger(cost) || cost < 0 || Object.is(cost, -0)) {
    throw new Error(
      "Warship Population purchase cost must resolve to a non-negative safe integer",
    );
  }
  return cost;
}

export function warshipPurchaseCost(activeWarships: number): number {
  if (
    !Number.isSafeInteger(activeWarships) ||
    activeWarships < 0 ||
    Object.is(activeWarships, -0)
  ) {
    throw new Error("active Warship count must be a non-negative safe integer");
  }
  return Math.min(1_000_000, 250_000 * (activeWarships + 1));
}

export function tryStartWarshipProduction(
  state: MatchState,
  request: StartWarshipProductionRequest,
): StartWarshipProductionResult {
  if (
    request === null ||
    typeof request !== "object" ||
    typeof request.ownerId !== "string" ||
    request.ownerId.length === 0 ||
    typeof request.portId !== "string" ||
    request.portId.length === 0
  ) {
    return failure(state, "INVALID_REQUEST");
  }

  const owner = state.factions.find((faction) => faction.id === request.ownerId);
  if (owner === undefined) return failure(state, "UNKNOWN_OWNER");
  const port = state.structures.find((structure) => structure.id === request.portId);
  if (port === undefined || port.type !== "PORT") {
    return failure(state, "UNKNOWN_PORT");
  }
  if (port.ownerId !== request.ownerId) return failure(state, "NOT_OWNER");
  if (!port.active) return failure(state, "PORT_INACTIVE");
  if (port.completedLevel === undefined || port.completedLevel < 1) {
    return failure(state, "PORT_LEVEL_REQUIRED");
  }
  if (state.warshipProductionJobs.some((job) => job.portId === request.portId)) {
    return failure(state, "PORT_CAPACITY");
  }
  if (!warshipBuildPermitted(state, request.ownerId)) {
    return failure(state, "BUILD_NOT_PERMITTED");
  }

  const occupiedWarshipSlots =
    activeWarshipCount(state, request.ownerId) +
    committedWarshipCount(state, request.ownerId);
  if (
    occupiedWarshipSlots + 1 >
    effectiveWarshipOwnershipCap(state, request.ownerId)
  ) {
    return failure(state, "OWNERSHIP_CAP");
  }

  const populationCost = effectiveWarshipPopulationCost(
    state,
    request.ownerId,
  );
  if (owner.population.available < populationCost) {
    return failure(state, "INSUFFICIENT_POPULATION");
  }
  const debit = tryDebitFfy(
    owner.ffy,
    effectiveWarshipFfyCost(state, request.ownerId),
  );
  if (!debit.ok) return failure(state, "INSUFFICIENT_FFY");
  const population = removePopulation(
    owner.population,
    "AVAILABLE",
    populationCost,
  );

  const job: WarshipProductionJobState = Object.freeze({
    portId: port.id,
    ownerId: request.ownerId,
    state: "BUILDING" as const,
    remainingTicks: BASE_WARSHIP_BUILD_TICKS,
  });
  const factions = state.factions.map((faction) =>
    faction.id === request.ownerId
      ? Object.freeze({
          ...faction,
          ffy: debit.balance,
          population,
        })
      : faction,
  );
  const jobs = Object.freeze(
    [...state.warshipProductionJobs, job].sort((left, right) =>
      compareIds(left.portId, right.portId),
    ),
  );
  const next = createProspectiveMatchState(state, {
    factions,
    warshipProductionJobs: jobs,
  });
  return Object.freeze({
    ok: true,
    cost: debit.cost,
    job,
    state: next,
  });
}

function warshipDeploymentCell(
  state: MatchState,
  port: PersistentStructureState,
): number | undefined {
  const cellId = port.outputCellId;
  if (cellId === undefined || !state.map.isValidCellId(cellId)) return undefined;
  if (state.map.terrainAt(cellId) !== "DEEP_WATER") return undefined;
  if (state.structures.some((structure) => structure.cellId === cellId)) return undefined;
  if (state.mobileUnits.some((unit) => unit.cellId === cellId)) return undefined;
  return cellId;
}

function waitingDeploymentJob(
  job: WarshipProductionJobState,
): WarshipProductionJobState {
  return Object.freeze({
    portId: job.portId,
    ownerId: job.ownerId,
    state: "READY_TO_DEPLOY" as const,
  });
}

export function advanceWarshipProductionPhase(state: MatchState): MatchState {
  let units: MobileUnitCollectionState = Object.freeze({
    mobileUnits: state.mobileUnits,
    nextMobileUnitOrdinal: state.nextMobileUnitOrdinal,
  });
  const nextJobs: WarshipProductionJobState[] = [];
  const ownerIds = state.factions.map((faction) => faction.id);
  const jobs = [...state.warshipProductionJobs].sort((left, right) =>
    compareIds(left.portId, right.portId),
  );

  for (const job of jobs) {
    const port = state.structures.find((structure) => structure.id === job.portId);
    if (
      port === undefined ||
      port.type !== "PORT" ||
      port.ownerId !== job.ownerId
    ) {
      continue;
    }

    if (!port.active || port.completedLevel === undefined) {
      nextJobs.push(job);
      continue;
    }

    const deploy = (): boolean => {
      const cellId = warshipDeploymentCell(
        createProspectiveMatchState(state, {
          mobileUnits: units.mobileUnits,
          nextMobileUnitOrdinal: units.nextMobileUnitOrdinal,
        }),
        port,
      );
      if (cellId === undefined) return false;
      const created = createMobileUnit(state.map, ownerIds, units, {
        ownerId: job.ownerId,
        type: "WARSHIP",
        movementClass: "NAVAL",
        cellId,
      });
      units = Object.freeze({
        mobileUnits: created.mobileUnits,
        nextMobileUnitOrdinal: created.nextMobileUnitOrdinal,
      });
      return true;
    };

    if (job.state === "READY_TO_DEPLOY") {
      if (!deploy()) nextJobs.push(job);
      continue;
    }

    if (job.remainingTicks > 1) {
      nextJobs.push(
        Object.freeze({
          portId: job.portId,
          ownerId: job.ownerId,
          state: "BUILDING" as const,
          remainingTicks: job.remainingTicks - 1,
        }),
      );
      continue;
    }

    if (!deploy()) nextJobs.push(waitingDeploymentJob(job));
  }

  return createProspectiveMatchState(state, {
    mobileUnits: units.mobileUnits,
    nextMobileUnitOrdinal: units.nextMobileUnitOrdinal,
    warshipProductionJobs: nextJobs,
  });
}