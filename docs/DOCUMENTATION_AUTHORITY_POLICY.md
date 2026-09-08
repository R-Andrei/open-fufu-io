# Documentation and canonical-authority policy

## Status and authority

This document is the canonical owner for repository documentation/configuration authority: one-owner rules, canonical-source discovery, authoring boundaries, duplicate/stale authority prevention, subsystem gateways, file-splitting criteria, configuration-source consolidation, canonical-overlap reconciliation, and documentation-heavy completion audits.

It does not own issue/branch/PR mutation authority (`REPOSITORY_OWNERSHIP_PROTOCOL.md`), issue certification (`ISSUE_WORK_PROTOCOL.md`), executable validation (`VALIDATION_POLICY.md`), or subsystem mechanics/AI semantics.

## Read this freshly before

Freshly read this document, plus `README.md`, before:

- adding/changing/moving/deleting canonical documentation or code-readable design configuration;
- creating any documentation/design/configuration file;
- changing which file owns a concern;
- adding authoritative text that summarizes another subsystem;
- reconciling `main` overlap involving canonical/config owners;
- completing documentation-heavy work.

A prior read earlier in the task does not satisfy a later fresh-read gate required by `AGENTS.md`.

## Player-facing versus developer-facing text

Player-facing descriptions/tooltips MUST be concise and describe the ordinary intended effect. Omit rare interactions, resolver details, validation rules, and implementation caveats.

Developer-facing canonical mechanics MUST be explicit and complete, including relevant edge cases, ordering, failure behavior, and cross-system interactions. MUST NOT lengthen player-facing copy merely to make it serve as developer documentation.

## One concern, one canonical owner

One concern = one canonical owner. Prefer one coherent single-purpose owner over overlapping fragments.

Non-owners MAY cross-reference an owner when genuinely needed, but MUST NOT restate its mechanics, exceptions, constants, migration caveats, or other authoritative detail. Cross-reference is navigation, not synchronized summary authority.

If two files answer the same authoritative question, resolve the ownership ambiguity instead of maintaining duplicate answers.

## Finding and reading authority

For substantive work changing mechanics/rules/configuration/canonical docs, or code/comments summarizing another subsystem's semantics:

1. read current-target-base `README.md`;
2. identify every relevant canonical owner;
3. read each owner from that same base;
4. record the owner set in work evidence;
5. resolve unclear ownership before adding another rule statement.

Memory, earlier branch snapshots, issue prose, PR descriptions, and secondary summaries are not authority.

## Changing authoritative facts

Change authoritative facts only in their owner.

Non-owner docs/code comments MAY retain only locally owned interface/composition facts; otherwise name/link the owner. MUST NOT copy another owner's resolver details, constants, formulas, exception lists, edge cases, blocker ledgers, completion matrices, or mutable project status.

Canonical mechanics/design docs MUST NOT use mutable GitHub issue/PR references as normative dependency/current-status records. GitHub work surfaces own work/progress; canonical docs own durable rules. PR descriptions and issue comments are review/project-management surfaces, never canonical mechanics authority.

## Canonical overlap when `main` advances

General current-main timing/reconciliation is owned by `REPOSITORY_OWNERSHIP_PROTOCOL.md`.

When that protocol identifies material overlap involving canonical/config owners, audit old base / topic / new main / result and verify:

- each authoritative fact still has one owner;
- compatible topic and new-main semantics are both preserved;
- no stale duplicate authority was introduced;
- moved/renamed owners have updated incoming references;
- coupled Game/Origin/Character-AI configuration is reviewed through `official-ai/README.md` when triggered.

## Stale/duplicate authority audit

Before completing authoritative or documentation-heavy work:

- search changed mechanic/trait/entity names plus old terminology/formulas/status;
- inspect every relevant hit and fix stale/duplicate authority;
- re-read modified/referenced owners against the changed code/config;
- verify every durable concern has a clear single owner;
- remove incorporated obsolete shards/abandoned planning docs;
- update links after rename/consolidation;
- verify remaining TODOs are genuinely open;
- prefer deletion of obsolete active duplicates when Git history already preserves them.

Updating canonical source while knowingly leaving contradictory active documentation is incomplete.

## PR evidence for canonical concerns

PRs touching canonical concerns MUST record:

- canonical owners consulted;
- owners modified;
- cross-owner references reviewed;
- base reconciliation affecting canonical owners;
- stale-reference search findings/fixes;
- final current-main SHA.

This evidence is subordinate. It does not become another authority and does not replace Game/Origin/Character-AI audit evidence when that audit is triggered.

## Mechanical Documentation Authority enforcement

