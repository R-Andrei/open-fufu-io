# Open Fufu — Origin Validation Coverage Registry

## Status and authority

This file is the **canonical owner for Origin trait validation coverage, mechanical dependency traces, required integration seams, external validation dependencies, and explicit Origin-interaction test obligations**.

It does **not** own Origin mechanics, costs, builder legality, subsystem baselines, or unresolved gameplay semantics. Those remain with their canonical owners:

- Origin mechanics/costs/composition: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md);
- game-wide Population/territory/combat invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- migration validation architecture/deployment eligibility: [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md);
- Strategic Spawn: [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md);
- FFY/Train/Trade economy: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- terrain/persistent structures/baseline Tank: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Warships/Transports/strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- combat tuning: [`COMBAT_TUNING.md`](./COMBAT_TUNING.md);
- Minor Factions: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md).

Trait-effect wording here is explanatory shorthand only. If it disagrees with a mechanic owner, the mechanic owner wins and this registry must be corrected.

---

# 1. Coverage model

Do not reduce coverage to `trait -> domains[]`. Every trait audit distinguishes:

1. **Direct transformation** — the subsystem whose rule/value/permission/state the trait directly changes. That subsystem owns conformance validation.
2. **Required integration seam** — a subsystem boundary crossed by trait-specific state/event flow that requires explicit integration coverage.
3. **External semantic dependency** — canonical state/mechanics the trait reads without owning. Unresolved dependencies may make validation `BLOCKED`/`UNAVAILABLE`.
4. **Ordinary downstream consumption** — once canonical state is produced correctly, ordinary consumers do not gain redundant trait-specific tests merely because the state originated from an Origin.

For each trait also identify:

- meaningful same-hook/cross-system Origin interactions;
- negative assertions/non-effects needed to prevent over-broad implementation;
- mechanic-definition holes that prevent honest certification.

Mechanic holes are recorded here only as blockers/references. This file must not invent the missing gameplay rule.

---

# 2. P01–P10 coverage

## P01 — Domain Expansion

**Direct transformation / owner**

- Strategic Spawn.
- Modifies the final Initial-Territory population-bearing quota; Spawn must generate against the modified total rather than apply the bonus after footprint resolution.

**Required seams / dependencies**

- `Spawn -> territorial ownership -> Population initialization`.
- Final ownership must contain the modified population-bearing quota when reachable legal geography permits it.
- Capacity must reflect those owned population-bearing cells.
- Starting Population must use the final modified Initial Territory. With the ordinary 1,000 baseline, current values imply `1,150 Capacity / 575 Starting Population` when all quota cells are population-bearing.
- Depends on faction-effective population-bearing classification used by Spawn quota accounting.

**Explicit interactions**

- `P01 + P39`: split the **modified total** quota; do not apply P01 independently to two ordinary quotas. Current result: `575 + 575`, one global Starting Population pool of `575`.
- `P01 + P54`: star geometry preserves the modified total quota.
- Inspect P48 when audited because it changes faction-specific population-bearing classification.
- `P01 + P39 + P54` is not currently builder-legal (`22` positive points), so it is not a required public runtime combination.

**Ordinary propagation / non-effects**

- Once ownership/Capacity/Starting Population are correct, growth, defense, commitments, etc. consume ordinary valid Population state; they are not P01-specific mechanics.

---

## P02 — The Era of Humans

**Direct transformation / owner**

- Game-wide Population Growth.
- Replaces the ordinary utilization curve `U(u)` while leaving base Capacity scaling and unrelated explicit growth modifiers on their normal hooks.

**Required seams / dependencies**

- Replacement utilization must still compose through the ordinary final-growth pipeline with terrain-share growth, City growth, and other explicit growth modifiers.
- Reads `Total Population`, `Population Capacity`, and the canonical growth-composition order.

**Explicit interactions**

