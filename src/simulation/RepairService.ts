import { reducedRational } from "../core/rules/RuleComposition";
import {
  structureRadialFieldContainsCell,
  structureRadialFieldFromRangeFactor,
  type StructureRadialFieldProfile,
} from "../core/rules/StructureFieldGeometry";

export type RepairServiceLevel = 1 | 2 | 3 | 4 | 5;

export interface ExactRepairAmount {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface RepairServiceProfile {
  readonly broadRadiusCells: number;
  readonly broadHealthPerSecond: ExactRepairAmount;
  readonly fastRadiusCells: number;
  readonly fastHealthPerSecond: ExactRepairAmount;
  readonly fastCapacity: number;
}

export interface FastServiceQueueEntry {
  readonly unitId: string;
  readonly repairArrivalTick: number;
}

export interface VehicleFastServiceQueueEntry extends FastServiceQueueEntry {
  readonly providerId: string;
  readonly fastCapacity: number;
}

export interface VehicleRepairMap {
  readonly width: number;
  readonly height: number;
  positionOf(cellId: number): Readonly<{ x: number; y: number }>;
  cellIdAt(x: number, y: number): number | undefined;
}

export interface VehicleRepairRouteState {
  readonly destinationCellId: number;
  readonly cells: readonly number[];
  readonly nextCellIndex: number;
}

export interface VehicleRepairUnitState {
  readonly id: string;
  readonly cellId: number;
  readonly route?: VehicleRepairRouteState;
}

export interface VehicleRepairOperationalState {
  readonly unitId: string;
  readonly health: ExactRepairAmount;
}

export interface VehicleRepairProviderState {
  readonly id: string;
  readonly cellId: number;
  readonly profile: RepairServiceProfile;
}

export interface VehicleRepairRoute {
  readonly cells: readonly number[];
  readonly edgeWeights: readonly number[];
  readonly totalWeight: number;
  readonly movementWorkPerTick: number;
}

export interface VehicleRepairDomain<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
> {
  readonly map: VehicleRepairMap;
  readonly tick: number;
  readonly units: readonly Unit[];
  readonly operationalStates: readonly Operational[];
  readonly providers: readonly Provider[];
  isRepairableUnit(unit: Unit): boolean;
  isEligibleProvider(provider: Provider, unit: Unit): boolean;
  repairProviderId(operational: Operational): string | undefined;
  repairArrivalTick(operational: Operational): number | undefined;
  withRepairAssignment(
    operational: Operational,
    providerId: string,
    arrivalTick: number | undefined,
  ): Operational;
  clearRepairAssignment(
    operational: Operational,
    health: ExactRepairAmount,
  ): Operational;
  withHealth(operational: Operational, health: ExactRepairAmount): Operational;
  maximumHealth(unit: Unit): ExactRepairAmount;
  routeTo(unit: Unit, destinationCellId: number): VehicleRepairRoute | undefined;
  isTraversableCell(unit: Unit, cellId: number): boolean;
  movementWorkPerTick(unit: Unit): number | undefined;
  assignRoute(unit: Unit, route: VehicleRepairRoute): Unit;
  clearRoute(unit: Unit): Unit;
  advanceUnit(unit: Unit, movementWorkPerTick: number): Unit;
  broadRepairField(
    provider: Provider,
    unit: Unit,
  ): StructureRadialFieldProfile;
  repairPerTick(
    provider: Provider,
    unit: Unit,
    fastService: boolean,
  ): ExactRepairAmount;
}

export interface VehicleRepairPhaseResult<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
> {
  readonly changed: boolean;
  readonly units: readonly Unit[];
  readonly operationalStates: readonly Operational[];
}

interface VehicleRepairDestination<
  Provider extends VehicleRepairProviderState,
> {
  readonly provider: Provider;
  readonly destinationCellId: number;
  readonly route: VehicleRepairRoute;
}

const BROAD_RADIUS_BY_LEVEL = Object.freeze([20, 40, 60, 80, 100] as const);
const BROAD_RATE_BY_LEVEL = Object.freeze([10n, 20n, 30n, 40n, 50n] as const);
const FAST_RATE_BY_LEVEL = Object.freeze([
  Object.freeze({ numerator: 100n, denominator: 1n }),
  Object.freeze({ numerator: 275n, denominator: 2n }),
  Object.freeze({ numerator: 175n, denominator: 1n }),
  Object.freeze({ numerator: 425n, denominator: 2n }),
  Object.freeze({ numerator: 250n, denominator: 1n }),
] as const);
const FAST_RADIUS_CELLS = 10;
const FAST_CAPACITY = 1;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactAmount(numerator: bigint, denominator: bigint): ExactRepairAmount {
  const reduced = reducedRational(numerator, denominator);
  return Object.freeze({
    numerator: reduced.numerator,
    denominator: reduced.denominator,
  });
}

export function repairServiceProfileForLevel(
  level: RepairServiceLevel,
): RepairServiceProfile {
  const index = level - 1;
  return Object.freeze({
    broadRadiusCells: BROAD_RADIUS_BY_LEVEL[index],
    broadHealthPerSecond: exactAmount(BROAD_RATE_BY_LEVEL[index], 1n),
    fastRadiusCells: FAST_RADIUS_CELLS,
    fastHealthPerSecond: FAST_RATE_BY_LEVEL[index],
    fastCapacity: FAST_CAPACITY,
  });
}

export function scaledRepairField(
  baseRadiusCells: number,
  scaleNumerator: bigint,
  scaleDenominator: bigint,
): StructureRadialFieldProfile {
  if (scaleNumerator < 0n || scaleDenominator <= 0n) {
    throw new Error("repair-field scale must be non-negative with positive denominator");
  }
  return structureRadialFieldFromRangeFactor(
    baseRadiusCells,
    scaleNumerator,
    scaleDenominator,
  );
}

export function fixedRepairField(radiusCells: number): StructureRadialFieldProfile {
  if (!Number.isSafeInteger(radiusCells) || radiusCells < 0) {
    throw new Error("repair-field radius must be a non-negative safe integer");
  }
  return structureRadialFieldFromRangeFactor(radiusCells, 1n, 1n);
}

export function repairFieldContainsCell(
  field: StructureRadialFieldProfile,
  centerX: number,
  centerY: number,
  candidateX: number,
  candidateY: number,
): boolean {
  return structureRadialFieldContainsCell(
    field,
    centerX,
    centerY,
    candidateX,
    candidateY,
  );
}

export function repairPerTick(
  baseHealthPerSecond: ExactRepairAmount,
  scaleNumerator: bigint,
  scaleDenominator: bigint,
  ticksPerSecond: bigint,
): ExactRepairAmount {
  if (scaleNumerator < 0n || scaleDenominator <= 0n) {
    throw new Error("repair-rate scale must be non-negative with positive denominator");
  }
  if (ticksPerSecond <= 0n) {
    throw new Error("ticksPerSecond must be positive");
  }
  return exactAmount(
    baseHealthPerSecond.numerator * scaleNumerator,
    baseHealthPerSecond.denominator * scaleDenominator * ticksPerSecond,
  );
}

function amountAtLeast(left: ExactRepairAmount, right: ExactRepairAmount): boolean {
  return left.numerator * right.denominator >= right.numerator * left.denominator;
}

export function addRepairClamped(
  current: ExactRepairAmount,
  repair: ExactRepairAmount,
  maximum: ExactRepairAmount,
): Readonly<{ amount: ExactRepairAmount; full: boolean }> {
  if (amountAtLeast(current, maximum)) {
    return Object.freeze({ amount: current, full: true });
  }
  const sum = exactAmount(
    current.numerator * repair.denominator + repair.numerator * current.denominator,
    current.denominator * repair.denominator,
  );
  if (amountAtLeast(sum, maximum)) {
    return Object.freeze({ amount: maximum, full: true });
  }
  return Object.freeze({ amount: sum, full: false });
}

export function selectFastServiceUnitIds(
  candidates: readonly FastServiceQueueEntry[],
  capacity = FAST_CAPACITY,
): readonly string[] {
  if (!Number.isSafeInteger(capacity) || capacity < 0) {
    throw new Error("fast-service capacity must be a non-negative safe integer");
  }
  return Object.freeze(
    [...candidates]
      .sort(
        (left, right) =>
          left.repairArrivalTick - right.repairArrivalTick ||
          compareIds(left.unitId, right.unitId),
      )
      .slice(0, capacity)
      .map((entry) => entry.unitId),
  );
}

function fieldContainsCell(
  map: VehicleRepairMap,
  provider: VehicleRepairProviderState,
  cellId: number,
  field: StructureRadialFieldProfile,
): boolean {
  const center = map.positionOf(provider.cellId);
  const candidate = map.positionOf(cellId);
  return repairFieldContainsCell(
    field,
    center.x,
    center.y,
    candidate.x,
    candidate.y,
  );
}

function fastServiceCellIds(
  map: VehicleRepairMap,
  provider: VehicleRepairProviderState,
): readonly number[] {
  const field = fixedRepairField(provider.profile.fastRadiusCells);
  const center = map.positionOf(provider.cellId);
  const cells: number[] = [];
  const radius = provider.profile.fastRadiusCells;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (
        !repairFieldContainsCell(
          field,
          center.x,
          center.y,
          center.x + dx,
          center.y + dy,
        )
      ) {
        continue;
      }
      const cellId = map.cellIdAt(center.x + dx, center.y + dy);
      if (cellId !== undefined) cells.push(cellId);
    }
  }
  cells.sort((left, right) => left - right);
  return Object.freeze(cells);
}

