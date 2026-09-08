import type {
  CellView,
  ControllerDecision,
  DecisionFailure,
  DecisionReceipt,
  FactionStatus,
  PopulationView,
} from "../core/controller/ControllerApi";
import {
  materializeDirectiveChanges,
  tryApplyPersistentDirectiveChanges,
} from "./LandOperations";
import type { MatchState } from "./MatchState";
import type { PopulationState } from "./Population";
import type { SimulationAction } from "./TickEngine";

export interface LawfulFactionObservation {
  readonly id: string;
  readonly status: FactionStatus;
}

export type LawfulPopulationObservation = Readonly<
  Pick<
    PopulationView,
    | "total"
    | "available"
    | "committedOffense"
    | "committedCounterResponse"
    | "aboardTransports"
    | "neutralSettlementHalfResidual"
  >
>;

export interface LawfulSelfFactionObservation extends LawfulFactionObservation {
  readonly population: LawfulPopulationObservation;
}

export type LawfulLandCellObservation = Readonly<
  Pick<CellView, "id" | "ownerId"> & {
    readonly terrain: CellView["terrain"] | "TEST";
  }
>;

export interface LawfulControllerObservation {
  readonly tick: number;
  readonly decisionNumber: number;
  readonly me: LawfulSelfFactionObservation;
  readonly factions: readonly LawfulFactionObservation[];
  readonly cells: readonly LawfulLandCellObservation[];
  readonly lastDecision?: DecisionReceipt;
}

export interface ControllerHost {
  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
  ): ControllerDecision | void;
}

export type InProcessController = (
  observation: LawfulControllerObservation,
) => ControllerDecision | void;

export class InProcessTestControllerHost implements ControllerHost {
  private readonly controllers: Readonly<Record<string, InProcessController>>;

  constructor(controllers: Readonly<Record<string, InProcessController>>) {
    this.controllers = Object.freeze({ ...controllers });
  }

  invoke(
    factionId: string,
    observation: LawfulControllerObservation,
  ): ControllerDecision | void {
    return this.controllers[factionId]?.(observation);
  }
}

export interface ControllerRoundReceipt {
  readonly factionId: string;
  readonly receipt: DecisionReceipt;
}

export interface ControllerRoundEvaluation {
  readonly actions: readonly SimulationAction[];
  readonly receipts: readonly ControllerRoundReceipt[];
  readonly faultCounts: ReadonlyMap<string, number>;
}

