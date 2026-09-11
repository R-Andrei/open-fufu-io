import type { DirectiveChanges } from "../core/controller/ControllerApi";
import type { MatchState } from "./MatchState";

export type ControllerReferenceDomain = "UNIT" | "STRUCTURE" | "OPERATION";

type IncarnationOrdinal = number;
type OperationDirectiveKind = "LAND_OPERATION" | "COUNTER_RESPONSE";

type OperationTransition =
  | Readonly<{
      logicalKey: string;
      kind: "END";
    }>
  | Readonly<{
      logicalKey: string;
      kind: "ENSURE_OPERATION";
      directiveKind: OperationDirectiveKind;
    }>;

interface DomainIncarnationState {
  nextIncarnation: number;
  currentByAuthoritativeId: Map<string, IncarnationOrdinal>;
  authoritativeIdByIncarnation: Map<IncarnationOrdinal, string>;
}

interface IssuedReference {
  readonly viewerFactionId: string;
  readonly domain: ControllerReferenceDomain;
  readonly incarnation: IncarnationOrdinal;
}

const DOMAIN_CODES: Readonly<Record<ControllerReferenceDomain, string>> =
  Object.freeze({
    UNIT: "u",
    STRUCTURE: "s",
    OPERATION: "o",
  });

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createDomainState(): DomainIncarnationState {
  return {
    nextIncarnation: 0,
    currentByAuthoritativeId: new Map(),
    authoritativeIdByIncarnation: new Map(),
  };
}

function operationLogicalKey(ownerId: string, controllerKey: string): string {
  return JSON.stringify([ownerId, controllerKey]);
}

function operationDirectiveKind(
  operation: MatchState["operations"][number],
): OperationDirectiveKind {
  return operation.kind === "COUNTER_RESPONSE"
    ? "COUNTER_RESPONSE"
    : "LAND_OPERATION";
}

/**
 * Trusted live-match identity state for controller-facing opaque references.
 *
 * This session deliberately owns identity only. Requester-relative visibility must
 * be applied by the lawful projection/consumer after resolution and before any
 * controller-visible result is materialized.
 *
 * The namespace is a live-match instance namespace supplied by the match adapter.
 * It must be unique for simultaneously valid matches and is intentionally not part
 * of canonical MatchState/replay state.
 */
export class ControllerReferenceSession {
  private readonly encodedNamespace: string;
  private readonly viewers = new Map<string, number>();
  private readonly domains: Record<
    ControllerReferenceDomain,
    DomainIncarnationState
  > = {
    UNIT: createDomainState(),
    STRUCTURE: createDomainState(),
    OPERATION: createDomainState(),
  };
  private operationIncarnationByLogicalKey = new Map<
    string,
    IncarnationOrdinal
  >();
  private operationDirectiveKindByLogicalKey = new Map<
    string,
    OperationDirectiveKind
  >();
  private pendingOperationTransitions: OperationTransition[] = [];
  private readonly issuedRefByIdentity = new Map<string, string>();
  private readonly issuedIdentityByRef = new Map<string, IssuedReference>();
  private readonly nextRefOrdinalByViewerDomain = new Map<string, number>();

  constructor(namespace: string, initialState: MatchState) {
    if (typeof namespace !== "string" || namespace.length === 0) {
      throw new Error("controller reference namespace must be a non-empty string");
    }
    this.encodedNamespace = encodeURIComponent(namespace);

    const viewerIds = initialState.factions
      .map((faction) => faction.id)
      .sort(compareText);
    for (let index = 0; index < viewerIds.length; index += 1) {
      const viewerId = viewerIds[index]!;
      if (this.viewers.has(viewerId)) {
        throw new Error(`duplicate controller reference viewer ${viewerId}`);
      }
      this.viewers.set(viewerId, index);
    }

    this.reconcile(initialState);
  }

  private allocateIncarnation(
    domain: ControllerReferenceDomain,
  ): IncarnationOrdinal {
    const state = this.domains[domain];
    const incarnation = state.nextIncarnation;
    if (!Number.isSafeInteger(incarnation) || incarnation < 0) {
      throw new Error(`${domain} controller reference incarnation exhausted`);
    }
    state.nextIncarnation += 1;
    return incarnation;
  }

