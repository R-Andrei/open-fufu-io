# Issue work specification and certification protocol

## Status and authority

This document is the canonical owner for repository-wide substantive issue-work specification/readiness, implementation-GREEN lifecycle semantics, adversarial certification, requirement-level completion evidence, and issue-work evidence reuse.

It does not own claim/branch/PR mutation or current-main merge procedure (`REPOSITORY_OWNERSHIP_PROTOCOL.md`), the repository-wide RED-first invariant (`../AGENTS.md`), canonical-document/configuration authority (`DOCUMENTATION_AUTHORITY_POLICY.md`), executable validation scope/adoption (`VALIDATION_POLICY.md`), or the Game/Origin/Character-AI coupled audit (`official-ai/README.md`). Subsystem semantics remain with the canonical owners registered in [`README.md`](./README.md).

This protocol adds gates around those independent rules; it does not weaken or replace them.

## Read this freshly before

Freshly read this document before:

- creating or materially reframing a substantive acceptance-bearing issue;
- beginning substantive implementation;
- reporting implementation GREEN;
- beginning or repeating adversarial certification;
- reporting work as certified, merge-ready, completed, or ready to close.

A prior read earlier in the task does not satisfy a later fresh-read gate required by `AGENTS.md`.

## Applicability

The full lifecycle applies to **substantive issue-attributable work**: work that changes executable behavior, public/canonical contracts, repository policy or architecture, validation ownership, or other acceptance-bearing repository state.

Purely mechanical edits with no semantic, behavioral, authority, or acceptance effect are exempt. An issue containing substantive acceptance-bearing work is not exempt merely because some individual edits are mechanical.

When applicability is unclear, treat that uncertainty as an assumption/unknown and resolve it rather than silently bypassing the lifecycle.

## Lifecycle

Use semantic states equivalent to:

```text
DRAFT / NEEDS SPECIFICATION
    -> SPECIFICATION AUDITED
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

Passing implementation validation is necessary evidence but establishes only `IMPLEMENTATION GREEN`. Before certification succeeds, work MUST NOT be described as complete, done, acceptance-satisfied, certified, merge-ready, or ready to close. Use `Implementation GREEN; certification pending` or equivalent.

## Issue authoring / material reframing gate

Before creating or materially rewriting an acceptance-bearing issue that proposes repository behavior, policy, architecture, mechanics, configuration, or canonical changes:

1. read `README.md` when canonical concerns are involved;
2. identify and read the relevant canonical owners;
3. distinguish **current established truth** from the **proposed change**;
4. expose unresolved semantics/assumptions instead of writing them as established facts;
5. record explicit non-goals, dependencies, and neighboring ownership when relevant.

An issue may request a change to canonical truth, but issue prose does not silently become authority. If the requested implementation requires an unestablished semantic choice, frame it as unresolved and obtain human/canonical resolution before implementation.

## Phase 1 — specification audit / issue framing

Before production implementation begins, freshly read:

1. all current `AGENTS.md`;
2. this protocol;
3. the entire issue, including acceptance criteria, non-goals, dependencies, coordination, and human clarifications;
4. [`README.md`](./README.md) when canonical concerns are involved;
5. every relevant canonical owner and affected public contract from the current target base;
6. [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md) when executable validation/adoption is relevant;
7. every other protocol triggered by the planned scope.

The specification audit determines what must be true and how that truth can be demonstrated. Establish, where applicable:

- exact canonical owner(s);
- exact intended behavior and every acceptance criterion;
- numeric, byte, count, timing, and capacity limits;
- ordering, tie, precedence, and fallback behavior;
- failure and partial-failure behavior;
- persistence/memory behavior;
- lifecycle transitions;
- concurrency, asynchronous, and reentrancy interactions;
- trust, process, serialization, security, filesystem/network, and other boundary semantics;
- explicit non-goals and neighboring issue ownership;
- dependencies/blockers;
- cross-system interaction surfaces;
- proof required for each obligation;
- every candidate assumption or currently unestablished truth.

### Initial proof-obligation matrix

Before production implementation, create an issue/working proof matrix covering every identified requirement. A useful minimum shape is:

| ID | Requirement | Canonical authority | Guarantee class | Intended implementation boundary | Positive proof | Negative/adversarial proof | Cross-system/boundary proof | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Initial statuses:

- `READY TO PROVE`
- `AMBIGUOUS — BLOCKED`
- `OUT OF SCOPE — CANONICALLY OWNED ELSEWHERE`

The matrix is work-state evidence, not a canonical mechanics owner. Issue acceptance may define the requested obligation, but existing subsystem facts must still come from canonical owners.

### Assumption / unknown register

Maintain an explicit register:

| Candidate assumption | Source establishing truth | Status |
| --- | --- | --- |
| Example semantic premise | canonical source or human clarification | `ESTABLISHED` |
| Example unresolved premise | no authority found | `UNESTABLISHED` |

Any `UNESTABLISHED` semantic assumption that implementation would need to encode blocks `IMPLEMENTATION READY`. Apply the root `Never assume` rule rather than choosing silently.

Specification may proceed only when all implementation-relevant obligations are `READY TO PROVE` or canonically out of scope and no required semantic assumption remains unestablished.

## Phase 2 — implementation

Implementation follows every triggered repository rule/protocol, including ownership, RED-first behavior changes, canonical authority, validation ownership, current-main reconciliation, and coupled Game/Origin/Character-AI review where applicable.

For mechanically testable behavior changes, use the RED-first gate owned by `AGENTS.md`.

Do not treat the proof matrix as permission to weaken an existing rule or encode an assumption. If implementation exposes a new ambiguity, update work-state evidence and return to the specification gate.

After implementation validation passes, the strongest status is:

```text
IMPLEMENTATION GREEN
```

Implementation GREEN is a handoff into certification, not completion evidence.

## Phase 3 — adversarial certification

Certification begins only after implementation GREEN. Implementation work stops except when certification finds a defect that must re-enter the RED-first implementation gate.

The certifier's objective is to try to prove the work wrong, incomplete, mis-scoped, under-tested, or assumption-dependent.

### Mandatory role reset

Before deriving certification obligations:

1. freshly read all current `AGENTS.md`;
2. freshly read this protocol;
3. freshly read the entire current issue, including acceptance, non-goals, coordination, and human clarifications;
4. freshly identify and read every relevant canonical owner/public contract from the current target base;
5. freshly read every other protocol triggered by the implemented scope;
6. do not use the implementer's completion summary, earlier proof matrix, or remembered interpretation as authority;
7. treat implementation and tests as claims to challenge, not proof by default.

An independent agent/context SHOULD certify when available. Lack of a separate agent does not remove the gate: the same agent must reset and independently derive requirements from source authority before consulting the implementation matrix.

### Independent proof reconstruction

The certifier MUST independently reconstruct a requirement/proof matrix from the issue and canonical authorities. Only afterward compare it with the implementation-phase matrix.

Certification statuses are strict:

- `PROVEN`
- `NOT PROVEN`
- `AMBIGUOUS`
- `OUT OF SCOPE — CANONICALLY OWNED ELSEWHERE`

`Likely`, `seems covered`, `probably`, `indirectly tested`, aggregate suite success, or equivalent do not qualify as `PROVEN`.

Any implementation-relevant `NOT PROVEN` or `AMBIGUOUS` obligation blocks certification, merge readiness, and closure.

## Guarantee classes and literal proof

Apply every relevant proof class; do not manufacture irrelevant tests merely to satisfy a checklist.

### Exact-value / numeric-boundary guarantees

Exact limits, maxima/minima, counts, capacities, sizes, and timing bounds require literal boundary evidence. Where applicable, prove:

```text
limit - 1
limit
limit + 1
```

For byte limits, distinguish encoded bytes from character counts and include multi-byte/Unicode representations where relevant.

### Universal / exclusionary guarantees

Words such as `all`, `every`, `never`, `none`, `only`, `cannot`, and `no access` describe properties, not one known mechanism.

Challenge alternative mechanisms/capabilities that could violate the property. Proving one obvious path unavailable is not proof of a universal exclusion.

### Atomicity / transaction guarantees

Where applicable, challenge:

- failure before first mutation;
- failure after a candidate partial mutation;
- rollback/commit behavior;
- validation against the promised snapshot/prestate;
- asynchronous interleaving;
- reentrancy;
- concurrent external mutation;
- multiple independently valid operations interacting.

### Determinism guarantees

Where applicable, challenge:

- insertion/enumeration order;
- async completion order;
- process scheduling;
- equal/tied values;
- locale/default comparator behavior;
- randomized input enumeration;
- repeated runs;
- nondeterministic runtime facilities.

### Isolation / security guarantees

Use capability and end-to-end data-flow analysis, not blacklist-only reasoning. Identify what the less-trusted side can cause across the protected boundary and where each guarantee first becomes mechanically enforced.

### Lifecycle guarantees

Inspect all relevant valid and invalid state transitions, including initialization, active operation, fault paths, recovery/recycling, restart, and shutdown/cleanup where present.

## Mandatory adversarial-category applicability review

Explicitly disposition each category as `APPLICABLE` or `NOT APPLICABLE — <reason>`:

- `null` / `undefined`;
- wrong primitive types;
- wrong object/container types;
- malformed nested structures;
- missing required fields;
- unexpected/extra fields;
- duplicate values/keys;
- sparse arrays;
- cyclic structures;
- getters/accessors/proxies or other execution-during-serialization paths;
- prototype/primordial manipulation;
- huge strings/arrays/objects;
- numeric minimum/maximum;
- boundary `-1 / exact / +1`;
- `NaN`, infinities, and negative zero where numeric data is involved;
- Unicode / multi-byte byte-size behavior;
- asynchronous completion order;
- delayed completion;
- reentrancy;
- concurrent external mutation;
- lifecycle transition races;
- process death;
- malformed/partial IPC;
- timeout bypasses;
- resource exhaustion;
- restart/recovery;
- shutdown/cleanup;
- order dependence;
- stale state;
- omitted optional values;
- cross-system combinations where A and B are independently valid but A+B may be wrong.

The purpose is conscious coverage of failure classes, not irrelevant test manufacture.

## Mandatory threat-model pass

Any issue involving untrusted code, IPC, serialization, authentication, visibility, persistence, filesystem/network access, concurrency, process isolation, or a similar trust boundary requires explicit end-to-end threat/data-flow analysis.

For each boundary, ask what the less-trusted side can make the more-trusted side:

- allocate;
- deserialize;
- execute;
- wait for;
- mutate;
- persist;
- reveal;
- resolve;
- retry;
- assume.

Trace the actual flow from the least-trusted source through first parsing/copying, validation, serialization/IPC, trusted processing, domain validation, and authoritative mutation/persistence as applicable.

For every resource/security guarantee, identify the **first mechanical enforcement boundary**. Rejecting a value after it already crossed or consumed resources across a protected boundary does not prove the earlier guarantee.

## Existing implementation tests are not sole certification evidence

Implementation-authored tests are necessary evidence when applicable but cannot be the sole certification basis because they were selected under the implementer's interpretation.

Certification MUST actively search for requirements, guarantee classes, boundary conditions, and interactions the implementation pass did not exercise. It may add focused certification tests.

When certification discovers a mechanically testable behavior defect or uncovered requirement:

```text
certification finding
    -> focused RED reproducing the hole
    -> smallest GREEN correction
    -> relevant broader owned validation
    -> repeat affected certification rows
