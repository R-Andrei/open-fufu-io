# Open Fufu — Canonical Origin Trait Catalogue

## Status and authority

This file is the **canonical owner for Origin builder rules, Origin trait identities, trait costs/refunds, trait-specific mechanics, and trait-specific interaction semantics**.

Neighboring concerns are owned elsewhere and are referenced rather than restated here:

- high-level game-wide invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- game-wide effective-rule composition, modifier algebra, normalization, and serialization: [`RULE_COMPOSITION.md`](./RULE_COMPOSITION.md);
- OpenFront → Open Fufu migration sequencing: [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md);
- Official Origin roster/content: [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md);
- terrain, persistent structures, and baseline Tank chassis: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- FFY, Factory Train service, and Trade Ship economics: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Echo mechanics and progression: [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md);
- Strategic Spawn protocol, profiles, geometry, and resolver: [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md);
- Warships, Transports, and strategic weapons: [`NAVAL_AND_STRATEGIC_WEAPONS.md`](./NAVAL_AND_STRATEGIC_WEAPONS.md);
- Minor Factions / Goons: [`MINOR_FACTIONS.md`](./MINOR_FACTIONS.md).

Trait names below are the accepted V1 player-facing naming baseline. Stable mechanical IDs (`Pxx` and `Nxx`) remain the canonical identifiers for rules, saves/replays, tests, and future content maintenance even if presentation wording later changes.

Costs/refunds and exact trait tuning below are accepted provisional V1 Origin data. Retuning them requires an explicit versioned change to this catalogue; another subsystem document must not silently redefine them.

---

## Builder rules

```text
Base Origin Points:       10
Maximum selected traits:   5
Maximum drawback refund:  10
Maximum positive spend:   20
```

Canonical catalogue invariants:

- Official and Custom Origins use the same public catalogue and builder rules.
- No trait tiers, Major/Minor taxonomy, hidden categories, pairwise exclusions, incompatibility families, or runtime vetoes exist.
- Players select creator-authored traits; they never provide formulas, scripts, callbacks, or arbitrary numeric parameters.
- Every combination satisfying the public budget, trait-count, and drawback-refund rules must be legal in production.
- Candidate catalogue versions must be certified under the Origin-validation architecture in [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md). Every builder-legal combination must compose deterministically and safely; expensive runtime certification targets the trait mechanics, meaningful interactions, and distinct gameplay-domain projections that those combinations can produce rather than every named Origin instance.
- Origins should prefer playstyle-changing rules, tradeoffs, geography, and structural constraints over generic stat tuning better suited to Echoes.

A named Official or Custom Origin is a configuration of one certified catalogue version, not a new mechanical implementation. Creating, loading, or starting a match with such an Origin therefore requires ordinary version, trait-ID, builder-legality, canonical-composition, and serialization checks; it does **not** trigger a new headless/runtime certification job merely because that exact named combination has not appeared before. Runtime conformance remains owned by the gameplay domains the selected traits affect or interact with, as defined by the migration validation architecture.

---

## Positive / cost traits

