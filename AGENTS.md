# Repository Agent Instructions

These instructions apply to automated coding/documentation agents working in this repository.

## Git workflow and remote branch hygiene

- Repository changes should ordinarily be made on a short-lived topic branch and merged through a pull request unless the user explicitly requests another workflow.
- Remote topic branches are temporary integration artifacts, not archives.
- After a pull request is merged, its remote head branch must be deleted.
- If work is abandoned or a pull request is closed without merge, delete the associated remote branch once it is clear the work will not continue from that branch.
- Temporary, staging, probe, or diagnostic branches pushed to `origin` must be deleted in the same task as soon as they are no longer needed.
- Local branch retention is optional. Agents may keep or delete their own local branches as convenient; this policy concerns the shared remote repository.
- Do not leave completed remote branches behind merely to preserve history. The merged commit/pull request is the history.
- Before finishing a task that created or used remote branches, verify that no stale remote branch from that task remains.
- Never delete `main`, a branch backing an open pull request, or a branch whose ownership/status is unclear without first verifying that it is stale.

GitHub automation may delete merged pull-request branches automatically. Agents must still follow the policy above for non-PR temporary branches and for any cleanup case the automation does not cover.
