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

### Issue claims and branch coordination

When an agent/thread takes ownership of a GitHub issue, the claim must be uniquely identifiable. A generic comment such as `claimed`, `in progress`, or `working on this` is insufficient because another concurrent agent could reasonably interpret it as its own claim.

- Create a unique claim/work-session ID and post it in the issue before substantive work begins. A recommended shape is `OF-ISSUE<issue>-<YYYYMMDD>-<unique-suffix>`; any equally unambiguous unique identifier is acceptable.
- At claim time, also assign the GitHub issue to the GitHub account that owns/is performing the claimed work. An active issue claim normally requires **both** the matching assignee state and the unique claim comment; neither one alone is sufficient. If the available GitHub tooling genuinely cannot modify assignees, the claim comment must explicitly record that limitation and name the intended assignee instead of silently omitting assignment.
- The issue claim comment must name the claim ID, identify the assigned GitHub account, and state that other agents/threads must not work the same scope unless the user explicitly coordinates parallel work or transfers ownership.
- Before beginning substantive work, inspect **both** the issue assignee state and issue comments for an existing active claim ID. If either indicates another active owner, do not create a competing claim or overlapping branch until ownership is resolved.
- If another active claim ID already owns the same issue/scope, do not create a competing branch or make overlapping changes. Resolve ownership first. If a claim appears stale or ambiguous, treat it as active until its status is verified rather than assuming it is abandoned.
- Every remote branch created as a consequence of a claimed issue must be attributable to that issue and claim. Prefer branch names containing both the issue number and claim ID, for example `issue-31/of-issue31-20260905-7c4a9e-<purpose>`.
- Immediately after creating such a remote branch, add or update an issue comment that records the exact branch name and purpose under the same claim ID. If one claim uses multiple branches, list every active branch so parallel agents can see the complete work surface.
- Pull requests must reference the issue and preserve the claim/branch traceability in their description when practical.
- When work is transferred, update both the claim comment/state and GitHub assignee so they identify the new owner. When work is abandoned while the issue remains open, clear the abandoning owner's assignee state and update the issue comment so the scope is visibly available again. A closed issue may retain its historical assignee.
- When work is merged, abandoned, transferred, or split into explicitly coordinated scopes, update the issue so the ownership state is clear. Branch cleanup still follows the remote-branch hygiene rules above.

The goal is that an agent inspecting the issue can determine, without inference, **who/what work session owns it, which GitHub account is responsible, which remote branches belong to that work, and whether overlapping work is safe**.

## Player-facing copy vs canonical mechanics

- Keep player-facing descriptions/tooltips concise and focused on the ordinary intended effect; do not enumerate rare interactions, resolver details, validation rules, or implementation caveats.
- Keep developer-facing canonical mechanics explicit and complete, including edge cases, ordering, failure behavior, and cross-system interactions.
- Do not lengthen player-facing copy merely to make it serve as developer documentation.

## Three-layer gameplay/Origin/character-AI synchronization invariant

Open Fufu has three strategically coupled design/runtime layers that must remain synchronized:

```text
GAMEPLAY / MECHANICS LAYER
  core rules, formulas, numerical balance, structures, units, terrain,
  economy, combat, strategic weapons, visibility, etc.

ORIGIN LAYER
  Origin traits and drawbacks, Official Origin compositions,
  trait AI support, combination/suppression support, named-Origin assertions

CHARACTER AI LAYER
  Official-AI presets, CharacterProfiles, Origin adaptation,
  character-specific hooks, capability/fidelity expectations and tests
```

A change originating in **any one** of these layers requires an explicit impact inspection of **all three layers in both directions** before the change is complete.

This is a mandatory review rule, not an assumption that every change must edit all three layers. `reviewed — no change required` is a valid outcome. Failing to perform the review is not.

### Bidirectional rule

Never reason only downstream.