```

A non-testable documentation/process defect still requires correction plus renewed direct evidence for every affected row.

## Cross-system interaction audit

Identify materially touched neighboring systems and challenge critical pairwise interactions. Two subsystems being individually correct is not proof their composition is correct.

Where relevant, inspect combinations such as:

- concurrency + authoritative mutation;
- persistence + malformed/failing output;
- timeout + serialization/copying;
- resource limits + process boundaries;
- lifecycle + recovery;
- visibility + convenience/derived APIs;
- Spawn/pre-match + normal runtime;
- mechanics + Origins + Character AI.

When the coupled Game/Origin/Character-AI audit is triggered, its statuses/evidence remain independently mandatory under [`official-ai/README.md`](./official-ai/README.md).

## Evidence reuse and stopping rule

Reuse valid current evidence. Repeat review/validation only after relevant content/base changes, failure, incompleteness, or a distinct required check.

Do not add diagnostics, workflows, helpers, or repeated checks merely for extra certainty when no gate failed and no material overlap/new obligation appeared.

Stop once the next required decision is supported. The final merge/cleanup sequence is owned by `REPOSITORY_OWNERSHIP_PROTOCOL.md`.

## Certification coverage ledger and completion gate

Final completion evidence MUST be requirement-level, not only aggregate test counts.

Minimum ledger shape:

| Requirement | Authority | Implementation | Positive proof | Adversarial/boundary proof | Status |
| --- | --- | --- | --- | --- | --- |

The final certification record MUST also state:

- remaining ambiguity: `None` or explicit blocking items;
- remaining assumptions: `None` or explicit blocking items;
- adversarial categories considered and each applicability disposition;
- threat-model result when applicable;
- cross-system interaction result;
- canonical owners consulted;
- owners modified;
- relevant cross-owner references reviewed;
- executable validation evidence under [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md), where applicable;
- current-main reconciliation status and final current-main SHA under `REPOSITORY_OWNERSHIP_PROTOCOL.md`;
- stale/duplicate authority search result under `DOCUMENTATION_AUTHORITY_POLICY.md`;
- Game/Origin/Character-AI audit statuses under `official-ai/README.md` when triggered.

A row is `PROVEN` only with direct evidence sufficient for its guarantee class. Any implementation-relevant `NOT PROVEN` or `AMBIGUOUS` row blocks `CERTIFIED`.

After certification evidence is assembled, recheck current `main` and all triggered completion/merge rules. Material semantic changes, relevant base overlap, or corrective edits invalidate affected certification evidence and require those rows to be repeated.

Only after every applicable obligation is `PROVEN`, blocking ambiguity/assumptions are absent, existing repository gates pass, and current-main reconciliation is current may work be described as `CERTIFIED` and then `MERGE READY`.

## Subordinate workflow surfaces

Issue comments, working matrices, PR descriptions, and `.github/PULL_REQUEST_TEMPLATE.md` are coordination/evidence surfaces. They may record status and link to this protocol but are not duplicate process authority.

Optional agent skills/wrappers may assist with the phases, but repository-owned rules and canonical protocols remain authoritative.