- `P02 + N01`: P02 changes utilization; N01 changes City-derived growth. Neither may replace the other's hook.
- Inspect P48 later because Capacity affects base growth and utilization; this may be ordinary state propagation rather than a special implementation path.

**Blocker**

- The canonical implementation must have the actual accepted `30–70%` replacement curve/anchors. Validation must not invent them.

---

## P03 — Imagine Breaker

**Direct transformation / owner**

- Land-combat effective defensive-pressure composition.
- Removes hostile **Fort-derived** defensive-pressure contribution for attacks by the P03 holder; unrelated defensive sources remain.

**Required seams / dependencies**

- `Fort effective field -> land-combat defensive pressure`.
- Test outside Fort coverage, inside coverage without an automatic defender, and inside coverage with a real automatic defender.
- Depends on effective Fort coverage/magnitude and the rule that Forts do not manufacture defenders.

**Explicit interactions**

- `P03 + P09`: ignore the effective P09-modified Fort contribution.
- `P03 + N08`: P03 becomes inert against an already-zero Fort contribution.
- `P03 + N10`: reduced Fort coverage changes where a contribution exists.
- Negative assertion: non-Fort defense such as later P51 Command-Post defense must not be removed.

**Ordinary propagation**

- Faster resulting capture progress is normal combat output, not a separate P03 territory mechanic.

---

## P04 — Level 0

**Direct transformation / owner**

- Active counter-response combat.
- Fixes only response-side counter-response effectiveness at `1.0`; attack-side effectiveness remains ordinary.

**Required seams / dependencies**

- No separate subsystem seam currently required.
- Test parity, small/large attacker advantage, and small/large responder advantage.
- Depends on canonical `A/R` imbalance calculation and deterministic casualty/residual accounting.

**Explicit interactions**

- No mandatory Pxx/Nxx pair identified yet. Generic Echo/ruleset modifications of the same surfaced hooks belong to effective-rule composition validation unless a specific interaction emerges.

---

## P05 — Big Shot

**Direct transformation / owner**

- Cross-domain by construction.
- Trigger: territorial/structure capture lifecycle.
- Output: FFY Economy, as a Military/conquest event.

**Required seams / dependencies**

- `successful qualifying enemy-structure transfer -> exactly one P05 conquest FFY event -> ordinary Military/conquest modifier pipeline`.
- Failed capture, structureless capture, or destruction instead of transfer must not fire P05.
- Depends on canonical structure-transfer event identity plus the P05 event's base value and event location where spatial FFY rules consume it.

**Explicit interactions**

- `P05 + N17`: N17 destroys instead of transfers; P05 must not fire.
- `P05 + P34`: captured Factory transformation and P05 event must coexist on one ownership transition.
- Inspect P14/P24 after P05 event-location semantics are closed.

**Blocker**

- The inspected canonical material identifies the P05 event family but does not close its base-value rule or location semantics.

---

## P06 — See You, Space Cowboy

**Direct transformation / owner**

- Trade Ship physical movement/lifecycle in the FFY/Trade subsystem.
- Applies `+25%` physical Trade Ship speed.

**Required seams / dependencies**

- `Trade Ship motion -> Warship pursuit/capture` must consume the modified physical speed.
- Depends on ordinary route/movement and Warship pursuit/capture geometry.

**Non-effects**

- Must not by itself modify planned route length, raw cargo, dispatch cadence, destination policy, or payout multipliers.

**Explicit interactions**

- No dedicated P06+P08 case is required: movement speed and wartime payout are independent hooks.
- Revisit capture/piracy traits P30/N14/N16 when audited if they create a genuine same-lifecycle interaction.

---

## P07 — Galaxy Express 999

**Direct transformation / owner**

- Factory Train dispatch scheduler / Train economy.
- Each Factory has its own normal-primary-dispatch count; every fourth dispatch adds one simultaneous bonus Train.
- Bonus Train does not consume/delay the primary slot and receives an independently generated deterministic ordinary route.

**Required seams / dependencies**

