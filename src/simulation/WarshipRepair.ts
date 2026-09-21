import { RULE_AXIS_REGISTRY } from "../core/rules/RuleAxisRegistry";
import {
  type RuleCondition,
  type RuleScope,
} from "../core/rules/RuleComposition";
import {
  conditionEligibleRuleTerms,
  materializeScalarScaleFactorTerms,
  resolvedRuleTermsForScope,
  type RuleDynamicState,
} from "../core/rules/RuleMaterialization";
import type { StructureRadialFieldProfile } from "../core/rules/StructureFieldGeometry";
import {
  createProspectiveMatchState,
  type MatchState,
} from "./MatchState";
import {
  advanceMobileUnit,
  assignMobileUnitRoute,
  type MobileUnitState,
} from "./MobileUnits";
import {
  advanceVehicleRepairIntentPhase,
  advanceVehicleRepairServicePhase,
  fixedRepairField,
  repairFieldContainsCell,
  repairPerTick,
  repairServiceProfileForLevel,
  scaledRepairField,
  vehicleFastServiceQueueEntries,
  vehicleFastServiceUnitIds,
  type ExactRepairAmount,
  type RepairServiceProfile,
  type VehicleRepairDomain,
  type VehicleRepairPhaseResult,
  type VehicleFastServiceQueueEntry,
  type VehicleRepairProviderState,
  type VehicleRepairRoute,
} from "./RepairService";
import {
  warshipEffectiveMaxHealth,
  warshipStrategicNavigationRoute,
  warshipTerrainMovementTiming,
  type WarshipOperationalState,
} from "./Warships";

const TICKS_PER_SECOND = 10n;
const P31_OPERATIONAL_REPAIR_DOMAIN =
  "WARSHIP_OPERATIONAL_DURING_PORT_REPAIR";

interface WarshipRepairProvider extends VehicleRepairProviderState {
  readonly structure: MatchState["structures"][number];
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

function portRepairCondition(
  condition: RuleCondition,
  port: MatchState["structures"][number],
): boolean {
  switch (condition.kind) {
    case "STRUCTURE_ACQUISITION_PATH_IS":
      return condition.path === port.acquisitionPath;
    case "TARGET_UNIT_IS":
      return condition.unit === "WARSHIP";
    default:
      throw new Error(
        `Unsupported Warship/Port repair rule condition ${condition.kind}`,
      );
  }
}

function repairTerms(
  state: MatchState,
  port: MatchState["structures"][number],
  axis:
    | "STRUCTURE_REPAIR_RADIUS"
    | "STRUCTURE_FAST_REPAIR_RADIUS"
    | "STRUCTURE_REPAIR_RATE",
) {
  const owner = state.factions.find((faction) => faction.id === port.ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${port.ownerId}`);
  const scope = {
    kind: "STRUCTURE",
    structure: "PORT",
  } as const satisfies RuleScope;
  return conditionEligibleRuleTerms(
    resolvedRuleTermsForScope(
      owner.rules,
      RULE_AXIS_REGISTRY,
      axis,
      scope,
      ruleDynamicState(state, port.ownerId),
    ),
    (conditions) =>
      conditions.every((condition) => portRepairCondition(condition, port)),
  );
}

function integralScaledRadius(
  baseRadiusCells: number,
  scaleNumerator: bigint,
  scaleDenominator: bigint,
  label: string,
): number {
  if (scaleNumerator < 0n || scaleDenominator <= 0n) {
    throw new Error(`${label} must resolve to a non-negative scale`);
  }
  const numerator = BigInt(baseRadiusCells) * scaleNumerator;
  if (numerator % scaleDenominator !== 0n) {
    throw new Error(`${label} must resolve to an integral cell radius`);
  }
  const radius = numerator / scaleDenominator;
  if (radius > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the safe-integer cell range`);
  }
  return Number(radius);
}

function serviceProfile(
  state: MatchState,
  port: MatchState["structures"][number],
): RepairServiceProfile {
  const level = port.completedLevel;
  if (level === undefined) {
    throw new Error(`Port ${port.id} has no completed repair-service level`);
  }
  const base = repairServiceProfileForLevel(level);
  const terms = repairTerms(
    state,
    port,
    "STRUCTURE_FAST_REPAIR_RADIUS",
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_FAST_REPAIR_RADIUS,
    terms,
  );
  return Object.freeze({
    ...base,
    fastRadiusCells: integralScaledRadius(
      base.fastRadiusCells,
      scale.numerator,
      scale.denominator,
      "Port fast repair radius",
    ),
  });
}

