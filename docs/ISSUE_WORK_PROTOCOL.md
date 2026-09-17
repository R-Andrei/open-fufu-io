# Issue work specification and certification protocol

## Status and authority

This document is the canonical owner for repository-wide substantive issue-work specification/readiness, implementation-GREEN lifecycle semantics, adversarial certification, requirement-level completion evidence, and issue-work evidence reuse.

It does not own claim/branch/PR mutation or current-main merge procedure (`REPOSITORY_OWNERSHIP_PROTOCOL.md`), the repository-wide RED-first invariant (`../AGENTS.md`), canonical-document/configuration authority (`DOCUMENTATION_AUTHORITY_POLICY.md`), executable validation scope/adoption (`VALIDATION_POLICY.md`), or Game/Origin/Character-AI coupled audit (`official-ai/README.md`). Subsystem semantics remain with canonical owners registered in [`README.md`](./README.md).

This protocol adds gates around those independent rules; it does not weaken or replace them.

## Read cadence

Read this protocol before creating/materially reframing substantive acceptance-bearing work, beginning implementation, reporting implementation GREEN, beginning certification, or reporting certified/merge-ready/completed status.

A read remains valid through a contiguous unchanged work state. Re-read when specification, scope, canonical authority, relevant base state, or lifecycle phase materially changes. Certification still requires the independent reset below.

## Applicability

The full lifecycle applies to **substantive issue-attributable work**: work changing executable behavior, public/canonical contracts, repository policy or architecture, validation ownership, or other acceptance-bearing repository state.

Purely mechanical edits with no semantic, behavioral, authority, or acceptance effect are exempt. An issue containing substantive work is not exempt because some individual edits are mechanical. Resolve unclear applicability rather than silently bypassing the lifecycle.

## Lifecycle

Use semantic states equivalent to:

```text
DRAFT / NEEDS SPECIFICATION
    -> IMPLEMENTATION READY
    -> IMPLEMENTATION IN PROGRESS
    -> IMPLEMENTATION GREEN
    -> CERTIFICATION IN PROGRESS
    -> CERTIFIED
    -> MERGE READY
    -> MERGED / COMPLETED
```

Critical invariant:

```text
IMPLEMENTATION GREEN != CERTIFIED != COMPLETED
```

Passing implementation validation establishes at most `IMPLEMENTATION GREEN`. Before certification succeeds, MUST NOT describe work as complete, done, acceptance-satisfied, certified, merge-ready, or ready to close. Use `Implementation GREEN; certification pending` or equivalent.

## Issue authoring / material reframing gate

Before creating or materially rewriting acceptance-bearing work that proposes repository behavior, policy, architecture, mechanics, configuration, or canonical changes:

1. identify/read relevant canonical owners;
2. distinguish current established truth from the proposed change;
3. expose unresolved semantics/assumptions instead of presenting them as facts;
4. record explicit non-goals, dependencies, and neighboring ownership when relevant.

Issue prose may request a canonical change but does not silently become authority. If implementation requires an unestablished semantic choice, obtain human/canonical resolution first.

## Phase 1 — specification, inventory, and proof planning

Before production implementation, read the entire issue, relevant canonical owners/public contracts, required validation policy, and every other protocol triggered by planned scope.

Establish, where applicable:

- exact intended behavior, acceptance criteria, limits, ordering, fallbacks, failure/partial-failure behavior, persistence, lifecycle, concurrency/reentrancy, trust/process/serialization boundaries, and non-goals;
- dependencies/blockers and cross-system interaction surfaces;
- proof required for each obligation;
- every candidate assumption or unestablished truth.

### Impact inventory

Before production edits to an existing contract, migration, refactor, or shared surface, inventory all known affected surfaces. Search exported/public APIs plus relevant callers, constructors, object literals, fixtures, mocks, helpers, worker/isolate copies, transports/IPC, serialization, persistence, documentation, and validation.

Treat the inventory as a work queue. Group related findings by coherent subsystem/contract boundary before implementation. Do not use repeated broad CI failures as the primary caller-discovery mechanism.

### Proof obligations and assumptions

Before production implementation, maintain requirement-level work evidence recording each obligation's authority, guarantee class, intended implementation boundary, positive proof, adversarial/boundary proof, cross-system proof where relevant, and status.

Use statuses equivalent to `READY TO PROVE`, `AMBIGUOUS — BLOCKED`, and `OUT OF SCOPE — CANONICALLY OWNED ELSEWHERE`.

Record assumptions/unknowns with their establishing source and status. Any implementation-relevant unestablished semantic assumption blocks `IMPLEMENTATION READY`.