- `persistent Factory lifecycle -> per-Factory P07 scheduler`.
- `bonus Train -> ordinary Train route/event/dwell/destruction/interception/replay lifecycle`.
- Expected primary dispatch sequence: `1,1,1,2,1,1,1,2...`, independently per Factory.
- Train destruction must not reset the Factory's sequence.

**Explicit interactions**

- `P07 + P33`: bonus Trains must generate ordinary qualifying Train events and therefore eligible P33 Population gains.
- Inspect P34's `2x ordinary Factory effect` against the explicit P07 scheduler.
- N09 may prevent building Factories but does not suppress P07 for a legally acquired Factory.
- N17 may prevent such acquisition by destroying the Factory instead.

**Blocker**

- Per-Factory primary-dispatch counter behavior across Factory ownership transfer should be canonically explicit before certification.

---

## P08 — Tea Time

**Direct transformation / owner**

- FFY external-trade calculation.
- Replaces the earning-side wartime external-trade multiplier `0.50x -> 1.00x` wherever that canonical hook is consumed, including maritime and rail external trade.

**Required seams / dependencies**

- `atWar lifecycle -> maritime external-trade payout`.
- `atWar lifecycle -> rail external-trade payout`.
- Test peace, entry, sustained/refreshed war, expiration/exit, and both trade channels.
- Depends on canonical symmetric `atWar` lifecycle/timeout.

**Explicit interactions**

- Inspect N14/N16 when audited because they snapshot/use owner-side voyage value around hostile capture.
- No bespoke P06/P07 pair is required when those traits independently change speed/count.

**Blocker/status**

- Affected conformance remains `BLOCKED`/`UNAVAILABLE` until canonical `atWar` semantics are closed/implemented; validation does not invent a temporary timeout.

---

## P09 — Wall Maria

**Direct transformations / owners**

- Persistent Fort profile/transaction: Fort coverage area, Fort FFY cost.
- Fort defensive-pressure profile, consumed by land combat.

**Required seams / dependencies**

- `Fort effective field -> automatic-defense / land-combat pressure`: outside coverage, inside with no defender, inside with real defender.
- `effective Fort price -> canonical structure affordability/payment transaction`.
- Depends on level-dependent Fort baselines, defender presence, and structure cost-composition order.

**Explicit interactions**

- P03 ignores the P09-enhanced Fort contribution.
- P18 consumes Fort coverage; P09 changes the qualifying area.
- P24 consumes Fort area for event-location qualification.
- P50 consumes effective Fort defensive magnitude and coverage; P09 changes both.
- N08 removes Fort defensive benefit; N10 modifies the same coverage axis.
- Inspect P21 because ordinary affordability/legality is checked before its first-purchase zero-consumption rule.

**Blockers / mechanic-expression findings**

- `+10% Fort coverage area` needs deterministic representation against radius-based baseline data.
- `+9% Fort defensive pressure` needs unambiguous composition against level-dependent baseline Fort values.

---

## P10 — Scorpion's Tail

**Direct transformation / owner**

- Strategic-weapon projectile/motion mechanics.
- Applies `+100%` speed to the canonical projectile class(es) covered by `warhead projectile speed`.

**Required seams / dependencies**

- `projectile motion -> SAM interception`.
- `projectile motion -> MIRV separation` where the affected class participates; changing speed must preserve canonical physical separation semantics while changing elapsed time.
- `projectile motion -> replay/determinism`.
- Depends on canonical projectile classification, deterministic motion, physical-entry interception, and MIRV carrier/separation semantics.

**Non-effects**

- Does not by itself change blast geometry/effect, weapon cost, launcher legality, MIRV target distribution, or payload count.

**Blocker**

- Canonical rules must identify whether `warhead projectile speed` includes Atom/Hydrogen projectiles, the pre-separation MIRV carrier, and/or separated MIRV warheads.

---

# 3. P11–P20 coverage

