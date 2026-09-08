import { factionRelationBetween } from "../core/FactionRelations";
import type {
  CellId,
  CellSelector,
  DecisionFailure,
  DefensePriorityDirective,
  DirectiveChanges,
  FactionStatus,
  PersistentDirective,
  SpatialPolicy,
  TerrainType,
} from "../core/controller/ControllerApi";
import { RULE_COMPONENT } from "../core/rules/OriginRuleManifest";
import { ruleScopeMatches, type RuleCondition, type RuleScope } from "../core/rules/RuleComposition";
import type { CompiledRuleProfile } from "../core/rules/RuleCompiler";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  materializeCompiledScalarRule,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import {
  createPopulationState,
  removePopulation,
  repartitionPopulation,
  type PopulationState,
} from "./Population";
import type { SyntheticMapSpec } from "./MatchSpec";

const TICKS_PER_SECOND = 10;
const PROGRESS_SCALE = 1_000_000;
const REQUIRED_PROGRESS_MICROS = PROGRESS_SCALE;
const PROGRESS_DECAY_MICROS_PER_TICK = 50_000;
const COUNTER_RESIDUAL_SCALE = 1_000_000;

export interface LandTerrainBaseSpec {
  readonly conquerable: boolean;
  readonly populationBearing: boolean;
  readonly landTraversable: boolean;
  readonly acquisitionProgressMultiplier: number;
  readonly offensivePressureMultiplier: number;
  readonly defensivePressureMultiplier: number;
}

const LAND_TERRAIN_BASE_SPECS: Readonly<Record<TerrainType | "TEST", LandTerrainBaseSpec>> = Object.freeze({
  PLAINS: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 1.1,
    offensivePressureMultiplier: 1,
    defensivePressureMultiplier: 1,
  }),
  HIGHLAND: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 1,
    offensivePressureMultiplier: 1.08,
    defensivePressureMultiplier: 1,
  }),
  MOUNTAIN: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 0.8,
    offensivePressureMultiplier: 1,
    defensivePressureMultiplier: 1.15,
  }),
  DESERT: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 0.9,
    offensivePressureMultiplier: 1,
    defensivePressureMultiplier: 1,
  }),
  FOREST: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 0.9,
    offensivePressureMultiplier: 0.95,
    defensivePressureMultiplier: 1.1,
  }),
  TUNDRA: Object.freeze({
    conquerable: true,
    populationBearing: false,
    landTraversable: true,
    acquisitionProgressMultiplier: 0.8,
    offensivePressureMultiplier: 1,
    defensivePressureMultiplier: 1.05,
  }),
  MARSH: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 0.7,
    offensivePressureMultiplier: 0.9,
    defensivePressureMultiplier: 0.9,
  }),
  SHALLOW_WATER: Object.freeze({
    conquerable: true,
    populationBearing: false,
    landTraversable: true,
    acquisitionProgressMultiplier: 0.7,
    offensivePressureMultiplier: 0.85,
    defensivePressureMultiplier: 0.85,
  }),
  DEEP_WATER: Object.freeze({
    conquerable: false,
    populationBearing: false,
    landTraversable: false,
    acquisitionProgressMultiplier: 0,
    offensivePressureMultiplier: 0,
    defensivePressureMultiplier: 0,
  }),
  IMPASSABLE: Object.freeze({
    conquerable: false,
    populationBearing: false,
    landTraversable: false,
    acquisitionProgressMultiplier: 0,
    offensivePressureMultiplier: 0,
    defensivePressureMultiplier: 0,
  }),
  TEST: Object.freeze({
    conquerable: true,
    populationBearing: true,
    landTraversable: true,
    acquisitionProgressMultiplier: 1,
    offensivePressureMultiplier: 1,
    defensivePressureMultiplier: 1,
  }),
});

export function landTerrainBaseSpec(terrain: TerrainType | "TEST"): LandTerrainBaseSpec {
  return LAND_TERRAIN_BASE_SPECS[terrain];
}

function assertFiniteScalar(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function assertCellId(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("CellId must be a non-negative safe integer");
  }
}

type CanonicalSelector = Readonly<Record<string, unknown>>;

function canonicalSelectorObject(selector: CellSelector): CanonicalSelector {
  switch (selector.kind) {
    case "CELLS": {
      const ids = [...new Set(selector.ids)].sort((left, right) => left - right);
      ids.forEach(assertCellId);
      return { kind: "CELLS", ids };
    }
    case "OWNER":
      return selector.factionId === undefined
        ? { kind: "OWNER" }
        : { kind: "OWNER", factionId: selector.factionId };
    case "SEGMENT":
      assertCellId(selector.segmentId);
      return { kind: "SEGMENT", segmentId: selector.segmentId };
    case "TERRAIN":
      return { kind: "TERRAIN", terrain: selector.terrain };
    case "FALLOUT":
    case "POPULATION_BEARING":
    case "CONQUERABLE":
    case "COAST":
    case "SHORELINE":
      return { kind: selector.kind, value: selector.value };
    case "CIRCLE":
      assertCellId(selector.center);
      assertFiniteScalar(selector.radius, "selector radius");
      if (selector.radius < 0) throw new Error("selector radius must be non-negative");
      return { kind: "CIRCLE", center: selector.center, radius: selector.radius };
    case "STRUCTURE_FIELD":
      return {
        kind: "STRUCTURE_FIELD",
        field: selector.field,
        referenceFactionId: selector.referenceFactionId,
        affiliation: selector.affiliation,
      };
    case "STRUCTURE_FIELD_INSTANCE":
      return {
        kind: "STRUCTURE_FIELD_INSTANCE",
        structureId: selector.structureId,
        field: selector.field,
      };
    case "UNION":
    case "INTERSECTION": {
      const kind = selector.kind;
      const children: CanonicalSelector[] = [];
      for (const child of selector.selectors) {
        const normalized = canonicalSelectorObject(child);
        if (normalized.kind === kind && Array.isArray(normalized.selectors)) {
          children.push(...(normalized.selectors as CanonicalSelector[]));
        } else {
          children.push(normalized);
        }
      }
      const byKey = new Map<string, CanonicalSelector>();
      for (const child of children) byKey.set(JSON.stringify(child), child);
      const selectors = [...byKey.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([, child]) => child);
      return { kind, selectors };
    }
    case "DIFFERENCE":
      return {
        kind: "DIFFERENCE",
        left: canonicalSelectorObject(selector.left),
        right: canonicalSelectorObject(selector.right),
      };
  }
}

export function canonicalCellSelectorKey(selector: CellSelector): string {
  return JSON.stringify(canonicalSelectorObject(selector));
}

export function materializeCellSelector(selector: CellSelector): CellSelector {
  const normalized = canonicalSelectorObject(selector);
  const clone = (value: unknown): unknown => {
    if (Array.isArray(value)) return Object.freeze(value.map(clone));
    if (typeof value === "object" && value !== null) {
      return Object.freeze(
        Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, clone(child)]),
        ),
      );
    }
    return value;
  };
  return clone(normalized) as CellSelector;
}

export function materializeSpatialPolicy(policy: SpatialPolicy | undefined): SpatialPolicy | undefined {
  if (policy === undefined) return undefined;
  if (policy.defaultWeight !== undefined) {
    assertFiniteScalar(policy.defaultWeight, "policy default weight");
    if (policy.defaultWeight < 0) throw new Error("policy weights must be non-negative");
  }
  const rules = (policy.rules ?? [])
    .map((rule) => {
      assertFiniteScalar(rule.weight, "policy rule weight");
      if (rule.weight < 0) throw new Error("policy weights must be non-negative");
      return Object.freeze({ selector: materializeCellSelector(rule.selector), weight: rule.weight });
    })
    .sort((left, right) => {
      const leftSelector = canonicalCellSelectorKey(left.selector);
      const rightSelector = canonicalCellSelectorKey(right.selector);
      return leftSelector < rightSelector
        ? -1
        : leftSelector > rightSelector
          ? 1
          : left.weight - right.weight;
    });
  return Object.freeze({
    ...(policy.defaultWeight === undefined ? {} : { defaultWeight: policy.defaultWeight }),
    ...(rules.length === 0 ? {} : { rules: Object.freeze(rules) }),
  });
}

export function canonicalSpatialPolicyKey(policy: SpatialPolicy | undefined): string {
  if (policy === undefined) return "";
  const rules = (policy.rules ?? [])
    .map((rule) => ({ selector: canonicalCellSelectorKey(rule.selector), weight: rule.weight }))
    .sort((left, right) =>
      left.selector < right.selector ? -1 : left.selector > right.selector ? 1 : left.weight - right.weight,
    );
  return JSON.stringify({ defaultWeight: policy.defaultWeight ?? 1, rules });
}

export interface AttackLandOperationState {
  readonly id: string;
  readonly controllerKey: string;
  readonly kind: "ATTACK";
  readonly ownerId: string;
  readonly targetFactionId: string;
  readonly committedPopulation: number;
  readonly source: CellSelector;
  readonly target: CellSelector;
  readonly engagementPriority?: SpatialPolicy;
  readonly pressureWeight?: SpatialPolicy;
}

