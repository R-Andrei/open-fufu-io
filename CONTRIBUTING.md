# Contributing to Open Fufu

Open Fufu is being migrated from the inherited OpenFront codebase. The active repository workflow is owned by [`AGENTS.md`](./AGENTS.md); this file is a contributor-facing summary and must not override those instructions. Repository validation/test ownership is defined by [`docs/VALIDATION_POLICY.md`](./docs/VALIDATION_POLICY.md).

## Work tracking and coordination

- Use GitHub Issues for non-trivial planned work.
- Coordinate ownership before starting overlapping work.
- Automated agents must follow the unique issue-claim/work-session and attributable-branch rules in `AGENTS.md`.
- Use a short-lived topic branch and a pull request unless the user explicitly authorizes another workflow.
- There is no OpenFront `approved`-label, milestone, Discord, or automatic-close requirement for Open Fufu contributions.

## Current development baseline

The repository still contains substantial inherited OpenFront implementation. A passing current CI result therefore means the repository satisfies the **current Open Fufu-owned validation surface**, not that the final Open Fufu runtime or inherited application behavior is validated.

Normal pull-request validation is intentionally narrow:

- **Open Fufu Owned Validation** enforces the ownership boundary and runs only tests registered in [`validation/open-fufu-owned.json`](./validation/open-fufu-owned.json).
- **Documentation Authority** validates the canonical-owner map and strict documentation-authority rules.
- Additional focused owned workflows, such as Rule Composition Deep Validation, run only for their registered/path-scoped concerns.

`npm test` and plain/default `vitest run` execute the manifest-backed Open Fufu-owned test allowlist. They must not be broadened into inherited repository-wide discovery.

New Open Fufu executable or code-readable configuration must arrive with appropriate focused tests/validators in the same change and must be registered in `validation/open-fufu-owned.json`. Changing inherited executable code does not silently make it maintained; intentional adoption and focused validation must happen together. An inherited test does not become an Open Fufu correctness gate merely because it exists or currently passes.

Repository-wide inherited build/typecheck, lint, unit, integration, browser, server, matchmaking, replay, performance, or deployment/release checks are **not** blanket merge gates during this redesign phase. Commands such as `npm run build-prod` and `npm run lint` remain useful current-application utilities when deliberately needed, but they do not define the supported Open Fufu validation boundary.

Useful owned-validation commands include:

```bash
npm test
npm run test:coverage
```

Focused tests must be explicitly registered in `validation/open-fufu-owned.json`; do not use an inherited/unregistered test as acceptance evidence for unrelated Open Fufu work.

Do not alter canonical Open Fufu mechanics merely to make an inherited OpenFront test pass. Retain or adapt inherited harnesses only when the corresponding subsystem is deliberately adopted and the resulting validator is registered as owned.

## Pull requests

A pull request should:

- link the issue it resolves or advances;
- identify the active claim/work-session ID when the work comes from a claimed issue;
- explain the change and its ownership boundary;
- record the focused owned validation performed;
- add/update/register appropriate validators when introducing or adopting Open Fufu executable code;
- include the required cross-layer impact audit when gameplay, Origin, or character-AI semantics are affected;
- remain focused enough that ownership and review are clear.

After merge, clean up the remote topic branch as required by `AGENTS.md`.

## Canonical design and documentation

Before adding a new design/documentation/configuration file, locate the existing canonical owner. Prefer updating that owner over creating overlapping sources of truth. When a rule changes, update or remove stale references in the same change rather than leaving contradictory active documentation.