```text
mechanic change
  → inspect trait/Origin semantics and support
  → inspect character valuation/adaptation

Origin/trait change
  → inspect whether underlying mechanics still support the intended rule cleanly
  → inspect every affected character/preset/adaptation

character-AI change
  → inspect whether the requested behavior really belongs in character logic
  → inspect whether it exposes a missing generic Origin-support concept
  → inspect whether it reveals a mechanics/rules problem that should be fixed lower down
```

A character-specific workaround must not silently compensate for a broken or incomplete mechanic/Origin abstraction. Conversely, a mechanically legal change must not be assumed strategically neutral to Origin support or character reasoning.

### Changes that trigger the audit

Perform the three-layer inspection when adding, removing, or changing any of the following, including but not limited to:

- core gameplay mechanics or formulas;
- numerical balance values that can change strategic value, timing, risk, payoff, range, cost, throughput, damage, growth, capacity, cooldown, coverage, or opportunity cost;
- structures, units, terrain behavior, economy sources, combat/capture rules, strategic weapons, visibility/information rules, spawn rules, or controller-visible mechanics;
- Origin traits/drawbacks or their numerical/mechanical semantics;
- Official Origin trait composition or roster entries;
- Origin trait AI-support mappings;
- Origin combination-support or support-suppression rules;
- named-Origin AI assertions/support;
- Official-AI allowed-Origin pools;
- CharacterProfile evaluator/planner capability;
- Doctrine, Goal generation, arbitration, persistence, Expression, or Origin-adaptation behavior;
- character-specific trait/Origin overrides or hooks;
- a new Official AI preset/character;
- removal/retirement of any mechanic, trait, Origin, or preset.

Purely numerical changes **still require the audit**. They do not automatically require AI configuration edits, but a number can cross a strategic threshold or materially change how much a character should value a mechanic. For example, changing cost, range, reload, growth, payout, or coverage may alter an Origin's strategic theme or make an existing character preference irrational even though all type-level mechanics remain unchanged.

### Required cross-layer impact checklist

For every triggering change, explicitly inspect and account for:

1. **Gameplay/mechanics owner**
   - Is the authoritative rule/formula/value correct?
   - Did legality, timing, scale, opportunity cost, interaction, or public information change?
   - Are related mechanics/tests/docs still accurate?

2. **Origin/trait layer**
   - Do affected trait mechanics/costs/descriptions still match the game rule?
   - Do `origin-trait-support.config.ts` themes, affordances, cautions, tags, hooks, combinations, and suppressions still describe the effective strategy correctly?
   - Do affected entries in `origin-configurations.config.ts` still compose correctly?
   - Do any Official Origins gain/lose a meaningful synergy, conflict, or validation requirement?

3. **Character AI layer**
   - Which allowed-Origin pools include affected Origins?
   - Do any CharacterProfiles value the changed mechanic through Doctrine, Origin adaptation, plan ranking, persistence, Expression, or bespoke hooks?
   - Does the change alter the relative attractiveness of a tactic enough to require re-tuning or re-benchmarking even if no literal/config shape changes?
   - Do character × affected-Origin validation/fidelity expectations still hold?

4. **Reverse-direction architecture check**
   - If the change started in character logic, should any of it instead become reusable Origin support or a mechanics-layer rule?
   - If it started in an Origin/trait, is the game mechanic general enough and correctly surfaced through `EffectiveRulesView`?
   - If it started in mechanics, are higher-layer assumptions now stale even when compilation/tests still pass?

### Completion evidence

A triggering change is incomplete until the task/PR records the result of the cross-layer audit.

Use a compact record such as:

```text
Cross-layer impact audit
- Mechanics: updated / reviewed-no-change — <short reason>
- Origins/traits: updated / reviewed-no-change — <short reason>
- Character AI: updated / reviewed-no-change — <short reason>
- Affected character × Origin validation: updated / rerun / not required — <short reason>
```

For pull requests, include this in the PR description or review-visible change summary. For direct branch work without a PR yet, include it in the task/commit summary and ensure it is carried into the eventual PR.

