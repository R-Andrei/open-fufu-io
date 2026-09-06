# CLAUDE.md

Repository guidance for Claude Code and similar coding agents.

## Mandatory repository policy

Read and follow [`AGENTS.md`](./AGENTS.md) before work, including its claim/branch discipline, current-main reconciliation requirements, canonical-authority synchronization protocol, and validation/audit requirements.

For design or mechanics questions, use [`docs/README.md`](./docs/README.md) to locate the single canonical owner. Do not treat inherited OpenFront documentation, current implementation behavior, this file, or a GitHub issue as a substitute mechanics authority.

Key entry points:

- high-level Open Fufu target: [`docs/OPEN_FUFU_DESIGN.md`](./docs/OPEN_FUFU_DESIGN.md);
- OpenFront → Open Fufu migration/runtime architecture: [`docs/OPENFRONT_INTEGRATION_PLAN.md`](./docs/OPENFRONT_INTEGRATION_PLAN.md);
- complete canonical-owner map: [`docs/README.md`](./docs/README.md).

## Commands

Use repository scripts rather than inventing alternate install/build flows:

```bash
npm run inst             # npm ci --ignore-scripts
npm run dev              # current client + server development application
npm run start:client     # client only
npm run start:server-dev # development server only
npm test                 # non-server Vitest suite
npm run test:server      # server Vitest suite
npm run test:coverage    # non-server tests with coverage
npm run lint             # Oxlint + ESLint
npm run lint:fix         # Oxlint + ESLint with auto-fix
npm run lint:github      # CI-oriented lint output
npm run format           # Prettier
npm run build-prod       # typecheck + production build + asset hashes
```

Single-test examples:

```bash
npx vitest tests/YourTest.test.ts --run
npx vitest NationAllianceBehavior --run
```

Apply the validation required by `AGENTS.md` and the changed subsystem's canonical owner in addition to these generic commands.

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
4. update all synchronized owners/configuration/code comments required by `AGENTS.md` rather than creating a second semantic copy.

## UI text / i18n

For inherited/current UI using the existing localization system, user-visible text goes through `translateText()` with the corresponding English entry in `resources/lang/en.json`. Do not edit other translation files merely to duplicate English-source changes.

## Testing patterns

Existing tests commonly use `setup()` from `tests/util/Setup.ts` and map fixtures under `tests/testdata/maps/`. Reuse existing test infrastructure where it is semantically appropriate, but do not preserve tests whose assertions are intentionally superseded by an Open Fufu canonical owner.

## Tooling notes

- The current bundler/client tooling uses Vite, TypeScript, Lit, Tailwind, Pixi.js, and Vitest.
- `zbin/README.md` documents the compact binary wire-format library.
- `docs/Architecture.md`, `docs/Auth.md`, `docs/API.md`, `docs/Maps.md`, and other files classified as inherited/current-state references in `docs/README.md` are evidence/navigation only, not target authorities.