function effectiveBroadRepairField(
  state: MatchState,
  port: MatchState["structures"][number],
  profile: RepairServiceProfile,
): StructureRadialFieldProfile {
  const terms = repairTerms(
    state,
    port,
    "STRUCTURE_REPAIR_RADIUS",
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RADIUS,
    terms,
  );
  return scaledRepairField(
    profile.broadRadiusCells,
    scale.numerator,
    scale.denominator,
  );
}

function effectiveRepairPerTick(
  state: MatchState,
  port: MatchState["structures"][number],
  baseHealthPerSecond: ExactRepairAmount,
): ExactRepairAmount {
  const terms = repairTerms(
    state,
    port,
    "STRUCTURE_REPAIR_RATE",
  );
  const scale = materializeScalarScaleFactorTerms(
    RULE_AXIS_REGISTRY.STRUCTURE_REPAIR_RATE,
    terms,
  );
  return repairPerTick(
    baseHealthPerSecond,
    scale.numerator,
    scale.denominator,
    TICKS_PER_SECOND,
  );
}

function clearUnitRoute(
  state: MatchState,
  unit: MobileUnitState,
): MobileUnitState {
  if (unit.route === undefined) return unit;
  return assignMobileUnitRoute(state.map, unit, {
    cells: [unit.cellId],
    edgeWeights: [],
  });
}

function withRepairAssignment(
  operational: WarshipOperationalState,
  portId: string,
  arrivalTick: number | undefined,
): WarshipOperationalState {
  if (arrivalTick === undefined) {
    const {
      repairArrivalTick: _arrivalTick,
      ...withoutArrival
    } = operational;
    return Object.freeze({
      ...withoutArrival,
      repairPortId: portId,
    });
  }
  return Object.freeze({
    ...operational,
    repairPortId: portId,
    repairArrivalTick: arrivalTick,
  });
}

function clearRepairAssignment(
  operational: WarshipOperationalState,
  health: ExactRepairAmount,
): WarshipOperationalState {
  const {
    repairPortId: _repairPortId,
    repairArrivalTick: _repairArrivalTick,
    ...withoutRepair
  } = operational;
  return Object.freeze({
    ...withoutRepair,
    health: Object.freeze({
      numerator: health.numerator,
      denominator: health.denominator,
    }),
  });
}

function warshipRepairProviders(
  state: MatchState,
): readonly WarshipRepairProvider[] {
  return Object.freeze(
    state.structures.flatMap((structure) => {
      if (
        structure.type !== "PORT" ||
        !structure.active ||
        structure.completedLevel === undefined
      ) {
        return [];
      }
      return [
        Object.freeze({
          id: structure.id,
          cellId: structure.cellId,
          profile: serviceProfile(state, structure),
          structure,
        }),
      ];
    }),
  );
}

function warshipRepairDomain(
  state: MatchState,
): VehicleRepairDomain<
  MobileUnitState,
  WarshipOperationalState,
  WarshipRepairProvider
> {
  return Object.freeze({
    map: state.map,
    tick: state.tick,
    units: state.mobileUnits,
    operationalStates: state.warshipOperationalStates,
    providers: warshipRepairProviders(state),
    isRepairableUnit: (unit) => unit.type === "WARSHIP",
    isEligibleProvider: (provider, unit) =>
      provider.structure.ownerId === unit.ownerId,
    repairProviderId: (operational) => operational.repairPortId,
    repairArrivalTick: (operational) => operational.repairArrivalTick,
    withRepairAssignment,
    clearRepairAssignment,
    withHealth: (operational, health) =>
      Object.freeze({
        ...operational,
        health: Object.freeze({
          numerator: health.numerator,
          denominator: health.denominator,
        }),
      }),
    maximumHealth: (unit) => {
      const operational = state.warshipOperationalStates.find(
        (entry) => entry.unitId === unit.id,
      );
      if (operational === undefined) {
        throw new Error(
          `Warship repair target is missing operational state: ${unit.id}`,
        );
      }
      return warshipEffectiveMaxHealth(
        state,
        unit.ownerId,
        operational.rank,
      );
    },
    routeTo: (unit, destinationCellId): VehicleRepairRoute | undefined => {
      if (unit.type !== "WARSHIP") return undefined;
      const route = warshipStrategicNavigationRoute(
        state,
        unit.ownerId,
        unit.cellId,
        destinationCellId,
      );
      return route.status === "FOUND" ? route.route : undefined;
    },
    isTraversableCell: (unit, cellId) =>
      unit.type === "WARSHIP" &&
      state.map.terrainAt(cellId) === "DEEP_WATER" &&
      warshipTerrainMovementTiming(
        state,
        unit.ownerId,
        "DEEP_WATER",
      ) !== undefined,
    movementWorkPerTick: (unit) => {
      if (unit.type !== "WARSHIP") return undefined;
      return warshipTerrainMovementTiming(
        state,
        unit.ownerId,
        "DEEP_WATER",
      )?.movementWorkPerTick;
    },
    assignRoute: (unit, route) =>
      assignMobileUnitRoute(state.map, unit, {
        cells: route.cells,
        edgeWeights: route.edgeWeights,
      }),
    clearRoute: (unit) => clearUnitRoute(state, unit),
    advanceUnit: (unit, movementWorkPerTick) =>
      advanceMobileUnit(unit, movementWorkPerTick).unit,
    broadRepairField: (provider) =>
      effectiveBroadRepairField(
        state,
        provider.structure,
        provider.profile,
      ),
    repairPerTick: (provider, _unit, fastService) =>
      effectiveRepairPerTick(
        state,
        provider.structure,
        fastService
          ? provider.profile.fastHealthPerSecond
          : provider.profile.broadHealthPerSecond,
      ),
  });
}

