# Open Fufu — Deterministic Simulation Events

## Status and authority

This document is the canonical owner for Open Fufu's deterministic **simulation-domain event contract**: the boundary between subsystem-owned state mutation and cross-system consequences, the common immutable event envelope, lifecycle-safe entity snapshots, causal-event semantics, and deterministic in-tick event delivery.

Neighboring concerns remain owned elsewhere:

- authoritative simulation runtime topology, `MatchRuntime`, `MatchState`, `TickEngine`, persistence architecture, and implementation sequencing: [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md);
- gameplay legality, damage, target selection, timing, and subsystem-specific physical outcomes: the focused gameplay owners registered in [`README.md`](./README.md);
- FFY event valuation and economic consequences: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Origin-specific gameplay transformations: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

This contract does not replace those owners and does not make every state transition an event.

---

## 1. Boundary rule

A simulation subsystem may directly mutate authoritative state that it owns. When an authoritative occurrence in one subsystem can cause consequences owned by another subsystem, that occurrence crosses the subsystem boundary as a canonical simulation event.

Events are **past-tense authoritative facts**, not commands. A producer/resolver first establishes the occurrence according to its own canonical legality and state rules, commits the state it owns, and emits the resulting fact for downstream consumers.

Consumers may then apply consequences that they own. A consumer must not require the producer to carry consumer-private state merely for convenience.

Examples of data that does **not** belong on a generic physical destruction fact merely because a downstream system may need it include cargo values, FFY amounts, pending economic-event IDs, Factory/service/route state, `atWar` state, score, achievements, or reward attribution.

Current-state questions remain ordinary state reads. Events communicate **what just happened** across ownership boundaries; they are not a replacement for querying **what is true now**.

---

## 2. Delivery model

Simulation-event delivery is synchronous, explicit, deterministic, and phase-ordered.

A system phase may conceptually return:

```ts
interface SimulationPhaseResult<TState> {
  readonly state: TState;
  readonly events: readonly SimulationEvent[];
}
```

`TickEngine` or another authoritative deterministic orchestrator passes the resulting immutable batch to the explicitly ordered consumers that follow that producer phase. Derived events, when a consumer legitimately owns a new occurrence, enter an explicit subsequent stage; they are not recursively published into the currently executing stage.

The target architecture therefore does **not** use:

- arbitrary `EventEmitter` / listener-registration order;
- asynchronous observer delivery;
- reentrant publish-during-handler behavior;
- nondeterministic subscription discovery;
- full event sourcing as a requirement.

Events do not need to become persistent `MatchState` merely because they exist. Persistent consequences remain in their owning authoritative state. A focused mechanic may explicitly require persistent event/residual state, but that is a separate lifecycle decision owned by that mechanic/runtime contract.

---

## 3. Common event envelope

The common shape is:

```ts
interface SimulationEvent<TKind extends string, TPayload> {
  readonly id: string;
  readonly tick: number;
  readonly kind: TKind;
  readonly payload: Readonly<TPayload>;
}
```

Requirements:

- `id` is deterministic and unique within the authoritative event stream that produces it;
- the string representation of `id` is **opaque** to consumers: consumers may compare, retain, reference, or serialize it, but must not parse business meaning from its formatting;
- `tick` is the authoritative simulation tick on which the occurrence resolved;
- `kind` identifies the factual event type;
- `payload` contains only the authoritative facts required by that event contract;
- emitted event objects and owned nested event data are immutable.

The producing subsystem is responsible for deterministic event identity. This document does not require one universal string-format algorithm for unrelated producers.

---

## 4. Lifecycle-safe unit subjects

A downstream consumer must not depend on a destroyed or otherwise removed entity still existing in authoritative collections merely to understand an event that already occurred.

Unit-related event facts therefore use a lifecycle-safe subject snapshot containing at least:

```ts
interface UnitEventSubject {
  readonly unitId: string;
  readonly ownerId: string;
  readonly unitType: MobileUnitType;
  readonly cellId: number;
}
```

The snapshot records the authoritative identity/location facts relevant at event resolution. It does not convert mutable unit state into a permanent historical copy unless the focused event contract explicitly requires additional fields.

---

## 5. Initial shared event vocabulary

The shared vocabulary begins with physical-combat facts, cell-level political-ownership transitions, and the producer-owned lifecycle facts currently required by cross-system hostility-state consequences.

### 5.1 `UNIT_ATTACK_RESOLVED`

An admitted physical attack that legally resolves emits:

```ts
UNIT_ATTACK_RESOLVED {
  attacker: UnitEventSubject;
  target: UnitEventSubject;
}
```

Its event `id` is the canonical causal identity for that resolved attack occurrence.

The event says that the authoritative attack resolved. The focused combat owner still determines legality, range, cooldown, damage, simultaneous-resolution behavior, and any other attack mechanics.

### 5.2 `UNIT_DESTROYED`

When physical unit resolution authoritatively destroys a unit, emit exactly one destruction fact for that unit occurrence:

```ts
UNIT_DESTROYED {
  unit: UnitEventSubject;
  causes: readonly {
    kind: "UNIT_ATTACK";
    attackEventId: string;
    attacker: UnitEventSubject;
  }[];
}
```

`attackEventId` references the causal `UNIT_ATTACK_RESOLVED` fact. `causes` preserves **every authoritative admitted attack that causally contributes to that same physical destruction result** under the focused combat owner's simultaneous-resolution semantics.

