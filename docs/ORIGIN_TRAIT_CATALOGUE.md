# Open Fufu — Canonical Origin Trait Catalogue

## Status and authority

This file is the **canonical owner for Origin builder rules, Origin trait identities, trait costs/refunds, trait-specific mechanics, and Origin-trait composition semantics**.

Neighboring concerns are owned elsewhere and are referenced rather than restated here:

- high-level game-wide invariants: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
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
- Candidate catalogue versions must be exhaustively tested before deployment; a broken legal combination is a catalogue-design failure, not justification for a hidden restriction.
- Origins should prefer playstyle-changing rules, tradeoffs, geography, and structural constraints over generic stat tuning better suited to Echoes.

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
| P34 | **Spoils of the Empire** | Factories acquired by conquest operate at `2×` ordinary Factory effect while owned | 6 |
| P35 | **It's a Matter of Visualization** | Deliberately relinquished cells become neutral Fallout until next successful capture | 6 |
| P36 | **Half-Priced Bento** | Neutral settlement costs `0.5 Population/cell` instead of `1`, using faction-level persistent residual accounting | 5 |
| P37 | **The City Mouse** | Transport embarkation costs `+250 FFY`; each successful amphibious landing grants a permanent level-1 Fort at the landing location | 7 |
| P38 | **Return by Death** | When one of your automatically defended cells is captured, its automatic defender survives and remains/returns Available | 10 |
| P39 | **Stereo Separation** | Strategic Spawn uses two influence areas at 50% ordinary area each and two exact origins; final Initial Territory is split between two footprints; Starting Population remains one global pool | 10 |
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
| P54 | **Starlight Breaker** | **Star start:** each generated Initial-Territory footprint uses the canonical star spawn profile instead of the ordinary compact profile; final Initial Territory and Starting Population are unchanged | 5 |

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

### P25 — Hydrogen blast-area interpretation

P25's `+50%` changes affected Hydrogen-Bomb **area**, not radius by `1.5×`. Strategic-weapon baseline geometry is owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`.

### P11 — Population-unlocked SAMs

Each full 25,000 of **peak Total Population reached during the match** permanently unlocks one P11 SAM ownership/build slot. Starting Population contributes to the initial peak; later Population loss does not revoke unlocked slots. P11's SAM FFY cost is genuinely zero; ordinary non-FFY legality still applies.

### P04 — response-side counter-response

P04 fixes only the response-side counter-response effectiveness hook at `1.0`. Attack-side effectiveness remains ordinary unless another explicit rule changes it. The ordinary counter-response model is owned by `COMBAT_TUNING.md` and the high-level combat contract.

### Grants, purchases, and entitlements — P20, P21, P26, P37

- P20 is a starting structure **grant**, not a purchase, and does not consume P21's first-Silo purchase entitlement.
- P21 still requires ordinary legality/affordability validation; the first successful purchase of each structure type consumes `0 FFY`.
- P26 still requires ordinary MIRV launcher/legality/affordability validation; the one permitted successful MIRV consumes `0 FFY`.
- P37's landing-created Fort is a **grant**, not a purchase, and does not consume P21's first-Fort purchase entitlement.

The granted structure's ordinary level/lifecycle semantics come from the structure owner rather than being redefined here.

### P29 — Warships as strategic-weapon launchers

P29 makes an owned Warship a legal strategic-weapon launcher from its current cell. The controller must identify the physical launcher when launch origin matters.

For P29 only:

```text
effective Silo level = max(1, Warship rank)
```

All ordinary weapon costs, launcher requirements, charge/cooldown behavior, and Warship rank mechanics remain owned by `NAVAL_AND_STRATEGIC_WEAPONS.md`. P22 composes normally with P29 by raising the rank ceiling.

### P30 — pirate Warship conversion

P30 removes naval gunfire against ships while preserving Trade Ship pursuit/capture. Its speed and piracy multipliers are the trait values in the table above. Captured-cargo routing and payout semantics remain owned by `FFY_ECONOMY.md`.

### N14 and N16 — snapshotted Trade-voyage value

Both traits use the canonical launch-time owner-side voyage value (`Vowner`) defined by `FFY_ECONOMY.md`.

- N14 subtracts `Vowner` from the original owner on the first hostile capture only.
- N16 replaces successful uncaptured owner payout with a loss of `Vowner`; on first hostile capture, the original owner instead receives `Vowner` once.
- N14 + N16 is legal; their first-hostile-capture owner-side deltas cancel without a compatibility exception.

All ordinary voyage, rerouting, cargo, capture, and captor-payout rules remain in the FFY owner.

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

Only Factories acquired by conquest receive P34's `2×` Factory effect. Built or granted Factories remain ordinary. P34 + N09 is legal, enabling conquest-only access to the transformed Factory behavior.

### P35 — scorched-earth Fallout