function applyRepairPhase(
  state: MatchState,
  result: VehicleRepairPhaseResult<
    MobileUnitState,
    WarshipOperationalState
  >,
): MatchState {
  if (!result.changed) return state;
  return createProspectiveMatchState(state, {
    mobileUnits: result.units,
    warshipOperationalStates: result.operationalStates,
  });
}

export function advanceWarshipRepairIntentPhase(
  state: MatchState,
): MatchState {
  return applyRepairPhase(
    state,
    advanceVehicleRepairIntentPhase(warshipRepairDomain(state)),
  );
}

export function settleWarshipRepairMovementPhase(
  stateBeforeMovement: MatchState,
  stateAfterMovement: MatchState,
): MatchState {
  const beforeUnitsById = new Map(
    stateBeforeMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const afterUnitsById = new Map(
    stateAfterMovement.mobileUnits.map((unit) => [unit.id, unit]),
  );
  const providersById = new Map(
    warshipRepairProviders(stateBeforeMovement).map((provider) => [
      provider.id,
      provider,
    ]),
  );
  const operationalUpdates = new Map<string, WarshipOperationalState>();

  for (const operational of stateBeforeMovement.warshipOperationalStates) {
    const providerId = operational.repairPortId;
    if (
      providerId === undefined ||
      operational.repairArrivalTick !== undefined
    ) {
      continue;
    }
    const beforeUnit = beforeUnitsById.get(operational.unitId);
    const afterUnit = afterUnitsById.get(operational.unitId);
    if (
      beforeUnit === undefined ||
      afterUnit === undefined ||
      beforeUnit.type !== "WARSHIP" ||
      beforeUnit.route === undefined ||
      afterUnit.route !== undefined
    ) {
      continue;
    }
    const provider = providersById.get(providerId);
    if (
      provider === undefined ||
      provider.structure.ownerId !== afterUnit.ownerId
    ) {
      continue;
    }
    const field = fixedRepairField(provider.profile.fastRadiusCells);
    const center = stateBeforeMovement.map.positionOf(provider.cellId);
    const candidate = stateBeforeMovement.map.positionOf(afterUnit.cellId);
    if (
      !repairFieldContainsCell(
        field,
        center.x,
        center.y,
        candidate.x,
        candidate.y,
      )
    ) {
      continue;
    }
    operationalUpdates.set(
      operational.unitId,
      withRepairAssignment(
        operational,
        providerId,
        stateBeforeMovement.tick,
      ),
    );
  }

  if (operationalUpdates.size === 0) return stateAfterMovement;
  return createProspectiveMatchState(stateAfterMovement, {
    warshipOperationalStates:
      stateAfterMovement.warshipOperationalStates.map(
        (operational) =>
          operationalUpdates.get(operational.unitId) ?? operational,
      ),
  });
}

export function warshipFastServiceQueueEntries(
  state: MatchState,
): readonly VehicleFastServiceQueueEntry[] {
  return vehicleFastServiceQueueEntries(warshipRepairDomain(state));
}

export function warshipFastServiceUnitIds(
  state: MatchState,
): ReadonlySet<string> {
  return vehicleFastServiceUnitIds(warshipRepairDomain(state));
}

export function warshipOperationalDuringPortRepair(
  state: MatchState,
  ownerId: string,
): boolean {
  const owner = state.factions.find((faction) => faction.id === ownerId);
  if (owner === undefined) throw new Error(`unknown faction: ${ownerId}`);
  return owner.rules.customDomains.some(
    (entry) =>
      entry.sourceId === "P31" &&
      entry.domain === P31_OPERATIONAL_REPAIR_DOMAIN,
  );
}

export function advanceWarshipRepairPhase(
  state: MatchState,
  selectedFastServiceUnitIds?: ReadonlySet<string>,
): MatchState {
  return applyRepairPhase(
    state,
    advanceVehicleRepairServicePhase(
      warshipRepairDomain(state),
      selectedFastServiceUnitIds,
    ),
  );
}
