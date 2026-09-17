# Repository ownership and Git workflow protocol

## Status and authority

This document is the canonical owner for repository claim/session ownership, issue/branch/PR mutation authority, claim-ID traceability, ownership transfer/abandonment, current-main branch reconciliation, merge ownership checks, and remote task-branch cleanup.

It does not own issue specification/certification (`ISSUE_WORK_PROTOCOL.md`), executable validation (`VALIDATION_POLICY.md`), canonical-document/configuration authority (`DOCUMENTATION_AUTHORITY_POLICY.md`), or Game/Origin/Character-AI semantics/audit (`official-ai/README.md`).

## Read cadence

Read this document before the first governed mutation in a work state. That read remains valid through a contiguous session while claim, ownership, branch/PR coordination, scope, and relevant base state are unchanged.

Re-read when any of those materially changes, before final current-main reconciliation/merge, and when `AGENTS.md` or this protocol explicitly requires an independent reset. Do not re-read solely because another commit, push, comment, or validation command is being made.

## Default workflow and issue creation

DEFAULT: short-lived topic branch -> PR -> merge unless the user explicitly requests another workflow.

A human may explicitly direct creation of a new issue before its issue-number-based claim can exist. Once the issue exists, establish the claim below before subsequent substantive work. Without an active claim, inspection/read-only work is allowed; other substantive repository mutation is forbidden unless the human explicitly directs that exact narrowly scoped operation.

## Claim establishment

A claim MUST be unique. Generic `claimed`, `in progress`, or `working on this` comments are insufficient.

Before substantive work on an existing issue:

1. inspect current assignees and coordination comments;
2. treat another active or ambiguous owner as exclusive until resolved;
3. create and post a unique claim ID, preferably `OF-ISSUE<issue>-<YYYYMMDD>-<unique-suffix>`;
4. assign the performing GitHub account;
5. state the claim ID, assignee, and that other agents/threads MUST NOT work the scope absent explicit human coordination/transfer.

An active claim normally requires matching assignee + unique claim comment. If tooling cannot assign, state the limitation and intended assignee. A claim establishes traceability/ownership only; it does not expand scope.

## Claim-ID propagation

While claimed, the exact claim ID MUST appear verbatim in:

- EVERY agent-created commit;
- EVERY agent-authored GitHub comment, review, or reply for the work;
- EVERY human-chat reply about the work;
- the PR body.

Human chat SHOULD put the claim ID first. The PR body MUST also identify the owning issue and preserve issue/claim/branch traceability. Correct a missing audit token before further substantive work.

## Durable issue work log

For claimed work, the owning issue is the durable coordination log; routine progress MUST NOT be maintained by rewriting the issue body.

Post concise checkpoints at work-session end and on material findings, blockers, decisions/assumptions, failed approaches, plan/scope changes, validation/certification results, lifecycle transitions, handoff, transfer, abandonment, extended interruption, or completion. A checkpoint MUST state material result, current status, and exact next action with enough context to resume.

Summarize related commits/test cycles. Do not event-stream commands, tiny edits, repeated checks, or every commit when they form one coherent step. Detailed evidence may live in commits, PRs/reviews, tests, and documentation; those do not replace required checkpoints.

## Branch ownership

Each substantive leaf issue has one active topic branch and one PR unless a human explicitly authorizes otherwise. Additional implementation branches/PRs for the same claim are forbidden. A human-authorized temporary diagnostic branch MUST NOT create another implementation PR and MUST be deleted when no longer needed.

Every issue-attributable remote branch has exactly one active claim ID unless a human explicitly establishes coordinated shared scope. Branches MUST be attributable to issue + claim and SHOULD name both. After branch creation, issue coordination MUST record the exact branch and purpose.

At the start of a mutating session, verify issue coordination records the branch under the exact current claim. Reverify when claim, ownership, branch/PR coordination, or relevant repository state materially changes; do not repeat the check before every write.

Missing, ambiguous, stale-looking, or different ownership makes the branch foreign/read-only until explicitly resolved. MUST NOT push, force-push, move its ref, rebase, merge into, delete, rename, repurpose, or otherwise mutate a foreign branch; MUST NOT use maintainer rights/`maintainer_can_modify` or overlapping replacement work to bypass ownership. Inactivity, failed CI, age, or apparent ease never transfers ownership.

## Issue and PR mutation authority

Issue/PR mutation authority requires the same exact active claim ID in its coordination record. A related resource with a different/no matching claim is foreign even when it concerns the same repository or topic.

Foreign work MAY be read, reviewed, compared, and reported. Without the explicit exception below, MUST NOT:

- substantially mutate a foreign issue or PR;
- post coordination/implementation comments or reviews as a participant;
- modify/delete its branch;
- merge an owned PR if a closing reference would close or materially move a foreign issue.

Before merge, inspect the PR title/body and known closing references. Every issue the merge would close/materially move MUST carry the same active claim unless the exception below applies.

## Exceptional foreign mutation

Foreign mutation is allowed ONLY when both are true:

1. it is severely required for the current operation, not merely convenient; and
2. the human explicitly approves that specific resource and operation.

Generic approval of current work is insufficient. Before the operation, state the current claim ID. Record the approval/action in current-issue coordination and, when practical/non-disruptive, on the foreign issue/PR. Perform only the approved operation; it grants no ownership transfer or continuing authority.

## Transfer, abandonment, and coordination state

Ownership transfer requires human approval and issue coordination recording old/new claim IDs, exact branch/PR scope, transfer state, and assignee change where appropriate. The receiver MUST NOT mutate until transfer is visible and unambiguous. Historical commits retain original claim IDs; post-transfer commits use the receiver's ID.

On abandonment with the issue open, clear the abandoning assignee and mark scope available. A closed issue MAY retain its historical assignee.

On merge, abandonment, transfer, or explicit scope split, update issue coordination so ownership is clear. Coordination state MUST expose without inference: owning claim, responsible GitHub account, owned remote branches, and mutation authority.

## Current-main reconciliation

When `main` advances, compare changed paths first. Reconcile only material overlap with topic files, canonical/config owners, coupled Game/AI configuration, interfaces, or tests. Otherwise record `reviewed-no-relevant-overlap`.

For material overlap, audit old base / topic / new main / reconciled result and preserve compatible topic + new-main semantics. For canonical/config overlap, also follow `DOCUMENTATION_AUTHORITY_POLICY.md`.

Before completion/merge, recheck current `main`. Freeze the reconciled SHA after the audit; later semantic change invalidates affected reconciliation/certification evidence.

After required review/search/validation succeeds: recheck `main` -> verify coordination/claim metadata -> merge -> cleanup.

## Remote branch cleanup

Remote topic branches are temporary integration artifacts, not archives. Delete merged PR heads, abandoned/closed-unmerged branches once continuation is ruled out, and temporary staging/probe/diagnostic branches as soon as unused. Local retention is optional.

Before finishing work that created/used remote branches, verify no stale task branch remains. MUST NOT delete `main`, an open-PR branch, or a branch with unclear ownership/status without verifying staleness. GitHub automation may satisfy merged-head cleanup; agents remain responsible for cleanup it does not cover.