Only deliberate relinquishment by the P35 holder creates the trait's Fallout. It creates no nuclear casualty event. Ordinary Fallout acquisition behavior remains owned by the terrain registry.

### N17 — conquest spoils destroyed

N17 destroys an enemy structure the holder would otherwise capture instead of transferring ownership. It does not destroy the holder's own structures when another faction captures them. Capture-dependent Origin effects do not fire when N17 prevents the capture from occurring.

### P36 — half-cost neutral settlement

P36 changes only neutral-settlement Population cost to `0.5 Population` per qualifying cell and uses faction-level deterministic residual accounting. Residual debt survives ending/recreating expansion operations. P36 does not change acquisition speed and composes independently with N18.

### P37 and N15 — Transport embarkation cost

Transport-cost traits are additive on the dedicated embarkation-cost hook. P37 contributes `+250 FFY`; N15 contributes `+500 FFY`; selecting both therefore contributes `+750 FFY` relative to the ordinary Transport baseline. The successful-landing Fort appears only after land ownership is successfully established; destruction/abort before that point grants nothing.

### P38 — automatic-defender survival

When one of the holder's automatically defended cells is successfully captured, its one automatic defender survives and remains/returns Available. This changes defender survival only; ownership transfer and the attacker's ordinary capture consequences remain governed by the combat owner.

### P39 — split Strategic Spawn

P39 selects the canonical split spawn profile: two half-area influence slots, two exact-origin slots, and one final Initial-Territory quota divided between two generated footprints. Starting Population remains one global pool; P39 never creates local Population stores.

The three-phase protocol, exact influence geometry, exact-origin resolution, footprint division/resolution, deterministic primary/secondary semantics, and P39 + P54 geometry composition are owned by `STRATEGIC_SPAWN.md`.

### P40 — giant single-charge SAM shield

P40 transforms the holder's SAM profile to `+50%` ordinary range, exactly one charge at every level, and `2×` ordinary recharge cooldown. Upgrades may still alter ordinary range but never add charges under P40. Targeting remains automatic; the trait creates no bespoke controller interception action.

### P41 — direct-L5 City purchases

P41 makes a purchased City one level-5 purchase transaction priced at `95%` of the ordinary cumulative L1→L5 cost. Captured lower-level Cities retain their captured level and may use ordinary upgrades unless another rule forbids it. Because the direct-L5 action is one purchase rather than upgrade spending, P41 + N06 remains legal.

### P42 — Population-funded Warships

P42 changes the Warship purchase transaction to:

- `0 FFY` Warship purchase cost;
- exactly `2,000 Available Population` permanently consumed per purchase;
- only Available Population may pay that cost;
- affected Warships have `-33% attack range`.

The consumed Population is removed from Total Population rather than stored as recoverable crew. All other Warship lifecycle/mechanics remain ordinary unless another explicit modifier applies.

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
4. neutralize/apply Fallout to at most 10 cells within radius 2 for a baseline Tank chassis, or at most 50 within radius 5 for P43 Heavy Artillery;
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

Each Factory maintains its own count of normal primary Train dispatches. Every fourth normal primary dispatch simultaneously launches one additional bonus Train, giving exactly `+25%` Train count over the sequence. The bonus Train does not occupy or delay the primary slot, uses an independently generated deterministic ordinary route, and destruction does not reset the per-Factory sequence.

All ordinary Train routing/service/event semantics remain owned by `FFY_ECONOMY.md`.

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
= sum of currently ready charges across owned active persistent Missile Silo structures

P53BonusFFYPerSecond
= 2,000 × readyPersistentSiloCharges
```

Only actual persistent Missile Silo structures count; P29 Warship launcher capability does not. Expending a charge removes its contribution until that charge is ready again. The source is classified as a global/general FFY source for modifier eligibility. P20 + P53 is legal.

### P54 — star Initial-Territory profile

P54 selects the canonical star starting-footprint profile defined by `STRATEGIC_SPAWN.md`. It changes starting-footprint geometry only: it does not change final Initial Territory, Starting Population, Capacity per cell, neutral-settlement Population cost, capture/settlement speed, or later territorial-growth geometry.

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

The exhaustive deployment gate must prove every builder-legal combination deterministic and engine-safe. These examples never become hidden compatibility rules.

---

## Official Origin roster

The canonical Official Origin library is maintained in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md). Official Origins are ordinary public catalogue builds and receive no creator-only mechanics, hidden points, or compatibility exceptions.

---

## Next Origin work

Remaining Origin-side work is balance/repricing where testing provides evidence, benchmark validation of balance-sensitive traits, and exhaustive legal-combination validation before catalogue deployment. Echo identity/acquisition/reward work belongs in `ECHO_CATALOGUE.md`; Official-Origin content belongs in `OFFICIAL_ORIGINS.md`.