Do not use `not applicable` merely because the change was authored in another layer. The point of this invariant is that each neighboring layer must actually be inspected.

### Automated validation supplements, but does not replace, semantic review

Where practical, repository validation should mechanically verify referential synchronization, for example:

- every deployed trait has exactly one AI-support mapping;
- Official Origin trait membership matches the gameplay roster exactly;
- required combination/suppression IDs exist and compose deterministically;
- character allowed-Origin IDs resolve to active configured Origins;
- character-specific trait/Origin overrides reference valid content;
- every character × allowed-Origin pairing is represented in accelerated validation coverage.

Automation cannot prove that a numerical rebalance still matches character strategy or theme. Passing CI never waives the manual three-layer semantic audit.

## Canonical documentation and configuration ownership

The repository must prefer **one canonical source of truth per concern**. Long but coherent single-purpose files are preferable to a collection of overlapping fragments.

**One canonical owner per concern. Other documents should link to that owner only when they genuinely need to reference the concern; they must not restate its mechanics, exceptions, constants, migration caveats, or other authoritative detail.** A cross-reference is navigation, not a license to maintain a synchronized summary copy.

### Subsystem documentation gateways

When a subsystem grows beyond a few tightly related documents, group its dedicated documents under one obvious directory and provide a `README.md` gateway that explains the subsystem, names the broad/father design document, maps each narrower concern to its canonical owner, and links to relevant code/configuration. Detailed child documents should point back to that gateway or father document, and code/configuration owners should point toward the documentation gateway.

The gateway is navigation and ownership metadata, **not another copy of the detailed rules**.

For Official AI specifically:

```text
docs/official-ai/README.md
```

is mandatory first reading for Official-AI work. Agents changing `design/official-ai/*`, an Official-AI document, an AI preset pool, or character/Origin AI behavior must start there and follow the task-specific reading trail before editing. The broad/father design is `docs/official-ai/OFFICIAL_AI_ARCHITECTURE.md`.

Do not leave a mature subsystem as an unstructured pile of similarly named top-level files merely to avoid moving links. When documents move, audit references to the old paths in the same change. A compatibility pointer is acceptable only when it is explicitly non-canonical and materially safer than rewriting a large legacy owner immediately; do not create a forest of permanent redirect files.

### Before creating any new documentation or design/configuration file

1. Search the repository for the concept, subsystem, entity catalogue, or configuration being documented.
2. Identify the existing canonical owner, if one exists.
3. Update that owner instead of creating another file when the new material belongs to the same concern.
4. Create a new file only when the material has a genuinely distinct purpose, authority, lifecycle, or audience that would make adding it to the existing owner misleading or incoherent.
5. When creating a new canonical file, explicitly state its ownership boundary and identify the neighboring canonical files whose concerns it does **not** own.

A file becoming long is **not by itself** sufficient justification to split it.

### One concern, one authority

- Do not make two files independently canonical for the same facts.
- Do not duplicate exact tables, registries, configuration objects, formulas, or rule text into multiple files merely for convenience.
- Prefer cross-references to copying authoritative content.
- A rationale document may explain *why* a configuration exists, but exact configuration values must remain in the configuration source of truth.
- A configuration file may reference gameplay mechanics, but it must not duplicate mechanical arithmetic when a gameplay/rules document or effective-rules layer already owns that arithmetic.
- A high-level architecture document should describe architecture and boundaries; it should not become a second copy of detailed configuration catalogues.
- A content catalogue should own its content entries; architecture documents should point to it rather than restating the catalogue.

### Update, do not fork

When a rule, name, formula, mapping, or design decision changes:

1. update the canonical owner;
2. search the repository for references to the old form;
3. update or delete stale summaries, examples, TODOs, and contradictory wording in the same change;
4. preserve historical discussion in Git history rather than leaving obsolete files in the active tree.

