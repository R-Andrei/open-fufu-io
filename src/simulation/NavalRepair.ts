import type { MatchState } from "./MatchState";
import { selectFastServiceUnitIds } from "./RepairService";
import {
  advanceTransportRepairPhase,
  transportFastServiceQueueEntries,
} from "./TransportRepair";
import {
  advanceWarshipRepairPhase,
  warshipFastServiceQueueEntries,
} from "./WarshipRepair";

export function navalFastServiceUnitIds(
  state: MatchState,
): ReadonlySet<string> {
  const entries = [
    ...transportFastServiceQueueEntries(state),
    ...warshipFastServiceQueueEntries(state),
  ];
  const byProvider = new Map<
    string,
    {
      capacity: number;
      entries: Array<Readonly<{
        unitId: string;
        repairArrivalTick: number;
      }>>;
    }
  >();

  for (const entry of entries) {
    const existing = byProvider.get(entry.providerId);
    if (existing === undefined) {
      byProvider.set(entry.providerId, {
        capacity: entry.fastCapacity,
        entries: [{
          unitId: entry.unitId,
          repairArrivalTick: entry.repairArrivalTick,
        }],
      });
      continue;
    }
    if (existing.capacity !== entry.fastCapacity) {
      throw new Error(
        `Naval repair fast capacity disagrees for provider ${entry.providerId}`,
      );
    }
    existing.entries.push({
      unitId: entry.unitId,
      repairArrivalTick: entry.repairArrivalTick,
    });
  }

  const selected = new Set<string>();
  for (const providerId of [...byProvider.keys()].sort()) {
    const group = byProvider.get(providerId)!;
    for (const unitId of selectFastServiceUnitIds(
      group.entries,
      group.capacity,
    )) {
      selected.add(unitId);
    }
  }
  return selected;
}

export function advanceNavalRepairPhase(state: MatchState): MatchState {
  const selected = navalFastServiceUnitIds(state);
  const transports = advanceTransportRepairPhase(state, selected);
  return advanceWarshipRepairPhase(transports, selected);
}
