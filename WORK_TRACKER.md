# Open Fufu — Work Tracker

## Status and purpose

GitHub Issues are currently disabled for this repository. Until they are enabled, this file is the **canonical tracker for unresolved cross-cutting project work** that needs to be independently pick-up-able by future agents.

This is a task tracker, **not a mechanics owner**. It must not become a second copy of gameplay/API mechanics. Each item points to the canonical documents that own the actual contract; detailed decisions belong there.

If GitHub Issues are enabled later, migrate each open batch below into one GitHub issue and replace its tracker body here with a link/status only.

---

# Active review

## B2.2–B2.4 — service/version/source-traceability contracts

**Status:** In review in PR #28 (`b2/service-version-traceability`).

This is already tracked by the PR and is therefore not duplicated as an open issue below. Review/acceptance should happen before any follow-up implementation that depends on those contracts.

---

# Open batches

## INFRA-1 — Replace inherited OpenFront GitHub Actions / CI

**Status:** Open — should be done soon.

### Problem

The repository's current `.github/workflows/` and their pass/fail state are inherited OpenFront infrastructure. They are not yet a trustworthy Open Fufu acceptance signal.

### Canonical owner

- `docs/OPENFRONT_INTEGRATION_PLAN.md` — migration, validation, deployment, and CI implications.

### Scope

Audit every inherited workflow/check as one of:

- **keep** — still validates supported infrastructure/behavior;
- **adapt** — useful concept but must be changed for Open Fufu paths/contracts/runtime assumptions;
- **remove** — tied to obsolete OpenFront release/deployment/assets/mechanics.

Then establish the current Open Fufu PR baseline, including where applicable:

- TypeScript compile/typecheck;
- public controller-contract type fixtures;
- relevant migrated unit/integration tests;
- deterministic/headless/replay checks once those runtimes exist;
- repository hygiene that still applies.

### Acceptance

- Every inherited workflow has an explicit keep/adapt/remove disposition.
- Obsolete blocking checks are removed or replaced.
- Green/red PR status corresponds to meaningful Open Fufu validation for the implementation state that actually exists.
- Checks that cannot exist yet are identified as future gates rather than faked/stubbed as passing.
- No gameplay mechanics are changed merely to satisfy inherited CI.

### Do not

- preserve upstream checks solely because OpenFront had them;
- delete useful harnesses before checking whether they validate retained infrastructure;
- silently alter canonical mechanics to make old tests pass.

---

## B3.1 — Correct Origin validation/deployment-gate sequencing

**Status:** Open.

### Problem

The current migration dependency spine places the exhaustive Origin deployment gate before several mechanics/spawn systems that the gate must ultimately validate. A final exhaustive runtime gate cannot meaningfully certify behavior that has not been implemented yet.

### Canonical owners

- `docs/OPENFRONT_INTEGRATION_PLAN.md` — implementation sequencing and migration gate placement;
- `docs/ORIGIN_TRAIT_CATALOGUE.md` — Origin builder/trait semantics;
- focused mechanic owners for the systems transformed by Origins.

### Questions to close

Define the staged validation model, expected to distinguish at least:

1. an **early catalogue/schema/composition/math gate** that can run before all runtime mechanics exist;
2. a **final exhaustive runtime deployment gate** after every Origin-affected mechanic required for certification exists.

Determine exactly where those stages belong in the migration spine and what each is allowed to claim.

### Acceptance

- The dependency spine no longer requires an impossible pre-implementation exhaustive runtime validation.
- Early validation catches catalogue/composition/static-rule defects without pretending to certify missing runtime behavior.
- Final deployment validation occurs after all mechanics required by the Origin matrix are implemented.
- Cross-layer audit requirements remain intact.
- No Origin trait mechanic is changed merely to solve sequencing.

---

## B3.2 — Close Random/Fixed Spawn × spawn-transforming Origin semantics

**Status:** Open.

### Problem

`STRATEGIC_SPAWN.md` owns Strategic/Random/Fixed modes, but Random/Fixed interactions with spawn-transforming Origins remain mechanically unclosed.

### Canonical owners

- `docs/STRATEGIC_SPAWN.md` — spawn modes, resolver, footprint/profile semantics;
- `docs/ORIGIN_TRAIT_CATALOGUE.md` — the Origin-specific transformation itself, without duplicating spawn-system mechanics.

