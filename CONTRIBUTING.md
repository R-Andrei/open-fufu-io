# Contributing to Open Fufu

Open Fufu is being migrated from the inherited OpenFront codebase. The active repository workflow is owned by [`AGENTS.md`](./AGENTS.md); this file is a contributor-facing summary and must not override those instructions.

## Work tracking and coordination

- Use GitHub Issues for non-trivial planned work.
- Coordinate ownership before starting overlapping work.
- Automated agents must follow the unique issue-claim/work-session and attributable-branch rules in `AGENTS.md`.
- Use a short-lived topic branch and a pull request unless the user explicitly authorizes another workflow.
- There is no OpenFront `approved`-label, milestone, Discord, or automatic-close requirement for Open Fufu contributions.

## Current development baseline

The repository still contains substantial inherited OpenFront implementation. A passing current CI result therefore means the repository satisfies the **current Open Fufu migration baseline**, not that the final Open Fufu runtime or all inherited behavior is validated.

The current pull-request baseline is:

```bash
npm ci
npm run build-prod
npm run lint:github
```

`npm run build-prod` includes TypeScript typechecking. Canonical code-readable design configuration under `design/` is included in that typecheck, along with the public controller-contract compile fixture.

The inherited Vitest suites, repository-wide Prettier check, generated-map reproducibility check, headless/replay validation, and deployment/release checks are not blanket blocking gates at this migration stage. Relevant tests and validation must be added or re-enabled as the corresponding Open Fufu implementation becomes authoritative.

Useful local commands remain available, including:

```bash
npm test
npm run test:coverage
npm run lint
npm run lint:fix
npm run format
```

Do not alter canonical Open Fufu mechanics merely to make an inherited OpenFront test pass. Retain and adapt useful inherited harnesses where they validate infrastructure that Open Fufu still uses.

## Pull requests

A pull request should:

- link the issue it resolves or advances;
- identify the active claim/work-session ID when the work comes from a claimed issue;
- explain the change and its ownership boundary;
- record the validation performed;
- include the required cross-layer impact audit when gameplay, Origin, or character-AI semantics are affected;
- remain focused enough that ownership and review are clear.

After merge, clean up the remote topic branch as required by `AGENTS.md`.

## Canonical design and documentation

Before adding a new design/documentation/configuration file, locate the existing canonical owner. Prefer updating that owner over creating overlapping sources of truth. When a rule changes, update or remove stale references in the same change rather than leaving contradictory active documentation.