export interface NeutralExpansionOperationState {
  readonly id: string;
  readonly controllerKey: string;
  readonly kind: "NEUTRAL_EXPANSION";
  readonly ownerId: string;
  readonly committedPopulation: number;
  readonly source: CellSelector;
  readonly target: CellSelector;
  readonly engagementPriority?: SpatialPolicy;
  readonly pressureWeight?: SpatialPolicy;
}

export interface CounterResponseOperationState {
  readonly id: string;
  readonly controllerKey: string;
  readonly kind: "COUNTER_RESPONSE";
  readonly ownerId: string;
  readonly incomingOperationId: string;
  readonly committedPopulation: number;
}

export type LandOperationState =
  | AttackLandOperationState
  | NeutralExpansionOperationState
  | CounterResponseOperationState;

export interface DefensePriorityState {
  readonly ownerId: string;
  readonly controllerKey: string;
  readonly priority: SpatialPolicy;
}

export interface CaptureProgressState {
  readonly cellId: CellId;
  readonly claimantFactionId: string;
  readonly progressMicros: number;
}

export interface CounterResponseResidualState {
  readonly attackerFactionId: string;
  readonly responderFactionId: string;
  readonly attackingLossMicros: number;
  readonly respondingLossMicros: number;
}

export interface LandFactionStateLike {
  readonly id: string;
  readonly status: FactionStatus;
  readonly rules: CompiledRuleProfile;
  readonly population: PopulationState;
  readonly fixedTeamId?: string;
}

export interface LandDirectiveStateLike<F extends LandFactionStateLike = LandFactionStateLike> {
  readonly factions: readonly F[];
  readonly operations: readonly LandOperationState[];
  readonly defensePriorities: readonly DefensePriorityState[];
}

export interface LandTickStateLike<F extends LandFactionStateLike = LandFactionStateLike>
  extends LandDirectiveStateLike<F> {
  readonly map: SyntheticMapSpec;
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
  readonly captureProgress: readonly CaptureProgressState[];
  readonly counterResponseResiduals: readonly CounterResponseResidualState[];
}

export interface LandDirectiveApplySuccess<F extends LandFactionStateLike> {
  readonly ok: true;
  readonly factions: readonly F[];
  readonly operations: readonly LandOperationState[];
  readonly defensePriorities: readonly DefensePriorityState[];
}

export interface LandDirectiveApplyFailure {
  readonly ok: false;
  readonly failure: DecisionFailure;
}

export type LandDirectiveApplyResult<F extends LandFactionStateLike> =
  | LandDirectiveApplySuccess<F>
  | LandDirectiveApplyFailure;

function operationId(ownerId: string, key: string): string {
  return `land:${JSON.stringify([ownerId, key])}`;
}

function counterResponseId(ownerId: string, key: string): string {
  return `counter:${JSON.stringify([ownerId, key])}`;
}

function isPositivePopulation(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function relationIdentity(faction: LandFactionStateLike) {
  return {
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined ? {} : { fixedTeamId: faction.fixedTeamId }),
  };
}

function cloneDirective(directive: PersistentDirective): PersistentDirective {
  switch (directive.kind) {
    case "LAND_OPERATION":
      return Object.freeze({
        kind: directive.kind,
        key: directive.key,
        operation: directive.operation,
        population: directive.population,
        ...(directive.targetFactionId === undefined ? {} : { targetFactionId: directive.targetFactionId }),
        source: materializeCellSelector(directive.source),
        target: materializeCellSelector(directive.target),
        ...(directive.engagementPriority === undefined
          ? {}
          : { engagementPriority: materializeSpatialPolicy(directive.engagementPriority)! }),
        ...(directive.pressureWeight === undefined
          ? {}
          : { pressureWeight: materializeSpatialPolicy(directive.pressureWeight)! }),
      });
    case "DEFENSE_PRIORITY":
      return Object.freeze({
        kind: directive.kind,
        key: directive.key,
        priority: materializeSpatialPolicy(directive.priority)!,
      });
    case "COUNTER_RESPONSE":
      return Object.freeze({
        kind: directive.kind,
        key: directive.key,
        incomingOperationId: directive.incomingOperationId,
        population: directive.population,
      });
  }
}

export function materializeDirectiveChanges(changes: DirectiveChanges): DirectiveChanges {
  return Object.freeze({
    ...(changes.set === undefined
      ? {}
      : { set: Object.freeze(changes.set.map(cloneDirective)) }),
    ...(changes.end === undefined ? {} : { end: Object.freeze([...changes.end]) }),
  });
}

function directiveFailure(code: DecisionFailure["code"], key?: string): LandDirectiveApplyFailure {
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ code, ...(key === undefined ? {} : { key }) }),
  });
}

function sumOperationPopulation(
  operations: readonly LandOperationState[],
  ownerId: string,
  kind: "OFFENSIVE" | "COUNTER_RESPONSE",
): number {
  return operations.reduce((sum, operation) => {
    if (operation.ownerId !== ownerId) return sum;
    if (kind === "OFFENSIVE" && operation.kind !== "COUNTER_RESPONSE") {
      return sum + operation.committedPopulation;
    }
    if (kind === "COUNTER_RESPONSE" && operation.kind === "COUNTER_RESPONSE") {
      return sum + operation.committedPopulation;
    }
    return sum;
  }, 0);
}

function compareOperationProjection(left: LandOperationState, right: LandOperationState): number {
  const owner = left.ownerId < right.ownerId ? -1 : left.ownerId > right.ownerId ? 1 : 0;
  if (owner !== 0) return owner;
  if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
  if (left.kind !== "COUNTER_RESPONSE" && right.kind !== "COUNTER_RESPONSE") {
    const leftTarget = canonicalCellSelectorKey(left.target);
    const rightTarget = canonicalCellSelectorKey(right.target);
    if (leftTarget !== rightTarget) return leftTarget < rightTarget ? -1 : 1;
    const leftSource = canonicalCellSelectorKey(left.source);
    const rightSource = canonicalCellSelectorKey(right.source);
    if (leftSource !== rightSource) return leftSource < rightSource ? -1 : 1;
  }
  return left.controllerKey < right.controllerKey ? -1 : left.controllerKey > right.controllerKey ? 1 : 0;
}

export function materializeLandOperationState(operation: LandOperationState): LandOperationState {
  if (operation.kind === "COUNTER_RESPONSE") {
    return Object.freeze({ ...operation });
  }
  return Object.freeze({
    ...operation,
    source: materializeCellSelector(operation.source),
    target: materializeCellSelector(operation.target),
    ...(operation.engagementPriority === undefined
      ? {}
      : { engagementPriority: materializeSpatialPolicy(operation.engagementPriority)! }),
    ...(operation.pressureWeight === undefined
      ? {}
      : { pressureWeight: materializeSpatialPolicy(operation.pressureWeight)! }),
  });
}

export function materializeDefensePriorityState(state: DefensePriorityState): DefensePriorityState {
  return Object.freeze({
    ownerId: state.ownerId,
    controllerKey: state.controllerKey,
    priority: materializeSpatialPolicy(state.priority)!,
  });
}

function factionById<F extends LandFactionStateLike>(factions: readonly F[], id: string): F | undefined {
  return factions.find((entry) => entry.id === id);
}