  private reconcileSimpleDomain(
    domain: "UNIT" | "STRUCTURE",
    authoritativeIds: readonly string[],
  ): void {
    const state = this.domains[domain];
    const ordered = [...authoritativeIds].sort(compareText);
    const nextById = new Map<string, IncarnationOrdinal>();
    const nextByIncarnation = new Map<IncarnationOrdinal, string>();

    for (const authoritativeId of ordered) {
      if (nextById.has(authoritativeId)) {
        throw new Error(`duplicate ${domain} authoritative identity ${authoritativeId}`);
      }
      const incarnation =
        state.currentByAuthoritativeId.get(authoritativeId) ??
        this.allocateIncarnation(domain);
      nextById.set(authoritativeId, incarnation);
      nextByIncarnation.set(incarnation, authoritativeId);
    }

    state.currentByAuthoritativeId = nextById;
    state.authoritativeIdByIncarnation = nextByIncarnation;
  }

  private reconcileOperations(state: MatchState): void {
    const activeByLogicalKey = new Map(this.operationIncarnationByLogicalKey);
    const activeDirectiveKindByLogicalKey = new Map(
      this.operationDirectiveKindByLogicalKey,
    );

    for (const transition of this.pendingOperationTransitions) {
      if (transition.kind === "END") {
        activeByLogicalKey.delete(transition.logicalKey);
        activeDirectiveKindByLogicalKey.delete(transition.logicalKey);
        continue;
      }
      const currentIncarnation = activeByLogicalKey.get(transition.logicalKey);
      const currentDirectiveKind = activeDirectiveKindByLogicalKey.get(
        transition.logicalKey,
      );
      if (
        currentIncarnation === undefined ||
        currentDirectiveKind !== transition.directiveKind
      ) {
        activeByLogicalKey.set(
          transition.logicalKey,
          this.allocateIncarnation("OPERATION"),
        );
      }
      activeDirectiveKindByLogicalKey.set(
        transition.logicalKey,
        transition.directiveKind,
      );
    }

    const operations = [...state.operations].sort(
      (left, right) =>
        compareText(left.ownerId, right.ownerId) ||
        compareText(left.controllerKey, right.controllerKey) ||
        compareText(left.id, right.id),
    );
    const nextLogical = new Map<string, IncarnationOrdinal>();
    const nextDirectiveKind = new Map<string, OperationDirectiveKind>();
    const nextById = new Map<string, IncarnationOrdinal>();
    const nextByIncarnation = new Map<IncarnationOrdinal, string>();

    for (const operation of operations) {
      const logicalKey = operationLogicalKey(
        operation.ownerId,
        operation.controllerKey,
      );
      if (nextLogical.has(logicalKey)) {
        throw new Error(`duplicate operation logical identity ${logicalKey}`);
      }
      if (nextById.has(operation.id)) {
        throw new Error(`duplicate OPERATION authoritative identity ${operation.id}`);
      }
      const directiveKind = operationDirectiveKind(operation);
      const activeIncarnation = activeByLogicalKey.get(logicalKey);
      const incarnation =
        activeIncarnation !== undefined &&
        activeDirectiveKindByLogicalKey.get(logicalKey) === directiveKind
          ? activeIncarnation
          : this.allocateIncarnation("OPERATION");
      nextLogical.set(logicalKey, incarnation);
      nextDirectiveKind.set(logicalKey, directiveKind);
      nextById.set(operation.id, incarnation);
      nextByIncarnation.set(incarnation, operation.id);
    }

    this.operationIncarnationByLogicalKey = nextLogical;
    this.operationDirectiveKindByLogicalKey = nextDirectiveKind;
    this.domains.OPERATION.currentByAuthoritativeId = nextById;
    this.domains.OPERATION.authoritativeIdByIncarnation = nextByIncarnation;
    this.pendingOperationTransitions = [];
  }

