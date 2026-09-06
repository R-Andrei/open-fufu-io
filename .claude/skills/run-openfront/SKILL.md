---
name: run-openfront
description: Build, run, and drive the repository's current inherited/OpenFront-derived browser application locally for UI, rendering, regression, and migration testing.
---

# Current browser-app harness

This skill drives the **currently runnable inherited/OpenFront-derived application**. It is useful for UI/rendering checks, migration regressions, screenshots, and inspecting current implementation behavior.

It is **not** a canonical Open Fufu mechanics/runtime authority or a normal correctness gate. Browser-local state exposed by the current app is implementation evidence only; target Open Fufu behavior must be judged against `AGENTS.md`, `docs/README.md`, `docs/VALIDATION_POLICY.md`, and the registered canonical owner for the concern.

The current development application is a Lit + Pixi.js browser client with a Node server. Run it with:

```bash
npm run dev
```

The current Vite development port is **9000**. Harness files live in this directory and all paths below are relative to repository root.

## Prerequisites

Install repository dependencies with:

```bash
npm run inst
```

Do not substitute `npm install` for the repository install command.

For the repository's headless Chromium harness on the Ubuntu host, run:

```bash
bash .claude/skills/run-openfront/setup.sh
```

`setup.sh` installs the local Playwright dependency/browser support used by this harness without requiring root and prepares the local library/fontconfig cache expected by `driver.mjs`.

## Start/stop the development application

```bash
(npm run dev > /tmp/dev.log 2>&1 &)
timeout 60 bash -c 'until curl -sf http://localhost:9000 >/dev/null 2>&1; do sleep 1; done'
```

Stop the current client/server development processes with:

```bash
pkill -f "tsx src/server/Server.ts"
pkill -f vite
```

Inherited development paths may emit API-related errors when the external OpenFront service is unavailable. Treat those as current-app diagnostics; do not encode them as Open Fufu target behavior.

## Browser smoke flow

Run the existing driver:

```bash
node .claude/skills/run-openfront/driver.mjs
```

The driver writes its harness screenshots under `/tmp/openfront-run/`.

For an ad-hoc browser flow, place the script inside the repository so local `playwright` resolution works, then import helpers from the driver:

```js
import {
  launch,
  gotoHome,
  openSoloModal,
} from "./.claude/skills/run-openfront/driver.mjs";

const { browser, page } = await launch();
await gotoHome(page);
await openSoloModal(page);

const selectedMap = await page.evaluate(
  () => document.querySelector("map-picker")?.selectedMap,
);

await browser.close();
```

Lit components in the current client use light DOM, so direct element/property inspection is available where the implementation exposes it.

## Full inherited-game flow

`game.mjs` drives the current single-player application through spawn, expansion/attack, radial-menu interaction, and current browser-simulation inspection:

```bash
node .claude/skills/run-openfront/game.mjs
```

For ad-hoc current-game flows:

```js
import {
  launch,
  gotoHome,
  openSoloModal,
} from "./.claude/skills/run-openfront/driver.mjs";
import {
  startSoloGame,
  gameState,
  findSpawnTile,
  spawn,
  waitForSpawnPhaseEnd,
  waitForTick,
  findExpansionTile,
  attack,
  clickWorld,
  panTo,
  setAttackRatio,
  openRadialMenu,
} from "./.claude/skills/run-openfront/game.mjs";

const { browser, page } = await launch({ rafIntervalMs: 3000 });
await gotoHome(page);
await openSoloModal(page);
await startSoloGame(page, { bots: 50 });
const tile = await spawn(page);
await waitForSpawnPhaseEnd(page);
const target = await findExpansionTile(page, tile);
await attack(page, target.x, target.y);
await browser.close();
```

### Current-app interaction notes

- `hud/GameRenderer.ts` currently exposes the browser `GameView` and `TransformHandler` through the `<build-menu>` element. This permits regression inspection without repository instrumentation, but it is **not** the target server-authoritative Open Fufu observation model.
- For headless in-game rendering, use `launch({ rafIntervalMs: 3000 })`. The harness throttles `requestAnimationFrame` so SwiftShader rendering does not starve the current browser-local simulation loop.
- Current solo-modal options can be set as element properties before clicking Start; `startSoloGame` wraps that behavior.
- Use `clickWorld` rather than raw screen-coordinate clicks. It accounts for tile-center targeting, UI overlays, and camera motion in the current client.
- `spawn`, `attack`, `findExpansionTile`, and the other helpers operate against **inherited/current** spawn/combat semantics. They are regression helpers, not specifications for Open Fufu target mechanics.
- A blank WebGL canvas is a harness/rendering failure. Check WebGL2 creation and the local `LD_LIBRARY_PATH`/fontconfig prepared by `setup.sh`.

## Human path

```bash
npm run dev
```

Then open `http://localhost:9000` in a browser.

## Validation boundary

The browser harness is an explicit current-app diagnostic. It does not make inherited application behavior or inherited tests part of the maintained Open Fufu correctness surface.

For normal repository validation, use:

```bash
npm test
```

That command and plain/default `vitest run` are intentionally restricted to the tests registered in `validation/open-fufu-owned.json`. Do not recommend or run arbitrary inherited tests as normal validation merely because they exist. If an inherited test is useful for historical investigation, keep that use explicitly diagnostic/non-gating; if its subsystem becomes authoritative Open Fufu code, adopt it under `docs/VALIDATION_POLICY.md` with appropriate focused owned validation.

A successful browser smoke test does not replace canonical mechanics, owned tests/validators, headless-runtime, determinism, or integration checks required by the adopted subsystem.

## Harness troubleshooting

- `Cannot find package 'playwright'`: keep the ad-hoc script inside the repository so package resolution reaches the local dependency.
- Chromium launch failure after the local harness cache was removed: rerun `bash .claude/skills/run-openfront/setup.sh`.
- `EADDRINUSE`: stop the previous development processes with the commands above.
- Existing tabs can retain stale Lit custom-element code under HMR; hard reload or navigate again before judging an edit.
- The current responsive UI may render multiple matching controls; use visible-element selectors rather than assuming one DOM instance.

If the current harness and a canonical Open Fufu contract disagree, record the implementation gap; do not rewrite the canonical contract to match inherited browser behavior.
