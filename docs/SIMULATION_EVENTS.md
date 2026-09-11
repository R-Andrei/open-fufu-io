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

The first concrete event vocabulary covers the shared physical-combat seam and cell-level political-ownership transitions that have downstream consumers.

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

### 5.3 `RADIOACTIVE_ATTACK_AFTERSHOCK_RESOLVED`

When a focused combat owner resolves an attack-triggered radioactive aftershock whose physical consequence belongs to the territorial/Fallout subsystem, it emits:

```ts
RADIOACTIVE_ATTACK_AFTERSHOCK_RESOLVED {
  attacker: UnitEventSubject;
  targetCellId: number;
  affectedCellIds: readonly number[];
}
```

The combat owner resolves the aftershock's legality, trigger, footprint, eligibility, cap, and canonical affected-cell ordering from its authoritative combat snapshot before emitting the fact. Those mechanics remain with the focused gameplay/Origin owners and are not restated here.

`affectedCellIds` is therefore the already-resolved authoritative footprint for this occurrence. A downstream territorial/Fallout consumer applies that exact set and **must not** reselect cells or re-evaluate combat-side eligibility against later state.

The event may contain an empty `affectedCellIds` set when the focused combat rule resolves a qualifying occurrence with no eligible territorial cells. It records the resolved occurrence rather than inventing a second suppression rule at the event boundary.

The payload does not carry ownership snapshots, Fallout snapshots, capture results, Population accounting, structure-capture consequences, or other consumer-owned state. Applying the territorial consequence is not a capture operation merely because political ownership changes.

### 5.4 `CELL_OWNERSHIP_CHANGED`

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
