import {
  pruneExpiredDirectReveals,
  refreshDirectRevealRecords,
  type DirectRevealRecord,
} from "../core/visibility/TacticalVisibility";
import type { MatchState } from "./MatchState";
import type { PhysicalUnitSimulationEvent } from "./SimulationEvents";

const V1_SIMULATION_TICKS_PER_SECOND = 10 as const;

/**
 * Applies physical-combat visibility consequences after the producer has
 * committed its owned state. Attack facts refresh source-specific reveal for
 * the directly attacked faction; destruction facts prevent reveal ghosts.
 */
export function resolveDirectRevealsFromPhysicalEvents(
  state: Readonly<Pick<MatchState, "directReveals">>,
  events: readonly PhysicalUnitSimulationEvent[],
  currentTick: number,
): readonly DirectRevealRecord[] {
  let directReveals = pruneExpiredDirectReveals(
    state.directReveals,
    currentTick,
  );
  const destroyedUnitIds = new Set<string>();

  for (const event of events) {
    if (event.kind === "UNIT_DESTROYED") {
      destroyedUnitIds.add(event.payload.unit.unitId);
      continue;
    }

    directReveals = refreshDirectRevealRecords(
      directReveals,
      {
        resolved: true,
        hostile: true,
        identifiableSource: true,
        attackedFactionIds: [event.payload.target.ownerId],
      },
      "UNIT",
      event.payload.attacker.unitId,
      event.tick,
      V1_SIMULATION_TICKS_PER_SECOND,
    );
  }

  if (destroyedUnitIds.size === 0) return directReveals;

  return Object.freeze(
    directReveals.filter(
      (record) =>
        record.sourceKind !== "UNIT" ||
        !destroyedUnitIds.has(record.sourceId),
    ),
  );
}
