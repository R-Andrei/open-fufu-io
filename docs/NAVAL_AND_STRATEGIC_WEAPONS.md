# Open Fufu — Naval Units and Strategic Weapons

## Status and authority

This file is the **canonical owner for baseline Warship, Transport Ship, Warship-rank, and strategic-weapon mechanics**.

Neighboring concerns are owned elsewhere:

- game-wide teams, controller-directed hostility, and `atWar` lifecycle: [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md);
- Port/Silo/SAM structure levels, charges, repair fields, and launcher access: [`TERRAIN_AND_STRUCTURES.md`](./TERRAIN_AND_STRUCTURES.md);
- Trade Ship traffic, cargo, capture payout, and piracy economics: [`FFY_ECONOMY.md`](./FFY_ECONOMY.md);
- Origin transformations of naval units, launchers, or weapons: [`ORIGIN_TRAIT_CATALOGUE.md`](./ORIGIN_TRAIT_CATALOGUE.md).

The rules and values below are the accepted provisional V1 baseline. Numeric values may be retuned through versioned balance changes without changing subsystem ownership.

---

# 1. Strategic weapons

Launcher level/access rules are owned by `TERRAIN_AND_STRUCTURES.md`. A launch must use a legal launcher; grants and other transformations do not bypass launcher legality unless their canonical owner explicitly says so.

An accepted controller-directed strategic-weapon launch against an opposing faction applies the game-wide directed-hostility / `atWar` rule in `OPEN_FUFU_DESIGN.md`. The intended target side at accepted command commit is the hostility source; collateral damage to another side does not independently create or refresh `atWar` with that collateral side.

## 1.1 Baseline purchase costs

Strategic-weapon base prices are static per weapon:

```text
Atom Bomb     =  1,000,000 FFY
Hydrogen Bomb = 10,000,000 FFY
MIRV          = 50,000,000 FFY
```

They do not escalate based on prior launches.

## 1.2 Projectile speeds

| Projectile | Speed |
| --- | ---: |
| Atom Bomb | **100 cells/s** |
| Hydrogen Bomb | **100 cells/s** |
| MIRV carrier | **150 cells/s** |
| MIRV warhead after separation | **220 cells/s** |

### 1.2.1 Canonical projectile taxonomy and motion snapshots

V1 distinguishes a **warhead projectile** from the pre-separation MIRV carrier. This classification is semantic, not presentation shorthand:

```text
warhead projectile:
  Atom Bomb projectile
  Hydrogen Bomb projectile
  separated MIRV warhead

not a warhead projectile:
  pre-separation MIRV carrier
```

Origin rules such as P10 may transform the `warhead projectile` class; the modifier itself remains authored in `ORIGIN_TRAIT_CATALOGUE.md`. A projectile class outside that set does not inherit a warhead-only modifier merely because it participates in the same strategic weapon.

Changing projectile speed changes elapsed travel time and therefore the physical interception opportunity. It does **not** by itself change blast geometry/effect, weapon cost, launcher legality, target distribution, MIRV payload count, or MIRV separation progress.

At accepted launch commit, the authoritative simulation binds the effective motion profile used by the projectile. A MIRV launch binds **both** its carrier motion profile and the child-warhead motion profile that will be used if/when separation occurs. Later state changes do not retroactively recalculate an already launched projectile's speed, and MIRV separation materializes child warheads from the launch-bound child profile rather than re-reading mutable faction state.

## 1.3 Atom and Hydrogen blast geometry

| Weapon | Fully affected inner radius | Irregular outer radius |
| --- | ---: | ---: |
| Atom Bomb | **12** | **30** |
| Hydrogen Bomb | **80** | **100** |

The inner zone is fully affected. The annulus between inner and outer radius uses the versioned deterministic irregular footprint profile below.

### 1.3.1 Area transforms

Blast **area** transforms act on squared radial geometry. They are not interpreted as the same percentage change to radius.

For a positive rational effective area multiplier `p/q`, `p` and `q` are positive exact integers and the authoritative representation is always reduced:

```text
p > 0
q > 0
gcd(p, q) = 1
```

Equivalent unreduced fractions are normalized before effective-profile binding, serialization, hashing, comparison, or replay. P25's authored Hydrogen area multiplier is therefore canonically `3/2`, never `6/4`, `150/100`, or another equivalent representation.

Keep the transformed squared profile as exact integers with one common positive denominator:

```text
innerNumerator  = baselineInnerRadius² × p
outerNumerator  = baselineOuterRadius² × p
profileDenominator = q
```