## P11 — Level Upper

**Direct transformations / owners**

- Population lifecycle: tracks **peak Total Population reached during the match** as an entitlement input.
- Persistent SAM structure legality: each full `25,000` peak Population permanently unlocks one SAM ownership/build slot.
- Persistent SAM transaction: P11 SAM FFY cost is `0`; ordinary non-FFY legality remains.

**Required seams / dependencies**

- `Population initialization/growth/loss -> monotonic peak-Population tracker -> permanent SAM-slot entitlement`.
- Starting Population contributes to the initial peak; later losses must not revoke already unlocked slots.
- `SAM-slot entitlement -> structure ownership/build legality` must reject owning/building beyond the currently unlocked permanent slot count while permitting legal zero-FFY purchases within it.
- SAM charge/range/interception behavior remains the ordinary SAM subsystem unless another trait changes it.

**Explicit interactions**

- `P11 + N07`: N07's one-of-each-structure cap and P11's unlocked-SAM-slot cap both apply; effective ownership legality must satisfy both rather than treating either as an override.
- `P11 + P40`: P11 controls cost/ownership entitlement while P40 transforms the SAM's charge/range/recharge profile. Same-domain projection coverage must include the combined effective SAM state.
- `P11 + P27`: inspect when P27 is audited because it changes SAM target legality while P11 changes how many SAMs may exist and their cost.
- `P11 + P21`: first-SAM purchase remains a purchase even though P11 makes its FFY price zero; P21 must not change P11's permanent slot entitlement or create an extra SAM slot.

**Ordinary propagation / non-effects**

- Population changes after peak tracking are ordinary Population state. P11 does not modify growth merely because growth may unlock future slots.

---

## P12 — Somewhere Not Here

**Direct transformation / owner**

- Naval/amphibious Transport lifecycle.
- Applies `+25%` Transport Ship movement speed.

**Required seams / dependencies**

- `Transport physical movement -> Warship interception/destruction` must consume the modified speed.
- `Transport arrival -> ordinary amphibious landing engagement` occurs sooner in elapsed time but uses the same political/capture rules.
- Abort/return movement also uses the effective Transport speed unless a focused owner explicitly defines another movement profile.

**Non-effects**

- P12 alone does not change Transport cap, embarked Population, embarkation FFY cost, landing casualties, landing legality, or return-loss percentage.

**Explicit interactions**

- P32/P37/N13/N15 all alter the Transport lifecycle on other axes. Their combined effective Transport projections should be runtime-covered when legal, but no special P12-only interaction formula is required merely because speed coexists with armor, cost, landing-Fort, or landing-loss transformations.

---

## P13 — Mountain Training Arc

**Direct transformation / owner**

- Land-combat terrain defensive-pressure composition.
- Adds the canonical P13 Mountain defensive-pressure effect when the defended target cell is Mountain.

**Required seams / dependencies**

- `target base terrain -> Mountain defensive modifier -> final local defensive pressure`.
- Must preserve the distinction between terrain defense and Fort/Command/other defensive sources.
- Depends on canonical Mountain terrain identity and the ordinary pressure-composition pipeline.

**Explicit interactions**

- `P13 + P03` negative assertion: P03 removes Fort-derived defense only and must not remove Mountain defense.
- Fort/Command defensive sources and P13 may coexist on one target; representative pressure-composition property tests should cover multiple independent sources without creating an all-pairs Origin matrix.

**Non-effects**

- P13 does not change Mountain capture-speed multiplier, traversability, spawn eligibility, FFY event location, or terrain identity.

---

## P14 — 60 Billion Double Dollars

**Direct transformation / owner**

- FFY event-yield calculation with a terrain-location condition.
- Qualifying FFY events whose canonical event location is Desert receive the P14 `+33%` yield contribution through the ordinary FFY modifier pipeline.

**Required seams / dependencies**