export function tryApplyPersistentDirectiveChanges<F extends LandFactionStateLike>(
  state: LandDirectiveStateLike<F>,
  factionId: string,
  changes: DirectiveChanges,
): LandDirectiveApplyResult<F> {
  const faction = factionById(state.factions, factionId);
  if (faction === undefined || faction.status !== "ACTIVE") {
    return directiveFailure("INVALID_TARGET");
  }

  let materialized: DirectiveChanges;
  try {
    materialized = materializeDirectiveChanges(changes);
  } catch {
    return directiveFailure("INVALID_DIRECTIVE", changes.set?.[0]?.key ?? changes.end?.[0]);
  }

  const seenSet = new Set<string>();
  for (const directive of materialized.set ?? []) {
    if (directive.key.length === 0 || seenSet.has(directive.key)) {
      return directiveFailure("CONFLICTING_PROPOSAL", directive.key);
    }
    seenSet.add(directive.key);
  }
  const seenEnd = new Set<string>();
  for (const key of materialized.end ?? []) {
    if (key.length === 0 || seenEnd.has(key) || seenSet.has(key)) {
      return directiveFailure("CONFLICTING_PROPOSAL", key);
    }
    seenEnd.add(key);
  }

  const oldOffensive = sumOperationPopulation(state.operations, factionId, "OFFENSIVE");
  const oldCounter = sumOperationPopulation(state.operations, factionId, "COUNTER_RESPONSE");
  let operations = state.operations.filter(
    (operation) => operation.ownerId !== factionId || !seenEnd.has(operation.controllerKey),
  );
  let defensePriorities = state.defensePriorities.filter(
    (entry) => entry.ownerId !== factionId || !seenEnd.has(entry.controllerKey),
  );

  for (const directive of materialized.set ?? []) {
    operations = operations.filter(
      (operation) => operation.ownerId !== factionId || operation.controllerKey !== directive.key,
    );
    defensePriorities = defensePriorities.filter(
      (entry) => entry.ownerId !== factionId || entry.controllerKey !== directive.key,
    );

    if (directive.kind === "LAND_OPERATION") {
      if (!isPositivePopulation(directive.population)) {
        return directiveFailure("INVALID_DIRECTIVE", directive.key);
      }
      if (directive.operation === "ATTACK") {
        const target = directive.targetFactionId === undefined
          ? undefined
          : factionById(state.factions, directive.targetFactionId);
        if (
          target === undefined ||
          target.status !== "ACTIVE" ||
          factionRelationBetween(relationIdentity(faction), relationIdentity(target)) !== "ENEMY"
        ) {
          return directiveFailure("INVALID_TARGET", directive.key);
        }
        operations = [
          ...operations,
          Object.freeze({
            id: operationId(factionId, directive.key),
            controllerKey: directive.key,
            kind: "ATTACK" as const,
            ownerId: factionId,
            targetFactionId: target.id,
            committedPopulation: directive.population,
            source: directive.source,
            target: directive.target,
            ...(directive.engagementPriority === undefined
              ? {}
              : { engagementPriority: directive.engagementPriority }),
            ...(directive.pressureWeight === undefined
              ? {}
              : { pressureWeight: directive.pressureWeight }),
          }),
        ];
      } else {
        if (directive.targetFactionId !== undefined) {
          return directiveFailure("INVALID_TARGET", directive.key);
        }
        operations = [
          ...operations,
          Object.freeze({
            id: operationId(factionId, directive.key),
            controllerKey: directive.key,
            kind: "NEUTRAL_EXPANSION" as const,
            ownerId: factionId,
            committedPopulation: directive.population,
            source: directive.source,
            target: directive.target,
            ...(directive.engagementPriority === undefined
              ? {}
              : { engagementPriority: directive.engagementPriority }),
            ...(directive.pressureWeight === undefined
              ? {}
              : { pressureWeight: directive.pressureWeight }),
          }),
        ];
      }
      continue;
    }

    if (directive.kind === "COUNTER_RESPONSE") {
      if (!isPositivePopulation(directive.population)) {
        return directiveFailure("INVALID_DIRECTIVE", directive.key);
      }
      const incoming = state.operations.find(
        (operation) => operation.id === directive.incomingOperationId,
      );
      const incomingOwner =
        incoming?.kind === "ATTACK"
          ? factionById(state.factions, incoming.ownerId)
          : undefined;
      if (
        incoming === undefined ||
        incoming.kind !== "ATTACK" ||
        incomingOwner === undefined ||
        incomingOwner.status !== "ACTIVE" ||
        incoming.targetFactionId !== factionId ||
        factionRelationBetween(relationIdentity(faction), relationIdentity(incomingOwner)) !== "ENEMY"
      ) {
        return directiveFailure("INVALID_TARGET", directive.key);
      }
      operations = [
        ...operations,
        Object.freeze({
          id: counterResponseId(factionId, directive.key),
          controllerKey: directive.key,
          kind: "COUNTER_RESPONSE" as const,
          ownerId: factionId,
          incomingOperationId: incoming.id,
          committedPopulation: directive.population,
        }),
      ];
      continue;
    }

    const defense = directive as DefensePriorityDirective;
    defensePriorities = [
      ...defensePriorities,
      Object.freeze({
        ownerId: factionId,
        controllerKey: defense.key,
        priority: defense.priority,
      }),
    ];
  }

  const newOffensive = sumOperationPopulation(operations, factionId, "OFFENSIVE");
  const newCounter = sumOperationPopulation(operations, factionId, "COUNTER_RESPONSE");
  const released = Math.max(0, oldOffensive - newOffensive) + Math.max(0, oldCounter - newCounter);
  const required = Math.max(0, newOffensive - oldOffensive) + Math.max(0, newCounter - oldCounter);
  if (required > faction.population.available + released) {
    return directiveFailure(
      "INSUFFICIENT_AVAILABLE_POPULATION",
      materialized.set?.[materialized.set.length - 1]?.key,
    );
  }

  let population = faction.population;
  if (newOffensive < oldOffensive) {
    population = repartitionPopulation(population, "OFFENSIVE", "AVAILABLE", oldOffensive - newOffensive);
  }
  if (newCounter < oldCounter) {
    population = repartitionPopulation(population, "COUNTER_RESPONSE", "AVAILABLE", oldCounter - newCounter);
  }
  if (newOffensive > oldOffensive) {
    population = repartitionPopulation(population, "AVAILABLE", "OFFENSIVE", newOffensive - oldOffensive);
  }
  if (newCounter > oldCounter) {
    population = repartitionPopulation(population, "AVAILABLE", "COUNTER_RESPONSE", newCounter - oldCounter);
  }

  const factions = state.factions.map((entry) =>
    entry.id === factionId ? ({ ...entry, population } as F) : entry,
  );
  return Object.freeze({
    ok: true,
    factions: Object.freeze(factions),
    operations: Object.freeze([...operations].sort(compareOperationProjection).map(materializeLandOperationState)),
    defensePriorities: Object.freeze(
      [...defensePriorities]
        .sort((left, right) =>
          left.ownerId < right.ownerId
            ? -1
            : left.ownerId > right.ownerId
              ? 1
              : left.controllerKey < right.controllerKey
                ? -1
                : left.controllerKey > right.controllerKey
                  ? 1
                  : 0,
        )
        .map(materializeDefensePriorityState),
    ),
  });
}

export interface CounterResponseTickResult {
  readonly attackingPopulationLost: number;
  readonly respondingPopulationLost: number;
  readonly attackEffectiveness: number;
  readonly responseEffectiveness: number;
}

export function calculateCounterResponseTick(
  attackingPopulation: number,
  respondingPopulation: number,
): CounterResponseTickResult {
  if (!Number.isFinite(attackingPopulation) || attackingPopulation < 0) {
    throw new Error("attacking Population must be finite and non-negative");
  }
  if (!Number.isFinite(respondingPopulation) || respondingPopulation < 0) {
    throw new Error("responding Population must be finite and non-negative");
  }
  if (attackingPopulation === 0 || respondingPopulation === 0) {
    return Object.freeze({
      attackingPopulationLost: 0,
      respondingPopulationLost: 0,
      attackEffectiveness: 1,
      responseEffectiveness: 1,
    });
  }
  const base = 0.005 * Math.min(attackingPopulation, respondingPopulation);
  const difference = (respondingPopulation - attackingPopulation) / (respondingPopulation + attackingPopulation);
  const signedCurve = Math.sign(difference) * Math.abs(difference) ** 2;
  const bound = 0.2;
  const responseEffectiveness = 1 + bound * signedCurve;
  const attackEffectiveness = 1 - bound * signedCurve;
  return Object.freeze({
    attackingPopulationLost: base * responseEffectiveness,
    respondingPopulationLost: base * attackEffectiveness,
    attackEffectiveness,
    responseEffectiveness,
  });
}

function neighbors(map: SyntheticMapSpec, cellId: CellId): readonly CellId[] {
  const x = cellId % map.width;
  const y = Math.floor(cellId / map.width);
  const result: number[] = [];
  if (x > 0) result.push(cellId - 1);
  if (x + 1 < map.width) result.push(cellId + 1);
  if (y > 0) result.push(cellId - map.width);
  if (y + 1 < map.height) result.push(cellId + map.width);
  return result.sort((left, right) => left - right);
}

function runtimeTerrain(terrain: string): TerrainType | "TEST" {
  if (terrain in LAND_TERRAIN_BASE_SPECS) return terrain as TerrainType | "TEST";
  throw new Error(`unknown synthetic terrain: ${terrain}`);
}