| ID | Name | Effect | Cost |
| --- | --- | --- | ---: |
| P01 | **Domain Expansion** | `+15% Initial Territory` | 7 |
| P02 | **The Era of Humans** | Replace ordinary Population-utilization growth curve with the accepted 30–70% profile | 9 |
| P03 | **Imagine Breaker** | Ignore enemy Fort defensive-pressure bonuses | 7 |
| P04 | **Level 0** | Response-side counter-response effectiveness fixed at `1.0`, ignoring normal response-side imbalance bonus/penalty | 3 |
| P05 | **Big Shot** | Capturing enemy structures generates military/conquest FFY events | 8 |
| P06 | **See You, Space Cowboy** | `+25% Trade Ship speed` | 5 |
| P07 | **Galaxy Express 999** | `+25% trains spawned`: every fourth normal primary Train dispatch from each Factory simultaneously launches one additional bonus Train | 4 |
| P08 | **Tea Time** | Wartime trade multiplier becomes `1.0` instead of `0.5` | 4 |
| P09 | **Wall Maria** | `+10% Fort coverage area, +9% Fort defensive pressure, -8% Fort cost` | 5 |
| P10 | **Scorpion's Tail** | `+100% warhead projectile speed` | 4 |
| P11 | **Level Upper** | SAMs cost `0 FFY`; each 25,000 peak Total Population unlocks one SAM ownership/build slot | 8 |
| P12 | **Somewhere Not Here** | `+25% Transport Ship speed` | 6 |
| P13 | **Mountain Training Arc** | Mountains provide `+33% defensive pressure` | 4 |
| P14 | **60 Billion Double Dollars** | FFY events located on Desert yield `+33% FFY` | 4 |
| P15 | **The High Ground** | `+33% offensive pressure on Highlands` | 4 |
| P16 | **Poison Taster** | Ignore ordinary Fallout capture resistance | 4 |
| P17 | **Ten Billion Percent** | Structure upgrade cost multiplier is `0.99^S`, where `S` is currently owned structures | 7 |
| P18 | **The Best Defense** | `+100% offensive pressure` for engagement lanes whose attacking source cell lies inside a self/fixed-teammate Fort area | 5 |
| P19 | **The Weak Die First** | `+5% offensive pressure` per distinct currently active other faction with current Territorial Contact, including Minor Factions | 8 |
| P20 | **A Miracle Is Merely a Miscalculation** | Start with a free Missile Silo | 7 |
| P21 | **Fun Things Are Fun** | First purchase of each structure consumes `0 FFY`, after ordinary affordability/legality succeeds | 7 |
| P22 | **Limit Break** | `+2 maximum Warship rank` | 6 |
| P23 | **Space Battleship Yamato** | Warships `+20% range, +20% damage, +20% speed`, but may own only one | 8 |
| P24 | **A King's Price** | FFY events located inside Fort areas yield `+20% FFY` | 7 |
| P25 | **EXPLOSION!** | Cannot use Atom Bomb or MIRV; Hydrogen Bomb blast area `+50%`, FFY cost `+50%` | 10 |
| P26 | **Serious Punch** | May use MIRV at most once; ordinary affordability/legality required, successful MIRV consumes `0 FFY` | 8 |
| P27 | **Only My Railgun** | SAM Launchers may attack ships | 9 |
| P28 | **Blood Devil** | Destroying Transport Ships steals their carried Population | 9 |
| P29 | **The Kaiser** | Warships may serve as Missile Silo launch platforms from their current cell | 9 |
| P30 | **The Conman** | Warships `+50% speed`, piracy FFY `3×`, but Warships cannot use naval gunfire against ships; Trade Ship pursuit/capture remains | 6 |
| P31 | **Heart-Under-Blade** | Warships inside owned active Port repair fields receive `2×` ordinary Port repair radius and `1.5×` ordinary Port repair rate; they may remain operational while receiving it | 6 |
| P32 | **Armored Titan** | Transports may embark only from owned active Ports, but become armored/health-bearing with `500 HP` | 6 |
| P33 | **Misaka Network** | Every Train-triggered economic event at an owned City also grants `20 × completed City level` Available Population to that City owner, Capacity-capped | 6 |
| P34 | **Spoils of the Empire** | Factories acquired through conquest operate at `50% increased effectiveness` while owned | 6 |
| P35 | **It's a Matter of Visualization** | Deliberately relinquished cells become neutral Fallout until next successful capture | 6 |
| P36 | **Half-Priced Bento** | Neutral settlement costs `0.5 Population/cell` instead of `1`, using faction-level persistent residual accounting | 5 |
| P37 | **The City Mouse** | Transport embarkation costs `+250 FFY`; each successful amphibious landing grants a permanent level-1 Fort at the landing location | 7 |
| P38 | **Return by Death** | When one of your automatically defended cells is captured, its automatic defender survives and remains/returns Available | 10 |
| P39 | **Stereo Separation** | Start from two origins; Initial Territory is split between them | 10 |
| P40 | **Barrier Magic** | SAMs become giant single-charge shields: provisionally `+50% range`, exactly one charge at every level, `2×` recharge cooldown | 6 |
| P41 | **Level 5** | Purchased Cities are created directly at level 5 for `95%` of cumulative ordinary level-1 build + level-2–5 upgrade cost | 6 |
| P42 | **The Price of Empire** | Warships cost `0 FFY`; each purchase permanently consumes `2,000 Available Population`; those Warships have `-33% attack range` | 9 |
| P43 | **The Devil of the Rhine** | **Heavy Artillery:** all Tanks transform into Heavy Artillery: `10s` build time, `1.5×` purchase cost, `0.5×` movement, `1.5×` weapon range, `1,000` anti-armor damage / `12s`, `1,000` Population damage / `12s`, Train raiding disabled; same Tank terrain barriers; projectiles may cross terrain the unit cannot traverse | 8 |
| P44 | **Nobel Prize** | **Radioactive Munitions:** successful Tank/Heavy-Artillery Population attacks neutralize enemy population-bearing cells and apply Fallout; Tank affects up to `10` cells in Manhattan radius 2, Heavy Artillery up to `50` cells in Manhattan radius 5 | 9 |
| P45 | **Hidden Leaf Village** | **Forest concealment:** enemy tactical observation cannot penetrate the interior of Forest cells owned by this faction; exposed Forest-front boundary cells remain observable and hostile manifestations reveal only the minimum directly relevant attacking state | 6 |
| P46 | **Northern Lands** | May construct persistent structures on owned **Tundra**; Tundra otherwise retains its ordinary terrain identity | 4 |
| P47 | **This Is Poison** | Whenever an enemy successfully captures one of this faction's **Marsh** cells, the capturing faction loses `+1 Population` after ordinary capture resolution | 4 |
| P48 | **Aqua's Blessing** | Owned **Shallow Water** is population-bearing for this faction and contributes `+1 Population Capacity/cell`; all other Shallow-Water properties remain unchanged | 4 |
| P49 | **Laughing Man** | **Counterintelligence Observation Posts:** owned Observation Posts no longer provide tactical observation; instead their ordinary completed-level radius becomes an enemy-intelligence blackout area that conceals this faction's units, structures, and manifested operational state inside it | 7 |
| P50 | **Iserlohn Fortress** | **Fort general support:** Forts also project offensive pressure equal to their normal defensive-pressure magnitude across their existing Fort coverage area | 5 |
| P51 | **One Flag Beneath the Stars** | **Command general support:** Command Posts also project defensive pressure equal to their normal offensive-pressure magnitude across their existing Command Post coverage area | 5 |
| P52 | **Humanity Has Declined** | **Underpopulation economy:** gain additional passive FFY at `max(0, Population Capacity - Total Population) / 250` FFY per second | 6 |
| P53 | **Money Is Everything** | **Strategic-stockpile economy:** gain `2,000 FFY/s` per ready launch charge on owned active persistent Missile Silo structures; P29 Warship launch capability does not count | 8 |
| P54 | **Starlight Breaker** | Initial Territory starts in a five-point star | 5 |