- `canonical FFY event -> event location -> base-terrain lookup -> Desert qualification -> FFY yield composition`.
- Fallout overlay must not erase underlying Desert identity because Fallout preserves base terrain.
- Depends on each event family having a canonical spatial location when it is eligible for location-conditioned modifiers.

**Explicit interactions**

- `P14 + P24`: an event may be both on Desert and inside Fort coverage; both eligible ordinary yield percentages must compose through the canonical same-axis FFY rule.
- `P14 + N11`: a Desert event inside an applicable SAM area still follows N11's explicit hard-zero semantics after ordinary yield composition; P14 must not resurrect a hard-zero event.
- Revisit P05 once P05 event-location semantics are closed.

**Non-effects**

- P14 does not alter Desert share, territory ownership, Desert capture speed, or non-spatial FFY events with no qualifying Desert location.

---

## P15 — The High Ground

**Direct transformation / owner**

- Land-combat source offensive-pressure composition.
- Adds the canonical P15 offensive-pressure effect when an engagement lane's attacking **source cell** is Highland.

**Required seams / dependencies**

- `attacking source cell terrain -> Highland qualification -> final lane offensive pressure`.
- Depends on canonical source-cell terrain identity and ordinary pressure composition.

**Explicit interactions**

- P18, P19, P50, Command-Post offense, and terrain offense may all contribute to the same final lane pressure. Validation should include representative multi-source composition/property cases rather than pairwise tests for every offensive modifier.
- Negative terrain assertion: P15 applies from the source cell's Highland identity; target terrain does not trigger it.

**Non-effects**

- Does not change Highland traversal, capture speed, target defense, or territory ownership rules.

---

## P16 — Poison Taster

**Direct transformation / owner**

- Terrain/acquisition progress.
- Ignores only the ordinary Fallout capture/settlement resistance multiplier for the P16 holder; underlying terrain remains unchanged.

**Required seams / dependencies**

- `Fallout overlay + underlying conquerable terrain -> capture/settlement multiplier -> final acquisition progress`.
- Must work for otherwise legal hostile capture and neutral settlement without changing settlement Population cost or ordinary pressure.
- Depends on canonical Fallout overlay semantics and underlying terrain acquisition rules.

**Explicit interactions**

- `P16 + N05`: N05's hard prohibition on capturing Fallout still prevents capture; P16 does not convert an illegal action into a legal one.
- `P16 + N18`: canonical legal inversion — P16 removes Fallout penalty while N18 continues to halve **non-Fallout** acquisition only.
- `P16 + P35` and `P16 + P44`: those traits create Fallout; P16 affects later acquisition of Fallout by the holder when otherwise legal. The creation mechanics remain owned by P35/P44 domains.

**Non-effects**

- No change to Fallout terrain identity, Capacity classification, traversal, structure legality, pressure, or nuclear casualties.

---

## P17 — Ten Billion Percent

**Direct transformation / owner**

- Persistent-structure upgrade transaction pricing.
- Effective upgrade-cost multiplier is `0.99^S`, where `S` is the holder's current owned persistent-structure count.

**Required seams / dependencies**

- `current structure ownership registry -> S -> deterministic effective upgrade price -> ordinary affordability/payment transaction`.
- Ownership changes through construction, capture, destruction, and grants must update the ordinary structure count consumed by P17.
- P17 applies to upgrades, not arbitrary structure purchases unless another canonical rule explicitly consumes the upgrade-price hook.

**Explicit interactions**

- `P17 + N06`: N06 forbids FFY upgrade spending; P17 may compute a lower price but must not bypass the prohibition.
- `P17 + P09`: Fort upgrades may have both P09 Fort-cost modification and P17 structure-count upgrade modification; they must compose through the canonical structure price pipeline rather than duplicate price calculations.
- `P17 + P41`: P41 is a direct L5 **purchase**, not an upgrade action. Validation must follow P41's canonical definition of its `95% of cumulative ordinary` price rather than automatically applying P17 as though P41 executed four upgrade transactions.
- N07/N17/P20 and other ownership-changing mechanics influence `S` only through the canonical current structure registry unless a later explicit interaction says otherwise.