Do not solve uncertainty by adding a second “new canonical” document while leaving the old one intact. Either update the existing owner or explicitly retire/supersede the old file and remove it when safe.

### Batch work must not become repository structure

Batches are a review/workflow device, not a documentation architecture.

- Do not commit permanent files named by temporary authoring ranges such as `*_P51_N06.md`, `part-1`, `batch-3`, or equivalent merely because work was reviewed in chunks.
- Do not shard a configuration catalogue into `foo.p01-p10.config.ts`, `foo.p11-p20.config.ts`, etc. solely to make incremental editing easier.
- Append accepted batch results to the single canonical file for that concern.
- If temporary fragments are unavoidable during active work, consolidate them and delete the fragments before the topic branch/PR is considered complete.
- Git history is the archive for earlier batch states; the checked-in tree should represent the current coherent system.

### Configuration-file policy

Prefer one code-readable configuration source per configuration domain unless runtime or tooling constraints provide a concrete reason to split it.

For the current Official-AI design this means, unless architecture is explicitly changed:

```text
design/official-ai/origin-trait-support.config.ts
  all exact trait-support mappings, additive combination support, and support-suppression rules

design/official-ai/origin-configurations.config.ts
  all exact named Official-Origin AI mappings

design/official-ai/character-configurations.config.ts
  Baseline and all exact character AI mappings once authored
```

Internal grouping/constants inside one file are acceptable for readability. Separate files require a real loading, ownership, generation, or lifecycle boundary—not merely file length or ten-at-a-time authoring.

### Documentation vs configuration

Keep these layers distinct:

- **Gameplay/rules documents** own actual mechanics, formulas, costs, legality, and content rules.
- **Code-readable design configuration** owns exact AI mappings and IDs intended to migrate into implementation.
- **Architecture/contracts** own reusable types, boundaries, pipelines, and semantic rules.
- **Rationale documents** own strategic intent, explanations, and important exclusions without duplicating exact config objects.
- **Roster/catalogue documents** own the relevant list of entities and their content identity.

If two files appear to answer the same question, resolve the ownership ambiguity instead of documenting the same answer twice.

### Legitimate reasons to split a file

Splitting is acceptable when there is a clear structural benefit such as:

- different runtime loading/deployment boundaries;
- generated versus hand-authored sources;
- independently versioned/public APIs;
- clearly different subsystem ownership and lifecycle;
- tooling limits that make one file impractical;
- a file would otherwise contain multiple unrelated purposes.

When a split is justified, document the reason in the parent README/index, establish exactly one canonical owner for each fact, and provide an obvious aggregation/import path where appropriate.

“Easier to edit this batch,” “the file is getting long,” or “this section might grow later” are not sufficient reasons.

### Stale-document audit is part of completion

Before completing a documentation-heavy topic branch or PR:

- inspect the relevant directory for duplicate or temporary files;
- search for old terminology, superseded formulas, renamed entities, and references to deleted files;
- verify every durable concern has a clear canonical owner;
- verify no two files claim canonical authority over the same exact data;
- remove obsolete batch shards and abandoned planning documents when their information has been incorporated;
- update links after renames/consolidations;
- verify TODOs still describe genuinely open work rather than already-closed decisions;
- prefer deletion over leaving a permanent “deprecated” duplicate when Git history already preserves it.

A change that updates the canonical source but knowingly leaves contradictory active documentation is incomplete.

### Progress/status information

Avoid copying mutable progress counters, completion matrices, or current-status tables into many documents. Keep such information only where it materially belongs, or derive it from the canonical configuration when practical. If a progress statement becomes stale, update or remove it rather than adding another newer statement elsewhere.

### Default decision rule

When deciding between:

- adding another file that overlaps an existing concern; or
- extending/cleaning the existing canonical owner,

**prefer the existing canonical owner**.

When deciding between:

- preserving a redundant active document “for history”; or
- deleting it after its useful content has been incorporated,

**prefer deletion; Git history already preserves history**.