---

## Negative / refund traits

| ID | Name | Effect | Refund |
| --- | --- | --- | ---: |
| N01 | **The Lost Decade** | Cities contribute `20% less Population Growth` | -4 |
| N02 | **Flat Is Justice** | `25% reduced Plains offensive pressure` | -4 |
| N03 | **I Hate Sand** | `33% reduced Desert defensive pressure` | -4 |
| N04 | **Northern Expedition** | FFY events located on Mountain yield `50% less FFY` | -4 |
| N05 | **Curse of the Abyss** | Cannot capture Fallout terrain | -5 |
| N06 | **No Second Season** | Cannot spend FFY to upgrade buildings | -5 |
| N07 | **One Piece** | Cannot own more than one of each building/structure type | -10 |
| N08 | **It's Just Decoration** | Forts provide no defensive-pressure bonus | -4 |
| N09 | **Medieval Isekai** | Cannot build Factories | -6 |
| N10 | **Domain Contraction** | `25% reduced Fort coverage area` | -4 |
| N11 | **Absolute Territory** | FFY events located inside SAM Launcher area yield `0` | -7 |
| N12 | **Panzer Vor!** | Cannot build Warships | -6 |
| N13 | **Beach Episode Gone Wrong** | `50%` of Transport Population dies when landing | -7 |
| N14 | **To Them Words Are Merely a Means to Deceive** | When one of your Trade Ships is first captured by a hostile faction, lose FFY equal to that voyage's snapshotted ordinary owner-side success value | -4 |
| N15 | **King's Ransom** | `+500 FFY` Transport embarkation cost | -5 |
| N16 | **Insurance Fraud** | Successful uncaptured Trade Ship voyages cost the owner their snapshotted voyage value; hostile capture instead returns that value once | -6 |
| N17 | **I Can Cut It** | Enemy structures you would ordinarily capture are destroyed instead of transferred to you | -4 |
| N18 | **I Have No Enemies** | Final capture/settlement progress against **non-Fallout** target cells is multiplied by `0.50`; Fallout targets are exempt from this drawback | -8 |

---

## Canonical trait semantics and composition

The trait tables above are normative. This section resolves trait-specific edge cases and interactions. It intentionally does not reproduce the ordinary subsystem baselines those traits modify.

### Fallout traits — P16, P35, P44, N05, N18

- P16 ignores only the ordinary Fallout acquisition penalty; it does not change the underlying terrain.
- N05 makes Fallout uncapturable for the holder.
- P35 applies Fallout only to cells the holder deliberately relinquishes; ordinary enemy capture does not trigger it. The created Fallout remains until the next successful capture.
- P44 applies only after a successful Population attack, never anti-armor combat or Train interception. Eligible cells are enemy-owned, population-bearing, and not structure-occupied; candidates are ordered by Manhattan distance and then stable cell ID. A Tank affects at most 10 eligible cells inside Manhattan radius 2; P43 Heavy Artillery affects at most 50 inside radius 5. The search never expands outside the authored footprint merely to fill the cap.
- N18 is a structural post-multiplier on final capture/settlement progress for non-Fallout targets only. It does not modify pressure, casualties, settlement Population cost, terrain identity, movement, or structure legality. P16 + N18 therefore remains a legal inversion in which P16 removes the Fallout penalty while N18 continues to halve non-Fallout acquisition.

Ordinary Fallout and terrain behavior are owned by `TERRAIN_AND_STRUCTURES.md`.

### P17 — structure-upgrade compounding

```text
upgradeCostMultiplier = 0.99^S
```

`S` is the holder's currently owned persistent-structure count. No additive negative-cost clamp is needed for this multiplicative rule.

### P18 — Fort-supported offense

P18 checks the attacking **source cell**. A lane qualifies when that source lies in at least one self/fixed-teammate Fort area. Multiple qualifying Forts do not multiply P18.

### P19 — current-contact offense

P19 counts distinct currently active other factions with current Territorial Contact, not disconnected Contact components or historical contacts. A faction stops contributing when contact disappears or that actor ceases to be an active territorial faction; it contributes again if active contact later returns.

`Other faction` is literal: a fixed teammate may count, and an active Minor Faction counts once regardless of the number of disconnected contact components. Minor-Faction identity/lifecycle is owned by `MINOR_FACTIONS.md`.

### P10 — warhead projectile speed

P10 applies its authored `+100% projectile speed` modifier to the canonical `warhead projectile` class defined by `NAVAL_AND_STRATEGIC_WEAPONS.md`. It does not transform other strategic-projectile classes or any non-motion weapon axis. Projectile classification, baseline motion, launch-bound motion snapshots, MIRV separation behavior, and interception consumption remain owned by that strategic-weapons document.