**Implementation requirement**

- `0.99^S` and final FFY pricing must use deterministic numeric/rounding representation; certification compares canonical results rather than platform-dependent floating behavior.

---

## P18 — The Best Defense

**Direct transformation / owner**

- Land-combat source offensive-pressure composition.
- An attacking lane receives P18's `+100%` offense when its **source cell** lies inside at least one self/fixed-teammate Fort area.
- Multiple qualifying Forts do not multiply P18.

**Required seams / dependencies**

- `Fort coverage query + immutable team membership -> source-cell qualification -> final lane offensive pressure`.
- Must distinguish self/fixed-teammate Fort areas from enemy Fort areas.
- Depends on effective Fort coverage and fixed-team membership.

**Explicit interactions**

- `P18 + P09`: P09 expands effective Fort coverage and therefore P18 qualification area.
- `P18 + N10`: N10 contracts Fort coverage and therefore P18 qualification area.
- `P18 + N08`: N08 removes Fort defensive-pressure bonus but does **not** remove the Fort area itself; P18 should still qualify from the remaining Fort coverage unless another rule says the structure is inactive/nonexistent.
- `P18 + P50`: both can add offensive pressure from Fort-related state; combined cases must prove they remain distinct effects and obey the canonical pressure-composition rule rather than one replacing the other.

**Non-effects**

- P18 does not make Forts attack autonomously, create defenders, or apply based on the target cell.

---

## P19 — The Weak Die First

**Direct transformation / owner**

- Land-combat offensive-pressure composition.
- Adds `+5%` offensive pressure per **distinct currently active other faction** with current Territorial Contact.

**Required seams / dependencies**

- `territorial ownership adjacency -> current Territorial Contact graph -> distinct active-faction count -> final offensive-pressure contribution`.
- Multiple disconnected Contact components with the same faction count once.
- Contact disappearance removes the contribution; reappearing contact restores it.
- A fixed teammate counts because `other faction` is literal; team membership does not create an exclusion.
- An active Minor Faction/Goon with current contact counts exactly once.
- Depends on canonical Territorial Contact derivation and active-territorial-faction lifecycle.

**Explicit integration obligation**

- `P19 <-> Minor Factions`: cover 0/1/many Goon contacts, multiple components to one Goon, disappearance/elimination, and reappearance. Minor Factions provide ordinary contact/lifecycle state; P19 remains a land-combat trait rather than making Minor Factions an Origin-owned subsystem.

**Issue-boundary note**

- Full Minor-Faction integration requires the relevant deterministic placement/lifecycle/contact implementation to exist. The unresolved Minor-Faction attack-commitment policy in #34 is **not** itself part of P19 arithmetic and should not be falsely treated as a blocker for synthetic/contact-count unit cases.

**Other pressure interactions**

- P15/P18/P50/etc. may coexist on the same lane and belong to representative generic pressure-composition coverage rather than a bespoke all-pairs P19 matrix.

---

## P20 — A Miracle Is Merely a Miscalculation

**Direct transformation / owners**

- Pre-match/start-state initialization: grants one free Missile Silo.
- Persistent-structure lifecycle: the result must be a normal canonical Missile Silo after the grant resolves.
- Strategic-weapon subsystem consumes the resulting Silo level/charges/access exactly as it would any other legal persistent Silo.

**Required seams / dependencies**

- `resolved Initial Territory / start-state grant placement -> valid owned persistent Missile Silo -> ordinary Silo lifecycle/weapon access/charges`.
- Grant occurs as a **grant**, not a purchase; no FFY purchase transaction is performed.
- Depends on canonical start-state grant placement, resulting Silo level/activation state, and initial charge/readiness semantics.

**Explicit interactions**

