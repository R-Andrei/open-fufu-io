# AGENTS.md

Applies to automated coding/documentation agents in this repository.

## Always

Before repository work, freshly read this file. Re-read when rules, claim, scope, or materially relevant repository state changes and before merge. Batch related read-only steps; reuse still-valid evidence.

For claimed issue work, the owning GitHub issue MUST be the durable coordination log. Record material findings, blockers, plan/scope changes, validation/certification results, lifecycle transitions, handoff, and completion. Summarize related work; do not event-stream microscopic actions. Detailed evidence may live in commits, PRs, tests, or reviews.

Every repository-work communication (human chat, GitHub comments/reviews, commit messages) MUST state relevant findings/conclusion and a concrete recommended next action. Investigations/work MUST disclose results. Repository file content is excluded.

Never assume an unestablished truth. If user instructions plus current canonical authority do not determine a mechanic, semantic, intended behavior/value/order, theoretical premise, or other material unknown, STOP and ask. Only mechanically unambiguous corrections established by context may be inferred.

Do not create GitHub issues unless explicitly requested by the human or required by an approved repository workflow. If an issue is created accidentally, immediately mark it as accidental and close it as not planned.

Testable behavior-changing implementation/bug-fix work MUST be RED-first. Before production edits, inventory affected callers, fixtures, copies, and boundaries. Prove focused RED coverage for a coherent obligation, implement the smallest coherent GREEN slice, run focused validation, then broader owned validation at coherent checkpoints. Production-first/backfilled proof is forbidden unless genuinely non-testable/emergency and explicitly justified.

`IMPLEMENTATION GREEN != CERTIFIED != COMPLETED`. Substantive issue work MUST follow [`docs/ISSUE_WORK_PROTOCOL.md`](docs/ISSUE_WORK_PROTOCOL.md).

While a claim is active, its exact claim ID MUST appear verbatim in every agent-created commit and every agent-authored repository-work communication, including human chat, GitHub comments/reviews/replies, and the PR body.

## Mandatory protocol reads

Triggers are cumulative. Read a triggered protocol before governed work; that read remains valid through a contiguous unchanged work state. Re-read when its governing claim, scope, rules, base coordination, or lifecycle gate materially changes, or when an independent reset is required. If applicability is uncertain, read it.

| Before doing this | Read |
| --- | --- |
| Create/update/claim/reassign/transfer/abandon/close issue work; create/mutate/delete issue-attributable branches or refs; create/update/review/merge its PR | [`docs/REPOSITORY_OWNERSHIP_PROTOCOL.md`](docs/REPOSITORY_OWNERSHIP_PROTOCOL.md) |
| Create/materially reframe acceptance-bearing issue work; begin substantive implementation; report implementation GREEN; begin/repeat certification; report certified/merge-ready/completed | [`docs/ISSUE_WORK_PROTOCOL.md`](docs/ISSUE_WORK_PROTOCOL.md) plus relevant canonical owners |
| Add/change/adopt executable code, tests, validation manifests, or workflows | [`docs/VALIDATION_POLICY.md`](docs/VALIDATION_POLICY.md) |
| Add/change/move/delete canonical docs/config, create documentation/design/configuration files, change authority/ownership, or reconcile canonical overlap | [`docs/DOCUMENTATION_AUTHORITY_POLICY.md`](docs/DOCUMENTATION_AUTHORITY_POLICY.md) plus [`docs/README.md`](docs/README.md) |
| Change `design/official-ai/*`, Official-AI docs/presets/behavior, gameplay/mechanics, Origins/traits, or related strategic semantics | [`docs/official-ai/README.md`](docs/official-ai/README.md) plus routed canonical owners |

## Action gates

Before mutating an existing remote topic branch, verify the exact active claim owns it. Reverify when ownership/branch coordination changes.

Before commit, verify the change conforms to current rules and every protocol triggered by its scope; unchanged reads need not be repeated.

Before substantive PR review/certification, independently read the issue, changed concerns, applicable canonical owners, and triggered protocols; do not use the author's summary as authority.

Before merge, freshly read this file, the ownership protocol, the issue-work protocol when substantive, and every other protocol triggered by the PR. Recheck current `main`, ownership/closing references, required validation/reviews, certification, and cleanup obligations.
