# Open Fufu validation ownership policy

## Status and authority

This document is the **canonical owner for repository validation scope, test ownership, inherited-code validation boundaries, and the rules for adopting executable code into the maintained Open Fufu surface**.

It does not define gameplay mechanics, Origin semantics, or implementation sequencing. Those remain owned by the subsystem documents registered in [`README.md`](./README.md).

The machine-readable ownership registry is [`../validation/open-fufu-owned.json`](../validation/open-fufu-owned.json). The executable guard is [`../scripts/checkValidationBoundary.ts`](../scripts/checkValidationBoundary.ts).

## Current project phase

Open Fufu is in a documentation-first redesign phase on top of an inherited OpenFront repository. Most inherited application, server, browser, integration, performance, and unit-test code is migration evidence rather than a maintained Open Fufu contract.

A failing inherited test is therefore not evidence that current Open Fufu design work is incorrect. Conversely, making inherited tests green does not establish that the intended replacement architecture is correct.

The repository validation surface must reflect what Open Fufu has intentionally authored or explicitly adopted, not everything that happens to exist in Git history.

## Ownership rule

Validation uses an explicit allowlist rather than attempting to infer ownership dynamically from Git authorship.

Git authorship is useful evidence when deciding whether a file belongs to Open Fufu, but merges, renames, generated files, shared files, and future contributors make author-based CI inference too brittle. Intentional adoption is therefore recorded in `validation/open-fufu-owned.json`.

A file is part of the maintained executable Open Fufu surface only when it is explicitly registered there with at least one owned validator.

Changing an inherited executable file does **not** silently adopt it. If a change to inherited executable code is actually required, the same change must deliberately register that file and its validator/test coverage. Otherwise the validation-boundary guard rejects the change.

Deleting inherited executable code or inherited tests does not require adoption.

## Default test surface

`npm test` and plain `vitest run` are reserved for the **owned Open Fufu test allowlist**.

They must not discover the inherited repository test suite and must not rely on an exclusion list such as “everything except `tests/server/**`.” Exclusion-based validation is unsafe here because an inherited test outside the excluded directory can silently become a new gate.

The default Vitest configuration therefore takes its `include` list directly from `validation/open-fufu-owned.json`.

Legacy OpenFront tests may be invoked manually for historical investigation when genuinely useful, but they are non-authoritative, non-gating, and must never be added to normal CI merely because they already exist.

## CI boundary

Normal pull-request/main validation may run only Open Fufu-owned validators.

During the current redesign phase, CI must not perform repository-wide inherited application validation, including:

- full OpenFront application build/typecheck as a merge gate;
- repository-wide inherited lint as a merge gate;
- broad Vitest discovery followed by exclusions;
- inherited server/browser, matchmaking, integration, replay, or performance suites;
- a “full non-server” suite that still sweeps inherited tests.

Current valid validation categories are:

- canonical documentation authority checks;
- the validation-ownership boundary guard itself;
- explicitly registered Open Fufu rule/entity/catalogue tests;
- explicit exhaustive/structural checks for Open Fufu-owned entities where useful.

As implementation replaces inherited subsystems, those new/adopted sources and their tests can be added to this surface deliberately.

## Requirement for new Open Fufu executable code

New executable Open Fufu code must not arrive as unvalidated orphan code.

A change that adds or modifies executable code must do one of the following:

1. modify an already registered Open Fufu-owned source whose registered validators remain appropriate; or
2. explicitly adopt/register the source in `validation/open-fufu-owned.json` and associate it with at least one owned validator.

For ordinary production/game code, the expected validator is one or more focused tests that exercise the authored behavior. Structural/configuration code may use focused conformance, schema, relationship, or exhaustive validators where those better express the contract. Validation infrastructure may be validated by focused policy tests and/or by executing the guard in CI.

A new or modified test under `tests/` must itself be registered as an owned test. This prevents agents from reviving or editing inherited tests and then accidentally treating them as current requirements.

## Workflow hardening

Every workflow Open Fufu actively maintains must be registered in the ownership manifest.

The boundary guard rejects owned workflows that reintroduce known broad inherited validation paths. Direct Vitest invocations in workflows must name at least one registered Open Fufu test; otherwise use the manifest-backed default `npm test`.

The intent is not to make CI impossible to change. The intent is to make expansion of the validation surface an explicit architectural decision visible in the same review as the code that requires it.

## Adoption procedure

When a previously inherited subsystem begins authoritative Open Fufu implementation:

1. identify the exact executable files being replaced or adopted;
2. add/update focused Open Fufu tests or validators for the intended new contract;
3. register the tests and source-to-validator relationships in `validation/open-fufu-owned.json`;
4. update CI only if a new validation category/workflow is genuinely needed;
5. do not reactivate inherited tests merely because their filenames or subject areas appear related;
6. document the subsystem's new canonical implementation/testing boundary where its owner requires it.

The old inherited suite remains historical evidence unless a test is deliberately rewritten/adopted into the Open Fufu-owned surface.

## Enforcement

`scripts/checkValidationBoundary.ts` enforces the mechanically provable portion of this policy. It checks the manifest, default Vitest wiring, owned workflows, and the changed-file set against the target base.

`tests/ValidationBoundaryPolicy.test.ts` regression-tests the guard's ownership behavior.

Passing the guard does not prove that a test suite is semantically sufficient. Review must still ask whether the registered validators actually cover the newly authored Open Fufu behavior. The guard exists to prevent accidental scope expansion and unvalidated executable adoption, not to replace engineering judgment.
