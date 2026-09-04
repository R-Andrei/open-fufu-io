# Open Fufu — Naval Units and Strategic Weapons

## Status and authority

This file is the **canonical detailed numeric appendix for the accepted provisional V1 Warship, Transport Ship, Port-repair, Warship-rank, and strategic-weapon baselines**.

[`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) remains authoritative for the broader Population/territory model, amphibious-operation semantics, strategic-weapon terrain consequences, visibility, and controller architecture. [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md) remains authoritative for persistent Port/Silo/SAM level tables. [`FFY_ECONOMY.md`](./FFY_ECONOMY.md) remains authoritative for Trade Ship economics/piracy cargo semantics. [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md) defines Origin transformations.

Nothing in this file authorizes gameplay implementation.

The values below are accepted provisional V1 balance values and remain benchmark/playtestable.

---

# 1. Strategic weapons

## 1.1 Launcher level gates

Missile Silo access remains:

```text
L1+ → Atom Bomb
L3+ → Hydrogen Bomb
L5  → MIRV
```

A Warship acting as a launcher under P29 uses its canonical effective Silo level derived from Warship rank. Free/granted strategic weapons do not bypass launcher legality unless an explicit authored rule says so.

## 1.2 Baseline purchase costs

Strategic-weapon base prices are **static per weapon**. They do not increase because another faction or another launcher previously fired the same weapon.

```text
Atom Bomb     =  1,000,000 FFY
Hydrogen Bomb = 10,000,000 FFY
MIRV          = 50,000,000 FFY
```

Origin/Echo/ruleset cost modifiers apply to these base prices through the ordinary modifier system.

Examples:

- P25 makes its allowed Hydrogen Bomb cost `15,000,000 FFY` before other modifiers because the trait adds `+50%` cost;
- P26 still requires ordinary MIRV affordability/legality under its authored semantics, then a successful permitted launch consumes `0 FFY`;
- there is no inherited global `+15m per MIRV previously launched` escalation.

## 1.3 Projectile speeds

Accepted baseline physical speeds:

| Projectile | Speed |
| --- | ---: |
| Atom Bomb | **100 cells/s** |
| Hydrogen Bomb | **100 cells/s** |
| MIRV carrier | **150 cells/s** |
| MIRV warhead after separation | **220 cells/s** |

P10's `+100% strategic projectile speed` applies through the ordinary explicit projectile-speed modifier surface.

## 1.4 Atom and Hydrogen blast geometry

Accepted baseline radii:

| Weapon | Fully affected inner radius | Irregular outer radius |
| --- | ---: | ---: |
| Atom Bomb | **12** | **30** |
| Hydrogen Bomb | **80** | **100** |

The inner zone is fully affected. The annulus between inner and outer radius uses a deterministic irregular boundary/fill so the blast is not a perfect mechanical circle while remaining replay-stable.

P25's `+50% Hydrogen Bomb blast area` modifies **area**, not radius by `1.5×`. Equivalent radius scaling is therefore based on `sqrt(1.5)` when a radius representation is required.

## 1.5 Standard strategic-weapon terrain/unit effect

For each affected owned population-bearing land cell under standard non-water-nuke rules:

1. political ownership is removed and the cell becomes neutral;
2. the former owner loses `1 Total Population`, capped at zero;
3. Population Capacity falls because the owned population-bearing cell was lost;
4. the underlying terrain remains land/conquerable/population-bearing according to its normal terrain identity;
5. Fallout is applied under the ordinary nuclear Fallout rule.

A later reconquest restores ordinary Capacity from ownership but grants no free current Population.

A persistent structure or mobile unit whose physical cell lies inside the resolved blast footprint is destroyed unless an explicit mechanic makes it immune. Carried Population aboard a destroyed Transport is resolved as Transport destruction, not as an extra per-cell nuclear casualty.

## 1.6 Optional Water Nukes — Accepted V1

Water Nukes are a **default-OFF optional V1 ruleset**. When enabled, the fully affected inner blast zone of every resolved strategic-weapon explosion is also a permanent Deep-Water conversion core; the irregular outer annulus keeps ordinary neutralization + Fallout.

| Weapon | Deep-Water core | Ordinary Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | **0–12** | **12–30** |
| Hydrogen Bomb | **0–80** | **80–100** |
| MIRV warhead | **0–12** | **12–18** |

These are the ordinary accepted blast radii reused directly. Water Nukes do not define a second hidden radius. Any surfaced modifier to blast geometry therefore changes both ordinary and water-nuke geometry consistently; P25's Hydrogen `+50% blast area` is the canonical example.

For each eligible cell inside the resolved core, apply ordinary nuclear ownership/Population/Capacity/unit/structure consequences first, then convert terrain:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → unchanged Deep Water
Impassable      → unchanged
```

A converted cell is unowned, non-population-bearing, non-buildable, removed from the ordinary conquerable-territory denominator, and has no Fallout overlay. Overlapping explosion cores use the deterministic union of eligible core cells; warhead order cannot alter the result.

The resulting Deep Water participates immediately in ordinary naval connectivity, pathing/traversal, coast/shore derivation, Capacity and victory calculations. Nuclear-created canals and coasts are therefore real gameplay geography. Segment membership remains the map-compiled immutable Segment identity even if terrain inside that Segment changes.

The ruleset intentionally provides no anti-cheese protection against terrain destruction. If enabled by the lobby, using strategic weapons to erase land, cut canals, isolate territory, reshape coasts, or reduce the remaining conquerable-land denominator is legal behavior under that ruleset.

---

# 2. MIRV

## 2.1 Baseline payload

One MIRV purchase/launch creates at most:

```text
250 independently resolving MIRV warheads
```

Each warhead uses the accepted small strategic-warhead blast profile:

```text
inner radius = 12
outer radius = 18
```

The reduction from the inherited 350-warhead implementation is deliberate. MIRV remains an exceptionally powerful L5 strategic weapon, but the weapon should not behave like a nearly guaranteed whole-faction deletion merely because one smaller faction can afford one late-game launch.

## 2.2 Target-distribution area

The launch command selects one primary target cell and therefore one snapshotted **target faction** when that target is faction-owned at launch.

The MIRV distribution area uses:

```text
distribution radius = 750 cells
minimum warhead-center spacing = 55 cells
```

Warhead #1 always targets the submitted primary target cell.

Remaining warhead centers are chosen deterministically from legal land cells within 750 cells of the primary target that belong to the launch-snapshotted target faction, respecting the 55-cell minimum center spacing.

Target selection is deterministic and does not search outward beyond the authored distribution radius merely to fill all 250 warheads.

If only 163 legal spaced target centers exist, the MIRV resolves with **163 warheads**, not 250 warheads redirected onto unrelated factions or distant geography.

A later ownership change does not retarget the primary warhead away from its submitted physical target cell. Ordinary blast collateral may affect any faction/geography actually inside a resolved warhead footprint.

## 2.3 Carrier separation and interception

Before separation, the MIRV carrier is **one interceptable strategic projectile**. Destroying it destroys/cancels the entire unresolved payload.

The carrier separates at approximately **50% of its planned physical flight progress**. The exact deterministic motion-plan index/tick is implementation/versioning detail; the gameplay invariant is one clear pre-separation interception phase followed by a dispersed-warhead phase.

After separation:

- the carrier ceases to exist as one target;
- every spawned MIRV warhead is an independently interceptable strategic projectile;
- destroying one warhead affects only that warhead.

SAM interception uses the projectile's actual physical entry into SAM coverage. Open Fufu does **not** retain an inherited special rule that makes strategic projectiles targetable only near their launch/target endpoints.

This creates the intended defensive asymmetry: intercepting the carrier early spends one successful interception against the whole payload, while a defender that misses the carrier may need many independent SAM charges after separation.

---

# 3. Baseline Warship

One Warship represents an abstract naval combat formation rather than one literal ship.

## 3.1 Purchase and persistence

Baseline Warship purchase curve:

```text
WarshipCost = min(1,000,000 FFY, 250,000 FFY × (activeWarships + 1))
```

| Active Warships before purchase | Next Warship cost |
| ---: | ---: |
| 0 | **250k FFY** |
| 1 | **500k FFY** |
| 2 | **750k FFY** |
| 3+ | **1.00m FFY** |

Destroyed Warships stop counting toward the active-count price curve.

Additional baseline properties:

| Property | Rule |
| --- | --- |
| Produced by | active owned **Port** |
| Construction time | **5 seconds** |
| Hard ownership cap | **none** |
| Base max health | **1,000 HP** |
| Base movement speed | **10 cells/s** |
| Base naval-gun range | **130 cells** |
| Base shell damage | **250 HP fixed** |
| Base shell cooldown | **2 seconds** |
| Strategic patrol/raid leash | **100 cells** |
| Trade Ship capture distance | **5 cells** |
| Automatic repair-retreat threshold | **50% max health** |

Baseline shell damage is deterministic. Open Fufu does not retain inherited random `~200–300` shell rolls; `250 damage` means exactly `250` before surfaced modifiers/rank effects.

## 3.2 Strategic/autonomous control

Warship control remains strategic rather than RTS micro. The controller assigns patrol/raid intent, anchor/area, or other legal strategic targeting information; pathing, local pursuit, firing, and repair retreat remain autonomous.

Ordinary autonomous target priority within legal observation/intent is:

```text
1. hostile Transport Ship
2. hostile Warship
3. legally capturable hostile Trade Ship
```

Trade Ship pursuit/capture must obey the canonical piracy/cargo/Port-return rules in `FFY_ECONOMY.md`.

---

# 4. Warship ranks

Warships begin at:

```text
rank 1
```

Ordinary maximum rank:

```text
rank 3
```

P22 raises the maximum by +2, allowing:

```text
rank 5
```

Each rank above 1 gives:

```text
+20% max health per rank
+20% shell damage per rank
```

These rank bonuses compose with explicit Origin/Echo modifiers through ordinary surfaced rules.

When max health increases on a rank-up, preserve the Warship's **current health percentage** rather than granting a free heal equal to the new maximum-health difference.

## 4.1 Naval XP

One rank step requires:

```text
100 Naval XP
```

Baseline XP awards:

| Event | Naval XP |
| --- | ---: |
| Destroy hostile Warship | **100** |
| Destroy hostile Transport | **10** |
| Successfully capture hostile Trade Ship | **4** |

XP above a threshold carries toward the next rank until the current rank cap is reached.

This preserves the useful inherited rough equivalence that one rank step may come from about 10 Transport kills or 25 Trade captures while making one Warship-vs-Warship kill a natural full rank step.

P29 uses the canonical effective-Silo rule:

```text
effective Silo level = max(1, Warship rank)
```

Therefore ordinary rank-3 P29 Warships can reach Hydrogen-Bomb access, while P22 can permit an eventual rank-5 MIRV-capable Warship.

---

# 5. Port repair

Ports provide ordinary passive naval repair to eligible friendly **health-bearing naval units** inside their completed-level radius.

Accepted Port repair progression:

| Port level | Repair radius | Repair rate |
| ---: | ---: | ---: |
| L1 | **20** | **50 HP/s** |
| L2 | **25** | **62.5 HP/s** |
| L3 | **30** | **75 HP/s** |
| L4 | **35** | **87.5 HP/s** |
| L5 | **40** | **100 HP/s** |

The level-specific rates are the existing `1.00 / 1.25 / 1.50 / 1.75 / 2.00×` Port repair progression applied to the new `50 HP/s` L1 baseline.

There is no hidden simultaneous-healing slot cap. Every otherwise eligible friendly health-bearing naval unit inside the repair field may receive the Port's ordinary repair in the same tick.

Same-type overlapping Ports do not stack repair rates on one unit; use the strongest applicable Port effect.

## 5.1 P31 operational Port repair

P31 applies a stronger/larger **Warship** repair field without turning Ports into effectively unbreakable fleet-healing zones:

```text
P31 Warship repair radius = ordinary completed-level Port radius × 2.0
P31 Warship repair rate   = ordinary completed-level Port rate × 1.5
```

Resulting progression:

| Port level | P31 Warship repair radius | P31 Warship repair rate |
| ---: | ---: | ---: |
| L1 | **40** | **75 HP/s** |
| L2 | **50** | **93.75 HP/s** |
| L3 | **60** | **112.5 HP/s** |
| L4 | **70** | **131.25 HP/s** |
| L5 | **80** | **150 HP/s** |

Warships may continue ordinary movement, targeting, and gunfire while receiving P31 repair. Same-type overlapping Ports still do not stack repair rates on one Warship; use the strongest applicable field.

P31's enhanced field is Warship-specific. Other eligible health-bearing naval units, including P32 armored Transports, continue to use the ordinary Port repair radius/rate unless another explicit rule modifies them.

The L5 `150 HP/s` ceiling is intentional: it exceeds one baseline rank-1 Warship's unmodified sustained `125 HP/s` gun damage, making a defended naval base meaningfully strong, but multiple attackers can still overwhelm the repair rather than producing practical immortality.

---

# 6. Transport Ships

Transport Ships carry explicitly committed Population and are amphibious-operation vehicles, not territorial owners themselves.

Baseline:

| Property | Rule |
| --- | --- |
| Active cap per faction | **3** |
| Embarkation FFY cost | **0 FFY** before explicit modifiers |
| Movement speed | **10 cells/s** |
| P12 movement speed | **12.5 cells/s** after +25% |
| Ordinary embark source | legal owned coast/shore embarkation point |
| Baseline health | **fragile / no persistent health pool** |
| Baseline Warship interception | one successful hostile shell destroys Transport |
| Carried Population | controller-selected committed Population |

The cap of three is deliberate. Unlike autonomous Trade Ship world traffic, Transports are deliberate invasion operations; a small cap prevents the dominant tactic from becoming fragmentation of one invasion into huge numbers of tiny boats purely to saturate autonomous naval targeting.

## 6.1 Amphibious landing

Reaching a legal hostile/neutral landing coast does **not** instantly award the target cell.

Instead, the Transport makes that local coast operationally actionable and its carried Population enters the ordinary local offensive/neutral-settlement engagement under canonical territorial capture progress, casualties, terrain, and defense rules.

The Transport itself never bypasses ordinary political ownership resolution merely by arriving.

P37's granted level-1 Fort appears only after the landing successfully establishes ownership, as already defined in the Origin catalogue.

## 6.2 Retreat / abort

A Transport may retreat/abort toward a legal owned return point. When the retreat successfully returns its carried Population to the faction:

```text
25% of carried Population is lost
75% returns to Available Population
```

The 25% retreat loss is the commitment cost for abandoning an amphibious operation after embarkation. Destruction before successful return loses the carried Population under ordinary Transport-destruction rules.

## 6.3 P32 armored Port-launched Transport

P32 keeps its Port-only source restriction and gives the Transport a real health pool:

```text
P32 Transport max health = 500 HP
```

It remains otherwise a Transport rather than becoming a Warship. Under the ordinary 250-damage Warship shell baseline, two unmodified successful shells are required to destroy a fresh P32 Transport.

Because it is health-bearing, an owned P32 Transport may receive ordinary eligible Port repair.

P32 + P12 remains legal, producing a Port-only 500-HP Transport moving at 12.5 cells/s before other modifiers.

---

# 7. Origin interaction reminders

These are compositions of existing public traits, not hidden compatibility rules:

- P23's one-Warship `+20% range/damage/speed` modifies the baseline Warship/rank profile above;
- P30 removes naval gunfire while retaining Trade Ship pursuit/capture and gives its existing speed/piracy transformations;
- P31 gives Warships `2×` ordinary Port repair radius and `1.5×` ordinary Port repair rate while allowing normal operation inside the field;
- P32 changes Transport source/health as defined above;
- P42 changes Warship purchase resource to Population and applies its existing `-33% range`; the 5-second build time still applies;
- P22 allows rank 5;
- P29 derives strategic-weapon access from rank/effective Silo level;
- P25's Hydrogen cost multiplier now starts from the canonical 10m base;
- P26's one free MIRV now uses the canonical 50m affordability baseline under its accepted authored semantics.

---

# 8. Validation expectations

Before V1 release, accelerated/headless tests should benchmark at minimum:

- ordinary fleet-vs-fleet time-to-kill across ranks and P23/P42 combinations;
- autonomous target priority around mixed Transport/Warship/Trade traffic;
- repair-retreat behavior at each Port level and overlapping repair fields;
- P31 fleet survivability under one/multiple attackers at each Port level;
- P32 Transport survival/repair and P12 speed stacking;
- three-Transport amphibious throughput across representative coasts;
- Atom/Hydrogen blast impact on early/mid/late territories;
- 250-warhead MIRV target saturation on compact, fragmented, coastal, and very large factions;
- carrier interception versus post-separation SAM-charge saturation;
- P10 projectile-speed effects and P40 SAM-shield interactions;
- P22 + P29 rank-5 MIRV-capable Warships;
- strategic-weapon cost modifiers against the static `1m / 10m / 50m` baselines.

Retuning numeric balance after these benchmarks is ordinary tuning; restoring hidden global MIRV price escalation or inherited random Warship damage is not.