function atOrBelowRepairThreshold(
  health: ExactRepairAmount,
  maximum: ExactRepairAmount,
): boolean {
  if (health.numerator <= 0n) return false;
  return (
    health.numerator * maximum.denominator * 2n <=
    maximum.numerator * health.denominator
  );
}

function existingRepairRouteIsLegal<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  unit: Unit,
  provider: Provider,
): boolean {
  const route = unit.route;
  const fastField = fixedRepairField(provider.profile.fastRadiusCells);
  if (
    route === undefined ||
    !fieldContainsCell(domain.map, provider, route.destinationCellId, fastField)
  ) {
    return false;
  }
  for (let index = route.nextCellIndex - 1; index < route.cells.length; index += 1) {
    if (!domain.isTraversableCell(unit, route.cells[index]!)) return false;
  }
  return true;
}

function bestDestinationForProvider<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  unit: Unit,
  provider: Provider,
): VehicleRepairDestination<Provider> | undefined {
  let best: VehicleRepairDestination<Provider> | undefined;
  for (const destinationCellId of fastServiceCellIds(domain.map, provider)) {
    const route = domain.routeTo(unit, destinationCellId);
    if (route === undefined) continue;
    const candidate = Object.freeze({ provider, destinationCellId, route });
    if (
      best === undefined ||
      candidate.route.totalWeight < best.route.totalWeight ||
      (candidate.route.totalWeight === best.route.totalWeight &&
        candidate.destinationCellId < best.destinationCellId)
    ) {
      best = candidate;
      if (candidate.route.totalWeight === 0) break;
    }
  }
  return best;
}