`scripts/checkDocumentationAuthority.ts` and the Documentation Authority workflow enforce the mechanically provable policy in permanent `--strict` mode.

Every registered canonical owner MUST exist and MUST contain no mutable GitHub issue/PR work-state reference.

MUST NOT add a baseline allowlist, exemption, or weaker ordinary-CI comparison merely to make the check pass.

## Subsystem gateways

Subsystems beyond a few tightly related dedicated documents MUST be grouped under one obvious directory with a `README.md` gateway that:

- explains the subsystem;
- names the broad/father design;
- maps narrower concerns to canonical owners;
- links relevant code/config.

Detailed child docs SHOULD point back to the gateway/father; code/config owners SHOULD point toward the gateway.

A gateway is navigation/integration metadata, not a place to duplicate detailed child rules.

MUST NOT leave a mature subsystem as an unstructured pile of similarly named top-level documents merely to avoid link moves.

When docs move, audit old-path references in the same change. A compatibility pointer is allowed ONLY when explicitly non-canonical and materially safer than immediately rewriting a large legacy owner; MUST NOT create permanent redirect forests.

## Creating documentation/design/configuration files

Before creating any documentation/design/configuration file:

1. search the repository for the concept/subsystem/entity catalogue/configuration;
2. identify the existing owner;
3. update it if the new material belongs to the same concern.

Create a new file ONLY when purpose, authority, lifecycle, or audience is genuinely distinct enough that adding it to the existing owner would mislead or be incoherent.

A new canonical file MUST state its ownership boundary and neighboring canonical files it does not own. Length alone is insufficient split justification.

## No duplicate authoritative data

MUST NOT make two files independently canonical for the same facts or duplicate exact tables, registries, config objects, formulas, or rule text for convenience. Prefer cross-reference.

Rationale MAY explain why configuration exists; exact config values remain in the code-readable config owner.

Configuration MAY reference gameplay mechanics but MUST NOT duplicate mechanical arithmetic owned by gameplay/rules/effective-rules.

High-level architecture owns architecture/boundaries, not duplicate detailed config catalogues. A content catalogue owns entries; architecture references it.

## Synchronizing changed rules

When a rule/name/formula/mapping/design decision changes:

1. update the canonical owner;
2. search the repository for the old form;
3. update/delete stale summaries, examples, TODOs, and contradictions in the same change.

Preserve history in Git, not obsolete active files.

MUST NOT resolve uncertainty by adding a second “new canonical” owner beside an old one. Update the existing owner or explicitly retire/supersede the old owner and remove it when safe.

## Batches and temporary shards

Batches are workflow/review units, not architecture.

MUST NOT commit permanent temporary-range/batch files such as `*_P51_N06.md`, `part-1`, `batch-3`, or shard config such as `foo.p01-p10.config.ts` solely for incremental editing.

Append accepted batches to the single canonical owner. If temporary fragments are unavoidable, consolidate and delete them before topic branch/PR completion. Git history archives prior batch states; the active tree represents the current coherent system.

## Code-readable configuration ownership

Prefer one code-readable configuration source per domain unless a concrete runtime/tooling constraint requires a split. Internal grouping/constants are allowed.

Use `README.md` to identify the exact current configuration owners. Separate files require a real loading, ownership, generation, deployment, or lifecycle boundary, not file length or incremental authoring convenience.

## Keep authority types distinct

Authority types MUST remain distinct:

- gameplay/rules: actual mechanics, formulas, costs, legality, content rules;
- code-readable design config: exact AI mappings/IDs intended for implementation migration;
- architecture/contracts: reusable types, boundaries, pipelines, semantic rules;
- rationale: strategic intent, explanations, important exclusions without exact config duplication;
- roster/catalogue: entity list and content identity.

If two files answer the same authoritative question, ownership must be resolved rather than synchronized.

## Splitting files

Split only for clear structural benefit, such as:

- runtime loading/deployment boundary;
- generated versus hand-authored;
- independently versioned/public API;
- distinct subsystem ownership/lifecycle;
- tooling limit;
- otherwise unrelated purposes in one file.

A justified split MUST document the reason in its parent README/index, keep exactly one owner per fact, and provide an obvious aggregation/import path where appropriate.

Easier batch editing, file length, or possible future growth are insufficient reasons by themselves.

## Mutable progress/status

Avoid duplicating mutable progress counters, completion matrices, or current-status tables. Keep them only where materially owned or derive them from canonical config when practical.

Stale progress MUST be updated/removed, not superseded elsewhere.

Default: extend/clean the existing owner rather than add an overlapping file; delete redundant active history rather than preserve it.