function selectorCellSet(
  selector: CellSelector,
  map: SyntheticMapSpec,
  ownership: readonly (string | null)[],
  fallout: readonly boolean[],
): Set<CellId> {
  const all = () => new Set(Array.from({ length: map.width * map.height }, (_, index) => index));
  switch (selector.kind) {
    case "CELLS":
      return new Set(selector.ids.filter((id) => id >= 0 && id < map.width * map.height));
    case "OWNER":
      return new Set(
        ownership.flatMap((owner, index) =>
          owner === (selector.factionId ?? null) ? [index] : [],
        ),
      );
    case "SEGMENT":
    case "STRUCTURE_FIELD":
    case "STRUCTURE_FIELD_INSTANCE":
      return new Set();
    case "TERRAIN":
      return new Set(
        map.terrain.flatMap((terrain, index) => (terrain === selector.terrain ? [index] : [])),
      );
    case "FALLOUT":
      return new Set(
        fallout.flatMap((value, index) => (value === selector.value ? [index] : [])),
      );
    case "POPULATION_BEARING":
      return new Set(
        map.terrain.flatMap((terrain, index) =>
          landTerrainBaseSpec(runtimeTerrain(terrain)).populationBearing === selector.value
            ? [index]
            : [],
        ),
      );
    case "CONQUERABLE":
      return new Set(
        map.terrain.flatMap((terrain, index) =>
          landTerrainBaseSpec(runtimeTerrain(terrain)).conquerable === selector.value
            ? [index]
            : [],
        ),
      );
    case "COAST": {
      const result = new Set<number>();
      for (let cellId = 0; cellId < map.width * map.height; cellId += 1) {
        const terrain = runtimeTerrain(map.terrain[cellId]!);
        const land = landTerrainBaseSpec(terrain).landTraversable;
        const adjacentWater = neighbors(map, cellId).some((neighbor) => {
          const adjacent = runtimeTerrain(map.terrain[neighbor]!);
          return adjacent === "SHALLOW_WATER" || adjacent === "DEEP_WATER";
        });
        if ((land && adjacentWater) === selector.value) result.add(cellId);
      }
      return result;
    }
    case "SHORELINE": {
      const result = new Set<number>();
      for (let cellId = 0; cellId < map.width * map.height; cellId += 1) {
        const terrain = runtimeTerrain(map.terrain[cellId]!);
        const isWater = terrain === "SHALLOW_WATER" || terrain === "DEEP_WATER";
        const adjacentLand = neighbors(map, cellId).some((neighbor) => {
          const adjacent = runtimeTerrain(map.terrain[neighbor]!);
          return landTerrainBaseSpec(adjacent).landTraversable && adjacent !== "SHALLOW_WATER";
        });
        if ((isWater && adjacentLand) === selector.value) result.add(cellId);
      }
      return result;
    }
    case "CIRCLE": {
      const result = new Set<number>();
      const cx = selector.center % map.width;
      const cy = Math.floor(selector.center / map.width);
      const radius2 = selector.radius * selector.radius;
      for (let cellId = 0; cellId < map.width * map.height; cellId += 1) {
        const x = cellId % map.width;
        const y = Math.floor(cellId / map.width);
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius2) result.add(cellId);
      }
      return result;
    }
    case "UNION": {
      const result = new Set<number>();
      for (const child of selector.selectors) {
        for (const cell of selectorCellSet(child, map, ownership, fallout)) result.add(cell);
      }
      return result;
    }
    case "INTERSECTION": {
      if (selector.selectors.length === 0) return all();
      const [first, ...rest] = selector.selectors;
      const result = selectorCellSet(first!, map, ownership, fallout);
      for (const child of rest) {
        const childSet = selectorCellSet(child, map, ownership, fallout);
        for (const cell of [...result]) if (!childSet.has(cell)) result.delete(cell);
      }
      return result;
    }
    case "DIFFERENCE": {
      const result = selectorCellSet(selector.left, map, ownership, fallout);
      const removed = selectorCellSet(selector.right, map, ownership, fallout);
      for (const cell of removed) result.delete(cell);
      return result;
    }
  }
}

function policyWeight<F extends LandFactionStateLike>(
  policy: SpatialPolicy | undefined,
  cellId: CellId,
  state: LandTickStateLike<F>,
): number {
  const matchingWeights = (policy?.rules ?? [])
    .filter((rule) =>
      selectorCellSetWithEffectivePopulation(
        rule.selector,
        state.map,
        state.ownership,
        state.fallout,
        state.factions,
      ).has(cellId),
    )
    .map((rule) => rule.weight);
  return matchingWeights.length === 0
    ? policy?.defaultWeight ?? 1
    : Math.max(...matchingWeights);
}

function territorialContactCount<F extends LandFactionStateLike>(
  factionId: string,
  factions: readonly F[],
  map: SyntheticMapSpec,
  ownership: readonly (string | null)[],
): number {
  const active = new Set(
    factions.filter((faction) => faction.status === "ACTIVE").map((faction) => faction.id),
  );
  const contacts = new Set<string>();
  for (let cellId = 0; cellId < ownership.length; cellId += 1) {
    if (ownership[cellId] !== factionId) continue;
    for (const neighbor of neighbors(map, cellId)) {
      const owner = ownership[neighbor];
      if (owner !== null && owner !== factionId && active.has(owner)) contacts.add(owner);
    }
  }
  return contacts.size;
}

function dynamicRuleState<F extends LandFactionStateLike>(
  faction: F,
  state: LandTickStateLike<F>,
): RuleDynamicState {
  return Object.freeze({
    ownedPersistentStructureCount: 0,
    territorialContactCount: territorialContactCount(
      faction.id,
      state.factions,
      state.map,
      state.ownership,
    ),
    peakTotalPopulation: faction.population.peakTotal,
  });
}

interface RuleContext {
  readonly sourceTerrain?: TerrainType;
  readonly targetTerrain?: TerrainType;
  readonly targetHasFallout: boolean;
}

function conditionApplies(context: RuleContext) {
  return (conditions: readonly RuleCondition[]): boolean =>
    conditions.every((condition) => {
      switch (condition.kind) {
        case "SOURCE_TERRAIN_IS":
          return context.sourceTerrain === condition.terrain;
        case "TARGET_TERRAIN_IS":
        case "EVENT_TERRAIN_IS":
        case "BUILD_TERRAIN_IS":
          return context.targetTerrain === condition.terrain;
        case "TARGET_HAS_FALLOUT":
          return context.targetHasFallout;
        case "TARGET_LACKS_FALLOUT":
          return !context.targetHasFallout;
        default:
          return false;
      }
    });
}

function scalarRule<F extends LandFactionStateLike>(
  faction: F,
  state: LandTickStateLike<F>,
  axis: string,
  scope: RuleScope,
  base: number,
  context: RuleContext,
): number {
  return materializeCompiledScalarRule(
    base,
    faction.rules,
    RULE_AXIS_REGISTRY,
    axis,
    scope,
    dynamicRuleState(faction, state),
    conditionApplies(context),
  );
}

function hasCustomDomain(faction: LandFactionStateLike, domain: string): boolean {
  return faction.rules.customDomains.some((entry) => entry.domain === domain);
}

function effectivePermission(
  faction: LandFactionStateLike,
  axis: string,
  scope: RuleScope,
  base: boolean,
  context: RuleContext,
): boolean {
  const decisions = faction.rules.normalizedRules.filter(
    (entry) =>
      entry.axis === axis &&
      ruleScopeMatches(entry.scope, scope) &&
      (entry.conditions === undefined || conditionApplies(context)(entry.conditions)),
  );
  let allowed = base;
  for (const entry of decisions) {
    if (entry.value.kind !== "PROHIBIT_WINS") continue;
    if (entry.value.decision === "PROHIBIT") return false;
    allowed = true;
  }
  return allowed;
}

function selectorCellSetWithEffectivePopulation<F extends LandFactionStateLike>(
  selector: CellSelector,
  map: SyntheticMapSpec,
  ownership: readonly (string | null)[],
  fallout: readonly boolean[],
  factions: readonly F[],
): Set<CellId> {
  const all = () => new Set(Array.from({ length: map.width * map.height }, (_, index) => index));
  switch (selector.kind) {
    case "POPULATION_BEARING":
      return new Set(
        map.terrain.flatMap((terrain, index) => {
          const terrainId = runtimeTerrain(terrain);
          const base = landTerrainBaseSpec(terrainId).populationBearing;
          const ownerId = ownership[index];
          if (ownerId === null || terrainId === "TEST") {
            return base === selector.value ? [index] : [];
          }
          const owner = factionById(factions, ownerId);
          if (owner === undefined) return base === selector.value ? [index] : [];
          const effective = effectivePermission(
            owner,
            "TERRAIN_POPULATION_BEARING_PERMISSION",
            { kind: "TERRAIN", terrain: terrainId },
            base,
            {
              targetTerrain: terrainId,
              targetHasFallout: fallout[index] ?? false,
            },
          );
          return effective === selector.value ? [index] : [];
        }),
      );
    case "UNION": {
      const result = new Set<number>();
      for (const child of selector.selectors) {
        for (const cell of selectorCellSetWithEffectivePopulation(child, map, ownership, fallout, factions)) {
          result.add(cell);
        }
      }
      return result;
    }
    case "INTERSECTION": {
      if (selector.selectors.length === 0) return all();
      const [first, ...rest] = selector.selectors;
      const result = selectorCellSetWithEffectivePopulation(first!, map, ownership, fallout, factions);
      for (const child of rest) {
        const childSet = selectorCellSetWithEffectivePopulation(child, map, ownership, fallout, factions);
        for (const cell of [...result]) if (!childSet.has(cell)) result.delete(cell);
      }
      return result;
    }
    case "DIFFERENCE": {
      const result = selectorCellSetWithEffectivePopulation(selector.left, map, ownership, fallout, factions);
      const removed = selectorCellSetWithEffectivePopulation(selector.right, map, ownership, fallout, factions);
      for (const cell of removed) result.delete(cell);
      return result;
    }
    default:
      return selectorCellSet(selector, map, ownership, fallout);
  }
}

