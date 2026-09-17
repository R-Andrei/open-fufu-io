import {
  factionRelationBetween } from "../core/FactionRelations";
import type {
  CellId,
  CellSelector,
  ActionRef,
  CellView,
  ControllerCommand,
  ControllerStructureFieldId,
  ControllerStructureView,
  DecisionFailure,
  FactionFindFilter,
  FactionReadView,
  MechanicsApi,
  MobileUnitType,
  OperationKind,
  OperationStatus,
  PublicFactionRelation,
  QueryPage,
  SegmentId,
  SegmentView,
  StructureBuildQuote,
  StructureFieldAffiliation,
  StructureFieldId,
  StructureFindFilter,
  StructureLevel,
  StructureLocator,
  StructureRef,
  StructureType,
  StructureUpgradeQuote,
  StructureView,
  TerrainType,
  UnitFindFilter,
  UnitLocator,
  UnitRef,
  UnitView,
} from "../core/controller/ControllerApi";
import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  ruleScopeMatches,
  type RuleCondition,
} from "../core/rules/RuleComposition";
import { materializeCompiledScalarScaleFactor } from "../core/rules/RuleMaterialization";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromAreaFactor,
  structureRadialFieldFromRangeFactor,
  type StructureRadialFieldProfile,
} from "../core/rules/StructureFieldGeometry";
import {
  isDirectRevealActive,
  isOwnedForestConcealmentCell,
  resolveTacticalVisibility,
} from "../core/visibility/TacticalVisibility";
import { calculateFactionScore } from "./FactionScore";
import { landTerrainBaseSpec, type LandOperationState } from "./LandOperations";
import type { MatchFactionState, MatchState } from "./MatchState";
import type { SimulationTerrain } from "./SimulationMap";
import {
  effectiveStructureConstructionTicks,
  structureBuildPurchaseFfyPreview,
  structureBuildPurchaseTargetLevel,
  structureUpgradePurchaseFfyPreview,
  tryPurchaseStructureBuild,
  tryPurchaseStructureUpgrade,
  type PersistentStructureState,
  type StructurePurchaseFailureCode,
} from "./Structures";

const DEFAULT_MATERIALIZED_ENTITY_VIEWS_PER_DECISION = 512;
const MAX_ENTITY_FIND_RESULTS = 128;

export interface ControllerQueryBudgetLimits {
  readonly queriesPerDecision: number;
  readonly materializedCellsPerDecision: number;
  readonly materializedEntityViewsPerDecision?: number;
}

export interface ControllerQueryUsage {
  readonly queries: number;
  readonly materializedCells: number;
  readonly materializedEntityViews: number;
}

export interface ControllerOperationReadView {
  readonly ref: string;
  readonly directiveKey?: string;
  readonly kind: OperationKind;
  readonly ownerId: FactionReadView["ref"];
  readonly targetFactionId?: FactionReadView["ref"];
  readonly committedPopulation: number;
  readonly status: OperationStatus;
  readonly source?: CellSelector;
  readonly target?: CellSelector;
}

export interface ControllerPublicOperationSource {
  readonly entries: readonly Readonly<{
    readonly direction: "OWN" | "INCOMING";
    readonly view: ControllerOperationReadView;
  }>[];
}

export type ControllerConstructionMechanics = Readonly<
  Pick<MechanicsApi, "structureBuildQuote" | "structureUpgradeQuote">
>;

/** Internal same-process source for cheap public spatial projection. */
export interface ControllerPublicSpatialSource {
  readonly map: MatchState["map"];
  readonly ownership: MatchState["ownership"];
}

/** Parent-process-only faction metadata used to build an opaque worker snapshot. */
export interface ControllerPublicFactionSource {
  readonly requesterFactionId: string;
  readonly entries: readonly Readonly<{
    readonly authoritativeId: string;
    readonly ref: FactionReadView["ref"];
    readonly displayName: string;
    readonly status: FactionReadView["status"];
    readonly relation: FactionReadView["relation"];
    readonly isMinorFaction: boolean;
    readonly origin?: FactionReadView["origin"];
    readonly score?: number;
    readonly teamId?: string;
  }>[];
}

export interface ControllerQuerySession {
  readonly publicSpatial: ControllerPublicSpatialSource;
  /** Internal transport source; kept non-enumerable by the concrete session. */
  readonly publicFactions?: ControllerPublicFactionSource;
  /** Safe opaque operation snapshot used by isolated workers; non-enumerable. */
  readonly publicOperations?: ControllerPublicOperationSource;
  readonly mechanics: ControllerConstructionMechanics;
  readonly factions: Readonly<{
    get(ref: string): FactionReadView | undefined;
    find(filter?: FactionFindFilter): readonly FactionReadView[];
    proximity(ref: string): number | undefined;
  }>;
  readonly operations: Readonly<{
    get(ref: string): ControllerOperationReadView | undefined;
    own(): readonly ControllerOperationReadView[];
    incoming(): readonly ControllerOperationReadView[];
  }>;
  readonly units: Readonly<{
    get(locator: UnitLocator): Promise<UnitView | undefined>;
    find(filter?: UnitFindFilter): Promise<QueryPage<UnitView>>;
    count(filter?: UnitFindFilter): Promise<number>;
  }>;
  readonly structures: Readonly<{
    get(locator: StructureLocator): Promise<StructureView | undefined>;
    find(filter?: StructureFindFilter): Promise<QueryPage<StructureView>>;
    count(filter?: StructureFindFilter): Promise<number>;
    build(type: StructureType, cellId: CellId): ActionRef;
    checkBuild(type: StructureType, cellId: CellId): StructureBuildQuote;
  }>;
  consumeStagedCommands(): readonly ControllerCommand[];
  readonly cells: Readonly<{
    get(id: CellId): Promise<CellView | undefined>;
    query(selector: CellSelector, limit?: number): Promise<QueryPage<CellView>>;
    count(selector: CellSelector): Promise<number>;
    neighbors(id: CellId): Promise<readonly CellId[]>;
    boundary(selector: CellSelector, limit?: number): Promise<QueryPage<CellView>>;
    connectedComponents(selector: CellSelector): Promise<QueryPage<CellSelector>>;
    distance(a: CellId, b: CellId): Promise<number>;
  }>;
  readonly segments: Readonly<{
    get(id: SegmentId): Promise<SegmentView | undefined>;
    list(): Promise<readonly SegmentView[]>;
    cells(id: SegmentId): CellSelector;
  }>;
  usage(): ControllerQueryUsage;
}

type FieldScaling = "AREA" | "RANGE";

type StructureFieldDefinition = Readonly<{
  structureType: Extract<
    StructureType,
    "FORT" | "SAM_LAUNCHER" | "OBSERVATION_POST" | "COMMAND_POST"
  >;
  axis:
    | "STRUCTURE_FIELD_COVERAGE_AREA"
    | "STRUCTURE_INTERCEPTION_RANGE"
    | "STRUCTURE_OBSERVATION_RADIUS";
  scaling: FieldScaling;
  baselineRadii: readonly [number, number, number, number, number];
}>;

const STRUCTURE_FIELD_DEFINITIONS: Readonly<
  Record<ControllerStructureFieldId, StructureFieldDefinition>
> = Object.freeze({
  FORT: Object.freeze({
    structureType: "FORT",
    axis: "STRUCTURE_FIELD_COVERAGE_AREA",
    scaling: "AREA",
    baselineRadii: Object.freeze([30, 35, 40, 45, 50] as const),
  }),
  SAM_LAUNCHER: Object.freeze({
    structureType: "SAM_LAUNCHER",
    axis: "STRUCTURE_INTERCEPTION_RANGE",
    scaling: "RANGE",
    baselineRadii: Object.freeze([70, 80, 90, 100, 105] as const),
  }),
  OBSERVATION: Object.freeze({
    structureType: "OBSERVATION_POST",
    axis: "STRUCTURE_OBSERVATION_RADIUS",
    scaling: "RANGE",
    baselineRadii: Object.freeze([40, 55, 70, 85, 100] as const),
  }),
  COMMAND_POST: Object.freeze({
    structureType: "COMMAND_POST",
    axis: "STRUCTURE_FIELD_COVERAGE_AREA",
    scaling: "AREA",
    baselineRadii: Object.freeze([30, 35, 40, 45, 50] as const),
  }),
});