function bestRepairDestination<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  unit: Unit,
): VehicleRepairDestination<Provider> | undefined {
  let best: VehicleRepairDestination<Provider> | undefined;
  const providers = domain.providers
    .filter((provider) => domain.isEligibleProvider(provider, unit))
    .sort((left, right) => compareIds(left.id, right.id));
  for (const provider of providers) {
    const candidate = bestDestinationForProvider(domain, unit, provider);
    if (candidate === undefined) continue;
    if (
      best === undefined ||
      candidate.route.totalWeight < best.route.totalWeight ||
      (candidate.route.totalWeight === best.route.totalWeight &&
        compareIds(candidate.provider.id, best.provider.id) < 0)
    ) {
      best = candidate;
    }
  }
  return best;
}

function assignRepairDestination<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  unit: Unit,
  operational: Operational,
  destination: VehicleRepairDestination<Provider>,
  preserveExistingRoute: boolean,
): Readonly<{ unit: Unit; operational: Operational }> {
  const fastField = fixedRepairField(destination.provider.profile.fastRadiusCells);
  if (fieldContainsCell(domain.map, destination.provider, unit.cellId, fastField)) {
    return Object.freeze({
      unit: domain.clearRoute(unit),
      operational: domain.withRepairAssignment(
        operational,
        destination.provider.id,
        domain.tick,
      ),
    });
  }
  if (
    preserveExistingRoute &&
    existingRepairRouteIsLegal(domain, unit, destination.provider)
  ) {
    return Object.freeze({
      unit,
      operational: domain.withRepairAssignment(
        operational,
        destination.provider.id,
        undefined,
      ),
    });
  }
  return Object.freeze({
    unit: domain.assignRoute(unit, destination.route),
    operational: domain.withRepairAssignment(
      operational,
      destination.provider.id,
      undefined,
    ),
  });
}

function preserveExistingRepairAssignment<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  unit: Unit,
  operational: Operational,
  provider: Provider,
): Readonly<{ unit: Unit; operational: Operational }> | undefined {
  if (!domain.isEligibleProvider(provider, unit)) return undefined;
  const fastField = fixedRepairField(provider.profile.fastRadiusCells);
  const arrival = domain.repairArrivalTick(operational);
  if (
    arrival !== undefined &&
    fieldContainsCell(domain.map, provider, unit.cellId, fastField)
  ) {
    return Object.freeze({ unit: domain.clearRoute(unit), operational });
  }
  if (arrival === undefined && existingRepairRouteIsLegal(domain, unit, provider)) {
    return Object.freeze({ unit, operational });
  }
  const destination = bestDestinationForProvider(domain, unit, provider);
  if (destination === undefined) return undefined;
  return assignRepairDestination(domain, unit, operational, destination, false);
}