### Questions to close

At minimum resolve:

- how **P39** multi-origin behavior works in Random Spawn;
- whether Fixed Spawn requires multiple authored starts for P39, rejects the combination, transforms the fixed input deterministically, or uses another explicit rule;
- how P39 origin spacing/resolution works outside Strategic Spawn;
- how **P54** nonstandard starting-footprint geometry applies under Fixed Spawn;
- ordering/uniqueness semantics for spawn-time grants or other singular Origin effects when a profile has multiple origins;
- whether any mode/Origin combination is explicitly ruleset-disabled, and if so where that restriction is owned/validated.

### Acceptance

- Every spawn-transforming Origin has deterministic semantics in Strategic, Random, and Fixed modes or an explicit canonical incompatibility rule.
- No browser/controller timing or slot order creates spawn advantage.
- Replay/spawn snapshots contain enough information to reproduce the resolved result.
- The service/controller contracts consume the result without redefining the mechanics.
- Relevant deterministic tests/validation cases are specified.

---

## B3.3 — Define canonical `atWar` lifecycle / timeout semantics

**Status:** Open.

### Problem

The game uses `atWar` as a derived strategic state, including the canonical wartime Trade modifier, but the timeout/lifecycle for returning to non-war state is not defined.

### Canonical owners

- `docs/OPEN_FUFU_DESIGN.md` — game-wide hostility/war-state concept and lifecycle;
- `docs/FFY_ECONOMY.md` — consumes `atWar` for Trade effects, but must not own the war-state timer;
- Official AI documents may consume the state, but must not redefine it.

### Questions to close

Define:

- what events enter/refresh `atWar`;
- whether the state is pairwise, team-pairwise, faction-global, or another explicit scope;
- the exact timeout/exit condition;
- how simultaneous/continuous hostile activity refreshes it;
- deterministic tick/time representation;
- defeat/team changes/terminal-match cleanup behavior;
- what state controllers/AI may observe.

### Acceptance

- One deterministic owner defines `atWar` entry, refresh, scope, and exit.
- FFY Trade and AI consume that state by reference only.
- Replay/version binding can reproduce transitions exactly.
- Edge cases around continuing attacks and team relationships are specified.
- No unrelated diplomacy system is reintroduced.

---

## B3.4 — Close Minor Faction placement and territorial attack commitment

**Status:** Open.

### Problem

The Minor Faction/Goon owner defines baseline existence/count/territory/population constraints, but two implementation-critical mechanics remain unresolved:

1. deterministic placement degradation/failure when ideal placement constraints cannot all be satisfied;
2. the Population commitment rule for territorial attacks.

### Canonical owner

- `docs/MINOR_FACTIONS.md`.

Neighboring game-wide Population/capture/defense rules remain owned by `docs/OPEN_FUFU_DESIGN.md`; Minor Factions should inherit those unless an explicit Minor-specific delta is required.

### Questions to close

#### Placement

- deterministic candidate ordering/search;
- how the 50-cell spacing requirement degrades, if it may degrade at all;
- behavior when the requested Goon count cannot be placed legally;
- whether map compilation/startup fails, count is reduced, spacing is reduced by a defined sequence, or another deterministic policy applies;
- diagnostics/replay binding for the resolved placements.

#### Territorial attacks

- how much Minor-Faction Population is committed to an attack;
- how targets/fronts are selected under their simple behavior model;
- how commitment interacts with ordinary automatic defense/capture rules;
- deterministic cadence/retargeting/retreat behavior required for implementation.

### Acceptance

- The same map/rules/seed always yields the same Minor-Faction count/placement result.
- Impossible-placement behavior is explicit rather than implementation-defined.
- Territorial attacks have one deterministic Population commitment rule.
- Minor Factions inherit ordinary mechanics rather than copying/redefining them unnecessarily.
- P19 interaction remains compatible with the final placement/count semantics.

---

# Closed / not open here

- **B1 — Documentation centralization:** merged.
- **B2.1 — Controller API contract:** merged via PR #27.
- **B2.2–B2.4:** currently under review in PR #28; tracked by that PR until accepted/rejected.

When a batch above is completed, replace its detailed open body with a short completion note and the merged PR/commit reference. Git history preserves the old task text.