function componentSuppressed(
  faction: LandFactionStateLike,
  axis: string,
  component: string,
): boolean {
  return faction.rules.normalizedRules.some(
    (entry) =>
      entry.axis === axis &&
      ruleScopeMatches(entry.scope, { kind: "GLOBAL" }) &&
      entry.value.kind === "UNION" &&
      entry.value.values.includes(component),
  );
}

interface MechanicalOperationGroup {
  readonly key: string;
  readonly ownerId: string;
  readonly kind: "ATTACK" | "NEUTRAL_EXPANSION";
  readonly targetFactionId?: string;
  readonly source: CellSelector;
  readonly target: CellSelector;
  readonly engagementPriority?: SpatialPolicy;
  readonly pressureWeight?: SpatialPolicy;
  readonly operationIds: readonly string[];
  readonly committedPopulation: number;
}

interface FrozenLane {
  readonly ownerId: string;
  readonly kind: "ATTACK" | "NEUTRAL_EXPANSION";
  readonly targetFactionId?: string;
  readonly sourceCellId: CellId;
  readonly targetCellId: CellId;
  readonly operationIds: readonly string[];
  readonly committedPopulation: number;
  readonly pressurePopulation: number;
  readonly groupKey: string;
}

function mechanicalOperationGroups(operations: readonly LandOperationState[]): readonly MechanicalOperationGroup[] {
  const groups = new Map<string, {
    ownerId: string;
    kind: "ATTACK" | "NEUTRAL_EXPANSION";
    targetFactionId?: string;
    source: CellSelector;
    target: CellSelector;
    engagementPriority?: SpatialPolicy;
    pressureWeight?: SpatialPolicy;
    operationIds: string[];
    committedPopulation: number;
  }>();
  for (const operation of operations) {
    if (operation.kind === "COUNTER_RESPONSE" || operation.committedPopulation <= 0) continue;
    const key = JSON.stringify({
      ownerId: operation.ownerId,
      kind: operation.kind,
      targetFactionId: operation.kind === "ATTACK" ? operation.targetFactionId : undefined,
      source: canonicalCellSelectorKey(operation.source),
      target: canonicalCellSelectorKey(operation.target),
      engagementPriority: canonicalSpatialPolicyKey(operation.engagementPriority),
      pressureWeight: canonicalSpatialPolicyKey(operation.pressureWeight),
    });
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        ownerId: operation.ownerId,
        kind: operation.kind,
        ...(operation.kind === "ATTACK" ? { targetFactionId: operation.targetFactionId } : {}),
        source: operation.source,
        target: operation.target,
        ...(operation.engagementPriority === undefined ? {} : { engagementPriority: operation.engagementPriority }),
        ...(operation.pressureWeight === undefined ? {} : { pressureWeight: operation.pressureWeight }),
        operationIds: [operation.id],
        committedPopulation: operation.committedPopulation,
      });
    } else {
      existing.operationIds.push(operation.id);
      existing.committedPopulation += operation.committedPopulation;
    }
  }
  return Object.freeze(
    [...groups.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, group]) => Object.freeze({
        key,
        ...group,
        operationIds: Object.freeze([...group.operationIds]),
      })),
  );
}