function phaseResult<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  unitUpdates: ReadonlyMap<string, Unit>,
  operationalUpdates: ReadonlyMap<string, Operational>,
): VehicleRepairPhaseResult<Unit, Operational> {
  if (unitUpdates.size === 0 && operationalUpdates.size === 0) {
    return Object.freeze({
      changed: false,
      units: domain.units,
      operationalStates: domain.operationalStates,
    });
  }
  return Object.freeze({
    changed: true,
    units: Object.freeze(
      domain.units.map((unit) => unitUpdates.get(unit.id) ?? unit),
    ),
    operationalStates: Object.freeze(
      domain.operationalStates.map(
        (operational) => operationalUpdates.get(operational.unitId) ?? operational,
      ),
    ),
  });
}

export function advanceVehicleRepairIntentPhase<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
): VehicleRepairPhaseResult<Unit, Operational> {
  const unitsById = new Map(domain.units.map((unit) => [unit.id, unit]));
  const providersById = new Map(
    domain.providers.map((provider) => [provider.id, provider]),
  );
  const unitUpdates = new Map<string, Unit>();
  const operationalUpdates = new Map<string, Operational>();

  for (const operational of domain.operationalStates) {
    const unit = unitsById.get(operational.unitId);
    if (unit === undefined || !domain.isRepairableUnit(unit)) continue;
    const providerId = domain.repairProviderId(operational);
    if (providerId !== undefined) {
      const provider = providersById.get(providerId);
      if (provider !== undefined) {
        const preserved = preserveExistingRepairAssignment(
          domain,
          unit,
          operational,
          provider,
        );
        if (preserved !== undefined) {
          if (preserved.unit !== unit) unitUpdates.set(unit.id, preserved.unit);
          if (preserved.operational !== operational) {
            operationalUpdates.set(unit.id, preserved.operational);
          }
          continue;
        }
      }

      const replacement = bestRepairDestination(domain, unit);
      if (replacement !== undefined) {
        const assigned = assignRepairDestination(
          domain,
          unit,
          operational,
          replacement,
          false,
        );
        if (assigned.unit !== unit) unitUpdates.set(unit.id, assigned.unit);
        operationalUpdates.set(unit.id, assigned.operational);
      } else {
        const cleared = domain.clearRepairAssignment(
          operational,
          operational.health,
        );
        const clearedUnit = domain.clearRoute(unit);
        if (clearedUnit !== unit) unitUpdates.set(unit.id, clearedUnit);
        operationalUpdates.set(unit.id, cleared);
      }
      continue;
    }

    if (!atOrBelowRepairThreshold(operational.health, domain.maximumHealth(unit))) {
      continue;
    }
    const destination = bestRepairDestination(domain, unit);
    if (destination === undefined) continue;
    const assigned = assignRepairDestination(
      domain,
      unit,
      operational,
      destination,
      false,
    );
    if (assigned.unit !== unit) unitUpdates.set(unit.id, assigned.unit);
    operationalUpdates.set(unit.id, assigned.operational);
  }

  return phaseResult(domain, unitUpdates, operationalUpdates);
}

export function advanceVehicleRepairMovementPhase<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
): VehicleRepairPhaseResult<Unit, Operational> {
  const operationalById = new Map(
    domain.operationalStates.map((operational) => [operational.unitId, operational]),
  );
  const providersById = new Map(
    domain.providers.map((provider) => [provider.id, provider]),
  );
  const unitUpdates = new Map<string, Unit>();
  const operationalUpdates = new Map<string, Operational>();

  for (const unit of domain.units) {
    const operational = operationalById.get(unit.id);
    if (operational === undefined || !domain.isRepairableUnit(unit)) continue;
    const providerId = domain.repairProviderId(operational);
    if (
      providerId === undefined ||
      domain.repairArrivalTick(operational) !== undefined ||
      unit.route === undefined
    ) {
      continue;
    }
    const movementWorkPerTick = domain.movementWorkPerTick(unit);
    if (movementWorkPerTick === undefined) continue;
    const advanced = domain.advanceUnit(unit, movementWorkPerTick);
    if (advanced !== unit) unitUpdates.set(unit.id, advanced);
    if (advanced.route !== undefined) continue;

    const provider = providersById.get(providerId);
    if (
      provider === undefined ||
      !domain.isEligibleProvider(provider, advanced)
    ) {
      continue;
    }
    const fastField = fixedRepairField(provider.profile.fastRadiusCells);
    if (!fieldContainsCell(domain.map, provider, advanced.cellId, fastField)) {
      continue;
    }
    operationalUpdates.set(
      unit.id,
      domain.withRepairAssignment(operational, providerId, domain.tick),
    );
  }

  return phaseResult(domain, unitUpdates, operationalUpdates);
}

