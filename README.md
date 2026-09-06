# Open Fufu

Open Fufu is being built from the OpenFront codebase. The inherited engine, client, server, tooling, assets, and documentation remain useful migration inputs, but inherited OpenFront behavior is **not** an Open Fufu target contract.

Start here for repository authority:

- [`AGENTS.md`](./AGENTS.md) — repository workflow and canonical-authority policy;
- [`docs/README.md`](./docs/README.md) — canonical owner map;
- [`docs/OPEN_FUFU_DESIGN.md`](./docs/OPEN_FUFU_DESIGN.md) — high-level target game and cross-system invariants;
- [`docs/OPENFRONT_INTEGRATION_PLAN.md`](./docs/OPENFRONT_INTEGRATION_PLAN.md) — OpenFront → Open Fufu migration/runtime architecture.

When inherited OpenFront material conflicts with a registered Open Fufu canonical owner, the Open Fufu owner wins.

## Development setup

### Prerequisites

- Node/npm compatible with the versions declared by the repository;
- a modern browser for the inherited/current browser client.

### Clone

```bash
git clone https://github.com/R-Andrei/open-fufu-io.git
cd open-fufu-io
```

### Install dependencies

```bash
npm run inst
```

`npm run inst` uses `npm ci --ignore-scripts`; use that repository command rather than substituting `npm install`.

### Run the current development application

```bash
npm run dev
```

Individual processes are also available:

```bash
npm run start:client
npm run start:server-dev
```

The currently runnable application still contains inherited OpenFront behavior. Running it is useful for migration, regression, rendering, and tooling work; it is not evidence that unimplemented Open Fufu target mechanics already exist.

## Common checks

```bash
npm run build-prod
npm run lint
npm test
npm run test:server
npm run format
```

Use the checks relevant to the files and subsystem being changed, together with the repository-specific requirements in `AGENTS.md` and the owning canonical contract.

## Repository layout

- `/src/client` — browser client/rendering/UI;
- `/src/core` — shared deterministic simulation and public controller/rules surfaces;
- `/src/server` — server/runtime code;
- `/design` — code-readable design-time configuration registered as canonical where listed in `docs/README.md`;
- `/docs` — Open Fufu canonical documents, gateways, and inherited references;
- `/resources` — static assets and game resources;
- `/zbin` — compact binary wire-format tooling;
- `/map-generator` — inherited/adapted map-generation tooling.

Do not infer canonical ownership from directory location alone; use `docs/README.md`.

## Inherited OpenFront material

This fork descends from OpenFront, which in turn is a fork/rewrite of WarFront.io. Inherited source files, historical documentation, assets, and tooling remain subject to their applicable licenses and attribution requirements.

## License

Source code remains licensed under the **GNU Affero General Public License v3.0**. See [`LICENSE`](./LICENSE), [`LICENSE-ASSETS`](./LICENSE-ASSETS), and [`LICENSING.md`](./LICENSING.md) for the applicable source/asset licensing and history.