function freezeLanes<F extends LandFactionStateLike>(state: LandTickStateLike<F>): readonly FrozenLane[] {
  const groups = mechanicalOperationGroups(state.operations);
  const candidateByFaction: Array<{
    ownerId: string;
    group: MechanicalOperationGroup;
    sourceCellId: number;
    targetCellId: number;
    engagementWeight: number;
  }> = [];

  for (const group of groups) {
    const owner = factionById(state.factions, group.ownerId);
    if (owner === undefined || owner.status !== "ACTIVE") continue;
    const sourceCells = [...selectorCellSetWithEffectivePopulation(
      group.source,
      state.map,
      state.ownership,
      state.fallout,
      state.factions,
    )].sort((a, b) => a - b);
    const targetCells = selectorCellSetWithEffectivePopulation(
      group.target,
      state.map,
      state.ownership,
      state.fallout,
      state.factions,
    );
    for (const sourceCellId of sourceCells) {
      if (state.ownership[sourceCellId] !== group.ownerId) continue;
      const sourceTerrain = landTerrainBaseSpec(runtimeTerrain(state.map.terrain[sourceCellId]!));
      if (!sourceTerrain.landTraversable) continue;
      for (const targetCellId of neighbors(state.map, sourceCellId)) {
        if (!targetCells.has(targetCellId)) continue;
        const targetTerrain = landTerrainBaseSpec(runtimeTerrain(state.map.terrain[targetCellId]!));
        if (!targetTerrain.conquerable || !targetTerrain.landTraversable) continue;
        const targetOwner = state.ownership[targetCellId];
        if (group.kind === "ATTACK" && targetOwner !== group.targetFactionId) continue;
        if (group.kind === "NEUTRAL_EXPANSION" && targetOwner !== null) continue;
        candidateByFaction.push({
          ownerId: group.ownerId,
          group,
          sourceCellId,
          targetCellId,
          engagementWeight: policyWeight(group.engagementPriority, targetCellId, state),
        });
      }
    }
  }

  const byFaction = new Map<string, typeof candidateByFaction>();
  for (const candidate of candidateByFaction) {
    const list = byFaction.get(candidate.ownerId) ?? [];
    list.push(candidate);
    byFaction.set(candidate.ownerId, list);
  }

  const selected: Array<{
    group: MechanicalOperationGroup;
    sourceCellId: number;
    targetCellId: number;
  }> = [];
  for (const [ownerId, candidates] of [...byFaction.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const usedSources = new Set<number>();
    const usedTargets = new Set<number>();
    const groupCounts = new Map<string, number>();
    candidates.sort((left, right) =>
      right.engagementWeight - left.engagementWeight ||
      left.targetCellId - right.targetCellId ||
      left.sourceCellId - right.sourceCellId ||
      (left.group.key < right.group.key ? -1 : left.group.key > right.group.key ? 1 : 0),
    );
    for (const candidate of candidates) {
      if (candidate.engagementWeight <= 0) continue;
      if (usedSources.has(candidate.sourceCellId) || usedTargets.has(candidate.targetCellId)) continue;
      const count = groupCounts.get(candidate.group.key) ?? 0;
      if (count >= candidate.group.committedPopulation) continue;
      usedSources.add(candidate.sourceCellId);
      usedTargets.add(candidate.targetCellId);
      groupCounts.set(candidate.group.key, count + 1);
      selected.push({
        group: candidate.group,
        sourceCellId: candidate.sourceCellId,
        targetCellId: candidate.targetCellId,
      });
    }
    void ownerId;
  }

  const selectedByGroup = new Map<string, typeof selected>();
  for (const lane of selected) {
    const list = selectedByGroup.get(lane.group.key) ?? [];
    list.push(lane);
    selectedByGroup.set(lane.group.key, list);
  }

  const result: FrozenLane[] = [];
  for (const [groupKey, lanes] of [...selectedByGroup.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const group = lanes[0]!.group;
    lanes.sort((a, b) => a.targetCellId - b.targetCellId || a.sourceCellId - b.sourceCellId);
    const allocations = new Array(lanes.length).fill(1) as number[];
    let remaining = group.committedPopulation - lanes.length;
    if (remaining > 0) {
      const weights = lanes.map((lane) =>
        Math.max(0, policyWeight(group.pressureWeight, lane.targetCellId, state)),
      );
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      const normalized = totalWeight > 0 ? weights : weights.map(() => 1);
      const denominator = normalized.reduce((sum, weight) => sum + weight, 0);
      const exact = normalized.map((weight) => (remaining * weight) / denominator);
      const floors = exact.map(Math.floor);
      for (let index = 0; index < floors.length; index += 1) allocations[index]! += floors[index]!;
      remaining -= floors.reduce((sum, value) => sum + value, 0);
      const remainderOrder = exact
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((left, right) =>
          right.fraction - left.fraction ||
          lanes[left.index]!.targetCellId - lanes[right.index]!.targetCellId ||
          lanes[left.index]!.sourceCellId - lanes[right.index]!.sourceCellId,
        );
      for (let index = 0; index < remaining; index += 1) {
        allocations[remainderOrder[index % remainderOrder.length]!.index]! += 1;
      }
    }
    lanes.forEach((lane, index) => {
      result.push(Object.freeze({
        ownerId: group.ownerId,
        kind: group.kind,
        ...(group.targetFactionId === undefined ? {} : { targetFactionId: group.targetFactionId }),
        sourceCellId: lane.sourceCellId,
        targetCellId: lane.targetCellId,
        operationIds: group.operationIds,
        committedPopulation: group.committedPopulation,
        pressurePopulation: allocations[index]!,
        groupKey,
      }));
    });
  }
  return Object.freeze(result);
}

function defensePriorityWeight<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  ownerId: string,
  cellId: number,
): number {
  return state.defensePriorities
    .filter((entry) => entry.ownerId === ownerId)
    .reduce(
      (sum, entry) => sum + policyWeight(entry.priority, cellId, state),
      0,
    );
}

function connectedThreatenedFronts(
  map: SyntheticMapSpec,
  cells: ReadonlySet<number>,
): readonly (readonly number[])[] {
  const unvisited = new Set(cells);
  const fronts: number[][] = [];
  while (unvisited.size > 0) {
    const seed = [...unvisited].sort((a, b) => a - b)[0]!;
    const queue = [seed];
    unvisited.delete(seed);
    const front: number[] = [];
    while (queue.length > 0) {
      const cell = queue.shift()!;
      front.push(cell);
      for (const adjacent of neighbors(map, cell)) {
        if (!unvisited.has(adjacent) || !cells.has(adjacent)) continue;
        unvisited.delete(adjacent);
        queue.push(adjacent);
      }
    }
    front.sort((a, b) => a - b);
    fronts.push(front);
  }
  fronts.sort((left, right) => left[0]! - right[0]!);
  return Object.freeze(fronts.map((front) => Object.freeze(front)));
}

function automaticDefenseCells<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  lanes: readonly FrozenLane[],
): ReadonlySet<number> {
  const threatenedByOwner = new Map<string, Set<number>>();
  for (const lane of lanes) {
    const owner = state.ownership[lane.targetCellId];
    if (owner === null || owner === lane.ownerId) continue;
    const set = threatenedByOwner.get(owner) ?? new Set<number>();
    set.add(lane.targetCellId);
    threatenedByOwner.set(owner, set);
  }
  const defended = new Set<number>();
  for (const [ownerId, cells] of [...threatenedByOwner.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const faction = factionById(state.factions, ownerId);
    if (faction === undefined) continue;
    const slots = Math.min(faction.population.available, cells.size);
    if (slots <= 0) continue;
    const fronts = connectedThreatenedFronts(state.map, cells);
    const exactQuotas = fronts.map((front) => (slots * front.length) / cells.size);
    const quotas = exactQuotas.map(Math.floor);
    let remaining = slots - quotas.reduce((sum, quota) => sum + quota, 0);
    const remainderOrder = exactQuotas
      .map((value, index) => ({
        index,
        fraction: value - Math.floor(value),
        firstCell: fronts[index]![0]!,
      }))
      .sort(
        (left, right) =>
          right.fraction - left.fraction || left.firstCell - right.firstCell,
      );
    for (let index = 0; index < remaining; index += 1) {
      quotas[remainderOrder[index]!.index]! += 1;
    }
    for (let index = 0; index < fronts.length; index += 1) {
      const ordered = [...fronts[index]!].sort(
        (left, right) =>
          defensePriorityWeight(state, ownerId, right) - defensePriorityWeight(state, ownerId, left) ||
          left - right,
      );
      for (const cell of ordered.slice(0, quotas[index]!)) defended.add(cell);
    }
  }
  return defended;
}

function replaceOperationPopulation(
  operations: readonly LandOperationState[],
  operationIdValue: string,
  population: number,
): readonly LandOperationState[] {
  return operations.map((operation) =>
    operation.id === operationIdValue
      ? materializeLandOperationState({ ...operation, committedPopulation: population })
      : operation,
  );
}

function decrementOperations(
  operations: readonly LandOperationState[],
  operationIds: readonly string[],
  amount: number,
): { readonly operations: readonly LandOperationState[]; readonly removed: number } {
  let remaining = amount;
  let current = operations;
  const ordered = operationIds
    .map((id) => current.find((operation) => operation.id === id))
    .filter((operation): operation is LandOperationState => operation !== undefined)
    .sort(compareOperationProjection);
  for (const operation of ordered) {
    if (remaining <= 0) break;
    const debit = Math.min(remaining, operation.committedPopulation);
    if (debit <= 0) continue;
    current = replaceOperationPopulation(current, operation.id, operation.committedPopulation - debit);
    remaining -= debit;
  }
  return { operations: current, removed: amount - remaining };
}

function updateFactionPopulation<F extends LandFactionStateLike>(
  factions: readonly F[],
  factionId: string,
  update: (population: PopulationState) => PopulationState,
): readonly F[] {
  return factions.map((faction) =>
    faction.id === factionId ? ({ ...faction, population: update(faction.population) } as F) : faction,
  );
}

function counterResidualKey(attackerFactionId: string, responderFactionId: string): string {
  return `${attackerFactionId}\u0000${responderFactionId}`;
}

function applyCounterResponses<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  operationsInput: readonly LandOperationState[],
  factionsInput: readonly F[],
): {
  readonly operations: readonly LandOperationState[];
  readonly factions: readonly F[];
  readonly residuals: readonly CounterResponseResidualState[];
} {
  let operations = operationsInput;
  let factions = factionsInput;
  const residuals = new Map<string, CounterResponseResidualState>(
    state.counterResponseResiduals.map((entry) => [
      counterResidualKey(entry.attackerFactionId, entry.responderFactionId),
      { ...entry },
    ]),
  );
  const responsesByIncoming = new Map<string, CounterResponseOperationState[]>();
  for (const operation of state.operations) {
    if (operation.kind !== "COUNTER_RESPONSE" || operation.committedPopulation <= 0) continue;
    const list = responsesByIncoming.get(operation.incomingOperationId) ?? [];
    list.push(operation);
    responsesByIncoming.set(operation.incomingOperationId, list);
  }

  for (const [incomingId, responses] of [...responsesByIncoming.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const incomingPre = state.operations.find((operation) => operation.id === incomingId);
    if (incomingPre === undefined || incomingPre.kind !== "ATTACK" || incomingPre.committedPopulation <= 0) continue;
    const responderId = responses[0]!.ownerId;
    if (responses.some((response) => response.ownerId !== responderId)) continue;
    const responder = factionById(state.factions, responderId);
    if (responder === undefined) continue;
    const responsePopulation = responses.reduce((sum, response) => sum + response.committedPopulation, 0);
    const calculated = calculateCounterResponseTick(
      incomingPre.committedPopulation,
      responsePopulation,
    );
    const effectiveResponseEffectiveness = scalarRule(
      responder,
      state,
      "COUNTER_RESPONSE_EFFECTIVENESS",
      { kind: "GLOBAL" },
      calculated.responseEffectiveness,
      { targetHasFallout: false },
    );
    const baseLoss = 0.005 * Math.min(incomingPre.committedPopulation, responsePopulation);
    const attackingPopulationLost = baseLoss * effectiveResponseEffectiveness;
    const respondingPopulationLost = calculated.respondingPopulationLost;
    const key = counterResidualKey(incomingPre.ownerId, responderId);
    const previous = residuals.get(key) ?? {
      attackerFactionId: incomingPre.ownerId,
      responderFactionId: responderId,
      attackingLossMicros: 0,
      respondingLossMicros: 0,
    };
    const attackingTotalMicros = previous.attackingLossMicros + Math.round(attackingPopulationLost * COUNTER_RESIDUAL_SCALE);
    const respondingTotalMicros = previous.respondingLossMicros + Math.round(respondingPopulationLost * COUNTER_RESIDUAL_SCALE);
    let attackingWhole = Math.floor(attackingTotalMicros / COUNTER_RESIDUAL_SCALE);
    let respondingWhole = Math.floor(respondingTotalMicros / COUNTER_RESIDUAL_SCALE);

    const incomingCurrent = operations.find((operation) => operation.id === incomingId);
    const attackCap = incomingCurrent?.committedPopulation ?? 0;
    attackingWhole = Math.min(attackingWhole, attackCap);
    const currentResponses = operations.filter(
      (operation): operation is CounterResponseOperationState =>
        operation.kind === "COUNTER_RESPONSE" &&
        operation.incomingOperationId === incomingId &&
        operation.ownerId === responderId,
    );
    const responseCap = currentResponses.reduce((sum, response) => sum + response.committedPopulation, 0);
    respondingWhole = Math.min(respondingWhole, responseCap);

    if (attackingWhole > 0 && incomingCurrent !== undefined) {
      operations = replaceOperationPopulation(
        operations,
        incomingId,
        incomingCurrent.committedPopulation - attackingWhole,
      );
      factions = updateFactionPopulation(factions, incomingPre.ownerId, (population) =>
        removePopulation(population, "OFFENSIVE", attackingWhole),
      );
    }
    if (respondingWhole > 0) {
      const responseIds = currentResponses.sort(compareOperationProjection).map((entry) => entry.id);
      const decremented = decrementOperations(operations, responseIds, respondingWhole);
      operations = decremented.operations;
      factions = updateFactionPopulation(factions, responderId, (population) =>
        removePopulation(population, "COUNTER_RESPONSE", decremented.removed),
      );
      respondingWhole = decremented.removed;
    }

    const attackStillAlive =
      (operations.find((operation) => operation.id === incomingId)?.committedPopulation ?? 0) > 0;
    const responseStillAlive = operations.some(
      (operation) =>
        operation.kind === "COUNTER_RESPONSE" &&
        operation.incomingOperationId === incomingId &&
        operation.ownerId === responderId &&
        operation.committedPopulation > 0,
    );
    residuals.set(key, {
      attackerFactionId: incomingPre.ownerId,
      responderFactionId: responderId,
      attackingLossMicros: attackStillAlive
        ? attackingTotalMicros - attackingWhole * COUNTER_RESIDUAL_SCALE
        : 0,
      respondingLossMicros: responseStillAlive
        ? respondingTotalMicros - respondingWhole * COUNTER_RESIDUAL_SCALE
        : 0,
    });
  }

  return Object.freeze({
    operations: Object.freeze([...operations].sort(compareOperationProjection).map(materializeLandOperationState)),
    factions: Object.freeze(factions),
    residuals: Object.freeze(
      [...residuals.values()]
        .filter((entry) => entry.attackingLossMicros !== 0 || entry.respondingLossMicros !== 0)
        .sort((left, right) =>
          left.attackerFactionId < right.attackerFactionId
            ? -1
            : left.attackerFactionId > right.attackerFactionId
              ? 1
              : left.responderFactionId < right.responderFactionId
                ? -1
                : left.responderFactionId > right.responderFactionId
                  ? 1
                  : 0,
        )
        .map((entry) => Object.freeze({ ...entry })),
    ),
  });
}

interface ClaimantTickFact {
  readonly lane: FrozenLane;
  readonly effectiveAttackingPressure: number;
  readonly effectiveDefendingPressure: number;
  readonly progressMicros: number;
}

function claimantTickFact<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  lane: FrozenLane,
  defended: ReadonlySet<number>,
  previousProgressMicros: number,
): ClaimantTickFact {
  const attacker = factionById(state.factions, lane.ownerId)!;
  const sourceTerrainId = runtimeTerrain(state.map.terrain[lane.sourceCellId]!);
  const targetTerrainId = runtimeTerrain(state.map.terrain[lane.targetCellId]!);
  const sourceTerrain = landTerrainBaseSpec(sourceTerrainId);
  const targetTerrain = landTerrainBaseSpec(targetTerrainId);
  const targetHasFallout = state.fallout[lane.targetCellId] ?? false;
  const sourceContext: RuleContext = {
    ...(sourceTerrainId === "TEST" ? {} : { sourceTerrain: sourceTerrainId }),
    ...(targetTerrainId === "TEST" ? {} : { targetTerrain: targetTerrainId }),
    targetHasFallout,
  };
  const globalOffense = scalarRule(
    attacker,
    state,
    "GLOBAL_OFFENSIVE_PRESSURE",
    { kind: "GLOBAL" },
    1,
    sourceContext,
  );
  const terrainOffense = sourceTerrainId === "TEST"
    ? sourceTerrain.offensivePressureMultiplier
    : scalarRule(
        attacker,
        state,
        "TERRAIN_OFFENSIVE_PRESSURE",
        { kind: "TERRAIN", terrain: sourceTerrainId },
        sourceTerrain.offensivePressureMultiplier,
        sourceContext,
      );
  const attackingPressure = lane.pressurePopulation * globalOffense * terrainOffense;

  let defendingPressure = 0;
  const defenderId = state.ownership[lane.targetCellId];
  if (defenderId !== null && defended.has(lane.targetCellId)) {
    const defender = factionById(state.factions, defenderId);
    if (defender !== undefined) {
      const globalDefense = scalarRule(
        defender,
        state,
        "GLOBAL_DEFENSIVE_PRESSURE",
        { kind: "GLOBAL" },
        1,
        sourceContext,
      );
      const terrainDefense = targetTerrainId === "TEST"
        ? targetTerrain.defensivePressureMultiplier
        : scalarRule(
            defender,
            state,
            "TERRAIN_DEFENSIVE_PRESSURE",
            { kind: "TERRAIN", terrain: targetTerrainId },
            targetTerrain.defensivePressureMultiplier,
            sourceContext,
          );
      defendingPressure = globalDefense * terrainDefense;
    }
  }

  const denominator = attackingPressure + defendingPressure;
  const advantage = denominator === 0 ? 0 : (attackingPressure - defendingPressure) / denominator;
  const canAcquire =
    !targetHasFallout ||
    effectivePermission(
      attacker,
      "FALLOUT_ACQUISITION_PERMISSION",
      { kind: "GLOBAL" },
      true,
      sourceContext,
    );
  let acquisitionMultiplier = targetTerrainId === "TEST"
    ? targetTerrain.acquisitionProgressMultiplier
    : scalarRule(
        attacker,
        state,
        "TERRAIN_ACQUISITION_SPEED",
        { kind: "TERRAIN", terrain: targetTerrainId },
        targetTerrain.acquisitionProgressMultiplier,
        sourceContext,
      );
  if (
    targetHasFallout &&
    !componentSuppressed(
      attacker,
      "ACQUISITION_SUPPRESSED_COMPONENTS",
      RULE_COMPONENT.FALLOUT_ACQUISITION_RESISTANCE,
    )
  ) {
    acquisitionMultiplier *= 0.5;
  }
  acquisitionMultiplier = scalarRule(
    attacker,
    state,
    "ACQUISITION_PROGRESS",
    { kind: "GLOBAL" },
    acquisitionMultiplier,
    sourceContext,
  );
  if (lane.kind === "NEUTRAL_EXPANSION") {
    acquisitionMultiplier = scalarRule(
      attacker,
      state,
      "NEUTRAL_SETTLEMENT_PROGRESS",
      { kind: "GLOBAL" },
      acquisitionMultiplier,
      sourceContext,
    );
  }
  const progressPerSecond = canAcquire ? Math.max(0, advantage) * acquisitionMultiplier : 0;
  const increment = Math.max(0, Math.round((progressPerSecond / TICKS_PER_SECOND) * PROGRESS_SCALE));
  const progressMicros =
    !canAcquire || advantage <= 0
      ? Math.max(0, previousProgressMicros - PROGRESS_DECAY_MICROS_PER_TICK)
      : Math.min(REQUIRED_PROGRESS_MICROS, previousProgressMicros + increment);
  return Object.freeze({
    lane,
    effectiveAttackingPressure: attackingPressure,
    effectiveDefendingPressure: defendingPressure,
    progressMicros,
  });
}

