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

- Canonical P05 valuation, event location, capture-tick earning-state sampling, and FFY-pipeline behavior are owned by `FFY_ECONOMY.md`; the assertions below consume that contract rather than redefining it.
- `successful qualifying enemy-structure transfer -> exactly one P05 conquest FFY event -> ordinary Military/conquest modifier pipeline`.
- Failed capture, structureless capture, or `DESTROYED_ON_CAPTURE` result must not fire P05.

**Required relational invariants / scenario coverage**

- for every successful qualifying transfer, `emittedP05EventCount == 1`; for every non-transfer result, `emittedP05EventCount == 0`;
- for every persistent structure type, `P05BaseValue == canonical ordinary L1 build price for capturedStructure.type` from the structure-price owner;
- for the same structure type, `P05Base(L1) == P05Base(L5) == P05Base(fresh-construction) == P05Base(upgrading)`;
- P14 and N04 qualifications use the canonical P05 physical-cell event location and capture-tick snapshot supplied by the FFY owner;
- an already-qualifying P24 Fort field may raise the P05 event and an already-qualifying N11 SAM field may hard-zero it **when the canonical field owner supplies unambiguous membership**; #48 does not guess unresolved own/team/enemy field affiliation;
- a Fort/SAM acquired by that capture tick cannot newly affect its own or a sibling P05 event under the FFY owner's sampling boundary;
- gaining a structureless Desert cell on the same tick as a qualifying structure capture must not change that tick's P05 value relative to the same pre-mutation earning state;
- losing a structureless Desert cell on the same tick as a qualifying structure capture must likewise not change that tick's P05 value relative to the same pre-mutation earning state;
- gaining a Desert structure cell on that tick must not retroactively alter its own or a sibling P05 value through changed Desert share;
- given identical pre-mutation state and identical authoritative capture results for one tick, reversing internal structureless ownership-commit order, structure-fate/admission order where legal, or consequence iteration order must produce identical individual and total P05 values;
- N17 destruction and N07/other transfer-admission rejection produce no P05 event;
- P34 conquest provenance may be established by the same successful Factory transfer, but P34 does not multiply P05.

**Explicit interactions**

- `P05 + N17`: N17 changes capture disposition to destruction; P05 must not fire.
- `P05 + N07`: cap-rejected capture transfer destroys the incoming structure; P05 must not fire because no `STRUCTURE_TRANSFERRED` result exists.
- `P05 + P34`: a successfully transferred captured Factory can both trigger P05 and acquire P34 conquest provenance on one atomic capture resolution; P34 does not multiply the P05 event.
- `P05 + P14/N04`: verify terrain qualification through the FFY owner's canonical P05 location/capture-tick snapshot contract.
- `P05 + P24/N11`: verify field qualification through the same FFY-owned sampling contract; exact qualifying affiliation/geometry remains owned by the structure-field contract, so those cases remain externally conditional until field membership is canonical.