  /**
   * Records ordered persistent-directive lifecycle facts that cannot always be
   * recovered from before/after snapshots when a key is ended and recreated in
   * one authoritative tick. The transitions take effect on the next reconcile.
   */
  applyDirectiveChanges(factionId: string, changes: DirectiveChanges): void {
    for (const key of changes.end ?? []) {
      this.pendingOperationTransitions.push(
        Object.freeze({
          logicalKey: operationLogicalKey(factionId, key),
          kind: "END" as const,
        }),
      );
    }

    for (const directive of changes.set ?? []) {
      const logicalKey = operationLogicalKey(factionId, directive.key);
      if (directive.kind === "DEFENSE_PRIORITY") {
        this.pendingOperationTransitions.push(
          Object.freeze({ logicalKey, kind: "END" as const }),
        );
        continue;
      }
      this.pendingOperationTransitions.push(
        Object.freeze({
          logicalKey,
          kind: "ENSURE_OPERATION" as const,
          directiveKind: directive.kind,
        }),
      );
    }
  }

  /** Synchronizes current incarnation bindings to one canonical match state. */
  reconcile(state: MatchState): void {
    this.reconcileSimpleDomain(
      "UNIT",
      state.mobileUnits.map((unit) => unit.id),
    );
    this.reconcileSimpleDomain(
      "STRUCTURE",
      state.structures.map((structure) => structure.id),
    );
    this.reconcileOperations(state);
  }

  private issuedIdentityKey(
    viewerFactionId: string,
    domain: ControllerReferenceDomain,
    incarnation: IncarnationOrdinal,
  ): string {
    return JSON.stringify([viewerFactionId, domain, incarnation]);
  }

  private nextReferenceToken(
    viewerFactionId: string,
    domain: ControllerReferenceDomain,
  ): string {
    const viewerOrdinal = this.viewers.get(viewerFactionId);
    if (viewerOrdinal === undefined) {
      throw new Error(`unknown controller reference viewer ${viewerFactionId}`);
    }
    const counterKey = JSON.stringify([viewerFactionId, domain]);
    const ordinal = this.nextRefOrdinalByViewerDomain.get(counterKey) ?? 0;
    if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
      throw new Error(`${domain} controller public reference ordinal exhausted`);
    }
    this.nextRefOrdinalByViewerDomain.set(counterKey, ordinal + 1);
    return `ofr1:${this.encodedNamespace}:${viewerOrdinal.toString(36)}:${DOMAIN_CODES[domain]}:${ordinal.toString(36)}`;
  }

  /**
   * Returns the stable ref previously issued for this viewer/incarnation, or
   * issues one now. Unknown/non-current authoritative identities are unavailable.
   */
  issue(
    viewerFactionId: string,
    domain: ControllerReferenceDomain,
    authoritativeId: string,
  ): string | undefined {
    if (!this.viewers.has(viewerFactionId)) return undefined;
    const incarnation =
      this.domains[domain].currentByAuthoritativeId.get(authoritativeId);
    if (incarnation === undefined) return undefined;

    const identityKey = this.issuedIdentityKey(
      viewerFactionId,
      domain,
      incarnation,
    );
    const existing = this.issuedRefByIdentity.get(identityKey);
    if (existing !== undefined) return existing;

    let ref = this.nextReferenceToken(viewerFactionId, domain);
    while (ref === authoritativeId) {
      ref = this.nextReferenceToken(viewerFactionId, domain);
    }
    if (this.issuedIdentityByRef.has(ref)) {
      throw new Error("controller reference token collision");
    }
    this.issuedRefByIdentity.set(identityKey, ref);
    this.issuedIdentityByRef.set(
      ref,
      Object.freeze({ viewerFactionId, domain, incarnation }),
    );
    return ref;
  }

  /**
   * Resolves identity only. Callers must still apply canonical requester-relative
   * visibility and legality before materializing any differentiated public result.
   */
  resolve(
    viewerFactionId: string,
    domain: ControllerReferenceDomain,
    ref: string,
  ): string | undefined {
    const issued = this.issuedIdentityByRef.get(ref);
    if (
      issued === undefined ||
      issued.viewerFactionId !== viewerFactionId ||
      issued.domain !== domain
    ) {
      return undefined;
    }
    return this.domains[domain].authoritativeIdByIncarnation.get(
      issued.incarnation,
    );
  }
}