export function vehicleFastServiceQueueEntries<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
): readonly VehicleFastServiceQueueEntry[] {
  const unitsById = new Map(domain.units.map((unit) => [unit.id, unit]));
  const entries: VehicleFastServiceQueueEntry[] = [];
  const providers = [...domain.providers].sort((left, right) =>
    compareIds(left.id, right.id),
  );
  for (const provider of providers) {
    const field = fixedRepairField(provider.profile.fastRadiusCells);
    for (const operational of domain.operationalStates) {
      if (domain.repairProviderId(operational) !== provider.id) continue;
      const arrival = domain.repairArrivalTick(operational);
      if (arrival === undefined) continue;
      const unit = unitsById.get(operational.unitId);
      if (
        unit === undefined ||
        !domain.isRepairableUnit(unit) ||
        !domain.isEligibleProvider(provider, unit) ||
        !fieldContainsCell(domain.map, provider, unit.cellId, field)
      ) {
        continue;
      }
      entries.push(
        Object.freeze({
          providerId: provider.id,
          unitId: operational.unitId,
          repairArrivalTick: arrival,
          fastCapacity: provider.profile.fastCapacity,
        }),
      );
    }
  }
  entries.sort(
    (left, right) =>
      compareIds(left.providerId, right.providerId) ||
      left.repairArrivalTick - right.repairArrivalTick ||
      compareIds(left.unitId, right.unitId),
  );
  return Object.freeze(entries);
}

export function vehicleFastServiceUnitIds<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
): ReadonlySet<string> {
  const fast = new Set<string>();
  const entries = vehicleFastServiceQueueEntries(domain);
  const providers = [...domain.providers].sort((left, right) =>
    compareIds(left.id, right.id),
  );
  for (const provider of providers) {
    const queue = entries.filter((entry) => entry.providerId === provider.id);
    for (const unitId of selectFastServiceUnitIds(queue, provider.profile.fastCapacity)) {
      fast.add(unitId);
    }
  }
  return fast;
}

export function advanceVehicleRepairServicePhase<
  Unit extends VehicleRepairUnitState,
  Operational extends VehicleRepairOperationalState,
  Provider extends VehicleRepairProviderState,
>(
  domain: VehicleRepairDomain<Unit, Operational, Provider>,
  selectedFastServiceUnitIds?: ReadonlySet<string>,
): VehicleRepairPhaseResult<Unit, Operational> {
  const unitsById = new Map(domain.units.map((unit) => [unit.id, unit]));
  const eligibleFast = new Set(
    vehicleFastServiceQueueEntries(domain).map((entry) => entry.unitId),
  );
  const fastRecipients =
    selectedFastServiceUnitIds === undefined
      ? vehicleFastServiceUnitIds(domain)
      : new Set(
          [...selectedFastServiceUnitIds].filter((unitId) =>
            eligibleFast.has(unitId),
          ),
        );
  const unitUpdates = new Map<string, Unit>();
  const operationalUpdates = new Map<string, Operational>();
  const providers = [...domain.providers].sort((left, right) =>
    compareIds(left.id, right.id),
  );

  for (const provider of providers) {
    for (const operational of domain.operationalStates) {
      if (domain.repairProviderId(operational) !== provider.id) continue;
      const unit = unitsById.get(operational.unitId);
      if (
        unit === undefined ||
        !domain.isRepairableUnit(unit) ||
        !domain.isEligibleProvider(provider, unit)
      ) {
        continue;
      }
      const useFast = fastRecipients.has(unit.id);
      const useBroad =
        !useFast &&
        fieldContainsCell(
          domain.map,
          provider,
          unit.cellId,
          domain.broadRepairField(provider, unit),
        );
      if (!useFast && !useBroad) continue;

      const result = addRepairClamped(
        operational.health,
        domain.repairPerTick(provider, unit, useFast),
        domain.maximumHealth(unit),
      );
      if (result.full) {
        operationalUpdates.set(
          unit.id,
          domain.clearRepairAssignment(operational, result.amount),
        );
        const clearedUnit = domain.clearRoute(unit);
        if (clearedUnit !== unit) unitUpdates.set(unit.id, clearedUnit);
      } else {
        operationalUpdates.set(
          unit.id,
          domain.withHealth(operational, result.amount),
        );
      }
    }
  }

  return phaseResult(domain, unitUpdates, operationalUpdates);
}
