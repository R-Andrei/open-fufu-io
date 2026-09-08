# Issue work specification and certification protocol

## Status and authority

This document is the **canonical owner for repository-wide substantive issue-work specification/readiness, implementation-GREEN lifecycle semantics, adversarial certification, and requirement-level completion evidence**.

It does not own claim/branch/PR mutation rules, RED-first implementation rules, canonical-document ownership policy, current-main reconciliation, or the Game/Origin/Character-AI coupled audit; those remain owned by [`../AGENTS.md`](../AGENTS.md). It does not own executable validation scope/test adoption; that remains owned by [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md). It does not own gameplay, Origin, Character-AI, architecture, API, or subsystem semantics; those remain with the canonical owners registered in [`README.md`](./README.md).

This protocol adds gates around those existing rules. It does not weaken or replace them.

## Applicability

The full lifecycle applies to **substantive issue-attributable work**: work that changes executable behavior, public/canonical contracts, repository policy or architecture, validation ownership, or other acceptance-bearing repository state.

Purely mechanical edits with no semantic, behavioral, authority, or acceptance effect are exempt. An issue containing substantive acceptance-bearing work is not made exempt merely because some individual edits are mechanical.

When applicability is unclear, treat that uncertainty as an assumption/unknown and resolve it before implementation rather than silently bypassing the lifecycle.

## Lifecycle

Use the following semantic states for substantive issue work; labels are optional:

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

Passing implementation validation is necessary evidence, but it establishes only `IMPLEMENTATION GREEN`. Before certification succeeds, work must not be described as complete, done, acceptance-satisfied, certified, merge-ready, or ready to close. Use `Implementation GREEN; certification pending` or equivalent.

## Phase 1 — specification audit / issue framing

Before production implementation begins, freshly read:

1. all current `AGENTS.md`;
2. the entire issue, including acceptance criteria, non-goals, dependencies, coordination, and human clarifications;
3. [`README.md`](./README.md) when canonical concerns are involved;
4. every relevant canonical owner and affected public contract from the current target base;
5. [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md) when executable validation/adoption is relevant.

The specification audit is a framing/proof task, not an implementation pass. It must determine what must be true and how that truth can be demonstrated.

Establish, where applicable:

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
- the proof required for each obligation;
- every candidate assumption or currently unestablished truth.

### Initial proof-obligation matrix

Before production implementation, create an issue/working proof matrix covering every identified requirement. A useful minimum shape is:

| ID | Requirement | Canonical authority | Guarantee class | Intended implementation boundary | Positive proof | Negative/adversarial proof | Cross-system/boundary proof | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Initial statuses:

- `READY TO PROVE`
- `AMBIGUOUS — BLOCKED`
- `OUT OF SCOPE — CANONICALLY OWNED ELSEWHERE`

The matrix is work-state evidence, not a canonical mechanics owner. Issue acceptance may define the requested obligation, but existing canonical subsystem facts must still be derived from their canonical owners.

### Assumption / unknown register

Maintain an explicit register:

| Candidate assumption | Source establishing truth | Status |
| --- | --- | --- |
| Example semantic premise | canonical source or human clarification | `ESTABLISHED` |
| Example unresolved premise | no authority found | `UNESTABLISHED` |

Any `UNESTABLISHED` semantic assumption that implementation would need to encode blocks `IMPLEMENTATION READY`. Apply the repository `Never assume` rule; obtain human/canonical resolution instead of choosing silently.

Specification may proceed only when all implementation-relevant obligations are either `READY TO PROVE` or canonically out of scope, and no required semantic assumption remains unestablished.

## Phase 2 — implementation

Implementation follows all existing repository rules, including claim/ownership, RED-first behavior changes, canonical-authority ownership, validation-boundary ownership, current-main reconciliation, and Game/Origin/Character-AI coupled review where triggered.

For mechanically testable behavior changes:

```text
focused RED
    -> smallest GREEN correction
    -> relevant broader owned validation
```

Do not reinterpret the proof matrix as permission to weaken an existing rule or encode an assumption. If implementation discovers a new ambiguity, update the work-state evidence and return to the specification gate.

After implementation validation passes, the status is only:

```text
IMPLEMENTATION GREEN
```

Implementation GREEN is a handoff into certification, not completion evidence.

## Phase 3 — adversarial certification

Certification begins only after implementation GREEN. Implementation work stops except when certification itself discovers a defect that re-enters RED -> GREEN.

The certifier's objective is to try to prove the finished work wrong, incomplete, mis-scoped, under-tested, or assumption-dependent.

### Mandatory role reset

Before deriving certification obligations:

1. freshly read all current `AGENTS.md`;
2. freshly read the entire current issue, including acceptance, non-goals, coordination, and human clarifications;
3. freshly identify and read every relevant canonical owner/public contract from the current target base;
4. do not use the implementer's completion summary, earlier proof matrix, or remembered interpretation as authority;
5. treat existing implementation and tests as claims to challenge, not proof by default.