### P25 — Hydrogen specialization

P25 supplies three Origin-level transformations:

- Atom Bomb use is forbidden;
- MIRV use is forbidden;
- Hydrogen Bomb FFY cost and Hydrogen Bomb blast **area** each receive the authored `+50%` multiplier, equivalently `3/2`.

The blast modifier is an area multiplier, not a radius multiplier. `NAVAL_AND_STRATEGIC_WEAPONS.md` is the sole owner of how an effective blast-area multiplier becomes deterministic squared geometry, `STRATEGIC_BLAST_V1` raster membership, Water-Nukes CORE/FRINGE effects, seed/version binding, and replay state.

### P11 — Population-unlocked SAMs

Each full 25,000 of **peak Total Population reached during the match** permanently unlocks one P11 SAM ownership/build slot. Starting Population contributes to the initial peak; later Population loss does not revoke unlocked slots. P11 makes both SAM construction and SAM upgrade FFY cost exactly zero; ordinary non-FFY legality still applies.

The unlocked count is a hard SAM ownership-admission constraint. It therefore constrains every path that would make another SAM belong to the holder, not only a paid build. Existing/under-construction SAMs and committed ownership reservations consume slots under the generic structure-admission contract. When P11 and N07 both apply, an acquisition must satisfy both hard ownership constraints; canonical normalization/composition of multiple cap-valued rule sources is owned by `RULE_COMPOSITION.md`.

### N07 — one-per-type structure ownership

N07 is a hard ownership cap of exactly one persistent structure of each canonical type. It is not merely a purchase limit.

- purchases/builds, grants, start-state/scenario grants, and capture transfers must all pass the same ownership admission;
- an admitted under-construction structure reserves the one slot immediately;
- sibling actions in one atomic controller decision cannot oversubscribe the slot;
- upgrades consume no additional slot;
- destruction or successful transfer away releases the slot at the authoritative ownership transition;
- a successful territorial capture is never blocked merely because the captured structure cannot be admitted.

If a captured structure would transfer to an N07 holder whose slot for that type is full, the cell capture succeeds and the incoming physical structure is destroyed by the canonical capture resolver instead of transferring. Same-tick outgoing/incoming slot ordering and deterministic tie-breaking are owned by `TERRAIN_AND_STRUCTURES.md`.

### P04 — response-side counter-response

P04 fixes only the response-side counter-response effectiveness hook at `1.0`. Attack-side effectiveness remains ordinary unless another explicit rule changes it. The ordinary counter-response model is owned by `COMBAT_TUNING.md` and the high-level combat contract.

### P05 — successful structure-transfer conquest event

P05 fires from the canonical `STRUCTURE_TRANSFERRED` capture consequence, not merely from capturing a cell that happened to contain a structure. Exactly one qualifying conquest FFY event is generated for each enemy persistent structure that successfully transfers to the P05 holder through territorial capture.

If N17 changes the structure disposition to destruction, or transfer admission fails and the capture resolver destroys the structure, P05 does not fire. `FFY_ECONOMY.md` owns P05's exact base value, event location, earning-state sampling boundary, and FFY-pipeline behavior. `TERRAIN_AND_STRUCTURES.md` remains the sole canonical owner of structure prices.

### Grants, purchases, and entitlements — P20, P21, P26, P37

- P20 is a starting structure **grant**, not a purchase, and does not consume P21's first-Silo purchase entitlement. After Initial-Territory ownership is established, Spawn requests exactly one L1 Missile Silo at the faction's stable primary exact origin (`originSlot 0`), even for P39. The request then uses generic structure admission and, on success, materializes one immediately active completed L1 Missile Silo. If exact-cell admission rejects the grant, Spawn does not search for another Silo cell and the territorial start remains valid. The admitted Silo uses the ordinary newly materialized persistent-Silo lifecycle rather than a P20-specific charge exception.
- P21 still requires ordinary legality/affordability validation; the first successful purchase of each structure type consumes `0 FFY`.
- P26 still requires ordinary MIRV launcher/legality/affordability validation; the one permitted successful MIRV consumes `0 FFY` but still consumes one ordinary ready launcher charge on commit.
- P37's landing-created Fort is a **grant**, not a purchase, and does not consume P21's first-Fort purchase entitlement. On successful grant admission it materializes as an immediately active completed L1 Fort.

Grant placement/admission and persistent-Silo charge lifecycle are owned generically by `TERRAIN_AND_STRUCTURES.md`; strategic-launch transactionality is owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`. These traits only create/transform their authored requests/results.

### P23 — single-Warship ownership cap

P23 supplies a hard effective Warship ownership cap of exactly one. The cap counts an owned Warship plus any already committed Warship still under construction, and atomic decision validation reserves the slot so multiple Ports cannot oversubscribe it in one proposal.

A quote does not reserve the slot. With no Warship yet, multiple individual build quotes may each be legal against the same immutable snapshot while a proposal containing more than one capped build is rejected atomically with `OWNERSHIP_CAP`.

P42's Population-funded Warship purchase does not bypass P23. Destruction/cancellation of the owned or under-construction Warship releases the slot at the authoritative lifecycle transition. Baseline construction/reservation mechanics are owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`.

### P29 — Warships as strategic-weapon launchers