A candidate squared distance `d2` is therefore inside the transformed full core exactly when:

```text
d2 × profileDenominator <= innerNumerator
```

and outside the maximum transformed outer bound exactly when:

```text
d2 × profileDenominator > outerNumerator
```

The multiplier value is owned by the rule that supplies it. For example, P25 supplies its authored Hydrogen-only blast-area multiplier from `ORIGIN_TRAIT_CATALOGUE.md`; this document owns how an effective area multiplier becomes strategic-blast geometry.

The rational representation is authoritative. Implementations must not turn an area multiplier into the same multiplier on radius, round an intermediate radius or transformed irregular threshold, or force the final discrete lattice footprint to contain an exact proportional cell count. Map edges, Impassable cells, and lattice discretization can change the realized count without changing the rule.

### 1.3.2 `STRATEGIC_BLAST_V1` — exact deterministic footprint

All Atom-Bomb, Hydrogen-Bomb, and MIRV-warhead blast footprints use one canonical profile in V1:

```text
profileVersion = STRATEGIC_BLAST_V1
```

The resolver inputs are:

```text
centerCell
innerNumerator
outerNumerator
profileDenominator
blastSeed : uint32
profileVersion = STRATEGIC_BLAST_V1
```

All arithmetic that participates in membership is exact integer/rational arithmetic. Implementations may use `BigInt`, checked wide integers, or an exactly equivalent representation; floating-point rounding is not authoritative.

#### Canonical 32-bit hash primitive

`STRATEGIC_BLAST_V1` reuses the already-frozen `FNV1A32_LENPREFIX_V1` byte serialization and FNV-1a 32-bit hash defined in `STRATEGIC_SPAWN.md` §3.1. This is reuse of the hash/serialization primitive only; Spawn does not own strategic-blast semantics.

Define:

```text
blastHash32(domain, matchSeed, ...canonicalKeys)
= FNV1A32_LENPREFIX_V1(
    domain,
    "STRATEGIC_BLAST_V1",
    matchSeed,
    ...canonicalKeys
  )
```

Strings use exact UTF-8 bytes and exact integers use canonical base-10 ASCII exactly as specified by that primitive. Floating-point keys and host-language object serialization are forbidden.

#### Canonical accepted-launch identity

Every physical strategic launcher owns one exact non-negative `acceptedLaunchCount`. It is initialized to `0` when that physical object first becomes an operational strategic launcher. It is physical launcher state: ordinary Silo upgrades, Warship movement/rank changes, and a successful transfer of a physical launcher preserve it; destruction removes it with the launcher. A rejected launch proposal does not increment it.

Every successfully committed strategic launch receives exactly one stable identity:

```text
strategicLaunchId = (launcherId, acceptedLaunchOrdinal)
```

For one atomic transaction and one physical launcher, let `baseOrdinal` be that launcher's `acceptedLaunchCount` in the immutable pre-state. Collect every launch from that launcher that the transaction will accept, then canonicalize that multiset independently of source-array position and controller command key:

1. group launches by `(weaponType, targetCellId)`;
2. order weapon types `ATOM_BOMB < HYDROGEN_BOMB < MIRV`;
3. order groups lexicographically by that weapon order and then ascending exact `targetCellId`;
4. for a group containing `n` semantically identical projectile launches, define canonical `duplicateIndex = 0..n-1` and materialize those otherwise fungible projectile results in ascending duplicate index;
5. walk the ordered groups/duplicate indices and assign `acceptedLaunchOrdinal = baseOrdinal + runningIndex`;
6. on successful atomic commit, increase `acceptedLaunchCount` by exactly the number of accepted launches from that launcher.

Command keys remain receipt/correlation metadata and never enter this canonicalization. Reordering a controller's source command array cannot exchange blast identities between different weapon/target intents. Exact duplicates receive the same set of consecutive identities regardless of their source ordering.

The immutable match `matchSeed` is the same canonical match-seed value consumed by the deterministic Spawn resolver. A launch-bound root seed is:

```text
blastSeed = blastHash32(
  "strategic-blast-root",
  matchSeed,
  launcherId,
  acceptedLaunchOrdinal,
  weaponType,
  targetCellId
)
```

Two otherwise identical launches from the same launcher therefore receive different blast identities because their accepted-launch ordinals differ. Replaying the same accepted `strategicLaunchId` reproduces the same root seed exactly.

#### Sixteen deterministic boundary knots

The irregular boundary uses these sixteen fixed direction knots in counter-clockwise order from east:

```text
K0  = ( 1,  0)
K1  = ( 2,  1)
K2  = ( 1,  1)
K3  = ( 1,  2)
K4  = ( 0,  1)
K5  = (-1,  2)
K6  = (-1,  1)
K7  = (-2,  1)
K8  = (-1,  0)
K9  = (-2, -1)
K10 = (-1, -1)
K11 = (-1, -2)
K12 = ( 0, -1)
K13 = ( 1, -2)
K14 = ( 1, -1)
K15 = ( 2, -1)
```

Let:

```text
U = 2^32 - 1 = 4,294,967,295
```

For each knot index `i = 0..15`, derive one unsigned 32-bit irregularity sample without a mutable RNG stream:

```text
u[i] = blastHash32(
  "strategic-blast-knot",
  matchSeed,
  blastSeed,
  i
)
```

Map that sample linearly onto the exact squared-radius interval:

```text
rawNumerator[i]
= innerNumerator × (U - u[i])
+ outerNumerator × u[i]

rawDenominator
= profileDenominator × U
```

Then perform exactly one circular smoothing pass from the unchanged `rawNumerator[]` values:

```text
smoothNumerator[i]
= 3 × rawNumerator[i]
+ rawNumerator[(i + 15) % 16]
+ rawNumerator[(i + 1) % 16]

smoothDenominator
= 5 × profileDenominator × U
```

No iterative/in-place smoothing is allowed.

#### Exact sector interpolation and membership

For candidate cell `(x, y)` around center `(centerX, centerY)`:

```text
dx = x - centerX
dy = y - centerY
d2 = dx × dx + dy × dy

cross((ax, ay), (bx, by)) = ax × by - ay × bx
```

Classification begins with the exact transformed core/outer comparisons:

```text
if cell is Impassable:
    UNAFFECTED
else if d2 × profileDenominator <= innerNumerator:
    CORE
else if d2 × profileDenominator > outerNumerator:
    UNAFFECTED
else:
    continue with irregular FRINGE test
```

For a non-core candidate vector `P = (dx, dy)`, choose the unique sector `i` whose half-open counter-clockwise cone is bounded by `A = K[i]` and `B = K[(i + 1) % 16]`:

```text
cross(A, P) >= 0
and
cross(P, B) > 0
```

The first boundary ray belongs to the sector; the second belongs to the next sector. Every non-zero vector belongs to exactly one of the sixteen sectors.

Within that sector define exact non-negative interpolation weights:

```text
leftWeight  = cross(P, B)
rightWeight = cross(A, P)
weightSum   = leftWeight + rightWeight
```

The candidate lies in the irregular FRINGE exactly when:

```text
d2 × smoothDenominator × weightSum
<=
smoothNumerator[i] × leftWeight
+ smoothNumerator[(i + 1) % 16] × rightWeight
```

Otherwise it is UNAFFECTED.

This rule requires no trigonometry, no platform-specific floating point, and no mutable random stream. The rectangular scan bound, iteration strategy, cache shape, or other search optimization is non-authoritative as long as every potentially eligible cell is considered and the exact comparison above produces the same set.

Because `rawNumerator` is linear in both transformed squared-profile inputs, multiplying the complete squared profile by an effective area factor preserves the same normalized irregular shape for the same `blastSeed`. An area transformation therefore scales one deterministic profile; it does not reroll or invent a second irregular boundary.

The inherited OpenFront `NukeExecution` implementation is not canonical for this target contract: it currently uses different ordinary-vs-Water-Nukes fringe algorithms and derives randomness from the detonation tick. Downstream runtime migration must converge on `STRATEGIC_BLAST_V1` rather than treating inherited behavior as normative.

### 1.3.3 Stable blast identity and MIRV child seeds

The root `blastSeed` and `strategicLaunchId` are derived/bound at accepted launch commit by the exact rules above and are serialized/replayed directly together with `profileVersion = STRATEGIC_BLAST_V1`.

The seed **must not** depend on:

```text
detonation tick
arrival tick
elapsed flight duration
controller completion order
controller command-array order
controller command key
mutable global-RNG position
```

Changing only projectile motion therefore cannot silently reroll a blast footprint.

A MIRV root launch binds one `rootBlastSeed` with the same `strategic-blast-root` rule using `weaponType = MIRV`, its own accepted-launch ordinal, and the submitted primary target. Once its canonical deterministic child target/order list is resolved, child blast seeds are assigned independently by canonical child index:

```text
childBlastSeed[childIndex]
= blastHash32(
    "strategic-blast-child",
    matchSeed,
    rootBlastSeed,
    childIndex
  )
```

Canonical child index is the child's index in the deterministic MIRV target/payload order. Seed assignment depends on neither separation timing nor later interception, so destroying one child cannot shift the seeds of its siblings.

Replay may store each child seed explicitly or store the root seed plus the profile version and complete canonical child ordering from which the same child seeds are regenerated. Either representation must reproduce the identical affected-cell set.

### 1.3.4 `STRATEGIC_BLAST_V1` golden vectors

Implementations claiming `STRATEGIC_BLAST_V1` compatibility must reproduce these vectors exactly. They use the canonical `FNV1A32_LENPREFIX_V1` primitive from `STRATEGIC_SPAWN.md` §3.1.

Root-launch vectors use:

```text
matchSeed             = "seed-0001"
launcherId            = "SILO-A"
targetCellId          = 12345
profileVersion        = STRATEGIC_BLAST_V1
```

| Root call | Expected uint32 | Hex |
| --- | ---: | --- |
| `blastHash32("strategic-blast-root", "seed-0001", "SILO-A", 0, "HYDROGEN_BOMB", 12345)` | `3895629164` | `0xE832956C` |
| `blastHash32("strategic-blast-root", "seed-0001", "SILO-A", 1, "HYDROGEN_BOMB", 12345)` | `2879337487` | `0xAB9F340F` |
| `blastHash32("strategic-blast-root", "seed-0001", "SILO-A", 0, "MIRV", 12345)` | `1024784900` | `0x3D14FA04` |

The first two rows intentionally prove that two accepted launches with otherwise identical launcher/weapon/target inputs receive different stable roots through their distinct accepted-launch ordinals.

For Hydrogen root seed `3895629164` (`0xE832956C`), representative knot samples are normative:

| Knot | Expected `u[i]` | Hex |
| ---: | ---: | --- |
| `0` | `3659862710` | `0xDA2512B6` |
| `1` | `3676640329` | `0xDB251449` |
| `7` | `3710195567` | `0xDD25176F` |
| `15` | `4028001839` | `0xF0166E2F` |

For MIRV root seed `1024784900` (`0x3D14FA04`), child-seed derivation is normative:

| `childIndex` | Expected child seed | Hex |
| ---: | ---: | --- |
| `0` | `3314979209` | `0xC5969189` |
| `1` | `3298201590` | `0xC4968FF6` |
| `249` | `3481733626` | `0xCF8709FA` |

For the authored P25 Hydrogen area multiplier `3/2`, baseline Hydrogen radii `80/100` bind the exact effective profile as:

```text
innerNumerator     = 80² × 3  = 19,200
outerNumerator     = 100² × 3 = 30,000
profileDenominator = 2
```

This is exactly equivalent to squared thresholds `9,600` and `15,000`; the reduced rational representation above is the authoritative serialized form.

Using that P25 profile, Hydrogen root seed `0xE832956C`, center `(0,0)`, and non-Impassable candidate cells, these classifications are normative:

| Relative cell `(dx,dy)` | Class |
| --- | --- |
| `(0,0)` | `CORE` |
| `(90,0)` | `CORE` |
| `(69,69)` | `CORE` |
| `(70,70)` | `FRINGE` |
| `(99,0)` | `FRINGE` |
| `(100,50)` | `FRINGE` |
| `(110,0)` | `FRINGE` |
| `(109,54)` | `UNAFFECTED` |
| `(120,0)` | `UNAFFECTED` |
| `(123,0)` | `UNAFFECTED` |

`(100,50)` lies exactly on one fixed direction-knot ray and therefore also exercises the half-open sector convention. Enabling Water Nukes must preserve every classification in this table; only the effect applied to `CORE` changes.

Changing field serialization, the root-identity inputs, hash constants/order, knot hashes, smoothing, sector convention, exact rational comparisons, or another normative vector requires a new blast profile version; it must not silently redefine `STRATEGIC_BLAST_V1`.

## 1.4 Standard strategic-weapon effect

For each affected owned population-bearing land cell under standard non-water-nuke rules:

1. political ownership is removed and the cell becomes neutral;
2. the former owner loses `1 Total Population`, capped at zero;
3. Capacity falls because ownership of that population-bearing cell was lost;
4. underlying base terrain remains unchanged;
5. Fallout is applied.

A later reconquest restores ordinary Capacity from ownership but grants no free current Population.