A destruction fact has no universal `killer`, `winner`, or reward owner. Those concepts are consumer policy unless a focused domain explicitly owns such a fact.

For deterministic representation, unit-attack destruction causes are ordered by:

```text
attacker.unitId ascending
then attackEventId ascending
```

This order exists only for deterministic serialization/replay and stable comparison. Array position does not mean first hit, last hit, primary cause, or reward credit. Same-tick simultaneous attacks remain simultaneous.

### 5.3 `CELL_OWNERSHIP_CHANGED`

When an authoritative producer changes the political owner of a simulation cell, it emits exactly one fact for that changed cell:

```ts
CELL_OWNERSHIP_CHANGED {
  cellId: CellId;
  previousOwnerId: FactionId | null;
  nextOwnerId: FactionId | null;
}
```

`previousOwnerId` and `nextOwnerId` must be distinct. `null` means politically neutral. The event reports only the ownership transition that already resolved; it does not decide downstream persistent-structure disposition, economic rewards, Population consequences, or other consumer policy.

When one producer phase changes multiple cells, its `CELL_OWNERSHIP_CHANGED` batch is ordered by `cellId` ascending and contains exactly one fact per changed cell. The producer owns deterministic event identity under the common envelope; consumers must continue to treat the identity string as opaque.

The fact is an in-tick delivery value rather than persistent `MatchState` residual state. Downstream consumers receive it after the producer-owned ownership state has been committed and may query that current authoritative state for facts they own. A consumer that applies one-time consequences must reject duplicate changed-cell facts within the same delivered batch rather than silently applying the same occurrence twice.

### 5.4 `PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED`

When a subsystem-owned persistent directed-hostility source that was active for one resolved hostility-side pair ceases to be active because of that subsystem's authoritative lifecycle transition, that producer emits:

```ts
PERSISTENT_DIRECTED_HOSTILITY_SOURCE_ENDED {
  sourceSide: HostilitySideIdentity;
  targetSide: HostilitySideIdentity;
}
```

`sourceSide` and `targetSide` are immutable lifecycle-safe snapshots of the directed sides for that source immediately before it ended. They remain directed even though game-wide `atWar` is symmetric. They must be distinct.

This event reports only source termination. It does **not** contain or decide `atWar`, grace expiry, current active-source counts, operation bodies, Population, rewards, attribution, or any other Hostility-consumer policy. The Hostility owner may query current authoritative faction/source state after producer mutation to determine whether the affected unordered pair still has another active persistent source and what consequence follows.

A producer must snapshot any identity needed after its owned record/reference disappears. In particular, a persistent source whose opposing side is resolved through another lifecycle record must capture that side before the reference can be removed or invalidated.

Within one producer transition, every ended persistent source emits exactly one fact. A stable source that remains active for the same directed side pair emits none; retargeting/replacement that ends the old directed source emits the old source fact even when an implementation reuses a stable local source identifier. Event IDs remain deterministic, producer-owned, unique, and opaque; ordering of a multi-source ended batch must be deterministic.

### 5.5 `FACTION_CAPITULATED`

When an authoritative faction-lifecycle producer commits the concrete `ACTIVE -> CAPITULATED` transition, it emits:

```ts
FACTION_CAPITULATED {
  factionId: FactionId;
}
```

The payload contains only the faction identity whose transition occurred. Immutable fixed-team/hostility-side identity remains ordinary current authoritative faction state and is not duplicated into this fact. A no-op application to a faction that is already capitulated emits no event.

The event does not decide whether a hostility side still has another active member, which war relations remain live, or whether any grace state starts or is cleared. Those are Hostility-owned consequences derived from this occurrence plus current authoritative state.

A dedicated `PERSISTENT_DIRECTED_HOSTILITY_SOURCE_STARTED` fact is not required merely to mirror this termination fact. Presence of active persistent sources is current authoritative state and remains an ordinary direct query unless a separate cross-system consequence later proves that a start occurrence itself must cross an ownership boundary.

---

## 6. Consumer attribution and policy

Consumers derive domain-specific consequences from the factual event batch and their own authoritative state.

A consumer may select one causal participant, count all participants, create several consequences, or create none, according to that consumer's canonical rules. Such attribution must not be promoted into a generic physical event merely because one current consumer needs it.

Therefore:

```text
physical occurrence
    -> physical event with complete authoritative causes
    -> deterministic consumer-specific attribution/policy
    -> consumer-owned state/consequence
```

This separation allows additional consumers such as economy, statistics, diplomacy, lawful controller observation, replay/diagnostics, or future Origin mechanics to consume the same occurrence without changing the producing combat subsystem or fabricating a universal attribution rule.

---

## 7. Extension rule

New cross-system event kinds must follow the same ownership discipline:

1. identify the subsystem that authoritatively decides the occurrence;
2. emit a past-tense fact only after that occurrence is legally resolved;
3. include stable lifecycle-safe context needed to understand the fact after producer-owned cleanup;
4. keep downstream rewards/policy/state out of the producer event;
5. define deterministic ordering whenever one event contains a set/list of causes or subjects;
6. route consumers explicitly through deterministic phase ordering;
7. do not create a parallel incompatible event family for a new subsystem.

When a new use case proves that the shared envelope or causal model requires generalization, extend this owner and the executable shared event vocabulary coherently rather than defining a subsystem-local substitute.