**Resolved mechanic-definition result (#48)**

- `FFY_ECONOMY.md` now supplies the previously missing P05 value/location/capture-tick sampling contract. Runtime coverage may still be `UNAVAILABLE` until the corresponding Open Fufu capture/economy implementation exists, and exact P24/N11 cases remain conditional on the separate field-membership contract, but P05 is no longer `BLOCKED` on undefined FFY semantics.

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
- Each Factory maintains an owner-scoped P07 phase for its current Train-service ownership epoch. Normal primary dispatches advance `0 -> 1 -> 2 -> 3 -> bonus + 0`.
- Bonus Trains do not advance, consume, or delay the primary service slot and receive independently generated deterministic ordinary routes.

**Required seams / dependencies**

- `persistent Factory current ownership -> owner-scoped Train-service epoch -> serialized P07 phase -> primary dispatch`.
- `bonus Train -> ordinary Train route/event/dwell/destruction/interception/replay lifecycle`.
- Expected dispatch Train-count sequence is `1,1,1,2,1,1,1,2...`, independently per Factory and current ownership epoch.
- Save/reload or replay at phase `3` must reproduce a bonus on the next normal primary dispatch.
- Temporary Factory inactivity pauses/preserves phase; Factory upgrade preserves phase; ordinary Train destruction preserves phase; physical Factory destruction deletes it.
- Successful Factory ownership transfer closes the old owner's service epoch. A new P07 owner starts at phase `0`; no latent old-owner phase is inherited or advanced for a non-P07 owner.
- An old-epoch Train already in flight remains the dispatching old owner's Train with its dispatch-time route/economic snapshot, stops occupying the captured Factory's new primary slot, and cannot mutate any later ownership epoch's turnaround or P07 phase when it later returns/terminates/is destroyed.

**Explicit interactions**

- `P07 + P33`: bonus Trains generate ordinary qualifying Train events and therefore eligible P33 Population gains.
- `P07 + P34`: P34 does not change P07 cadence or Train count. Primary and bonus Trains dispatched while the Factory has the P34 profile snapshot its `1.50x` Factory Train-event base-value transformation.
- `P07 + N09`: N09 may prevent building Factories but does not suppress P07 on a legally acquired Factory.
- `P07 + N17`: if N17 destroys a Factory instead of transferring it, no new owner Factory service epoch exists.

**Resolved mechanic-definition result (#49)**

- Factory ownership-transfer behavior, P07 phase persistence/reset, in-flight old-epoch Train behavior, and replay/serialization expectations are canonical. P07 is no longer blocked on undefined Factory-transfer scheduler semantics.

---

## P08 — Tea Time

**Direct transformation / owner**

- FFY external-trade calculation.
- Replaces the earning-side wartime external-trade multiplier `0.50x -> 1.00x` wherever that canonical hook is consumed, including maritime and rail external trade.

**Required seams / dependencies**

- `canonical atWar relation at event-resolution tick -> maritime external-trade payout`.
- `canonical atWar relation at event-resolution tick -> rail external-trade payout`.
- The canonical lifecycle is now closed: `atWar` is symmetric and hostility-side/team normalized, is created/maintained by accepted controller-directed hostility, persists while a directed-hostility source remains active, and uses an exact `600`-simulation-tick post-hostility grace after the final persistent source ends or after a one-shot directed-hostility action.
- Each qualifying external Train/Trade payout evaluates the **current** `atWar` relation when the economic event resolves; launch/dispatch-time war state is not snapshotted for later payout.
- Autonomous Warship combat/Trade capture and autonomous Train interception do not themselves create or refresh `atWar`.

**Required scenario coverage**

- peaceful external payout -> ordinary non-war treatment;
- accepted directed-hostility source becomes active -> P08 wartime payout remains `1.00x` instead of baseline `0.50x`;
- multiple/persistent hostility sources -> relation remains active until the last source ends;
- final persistent source ends -> P08 remains wartime through ticks `< expiresAtTickExclusive` and returns to peace exactly at expiry with no active source;
- one-shot directed hostility extends the same 600-tick grace;
- autonomous piracy/interception during peace or grace does not create/refresh the relation;
- both maritime and rail external trade use the same canonical relation but retain their own ordinary event rules.

**Explicit interactions**

- `P08 + N14/N16`: conformance must preserve the FFY owner's separation between the immutable launch-time voyage reference and the actual event-resolution wartime/P08 stage; changing war state must not retroactively mutate the stored N14/N16 reference amount.
- No bespoke P06/P07 pair is required when those traits independently change speed/count.

**Status**

- The former semantic blocker from #33 is closed on `main`. P08 conformance may still be `UNAVAILABLE` until the relevant runtime/test implementation exists, but it is no longer `BLOCKED` on undefined `atWar` semantics.

---

## P09 — Wall Maria

**Direct transformations / owners**

- Persistent Fort profile/transaction: Fort coverage area, Fort FFY cost.
- Fort defensive-pressure profile, consumed by land combat.

**Required seams / dependencies**

- `Fort effective field -> automatic-defense / land-combat pressure`: outside coverage, inside coverage without an automatic defender, and inside coverage with a real automatic defender.
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
- `SAM-slot entitlement -> canonical structure acquisition admission` must reject ownership beyond the currently unlocked permanent slot count across any applicable acquisition path while permitting legal zero-FFY purchases within it.
- Existing/under-construction SAMs and committed ownership reservations consume the entitlement under the generic structure-admission contract.
- SAM charge/range/interception behavior remains the ordinary SAM subsystem unless another trait changes it.

**Explicit interactions**

- `P11 + N07`: P11's unlocked-SAM entitlement and N07's one-per-type ownership rule are both mandatory hard ownership constraints; an acquisition must satisfy both. Canonical normalization/composition of multiple cap-valued rule sources remains owned by #43 rather than this validation registry.
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
- `P14 + P05`: verify P14 against the P05 event location/capture-tick snapshot supplied by `FFY_ECONOMY.md`, including order invariance when same-tick structureless or structure-bearing territorial changes would otherwise alter Desert share.
- `P14 + N14/N16`: verify launch-time Desert qualification can affect the FFY owner's stored voyage reference once, while the later N14/N16 signed transaction itself is not reprocessed through P14.

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
- Persistent-structure lifecycle: after admission the result is one immediately active completed L1 Missile Silo.
- Strategic-weapon subsystem consumes the resulting Silo level/charges/access exactly as it would any other legal persistent Silo.

**Required seams / dependencies**

- `resolved exact origins -> Initial-Territory ownership -> exactly one P20 GRANT request at stable originSlot 0 -> canonical structure admission -> active completed L1 Missile Silo -> ordinary Silo weapon/charge lifecycle`.
- The singular grant resolves after Initial-Territory ownership in every spawn mode and is **once per faction**, not once per origin/footprint. P39 therefore does not duplicate it.
- Grant occurs as a **grant**, not a purchase; no FFY purchase transaction is performed and no P21 first-Silo entitlement is consumed.
- Generic #45 structure admission still applies, including hard ownership limits such as N07. If exact-cell admission rejects the grant, no Silo is created, Spawn searches no alternate cell, and the valid territorial start is not rolled back.
- #45 closes resulting level/activation/admission; initial charge/readiness state remains #46-owned.

**Explicit interactions**

- `P20 + P21`: the grant does **not** consume P21's first-Silo purchase entitlement.
- `P20 + P53`: explicitly legal; P53 must count the granted Silo's ready persistent charges exactly when #46 says those charges are canonically ready.
- `P20 + N07`: the grant passes ordinary structure ownership admission and cannot bypass N07.
- `P20 + N06`: the granted L1 Silo is immediately completed/active, but N06's upgrade-spending prohibition applies normally to later attempted upgrades.
- `P20 + P39`: exactly one grant is requested at P39's stable primary `originSlot 0`; there is no secondary-core grant.

**Remaining dependency**

- #46 must close initial ready-charge state for a newly granted Silo. #32 no longer blocks P20 placement, ordering, or multi-origin uniqueness, and #45 no longer blocks its resulting structure level, activation state, or generic admission lifecycle.

---

# 4. P21–P30 coverage

## P21 — Fun Things Are Fun

**Direct transformation / owner**

- Persistent-structure purchase transactions.
- Maintains one first-purchase entitlement per persistent structure type.
- The first **successful purchase** of each type still performs ordinary legality and affordability checks, but consumes `0 FFY` when it commits.

**Required seams / dependencies**

- `effective structure price + placement/cap/build legality -> affordability/legality validation -> accepted purchase -> zero FFY consumption -> ordinary construction lifecycle`.
- Rejected, unaffordable, or otherwise illegal attempts must not consume the first-purchase entitlement.
- The entitlement is keyed by structure type, so using it for one type must not affect another type.
- Grants and captures are not purchases. P20's starting Silo grant and P37's landing-created Fort grant do not consume the corresponding P21 entitlements.

**Explicit interactions**

- `P21 + P20`: P20 grant does not consume first-Silo purchase entitlement.
- `P21 + P37`: landing-created Fort grant does not consume first-Fort purchase entitlement.
- `P21 + P11`: a P11 SAM already has zero FFY price; a successful first-SAM purchase still advances the P21 first-purchase entitlement but does not create another SAM slot or bypass P11 entitlement legality.
- `P21 + P09`: P09's effective Fort price is the affordability input checked before P21 zeroes FFY consumption on the qualifying first purchase.
- `P21 + P41`: P41's direct-L5 City action is one **purchase**, not four upgrades; if it is the first City purchase, P21 validates affordability against the canonical P41 effective purchase price and then consumes `0 FFY` on successful commit.
- N07/N09/P46 and other structure-legality transformations remain ordinary legality inputs; P21 does not bypass caps, build prohibitions, terrain rules, or placement requirements.

**Non-effects**

- P21 changes FFY consumption for the qualifying purchase only. Construction time, created level, activation lifecycle, placement, ownership caps, and later upgrade rules remain ordinary unless another trait modifies them.

---

## P22 — Limit Break

**Direct transformation / owner**

- Naval Warship rank/XP lifecycle.
- Raises the ordinary maximum Warship rank from `3` to `5`.

**Required seams / dependencies**

- `Naval XP events -> rank thresholds -> rank 4/5 progression -> ordinary rank-derived max-health and shell-damage effects`.
- XP above a threshold must continue to carry normally until the P22 cap is reached.
- Rank-up must preserve current health percentage under the ordinary Warship rank rule rather than grant an unintended free heal.
- The ordinary `+20% max health` and `+20% shell damage` per rank above 1 must extend consistently through ranks 4 and 5.

**Explicit interactions**

- `P22 + P29`: explicitly canonical. P29 derives `effective Silo level = max(1, Warship rank)`; P22 therefore permits rank-4/5 launcher states and rank 5 can reach ordinary L5 Silo weapon access.
- `P22 + P23`: P23's base Warship profile changes must coexist with ordinary rank progression; P22 extends the rank-derived health/damage portion rather than replacing the P23 profile.
- `P22 + P30`: P30 may make rank-derived shell damage strategically inert against ships because ordinary naval gunfire is disabled, but rank-derived max health and the rank lifecycle remain valid.

**Non-effects**

- P22 does not itself change Naval XP awards, movement speed, shell range, purchase cost, Warship ownership cap, or launcher legality except where another trait such as P29 explicitly consumes Warship rank.

---

## P23 — Space Battleship Yamato

**Direct transformations / owner**

- Naval Warship effective unit profile: `+20%` shell range, `+20%` shell damage, `+20%` movement speed.
- Naval Warship ownership/build legality: the holder may own only one Warship.

**Required seams / dependencies**

- `effective Warship profile -> autonomous movement/pursuit/combat` must consume the transformed speed/range/damage rather than display-only values.
- `Port Warship construction admission -> existing owned + committed construction + current-proposal reservation -> hard cap 1`.
- An admitted Warship reserves the slot at transaction commit and holds it throughout its five-second construction lifecycle.
- Destruction/cancellation/removal releases the slot at the authoritative lifecycle transition.
- A mechanics quote is not a reservation; two individually legal quotes against the same snapshot may still form an atomic proposal rejected with `OWNERSHIP_CAP`.

**Explicit interactions**

- `P23 + P22`: rank-derived shell damage and health must compose with the P23 Warship profile; P23 does not replace rank progression.
- `P23 + P30`: both alter Warship speed, while P30 structurally removes naval gunfire against ships. The combined profile must retain the valid speed composition while P23's ship-gun range/damage becomes inert wherever P30 makes that attack illegal.
- `P23 + P42`: P42 changes the payment resource but cannot bypass P23's ownership reservation/cap. Same-axis range arithmetic remains separately routed to #43.
- `P23 + P29`: faster movement changes where the mobile launcher can physically be, but launcher semantics remain P29/strategic-weapon behavior rather than a separate P23 launcher mechanic.

**Resolved cap-admission result (#45)**

- Concurrent/in-progress Warship admission is now canonical: pending committed construction counts toward the one-Warship cap, sibling commands reserve against one aggregate transaction, and command-array order cannot be used to oversubscribe the cap.

---

## P24 — A King's Price

**Direct transformation / owner**

- FFY event-yield calculation with a structure-coverage spatial condition.
- A qualifying FFY event whose canonical event location lies inside a qualifying Fort area receives the P24 `+20%` ordinary yield contribution.

**Required seams / dependencies**

- `canonical FFY event -> event location -> effective Fort coverage query -> P24 qualification -> ordinary FFY yield composition`.
- Depends on each eligible event family having a canonical spatial event location and on the effective Fort-area geometry supplied by the structure system.
- Fort defensive-pressure magnitude is not itself the qualifying value; P24 consumes the coverage area.

**Explicit interactions**

- `P24 + P09`: P09 changes effective Fort coverage, therefore changes which event locations qualify for P24.
- `P24 + N10`: reduced Fort coverage contracts the P24 qualification region.
- `P24 + N08`: N08 removes Fort defensive-pressure benefit but does not by itself erase the Fort area; P24 should continue to use the remaining effective coverage geometry.
- `P24 + P14`: an event may simultaneously be on Desert and inside Fort coverage; both ordinary yield percentages compose through the canonical FFY same-axis rule.
- `P24 + N11`: an event that also lies inside an applicable SAM area still obeys N11's explicit hard zero after ordinary yield composition.
- `P24 + P05`: verify Fort qualification against the FFY owner's canonical P05 capture-tick sampling boundary. A Fort acquired on that tick must not self-enable the same P05 event; exact own/team/enemy Fort membership remains this section's blocker rather than a #48-owned rule.
- `P24 + N14/N16`: verify a qualifying planned-destination Fort field can contribute once to the FFY owner's stored voyage reference, while later N14/N16 signed transactions are not reprocessed through P24.

**Blocker / mechanic-definition finding**

- The trait wording does not currently make the qualifying Fort affiliation explicit enough for certification: own Forts only, self/fixed-teammate Forts, or some broader set. P18 explicitly names self/fixed-teammate Fort areas while P24 does not. Validation must not guess this ownership/team boundary.

---

## P25 — EXPLOSION!

**Direct transformations / owner**

- Strategic-weapon action legality: Atom Bomb and MIRV are unavailable to the holder.
- Hydrogen Bomb transaction: effective FFY cost is `+50%` over the ordinary Hydrogen cost.
- Hydrogen Bomb geometry: affected blast **area** is `+50%`; the catalogue explicitly says this is not `1.5x` radius.

**Required seams / dependencies**

- `launcher/effective level -> weapon-access list -> P25 hard weapon-family restriction` must remove Atom/MIRV without changing ordinary launcher legality for Hydrogen Bombs.
- `effective Hydrogen price -> ordinary affordability/payment transaction` must use the P25 price.
- `P25 Hydrogen geometry -> deterministic blast resolver -> ordinary ownership/Population/Capacity/Fallout/unit/structure consequences`.
- Replay must reproduce the exact transformed Hydrogen footprint.

**Explicit interactions**

- `P25 + P26` is builder-legal. P25's MIRV prohibition remains a hard legality restriction; P26's one free successful MIRV cannot manufacture permission to use a weapon P25 forbids, so the P26 entitlement remains unusable while P25 is active.
- `P25 + P29`: a P29 Warship launcher may launch only weapon families legal under both its effective Silo level and P25; P25 restrictions/costs remain in force from mobile launchers.
- `P25 + P10`: if P10's canonical projectile classification includes Hydrogen Bombs, its speed transformation composes independently with P25's Hydrogen-only cost/geometry changes.
- P20/P53 consume ordinary persistent-Silo/charge state; P25 does not create a special charge system.

**Blocker / mechanic-definition finding**

- `+50% Hydrogen Bomb blast area` still needs one exact deterministic geometry transformation. The canonical rules must state how the ordinary fully affected inner zone and irregular outer zone are transformed to achieve the authored area increase, including how the optional Water-Nukes Deep-Water core/fringe behaves. The validation layer must not infer radii or raster rules merely from the area percentage.

---

## P26 — Serious Punch

**Direct transformations / owner**

- Strategic-weapon per-faction entitlement: at most one successful MIRV use.
- MIRV transaction: ordinary launcher/weapon legality and ordinary affordability are required, but the one permitted successful MIRV consumes `0 FFY`.

**Required seams / dependencies**

- `legal MIRV launcher + target/action legality + ordinary effective MIRV price -> affordability -> successful launch -> consume one-time P26 entitlement + consume 0 FFY`.
- Failed/rejected/illegal attempts must not consume the one-time entitlement.
- The successful launch remains an ordinary strategic launch in every non-FFY respect: physical launcher, charge consumption/cooldown, projectile lifecycle, targeting, directed-hostility/`atWar`, and replay all remain active.

**Explicit interactions**

- `P26 + P25`: P25 forbids MIRV, so P26 cannot bypass that hard prohibition. No hidden compatibility exception is created.
- `P26 + P29`: a Warship may supply the launcher only if its P29 effective Silo level legally exposes MIRV; P22 can raise the rank ceiling enough to make rank-5 Warship MIRV access possible.
- `P26 + P53`: zero FFY consumption does **not** mean zero charge consumption. A successful P26 MIRV must expend the ordinary ready charge, so P53 income from a persistent Silo naturally falls until that charge is ready again.

**Non-effects**

- P26 does not reduce the MIRV affordability threshold, alter MIRV payload/geometry, grant a launcher, waive charge requirements, or alter SAM interception.

---

## P27 — Only My Railgun

**Direct transformation / owners**

- Persistent SAM target legality/attack behavior.
- Crosses from a structure whose baseline role is automatic strategic-projectile interception into direct interaction with physical naval units.

**Required seams / dependencies**

- `active SAM profile/range/charge state -> naval target eligibility -> autonomous target selection/fire -> ship damage/destruction -> ordinary naval lifecycle`.
- The canonical #33 hostility contract already establishes that autonomous SAM ship attack, where explicitly permitted, does **not** create or refresh `atWar`.
- Strategic-projectile interception and ship attack share a physical SAM structure, so certification needs deterministic behavior when both kinds of legal targets are simultaneously present.

**Explicit interactions**

- `P27 + P11`: P11 changes how many SAMs may be owned and their FFY cost; P27 changes what those SAMs may target. Neither may bypass P11's permanent slot entitlement.
- `P27 + P40`: P40 changes SAM range, charge capacity, and recharge cooldown. The combined validator must prove ship attacks use the same effective P40 SAM resource/coverage state rather than a parallel unlimited anti-ship weapon.
- `P27 + P32`: if Transports are part of P27's canonical ship target set, armored P32 Transports require ordinary health-bearing damage resolution rather than baseline one-shell Transport destruction assumptions.
- Warship/Trade-Ship interactions must follow the final canonical P27 target set and their ordinary unit/cargo lifecycles.

**Blocker / mechanic-definition finding**

- `SAM Launchers may attack ships` is not yet specific enough for executable conformance. The canonical owner must close at least: which ship classes are legal targets; ship-attack damage/effect; firing cadence; whether/how ordinary SAM charges are consumed; priority/arbitration between strategic-projectile interception and ship attack; and how ordinary physical range/targeting applies. #31 records this dependency but does not design the anti-ship weapon.

---

## P28 — Blood Devil

**Direct transformations / owners**

- Trigger: hostile Transport destruction lifecycle.
- Output: Population ownership/accounting transfer to the P28 holder under the trait's `steals their carried Population` rule.

**Required seams / dependencies**

- `Transport carries committed Population -> qualifying destruction attributed to P28 faction -> victim Transport Population removed from its ordinary committed/aboard state -> stolen Population credited through the canonical recipient Population state`.
- The transfer must occur exactly once per destroyed Transport and must not coexist with the baseline rule that simply loses the same carried Population in a way that double-removes/double-creates it.
- Current Population is permitted to exceed Capacity after territorial loss, so validation must follow the eventual canonical Population-credit rule rather than invent a Capacity clamp.
- Autonomous Warship destruction does not create/refresh `atWar`; the P28 reward must not redefine that game-wide hostility rule.

**Explicit interactions**

- `P28 + P32`: armored Transports may require multiple hits, but the steal occurs only on actual qualifying destruction and uses the Population still aboard at that moment.
- `P28 + P27`: inspect after P27's target/damage semantics are closed; if a P27 SAM can destroy a Transport and kill attribution counts for P28, the same one-transfer rule must apply.
- `P28 + N13`: N13 changes Population on successful landing, not destruction in transit; a destroyed Transport should not also resolve landing-loss semantics.
- Strategic-weapon destruction of a Transport follows ordinary Transport-destruction handling, but whether that destruction qualifies for P28 depends on the canonical attribution rule below.

**Blocker / mechanic-definition finding**

- The catalogue does not yet close enough of `steals their carried Population` to certify it: which destruction sources count/what kill attribution is required; whether only enemy Transports qualify; exactly where stolen Population is credited (`Available Population` is a likely implementation destination but is not stated canonically here); and resolution ordering for simultaneous destruction/casualty effects. Validation must not choose those rules.

---

## P29 — The Kaiser

**Direct transformations / owners**

- Naval Warship state becomes an eligible strategic-weapon launcher state.
- Strategic-weapon launcher identity/location: the controller identifies the physical owned Warship and launches from that Warship's current cell.
- For P29, `effective Silo level = max(1, Warship rank)`.

**Required seams / dependencies**

- `Warship identity/current cell -> strategic launch origin`.
- `Warship rank -> effective Silo level -> ordinary weapon access + charge capacity/cooldown`.
- Launcher-specific charge/cooldown state must remain attached to the correct physical Warship and survive ordinary movement while disappearing with that Warship's destruction.
- Accepted P29 launches use ordinary strategic-weapon costs, targeting, projectile behavior, directed-hostility/`atWar`, and replay rules.

**Explicit interactions**

- `P29 + P22`: explicitly canonical. Higher Warship rank raises effective Silo level; rank 5 can reach ordinary L5 weapon access.
- `P29 + P25`: P25's weapon-family restrictions and Hydrogen cost/geometry apply from Warship launchers exactly as from persistent Silos.
- `P29 + P26`: a rank-5-capable Warship launcher may supply the legal MIRV launcher for the one permitted P26 launch; P26 still consumes ordinary launcher charge/cooldown state.
- `P29 + P53`: explicitly negative. P53 counts ready charges on **persistent Missile Silo structures only**; P29 Warship launcher charges must never contribute to P53 income.
- P23/P30/P42 movement/profile transformations may change where the mobile launcher can reach, but do not redefine P29 launcher legality.

**Blocker / mechanic-definition finding**

- P29 says ordinary charge/cooldown behavior follows the effective Silo level, but certification still needs exact charge-state semantics as Warship rank changes the effective level/capacity: especially whether newly added charge slots on rank-up begin ready, cooling down, or in another canonical state. If the generic Silo level/charge contract closes this for dynamic capacity changes, P29 should consume that rule rather than invent its own.

---

## P30 — The Conman

**Direct transformations / owners**

- Naval Warship profile: `+50%` movement speed.
- Naval autonomous-combat legality: Warships cannot use naval gunfire against ships.
- Trade-Ship pursuit/capture remains legal.
- FFY economy: piracy FFY receives the P30 `3x` transformation while captured-cargo routing/payout lifecycle remains ordinary.

**Required seams / dependencies**

- `effective Warship profile -> movement/pursuit`: the speed bonus must affect actual physical chase/repositioning.
- `autonomous target/action selection -> P30 gunfire restriction`: Warships must not waste legal-action selection on ship gunfire they are forbidden to perform; Trade Ship pursuit/capture remains available when its ordinary prerequisite is met.
- `successful captured-cargo delivery -> Naval/trade piracy FFY event -> P30 3x transformation -> ordinary eligible yield modifiers`.
- Autonomous Warship combat/piracy continues to obey the canonical rule that it does not create or refresh `atWar`.

**Explicit interactions**

- `P30 + P23`: same chassis gets both speed transformations, while P30 structurally disables ordinary ship gunfire. P23 ship-gun range/damage must not restore a forbidden attack; its speed contribution remains meaningful.
- `P30 + P22`: rank-derived max health remains meaningful; rank-derived shell damage may be inert against ships while P30's gunfire prohibition is active.
- `P30 + P29`: P30 forbids **naval gunfire against ships**, not strategic-weapon launching. A legal P29 strategic launch remains available subject to its own launcher/weapon rules.
- `P30 + N14/N16`: verify the original-owner voyage adjustment and final-holder piracy payout remain separate authoritative amounts; neither may change or reprocess the other.
- P06 Trade Ship speed changes pursuit geometry but does not alter P30's capture/payout semantics.

**Non-effects**

- P30 does not grant immediate ordinary piracy FFY on capture; the ordinary captured-cargo lifecycle still pays only on legal terminal delivery.
- P30 does not turn ordinary owner recovery into piracy or multiply unrelated Naval/trade events merely because they share a broad source family.

---

# 5. P31–P40 coverage

## P31 — Heart-Under-Blade

**Direct transformations / owners**

- Persistent Port repair field as consumed specifically by Warships.
- Naval Warship repair lifecycle while inside an **owned active Port** repair field.
- For Warships only, effective repair radius is `2.0x` the ordinary eligible Port radius and effective repair rate is `1.5x` the ordinary eligible Port rate.
- The Warship may remain operational while receiving P31 repair.

**Required seams / dependencies**

- `owned active Port completed level -> ordinary Port repair field -> Warship-specific P31 radius/rate -> Warship HP restoration`.
- Same-type overlapping Ports must retain the baseline strongest-applicable-field rule; P31 must not cause overlapping Ports to stack repair multiplicatively.
- Repair must respect current/max-health accounting and must not over-heal. Warship rank/profile changes that alter max health remain ordinary Warship state consumed by repair.
- `repair receipt -> operational Warship lifecycle`: movement, autonomous combat/capture, and any otherwise legal Warship capability must not be suppressed merely because P31 repair is occurring.

**Explicit interactions**

- `P31 + P29`: because the repaired Warship remains operational, a legal P29 strategic launch must not be disabled merely by simultaneous P31 repair; launcher legality/charges remain P29-owned.
- `P31 + P23/P22`: increased max-health profiles/ranks change the amount of HP missing but not the P31 rate formula; representative projection coverage should verify repair against modified max health without creating a new repair rule.
- `P31 + P32` negative assertion: P32 Transports become health-bearing and may use otherwise eligible ordinary naval repair, but P31 explicitly applies its enhanced radius/rate to **Warships only**.
- P30/P42 and other Warship profile/transaction transformations do not alter P31 field eligibility unless their own mechanics say otherwise.

**Non-effects**

- P31 does not alter Port ownership, Port level, Warship repair-retreat threshold, repair for non-Warship naval units, or Port construction/upgrade rules.

---

## P32 — Armored Titan

**Direct transformations / owners**

- Amphibious Transport embark-source legality: Transport operations may embark only from an **owned active Port**.
- Transport chassis/lifecycle: the normally fragile/no-health Transport becomes health-bearing with exactly `500 HP`.

**Required seams / dependencies**

- `owned active Port state -> Transport embark-source validation -> ordinary Transport creation/travel`.
- `naval damage -> P32 Transport HP -> destruction only when HP is exhausted -> ordinary carried-Population destruction handling`.
- Baseline Warship shell damage and any other legal damage source must resolve against the 500-HP chassis rather than use the baseline one-successful-shell instant-destruction shortcut.
- `health-bearing Transport -> otherwise eligible Port repair`: P32 must enter the ordinary friendly naval repair pipeline where geometry/ownership permits it.
- Active-Transport cap, carried-Population commitment, movement, landing, abort/return, and controller-directed hostility semantics remain ordinary unless another trait changes them.

**Explicit interactions**

- `P32 + P12`: P12 modifies speed; P32 modifies embark source and survivability. Combined effective Transport state must preserve both.
- `P32 + P28`: Population theft occurs only on actual Transport destruction; damage that leaves the armored Transport alive must not trigger P28.
- `P32 + P37`: Port-only embark legality and P37's embarkation cost/Fort-on-successful-landing behavior compose on one Transport lifecycle.
- `P32 + N13`: N13's landing casualty applies on successful landing, not while taking ship damage in transit.
- `P32 + N15`: N15 modifies the embarkation FFY transaction without changing P32's Port-only source requirement.
- `P32 + P27`: if P27's eventual canonical target set includes Transports, anti-ship SAM damage must use P32's 500-HP health-bearing resolution.
- `P32 + P31` negative assertion: P31's enhanced Port repair remains Warship-only; P32 receives ordinary eligible naval repair, not P31 multipliers.

**Non-effects**

- P32 does not grant generic controller movement orders, change the three-Transport cap, change carried-Population amount, or create a new automatic repair-retreat policy merely because the Transport now has HP.

---

## P33 — Misaka Network

**Direct transformations / owners**

- Cross-domain by construction: consumes the canonical Train economic-event lifecycle and produces Population for the **City owner**.
- Each qualifying Train-triggered economic event at a City currently owned by the P33 holder also grants `20 x completed City level` Available Population, Capacity-capped.

**Required seams / dependencies**

- `Train physically triggers canonical station event -> current station identity/ownership -> completed City level -> P33 Population grant -> Capacity-capped Available Population`.
- The Population recipient is the qualifying **City owner**, not necessarily the Train owner. A foreign Train can therefore create the P33 Population side effect for the City owner while the ordinary Industrial FFY event remains owned by the Train owner.
- Repeated qualifying passes create repeated canonical Train events and therefore repeated independent P33 grant opportunities.
- Train interception before the station event cancels that pending event and therefore produces no P33 grant for an event that never occurred.
- Population grant amount is based on completed City level at event resolution and is clamped by current Population Capacity; the FFY event remains independently resolved through the economy pipeline.

**Explicit interactions**

- `P33 + P07`: P07 bonus Trains are ordinary Trains and their qualifying City events can trigger P33 normally.
- `P33 + P41`: a purchased L5 City provides the ordinary completed level consumed by P33, producing `100` Population per qualifying event while Capacity permits.
- `P33 + P08`: wartime modification of the Train's external FFY payout does not change P33's level-based Population amount.
- `P33 + P14/P24/N11`: these traits modify **FFY yield** at a location; they do not cancel the Train event identity. A hard-zero FFY event under N11 still remains a Train-triggered economic event for P33 unless the canonical economy owner explicitly cancels the event itself rather than setting yield to zero.
- `P33 + P34`: P34 raises a qualifying Factory Train's dispatch-time FFY base value but creates no additional Train or station event and does not modify P33's `20 x City level` Population grant.

**Non-effects**

- P33 does not alter Train routing, dwell, Industrial event ownership, FFY event value, City Population-Growth contribution, or Population Capacity itself.

---

## P34 — Spoils of the Empire

**Direct transformations / owners**

- Persistent Factory current-owner acquisition provenance: only a Factory whose present ownership epoch was established by successful `CAPTURE_TRANSFER` qualifies for P34 while the current owner has P34.
- Factory/Train economy: qualifying Factory Train-event base value is `1.50x` at dispatch.
- Factory Tank-chassis production: construction work rate is `1.50x`.
- Factory Tank repair: `150 HP/s` repair rate and `8-cell` repair radius.

**Required seams / dependencies**

- `successful enemy-Factory territorial capture -> canonical structure-capture resolver -> STRUCTURE_TRANSFERRED -> current acquisition path CAPTURE_TRANSFER -> P34 effective Factory profile -> ordinary Factory consumers`.
- Built or granted Factories remain ordinary. A Factory resolved as `DESTROYED_ON_CAPTURE`, whether because of N17 or rejected transfer admission such as N07 overflow, never enters P34 state.
- If ownership leaves the P34 holder, that owner's P34 transformation disappears. A later successful capture creates a new `CAPTURE_TRANSFER` ownership epoch and is evaluated against the new owner's traits.
- Physical Factory identity/level/health/construction state remain transfer-preserved while owner-scoped Train scheduler state follows the fresh ownership-epoch rules in `FFY_ECONOMY.md`.
- `structureTypeSpec(..., CAPTURE_TRANSFER)` and `structureSpec(structureId)` must expose the effective P34 Factory values to controllers/Official AI rather than requiring them to parse P34 or infer a generic multiplier.

**Required scenario coverage**

- ordinary built/granted Factory: Train value `1.00x`, Tank construction speed `1.00x`, repair `100 HP/s`, radius `5`;
- qualifying P34 captured Factory: Train value `1.50x`, Tank construction speed `1.50x`, repair `150 HP/s`, radius `8`;
- baseline Tank build: `50` ticks -> `34` ticks under isolated P34 speed using `ceil(baseTicks / 1.5)`;
- P43 Heavy Artillery build: `100` ticks -> `67` ticks under isolated P34 speed;
- current Train count/service slot, 5-second turnaround, Train speed/routes/dwell, Tank build concurrency, Tank purchase cost, simultaneous repair capacity, Factory level/build/upgrade/cost all remain unchanged;
- save/reload/replay preserves current-owner acquisition provenance and reproduces the same effective Factory profile;
- repeated ownership transfer replaces provenance for the new ownership epoch rather than permanently marking the physical Factory as enhanced;
- a Train dispatched under P34 retains its `1.50x` Factory base-value snapshot after Factory upgrade/transfer/loss and uses that transformed pending base cargo if intercepted.

**Explicit interactions**

- `P34 + P05`: one successful Factory transfer may independently create one P05 conquest FFY event and establish P34 provenance; P34 does not multiply/duplicate the P05 event.
- `P34 + N09`: N09 prevents Factory construction, not otherwise legal capture ownership; a captured Factory may qualify for P34.
- `P34 + N17`: N17 destroys instead of transferring the Factory, so P34 cannot activate.
- `P34 + N07`: if Factory ownership admission rejects the transfer, the Factory is destroyed on capture and P34 cannot activate.
- `P34 + P07`: P07 cadence/Train count remain unchanged; actual primary and bonus Trains dispatched while P34 is active snapshot the `1.50x` Factory Train-event base value.
- `P34 + P33`: P34 changes only the Train FFY base-value axis; it neither creates extra Train events nor changes P33's Population amount.
- `P34 + P43`: Heavy Artillery consumes the same Factory Tank-construction-speed and repair hooks, yielding 67-tick construction plus 150 HP/s repair within 8 cells while P43's authored chassis/cost values remain intact.

**Non-effects / negative assertions**

- No implementation may interpret `50% increased effectiveness` as a generic Factory scalar or independently decide which Factory axes it changes.
- P34 does not increase primary Train count/service capacity, Tank-build concurrency, simultaneous repair capacity, or discount Tank/Factory costs.

**Resolved mechanic-definition result (#49)**

- The transformed axes, current-owner conquest provenance, Train value snapshot, Tank-build timing, Factory transfer lifecycle, and P07/P33/P43/N09/N17 interactions are canonical. P34 is no longer blocked on an undefined Factory-effect scalar.

---

## P35 — It's a Matter of Visualization

**Direct transformations / owners**

- Deliberate territorial-abandonment lifecycle.
- Terrain/Fallout overlay state.
- A cell deliberately relinquished by the P35 holder becomes neutral and receives Fallout until the next successful capture; P35 itself creates no nuclear-casualty event.

**Required seams / dependencies**

- `accepted deliberate relinquishment -> political ownership removal -> ordinary Capacity/territorial consequences -> P35 Fallout overlay`.
- Underlying base terrain must remain intact under the Fallout overlay.
- The created Fallout persists through neutral state until the **next successful capture**, at which point ordinary successful-capture handling clears the P35-created temporary condition as canonically specified.
- Relinquishment is not hostile capture: it must not trigger enemy-capture effects, automatic-defender capture casualties, or P05/P34/N17 capture-transfer behavior merely because ownership became neutral.

**Explicit interactions**

- `P35 + P16`: the holder can later ignore ordinary Fallout acquisition resistance when reacquiring otherwise legal P35 Fallout.
- `P35 + N05`: deliberately relinquished cells become Fallout the holder cannot capture while N05 applies; the awkward self-denial is legal and requires no compatibility exception.
- `P35 + N18`: N18 applies only to non-Fallout targets, so P35-created Fallout is exempt from N18's `0.50` non-Fallout post-multiplier while retaining ordinary Fallout acquisition behavior.
- `P35 + P36`: a P35-created neutral population-bearing cell is still neutral settlement on reacquisition; P36 can modify the Population settlement-cost axis independently of the Fallout speed axis.
- P44 can create the same ordinary Fallout overlay through a different trigger; shared terrain semantics should be tested once without conflating deliberate abandonment with Tank/Artillery attacks.

**Blocker / mechanic-definition finding**

- The high-level design intentionally makes territorial abandonment a separate action but does not yet close enough of the generic abandonment contract for P35 certification when relinquished cells contain persistent structures or other ownership-bound state. The canonical owner must define abandonment eligibility and the fate of structures/ownership-bound objects on relinquished cells; P35 should then add Fallout to that ordinary result rather than invent its own structure-disposal rule.

---

## P36 — Half-Priced Bento

**Direct transformations / owners**

- Neutral-settlement Population cost/accounting.
- Replaces the ordinary `1 Population` cost of a qualifying neutral population-bearing settlement with `0.5 Population/cell`, using faction-level persistent deterministic residual accounting.

**Required seams / dependencies**

- `successful qualifying neutral acquisition -> P36 fractional settlement debt -> canonical Population debit -> surviving expansion/Population state`.
- The residual belongs to the faction rather than an operation and survives ending/recreating expansion operations, so operation churn cannot erase half-cost debt.
- Neutral terrain that ordinarily costs `0 Population` because it is non-population-bearing must not acquire a new P36 cost merely because P36 exists.
- P36 changes settlement **cost**, not acquisition progress/speed, terrain identity, or hostile-capture casualties.

**Explicit interactions**

- `P36 + N18`: explicitly independent axes. P36 halves qualifying neutral settlement Population cost while N18 halves non-Fallout acquisition progress.
- `P36 + P16`: on neutral Fallout, P16 may remove the Fallout speed penalty while P36 independently changes the qualifying Population settlement cost.
- `P36 + P35`: reacquisition of P35-created neutral population-bearing Fallout can exercise both the P36 cost and Fallout acquisition rules.
- Inspect P48 when audited because P48 changes faction-specific Shallow-Water population-bearing classification only after/while owned; validation must use the canonical classification timing rather than assume neutral Shallow Water suddenly inherits a P36 cost.

**Blocker / mechanic-definition finding**

- Faction-level residual accounting crosses operation-local Population commitments. If different expansion operations contribute successful half-cost settlements before the residual reaches a whole Population debit, the canonical model must specify which commitment/global pool is charged when accumulated fractional debt materializes and how same-tick multi-operation settlements are ordered or aggregated. The residual's persistence is defined; the debit destination/ordering across concurrent operations is not explicit enough to certify without guesswork.

---

## P37 — The City Mouse

**Direct transformations / owners**

- Transport embarkation transaction: contributes `+250 FFY` on the dedicated Transport embark-cost hook.
- Amphibious landing -> persistent-structure grant: after a successful amphibious landing establishes land ownership and any captured structure on the landing cell has completed canonical capture resolution, attempt one permanent L1 Fort grant on that exact landing cell.

**Required seams / dependencies**

- `legal Transport embark -> effective additive embarkation cost -> ordinary payment/creation`.
- `Transport arrival -> ordinary local territorial engagement -> successful ownership establishment -> structure-capture resolution on landing cell -> exact-cell P37 GRANT admission`.
- Destruction, abort, failed landing engagement, or arrival without successful ownership establishment grants no Fort.
- The Fort is a **grant**, not a purchase; it does not consume P21's first-Fort purchase entitlement.
- On successful admission the Fort materializes immediately as an active completed L1 Fort. If admission fails, no Fort is created and the successful landing/cell capture is not rolled back.

**Explicit interactions**

- `P37 + N15`: transport-cost modifiers are explicitly additive; together they contribute `+750 FFY` relative to the ordinary Transport baseline.
- `P37 + P21`: the landing-created Fort grant does not consume first-Fort purchase entitlement.
- `P37 + P32`: embark source must satisfy P32's owned-active-Port restriction while the successful landing still resolves P37 normally.
- `P37 + N13`: N13 landing Population loss and P37 Fort grant both occur only on a successful landing path; exact N13 casualty order remains #50-owned, but no Fort appears on destroyed/failed Transport paths.
- Successful transfer of a captured landing-cell structure leaves that cell occupied and therefore blocks the exact-cell P37 Fort grant; no nearby fallback is searched.
- `P37 + N17`: if N17 resolves the captured landing-cell structure as `DESTROYED_ON_CAPTURE`, final occupancy may become empty and P37 then evaluates the Fort grant normally. The Fort appears only if its own placement and ownership admission pass.
- `P37 + N07` has two independent admission points: N07 may reject and destroy an incoming captured structure of some type, freeing the landing cell for the later P37 Fort attempt, while N07 may separately reject the Fort itself when the holder's Fort slot is already occupied. Destruction/freeing of the captured object never bypasses the Fort's own cap.
- Once legally created/active, the Fort is ordinary input to P03/P09/P18/P24/P50/N08/N10 and other Fort consumers; those downstream mechanics do not need a special P37 implementation.

**Resolved mechanic-definition result (#45)**

- Placement/activation/cap-conflict semantics are canonical: exact landing cell only; ordinary physical placement/occupancy and hard ownership admission apply; successful grants are immediately active completed L1; failed grants create nothing and never invalidate the successful territorial landing.

---

## P38 — Return by Death

**Direct transformations / owners**

- Automatic-defense successful-capture casualty resolution.
- Population accounting for the defending faction.
- When a P38 holder's automatically defended cell is successfully captured, the one automatic defender survives and remains/returns Available instead of being lost.

**Required seams / dependencies**

- `automatic defender assignment -> successful ownership transfer -> ordinary capture casualty point -> P38 suppresses defender loss -> defender remains/returns Available`.
- Ownership transfer remains ordinary.
- The attacker's ordinary successful-capture consequences remain ordinary; P38 changes defender survival only.
- The defender must survive exactly once under multi-faction/simultaneous resolution and must not be duplicated into Available Population while also remaining counted elsewhere.
- Because automatic defense may cover owned conquerable `0 Capacity` terrain, P38 validation must include defended Tundra/Shallow-Water capture as well as ordinary population-bearing land rather than assuming P38 is Capacity-gated.

**Explicit interactions**

- `P38 + P47`: inspect when P47 is audited. P38 preserves the defender while P47 adds a separate post-capture casualty to the capturing faction on Marsh; neither should erase the other's independent casualty rule.
- P03/P09/P13/P51 and other defensive-effect traits may change whether/when capture succeeds, but once a successful capture occurs they are ordinary upstream state rather than separate P38 pair mechanics.

**Non-effects**

- P38 does not prevent capture, refund the attacker's casualty, recreate ownership, create an extra automatic defender, or protect non-automatic committed counter-response Population.

---

## P39 — Stereo Separation

**Direct transformations / owners**

- Spawn mode-independent effective profile: two stable exact-origin slots and two generated Initial-Territory footprints sharing one final faction quota.
- Strategic Spawn additionally uses two half-ordinary-area influence slots; Random and Fixed do not fabricate influence regions.
- Starting Population remains one global pool.

**Required seams / dependencies**

- Stable slot identity is canonical across all modes: `originSlot 0 = PRIMARY`, `originSlot 1 = SECONDARY`; geography never re-sorts them.
- Strategic Spawn: both half-area influence slots are one simultaneous faction decision; Phase-3 submits two exact origins; same-faction origins must be distinct legal cells but are exempt from foreign-faction 50-cell spacing against each other.
- Random Spawn: resolves exactly two distinct same-faction origins deterministically as one simultaneous allocation; own slots remain exempt from the foreign 50-cell rule while all foreign spacing remains canonical.
- Fixed Spawn: requires exactly two authored legal distinct origins; wrong count, illegal terrain, duplicate own slots, or foreign-spacing violation rejects the fixture/configuration with no displacement, repair, fallback, or profile downgrade.
- `final modified Initial-Territory total -> stable primary/secondary quota split -> simultaneous independent footprint growth -> one political faction ownership result`.
- Odd one-cell quota remainder goes to `originSlot 0`.
- Same-faction footprint conflict over one candidate cell follows canonical footprint-slot ordering for queue accounting without duplicating political ownership.
- `final total Initial Territory -> Population initialization`: Starting Population is calculated once from the final total and never split into local pools.
- Replay/snapshot preserves spawn mode, effective profile, each stable origin slot/source/reason, per-footprint quota/shape/cell set/hash, and resolver version; Strategic-only phase submissions are recorded only in Strategic mode.

**Explicit interactions**

- `P39 + P01`: P01 modifies the **total** quota before P39 divides it; current ordinary baseline yields `575 + 575` and one global Starting Population of `575`.
- `P39 + P54`: explicitly legal. Each stable split footprint consumes an independent `P54_STAR_V1` priority field without duplicating total quota.
- `P39 + P20`: after Initial-Territory ownership, exactly one starting-Silo grant is requested at primary `originSlot 0`; #45 generic admission applies, no secondary grant exists, and failed exact-cell admission searches no alternate cell.
- Inspect P48 when audited because faction-effective population-bearing classification can affect footprint quota accounting.
- `P01 + P39 + P54` remains not builder-legal under current positive spend, so no public runtime certification case is required for that triple.

**#32 closure status**

- P39 semantics are now canonically defined in Strategic, Random, and Fixed Spawn. Runtime certification may remain `UNAVAILABLE` until the concrete Spawn resolver/test harness exists, but P39 is no longer `BLOCKED` on undefined Random/Fixed or multi-origin singular-grant semantics.

---

## P40 — Barrier Magic

**Direct transformations / owners**

- Persistent SAM effective profile/interception state.
- Effective SAM range is `1.5x` ordinary range, charge capacity is exactly **one** at every completed level, and recharge cooldown is `2x` ordinary cooldown.
- SAM targeting remains automatic; P40 creates no controller-driven interception action.

**Required seams / dependencies**

- `completed SAM level -> ordinary range -> P40 range multiplier -> physical interception coverage`.
- `SAM charge state -> one-charge cap at every level -> interception expenditure -> doubled recharge -> ready state`.
- Upgrading may change the ordinary range input but must never create extra charges while P40 is active.
- Strategic-projectile entry into effective coverage must consume the transformed range/charge/recharge profile through the ordinary deterministic interception system.

**Explicit interactions**

- `P40 + P11`: P11 governs SAM ownership entitlement/FFY cost while P40 transforms each legally existing SAM's profile; neither bypasses the other.
- `P40 + P27`: P27 ship attacks, once canonically defined, must use the same effective P40 range/one-charge/recharge resource rather than a parallel anti-ship charge pool.
- `P40 + P10`: faster strategic projectiles and larger/slower-recharging single-charge SAM fields change the same interception scenario and should receive combined projection coverage when builder-legal.
- `P40 + N11`: N11 consumes SAM Launcher area for FFY hard-zero qualification; when N11 is audited it should consume the **effective** P40 SAM area unless its canonical owner explicitly defines another coverage concept.

**Implementation requirement / non-effects**

- Fractional effective ranges such as `105 x 1.5 = 157.5` require deterministic fixed-point/distance comparison, but that is an implementation representation requirement rather than a new gameplay mechanic.
- P40 does not change SAM ownership, cost, target families, projectile damage, or structure level; P27 remains the owner of any anti-ship permission.

---

# 6. Focused #48 Trade-voyage snapshot validation obligations

The canonical Trade-voyage economic snapshot, mutable first-capture lifecycle state, signed-transaction execution, and N14/N16 economic consumption semantics are owned by `FFY_ECONOMY.md` together with the Origin transformations supplied by `ORIGIN_TRAIT_CATALOGUE.md`. This section records deterministic conformance relations for those owners; it does not become a second formula or trait-mechanics owner.

**Required relational invariants / scenario coverage**

- with no eligible launch-time positive-event modifiers or hard zero, `ownerSuccessValueFfy == rawCargoFfy`;
- launch-time P14/N04 terrain qualification at the planned destination changes the stored reference exactly through the canonical positive-event pipeline once;
- launch-time P24/N11 field qualification changes/hard-zeroes that reference once the canonical field affiliation/geometry contract supplies membership;
- peaceful, wartime-baseline, and P08 launch states produce identical `ownerSuccessValueFfy` when every other launch-time input is identical;
- changing `atWar` before ordinary completion may change the actual completion payout while `ownerSuccessValueFfy` remains byte-for-byte/equivalent-value unchanged;
- rerouting to another destination leaves `valuationCellId` and `ownerSuccessValueFfy` unchanged;
- `firstHostileCaptureResolved == false` at launch; the first valid hostile capture sets it `true` atomically with the first-capture transition; no recapture/reroute returns it to `false`;
- N14-only first hostile capture: `requestedOwnerDelta == -ownerSuccessValueFfy` exactly once;
- N16-only first hostile capture: `requestedOwnerDelta == +ownerSuccessValueFfy` exactly once;
- N14 + N16 first hostile capture: fact-level `requestedOwnerDelta == 0` before same-tick signed aggregation or any balance floor;
- isolated N14 low-balance tick: with no other ordinary positive FFY event or signed FFY fact for that owner on the tick and `ownerBalanceBefore < ownerSuccessValueFfy`, the requested delta remains the full negative reference amount and the post-signed-stage balance is `0`;
- isolated N16 successful-uncaptured tick: with no other ordinary positive FFY event or signed FFY fact for that owner on the tick, ordinary positive Trade payout is suppressed, `requestedOwnerDelta == -ownerSuccessValueFfy`, and post-signed-stage balance equals `max(0, ownerBalanceBefore - ownerSuccessValueFfy)`;
- same-owner multi-fact tick: if two or more signed voyage facts resolve on one tick, the FFY owner's `tickSignedDelta` equals the sum of their already-netted fact-level requested deltas, and reversing fact-processing order must produce the same tick delta and final balance;
- ordinary-positive-plus-signed same tick: ordinary positive FFY events must finalize before the one per-faction signed stage, so `balanceAfterSignedStage == max(0, balanceAfterOrdinaryPositiveEventsForTick + tickSignedDelta)`;
- affordability-gated purchases/costs are not members of `tickSignedDelta`; validation must reject any implementation that hides purchase, embarkation, or strategic-weapon spending inside this signed-consequence aggregation;
- destruction or return/termination without successful uncaptured completion produces no N16 replacement transaction;
- repeated capture/recapture with `firstHostileCaptureResolved == true` produces no additional first-capture owner adjustment;
- exact persistence chain: first hostile capture -> original-owner recapture -> save -> load -> hostile capture again must preserve `firstHostileCaptureResolved == true` and produce zero additional first-capture adjustment;
- save immediately after first hostile capture -> load must preserve permanent cancellation of the original uncaptured commercial-completion path;
- N14/N16 signed transactions never run through ordinary positive FFY modifiers a second time, including when their fact-level or tick-level net signed delta is positive;
- terminal captured-cargo base remains `rawCargoFfy` even when `ownerSuccessValueFfy != rawCargoFfy`; `Vowner` must never replace physical cargo value;
- save/load restores both the immutable voyage economic snapshot and mutable first-capture lifecycle state without revaluation/reconstruction from current ownership; deterministic replay/regeneration reproduces the immutable launch snapshot from the same versioned launch state.

**Resolved mechanic-definition result (#48)**

- `FFY_ECONOMY.md` now owns the missing voyage snapshot, first-capture persistence, same-fact and same-tick signed-transaction netting, non-negative balance-floor execution, and ordinary cargo separation. The obligations above consume those contracts for certification; runtime conformance may remain `UNAVAILABLE` until the corresponding Open Fufu Trade gameplay implementation exists, but these traits are no longer blocked on undefined voyage-value or first-capture transaction semantics.

---

# 7. Running mechanic-closure findings

These are **not #31 validation-design decisions**. They are mechanic-definition questions discovered because honest certification needs a canonical expected result.

| Trait | Finding | Validation consequence |
| --- | --- | --- |
| P02 | Exact replacement `30–70%` Population-utilization curve/anchors must be canonically available. | P02 semantic conformance cannot finalize without the intended curve. |
| P05 | `FFY_ECONOMY.md` now owns the previously missing P05 value/location/capture-tick sampling semantics from #48. | P05 is no longer blocked on its own FFY semantics; runtime coverage must exercise type valuation, faction-wide/spatial snapshot inputs, structureless same-tick territory changes, and capture-tick order invariants. Exact P24/N11 membership cases remain conditional on their separate field contract. |
| P07 | Factory Train-service ownership epochs, P07 phase transfer/reset, in-flight old-epoch Train behavior, and serialization are closed by #49. | P07 is no longer blocked on Factory ownership-transfer scheduler semantics; runtime coverage must reproduce the canonical lifecycle. |
| P09 | `+10% Fort coverage area` needs deterministic representation against radius-based baseline data; `+9% Fort defensive pressure` needs unambiguous composition semantics. | Structure/combat projection cannot finalize by guesswork. |
| P10 | `warhead projectile speed` must identify the exact affected projectile classes, especially MIRV carrier vs separated warheads. | P10 projectile/interception projection remains incomplete until classified. |
| P20 | **Resolved by #32:** singular start-state placement/order is once per faction at stable primary `originSlot 0` after Initial-Territory ownership; #45 owns exact-cell admission/result. Initial charge readiness remains #46-owned. | Spawn/grant placement conformance is no longer blocked by #32; full Silo start-state certification still depends on #46 charge readiness. |
| P24 | Qualifying Fort affiliation for `inside Fort areas` is not explicit. | Spatial FFY qualification cannot be certified for own/team/enemy Fort overlap cases without a canonical ownership/team boundary. |
| P25 | `+50%` Hydrogen blast **area** lacks an exact deterministic inner/outer geometry transformation, including optional Water-Nukes core/fringe behavior. | P25 runtime/replay footprint certification cannot infer radii/raster rules from the percentage alone. |
| P27 | Anti-ship SAM semantics do not yet specify target classes, damage/effect, cadence, charge use, or target-priority arbitration. | P27 naval/SAM conformance is blocked on the focused mechanic definition. |
| P28 | Transport-Population theft lacks exact qualifying kill attribution, recipient Population state, and resolution ordering. | P28 destruction-to-Population-transfer conformance cannot have one canonical expected result yet. |
| P29 | Dynamic Warship-rank -> effective-Silo-level changes do not yet state new charge-slot readiness semantics. | P29 charge/cooldown certification is incomplete when rank changes launcher capacity. |
| P34 | P34's exact four transformed Factory axes, current-owner `CAPTURE_TRANSFER` provenance, Train economic snapshot, Tank-build speed semantics, and Factory/P07 transfer lifecycle are closed by #49. | P34 is no longer blocked on a generic Factory-effect interpretation; runtime/AI must consume the explicit effective profile. |
| P35 | Generic deliberate-abandonment semantics do not yet define eligibility/fate for persistent structures or other ownership-bound state on relinquished cells. | P35 can certify the Fallout overlay only after the ordinary abandonment result is canonical for occupied cells. |
| P36 | Faction-level half-Population residual accounting does not define the eventual whole-Population debit destination/order across multiple concurrent expansion commitments. | P36 multi-operation settlement accounting cannot have one deterministic expected state yet. |
| P39 | **Resolved by #32:** Strategic/Random/Fixed two-origin semantics, stable slot identity, strict Fixed validation, deterministic Random resolution, quota split, replay binding, and P20 singular-grant interaction are canonical. | P39 semantic coverage is no longer blocked by #32; executable certification may remain unavailable until the Spawn runtime/harness exists. |

The former P23 concurrent-cap and P37 grant-placement/lifecycle blockers are resolved by #45. Implementation-specific deterministic numeric representation/rounding requirements, such as P17's `0.99^S` and P40's fractional effective range, must also be testable, but they do not become new gameplay mechanics unless the canonical numeric rules need a semantic rounding decision.

---

# 8. Emerging validation boundaries — provisional

Do not freeze the final domain catalogue until all traits are audited, but P01–P40 plus the focused #48 N14/N16 closure currently reveal recurring owners/seams around:

- Spawn / pre-match initialization and multi-slot spawn profiles;
- Population initialization, growth, peak-state tracking, settlement cost/residuals, automatic-defender survival, and explicit Population transfers;
- land combat / pressure / counter-response / capture casualty resolution;
- terrain/acquisition / deliberate abandonment / Fallout overlays;
- persistent structures / provenance / ownership / grants / purchase-upgrade transactions / spatial coverage;
- FFY economy / physical Trade and Train logistics / location-conditioned events / Train-event side effects / immutable voyage-value snapshots and mutable first-capture lifecycle state;
- naval/amphibious physical lifecycle, Warship profile/rank/caps/repair, Transport health/destruction/landing;
- strategic weapon legality, launcher/charge state, projectile/blast geometry, and SAM interception/anti-ship behavior;
- cross-system state/event seams such as Spawn -> Population, structure capture -> typed disposition/admission/consequences -> FFY/Factory provenance, Fort/Port/SAM fields -> combat/economy/naval behavior, Population peak -> SAM entitlement, Train event -> Population, Trade launch -> serialized owner-value snapshot -> first-capture lifecycle -> capture/completion signed transaction, Transport destruction -> Population transfer, amphibious landing -> exact-cell Fort grant, and Warship state -> mobile strategic launcher.

These are evidence from the completed traces, not yet a final taxonomy.

---

## Next work items

- audit P41–P50 using the same dependency-trace procedure;
- continue through P54 and N01–N18 in bounded batches; when N14/N16 receive their full trait-audit entries, consume the already-canonical #48 snapshot contract rather than reopening it;
- derive the final validation-domain catalogue from completed traces rather than forcing traits into a preselected taxonomy;
- derive the explicit interaction registry from actual same-hook/cross-system dependencies;
- route mechanic-definition blockers to their canonical owners/issues without solving them inside validation metadata;
- convert accepted coverage into executable validation metadata/tests only after relevant mechanics are implementation-ready.