P29 makes each owned Warship a legal strategic-weapon launcher from its current cell and supplies:

```text
effective Silo level = max(1, Warship rank)
```

P29 does not itself change the Warship rank cap; P22 composes normally by raising that cap. `NAVAL_AND_STRATEGIC_WEAPONS.md` owns exact physical-launcher selection and the mobile-launcher charge lifecycle, while `TERRAIN_AND_STRUCTURES.md` owns ordinary Silo level → weapon access/capacity. P29's mobile Warship state never becomes a persistent Missile Silo structure.

### P30 — pirate Warship conversion

P30 removes naval gunfire against ships while preserving Trade Ship pursuit/capture. Its speed and piracy multipliers are the trait values in the table above. Captured-cargo routing and payout semantics remain owned by `FFY_ECONOMY.md`.

### N14 and N16 — snapshotted Trade-voyage value

Both traits use the canonical launch-time owner-side voyage value (`Vowner`) defined by `FFY_ECONOMY.md`.

- On the first hostile capture only, N14 contributes one original-owner signed FFY component of `-Vowner`.
- N16 replaces successful uncaptured owner payout with one original-owner signed FFY component of `-Vowner`; on first hostile capture instead it contributes one original-owner signed FFY component of `+Vowner`.
- N14 + N16 is legal; on the same first-hostile-capture fact their `-Vowner` and `+Vowner` components net to exactly `0` before FFY balance application.

This catalogue owns those trait triggers, signs, and reference amounts. `FFY_ECONOMY.md` owns `Vowner` valuation, first-capture lifecycle persistence, signed-component aggregation, the non-negative FFY balance floor, and ordinary voyage/cargo/payout execution. A catalogue component therefore remains exactly `±Vowner` even when the realized balance movement is limited by the FFY owner's non-negative balance rule.

### P31 — enhanced Warship Port repair

For Warships only:

```text
P31 repair radius = ordinary eligible Port repair radius × 2.0
P31 repair rate   = ordinary eligible Port repair rate × 1.5
```

The Warship may remain operational while receiving P31 repair. P31 does not extend itself to other health-bearing naval units; those use their ordinary eligible Port repair unless another trait modifies them. Port repair baselines and overlap semantics are owned by `TERRAIN_AND_STRUCTURES.md`.

### P32 — armored Port-launched Transport

