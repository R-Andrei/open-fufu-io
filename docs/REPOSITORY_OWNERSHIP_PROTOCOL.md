# Repository ownership and Git workflow protocol

## Status and authority

This document is the canonical owner for repository claim/session ownership, issue/branch/PR mutation authority, claim-ID traceability, ownership transfer/abandonment, current-main branch reconciliation, merge ownership checks, and remote task-branch cleanup.

It does not own issue specification/certification (`ISSUE_WORK_PROTOCOL.md`), executable validation (`VALIDATION_POLICY.md`), canonical-document/configuration authority (`DOCUMENTATION_AUTHORITY_POLICY.md`), or Game/Origin/Character-AI semantics/audit (`official-ai/README.md`).

## Read this freshly before

Freshly read this document before:

- creating, claiming, assigning, reassigning, transferring, abandoning, or closing issue work;
- creating, mutating, renaming, rebasing, moving, or deleting an issue-attributable branch/ref;
- creating any commit for claimed work;
- creating/updating/reviewing/closing/reopening/retargeting/merging an issue-attributable PR;
- performing final current-main reconciliation or remote branch cleanup.

A prior read earlier in the task does not satisfy a later fresh-read gate required by `AGENTS.md`.

## Default workflow and issue creation

DEFAULT: short-lived topic branch -> PR -> merge unless the user explicitly requests another workflow.

A human may explicitly direct creation of a new issue before its issue-number-based claim can exist. Once the issue exists, establish the claim below before subsequent substantive work. Without an active claim, inspection/read-only work is allowed; other substantive repository mutation is forbidden unless the human explicitly directs that exact narrowly scoped operation.

## Claim establishment

A claim MUST be unique. Generic `claimed`, `in progress`, or `working on this` comments are insufficient.

Before substantive work on an existing issue:

1. inspect current assignees and all coordination comments;
2. treat another active owner as exclusive; do not create a competing claim, overlapping branch, or overlapping change;
3. treat stale-looking/ambiguous claims as active until verified;
4. create and post a unique claim ID, preferably `OF-ISSUE<issue>-<YYYYMMDD>-<unique-suffix>` or an equally unambiguous token;
5. assign the performing GitHub account;
6. state in the claim comment the claim ID, assignee, and that other agents/threads MUST NOT work the scope absent explicit human coordination/transfer.

An active claim normally requires matching assignee + unique claim comment. If tooling genuinely cannot assign, the comment MUST state that limitation and intended assignee.

A claim establishes traceability/ownership only. It does not expand task scope or authorize unrelated mutation.

## Claim-ID propagation

While claimed, the exact claim ID MUST appear verbatim in:

- EVERY agent-created commit, including merge/reconciliation, diagnostic, documentation, cleanup, tiny, and follow-up commits;
- EVERY agent-authored GitHub comment, review, or reply for the work;
- EVERY human-chat reply about the work;
- the PR body.

Human chat SHOULD put the claim ID first. The PR body MUST also identify the owning issue and preserve issue/claim/branch traceability.

A missing audit token MUST be corrected before further substantive repository work.

## Branch ownership

Every issue-attributable remote branch has exactly one active claim ID unless a human explicitly establishes coordinated shared scope. Branches MUST be attributable to issue + claim and SHOULD name both.

Immediately after branch creation, issue coordination MUST record the exact branch and purpose. If multiple active branches are explicitly authorized, list each.

Before EVERY write to an existing remote topic branch, verify that issue coordination records it under the exact current claim. Matching issue number alone is insufficient.

Missing, ambiguous, stale-looking, or different ownership makes the branch foreign/read-only until explicitly resolved. MUST NOT push, force-push, move its ref, rebase, merge into, delete, rename, repurpose, or otherwise mutate a foreign branch; MUST NOT use maintainer rights/`maintainer_can_modify` to bypass this; MUST NOT create overlapping replacement work to bypass ownership. Inactivity, failed CI, age, or apparent ease never transfers ownership.

## Issue and PR mutation authority

Issue/PR mutation authority requires the same exact active claim ID in its coordination record. A related resource with a different/no matching claim is foreign even when it concerns the same repository or topic.

Foreign work MAY be read, reviewed, compared, and reported. Without the explicit exception below, MUST NOT:

- substantially mutate a foreign issue (including close/reopen/title/body/labels/assignee/milestone/state/transfer);
- substantially mutate a foreign PR (including ready/close/reopen/retarget/merge/title/body);
- post coordination/implementation comments or reviews as a participant;
- modify/delete its branch;
- merge an owned PR if a `Closes`/`Fixes`/`Resolves`/equivalent reference would close or materially move a foreign issue.

Before EVERY merge, inspect the PR title/body and all known closing references. Every issue the merge would close/materially move MUST carry the same active claim unless the exception below applies.

## Exceptional foreign mutation

Foreign mutation is allowed ONLY when both are true:

1. it is severely required for the current operation, not merely convenient; and
2. the human explicitly approves that specific cross-ownership mutation.

Approval MUST name the resource and operation. Generic `proceed`, `merge it`, `clean this up`, or approval of the current owned work is insufficient.

Before the operation, state the current claim ID. Record the approval and exact action in current-issue coordination and, when practical/non-disruptive, on the foreign issue/PR. Perform only the approved operation. It grants no ownership transfer or continuing authority.

## Transfer, abandonment, and coordination state

Ownership transfer is explicit only:

- human approval is mandatory;
- issue coordination records old/new claim IDs, exact branch/PR scope, and transfer state;
- update assignee where appropriate;
- receiver MUST NOT mutate until transfer is visible and unambiguous;
- historical commits keep the original claim IDs; post-transfer commits use the receiver's ID.

On abandonment with the issue open, clear the abandoning assignee and mark scope available. A closed issue MAY retain its historical assignee.

On merge, abandonment, transfer, or explicit scope split, update issue coordination so ownership is clear. Coordination state MUST expose without inference: owning claim, responsible GitHub account, owned remote branches, and mutation authority.

## Current-main reconciliation

When `main` advances, compare changed paths first. Reconcile only material overlap with topic files, canonical/config owners, coupled Game/AI configuration, interfaces, or tests. Otherwise record `reviewed-no-relevant-overlap`.

For material overlap, perform a four-way audit of old base / topic / new main / reconciled result and preserve compatible topic + new-main semantics. When the overlap involves canonical/config authority, also follow `DOCUMENTATION_AUTHORITY_POLICY.md`.

Before completion/merge, recheck current `main`. Freeze the reconciled SHA after the audit; later semantic change invalidates affected reconciliation/certification evidence.

After required review/search/validation succeeds: recheck `main` -> verify coordination/claim metadata -> merge -> cleanup.

## Remote branch cleanup

Remote topic branches are temporary integration artifacts, not archives. Delete merged PR heads. Delete abandoned or closed-unmerged branches once continuation is ruled out. Delete remote staging/probe/diagnostic/other temporary branches in the same task as soon as unused. Local branch retention is optional.

Do not retain completed remote branches for history; merged commits/PRs are history. Before finishing work that created/used remote branches, verify no stale task branch remains.

MUST NOT delete `main`, an open-PR branch, or a branch with unclear ownership/status without first verifying staleness. GitHub automation may satisfy merged-head cleanup; agents remain responsible for cleanup it does not cover.