Specification may proceed only when implementation-relevant obligations are ready to prove or canonically out of scope and required semantic assumptions are established.

## Phase 2 — implementation

Implementation follows every triggered repository rule/protocol, including ownership, RED-first behavior changes, canonical authority, validation ownership, current-main reconciliation, and coupled Game/Origin/Character-AI review where applicable.

### Coherent RED/GREEN unit

For mechanically testable work, establish the planned focused RED coverage for a coherent proof obligation before changing its production implementation. Multiple related REDs MAY be batched. RED-first does not require a separate RED/GREEN cycle for every field, caller, fixture, or audit hit.

After the RED coverage fails for the intended reason, implement the smallest **coherent** GREEN slice: enough related production and caller/fixture updates to satisfy that proof obligation without unrelated scope.

Before broad validation, re-search the affected inventory group and update known callers/fixtures rather than waiting for full CI to enumerate obvious stale uses.

### Validation ladder

Use the cheapest evidence sufficient for the current decision, subject to [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md):

```text
focused RED
-> focused slice tests
-> relevant domain/owned validation
-> broad owned validation at a coherent checkpoint
```

Run broad owned validation when the coherent slice is believed GREEN, at an implementation-GREEN candidate, when certification requires it, or when focused evidence is insufficient. Do not rerun broad validation after every microscopic edit merely for certainty.

If implementation exposes a new ambiguity, update work-state evidence and return to the specification gate.

After required implementation validation passes, the strongest status is `IMPLEMENTATION GREEN`. This is a handoff into certification, not completion evidence.

## Phase 3 — adversarial certification

Certification begins only after implementation GREEN. Implementation work stops except when certification finds a defect that must re-enter the RED-first implementation gate.

The certifier's objective is to try to prove the work wrong, incomplete, mis-scoped, under-tested, or assumption-dependent.

### Mandatory role reset

Before deriving certification obligations:

1. freshly read current `AGENTS.md`, this protocol, the entire current issue, relevant canonical owners/public contracts, and other triggered protocols;
2. do not use the implementer's completion summary, earlier proof matrix, or remembered interpretation as authority;
3. treat implementation and tests as claims to challenge, not proof by default.

An independent agent/context SHOULD certify when available. Otherwise the same agent must reset and independently derive requirements from source authority before consulting implementation evidence.

### Independent proof reconstruction

The certifier MUST independently reconstruct requirement/proof obligations from the issue and canonical authorities, then compare them with implementation evidence.

Certification statuses are strict: `PROVEN`, `NOT PROVEN`, `AMBIGUOUS`, or `OUT OF SCOPE — CANONICALLY OWNED ELSEWHERE`.

`Likely`, `seems covered`, `probably`, indirect coverage, aggregate suite success, or equivalent do not qualify as `PROVEN`. Any implementation-relevant `NOT PROVEN` or `AMBIGUOUS` obligation blocks certification, merge readiness, and closure.

## Guarantee classes and literal proof

Apply every relevant proof class; do not manufacture irrelevant tests merely to satisfy a checklist.

### Exact-value / numeric-boundary guarantees

Exact limits, maxima/minima, counts, capacities, sizes, and timing bounds require literal boundary evidence. Where applicable, prove `limit - 1`, `limit`, and `limit + 1`. For byte limits, distinguish encoded bytes from characters and include multi-byte/Unicode representations where relevant.

### Universal / exclusionary guarantees

Words such as `all`, `every`, `never`, `none`, `only`, `cannot`, and `no access` describe properties, not one known mechanism. Challenge alternative mechanisms/capabilities that could violate the property.

### Atomicity / transaction guarantees

Where applicable, challenge failure before/after mutation, rollback/commit behavior, promised snapshot/prestate, asynchronous interleaving, reentrancy, concurrent external mutation, and interactions among independently valid operations.

### Determinism guarantees

Where applicable, challenge insertion/enumeration order, async completion order, scheduling, ties, locale/default comparators, randomized enumeration, repeated runs, and nondeterministic runtime facilities.

### Isolation / security guarantees

Use capability and end-to-end data-flow analysis, not blacklist-only reasoning. Identify what the less-trusted side can cause across the protected boundary and where each guarantee first becomes mechanically enforced.

### Lifecycle guarantees

Inspect relevant valid/invalid transitions including initialization, active operation, faults, recovery/recycling, restart, and shutdown/cleanup where present.

## Mandatory adversarial-category applicability review

Explicitly disposition relevant failure classes as `APPLICABLE` or `NOT APPLICABLE — <reason>` across:

- type/shape: nullish/wrong primitives or containers, malformed/missing/extra fields, duplicates, sparse/cyclic structures, getters/proxies/prototype effects;
- value/boundary: huge inputs, numeric extrema, `-1/exact/+1`, `NaN`/infinities/negative zero, Unicode/multi-byte size behavior;
- execution/order: async/delayed completion, reentrancy, concurrency, lifecycle races, order dependence, stale state;
- process/resource: process death, malformed/partial IPC, timeout bypass, resource exhaustion, restart/recovery, shutdown/cleanup;
- composition: omitted optional values and cross-system combinations where independently valid A+B may be wrong.

The purpose is conscious coverage of failure classes, not irrelevant test manufacture.

## Mandatory threat-model pass

Issues involving untrusted code, IPC, serialization, authentication, visibility, persistence, filesystem/network access, concurrency, process isolation, or similar trust boundaries require end-to-end threat/data-flow analysis.

For each boundary, determine what the less-trusted side can make the trusted side allocate, deserialize, execute, wait for, mutate, persist, reveal, resolve, retry, or assume. Trace the flow from least-trusted source through parsing/copying, validation, serialization/IPC, trusted processing, domain validation, and authoritative mutation/persistence as applicable.

For every resource/security guarantee, identify the **first mechanical enforcement boundary**. Rejecting a value after it already crossed or consumed protected resources does not prove the earlier guarantee.

## Existing implementation tests are not sole certification evidence

Implementation-authored tests are necessary evidence when applicable but cannot be the sole certification basis because they were selected under the implementer's interpretation.

Certification MUST actively search for missed requirements, guarantee classes, boundaries, and interactions. It may add focused certification tests.

When certification finds mechanically testable related defects or uncovered requirements:

```text
finish the affected audit pass
-> group findings
-> establish focused RED coverage
-> coherent GREEN correction
-> relevant owned validation
-> repeat affected certification rows
```

Do not serialize each audit hit into an isolated RED/GREEN cycle unless it is genuinely independent. Non-testable documentation/process defects still require correction plus renewed direct evidence for affected obligations.

## Cross-system interaction audit

Identify materially touched neighboring systems and challenge critical interactions. Two subsystems being individually correct is not proof their composition is correct.

Where relevant, inspect concurrency + authoritative mutation, persistence + malformed/failing output, timeout + serialization/copying, resource limits + process boundaries, lifecycle + recovery, visibility + derived APIs, Spawn/pre-match + runtime, and mechanics + Origins + Character AI.

When the coupled Game/Origin/Character-AI audit is triggered, its statuses/evidence remain independently mandatory under [`official-ai/README.md`](./official-ai/README.md).

## Evidence reuse and stopping rule

Reuse valid current evidence. Repeat review/validation only after relevant content/base changes, failure, incompleteness, a distinct required check, or when existing evidence cannot support the next decision.

Do not add diagnostics, workflows, helpers, rereads, or repeated broad checks merely for extra certainty. Batch related proof work at coherent checkpoints. Stop once the next required decision is supported.

The final merge/cleanup sequence is owned by `REPOSITORY_OWNERSHIP_PROTOCOL.md`.

## Certification coverage and completion gate

Final completion evidence MUST be requirement-level, not only aggregate test counts. For each obligation, record authority, implementation, positive proof, adversarial/boundary proof, and status.

The final certification record MUST also state remaining ambiguity/assumptions; adversarial applicability; threat-model and cross-system results where applicable; canonical owners consulted/modified; relevant cross-owner review; executable validation evidence; current-main reconciliation/final SHA; stale/duplicate authority search; and Game/Origin/Character-AI audit status when triggered.

A row is `PROVEN` only with direct evidence sufficient for its guarantee class. Any implementation-relevant `NOT PROVEN` or `AMBIGUOUS` row blocks `CERTIFIED`.

After assembling certification evidence, recheck current `main` and triggered completion/merge rules. Material semantic changes, relevant base overlap, or corrective edits invalidate affected evidence and require those obligations to be repeated.

Only after every applicable obligation is `PROVEN`, blocking ambiguity/assumptions are absent, repository gates pass, and current-main reconciliation is current may work be described as `CERTIFIED` and then `MERGE READY`.

## Subordinate workflow surfaces

Issue comments, working matrices, PR descriptions, and `.github/PULL_REQUEST_TEMPLATE.md` are coordination/evidence surfaces. They may record status and link to this protocol but are not duplicate process authority.

Optional agent skills/wrappers may assist with phases, but repository-owned rules and canonical protocols remain authoritative.