interface StructureFieldSource {
  readonly centerCellId: CellId;
  readonly profile: StructureRadialFieldProfile;
}

interface StructureVisibilityContext {
  readonly requesterFactionId: string;
  readonly remoteObservationFields: readonly StructureFieldSource[];
  readonly enemyBlackoutFields: readonly StructureFieldSource[];
  readonly resolveFactionRef?: (ref: string) => string | undefined;
  readonly resolveStructureRef?: (ref: string) => string | undefined;
}

interface ControllerQueryMobileUnitState {
  readonly id: string;
  readonly ownerId: string;
  readonly type: MobileUnitType;
  readonly cellId: CellId;
  readonly strategicDestinationCellId?: CellId;
}

interface ControllerQueryReferenceSession {
  issue(
    viewerFactionId: string,
    domain: "UNIT" | "STRUCTURE" | "OPERATION",
    authoritativeId: string,
  ): string | undefined;
  resolve(
    viewerFactionId: string,
    domain: "UNIT" | "STRUCTURE" | "OPERATION",
    ref: string,
  ): string | undefined;
  issueFaction(factionId: string): FactionReadView["ref"] | undefined;
  resolveFaction(ref: string): string | undefined;
}

function orderedExplicitCellIds(
  state: MatchState,
  selector: Extract<CellSelector, { readonly kind: "CELLS" }>,
): readonly CellId[] {
  return Object.freeze(
    [...new Set(selector.ids.filter((id) => state.map.isValidCellId(id)))].sort(
      (left, right) => left - right,
    ),
  );
}

function cellConditionApplies(
  conditions: readonly RuleCondition[],
  terrain: TerrainType,
  hasFallout: boolean,
): boolean {
  return conditions.every((condition) => {
    switch (condition.kind) {
      case "SOURCE_TERRAIN_IS":
        return false;
      case "TARGET_TERRAIN_IS":
      case "EVENT_TERRAIN_IS":
      case "BUILD_TERRAIN_IS":
        return condition.terrain === terrain;
      case "TARGET_HAS_FALLOUT":
        return hasFallout;
      case "TARGET_LACKS_FALLOUT":
        return !hasFallout;
      default:
        return false;
    }
  });
}

function effectivePopulationBearing(
  state: MatchState,
  id: CellId,
  terrain: SimulationTerrain,
): boolean {
  const base = landTerrainBaseSpec(terrain).populationBearing;
  const ownerId = state.ownership[id] ?? null;
  if (
    ownerId === null ||
    terrain === "TEST" ||
    terrain === "DEEP_WATER" ||
    terrain === "IMPASSABLE"
  ) {
    return base;
  }

  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) return base;

  let allowed = base;
  for (const entry of owner.rules.normalizedRules) {
    if (
      entry.axis !== "TERRAIN_POPULATION_BEARING_PERMISSION" ||
      !ruleScopeMatches(entry.scope, { kind: "TERRAIN", terrain }) ||
      (entry.conditions !== undefined &&
        !cellConditionApplies(entry.conditions, terrain, state.fallout[id] ?? false))
    ) {
      continue;
    }
    if (entry.value.kind !== "PROHIBIT_WINS") continue;
    if (entry.value.decision === "PROHIBIT") return false;
    allowed = true;
  }
  return allowed;
}

function isWater(terrain: SimulationTerrain): boolean {
  return terrain === "SHALLOW_WATER" || terrain === "DEEP_WATER";
}

function isCoast(state: MatchState, id: CellId): boolean {
  const terrain = state.map.terrainAt(id);
  return (
    terrain !== "SHALLOW_WATER" &&
    landTerrainBaseSpec(terrain).landTraversable &&
    state.map
      .cardinalNeighbors(id)
      .some((neighbor) => isWater(state.map.terrainAt(neighbor)))
  );
}

function isShoreline(state: MatchState, id: CellId): boolean {
  const terrain = state.map.terrainAt(id);
  if (!isWater(terrain)) return false;
  return state.map.cardinalNeighbors(id).some((neighbor) => {
    const adjacent = state.map.terrainAt(neighbor);
    return (
      landTerrainBaseSpec(adjacent).landTraversable &&
      adjacent !== "SHALLOW_WATER"
    );
  });
}

function materializeCellView(
  state: MatchState,
  visibility: StructureVisibilityContext,
  id: CellId,
): CellView | undefined {
  if (!state.map.isValidCellId(id)) return undefined;
  const terrain = state.map.terrainAt(id);
  if (terrain === "TEST") {
    throw new Error("TEST terrain has no public CellView representation");
  }
  const ownerId = state.ownership[id] ?? null;
  const segmentId = state.map.segments?.segmentIdOf(id);
  const base = landTerrainBaseSpec(terrain);
  const structure = state.structures.find((candidate) => candidate.cellId === id);
  const structureView =
    structure !== undefined &&
    structureIsLawfullyVisible(state, visibility, structure)
      ? materializeControllerStructureView(state, structure)
      : undefined;
  return Object.freeze({
    id,
    position: state.map.positionOf(id),
    terrain,
    hasFallout: state.fallout[id] ?? false,
    conquerable: base.conquerable,
    populationBearing: effectivePopulationBearing(state, id, terrain),
    ...(ownerId === null ? {} : { ownerId }),
    ...(segmentId === undefined ? {} : { segmentId }),
    isCoast: isCoast(state, id),
    isShoreline: isShoreline(state, id),
    ...(structureView === undefined ? {} : { structure: structureView }),
  });
}

function materializeSegmentView(
  state: MatchState,
  id: SegmentId,
): SegmentView | undefined {
  const segments = state.map.segments;
  if (
    segments === undefined ||
    !Number.isSafeInteger(id) ||
    id < 0 ||
    id >= segments.segmentCount
  ) {
    return undefined;
  }

  const span = segments.cells(id);
  let populationBearingCellCount = 0;
  const ownerCounts: Record<string, number> = {};
  const terrainCounts: Partial<Record<TerrainType, number>> = {};

  for (let index = 0; index < span.length; index += 1) {
    const cellId = span.at(index);
    const terrain = state.map.terrainAt(cellId);
    if (terrain === "TEST") {
      throw new Error("Segment runtime cannot summarize TEST terrain");
    }
    terrainCounts[terrain] = (terrainCounts[terrain] ?? 0) + 1;
    if (effectivePopulationBearing(state, cellId, terrain)) {
      populationBearingCellCount += 1;
    }
    const ownerId = state.ownership[cellId] ?? null;
    if (ownerId !== null) ownerCounts[ownerId] = (ownerCounts[ownerId] ?? 0) + 1;
  }

  const ownerShares: Record<string, number> = {};
  for (const ownerId of Object.keys(ownerCounts).sort()) {
    ownerShares[ownerId] = ownerCounts[ownerId]! / span.length;
  }

  return Object.freeze({
    id,
    cellCount: span.length,
    populationBearingCellCount,
    ownerShares: Object.freeze(ownerShares),
    adjacentSegmentIds: Object.freeze([...segments.adjacentSegmentIds(id)]),
    terrainCounts: Object.freeze(terrainCounts),
  });
}

function factionIdentity(faction: MatchFactionState) {
  return {
    factionId: faction.id,
    ...(faction.fixedTeamId === undefined
      ? {}
      : { fixedTeamId: faction.fixedTeamId }),
  };
}