- `P20 + P21`: catalogue explicitly states the P20 grant does **not** consume P21's first-Silo purchase entitlement.
- `P20 + P53`: explicitly legal; P53 must count the granted Silo's ready persistent charges exactly when those charges are canonically ready, creating the corresponding passive FFY source.
- `P20 + N07`: the granted Silo counts toward N07's one-of-each-structure ownership cap; no hidden exemption for a free grant.
- `P20 + N06`: if the granted Silo begins below L5, N06's upgrade-spending prohibition applies normally to later attempted upgrades.
- `P20 + P39` / multi-origin profiles: placement/uniqueness of this singular start-state grant is a real spawn/start-state interaction and is explicitly part of the unresolved #32 spawn-semantics work.

**Blockers / mechanic-definition findings**

- #32 must close ordering/uniqueness/placement semantics for singular Origin start-state grants under multi-origin and Random/Fixed spawn profiles.
- The canonical structure/start-state rules must make the P20 grant's resulting Silo level, active/completed state, placement rule, and initial charge/readiness state explicit enough to produce one deterministic expected start state. This registry does not infer those details from the word `free`.

---

# 4. Running mechanic-closure findings

These are **not #31 validation-design decisions**. They are mechanic-definition questions discovered because honest certification needs a canonical expected result.

| Trait | Finding | Validation consequence |
| --- | --- | --- |
| P02 | Exact replacement `30–70%` Population-utilization curve/anchors must be canonically available. | P02 semantic conformance cannot finalize without the intended curve. |
| P05 | Structure-capture FFY event base value and location semantics are not closed in the inspected canonical material. | P05 payout and spatial-modifier integration cannot fully certify. |
| P07 | Per-Factory normal-primary-dispatch counter behavior across Factory ownership transfer should be explicit. | Captured-Factory P07 lifecycle lacks a canonical expected result until defined. |
| P09 | `+10% Fort coverage area` needs deterministic representation against radius-based baseline data; `+9% Fort defensive pressure` needs unambiguous composition semantics. | Structure/combat projection cannot finalize by guesswork. |
| P10 | `warhead projectile speed` must identify the exact affected projectile classes, especially MIRV carrier vs separated warheads. | P10 projectile/interception projection remains incomplete until classified. |
| P20 | Singular start-state grant placement/uniqueness under multi-origin/Random/Fixed profiles is unresolved in #32; resulting Silo level/activation/initial charge state must also be explicit. | P20 start-state and P20+P39/P53 certification cannot fully finalize until those semantics are closed. |

Implementation-specific deterministic numeric representation/rounding requirements, such as P17's `0.99^S`, must also be testable, but they do not become new gameplay mechanics unless the canonical monetary rules need a semantic rounding decision.

---

# 5. Emerging validation boundaries — provisional

Do not freeze the final domain catalogue until all traits are audited, but P01–P20 currently reveal recurring owners/seams around:

- Spawn / pre-match initialization;
- Population initialization, growth, and peak-state tracking;
- land combat / pressure / counter-response;
- terrain/acquisition;
- persistent structures / ownership / transaction pricing;
- FFY economy / physical Trade and Train logistics;
- naval/amphibious physical lifecycle;
- strategic projectiles / SAM interception;
- cross-system state/event seams such as Spawn -> Population, structure capture -> FFY, Fort field -> combat, Population peak -> SAM entitlement, and start-state grant -> persistent structure.

These are evidence from the completed traces, not yet a final taxonomy.

---

## Next work items

- audit P21–P30 using the same dependency-trace procedure;
- continue through P54 and N01–N18 in bounded batches;
- derive the final validation-domain catalogue from completed traces rather than forcing traits into a preselected taxonomy;
- derive the explicit interaction registry from actual same-hook/cross-system dependencies;
- route mechanic-definition blockers to their canonical owners/issues without solving them inside validation metadata;
- convert accepted coverage into executable validation metadata/tests only after relevant mechanics are implementation-ready.