A persistent structure or mobile unit whose physical cell lies inside the resolved blast footprint is destroyed unless an explicit rule makes it immune. Carried Population aboard a destroyed Transport resolves as Transport destruction rather than an additional per-cell nuclear casualty.

## 1.5 Optional Water Nukes

Water Nukes are a **default-OFF optional V1 ruleset**. They do not own or replace blast geometry. Every weapon first resolves one ordinary `STRATEGIC_BLAST_V1` footprint using its already-effective squared profile and launch-bound seed.

When Water Nukes is enabled, it changes the effect applied to the resolved footprint classes:

```text
CORE:
    ordinary nuclear ownership/Population/Capacity/unit/structure consequences
    then eligible terrain converts to Deep Water

FRINGE:
    ordinary nuclear neutralization/Fallout consequences
```

There is no Water-Nukes-specific fringe generator and no second radius/area transformation.

For each eligible CORE cell, apply ordinary nuclear consequences first, then convert terrain:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → unchanged Deep Water
Impassable      → unchanged
```

A converted cell is unowned, non-population-bearing, non-buildable, removed from the ordinary conquerable-territory denominator, and has no Fallout overlay. Overlapping cores use the deterministic union of eligible core cells.

The resulting Deep Water immediately affects naval connectivity, pathing, coast/shore derivation, Capacity, and victory calculations. Segment membership remains immutable.

The ruleset intentionally provides no anti-cheese protection against terrain destruction.

## 1.6 Strategic-launch transaction and replay binding

Every player/controller strategic launch identifies one exact physical launcher. Launch legality is evaluated against one immutable pre-state and includes at minimum:

```text
launcher ownership/activity
+ effective launcher level / weapon access
+ weapon-use permission
+ target legality
+ effective FFY/other transaction requirements
+ at least one ready launcher charge
```

For each exact launcher, aggregate validation reserves READY charge slots from the immutable pre-state using that launcher's canonical slot rule and canonicalizes all accepted launch identities using Section 1.3.2 before any gameplay mutation occurs. Sibling launch commands cannot spend the same ready charge twice, and source-array order cannot choose either a charge slot or a strategic-launch ordinal.

A successful launch transaction commits atomically. For each accepted launch it binds/commits all of the following as one authoritative result:

- exact physical `launcherId` and launch cell;
- canonical consumed charge `slotId` and that slot's new `readyAtTick`;
- `strategicLaunchId = (launcherId, acceptedLaunchOrdinal)`;
- the launcher's incremented `acceptedLaunchCount`;
- required resource payment;
- root projectile and effective motion profile;
- submitted target and required target snapshot;
- effective reduced rational blast-area profile;
- `STRATEGIC_BLAST_V1` profile version and root seed;
- for MIRV, launch-bound child motion plus canonical child ordering/seed derivation.

A rejected transaction performs none of those mutations: it consumes no resource or charge, creates no projectile, binds no committed strategic-launch identity, and does not increment `acceptedLaunchCount`.

The replay/version binding for an accepted launch contains, directly or through versioned authoritative references, enough state to reproduce at least:

- exact physical launcher identity and launch cell;
- `strategicLaunchId` / accepted-launch ordinal;
- projectile/weapon class;
- effective projectile motion profile;
- for MIRV, both carrier and child-warhead motion profiles;
- submitted target and any launch-time target snapshot required by the weapon;
- effective canonical reduced blast-area inputs;
- `STRATEGIC_BLAST_V1` profile identity and launch-bound seed/root seed;
- for MIRV, the canonical child ordering required for child-seed derivation;
- consumed `slotId`, post-launch slot deadline/state, and launcher-local accepted-launch counter transition.

Replays consume those bound values; they do not infer historical in-flight mechanics from whatever Origin/Echo/ruleset configuration happens to be current when the replay is viewed.

### 1.6.1 Controller/API migration boundary

This mechanic-definition closure does **not** require a `ControllerApi.ts` patch inside #46. Existing exact `launcherId` selection and aggregate charge-state projections are sufficient for controller intent/readiness. They are not, however, a second canonical mechanics definition.

Downstream runtime/API migration must reconcile the current radius-oriented `StrategicWeaponMechanicsSpec` with the effective versioned blast profile defined here. Legacy fields such as `innerRadius`, `outerRadius`, and especially independent-looking Water-Nukes fields such as `deepWaterCoreRadius` are compatibility/presentation projections only. They must be derived from the same effective `STRATEGIC_BLAST_V1` CORE/FRINGE profile, or be replaced by a first-class effective-profile representation; they must never evolve into separately authoritative geometry.

Likewise, controller-facing charge summaries may remain aggregate projections while simulation/replay state retains canonical per-slot identity. No Origin-specific parallel strategic-weapon API is introduced by this closure.

---

# 2. MIRV

## 2.1 Baseline payload

One MIRV launch creates at most:

```text
250 independently resolving MIRV warheads
```

Each warhead uses:

```text
inner radius = 12
outer radius = 18
```

## 2.2 Target distribution

The launch selects one primary target cell and snapshots its target faction when faction-owned at launch.

```text
distribution radius = 750 cells
minimum warhead-center spacing = 55 cells
```

Warhead #1 targets the submitted primary target cell.

Remaining centers are chosen deterministically from legal land cells within 750 cells of the primary target that belong to the snapshotted target faction, respecting the 55-cell minimum spacing.

The resolver does not search beyond the authored distribution radius merely to fill all 250 warheads. If fewer legal spaced centers exist, fewer warheads resolve.

A later ownership change does not retarget the primary warhead. Ordinary collateral follows the physical resolved footprints.

## 2.3 Carrier separation and interception

Before separation, the MIRV carrier is one interceptable strategic projectile. Destroying it cancels the unresolved payload.

The carrier separates at approximately **50% of planned physical flight progress**. The exact deterministic motion-plan index/tick is implementation/versioning detail.

The carrier is not in the canonical `warhead projectile` class, while each separated child is. Therefore a warhead-only Origin motion transformation does not alter carrier motion or the physical separation fraction; if separation occurs, each child uses the launch-bound effective child-warhead motion profile.

After separation:

- the carrier ceases to exist as one target;
- every spawned warhead is independently interceptable;
- destroying one warhead affects only that warhead.

SAM interception uses actual physical entry into SAM coverage. A faster warhead may therefore spend fewer simulation ticks inside a given coverage geometry, but interception geometry itself is not changed by projectile speed.

---

# 3. Baseline Warship

One Warship represents an abstract naval combat formation rather than one literal ship.

## 3.1 Purchase and persistence

```text
WarshipCost = min(1,000,000 FFY, 250,000 FFY × (activeWarships + 1))
```

| Active Warships before purchase | Next Warship cost |
| ---: | ---: |
| 0 | **250k FFY** |
| 1 | **500k FFY** |
| 2 | **750k FFY** |
| 3+ | **1.00m FFY** |

Destroyed Warships stop counting toward the active-count curve.

| Property | Rule |
| --- | --- |
| Produced by | active owned Port |
| Construction time | **5 seconds** |
| Hard ownership cap | none |
| Base max health | **1,000 HP** |
| Base movement speed | **10 cells/s** |
| Base naval-gun range | **130 cells** |
| Base shell damage | **250 HP fixed** |
| Base shell cooldown | **2 seconds** |
| Autonomous operating leash | **100 cells** |
| Trade Ship capture distance | **5 cells** |
| Automatic repair-retreat threshold | **50% max health** |

Baseline shell damage is deterministic.

### 3.1.1 Warship build admission and ownership reservations

Warship construction uses the same transactional admission principle as persistent-structure acquisition, while this naval owner remains authoritative for Warship-specific producer/build lifecycle.

An effective hard Warship ownership cap, when supplied by an Origin/ruleset, counts:

```text
owned completed/active Warships
+ already committed Warships still under construction
+ temporary reservations created while validating the current atomic decision
```

The baseline cap is unbounded. P23 supplies an effective cap of one.

A successful Warship build admission reserves its ownership slot at transaction commit and holds it through the five-second construction lifecycle. Destruction/cancellation before completion or later destruction/loss releases the slot at the authoritative state transition. A failed proposal consumes no FFY/Population and leaves no reservation.

A mechanics quote is not a reservation. Consequently, with an effective cap of one and no existing Warship, two Port build quotes may each be legal against the same immutable snapshot while a decision containing both build commands is rejected atomically with `OWNERSHIP_CAP`. Command-array order must not decide which sibling purchase wins.

Hard build prohibitions are evaluated before transaction resources are committed and remain effective even when another rule changes the payment resource or makes the purchase free. Alternate payment therefore never bypasses a Warship build prohibition or ownership cap.

## 3.2 Strategic/autonomous control

Warships are autonomous combat formations rather than RTS-micro units.

The controller may issue a strategic **move destination**. An accepted move repositions the Warship and establishes that destination as its new operating anchor. The controller does not assign patrol modes, raid modes, attack modes, or individual targets.

Within ordinary operation the Warship wanders/searches for legal targets around its current operating anchor, with a baseline **100-cell leash**. Pathfinding, roaming, target acquisition, pursuit, firing, Trade-Ship capture behavior, and automatic repair retreat are simulation-owned.

Ordinary autonomous target priority within legal observation is:

```text
1. hostile Transport Ship
2. hostile Warship
3. legally capturable hostile Trade Ship
```

Autonomous Warship target acquisition, firing, Transport destruction, and Trade-Ship capture/recapture do **not** require, create, or refresh `atWar`. A controller-issued Warship move remains strategic repositioning rather than a direct attack order even when autonomous combat is a predictable consequence of moving into an opposing force's area.

Trade Ship capture/cargo semantics are owned by `FFY_ECONOMY.md`. Port repair mechanics are owned by `TERRAIN_AND_STRUCTURES.md`.

---

# 4. Warship ranks

Warships begin at rank **1** and ordinarily cap at rank **3**.

Each rank above 1 gives:

```text
+20% max health per rank
+20% shell damage per rank
```

When max health increases on rank-up, preserve current health percentage rather than granting a free heal equal to the added maximum health.

## 4.1 Naval XP

One rank step requires:

```text
100 Naval XP
```

| Event | Naval XP |
| --- | ---: |
| Destroy hostile Warship | **100** |
| Destroy hostile Transport | **10** |
| Successfully capture hostile Trade Ship | **4** |

XP above a threshold carries toward the next rank until the current rank cap is reached.

Origin-specific rank-cap or launcher transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

## 4.2 P29 mobile strategic launchers

When an Origin rule makes an owned Warship a strategic launcher, that Warship is one exact physical launcher whose launch cell is its **current cell**. A launch identifies the exact Warship; the simulation must not silently substitute a different ready Silo/Warship merely because another launcher could legally fire.

The Origin layer supplies the Warship's effective Silo level. Ordinary Silo level → weapon access and charge capacity remain canonical in `TERRAIN_AND_STRUCTURES.md`; this naval owner consumes that effective level for the mobile launcher rather than copying the persistent structure.

Mobile charge slots use the same canonical identity convention locally to the physical Warship: at capacity `N`, slot IDs are exactly `0..N-1`, existing slots are never renumbered, and the canonical spent charge is the lowest currently READY `slotId`.

A newly operational mobile strategic launcher creates every slot in its current effective capacity READY. When a later Warship rank/effective-level change raises capacity from `N` to `M`, every pre-existing slot preserves its exact ID/state/deadline and new slots `N..M-1` begin **RECHARGING**, with one full effective Silo recharge duration measured from the authoritative capacity-activation tick. Capacity growth therefore never grants a free immediate launch, renumbers an existing charge, or resets an existing cooldown.

For each mobile charge that begins recharging—whether because it was spent or because capacity growth created the slot—the effective recharge duration is resolved when that transition begins and represented by an absolute `readyAtTick` (or exactly equivalent deterministic deadline). Later modifier changes do not retroactively move an established deadline. The charge becomes READY on the first simulation tick satisfying `currentTick >= readyAtTick`.

Mobile launcher charge state and the launcher-local `acceptedLaunchCount` from Section 1.3.2 are serialized/replayed by physical Warship identity and survive ordinary movement/rank changes. Destruction of the Warship destroys the launcher/charge/launch-sequencing state. It remains Warship state rather than a hidden persistent Missile Silo structure.

---

# 5. Transport Ships

Transport Ships carry explicitly committed Population and are amphibious-operation vehicles, not territorial owners.

| Property | Baseline rule |
| --- | --- |
| Active cap per faction | **3** |
| Embarkation FFY cost | **0 FFY** before explicit modifiers |
| Movement speed | **10 cells/s** |
| Ordinary embark source | legal owned coast/shore embarkation point |
| Baseline health | fragile / no persistent health pool |
| Baseline Warship interception | one successful hostile shell destroys Transport |
| Carried Population | controller-selected committed Population |

The three-Transport cap prevents fragmentation of one invasion into very large numbers of tiny boats solely to saturate autonomous targeting.

## 5.1 Embark and autonomous travel

The controller begins an amphibious operation by choosing a legal embark source, legal landing target, and Population commitment. The simulation creates the Transport and owns pathfinding/travel to that target; Transports do not accept generic controller movement orders.

When the accepted target is owned by an opposing hostility side, the resulting Transport operation is controller-directed hostility under `OPEN_FUFU_DESIGN.md` and maintains the corresponding `atWar` relation while that directed hostile operation remains active. The Transport's autonomous routing does not create additional war relations with third parties merely because ownership or nearby combat later changes.

## 5.2 Amphibious landing

Reaching a legal hostile/neutral landing coast does **not** award the target cell.

The Transport makes that local coast operationally actionable and its carried Population enters the ordinary local hostile/neutral territorial engagement under canonical capture, casualty, terrain, and defense rules.

The Transport itself never bypasses political ownership resolution merely by arriving.

## 5.3 Retreat / abort

The controller may abort an active owned Transport. The simulation then routes it autonomously toward a legal owned return point; the controller does not choose a return path or micro-manage the vessel.

On successful return:

```text
25% of carried Population is lost
75% returns to Available Population
```

Destruction before successful return loses the carried Population under ordinary Transport-destruction rules.

Ending the final controller-directed hostile Transport operation contributes to war-state cooldown only through the canonical game-wide `atWar` lifecycle; this document does not own that timer.

Origin-specific Transport transformations are owned by `ORIGIN_TRAIT_CATALOGUE.md`.

---

# 6. Validation expectations

Before V1 release, accelerated/headless tests should benchmark at minimum:

- fleet-vs-fleet time-to-kill across ordinary ranks;
- autonomous target priority around mixed Transport/Warship/Trade traffic;
- Warship move-anchor/leash behavior without patrol/raid/target controller modes;
- autonomous Warship combat/piracy continuing without creating or refreshing `atWar`;
- repair-retreat integration with canonical Port repair fields;
- effective Warship ownership caps counting committed constructions and rejecting aggregate oversubscription atomically;
- three-Transport amphibious throughput across representative coasts;
- autonomous Transport travel/abort/return behavior;
- hostile Transport operation start/end integration with canonical `atWar` state;
- Atom/Hydrogen blast impact on representative territories;
- MIRV target saturation on compact, fragmented, coastal, and very large factions;
- carrier interception versus post-separation SAM-charge saturation;
- strategic-weapon costs and projectile speeds under the ordinary surfaced modifier system;
- `P10_PROJECTILE_CLASSIFICATION`: canonical warhead-projectile members receive P10 while non-members do not;
- `P10_MIRV_CARRIER_UNCHANGED`: warhead-only motion transforms preserve the carrier's physical separation semantics;
- `P10_SAM_PHYSICAL_WINDOW`: SAM interception consumes actual effective projectile motion;
- `P10_BLAST_SEED_UNCHANGED_BY_ARRIVAL`: changing only travel duration cannot alter a bound blast footprint;
- `STRATEGIC_LAUNCH_ID_DISTINCT_REPEATS`: two accepted launches from one launcher with the same weapon/target receive different ordinals/root seeds, while replay of either accepted identity reproduces its exact seed;
- `STRATEGIC_LAUNCH_ID_SOURCE_ORDER_INDEPENDENT`: reordering one transaction's source command array or changing command keys does not change the canonical launch-identity assignment for distinct weapon/target intents or the identity multiset for exact duplicates;
- `BLAST_V1_GOLDEN_VECTORS`: root, knot, MIRV-child, reduced-rational P25, sector-boundary, and representative raster vectors match Section 1.3.4 exactly;
- `BLAST_V1_SAME_SEED_SAME_FOOTPRINT`: identical profile inputs and seed reproduce the same CORE/FRINGE cell set;
- `BLAST_V1_TRAVEL_TIME_INDEPENDENCE`: arrival/detonation timing does not participate in footprint generation;
- `BLAST_V1_P25_NORMALIZED_SHAPE_PRESERVED`: an authored area transform scales the same seeded normalized profile rather than rerolling it;
- `BLAST_V1_WATER_NUKES_GEOMETRY_IDENTICAL`: enabling Water Nukes changes CORE effects but not resolved footprint membership;
- `BLAST_V1_MIRV_CHILD_SEED_STABILITY`: canonical child indices receive stable seeds independent of separation/interception timing;
- mobile-launcher initial readiness, stable `slotId` creation, lowest-READY consumption, dynamic-capacity append/recharge, and preservation of existing slot identities/deadlines;
- transactional multi-launch validation preventing two sibling commands from consuming one ready charge and binding each successful launch's exact slot transition plus strategic-launch identity atomically;
- replay/save reproduction of launch-bound motion profiles, accepted-launch counters/IDs, blast profile/seeds/footprints, exact charge slots, and mobile charge deadlines.