P32 requires an owned active Port as the embarkation source and gives the Transport `500 HP`. The transformed Transport is therefore health-bearing and may use otherwise eligible naval repair. All other Transport baseline mechanics are owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`.

### P33 — Train-stop Population

Each qualifying Train economic event at a City owned by the P33 holder also grants:

```text
P33PopulationGain = 20 × completedCityLevel
```

The gain is Capacity-capped and enters Available Population. P33 follows the canonical Train event identity from `FFY_ECONOMY.md`; it does not create a second route/station event definition.

### P34 — conquered Factories

Only Factories that **successfully transfer** to the holder through the canonical structure-capture resolver count as acquired through conquest for P34. Built or granted Factories remain ordinary. A Factory destroyed on capture by N17 or by failed ownership admission never becomes a P34 Factory. P34 + N09 remains legal, enabling conquest-only access to the transformed Factory behavior.

P34's player-facing `50% increased effectiveness` is a compact description of exactly these developer-facing transformations while the qualifying Factory remains owned by the P34 holder:

```text
Train event base value                 ×1.50
Tank-chassis construction speed        ×1.50
Tank repair rate                       ×1.50 (100 -> 150 HP/s currently)
Tank repair radius                     8 cells (5 ordinarily)
```

No other Factory axis is changed by P34. In particular, P34 does **not** change primary Train count/service slots, Train speed, routing, station dwell, the 5-second primary-service turnaround, P07's every-fourth-dispatch cadence, concurrent Tank-build capacity, Tank purchase cost, simultaneous repair capacity, Factory level, Factory construction/upgrade duration, or Factory construction/upgrade cost.

`+50% Tank-chassis construction speed` is a work-rate multiplier, not a 50% duration subtraction. The effective duration is therefore ordinary resulting-chassis duration divided by `1.5`, with authoritative tick scheduling using the canonical deterministic completion rounding. With the current 10-tick/second timing, the baseline 5-second/50-tick Tank completes in `ceil(50 / 1.5) = 34` ticks; P43 Heavy Artillery's 10-second/100-tick build completes in `ceil(100 / 1.5) = 67` ticks. P34 does not alter P43's authored purchase-cost or chassis transformation.

P34 modifies the Factory-originating Train **base event value** before ordinary earning-side FFY yield modifiers. A Train dispatched while the Factory qualifies for P34 snapshots that `1.50×` Factory event-value profile for its lifetime, so later Factory ownership/level changes do not retroactively change that Train's station-event base value or pending interception cargo. P07 bonus Trains use the same dispatch-time Factory economic profile as their paired primary Train; P34 does not create additional P07 bonus Trains.

The conquest qualification belongs to the **current ownership epoch**, not to the physical Factory forever. On every successful acquisition the structure records the current owner's acquisition path. A later transfer creates a new current-owner `CAPTURE_TRANSFER` provenance; P34 is active only when the current owner has P34 and that current ownership was acquired through `CAPTURE_TRANSFER`. Losing ownership removes the previous owner's P34 transformation rather than permanently enchanting the Factory.

Interaction consequences are exact:

- **P05 + P34:** one successful Factory transfer may independently produce one P05 conquest event and establish P34 Factory provenance; P34 does not multiply the P05 event.
- **P07 + P34:** P07's dispatch sequence is unchanged; every actual primary or P07 bonus Train dispatched under the P34 profile uses the `1.50×` Factory Train-event base value.
- **P33 + P34:** P34 changes the Train's FFY base value only. It does not increase P33's `20 × City level` Population grant and does not create extra Train events.
- **P43 + P34:** the Heavy-Artillery chassis is produced at `1.50×` construction speed and may receive the Factory's 150 HP/s repair inside the 8-cell radius; P43's other authored chassis values remain unchanged.
- **N09 + P34:** N09 blocks Factory construction but not legal capture transfer, so captured Factories may qualify for P34.
- **N17 + P34:** N17 resolves the Factory as destroyed instead of transferred, so P34 never activates.

### P35 — scorched-earth Fallout

Only deliberate relinquishment by the P35 holder creates the trait's Fallout. It creates no nuclear casualty event. Ordinary Fallout acquisition behavior remains owned by the terrain registry.

### N17 — conquest spoils destroyed

N17 contributes a capture-disposition transformation to the canonical structure-capture resolver: an enemy structure that would otherwise proceed toward transfer is resolved as `DESTROYED_ON_CAPTURE` instead. The territorial cell capture still succeeds.

Because no successful `STRUCTURE_TRANSFERRED` result exists, P05 does not fire and a captured Factory does not acquire P34 conquest provenance. N17 does not destroy the holder's own structures when another faction captures them. Capture-time destruction is distinct from ordinary combat destruction unless another explicit rule consumes that outcome.

### P36 — half-cost neutral settlement

P36 changes only neutral-settlement Population cost to `0.5 Population` per qualifying cell and uses faction-level deterministic residual accounting. Residual debt survives ending/recreating expansion operations. P36 does not change acquisition speed and composes independently with N18.

### P37 and N15 — Transport embarkation cost and landing Fort

Transport-cost traits are additive on the dedicated embarkation-cost hook. P37 contributes `+250 FFY`; N15 contributes `+500 FFY`; selecting both therefore contributes `+750 FFY` relative to the ordinary Transport baseline.

The P37 Fort request occurs only after the amphibious operation has successfully established ownership of the landing cell **and after any captured structure on that cell has completed canonical structure-capture resolution**. Destruction/abort before ownership establishment grants nothing.

P37 then attempts exactly one L1 Fort grant on the exact landing cell; it never searches nearby. If the final cell is occupied by a surviving/transferred structure, is not legally structure-placeable for the holder, or the holder cannot admit another Fort because of N07/another hard ownership rule, the Fort grant is skipped. The successful landing/cell capture is not rolled back. A successful P37 grant materializes as an immediately active completed L1 Fort.

### P38 — automatic-defender survival

When one of the holder's automatically defended cells is successfully captured, its one automatic defender survives and remains/returns Available. This changes defender survival only; ownership transfer and the attacker's ordinary capture consequences remain governed by the combat owner.

### P39 — split spawn profile

P39 selects a mode-independent split spawn profile with two stable exact-origin slots and one final Initial-Territory quota divided between two generated footprints. Starting Population remains one global pool; P39 never creates local Population stores.

Under Strategic Spawn only, P39 additionally uses two influence regions at 50% of ordinary influence area each. Random Spawn instead resolves the two exact origins deterministically without controller spawn hooks. Fixed Spawn requires exactly two authored legal distinct origins and performs no fallback/repair.

The exact influence geometry, Random/Fixed origin rules, foreign spacing, footprint division/resolution, deterministic primary/secondary slot semantics, singular start-effect ordering, replay representation, and P39 + P54 geometry composition are owned by `STRATEGIC_SPAWN.md`.

### P40 — giant single-charge SAM shield

P40 transforms the holder's SAM profile to `+50%` ordinary range, exactly one charge at every level, and `2×` ordinary recharge cooldown. Upgrades may still alter ordinary range but never add charges under P40. Targeting remains automatic; the trait creates no bespoke controller interception action.

### P41 — direct-L5 City purchases

P41 makes a purchased City one level-5 purchase transaction priced at `95%` of the ordinary cumulative L1→L5 cost. With the current baseline this is `1,995,000 FFY` before any other explicit purchase-transaction transform.

The transaction uses **one ordinary City construction interval: 5 seconds**. During those 5 seconds the new structure is inactive and already occupies any applicable ownership slot; at completion it atomically becomes an active completed L5 City. P41 does not internally execute four upgrade actions or four upgrade timers.

Captured lower-level Cities retain their captured level and may use ordinary upgrades unless another rule forbids it. Because the direct-L5 action is one purchase rather than upgrade spending, P41 + N06 remains legal.

For P41 + P21, ordinary legality and affordability are evaluated against the effective `1,995,000 FFY` P41 purchase requirement. If it is the first successful City purchase, P21 then makes `ffySpent = 0` and consumes the first-City purchase entitlement exactly once; failure before commit consumes neither FFY nor the entitlement.

### P42 — Population-funded Warships

P42 changes the Warship purchase transaction to:

- `0 FFY` Warship purchase cost;
- exactly `2,000 Available Population` permanently consumed per purchase;
- only Available Population may pay that cost;
- affected Warships have `-33% attack range`.

The consumed Population is removed from Total Population rather than stored as recoverable crew. All other Warship lifecycle/mechanics remain ordinary unless another explicit modifier applies. P42 cannot bypass N12's hard Warship-build prohibition or P23's ownership cap.

### P43 — Heavy Artillery Tank transformation

P43 transforms every Tank chassis owned/built by the holder. Relative to the canonical Tank chassis, the transformed profile is:

```text
build time                 10s
purchase cost              1.50× ordinary Tank cost
final movement             0.50× ordinary final Tank movement
weapon/Population range    1.50× ordinary Tank range
max health                 1,000
anti-armor                 1,000 damage / 12s
Population attack          1,000 Population / 12s
Train interception         disabled
terrain barriers           same as Tank
projectile traversal       may cross terrain the chassis cannot traverse
```

The transformation adds no hidden matchup modifier or extra health. Tank baseline mechanics are owned by `TERRAIN_AND_STRUCTURES.md`; P43 is the sole owner of the transformation itself.

### P44 — Radioactive Munitions

P44 applies after successful Tank-chassis Population attacks only. It adds no second direct Population-damage multiplier.

Resolution is deterministic:

1. collect enemy-owned population-bearing candidate cells in the authored Manhattan footprint;
2. exclude structure-occupied cells;
3. order by Manhattan distance from target, then stable cell ID;
4. neutralize/apply Fallout to at most 10 cells within radius 2 for a baseline Tank chassis, or at most 50 inside radius 5 for P43 Heavy Artillery;
5. if fewer eligible cells exist, affect fewer cells rather than expanding the footprint.

P43 + P44 is explicitly legal and yields radioactive Heavy Artillery.

### P45 — Forest concealment

P45 applies tactical concealment to Forest owned by the holder without hiding terrain type or political ownership. Enemy tactical observation cannot reveal the holder's units, persistent structures, or manifested operational state in the Forest interior. Exposed Forest-front boundary cells remain normally observable. A direct hostile manifestation from concealment reveals only the minimum information mechanically necessary to identify/respond to that manifestation, not unrelated nearby contents.

### P46 — Tundra construction

P46 permits ordinary persistent-structure construction on owned Tundra without changing any other Tundra property. A structure legally created there remains an ordinary persistent structure; a later owner without P46 may own/use that existing structure but cannot use that fact to construct new Tundra structures.

### P47 — Marsh attrition

After an enemy successfully captures one Marsh cell owned by the P47 holder, remove one additional Population from the capturing faction. The extra casualty does not require an automatic defender and does not alter the ownership transfer itself.

### P48 — population-bearing Shallow Water

For the P48 holder, owned Shallow Water is treated as population-bearing and contributes `+1 Population Capacity/cell` to every mechanic that queries that classification. P48 changes no other Shallow-Water property; the baseline terrain definition remains owned by `TERRAIN_AND_STRUCTURES.md`.

### P49 — Counterintelligence Observation Posts

P49 removes the holder's ordinary observation function from owned active Observation Posts and uses each Post's ordinary completed-level radius as an enemy-intelligence blackout field. The Post and existence/extent of the field remain public; the contents are concealed. Direct hostile manifestations reveal only the minimum information necessary for response. Overlap extends the union of blackout coverage rather than increasing concealment strength.

Observation Post baseline radii and ordinary observation semantics remain owned by `TERRAIN_AND_STRUCTURES.md`.

### P50 and P51 — reciprocal support fields

- P50 makes each owned active Fort additionally project offensive pressure equal to that Fort's effective defensive-pressure magnitude across its existing coverage.
- P51 makes each owned active Command Post additionally project defensive pressure equal to that Command Post's effective offensive-pressure magnitude across its existing coverage.
- Same-type overlap continues to follow the baseline field owner.
- When a Fort field and Command Post field both modify the same pressure direction on one engagement, their distinct bonuses use complement composition:

```text
combinedBonus = 1 - (1 - A) × (1 - B)
```

where `A` and `B` are decimal bonus magnitudes.

P50 + P51 is legal and applies the same cross-type composition in both directions. Baseline Fort/Command magnitudes and coverage are not redefined here.

### P07 — deterministic +25% Train throughput

Each Factory maintains one owner-scoped P07 phase for the current Factory Train-service ownership epoch:

```text
phase 0 -> primary dispatch -> 1
phase 1 -> primary dispatch -> 2
phase 2 -> primary dispatch -> 3
phase 3 -> primary dispatch + one bonus Train -> 0
```

Only normal primary Train dispatches advance the phase. A P07 bonus Train never advances it. The bonus Train does not occupy or delay the primary slot, uses an independently generated deterministic ordinary route, and behaves as an ordinary Train for station events, dwell, interception, destruction, and P33.

The P07 phase is persistent authoritative Factory-scheduler state and is serialized/replayed directly; it must not be reconstructed from aggregate Train counts or event history. Temporary inactivity pauses/preserves the phase. Factory upgrade preserves it. Ordinary Train destruction does not reset it. Physical Factory destruction deletes it.

A successful Factory ownership transfer closes the old owner's Train-service epoch and creates a fresh scheduler epoch for the new owner. The new epoch starts at P07 phase `0` if the new owner has P07; no latent phase is inherited from the prior owner or advanced on behalf of a non-P07 owner. An old-owner Train already in flight remains that old owner's Train and retains its dispatch-time route/economic snapshot, but it no longer occupies or blocks the new owner's primary service slot. Its later return or destruction cannot mutate the new ownership epoch's turnaround or P07 phase.

All ordinary Train routing/service/event semantics and dispatch-time Factory economic snapshots remain owned by `FFY_ECONOMY.md`.

### P52 — underpopulation economy

P52 adds a global non-spatial passive FFY source:

```text
emptyCapacity = max(0, PopulationCapacity - TotalPopulation)
P52BonusFFYPerSecond = emptyCapacity / 250
```

The source consumes no Population, never becomes negative, and is classified as a global/general FFY source for modifier eligibility. Exact ordinary source-family/modifier ordering is owned by `FFY_ECONOMY.md`.

### P53 — strategic-stockpile economy

P53 adds a global non-spatial passive FFY source:

```text
readyPersistentSiloCharges
= sum of READY charges across owned active persistent Missile Silo structures