An independent agent/context SHOULD perform certification when available. Lack of a separate agent does not remove the gate: the same agent must be able to perform an independent derivation by resetting and reconstructing from source authority before consulting the implementation matrix.

### Independent proof reconstruction

The certifier must independently reconstruct a requirement/proof matrix from the issue and canonical authorities. Only after that reconstruction is complete should it be compared with the implementation-phase matrix.

Certification statuses are strict:

- `PROVEN`
- `NOT PROVEN`
- `AMBIGUOUS`
- `OUT OF SCOPE — CANONICALLY OWNED ELSEWHERE`

`Likely`, `seems covered`, `probably`, `indirectly tested`, aggregate suite success, or equivalent do not qualify as `PROVEN`.

Any `NOT PROVEN` or `AMBIGUOUS` implementation-relevant obligation blocks certification, merge readiness, and closure.

## Guarantee classes and literal proof

Classify each relevant obligation by the kind of guarantee it makes. Apply every relevant proof class; do not force irrelevant tests merely to satisfy a checklist.

### Exact-value / numeric-boundary guarantees

Exact limits, maxima/minima, counts, capacities, sizes, and timing bounds require literal boundary evidence. Where applicable, prove:

```text
limit - 1
limit
limit + 1
```

For byte limits, distinguish encoded bytes from character counts and include multi-byte/Unicode representations when relevant.

### Universal / exclusionary guarantees

Words such as `all`, `every`, `never`, `none`, `only`, `cannot`, and `no access` describe properties, not one known mechanism.

Certification must challenge alternative mechanisms/capabilities that could violate the property. Proving one obvious path unavailable is not proof of a universal exclusion.

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

Certification must explicitly disposition each category as `APPLICABLE` or `NOT APPLICABLE — <reason>` rather than silently skipping it:

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

The purpose is conscious coverage of failure classes, not manufacturing irrelevant tests.

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

For every resource/security guarantee, certification must identify the **first mechanical enforcement boundary**. Rejecting a value after it already crossed or consumed resources across a protected boundary does not prove the earlier guarantee.

## Existing tests are not sole certification evidence

Tests authored during implementation are necessary evidence when applicable, but they cannot be the sole certification basis because they were selected under the implementer's interpretation.

Certification must actively search for requirements, guarantee classes, boundary conditions, and interactions that the implementation pass did not exercise. It may add focused certification tests.

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

Certification must identify materially touched neighboring systems and challenge critical pairwise interactions. Two subsystems being individually correct is not proof their composition is correct.

Where relevant, inspect combinations such as:

- concurrency + authoritative mutation;
- persistence + malformed/failing output;
- timeout + serialization/copying;
- resource limits + process boundaries;
- lifecycle + recovery;
- visibility + convenience/derived APIs;
- Spawn/pre-match + normal runtime;
- mechanics + Origins + Character AI.

When the existing Game/Origin/Character-AI audit is triggered, its required statuses/evidence remain mandatory under `AGENTS.md`; this protocol does not duplicate or relax that audit.

## Certification coverage ledger and completion gate

Final completion evidence must be requirement-level, not only aggregate test counts.

Minimum ledger shape:

| Requirement | Authority | Implementation | Positive proof | Adversarial/boundary proof | Status |
| --- | --- | --- | --- | --- | --- |

The final certification record must also state:

- remaining ambiguity: `None` or explicit blocking items;
- remaining assumptions: `None` or explicit blocking items;
- adversarial categories considered and each applicability disposition;
- threat-model result when applicable;
- cross-system interaction result;
- canonical owners consulted;
- owners modified;
- relevant cross-owner references reviewed;
- executable validation evidence under [`VALIDATION_POLICY.md`](./VALIDATION_POLICY.md), where applicable;
- current-main reconciliation status and final current-main SHA;
- stale/duplicate authority search result;
- Game/Origin/Character-AI audit statuses when triggered.

A row is `PROVEN` only with direct evidence sufficient for its guarantee class. Any implementation-relevant `NOT PROVEN` or `AMBIGUOUS` row blocks `CERTIFIED`.

After certification evidence is assembled, recheck current `main` and all existing repository completion/merge rules. Material semantic changes, relevant base overlap, or a corrective edit invalidate affected certification evidence and require the affected rows to be repeated.

Only after every applicable obligation is `PROVEN`, blocking ambiguity/assumptions are absent, existing repository gates pass, and current-main reconciliation is current may work be described as `CERTIFIED` and then `MERGE READY`.

## Subordinate workflow surfaces

Issue comments, working matrices, PR descriptions, and `.github/PULL_REQUEST_TEMPLATE.md` are coordination/evidence surfaces. They may record status and link to this protocol, but they are not duplicate process authority.

Optional agent skills/wrappers may assist with the phases, but repository-owned rules and this canonical protocol remain authoritative.