function factionById(state: MatchState, factionId: string): MatchFactionState | undefined {
  return state.factions.find((faction) => faction.id === factionId);
}

function factionRelation(
  state: MatchState,
  requesterFactionId: string,
  otherFactionId: string,
): PublicFactionRelation | undefined {
  const requester = factionById(state, requesterFactionId);
  const other = factionById(state, otherFactionId);
  if (requester === undefined || other === undefined) return undefined;
  return factionRelationBetween(factionIdentity(requester), factionIdentity(other));
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

function effectiveStructureFieldProfile(
  state: MatchState,
  structure: PersistentStructureState,
  field: ControllerStructureFieldId,
): StructureRadialFieldProfile | undefined {
  const definition = STRUCTURE_FIELD_DEFINITIONS[field];
  if (
    !structure.active ||
    structure.completedLevel === undefined ||
    structure.type !== definition.structureType
  ) {
    return undefined;
  }

  const owner = factionById(state, structure.ownerId);
  if (owner === undefined) {
    throw new Error(`structure ${structure.id} has unknown owner ${structure.ownerId}`);
  }
  const scope = {
    kind: "STRUCTURE",
    structure: structure.type,
  } as const;
  if (
    owner.rules.dynamicProviders.some(
      (provider) =>
        provider.axis === definition.axis &&
        ruleScopeMatches(provider.scope, scope) &&
        provider.dependency === "TERRITORIAL_CONTACT_COUNT",
    )
  ) {
    throw new Error(
      `${definition.axis} requires Territorial Contact state unavailable to controller field projection`,
    );
  }

  const factor = materializeCompiledScalarScaleFactor(
    owner.rules,
    RULE_AXIS_REGISTRY,
    definition.axis,
    scope,
    {
      ownedPersistentStructureCount: state.structures.filter(
        (candidate) => candidate.ownerId === owner.id,
      ).length,
      territorialContactCount: 0,
      peakTotalPopulation: owner.population.peakTotal,
    },
  );
  const baselineRadius = definition.baselineRadii[structure.completedLevel - 1];
  return definition.scaling === "AREA"
    ? structureRadialFieldFromAreaFactor(
        baselineRadius,
        factor.numerator,
        factor.denominator,
      )
    : structureRadialFieldFromRangeFactor(
        baselineRadius,
        factor.numerator,
        factor.denominator,
      );
}

function fieldSourceForStructure(
  state: MatchState,
  structure: PersistentStructureState,
  field: ControllerStructureFieldId,
): StructureFieldSource | undefined {
  const profile = effectiveStructureFieldProfile(state, structure, field);
  if (profile === undefined) return undefined;
  return Object.freeze({ centerCellId: structure.cellId, profile });
}

function fieldSourceContainsCell(
  state: MatchState,
  source: StructureFieldSource,
  cellId: CellId,
): boolean {
  const center = state.map.positionOf(source.centerCellId);
  const candidate = state.map.positionOf(cellId);
  return structureRadialFieldContainsCell(
    source.profile,
    center.x,
    center.y,
    candidate.x,
    candidate.y,
  );
}

function anyFieldSourceContainsCell(
  state: MatchState,
  sources: readonly StructureFieldSource[],
  cellId: CellId,
): boolean {
  return sources.some((source) => fieldSourceContainsCell(state, source, cellId));
}

function createStructureVisibilityContext(
  state: MatchState,
  requesterFactionId: string,
  references?: ControllerQueryReferenceSession,
): StructureVisibilityContext {
  const requester = factionById(state, requesterFactionId);
  if (requester === undefined) {
    throw new Error(`unknown controller faction: ${requesterFactionId}`);
  }

  const remoteObservationFields: StructureFieldSource[] = [];
  const enemyBlackoutFields: StructureFieldSource[] = [];
  for (const structure of state.structures) {
    if (structure.type !== "OBSERVATION_POST") continue;
    const source = fieldSourceForStructure(state, structure, "OBSERVATION");
    if (source === undefined) continue;
    const blackout = factionHasP49EnemyBlackout(state, structure.ownerId);
    if (structure.ownerId === requesterFactionId && !blackout) {
      remoteObservationFields.push(source);
      continue;
    }
    if (!blackout) continue;
    const owner = factionById(state, structure.ownerId);
    if (owner === undefined) continue;
    if (
      factionRelationBetween(factionIdentity(requester), factionIdentity(owner)) ===
      "ENEMY"
    ) {
      enemyBlackoutFields.push(source);
    }
  }

  return Object.freeze({
    requesterFactionId,
    remoteObservationFields: Object.freeze(remoteObservationFields),
    enemyBlackoutFields: Object.freeze(enemyBlackoutFields),
    ...(references === undefined
      ? {}
      : {
          resolveFactionRef: (ref: string) => references.resolveFaction(ref),
          resolveStructureRef: (ref: string) =>
            references.resolve(requesterFactionId, "STRUCTURE", ref),
        }),
  });
}

function p45ConcealsCellFromRequester(
  state: MatchState,
  context: StructureVisibilityContext,
  cellId: CellId,
): boolean {
  const holderId = state.ownership[cellId] ?? undefined;
  if (
    holderId === undefined ||
    holderId === context.requesterFactionId ||
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

function directRevealActive(
  state: MatchState,
  context: StructureVisibilityContext,
  sourceKind: "UNIT" | "STRUCTURE" | "OPERATION",
  sourceId: string,
): boolean {
  return state.directReveals.some(
    (record) =>
      record.viewerFactionId === context.requesterFactionId &&
      record.sourceKind === sourceKind &&
      record.sourceId === sourceId &&
      isDirectRevealActive(state.tick, record.expiryExclusiveTick),
  );
}

function structureIsLawfullyVisible(
  state: MatchState,
  context: StructureVisibilityContext,
  structure: PersistentStructureState,
): boolean {
  const explicitPublic =
    structure.type === "OBSERVATION_POST" &&
    factionHasP49EnemyBlackout(state, structure.ownerId);
  const concealed =
    p45ConcealsCellFromRequester(state, context, structure.cellId) ||
    anyFieldSourceContainsCell(
      state,
      context.enemyBlackoutFields,
      structure.cellId,
    );
  const remotelyObserved = anyFieldSourceContainsCell(
    state,
    context.remoteObservationFields,
    structure.cellId,
  );

  return resolveTacticalVisibility({
    selfOwned: structure.ownerId === context.requesterFactionId,
    explicitPublic,
    directRevealActive: directRevealActive(
      state,
      context,
      "STRUCTURE",
      structure.id,
    ),
    concealed,
    remotelyObserved,
  }).visible;
}

function unitIsLawfullyVisible(
  state: MatchState,
  context: StructureVisibilityContext,
  unit: ControllerQueryMobileUnitState,
): boolean {
  const concealed =
    p45ConcealsCellFromRequester(state, context, unit.cellId) ||
    anyFieldSourceContainsCell(state, context.enemyBlackoutFields, unit.cellId);
  const remotelyObserved = anyFieldSourceContainsCell(
    state,
    context.remoteObservationFields,
    unit.cellId,
  );
  return resolveTacticalVisibility({
    selfOwned: unit.ownerId === context.requesterFactionId,
    explicitPublic: false,
    directRevealActive: directRevealActive(state, context, "UNIT", unit.id),
    concealed,
    remotelyObserved,
  }).visible;
}

function materializeControllerStructureView(
  state: MatchState,
  structure: PersistentStructureState,
): ControllerStructureView {
  const construction =
    structure.construction === undefined
      ? undefined
      : Object.freeze({
          targetLevel: structure.construction.targetLevel,
          remainingTicks: structure.construction.remainingTicks,
        });
  const chargeState =
    structure.type === "MISSILE_SILO" && structure.chargeSlots !== undefined
      ? Object.freeze({
          ready: structure.chargeSlots.filter((slot) => slot.state === "READY").length,
          capacity: structure.chargeSlots.length,
          rechargeRemainingTicks: Object.freeze(
            structure.chargeSlots.flatMap((slot) =>
              slot.state === "RECHARGING"
                ? [slot.readyAtTick - state.tick]
                : [],
            ),
          ),
        })
      : undefined;
  return Object.freeze({
    ownerId: structure.ownerId,
    type: structure.type,
    cellId: structure.cellId,
    ...(structure.completedLevel === undefined
      ? {}
      : { completedLevel: structure.completedLevel }),
    active: structure.active,
    ...(construction === undefined ? {} : { construction }),
    ...(chargeState === undefined ? {} : { chargeState }),
  });
}

function materializeStructureView(
  state: MatchState,
  structure: PersistentStructureState,
  ref: StructureRef,
): StructureView {
  return Object.freeze({
    ref,
    ...materializeControllerStructureView(state, structure),
  });
}

function materializeUnitView(
  unit: ControllerQueryMobileUnitState,
  ref: UnitRef,
): UnitView {
  return Object.freeze({
    ref,
    ownerId: unit.ownerId,
    type: unit.type,
    cellId: unit.cellId,
    active: true,
    repositionable:
      unit.type === "TANK" ||
      unit.type === "HEAVY_ARTILLERY" ||
      unit.type === "WARSHIP",
    ...(unit.strategicDestinationCellId === undefined
      ? {}
      : { movementDestinationCellId: unit.strategicDestinationCellId }),
  });
}

function decisionFailure(
  code: DecisionFailure["code"],
  key?: string,
): DecisionFailure {
  return Object.freeze({
    code,
    ...(key === undefined ? {} : { key }),
  });
}

function structureVisibleToRequester(
  state: MatchState,
  requesterFactionId: string,
  structure: PersistentStructureState | undefined,
): boolean {
  return (
    structure !== undefined &&
    structureIsLawfullyVisible(
      state,
      createStructureVisibilityContext(state, requesterFactionId),
      structure,
    )
  );
}

export function mapControllerStructureBuildFailure(
  state: MatchState,
  requesterFactionId: string,
  cellId: CellId,
  code: StructurePurchaseFailureCode,
  key?: string,
): DecisionFailure {
  switch (code) {
    case "INSUFFICIENT_FFY":
    case "OWNERSHIP_CAP":
    case "CELL_NOT_OWNED":
    case "BUILD_NOT_PERMITTED":
    case "PLACEMENT_GEOMETRY_UNAVAILABLE":
      return decisionFailure(code, key);
    case "CELL_OCCUPIED": {
      const occupying = state.structures.find(
        (structure) => structure.cellId === cellId,
      );
      return decisionFailure(
        structureVisibleToRequester(state, requesterFactionId, occupying)
          ? "CELL_OCCUPIED"
          : "INVALID_TARGET",
        key,
      );
    }
    case "INVALID_REQUEST":
      return decisionFailure("INVALID_COMMAND", key);
    case "UNKNOWN_OWNER":
    case "STRUCTURE_ID_CONFLICT":
      throw new Error(`controller build invariant failed: ${code}`);
    case "UNKNOWN_STRUCTURE":
    case "NOT_OWNER":
    case "NOT_COMPLETED":
    case "CONSTRUCTION_IN_PROGRESS":
    case "MAX_LEVEL":
    case "UPGRADE_NOT_PERMITTED":
      throw new Error(`unexpected build transaction failure: ${code}`);
  }
}

export function mapControllerStructureUpgradeFailure(
  state: MatchState,
  requesterFactionId: string,
  structureId: string,
  code: StructurePurchaseFailureCode,
  key?: string,
): DecisionFailure {
  const structure = state.structures.find(
    (candidate) => candidate.id === structureId,
  );
  const visible = structureVisibleToRequester(
    state,
    requesterFactionId,
    structure,
  );
  switch (code) {
    case "INSUFFICIENT_FFY":
      return decisionFailure("INSUFFICIENT_FFY", key);
    case "INVALID_REQUEST":
      return decisionFailure("INVALID_COMMAND", key);
    case "UNKNOWN_STRUCTURE":
      return decisionFailure("INVALID_TARGET", key);
    case "NOT_OWNER":
    case "NOT_COMPLETED":
    case "CONSTRUCTION_IN_PROGRESS":
    case "MAX_LEVEL":
    case "UPGRADE_NOT_PERMITTED":
      return decisionFailure(visible ? code : "INVALID_TARGET", key);
    case "UNKNOWN_OWNER":
      throw new Error(`controller upgrade invariant failed: ${code}`);
    case "STRUCTURE_ID_CONFLICT":
    case "OWNERSHIP_CAP":
    case "CELL_NOT_OWNED":
    case "CELL_OCCUPIED":
    case "BUILD_NOT_PERMITTED":
    case "PLACEMENT_GEOMETRY_UNAVAILABLE":
      throw new Error(`unexpected upgrade transaction failure: ${code}`);
  }
}

function quoteStructureId(state: MatchState): string {
  let id = "controller:quote:structure";
  while (state.structures.some((structure) => structure.id === id)) id += ":";
  return id;
}

function quoteCost(
  ffyRequired: number,
  ffySpent: number,
): StructureBuildQuote["cost"] {
  return Object.freeze({
    ffyRequired,
    ffySpent,
    populationSpent: 0,
  });
}

function createConstructionMechanics(
  state: MatchState,
  requesterFactionId: string,
  visibility: StructureVisibilityContext,
): ControllerConstructionMechanics {
  const structureBuildQuote = (
    structureType: StructureType,
    cellId: CellId,
  ): StructureBuildQuote => {
    const targetLevel = structureBuildPurchaseTargetLevel(
      state,
      requesterFactionId,
      structureType,
    );
    const buildTicks = effectiveStructureConstructionTicks(
      state,
      requesterFactionId,
      structureType,
    );
    const result = tryPurchaseStructureBuild(state, {
      structureId: quoteStructureId(state),
      ownerId: requesterFactionId,
      type: structureType,
      cellId,
    });
    const preview =
      result.ok || result.failure.code === "INSUFFICIENT_FFY"
        ? structureBuildPurchaseFfyPreview(
            state,
            requesterFactionId,
            structureType,
          )
        : undefined;
    const failure = result.ok
      ? undefined
      : mapControllerStructureBuildFailure(
          state,
          requesterFactionId,
          cellId,
          result.failure.code,
        );
    return Object.freeze({
      legal: result.ok,
      ...(failure === undefined ? {} : { failureCode: failure.code }),
      cost: quoteCost(
        preview?.ffyRequired ?? 0,
        result.ok ? (preview?.ffySpent ?? 0) : 0,
      ),
      structure: structureType,
      cellId,
      resultingLevel: targetLevel,
      buildTicks,
    });
  };

  const unavailableUpgradeQuote = (cellId: CellId): StructureUpgradeQuote =>
    Object.freeze({
      legal: false,
      failureCode: "INVALID_TARGET" as const,
      cost: quoteCost(0, 0),
      cellId,
    });

  const structureUpgradeQuote = (cellId: CellId): StructureUpgradeQuote => {
    const structure = state.structures.find(
      (candidate) => candidate.cellId === cellId,
    );
    if (
      structure === undefined ||
      !structureIsLawfullyVisible(state, visibility, structure)
    ) {
      return unavailableUpgradeQuote(cellId);
    }

    const result = tryPurchaseStructureUpgrade(state, {
      structureId: structure.id,
      ownerId: requesterFactionId,
    });
    if (result.ok || result.failure.code === "INSUFFICIENT_FFY") {
      if (structure.completedLevel === undefined || structure.completedLevel >= 5) {
        throw new Error(
          "affordability-stage upgrade result requires a completed non-max structure",
        );
      }
      const targetLevel = (structure.completedLevel + 1) as StructureLevel;
      const buildTicks = effectiveStructureConstructionTicks(
        state,
        requesterFactionId,
        structure.type,
      );
      const preview = structureUpgradePurchaseFfyPreview(
        state,
        requesterFactionId,
        structure.type,
        targetLevel,
      );
      return Object.freeze({
        legal: result.ok,
        ...(result.ok ? {} : { failureCode: "INSUFFICIENT_FFY" as const }),
        cost: quoteCost(
          preview.ffyRequired,
          result.ok ? preview.ffySpent : 0,
        ),
        cellId,
        currentLevel: structure.completedLevel,
        resultingLevel: targetLevel,
        buildTicks,
      });
    }

    const failure = mapControllerStructureUpgradeFailure(
      state,
      requesterFactionId,
      structure.id,
      result.failure.code,
    );
    return Object.freeze({
      legal: false,
      failureCode: failure.code,
      cost: quoteCost(0, 0),
      cellId,
      ...(structure.completedLevel === undefined
        ? {}
        : { currentLevel: structure.completedLevel }),
    });
  };

  return Object.freeze({ structureBuildQuote, structureUpgradeQuote });
}

function ownerMatchesFieldAffiliation(
  state: MatchState,
  referenceFactionId: string,
  candidateOwnerId: string,
  affiliation: StructureFieldAffiliation,
): boolean {
  if (candidateOwnerId === referenceFactionId) return true;
  if (affiliation === "SELF") return false;
  const reference = factionById(state, referenceFactionId);
  const candidate = factionById(state, candidateOwnerId);
  if (reference === undefined || candidate === undefined) return false;
  return (
    factionRelationBetween(factionIdentity(reference), factionIdentity(candidate)) ===
    "ALLY"
  );
}

function visibleStructureFieldSources(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: Extract<CellSelector, { readonly kind: "STRUCTURE_FIELD" }>,
): readonly StructureFieldSource[] {
  const referenceFactionId = context.resolveFactionRef?.(
    selector.referenceFactionId,
  );
  if (referenceFactionId === undefined) return Object.freeze([]);
  const sources: StructureFieldSource[] = [];
  for (const structure of state.structures) {
    if (
      !ownerMatchesFieldAffiliation(
        state,
        referenceFactionId,
        structure.ownerId,
        selector.affiliation,
      ) ||
      !structureIsLawfullyVisible(state, context, structure)
    ) {
      continue;
    }
    const source = fieldSourceForStructure(state, structure, selector.field);
    if (source !== undefined) sources.push(source);
  }
  return Object.freeze(sources);
}

function visibleStructureFieldInstanceSource(
  state: MatchState,
  context: StructureVisibilityContext,
  structureRef: string,
  field: StructureFieldId,
): StructureFieldSource | undefined {
  const structureId = context.resolveStructureRef?.(structureRef);
  if (structureId === undefined) return undefined;
  const structure = state.structures.find((candidate) => candidate.id === structureId);
  if (
    structure === undefined ||
    !structureIsLawfullyVisible(state, context, structure)
  ) {
    return undefined;
  }
  return fieldSourceForStructure(state, structure, field);
}

type SelectorMatcher = (id: CellId) => boolean;

function compileSelectorMatcher(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
): SelectorMatcher {
  switch (selector.kind) {
    case "CELLS": {
      const ids = new Set(orderedExplicitCellIds(state, selector));
      return (id) => ids.has(id);
    }
    case "OWNER": {
      if (selector.factionId === undefined) {
        return (id) => (state.ownership[id] ?? null) === null;
      }
      const ownerId = context.resolveFactionRef?.(selector.factionId);
      if (ownerId === undefined) return () => false;
      return (id) => (state.ownership[id] ?? null) === ownerId;
    }
    case "SEGMENT": {
      const segments = state.map.segments;
      if (segments === undefined) return () => false;
      return (id) => state.map.segments?.segmentIdOf(id) === selector.segmentId;
    }
    case "TERRAIN":
      return (id) => state.map.terrainAt(id) === selector.terrain;
    case "FALLOUT":
      return (id) => (state.fallout[id] ?? false) === selector.value;
    case "POPULATION_BEARING":
      return (id) => {
        const terrain = state.map.terrainAt(id);
        return effectivePopulationBearing(state, id, terrain) === selector.value;
      };
    case "CONQUERABLE":
      return (id) =>
        landTerrainBaseSpec(state.map.terrainAt(id)).conquerable === selector.value;
    case "COAST":
      return (id) => isCoast(state, id) === selector.value;
    case "SHORELINE":
      return (id) => isShoreline(state, id) === selector.value;
    case "CIRCLE": {
      const center = state.map.positionOf(selector.center);
      const radiusSquared = selector.radius * selector.radius;
      return (id) => {
        const position = state.map.positionOf(id);
        const dx = position.x - center.x;
        const dy = position.y - center.y;
        return dx * dx + dy * dy <= radiusSquared;
      };
    }
    case "UNION": {
      const children = selector.selectors.map((child) =>
        compileSelectorMatcher(state, context, child),
      );
      return (id) => children.some((child) => child(id));
    }
    case "INTERSECTION": {
      const children = selector.selectors.map((child) =>
        compileSelectorMatcher(state, context, child),
      );
      return (id) => children.every((child) => child(id));
    }
    case "DIFFERENCE": {
      const left = compileSelectorMatcher(state, context, selector.left);
      const right = compileSelectorMatcher(state, context, selector.right);
      return (id) => left(id) && !right(id);
    }
    case "STRUCTURE_FIELD": {
      const sources = visibleStructureFieldSources(state, context, selector);
      return (id) => anyFieldSourceContainsCell(state, sources, id);
    }
    case "STRUCTURE_FIELD_INSTANCE": {
      const source = visibleStructureFieldInstanceSource(
        state,
        context,
        selector.structureId,
        selector.field,
      );
      return source === undefined
        ? () => false
        : (id) => fieldSourceContainsCell(state, source, id);
    }
  }
}

function orderedSelectorCellIds(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
): readonly CellId[] {
  if (selector.kind === "CELLS") return orderedExplicitCellIds(state, selector);
  const matches = compileSelectorMatcher(state, context, selector);
  const ids: CellId[] = [];
  for (let id = 0; id < state.map.cellCount; id += 1) {
    if (matches(id)) ids.push(id);
  }
  return Object.freeze(ids);
}

function boundedOrderedSelectorCellIds(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
  maxMatches: number,
): readonly CellId[] {
  if (selector.kind === "CELLS") {
    return Object.freeze(orderedExplicitCellIds(state, selector).slice(0, maxMatches));
  }
  const matches = compileSelectorMatcher(state, context, selector);
  const ids: CellId[] = [];
  for (let id = 0; id < state.map.cellCount && ids.length < maxMatches; id += 1) {
    if (matches(id)) ids.push(id);
  }
  return Object.freeze(ids);
}

function countSelectorCells(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
): number {
  if (selector.kind === "CELLS") return orderedExplicitCellIds(state, selector).length;
  const matches = compileSelectorMatcher(state, context, selector);
  let count = 0;
  for (let id = 0; id < state.map.cellCount; id += 1) {
    if (matches(id)) count += 1;
  }
  return count;
}

function boundedOrderedBoundaryIds(
  state: MatchState,
  context: StructureVisibilityContext,
  selector: CellSelector,
  maxMatches: number,
): readonly CellId[] {
  const matches = compileSelectorMatcher(state, context, selector);
  const candidates =
    selector.kind === "CELLS"
      ? orderedExplicitCellIds(state, selector)
      : undefined;
  const ids: CellId[] = [];
  const consider = (id: CellId): void => {
    if (
      matches(id) &&
      state.map.cardinalNeighbors(id).some((neighbor) => !matches(neighbor))
    ) {
      ids.push(id);
    }
  };

  if (candidates !== undefined) {
    for (const id of candidates) {
      if (ids.length >= maxMatches) break;
      consider(id);
    }
  } else {
    for (let id = 0; id < state.map.cellCount && ids.length < maxMatches; id += 1) {
      consider(id);
    }
  }
  return Object.freeze(ids);
}

function orderedComponents(
  state: MatchState,
  selected: readonly CellId[],
): readonly (readonly CellId[])[] {
  const unvisited = new Set(selected);
  const components: (readonly CellId[])[] = [];

  for (const start of selected) {
    if (!unvisited.delete(start)) continue;
    const queue: CellId[] = [start];
    const ids: CellId[] = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const id = queue[cursor]!;
      ids.push(id);
      for (const neighbor of state.map.cardinalNeighbors(id)) {
        if (unvisited.delete(neighbor)) queue.push(neighbor);
      }
    }
    ids.sort((left, right) => left - right);
    components.push(Object.freeze(ids));
  }

  return Object.freeze(components);
}

function entityFindLimit(limit: number | undefined): number {
  if (limit === undefined) return MAX_ENTITY_FIND_RESULTS;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ENTITY_FIND_RESULTS) {
    throw new Error("controller entity find limit must be a safe integer from 1 to 128");
  }
  return limit;
}

function matchesTypes<T extends string>(
  candidate: T,
  requested: T | readonly T[] | undefined,
): boolean {
  if (requested === undefined) return true;
  return Array.isArray(requested)
    ? (requested as readonly T[]).includes(candidate)
    : candidate === requested;
}

function matchesLocation(
  state: MatchState,
  cellId: CellId,
  location: Readonly<{ readonly cellId: CellId; readonly radius?: number }> | undefined,
): boolean {
  if (location === undefined) return true;
  if (!state.map.isValidCellId(location.cellId)) return false;
  if (location.radius === undefined) return cellId === location.cellId;
  const center = state.map.positionOf(location.cellId);
  const candidate = state.map.positionOf(cellId);
  return Math.hypot(candidate.x - center.x, candidate.y - center.y) <= location.radius;
}

function factionProximityById(
  state: MatchState,
  requesterFactionId: string,
  targetFactionId: string,
): number | undefined {
  const requesterCells: CellId[] = [];
  const targetCells: CellId[] = [];
  for (let cellId = 0; cellId < state.map.cellCount; cellId += 1) {
    const ownerId = state.ownership[cellId] ?? null;
    if (ownerId === requesterFactionId) requesterCells.push(cellId);
    if (ownerId === targetFactionId) targetCells.push(cellId);
  }
  if (requesterCells.length === 0 || targetCells.length === 0) return undefined;

  let minimum = Number.POSITIVE_INFINITY;
  for (const requesterCell of requesterCells) {
    const left = state.map.positionOf(requesterCell);
    for (const targetCell of targetCells) {
      const right = state.map.positionOf(targetCell);
      minimum = Math.min(minimum, Math.hypot(left.x - right.x, left.y - right.y));
    }
  }
  return minimum;
}

function incomingOperationTargetsRequester(
  state: MatchState,
  requesterFactionId: string,
  operation: LandOperationState,
): boolean {
  if (operation.ownerId === requesterFactionId) return false;
  if (operation.kind === "ATTACK") {
    return operation.targetFactionId === requesterFactionId;
  }
  if (operation.kind === "COUNTER_RESPONSE") {
    const incoming = state.operations.find(
      (candidate) => candidate.id === operation.incomingOperationId,
    );
    return incoming?.ownerId === requesterFactionId;
  }
  return false;
}

export function createControllerQuerySession(
  state: MatchState,
  requesterFactionId: string,
  limits: ControllerQueryBudgetLimits,
  references?: ControllerQueryReferenceSession,
): ControllerQuerySession {
  if (!state.factions.some((faction) => faction.id === requesterFactionId)) {
    throw new Error(`unknown controller faction: ${requesterFactionId}`);
  }
  const visibility = createStructureVisibilityContext(
    state,
    requesterFactionId,
    references,
  );
  const mechanics = createConstructionMechanics(
    state,
    requesterFactionId,
    visibility,
  );

  let queries = 0;
  let materializedCells = 0;
  let materializedEntityViews = 0;
  const entityViewLimit =
    limits.materializedEntityViewsPerDecision ??
    DEFAULT_MATERIALIZED_ENTITY_VIEWS_PER_DECISION;

  const beginQuery = (): void => {
    if (queries >= limits.queriesPerDecision) {
      throw new Error("controller query budget exhausted");
    }
    queries += 1;
  };

  const remainingMaterialization = (): number =>
    Math.max(0, limits.materializedCellsPerDecision - materializedCells);

  const requestedMaterialization = (limit?: number): number =>
    limit === undefined
      ? remainingMaterialization()
      : Math.min(limit, remainingMaterialization());

  const remainingEntityMaterialization = (): number =>
    Math.max(0, entityViewLimit - materializedEntityViews);

  const materializePage = (
    ids: readonly CellId[],
    limit?: number,
  ): QueryPage<CellView> => {
    const requested = requestedMaterialization(limit);
    const selected = ids.slice(0, requested);
    const items = Object.freeze(
      selected.map((id) => {
        const cell = materializeCellView(state, visibility, id);
        if (cell === undefined) throw new Error(`invalid materialized cell ${id}`);
        return cell;
      }),
    );
    materializedCells += items.length;
    return Object.freeze({
      items,
      truncated: ids.length > items.length,
    });
  };

  const relationMatches = (
    ownerId: string,
    requested: "ALLY" | "ENEMY" | undefined,
  ): boolean => {
    if (requested === undefined) return true;
    return factionRelation(state, requesterFactionId, ownerId) === requested;
  };

  const factionMatches = (
    ownerId: string,
    requestedRef: string | undefined,
  ): boolean => {
    if (requestedRef === undefined) return true;
    if (references === undefined) return false;
    return references.resolveFaction(requestedRef) === ownerId;
  };

  const unitMatchesFilter = (
    unit: ControllerQueryMobileUnitState,
    filter: UnitFindFilter | undefined,
  ): boolean =>
    factionMatches(unit.ownerId, filter?.faction) &&
    relationMatches(unit.ownerId, filter?.relation) &&
    matchesTypes<MobileUnitType>(unit.type, filter?.types) &&
    matchesLocation(state, unit.cellId, filter?.location);

  const structureMatchesFilter = (
    structure: PersistentStructureState,
    filter: StructureFindFilter | undefined,
  ): boolean =>
    factionMatches(structure.ownerId, filter?.faction) &&
    relationMatches(structure.ownerId, filter?.relation) &&
    matchesTypes<StructureType>(structure.type, filter?.types) &&
    matchesLocation(state, structure.cellId, filter?.location);

  const visibleUnits = (
    filter?: UnitFindFilter,
  ): readonly ControllerQueryMobileUnitState[] =>
    Object.freeze(
      state.mobileUnits
        .filter(
          (unit) =>
            unitIsLawfullyVisible(state, visibility, unit) &&
            unitMatchesFilter(unit, filter),
        )
        .sort((left, right) => left.cellId - right.cellId),
    );

  const visibleStructures = (
    filter?: StructureFindFilter,
  ): readonly PersistentStructureState[] =>
    Object.freeze(
      state.structures
        .filter(
          (structure) =>
            structureIsLawfullyVisible(state, visibility, structure) &&
            structureMatchesFilter(structure, filter),
        )
        .sort((left, right) => left.cellId - right.cellId),
    );

  const getUnit = async (locator: UnitLocator): Promise<UnitView | undefined> => {
    beginQuery();
    if (references === undefined || locator === null || typeof locator !== "object") {
      return undefined;
    }
    const authoritativeId =
      "ref" in locator
        ? references.resolve(requesterFactionId, "UNIT", locator.ref)
        : undefined;
    const unit =
      authoritativeId !== undefined
        ? state.mobileUnits.find((candidate) => candidate.id === authoritativeId)
        : "cellId" in locator && state.map.isValidCellId(locator.cellId)
          ? state.mobileUnits.find((candidate) => candidate.cellId === locator.cellId)
          : undefined;
    if (unit === undefined || !unitIsLawfullyVisible(state, visibility, unit)) {
      return undefined;
    }
    if (remainingEntityMaterialization() === 0) {
      throw new Error("controller entity materialization budget exhausted");
    }
    const ref = references.issue(requesterFactionId, "UNIT", unit.id) as
      | UnitRef
      | undefined;
    if (ref === undefined) return undefined;
    materializedEntityViews += 1;
    return materializeUnitView(unit, ref);
  };

  const findUnits = async (
    filter?: UnitFindFilter,
  ): Promise<QueryPage<UnitView>> => {
    beginQuery();
    const limit = entityFindLimit(filter?.limit);
    if (references === undefined) {
      return Object.freeze({ items: Object.freeze([]), truncated: false });
    }
    const candidates = visibleUnits(filter);
    const count = Math.min(limit, remainingEntityMaterialization());
    const selected = candidates.slice(0, count);
    const items = Object.freeze(
      selected.flatMap((unit) => {
        const ref = references.issue(requesterFactionId, "UNIT", unit.id) as
          | UnitRef
          | undefined;
        return ref === undefined ? [] : [materializeUnitView(unit, ref)];
      }),
    );
    materializedEntityViews += items.length;
    return Object.freeze({
      items,
      truncated: candidates.length > items.length,
    });
  };

  const countUnits = async (filter?: UnitFindFilter): Promise<number> => {
    beginQuery();
    entityFindLimit(filter?.limit);
    return visibleUnits(filter).length;
  };

  const getStructure = async (
    locator: StructureLocator,
  ): Promise<StructureView | undefined> => {
    beginQuery();
    if (references === undefined || locator === null || typeof locator !== "object") {
      return undefined;
    }
    const authoritativeId =
      "ref" in locator
        ? references.resolve(requesterFactionId, "STRUCTURE", locator.ref)
        : undefined;
    const structure =
      authoritativeId !== undefined
        ? state.structures.find((candidate) => candidate.id === authoritativeId)
        : "cellId" in locator && state.map.isValidCellId(locator.cellId)
          ? state.structures.find((candidate) => candidate.cellId === locator.cellId)
          : undefined;
    if (
      structure === undefined ||
      !structureIsLawfullyVisible(state, visibility, structure)
    ) {
      return undefined;
    }
    if (remainingEntityMaterialization() === 0) {
      throw new Error("controller entity materialization budget exhausted");
    }
    const ref = references.issue(
      requesterFactionId,
      "STRUCTURE",
      structure.id,
    ) as StructureRef | undefined;
    if (ref === undefined) return undefined;
    materializedEntityViews += 1;
    return materializeStructureView(state, structure, ref);
  };

  const findStructures = async (
    filter?: StructureFindFilter,
  ): Promise<QueryPage<StructureView>> => {
    beginQuery();
    const limit = entityFindLimit(filter?.limit);
    if (references === undefined) {
      return Object.freeze({ items: Object.freeze([]), truncated: false });
    }
    const candidates = visibleStructures(filter);
    const count = Math.min(limit, remainingEntityMaterialization());
    const selected = candidates.slice(0, count);
    const items = Object.freeze(
      selected.flatMap((structure) => {
        const ref = references.issue(
          requesterFactionId,
          "STRUCTURE",
          structure.id,
        ) as StructureRef | undefined;
        return ref === undefined
          ? []
          : [materializeStructureView(state, structure, ref)];
      }),
    );
    materializedEntityViews += items.length;
    return Object.freeze({
      items,
      truncated: candidates.length > items.length,
    });
  };

  const countStructures = async (
    filter?: StructureFindFilter,
  ): Promise<number> => {
    beginQuery();
    entityFindLimit(filter?.limit);
    return visibleStructures(filter).length;
  };

  let nextActionOrdinal = 1;
  const stagedCommands: ControllerCommand[] = [];
  const stageStructureBuild = (type: StructureType, cellId: CellId): ActionRef => {
    const ordinal = nextActionOrdinal;
    nextActionOrdinal += 1;
    stagedCommands.push(Object.freeze({
      kind: "BUILD_STRUCTURE" as const,
      key: `action:${requesterFactionId}:${ordinal}`,
      structure: type,
      cellId,
    }));
    return `action_${requesterFactionId}_${ordinal}` as ActionRef;
  };
  const checkStructureBuild = (type: StructureType, cellId: CellId): StructureBuildQuote => {
    beginQuery();
    return mechanics.structureBuildQuote(type, cellId);
  };
  const consumeStagedCommands = (): readonly ControllerCommand[] =>
    Object.freeze([...stagedCommands]);

  const publicFactionEntries = Object.freeze(
    state.factions.flatMap((faction) => {
      if (references === undefined) return [];
      const ref = references.issueFaction(faction.id);
      const relation = factionRelation(state, requesterFactionId, faction.id);
      if (ref === undefined || relation === undefined) return [];
      return [
        Object.freeze({
          authoritativeId: faction.id,
          ref,
          displayName: faction.displayName,
          status: faction.status,
          relation,
          isMinorFaction: faction.isMinorFaction,
          ...(faction.origin === undefined ? {} : { origin: faction.origin }),
          ...(faction.isMinorFaction
            ? {}
            : { score: calculateFactionScore(state, faction.id) }),
          ...(faction.fixedTeamId === undefined
            ? {}
            : { teamId: faction.fixedTeamId }),
        }),
      ];
    }),
  );
  const publicFactions: ControllerPublicFactionSource = Object.freeze({
    requesterFactionId,
    entries: publicFactionEntries,
  });

  const materializeFaction = (
    faction: MatchFactionState,
  ): FactionReadView | undefined => {
    const source = publicFactionEntries.find(
      (entry) => entry.authoritativeId === faction.id,
    );
    if (source === undefined) return undefined;
    return Object.freeze({
      ref: source.ref,
      displayName: source.displayName,
      status: source.status,
      relation: source.relation,
      territoryCells: state.ownership.filter((ownerId) => ownerId === faction.id).length,
      isMinorFaction: source.isMinorFaction,
      ...(source.origin === undefined ? {} : { origin: source.origin }),
      ...(source.score === undefined ? {} : { score: source.score }),
      ...(source.teamId === undefined ? {} : { teamId: source.teamId }),
    });
  };

  const findFactions = (filter?: FactionFindFilter): readonly FactionReadView[] => {
    beginQuery();
    const views = state.factions.flatMap((faction) => {
      const view = materializeFaction(faction);
      if (view === undefined) return [];
      if (filter?.relation !== undefined && view.relation !== filter.relation) return [];
      if (filter?.status !== undefined && view.status !== filter.status) return [];
      return [view];
    });
    views.sort((left, right) => {
      if (filter?.orderBy === "PROXIMITY" && references !== undefined) {
        const leftId = references.resolveFaction(left.ref);
        const rightId = references.resolveFaction(right.ref);
        const leftDistance =
          leftId === undefined
            ? Number.POSITIVE_INFINITY
            : (factionProximityById(state, requesterFactionId, leftId) ??
              Number.POSITIVE_INFINITY);
        const rightDistance =
          rightId === undefined
            ? Number.POSITIVE_INFINITY
            : (factionProximityById(state, requesterFactionId, rightId) ??
              Number.POSITIVE_INFINITY);
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      }
      return left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0;
    });
    return Object.freeze(views);
  };

  const getFaction = (ref: string): FactionReadView | undefined => {
    beginQuery();
    if (references === undefined) return undefined;
    const id = references.resolveFaction(ref);
    if (id === undefined) return undefined;
    const faction = factionById(state, id);
    return faction === undefined ? undefined : materializeFaction(faction);
  };

  const factionProximity = (ref: string): number | undefined => {
    beginQuery();
    if (references === undefined) return undefined;
    const targetFactionId = references.resolveFaction(ref);
    if (targetFactionId === undefined) return undefined;
    return factionProximityById(state, requesterFactionId, targetFactionId);
  };

  const materializeOperation = (
    operation: LandOperationState,
  ): ControllerOperationReadView | undefined => {
    if (references === undefined) return undefined;
    const ref = references.issue(requesterFactionId, "OPERATION", operation.id);
    const ownerRef = references.issueFaction(operation.ownerId);
    if (ref === undefined || ownerRef === undefined) return undefined;
    const targetFactionId =
      operation.kind === "ATTACK"
        ? references.issueFaction(operation.targetFactionId)
        : undefined;
    if (operation.kind === "ATTACK" && targetFactionId === undefined) {
      return undefined;
    }
    const selfOwned = operation.ownerId === requesterFactionId;
    return Object.freeze({
      ref,
      ...(selfOwned ? { directiveKey: operation.controllerKey } : {}),
      kind: operation.kind,
      ownerId: ownerRef,
      ...(targetFactionId === undefined ? {} : { targetFactionId }),
      committedPopulation: operation.committedPopulation,
      status: "ACTIVE" as const,
      ...(operation.kind === "COUNTER_RESPONSE"
        ? {}
        : { source: operation.source, target: operation.target }),
    });
  };

  const publicOperationEntries = Object.freeze(
    [...state.operations]
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .flatMap((operation) => {
        const selfOwned = operation.ownerId === requesterFactionId;
        const incoming =
          !selfOwned &&
          incomingOperationTargetsRequester(state, requesterFactionId, operation) &&
          directRevealActive(state, visibility, "OPERATION", operation.id);
        if (!selfOwned && !incoming) return [];
        const view = materializeOperation(operation);
        return view === undefined
          ? []
          : [Object.freeze({ direction: selfOwned ? "OWN" as const : "INCOMING" as const, view })];
      }),
  );
  const publicOperations: ControllerPublicOperationSource = Object.freeze({
    entries: publicOperationEntries,
  });

  const getOperation = (ref: string): ControllerOperationReadView | undefined => {
    beginQuery();
    if (references === undefined) return undefined;
    const authoritativeId = references.resolve(requesterFactionId, "OPERATION", ref);
    if (authoritativeId === undefined) return undefined;
    return publicOperationEntries.find(
      (entry) => entry.view.ref === ref,
    )?.view;
  };

  const ownOperations = (): readonly ControllerOperationReadView[] => {
    beginQuery();
    return Object.freeze(
      publicOperationEntries
        .filter((entry) => entry.direction === "OWN")
        .map((entry) => entry.view),
    );
  };

  const incomingOperations = (): readonly ControllerOperationReadView[] => {
    beginQuery();
    return Object.freeze(
      publicOperationEntries
        .filter((entry) => entry.direction === "INCOMING")
        .map((entry) => entry.view),
    );
  };

  const get = async (id: CellId): Promise<CellView | undefined> => {
    beginQuery();
    if (!state.map.isValidCellId(id)) return undefined;
    if (remainingMaterialization() === 0) {
      throw new Error("controller materialization budget exhausted");
    }
    const cell = materializeCellView(state, visibility, id);
    if (cell === undefined) throw new Error(`invalid materialized cell ${id}`);
    materializedCells += 1;
    return cell;
  };

  const query = async (
    selector: CellSelector,
    limit?: number,
  ): Promise<QueryPage<CellView>> => {
    beginQuery();
    const requested = requestedMaterialization(limit);
    return materializePage(
      boundedOrderedSelectorCellIds(
        state,
        visibility,
        selector,
        requested + 1,
      ),
      requested,
    );
  };

  const count = async (selector: CellSelector): Promise<number> => {
    beginQuery();
    return countSelectorCells(state, visibility, selector);
  };

  const neighbors = async (id: CellId): Promise<readonly CellId[]> => {
    beginQuery();
    return state.map.cardinalNeighbors(id);
  };

  const boundary = async (
    selector: CellSelector,
    limit?: number,
  ): Promise<QueryPage<CellView>> => {
    beginQuery();
    const requested = requestedMaterialization(limit);
    return materializePage(
      boundedOrderedBoundaryIds(
        state,
        visibility,
        selector,
        requested + 1,
      ),
      requested,
    );
  };

  const connectedComponents = async (
    selector: CellSelector,
  ): Promise<QueryPage<CellSelector>> => {
    beginQuery();
    const components = orderedComponents(
      state,
      orderedSelectorCellIds(state, visibility, selector),
    );
    const items: CellSelector[] = [];
    let truncated = false;
    for (const ids of components) {
      if (ids.length > remainingMaterialization()) {
        truncated = true;
        break;
      }
      items.push(Object.freeze({ kind: "CELLS" as const, ids }));
      materializedCells += ids.length;
    }
    return Object.freeze({ items: Object.freeze(items), truncated });
  };

  const distance = async (a: CellId, b: CellId): Promise<number> => {
    beginQuery();
    const left = state.map.positionOf(a);
    const right = state.map.positionOf(b);
    return Math.hypot(left.x - right.x, left.y - right.y);
  };

  const getSegment = async (
    id: SegmentId,
  ): Promise<SegmentView | undefined> => {
    beginQuery();
    return materializeSegmentView(state, id);
  };

  const listSegments = async (): Promise<readonly SegmentView[]> => {
    beginQuery();
    const segments = state.map.segments;
    if (segments === undefined) return Object.freeze([]);
    return Object.freeze(
      Array.from({ length: segments.segmentCount }, (_, id) => {
        const view = materializeSegmentView(state, id);
        if (view === undefined) throw new Error(`invalid SegmentId ${id}`);
        return view;
      }),
    );
  };

  const segmentCells = (id: SegmentId): CellSelector =>
    Object.freeze({ kind: "SEGMENT" as const, segmentId: id });

  const usage = (): ControllerQueryUsage => {
    const value = { queries, materializedCells };
    Object.defineProperty(value, "materializedEntityViews", {
      value: materializedEntityViews,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return Object.freeze(value) as ControllerQueryUsage;
  };

  const session = {
    publicSpatial: Object.freeze({
      map: state.map,
      ownership: state.ownership,
    }),
    mechanics,
    factions: Object.freeze({
      get: getFaction,
      find: findFactions,
      proximity: factionProximity,
    }),
    operations: Object.freeze({
      get: getOperation,
      own: ownOperations,
      incoming: incomingOperations,
    }),
    units: Object.freeze({
      get: getUnit,
      find: findUnits,
      count: countUnits,
    }),
    structures: Object.freeze({
      get: getStructure,
      find: findStructures,
      count: countStructures,
      build: stageStructureBuild,
      checkBuild: checkStructureBuild,
    }),
    consumeStagedCommands,
    cells: Object.freeze({
      get,
      query,
      count,
      neighbors,
      boundary,
      connectedComponents,
      distance,
    }),
    segments: Object.freeze({
      get: getSegment,
      list: listSegments,
      cells: segmentCells,
    }),
    usage,
  } as ControllerQuerySession;
  Object.defineProperty(session, "publicFactions", {
    value: publicFactions,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(session, "publicOperations", {
    value: publicOperations,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(session);
}