function neutralSettlementCost<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
  faction: F,
  targetCellId: number,
): number {
  const terrainId = runtimeTerrain(state.map.terrain[targetCellId]!);
  const baseTerrain = landTerrainBaseSpec(terrainId);
  if (!baseTerrain.populationBearing) return 0;
  const context: RuleContext = {
    ...(terrainId === "TEST" ? {} : { targetTerrain: terrainId }),
    targetHasFallout: state.fallout[targetCellId] ?? false,
  };
  return scalarRule(
    faction,
    state,
    "NEUTRAL_SETTLEMENT_POPULATION_COST",
    { kind: "GLOBAL" },
    1,
    context,
  );
}

function settlementDebitAmount(
  population: PopulationState,
  cost: number,
): { readonly debit: number; readonly nextResidual: 0 | 1 } {
  if (cost === 0) return { debit: 0, nextResidual: population.neutralSettlementHalfResidual };
  if (cost === 0.5) {
    return population.neutralSettlementHalfResidual === 0
      ? { debit: 0, nextResidual: 1 }
      : { debit: 1, nextResidual: 0 };
  }
  if (Number.isSafeInteger(cost) && cost > 0) {
    return { debit: cost, nextResidual: population.neutralSettlementHalfResidual };
  }
  throw new Error(`unsupported neutral settlement Population cost: ${cost}`);
}

function neutralOperationIds(
  operations: readonly LandOperationState[],
  ownerId: string,
  winningLane: FrozenLane,
  resolvedLanes: readonly FrozenLane[],
): readonly string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const append = (ids: readonly string[]) => {
    const entries = ids
      .map((id) => operations.find((operation) => operation.id === id))
      .filter(
        (operation): operation is NeutralExpansionOperationState =>
          operation !== undefined &&
          operation.kind === "NEUTRAL_EXPANSION" &&
          operation.ownerId === ownerId,
      )
      .sort(compareOperationProjection);
    for (const operation of entries) {
      if (seen.has(operation.id)) continue;
      seen.add(operation.id);
      ordered.push(operation.id);
    }
  };

  append(winningLane.operationIds);
  const otherLanes = resolvedLanes
    .filter(
      (lane) =>
        lane.kind === "NEUTRAL_EXPANSION" &&
        lane.ownerId === ownerId &&
        lane !== winningLane,
    )
    .sort(
      (left, right) =>
        left.targetCellId - right.targetCellId || left.sourceCellId - right.sourceCellId,
    );
  for (const lane of otherLanes) append(lane.operationIds);
  append(
    operations
      .filter(
        (operation): operation is NeutralExpansionOperationState =>
          operation.kind === "NEUTRAL_EXPANSION" &&
          operation.ownerId === ownerId &&
          !seen.has(operation.id),
      )
      .sort(compareOperationProjection)
      .map((operation) => operation.id),
  );
  return Object.freeze(ordered);
}

interface CaptureFact {
  readonly capturingFactionId: string;
  readonly previousOwnerId: string | null;
  readonly targetCellId: number;
  readonly sourceCellId: number;
  readonly operationIds: readonly string[];
  readonly p47: boolean;
}

