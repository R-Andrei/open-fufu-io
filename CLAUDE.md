# CLAUDE.md

Repository guidance for Claude Code and similar coding agents.

## Mandatory repository policy

Read and follow [`AGENTS.md`](./AGENTS.md) before work, including its claim/branch discipline, current-main reconciliation requirements, canonical-authority synchronization protocol, and validation/audit requirements.

For design or mechanics questions, use [`docs/README.md`](./docs/README.md) to locate the single canonical owner. Do not treat inherited OpenFront documentation, current implementation behavior, this file, or a GitHub issue as a substitute mechanics authority.

Key entry points:

- high-level Open Fufu target: [`docs/OPEN_FUFU_DESIGN.md`](./docs/OPEN_FUFU_DESIGN.md);
- OpenFront → Open Fufu migration/runtime architecture: [`docs/OPENFRONT_INTEGRATION_PLAN.md`](./docs/OPENFRONT_INTEGRATION_PLAN.md);
- repository validation/test ownership: [`docs/VALIDATION_POLICY.md`](./docs/VALIDATION_POLICY.md);
- complete canonical-owner map: [`docs/README.md`](./docs/README.md).

## Commands

Use repository scripts rather than inventing alternate install/build flows:

```bash
npm run inst                 # npm ci --ignore-scripts
npm run dev                  # current client + server development application
npm run start:client         # client only
npm run start:server-dev     # development server only
npm test                     # Open Fufu-owned test allowlist only
npm run test:coverage        # coverage for the same owned test surface
npm run legacy:test:server   # inherited server suite; manual historical investigation only
npm run lint                 # repository lint utility; not a normal inherited-code merge gate
npm run lint:fix             # lint with auto-fix
npm run lint:github          # CI-oriented lint output utility
npm run format               # Prettier
npm run build-prod           # inherited/current application build utility; not a normal merge gate
```

`npm test` and plain/default `vitest run` are intentionally manifest-backed and must discover only tests registered in [`validation/open-fufu-owned.json`](./validation/open-fufu-owned.json). Do not restore broad test discovery, exclusion-based inherited test sweeps, or generic repository-wide build/lint gates during the documentation-first redesign phase.

For a focused Open Fufu-owned test, choose an explicitly registered file from the ownership manifest, for example:

```bash
npx vitest run tests/RuleComposition.test.ts
```

Do not use an inherited/unregistered test as a correctness gate merely because it exists. If a previously inherited subsystem is intentionally adopted, follow `docs/VALIDATION_POLICY.md`: adopt the exact source, add or update appropriate focused validation in the same change, and register the source-to-validator relationship.

## Current inherited implementation versus target architecture

Much of `src/` still descends from OpenFront. Treat those files as migration source and current implementation evidence, not as automatic Open Fufu design authority.

Useful inherited/current seams include:

- `src/core/` — shared game/simulation state and deterministic execution infrastructure;
- `src/client/` — browser rendering/UI and client communication;
- `src/server/` — server/lobby/network/runtime infrastructure;
- `src/core/Schemas.ts` and `src/core/ZbinWire.ts` — inherited/current message schema and wire infrastructure;
- `src/core/GameRunner.ts` — inherited/current simulation orchestration;
- `src/server/GameServer.ts` — inherited/current game-server integration.

The accepted target architecture is server-authoritative and is defined by the canonical Open Fufu owners. Do not perpetuate browser-authoritative simulation, inherited Intent/Turn semantics, inherited bot privilege, or inherited mechanics merely because the current source still contains them.

When adapting an inherited subsystem:

1. locate its target owner in `docs/README.md`;
2. use `OPENFRONT_INTEGRATION_PLAN.md` for migration/source-traceability boundaries;
3. preserve useful implementation machinery only where it conforms to the target owner;
4. update all synchronized owners/configuration/code comments required by `AGENTS.md` rather than creating a second semantic copy;
5. follow `VALIDATION_POLICY.md` so executable adoption and appropriate focused validation happen together.

## UI text / i18n

For inherited/current UI using the existing localization system, user-visible text goes through `translateText()` with the corresponding English entry in `resources/lang/en.json`. Do not edit other translation files merely to duplicate English-source changes.

## Testing patterns

Existing inherited tests and helpers such as `tests/util/Setup.ts` or map fixtures under `tests/testdata/maps/` may be useful migration evidence or reusable infrastructure, but they are not automatically maintained Open Fufu contracts.

- Normal validation runs only the explicit owned-test allowlist.
- Do not edit or revive inherited tests unless the corresponding subsystem is deliberately adopted.
- New Open Fufu executable code must be registered with appropriate focused tests/validators in the same change.
- Changing inherited executable code must not silently make that subsystem maintained.
- Repository-wide inherited build, lint, unit, integration, browser, server, matchmaking, replay, or performance validation is not a normal merge gate during the current redesign phase.

The canonical rules are in [`docs/VALIDATION_POLICY.md`](./docs/VALIDATION_POLICY.md); the machine-readable registry is [`validation/open-fufu-owned.json`](./validation/open-fufu-owned.json).

## Tooling notes

- The current bundler/client tooling uses Vite, TypeScript, Lit, Tailwind, Pixi.js, and Vitest.
- `zbin/README.md` documents the compact binary wire-format library.
- `docs/Architecture.md`, `docs/Auth.md`, `docs/API.md`, `docs/Maps.md`, and other files classified as inherited/current-state references in `docs/README.md` are evidence/navigation only, not target authorities.