interface ProposalEvaluation {
  readonly actions: readonly SimulationAction[];
  readonly failure?: DecisionFailure;
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function freezeFactionObservation(
  id: string,
  status: FactionStatus,
): LawfulFactionObservation {
  return Object.freeze({ id, status });
}

function freezePopulationObservation(
  population: PopulationState,
): LawfulPopulationObservation {
  return Object.freeze({
    total: population.total,
    available: population.available,
    committedOffense: population.committedOffensive,
    committedCounterResponse: population.committedCounterResponse,
    aboardTransports: population.aboardTransports,
    neutralSettlementHalfResidual: population.neutralSettlementHalfResidual,
  });
}

function freezeSelfFactionObservation(
  id: string,
  status: FactionStatus,
  population: PopulationState,
): LawfulSelfFactionObservation {
  return Object.freeze({
    id,
    status,
    population: freezePopulationObservation(population),
  });
}

function freezeLandCellObservations(
  state: MatchState,
): readonly LawfulLandCellObservation[] {
  return Object.freeze(
    state.map.terrain.map((terrain, id) => {
      const ownerId = state.ownership[id] ?? null;
      return Object.freeze({
        id,
        terrain: terrain as LawfulLandCellObservation["terrain"],
        ...(ownerId === null ? {} : { ownerId }),
      });
    }),
  );
}

export function projectLawfulControllerObservation(
  state: MatchState,
  factionId: string,
  decisionNumber: number,
  lastDecision?: DecisionReceipt,
): LawfulControllerObservation {
  const me = state.factions.find((faction) => faction.id === factionId);
  if (me === undefined) {
    throw new Error(`unknown controller faction: ${factionId}`);
  }

  const factions = Object.freeze(
    [...state.factions]
      .sort((left, right) => compareIds(left.id, right.id))
      .map((faction) => freezeFactionObservation(faction.id, faction.status)),
  );

  return Object.freeze({
    tick: state.tick,
    decisionNumber,
    me: freezeSelfFactionObservation(me.id, me.status, me.population),
    factions,
    cells: freezeLandCellObservations(state),
    ...(lastDecision === undefined ? {} : { lastDecision }),
  });
}

function invalid(
  code: DecisionFailure["code"],
  key?: string,
): ProposalEvaluation {
  return Object.freeze({
    actions: Object.freeze([]),
    failure: Object.freeze({ code, ...(key === undefined ? {} : { key }) }),
  });
}

function evaluateProposal(
  state: MatchState,
  factionId: string,
  decision: ControllerDecision | void,
): ProposalEvaluation {
  if (decision === undefined) {
    return Object.freeze({ actions: Object.freeze([]) });
  }

  const actions: SimulationAction[] = [];
  const directiveSet = decision.directives?.set ?? [];
  const directiveEnd = decision.directives?.end ?? [];
  if (directiveSet.length > 0 || directiveEnd.length > 0) {
    let changes;
    try {
      changes = materializeDirectiveChanges({
        ...(directiveSet.length === 0 ? {} : { set: directiveSet }),
        ...(directiveEnd.length === 0 ? {} : { end: directiveEnd }),
      });
    } catch {
      return invalid(
        "INVALID_DIRECTIVE",
        directiveSet[0]?.key ?? directiveEnd[0],
      );
    }
    const applied = tryApplyPersistentDirectiveChanges(state, factionId, changes);
    if (!applied.ok) {
      return Object.freeze({ actions: Object.freeze([]), failure: applied.failure });
    }
    actions.push(
      Object.freeze({
        type: "APPLY_PERSISTENT_DIRECTIVES" as const,
        factionId,
        changes,
      }),
    );
  }

  const commands = decision.commands ?? [];
  const seenKeys = new Set<string>();
  let capitulateKey: string | undefined;

  for (const command of commands) {
    if (seenKeys.has(command.key)) {
      return invalid("CONFLICTING_PROPOSAL", command.key);
    }
    seenKeys.add(command.key);

    if (command.kind !== "CAPITULATE") {
      return invalid("INVALID_COMMAND", command.key);
    }
    if (capitulateKey !== undefined) {
      return invalid("CONFLICTING_PROPOSAL", command.key);
    }
    capitulateKey = command.key;
  }

  if (capitulateKey !== undefined) {
    const faction = state.factions.find((candidate) => candidate.id === factionId);
    if (faction === undefined || faction.status !== "ACTIVE") {
      return invalid("INVALID_TARGET", capitulateKey);
    }
    actions.push(
      Object.freeze({
        type: "CAPITULATE_FACTION" as const,
        factionId,
      }),
    );
  }

  return Object.freeze({ actions: Object.freeze(actions) });
}

export function evaluateControllerRound(
  state: MatchState,
  host: ControllerHost,
  decisionNumber: number,
  previousReceipts: ReadonlyMap<string, DecisionReceipt>,
  previousFaultCounts: ReadonlyMap<string, number>,
): ControllerRoundEvaluation {
  const orderedFactionIds = [...state.factions]
    .map((faction) => faction.id)
    .sort(compareIds);
  const proposals = new Map<string, ControllerDecision | void>();
  const invocationFailures = new Map<string, DecisionFailure>();
  const faultCounts = new Map(previousFaultCounts);

  for (const factionId of orderedFactionIds) {
    const observation = projectLawfulControllerObservation(
      state,
      factionId,
      decisionNumber,
      previousReceipts.get(factionId),
    );
    try {
      proposals.set(factionId, host.invoke(factionId, observation));
    } catch {
      const nextFaultCount = (faultCounts.get(factionId) ?? 0) + 1;
      faultCounts.set(factionId, nextFaultCount);
      invocationFailures.set(
        factionId,
        Object.freeze({ code: "RUNTIME_ERROR" }),
      );
    }
  }

  const actions: SimulationAction[] = [];
  const receipts: ControllerRoundReceipt[] = [];
  const reservations = new Set<string>();

  for (const factionId of orderedFactionIds) {
    let failure = invocationFailures.get(factionId);
    let proposalActions: readonly SimulationAction[] = Object.freeze([]);

    if (failure === undefined) {
      const evaluated = evaluateProposal(state, factionId, proposals.get(factionId));
      failure = evaluated.failure;
      proposalActions = evaluated.actions;
    }

    if (failure === undefined) {
      for (const action of proposalActions) {
        const reservation =
          action.type === "CAPITULATE_FACTION"
            ? `faction-status:${action.factionId}`
            : undefined;
        if (reservation !== undefined && reservations.has(reservation)) {
          failure = Object.freeze({ code: "CONFLICTING_PROPOSAL" });
          break;
        }
      }
    }

    if (failure === undefined) {
      for (const action of proposalActions) {
        if (action.type === "CAPITULATE_FACTION") {
          reservations.add(`faction-status:${action.factionId}`);
        }
        actions.push(action);
      }
    }

    const receipt = Object.freeze({
      decisionNumber,
      accepted: failure === undefined,
      ...(failure === undefined ? {} : { failure }),
      faultCount: faultCounts.get(factionId) ?? 0,
      faulted: false,
    });
    receipts.push(Object.freeze({ factionId, receipt }));
  }

  return Object.freeze({
    actions: Object.freeze(actions),
    receipts: Object.freeze(receipts),
    faultCounts,
  });
}