export interface LandTickResult<F extends LandFactionStateLike> {
  readonly factions: readonly F[];
  readonly ownership: readonly (string | null)[];
  readonly fallout: readonly boolean[];
  readonly operations: readonly LandOperationState[];
  readonly defensePriorities: readonly DefensePriorityState[];
  readonly captureProgress: readonly CaptureProgressState[];
  readonly counterResponseResiduals: readonly CounterResponseResidualState[];
}

export function resolveLandTick<F extends LandFactionStateLike>(
  state: LandTickStateLike<F>,
): LandTickResult<F> {
  const lanes = freezeLanes(state);
  const defended = automaticDefenseCells(state, lanes);
  const counter = applyCounterResponses(state, state.operations, state.factions);
  let operations = counter.operations;
  let factions = counter.factions;
  const ownership = [...state.ownership];
  const fallout = [...state.fallout];

  const progress = new Map<string, CaptureProgressState>();
  for (const entry of state.captureProgress) {
    progress.set(`${entry.cellId}\u0000${entry.claimantFactionId}`, { ...entry });
  }
  const activeKeys = new Set<string>();
  const factsByTarget = new Map<number, ClaimantTickFact[]>();
  for (const lane of lanes) {
    const key = `${lane.targetCellId}\u0000${lane.ownerId}`;
    activeKeys.add(key);
    const previous = progress.get(key)?.progressMicros ?? 0;
    const fact = claimantTickFact(state, lane, defended, previous);
    progress.set(key, {
      cellId: lane.targetCellId,
      claimantFactionId: lane.ownerId,
      progressMicros: fact.progressMicros,
    });
    const list = factsByTarget.get(lane.targetCellId) ?? [];
    list.push(fact);
    factsByTarget.set(lane.targetCellId, list);
  }

  for (const [key, entry] of [...progress.entries()]) {
    if (activeKeys.has(key)) continue;
    const decayed = Math.max(0, entry.progressMicros - PROGRESS_DECAY_MICROS_PER_TICK);
    if (decayed === 0) progress.delete(key);
    else progress.set(key, { ...entry, progressMicros: decayed });
  }

  const captures: CaptureFact[] = [];
  for (const [targetCellId, facts] of [...factsByTarget.entries()].sort(([a], [b]) => a - b)) {
    const successful = facts
      .filter((fact) => fact.progressMicros >= REQUIRED_PROGRESS_MICROS)
      .sort((left, right) =>
        right.progressMicros - left.progressMicros ||
        right.effectiveAttackingPressure - left.effectiveAttackingPressure ||
        (left.lane.ownerId < right.lane.ownerId ? -1 : left.lane.ownerId > right.lane.ownerId ? 1 : 0),
      );
    const winner = successful[0];
    if (winner === undefined) continue;
    const previousOwnerId = state.ownership[targetCellId];
    const capturingFaction = factionById(factions, winner.lane.ownerId);
    if (capturingFaction === undefined) continue;

    if (winner.lane.kind === "NEUTRAL_EXPANSION") {
      const cost = neutralSettlementCost(state, capturingFaction, targetCellId);
      const settlement = settlementDebitAmount(capturingFaction.population, cost);
      if (settlement.debit > 0) {
        const ids = neutralOperationIds(
          operations,
          capturingFaction.id,
          winner.lane,
          lanes,
        );
        const aggregate = ids.reduce(
          (sum, id) =>
            sum + (operations.find((operation) => operation.id === id)?.committedPopulation ?? 0),
          0,
        );
        if (aggregate < settlement.debit) continue;
        const decremented = decrementOperations(operations, ids, settlement.debit);
        if (decremented.removed !== settlement.debit) continue;
        operations = decremented.operations;
        factions = updateFactionPopulation(factions, capturingFaction.id, (population) => {
          const removed = removePopulation(population, "OFFENSIVE", settlement.debit);
          return createPopulationState({
            ...removed,
            neutralSettlementHalfResidual: settlement.nextResidual,
          });
        });
      } else if (settlement.nextResidual !== capturingFaction.population.neutralSettlementHalfResidual) {
        factions = updateFactionPopulation(factions, capturingFaction.id, (population) =>
          createPopulationState({
            ...population,
            neutralSettlementHalfResidual: settlement.nextResidual,
          }),
        );
      }
    } else if (previousOwnerId !== null) {
      const attackerDebit = decrementOperations(operations, winner.lane.operationIds, 1);
      if (attackerDebit.removed !== 1) continue;
      operations = attackerDebit.operations;
      factions = updateFactionPopulation(factions, capturingFaction.id, (population) =>
        removePopulation(population, "OFFENSIVE", 1),
      );
    }

    ownership[targetCellId] = capturingFaction.id;
    fallout[targetCellId] = false;

    if (previousOwnerId !== null && defended.has(targetCellId)) {
      const previousOwner = factionById(factions, previousOwnerId);
      const defenderSurvives =
        previousOwner !== undefined &&
        hasCustomDomain(previousOwner, "AUTOMATIC_DEFENDER_SURVIVAL");
      if (!defenderSurvives && previousOwner !== undefined && previousOwner.population.available > 0) {
        factions = updateFactionPopulation(factions, previousOwnerId, (population) =>
          removePopulation(population, "AVAILABLE", 1),
        );
      }
    }

    const previousOwner = previousOwnerId === null ? undefined : factionById(state.factions, previousOwnerId);
    const targetTerrain = runtimeTerrain(state.map.terrain[targetCellId]!);
    captures.push({
      capturingFactionId: capturingFaction.id,
      previousOwnerId,
      targetCellId,
      sourceCellId: winner.lane.sourceCellId,
      operationIds: winner.lane.operationIds,
      p47:
        previousOwner !== undefined &&
        targetTerrain === "MARSH" &&
        hasCustomDomain(previousOwner, "MARSH_CAPTURE_POPULATION_PENALTY"),
    });

    for (const key of [...progress.keys()]) {
      if (key.startsWith(`${targetCellId}\u0000`)) progress.delete(key);
    }
  }

  const p47ByFaction = new Map<string, CaptureFact[]>();
  for (const capture of captures) {
    if (!capture.p47) continue;
    const list = p47ByFaction.get(capture.capturingFactionId) ?? [];
    list.push(capture);
    p47ByFaction.set(capture.capturingFactionId, list);
  }
  for (const [factionId, capturesForFaction] of [...p47ByFaction.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const request = capturesForFaction.length;
    const opFirstFact = new Map<string, CaptureFact>();
    for (const capture of capturesForFaction) {
      for (const id of capture.operationIds) {
        const existing = opFirstFact.get(id);
        if (
          existing === undefined ||
          capture.targetCellId < existing.targetCellId ||
          (capture.targetCellId === existing.targetCellId && capture.sourceCellId < existing.sourceCellId)
        ) {
          opFirstFact.set(id, capture);
        }
      }
    }
    const qualifyingIds = [...opFirstFact.entries()]
      .sort(([leftId, leftFact], [rightId, rightFact]) =>
        leftFact.targetCellId - rightFact.targetCellId ||
        leftFact.sourceCellId - rightFact.sourceCellId ||
        (() => {
          const leftOp = operations.find((operation) => operation.id === leftId);
          const rightOp = operations.find((operation) => operation.id === rightId);
          if (leftOp === undefined || rightOp === undefined) return leftId < rightId ? -1 : 1;
          return compareOperationProjection(leftOp, rightOp);
        })(),
      )
      .map(([id]) => id);
    const survivingWinning = qualifyingIds.reduce(
      (sum, id) => sum + (operations.find((operation) => operation.id === id)?.committedPopulation ?? 0),
      0,
    );
    const winningLoss = Math.min(request, survivingWinning);
    if (winningLoss > 0) {
      const decremented = decrementOperations(operations, qualifyingIds, winningLoss);
      operations = decremented.operations;
      factions = updateFactionPopulation(factions, factionId, (population) =>
        removePopulation(population, "OFFENSIVE", decremented.removed),
      );
    }
    const remaining = request - winningLoss;
    if (remaining > 0) {
      const faction = factionById(factions, factionId);
      const availableLoss = Math.min(remaining, faction?.population.available ?? 0);
      if (availableLoss > 0) {
        factions = updateFactionPopulation(factions, factionId, (population) =>
          removePopulation(population, "AVAILABLE", availableLoss),
        );
      }
    }
  }

  return Object.freeze({
    factions: Object.freeze(factions),
    ownership: Object.freeze(ownership),
    fallout: Object.freeze(fallout),
    operations: Object.freeze([...operations].sort(compareOperationProjection).map(materializeLandOperationState)),
    defensePriorities: Object.freeze(state.defensePriorities.map(materializeDefensePriorityState)),
    captureProgress: Object.freeze(
      [...progress.values()]
        .filter((entry) => entry.progressMicros > 0)
        .sort((left, right) =>
          left.cellId - right.cellId ||
          (left.claimantFactionId < right.claimantFactionId ? -1 : left.claimantFactionId > right.claimantFactionId ? 1 : 0),
        )
        .map((entry) => Object.freeze({ ...entry })),
    ),
    counterResponseResiduals: counter.residuals,
  });
}