P53BonusFFYPerSecond
= 2,000 × readyPersistentSiloCharges
```

Only actual persistent Missile Silo structures count; P29 mobile Warship launcher charges and SAM charges do not. Capacity by itself does not count. P53 consumes the current canonical persistent-Silo charge state without redefining it; creation, spending, recharge, upgrade, capture, serialization, and replay of that state are owned by `TERRAIN_AND_STRUCTURES.md`.

The source is classified as a global/general FFY source for modifier eligibility. P20 + P53 is legal because the admitted P20 structure enters the same ordinary persistent-Silo lifecycle as any other newly materialized completed Silo.

### P54 — star Initial-Territory profile

P54 selects the canonical star starting-footprint profile defined by `STRATEGIC_SPAWN.md` in Strategic, Random, and Fixed Spawn. It changes starting-footprint geometry only: it does not change final Initial Territory, Starting Population, Capacity per cell, neutral-settlement Population cost, capture/settlement speed, or later territorial-growth geometry.

P39 + P54 is legal; the spawn owner defines how the star profile is applied to each split footprint without duplicating the faction's quota.

---

## Catalogue coverage decisions

These are catalogue-boundary decisions, not copies of neighboring subsystem mechanics.

- **Starting Population:** simple scalar Starting-Population tuning remains Echo territory unless a future Origin introduces a structural rule.
- **Neutral expansion:** P36 supplies settlement-cost structure, N18 supplies a Fallout-sensitive acquisition transformation, and P54 changes starting contact geometry; generic positive capture-speed tuning remains Echo territory.
- **Alternate passive economies:** P52 and P53 are Origin-scale structural economy rules; generic FFY percentages remain Echo territory.
- **Recon / visibility:** P45 and P49 provide structural concealment/counterintelligence; generic numerical observation-radius tuning remains Echo territory.
- **Hard topology:** Impassable terrain remains map topology rather than an Origin-transformable terrain class in V1.

---

## Combination-safety examples

No compatibility matrix is allowed. The examples below are **illustrative consequences of the canonical traits above**, not additional mechanics or exceptions. Deliberately foolish, partially inert, or difficult combinations remain legal when they satisfy the public builder rules.

Examples of awkward but legal combinations include:

- Warship boons + N12 (`Cannot build Warships`);
- P07/P34/P43/P44 + N09 (`Cannot build Factories`) — relevant effects may still matter if a Factory is acquired through another legal path;
- P17 + N06;
- P26 + P25;
- P35/P44 + N05;
- N18 + N05;
- N14 + N16;
- N17 + P05/P34;
- P20/P37 + N07;
- P37 + N15;
- P41 + N06;
- P42 + N12.

Examples of strong but legal compositions include:

- P29 + P22;
- P29 + P42;
- P30 + P42;
- P23 + P42;
- P31 + P23;
- P32 + P12;
- P33 + P07;
- P34 + N09;
- P35 + P16;
- P38 + P35;
- P39 + P54;
- P43 + P44;
- P44 + P16;
- P50 + P51;
- P52 + P02;
- P53 + P20;
- P53 + P16 + N18;
- P53 + P35/P44 + P16 + N18 where the public budget permits it.

Certification must preserve the guarantee that every builder-legal combination is supported, deterministic, and structurally safe. Cheap catalogue/property validation may enumerate or generate very large sets of legal combinations, while expensive runtime validation is performed once per materially distinct gameplay-domain projection plus explicitly required trait/cross-domain interactions. These examples never become hidden compatibility rules.

---

## Official Origin roster

The canonical Official Origin library is maintained in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md). Official Origins are ordinary public catalogue builds and receive no creator-only mechanics, hidden points, or compatibility exceptions.

---

## Next Origin work

Remaining Origin-side work is balance/repricing where testing provides evidence, benchmark validation of balance-sensitive traits, explicit trait-to-validation-domain coverage, and catalogue certification under the validation architecture in `OPENFRONT_INTEGRATION_PLAN.md`. Echo identity/acquisition/reward work belongs in `ECHO_CATALOGUE.md`; Official-Origin content belongs in `OFFICIAL_ORIGINS.md`.