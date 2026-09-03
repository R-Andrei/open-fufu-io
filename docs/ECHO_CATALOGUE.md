# Open Fufu — Provisional Echo Catalogue Contract

## Status

This file is the **provisional working contract for Echo identity, acquisition, rolled quality, duplicate handling, match rewards, collection presentation, and Gacha Store behavior**, analogous to `ORIGIN_TRAIT_CATALOGUE.md` for Origins.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical integration authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

Nothing in this file authorizes gameplay implementation.

The values below are provisional V1 values and may be retuned through development, simulation, balance testing, or playtesting without changing the broader Echo design philosophy.

Current invariants:

- Echoes are collectible anime/JRPG-themed dialogue-line modifiers.
- Standard PvE equipped set size is **7 Echoes**.
- An Echo **mechanical identity** has fixed:
  - identity ID;
  - shape;
  - one or two concrete stat+scope keys;
  - polarity implied by its shape/slot.
- Echo presentation is linked through versioned content data rather than requiring one unique dialogue line to be permanently embedded in every mechanical identity.
- Modifier **magnitudes are not part of Echo identity**. They are rolled again whenever that identity is acquired.
- An account/player owns at most **one retained magnitude configuration per Echo identity**.
- Echoes specialize/tune a build; they do not normally introduce Origin-scale rule transformations, hard capabilities, alternate spawn topology, structure-count rules, free structures, or similar mechanics.
- Build-specific value may differ dramatically from generic rolled quality.
- Strong clean rolls should feel exceptional.
- Acquiring a duplicate Echo always produces duplicate/salvage currency even if the newly rolled copy replaces the currently retained copy.
- Scalar EchoScore is allowed for roll sampling, presentation, sorting, pity qualification, and salvage bands, but **never overrides Pareto duplicate choice**.
- Paid Gacha pity guarantees Lucky-or-better by the 50th consecutive non-Lucky+ pull using the accepted power-12 rescue curve; match drops neither advance nor reset that pity state, and Cheater rolls are never guaranteed.

---

## 1. Allowed Echo modifier pool

The pool below intentionally excludes effects that overlap too heavily with Origins or would too easily erase defining Origin rules.

`City Growth contribution` is one stat and appears only once below; it is not duplicated as both a Population-family and City-family identifier.

A **concrete stat key** is a stat definition plus its resolved scope. For example, `Tank Damage`, `Warship Damage`, `Forest Offensive Pressure`, and `Marsh Offensive Pressure` are four different concrete keys.

| Family | Stat | Scope |
| --- | --- | --- |
| **Population** | Population Growth | global |
|  | Starting Population | starting fraction of Capacity |
| **Neutral expansion** | Neutral settlement progress/speed | global |
| **Land combat** | Offensive pressure | global |
|  | Defensive pressure | global |
|  | Counter-response effectiveness while responding | global |
|  | Terrain offensive pressure | Plains / Highlands / Mountain / Desert / Forest / Tundra / Marsh / Shallow Water |
|  | Terrain defensive pressure | Plains / Highlands / Mountain / Desert / Forest / Tundra / Marsh / Shallow Water |
|  | Terrain capture/settlement speed | Plains / Highlands / Mountain / Desert / Forest / Tundra / Marsh / Shallow Water |
| **FFY economy** | All FFY event yield | global |
|  | Military/conquest FFY | global |
|  | Naval/trade FFY | global |
|  | Industrial FFY | global |
| **Construction** | Structure build cost | all / City / Fort / Port / Factory / Silo / SAM / Observation Post / Command Post |
|  | Structure upgrade cost | all / City / Fort / Port / Factory / Silo / SAM / Observation Post / Command Post |
|  | Structure construction time | all / City / Fort / Port / Factory / Silo / SAM / Observation Post / Command Post |
| **City** | City Growth contribution | City |
| **Fort** | Fort coverage area | Fort |
|  | Fort defensive pressure | Fort |
| **Factory** | Armored-unit repair radius | Factory |
|  | Armored-unit repair rate | Factory |
| **Port** | Passive repair radius | Port |
|  | Passive repair rate | Port |
| **Observation Post** | Observation radius | Observation Post |
| **Command Post** | Coverage area | Command Post |
|  | Offensive-pressure magnitude | Command Post |
| **SAM** | Interception range | SAM |
|  | Recharge/cooldown time | SAM |
| **Missile Silo** | Recharge/cooldown time | Silo |
| **Mobile units** | FFY purchase cost | Warship / Tank |
|  | Movement speed | Warship / Tank |
|  | Attack range | Warship / Tank |
|  | Damage | Warship / Tank |
|  | Maximum health | Warship / Tank |
| **Strategic weapons** | Warhead projectile speed | all / Atom / Hydrogen / MIRV |
|  | FFY cost | Atom / Hydrogen / MIRV |
|  | Blast area | Atom / Hydrogen |

`Industrial FFY` is the sole ordinary Echo axis for industrial/Factory-generated FFY events. There is no separate `Factory FFY-event effectiveness` Echo.

The current pool resolves to **93 concrete stat+scope keys**.

---

## 2. Echo identity space

There are exactly three Echo identity shapes.

### 2.1 Single positive

One fixed beneficial concrete stat key:

```text
+A
```

With 93 concrete keys:

```text
93 identities
```

### 2.2 Dual positive

Two different fixed beneficial concrete stat keys:

```text
+A
+B
```

Order does not create a new identity. `A+B` and `B+A` are the same identity.

The same concrete key may not appear twice.

With 93 concrete keys:

```text
C(93, 2) = 4,278 identities
```

### 2.3 Mixed positive / harmful

One fixed beneficial key and one different fixed harmful key:

```text
+A
-B
```

Polarity is part of identity. Therefore `+A/-B` and `+B/-A` are different identities.

The positive and harmful sides **may never use the same concrete stat+scope key**. For example:

```text
+Offensive Pressure
-Offensive Pressure
```

is invalid regardless of magnitudes.

With 93 concrete keys:

```text
93 × 92 = 8,556 identities
```

### 2.4 Total registered identity count

| Shape | Registered identities |
| --- | ---: |
| Single positive | **93** |
| Dual positive | **4,278** |
| Mixed positive / harmful | **8,556** |
| **Total** | **12,927** |

These **12,927 identities are the actual collectible mechanical item table**.

Magnitude permutations do **not** create additional Echo identities.

Presentation content is assigned to these identities through versioned content data. Multiple Echo identities may intentionally share the same dialogue line/content family.

---

## 3. Modifier identity, polarity, and semantics

A retained or newly acquired Echo instance is conceptually:

```text
echoIdentityId
+ rolled magnitude for modifier #1
+ optional rolled magnitude for modifier #2
```

The mechanical identity already fixes:

```text
shape
stat key(s)
polarity
```

Presentation data separately links that identity to current dialogue/content and visual data.

**Polarity** is distinct from mathematical sign because lower values are beneficial for costs, construction time, and cooldowns.

Examples:

```text
+5% Population Growth
-4% Fort build cost          ← beneficial
+4% Fort build cost          ← harmful
-3% SAM recharge time        ← beneficial
+3% SAM recharge time        ← harmful
+5% Tank range               ← beneficial
-5% Tank range               ← harmful
```

### 3.1 Beneficial and harmful meanings

| Stat | Beneficial form | Harmful form |
| --- | --- | --- |
| Population Growth | more Growth | less Growth |
| Starting Population | larger starting fraction | smaller starting fraction |
| Neutral settlement speed | faster | slower |
| Offensive pressure | more | less |
| Defensive pressure | more | less |
| Counter-response effectiveness | stronger response side | weaker response side |
| Terrain offense | stronger on selected terrain | weaker on selected terrain |
| Terrain defense | stronger on selected terrain | weaker on selected terrain |
| Terrain capture/settlement speed | faster acquisition on selected terrain | slower acquisition on selected terrain |
| FFY event yield | more FFY | less FFY |
| Structure build cost | lower cost | higher cost |
| Structure upgrade cost | lower cost | higher cost |
| Construction time | shorter | longer |
| City Growth contribution | more | less |
| Fort coverage | larger | smaller |
| Fort defensive pressure | stronger | weaker |
| Factory armored-unit repair radius | larger | smaller |
| Factory armored-unit repair rate | faster healing | slower healing |
| Port repair radius | larger | smaller |
| Port repair rate | faster healing | slower healing |
| Observation radius | larger | smaller |
| Command Post coverage | larger | smaller |
| Command Post pressure | stronger | weaker |
| SAM range | larger | smaller |
| SAM cooldown | shorter | longer |
| Silo cooldown | shorter | longer |
| Mobile-unit FFY cost | cheaper | more expensive |
| Mobile-unit speed | faster | slower |
| Mobile-unit range | longer | shorter |
| Mobile-unit damage | more | less |
| Mobile-unit health | more | less |
| Warhead projectile speed | faster | slower |
| Strategic-weapon FFY cost | cheaper | more expensive |
| Blast area | larger | smaller |

`Starting Population` is multiplicative against the configured starting Population fraction rather than an absolute Population grant. For example, if the ruleset starts a faction at `50%` of Capacity, `+4% Starting Population` means `50% × 1.04 = 52% of Capacity`, not 54 percentage points.

Counter-response Echoes modify the **response-side** effectiveness hook only unless a future separately named Echo stat is explicitly added.

`Industrial FFY` applies to ordinary industrial FFY events, including Factory-driven industrial/train FFY event values. There is no second Factory-specific FFY Echo layer.

Factory repair-radius/rate Echoes affect the canonical Tank/Heavy-Artillery repair service provided by Factories. They do not alter simultaneous repair capacity.

A Tank-scoped mobile-unit Echo applies to the faction's canonical Tank chassis **after Origin transformation**. If P43 transforms Tanks into Heavy Artillery, Tank cost/speed/range/damage/health Echoes specialize the resulting Heavy-Artillery profile; there is no separate Heavy-Artillery Echo scope.

For the Tank scope:

- `Attack range` modifies the unit's ordinary anti-armor and Population-attack range, and Train-interception range when that capability exists.
- `Damage` modifies numeric anti-armor HP damage and Population damage. It does not alter the binary Train-destruction result or P44's radioactive neutralization footprint.
- `Movement speed` modifies final Tank/Heavy-Artillery movement after the Origin-established chassis profile and terrain movement rules.
- `Maximum health` modifies the chassis health pool.
- `FFY purchase cost` modifies the final FFY cost of the purchased Tank/Heavy Artillery after the ordinary active-count curve and Origin purchase-cost transformation are established.

Tank/Heavy-Artillery firing cooldown/reload is deliberately **not** an Echo stat. Echoes cannot shorten P43 Heavy Artillery's authored reload or thereby erase its intended vulnerability window. P44 radioactive footprint radius/cell count is likewise not an Echo stat.

Observation-radius Echoes modify the Observation Post's effective completed-level radius. Under P49, where Observation Posts become counterintelligence blackout structures, that same numeric radius modifier specializes the blackout radius rather than restoring ordinary observation.

Fort-pressure Echoes specialize the Fort's effective pressure magnitude. Under P50, the Fort's mirrored offensive field uses that same effective Fort-pressure magnitude. Command-Post-pressure Echoes similarly specialize the Command Post's effective pressure magnitude; under P51, the mirrored defensive field uses that same effective magnitude. Cross-type Fort/Command overlap still follows the Origin catalogue's diminishing field-composition rule.

If an Origin makes an underlying stat irrelevant, an Echo may become partially or wholly inert. This is legal and does not create hidden compatibility rules.

---

## 4. Provisional single-Echo maximum magnitudes

Beneficial and harmful variants use the same absolute maximum interval for a given stat.

| Echo stat | Single-Echo maximum absolute magnitude |
| --- | ---: |
| Population Growth | **5%** |
| Starting Population | **4%** |
| Neutral settlement speed | **6%** |
| Global Offensive Pressure | **4%** |
| Global Defensive Pressure | **4%** |
| Counter-response effectiveness | **5%** |
| Terrain Offensive Pressure | **5%** |
| Terrain Defensive Pressure | **5%** |
| Terrain Capture/Settlement Speed | **5%** |
| All FFY yield | **4%** |
| Military/conquest FFY | **6%** |
| Naval/trade FFY | **6%** |
| Industrial FFY | **6%** |
| All-structure build cost | **4%** |
| Specific-structure build cost | **5%** |
| All-structure upgrade cost | **4%** |
| Specific-structure upgrade cost | **5%** |
| All-structure construction time | **4%** |
| Specific-structure construction time | **5%** |
| City Growth contribution | **5%** |
| Fort coverage area | **4%** |
| Fort defensive pressure | **4%** |
| Factory armored-unit repair radius | **5%** |
| Factory armored-unit repair rate | **5%** |
| Port passive repair radius | **5%** |
| Port passive repair rate | **5%** |
| Observation Post radius | **4%** |
| Command Post coverage area | **4%** |
| Command Post pressure | **4%** |
| SAM interception range | **3%** |
| SAM recharge time | **4%** |
| Silo recharge time | **4%** |
| Mobile-unit FFY purchase cost | **4%** |
| Mobile-unit movement speed | **4%** |
| Mobile-unit attack range | **3%** |
| Mobile-unit damage | **5%** |
| Mobile-unit maximum health | **5%** |
| All-warhead projectile speed | **5%** |
| Specific-warhead projectile speed | **6%** |
| Strategic-weapon FFY cost | **4%** |
| Atom/Hydrogen blast area | **3%** |

These maxima intentionally vary by strategic sensitivity. Global combat/economy effects and tactically dominant effects such as mobile-unit range are narrower than more specialized economic, repair, or unit stats.

---

## 5. Magnitude rolls and EchoScore-weighted quality

Magnitude is rolled **when an Echo identity is acquired**, not when its permanent identity is created.

The same Echo identity may therefore be seen many times with different magnitude configurations.

Example:

```text
Echo #4821 identity:
  +Tank Damage
  +Tank Movement Speed

first acquisition:
  +3% Tank Damage
  +2% Tank Movement Speed

later acquisition:
  +2% Tank Damage
  +4% Tank Movement Speed
```

Those are two rolls of the **same collectible identity**.

### 5.1 Integer magnitudes

The accepted magnitude increment is **1 whole percentage point**.

There are no `0.5%` Echo magnitude rolls.

For a stat whose full single-positive maximum is `M`, a single-positive or mixed modifier may roll any integer magnitude:

```text
1%, 2%, ... M%
```

### 5.2 Dual-positive magnitude ceilings

Dual-positive Echoes retain their reduced per-side intensity. With the current integer system, the allowed maximum per side is:

| Ordinary single-positive maximum | Dual-positive maximum |
| ---: | ---: |
| 3% | **2%** |
| 4% | **3%** |
| 5% | **3%** |
| 6% | **4%** |

Therefore a dual-positive modifier rolls an integer magnitude from `1%` through the applicable reduced maximum.

The purpose remains the same: two beneficial stats share one Echo slot, so each side has a smaller maximum than a clean single-positive stat.

### 5.3 EchoScore

For any rolled modifier with absolute magnitude `x` and ordinary full single-positive maximum `M`:

```text
normalizedMagnitude = x / M
```

Then:

```text
beneficial modifier → +normalizedMagnitude
harmful modifier    → -normalizedMagnitude
```

The rolled Echo's generic quality score is:

```text
EchoScore = Σ signedNormalizedMagnitude
```

Examples:

```text
+5% Population Growth, M=5
→ EchoScore +1.00

+2% Population Growth, M=5
→ EchoScore +0.40

-3% Warship Range, M=3
→ EchoScore -1.00 contribution

+5% Population Growth
-4% Fort Coverage
(both full single-positive maxima)
→ +1.00 - 1.00 = 0.00
```

EchoScore deliberately does **not** score synergy, anti-synergy, Origin-specific usefulness, current build relevance, or whether a harmful stat is irrelevant to the current player. It is a generic roll-quality metric, not a build oracle.

### 5.4 Production magnitude sampling by EchoScore

Magnitude combinations are **not uniformly likely**.

For a selected Echo identity:

1. enumerate every legal integer magnitude configuration for that identity;
2. calculate EchoScore for each configuration;
3. assign each configuration the relative sampling weight below;
4. normalize those weights within that identity;
5. sample one final magnitude configuration.

For non-negative score:

```text
weight(S) = 10^(-2S)     for S >= 0
```

Reference anchors:

| EchoScore | Relative weight |
| ---: | ---: |
| `0.00` | **1.000×** |
| `+0.25` | **0.316×** |
| `+0.50` | **0.100×** |
| `+0.75` | **0.0316×** |
| `+1.00` | **0.010×** |
| `+1.25` | **0.00316×** |
| `+1.50` | **0.001×** |

For negative score, retain the intentionally gentler old-side anchors:

| EchoScore | Relative weight |
| ---: | ---: |
| `-1.00` | **0.03×** |
| `-0.75` | **0.05×** |
| `-0.50` | **0.10×** |
| `-0.25` | **0.50×** |
| `0.00` | **1.00×** |

For negative scores between anchors, interpolate **logarithmically in weight space**.

This produces the intended shape:

- neutral/ordinary rolls are the common center;
- increasingly strong positive rolls become sharply rarer;
- spectacularly bad mixed rolls are also suppressed rather than allowing the pool to collapse into mostly garbage;
- score affects the **acquired magnitude roll**, never the permanent Echo identity's probability after that identity has already been selected.

With the current 93-key/maxima registry and the accepted `50/35/15` shape mix, deterministic enumeration of this V1 curve gives an overall natural **Lucky-or-better rate of approximately 2.50%**, or roughly one qualifying roll per 40 acquisitions before pity. This percentage is a validation target derived from the current tables, not a separately authored drop-rate constant.

---

## 6. Acquisition shape and identity selection

The number of registered identities in a shape does **not** determine how often that shape drops.

Every ordinary acquisition first selects the Echo shape using the accepted provisional distribution:

```text
Mixed positive/harmful: 50%
Dual positive:          35%
Single positive:        15%
```

After shape selection, identity selection is intentionally simple:

> **Every registered identity inside the selected shape has equal probability.**

Therefore:

```text
single selected → uniform pick among 93 identities
dual selected   → uniform pick among 4,278 identities
mixed selected  → uniform pick among 8,556 identities
```

There is no V1 stat-family weighting, scope protection, collection-completion weighting, owned/unowned weighting, or hidden synergy weighting.

Only after the identity is selected are its legal magnitudes sampled using §5.

This deliberately keeps:

- mixed Echoes most common;
- dual-positive Echoes next;
- clean single-positive Echoes rarest;

without allowing raw identity counts to force approximately `66% / 33% / <1%` acquisition rates.

The shape probabilities and magnitude-weight curve are versioned balance data and are not stored redundantly on each Echo identity.

---

## 7. Dialogue, flavor, and visual identity

The mechanical Echo registry and the dialogue-line library are **separate data sets**.

Open Fufu does not require 12,927 unique anime dialogue lines before the Echo system is usable.

### 7.1 Dialogue-line library

Maintain a content table conceptually equivalent to:

```text
EchoLine
- lineId
- text / localized text reference
- source/anime metadata
- speaker/character metadata
- language/version/provenance metadata as required
```

An Echo mechanical identity links to a line through a versioned assignment:

```text
EchoLineAssignment
- echoIdentityId
- lineId
- contentVersion
```

Multiple Echo identities may share one `lineId`. This intentionally permits **line families** while the content library is small.

As more lines are added over time, identities may be split across more assignments, potentially approaching one unique line per Echo one day, **without changing the Echo's mechanical identity or owned roll**.

Dialogue/content changes must be content-versioned so historical presentation/replay records can resolve the intended line where needed.

### 7.2 Visual identity

An identity should also have a stable or content-versioned visual identity/recipe suitable for card presentation.

The visual representation does not need to store a complete standalone SVG or raster image per Echo.

A compact deterministic visual recipe is preferred when practical, for example:

```text
visualSeed
character/archetype id
frame id
background/pattern id
accent/variant id
expression/pose id
```

The client may combine those identity-level values with shared art/SVG assets and a deterministic renderer.

Magnitude is intentionally **not** part of dialogue-line assignment or base visual identity. A stronger or weaker duplicate remains the same mechanical Echo and uses the current content assignment for that identity/version.

Actual sourcing/licensing/provenance of anime lines is a separate content/legal task and must not be silently assumed solved by this mechanical contract.

---

## 8. Owned Echoes and duplicate acquisition

An account/player retains at most **one magnitude configuration for each Echo identity**.

Receiving an identity already owned is a **duplicate acquisition**.

A duplicate always grants the configured duplicate/salvage currency regardless of whether:

- the new copy replaces the old copy;
- the old copy is retained;
- the new copy is an exact mechanical tie.

The newly rolled magnitudes are compared against the currently retained copy.

### 8.1 Strict automatic upgrade

A new copy is an automatic upgrade when it is at least as good on **every modifier axis** and strictly better on at least one.

For harmful modifiers, a smaller harmful magnitude is better.

Examples:

```text
owned: +3 A / +2 B
new:   +4 A / +2 B
→ automatic upgrade

owned: +3 A / -4 B
new:   +4 A / -3 B
→ automatic upgrade
```

### 8.2 Strict automatic downgrade

A new copy is automatically rejected/salvaged when it is no better on every axis and strictly worse on at least one.

Examples:

```text
owned: +3 A / +2 B
new:   +2 A / +2 B
→ keep owned copy automatically

owned: +3 A / -4 B
new:   +2 A / -5 B
→ keep owned copy automatically
```

The duplicate currency is still awarded.

### 8.3 Incomparable / player-choice duplicate

If one relevant axis improves while another worsens, the game does **not** collapse the comparison into one aggregate score.

The player chooses which copy to retain.

Examples:

```text
owned: +3 A / +2 B
new:   +2 A / +3 B
→ player chooses

owned: +3 A / -4 B
new:   +4 A / -5 B
→ player chooses

owned: +3 A / -4 B
new:   +2 A / -3 B
→ player chooses
```

This remains true even if EchoScore considers one copy numerically superior. Build preference belongs to the player.

### 8.4 Multiple duplicates in one reward batch

Large matches or gacha batches may produce several copies of the same identity at once.

Do not force the player through sequential copy-by-copy dialogs.

Instead:

1. group all newly acquired copies by Echo identity;
2. include the currently retained copy when one exists;
3. eliminate all copies strictly dominated by another candidate;
4. compute the remaining Pareto frontier;
5. if exactly one candidate remains, retain it automatically;
6. if multiple incomparable candidates remain, ask the player to choose one;
7. award duplicate/salvage currency for every duplicate acquisition independently of which candidate is retained.

The player-facing choice UI must show **only candidates that survive this automatic filtering**.

### 8.5 Default selection and reward-settlement UI

Reward settlement is presented as a batch rather than one modal per drop.

Conceptually:

```text
CHOICES / UPGRADES
- one picker group per Echo identity that still needs player choice
- current retained copy first when it survives the Pareto frontier
- surviving new incomparable candidates beside it

NEW ECHOES
- grid of newly discovered identities

SUMMARY
- automatic upgrades/rejections as appropriate
- total duplicate currency earned
```

For a picker group:

- the current owned copy is first and selected by default whenever it remains on the Pareto frontier;
- strictly dominated current/new copies are not shown as selectable alternatives;
- if the current copy is dominated and multiple incomparable new candidates remain, default to the surviving candidate with highest EchoScore, using a stable deterministic tie-break for exact-score ties;
- this default is a convenience only and does **not** redefine Pareto superiority.

Reward results are persisted as a **pending settlement** until the player accepts the result screen. Closing/reconnecting must not lose the reward batch.

V1 should not allow another reward-bearing match or additional Gacha Store pulls while an unresolved pending settlement exists. This avoids arbitrarily nesting unresolved Pareto choices. A player who does not care about optimizing duplicates can simply accept the default selections immediately.

---

## 9. EchoScore quality tiers and card presentation

Echo **identity** and Echo **rolled instance quality** are separate concepts.

An identity's mechanical shape/stat keys are stable. Its acquired magnitudes—and therefore EchoScore/tier—vary.

The same Echo identity may therefore be Questionable on one acquisition and Lucky on a later acquisition.

### 9.1 Accepted V1 quality tiers

Use these score bands:

| Quality tier | EchoScore |
| --- | ---: |
| **Trash** | `< -0.50` |
| **Questionable** | `-0.50 ≤ S < 0.50` |
| **Decent** | `0.50 ≤ S < 0.75` |
| **Not Bad** | `0.75 ≤ S < 1.00` |
| **Lucky** | `1.00 ≤ S < 1.25` |
| **Cheater** | `S ≥ 1.25` |

These are **rolled-quality tiers**, not permanent identity rarity classes.

Under the current shape/maxima rules, Cheater rolls emerge only from sufficiently strong dual-positive rolls; this is a consequence of the score/magnitude system rather than a separately hard-coded shape restriction.

### 9.2 Border gradient

The quality tier selects the broad visual family while exact EchoScore controls a **continuous gradient/intensity within that family**.

Target direction:

```text
Trash         → dark gray
Questionable  → gray through white
Decent        → pale through stronger yellow
Not Bad       → yellow-green through green
Lucky         → light blue through stronger blue
Cheater       → violet through intense pink/purple
```

Do not reduce this to one rigid color per tier if the client can cheaply preserve continuous score feedback.

Lucky cards receive a restrained animated blue glow/light effect.

Cheater cards receive intentionally excessive premium presentation: bright pink/violet border plus an animated radiant/rainbow/lens-ray-like aura extending outside the card.

### 9.3 Card interaction

Echoes are presented as interactive cards.

Collapsed/unhovered cards should prioritize:

- visual/icon;
- Echo name/identity;
- quality border;
- compact stat preview.

Hover/focus may enlarge the card and use subtle cursor-driven tilt/parallax/rotation. Expanded presentation should expose:

- full modifier stats;
- exact EchoScore;
- quality-tier tag;
- dialogue line and relevant source/speaker metadata where appropriate;
- larger visual/icon;
- animated tier effects.

Presentation must remain usable without hover on touch/non-pointer interfaces.

### 9.4 EchoScore never decides incomparable ownership

Score tiers, color, sorting, pity, and salvage are allowed to use EchoScore.

Duplicate retention still follows §8. If two copies are Pareto-incomparable, the player chooses even when one card has a higher quality tier or EchoScore.

---

## 10. Origin/Echo composition

Echo percentages specialize the faction's already established rule profile rather than replacing Origin identity.

Conceptually:

```text
ruleset baseline
→ Origin structural profile / modifiers
→ summed Echo modifier layer
→ local terrain / structures / situational effects
```

Exact same-calculation percentages follow the canonical additive-percentage rule unless a specific mechanic defines otherwise. Distinct rule hooks may compose separately.

An Echo can therefore mitigate an Origin drawback without necessarily erasing it.

For P43, the Heavy-Artillery transformation establishes the Tank chassis first; Tank-scoped Echo percentages then specialize that transformed profile. Nothing in the Echo layer changes the authored P43 reload cadence or P44 footprint unless a future separately accepted rule explicitly says so.

---

## 11. Provisional 75%-optimal stress test

The working balance rule for Echo maxima remains:

> When evaluating one Echo stat, assume a highly optimized player can fill all 7 slots with retained Echoes averaging **75% of that stat's single-Echo maximum**, then combine that loadout with the strongest relevant legal Origin effects. This is not the expected ordinary loadout; it is a safety/stress target.

For a stat maximum `M`, the seven-slot 75%-quality single-axis contribution is:

```text
7 × 0.75 × M = 5.25M
```

Reference stress magnitudes:

| Stat maximum | 7 slots × 75% |
| ---: | ---: |
| 3% | 15.75% |
| 4% | 21.00% |
| 5% | 26.25% |
| 6% | 31.50% |

Important retained conclusions:

- no structure-cost stack should reach free/negative cost;
- P40's cooldown drawback must remain meaningful under full mitigation;
- P42's range drawback must remain meaningful under full mitigation;
- P43's half-speed/long-reload artillery identity remains meaningful because reload is not Echo-modifiable;
- P44's radioactive territorial footprint remains fixed rather than Echo-scalable;
- extreme local offense/defense cases should be driven mainly by deliberate Origin combinations and conditional geography rather than Echoes alone.

These checks must eventually become executable/property tests against implemented formulas.

---

## 12. Echo / Origin boundary

The following are intentionally **not** part of the normal Echo pool at this stage:

- Population Capacity / Max Population / Capacity per cell;
- Origin points, Origin trait slots, Echo slots;
- controller cadence, CPU, memory, query limits, or sandbox behavior;
- victory/defeat/capitulation rules;
- structural visibility/fog-of-war capability changes; numeric Observation Post radius remains a normal Echo stat;
- automatic defender count above the canonical 0/1 rule;
- hard build/capability permissions such as `can build Warships`, `SAM may attack ships`, `Warships count as Silos`, weapon-family prohibitions, launcher-tier requirements, or terrain traversal permissions;
- split spawning, extra spawn origins, Initial Territory topology transformations, or other strategic-spawn rule changes;
- free structures/weapons, structure ownership caps, structure grants on landing, defender survival on capture, alternate Population-growth curves, Port-only Transport requirements, armored-Transport conversion, or equivalent structural Origin mechanics;
- direct creation of special FFY/Population event types that do not exist for ordinary factions;
- discrete structure capacities such as Factory simultaneous armored-unit repair count;
- Tank/Heavy-Artillery firing cooldown/reload, operational leash, automatic repair-retreat threshold, terrain traversal permissions, or similar doctrine-defining control axes;
- P44 radioactive footprint size/radius/cell count or other niche modifiers whose underlying mechanic exists only because one specific Origin enables it.

Echoes may partially improve or worsen a numeric stat that an Origin also modifies, but the Origin rule remains the underlying faction identity and Echoes specialize the resulting profile through the published modifier-composition rules.

---

## 13. Match reward roll pool

End-of-match Echo rewards use an accumulated **reward roll pool**.

The pool starts at:

```text
0 rolls
```

There is no guaranteed base roll merely for entering a match.

### 13.1 Qualifying opponent elimination

Every qualifying opponent defeated while the player's reward entity remains active contributes:

```text
+1 Echo roll
```

The roll is granted regardless of **who** actually defeated that opponent.

Fixed teammates/allies never count as qualifying opponents.

Diplomacy does not change during a match, so the set of teammates/allies/opponents relevant to reward accounting is known from match start.

### 13.2 AI difficulty bonuses

A special higher-difficulty AI preset grants:

```text
+1 ordinary opponent-defeat roll
+ that preset's configured difficulty bonus
```

Example:

```text
Tanya defeated
ordinary defeat contribution: +1
Tanya difficulty modifier:    +3
total contribution:           +4 rolls
```

Exact preset bonuses are defined by their own balance data.

### 13.3 Victory bonus

Victory contributes:

```text
+5 Echo rolls
```

### 13.4 Defeat does not erase earned rewards

Victory is **not required** to receive Echoes.

At match end, the player/reward entity receives every roll accumulated before its run ended.

A player who survives most of a difficult match and contributes to a large number of opponent eliminations may therefore receive meaningful Echo rewards even if ultimately defeated.

The old model of receiving nothing on defeat is retired.

### 13.5 All rolls become actual item drops

The old concept of rolling multiple candidate Echoes and keeping only the highest/best roll is retired.

Every accumulated roll produces an Echo acquisition.

Therefore:

```text
30 earned rolls → 30 Echo acquisitions
100 earned rolls → 100 Echo acquisitions
```

Large matches may legitimately produce very large reward batches. Duplicate grouping and Pareto resolution in §8 exist partly to make those batches manageable.

---

## 14. Reward entities and human teams

Reward accounting is attached to a **reward entity** rather than always to one individual human seat.

### 14.1 Solo

In solo play, the human player is the reward entity.

Opponent eliminations count while that player remains active in the match.

When that player is eliminated, later unrelated eliminations do not continue growing that player's pool.

### 14.2 Fixed human team

When multiple human players begin the match on the same fixed team, the **human team is the reward entity**.

Consequences:

- the team has one shared accumulated roll-pool result;
- the reward entity remains active until the human team as a whole is eliminated or the match ends;
- one human teammate being eliminated early does not end reward accumulation for that teammate;
- if the human team later wins, every human team member receives the full victorious final roll pool;
- if the team ultimately loses, every human team member receives the same pool accumulated before team elimination;
- rewards are **not divided** among human teammates.

Example:

```text
Alice + Bob are fixed human teammates.
Alice is eliminated early.
Bob continues, several opponents are defeated, and Bob eventually wins.

Result:
the human team won.
Alice and Bob each receive the full final team reward pool,
including the +5 victory bonus.
```

Fixed allied AI or other non-human allies do not become additional human reward recipients unless a future mode explicitly defines otherwise.

---

## 15. Gacha Store and duplicate economy

The Echo store is intentionally framed in-game as a **Gacha Store**.

It supports:

- single pulls;
- 10-pull batches;
- duplicate recycling;
- nonlinear Lucky-or-better bad-luck protection;
- a hard Lucky-or-better guarantee;
- **no Cheater guarantee**.

### 15.1 Accepted V1 purchase sizing

```text
1 pull   = 10 currency
10 pulls = 100 currency
```

There is no V1 batch discount or bonus roll.

A 10-pull batch is mechanically equivalent to ten sequential single pulls. It exists for convenience/presentation, not superior expected value.

A future specialized banner/pool system is not part of initial V1. The initial Gacha Store uses one ordinary Echo acquisition pool.

### 15.2 Duplicate salvage values

Every duplicate awards currency according to the **newly acquired duplicate roll's quality tier**, regardless of whether that roll is retained:

| Duplicate roll tier | Salvage currency |
| --- | ---: |
| Trash | **1** |
| Questionable | **2** |
| Decent | **3** |
| Not Bad | **4** |
| Lucky | **6** |
| Cheater | **8** |

The same salvage table applies regardless of whether the duplicate came from a match reward or the Gacha Store.

A 10-currency pull therefore cannot deterministically refund its entire price from one ordinary duplicate; even a Cheater duplicate returns 8. The Gacha Store remains a real currency sink while match-earned duplicates remain a meaningful currency source.

The final thematic name of this currency remains presentation work.

### 15.3 Lucky-or-better qualification

For pity purposes:

```text
Lucky-or-better ⇔ EchoScore >= 1.00
```

Both Lucky and naturally rolled Cheater Echoes satisfy/reset Lucky+ pity.

There is **no Cheater pity**, no minimum Cheater frequency, and no mechanic that progressively guarantees `EchoScore >= 1.25`.

### 15.4 One shared sequential pity counter

Pity belongs only to **paid Gacha Store pulls**.

Singles and 10-pull batches use the same sequential pity state. A batch is processed pull by pull in deterministic order:

```text
pull #1 updates pity before pull #2
...
pull #10 sees the state left by pull #9
```

If pull #4 in a batch is Lucky/Cheater, pity resets before pulls #5–#10.

**Match reward acquisitions neither advance nor reset Gacha pity.** A Lucky/Cheater earned from ordinary match rewards therefore does not erase paid-pull bad-luck protection.

### 15.5 Accepted power-12 soft pity

Let:

```text
H = 50
n = consecutive non-Lucky+ paid pulls already suffered since the last reset
P0 = natural Lucky+ probability under the ordinary acquisition generator
```

Use the accepted **power-12 rescue curve**:

```text
r(n) = (n / 49)^12
```

for `0 <= n <= 49`.

The effective probability that the next paid pull is Lucky+ is conceptually:

```text
P_lucky+(n) = P0 + (1 - P0) × r(n)
```

Equivalent implementations are allowed if deterministic/simulatable and distributionally equivalent.

One clean implementation is:

1. perform the normal acquisition path with its natural Lucky+ chance;
2. independently apply only the **additional rescue probability** implied by the target `P_lucky+(n)`;
3. if rescue activates, sample from the ordinary acquisition distribution **conditioned on EchoScore >= 1.00**;
4. reset pity after any natural or rescued Lucky+ result.

This deliberately leaves ordinary early-pull luck almost untouched, begins helping during a real drought, rises sharply near the end of the streak, and avoids manufacturing a special fixed pity item.

With the current natural `P0 ≈ 2.50%`, representative next-pull Lucky+ chances are approximately:

| Consecutive misses before next pull | Lucky+ chance on next pull |
| ---: | ---: |
| 0 | **2.50%** |
| 20 | **~2.50%** |
| 30 | **~2.68%** |
| 35 | **~3.72%** |
| 40 | **~8.80%** |
| 45 | **~29.30%** |
| 47 | **~48.18%** |
| 48 | **~61.63%** |
| 49 | **100% on the 50th pull** |

The percentages above are derived validation examples for the current natural generator rather than separately authored constants.

### 15.6 Accepted 50-pull hard guarantee

The V1 hard pity endpoint is:

```text
H = 50 paid Gacha pulls
```

A player can never complete 50 consecutive paid Gacha pulls without receiving at least one Lucky-or-better result. The 50th pull after 49 consecutive non-Lucky+ paid pulls is therefore forced/conditioned to `EchoScore >= 1.00` if the ordinary roll does not already qualify.

Any natural or rescued Lucky/Cheater result resets the paid-pull pity counter to zero.

This is intentionally generous. Open Fufu is a friends-oriented game with a very large mechanical roll space, so V1 prefers visible protection against unfun droughts over maximizing progression scarcity. The value remains versioned balance data and may be retuned after real play without changing the Echo identity architecture.

The guarantee is **Lucky-or-better only**. It does not guarantee Cheater, does not progressively increase Cheater probability, and does not alter the ordinary conditioned distribution beyond requiring `EchoScore >= 1.00` when pity rescue/guarantee fires.

---

## 16. Generation / acquisition procedure

A normal Echo acquisition conceptually proceeds as follows:

1. determine acquisition source (`match`, `gacha`, future source);
2. select Echo **shape** using the current `50% mixed / 35% dual-positive / 15% single-positive` distribution unless the source explicitly defines another approved table;
3. select one registered Echo identity **uniformly within that shape**;
4. enumerate and EchoScore-weight the legal integer magnitude configuration(s) for that identity;
5. sample the ordinary rolled instance;
6. for a paid Gacha pull, apply the current Lucky+ pity state as specified in §15;
7. finalize EchoScore and quality tier;
8. if the identity is not owned, add it to the collection;
9. if the identity is already owned, award tier-based duplicate currency and resolve the retained copy using §8;
10. for a batch, group repeated identities and resolve them together rather than sequentially;
11. persist unresolved player-choice frontiers as one pending settlement until accepted.

Identity selection and magnitude selection must be deterministic from the authoritative acquisition RNG/state where deterministic replay/audit is required.

Content/flavor changes must never silently alter an existing identity's mechanical stat keys or owned magnitude roll.

---

## 17. Collection surface and equipped Echo sets

The player-facing collection surface should be named **Echoes**, not `Inventory`.

### 17.1 Collection grid

The Echoes screen uses the same general card language as reward presentation and supports:

- grid presentation;
- search by dialogue line/content metadata where indexed;
- search/filter by mechanical effect/stat key;
- multi-select mechanical filters, e.g. show every Echo containing `Offensive Pressure` plus one or more additional selected effects;
- favorites;
- quality/EchoScore sorting where useful;
- ordinary identity/name search.

Unknown Echo silhouettes/completion-grid placeholders are **not** required. The collection shows what the player actually owns rather than a Pokédex of hidden empty slots.

A favorited Echo is pinned/promoted ahead of ordinary results unless the active search/filter explicitly excludes it.

### 17.2 Multiple saved equipped configurations

Players may maintain multiple named saved 7-Echo configurations. The working mechanical term may be **Echo Sets** until a better thematic player-facing name is chosen.

Each saved set references Echo **identity IDs**, not frozen copies of historical magnitude rolls.

Therefore, when duplicate resolution replaces the retained roll for an identity, every saved set containing that identity automatically uses the newly retained roll. The player does not need to re-equip an upgraded copy.

Standard PvE uses one selected seven-Echo set for the match. PvP progression/loadout standardization remains deliberately deferred.

---

## 18. Data/storage model

The intended persistent separation is:

### Echo mechanical identity

One of 12,927 rows or deterministic equivalent:

```text
echoIdentityId
shape
statKey1
optional statKey2
polarity implied by shape/slot
identity/catalogue version
```

### Echo presentation/content assignment

```text
echoIdentityId
lineId
visual recipe/reference
contentVersion
```

`lineId` is not required to be unique per Echo identity. Multiple identities may share it.

### Echo line/content record

```text
lineId
text/localization reference
source/anime metadata
speaker/character metadata
provenance/version metadata as required
```

### Owned Echo

One retained roll per owned identity:

```text
account/player id
echoIdentityId
magnitude1
optional magnitude2
favorite flag where stored here or separately
```

### Saved Echo set

```text
account/player id
set id/name
ordered or slotted echoIdentityIds (maximum 7 equipped)
```

### Gacha state

```text
account/player id
salvage currency balance
consecutive non-Lucky+ paid-pull pity counter
pity/acquisition-rules version
```

### Pending reward settlement

```text
account/player id
settlement id
source
new identities
per-identity surviving Pareto frontier candidates
default selected candidate
salvage already/atomically attributable
status
```

### Acquisition event

Transient/auditable event as needed:

```text
source
echoIdentityId
rolled magnitude(s)
EchoScore / tier
duplicate?
salvage awarded
retained/rejected/chosen result
pity state before/after where applicable
```

The game should **not** materialize the roughly hundreds of thousands of legal magnitude permutations as separate permanent collectible definitions.

---

## 19. Required stale-document migration

Any other design/integration documentation must be updated so none of the following retired assumptions remain authoritative:

- magnitude-specific finalized signatures are separate collectible Echo identities;
- an exhaustive magnitude catalogue is the player-facing item table;
- `0.5%` magnitude quantization;
- `40% / 25% / 35%` single/dual/mixed generation;
- raw catalogue cardinality directly determines shape drop frequency;
- exact finalized magnitude signature de-duplication is part of identity generation;
- owned Echoes are excluded from future acquisition rather than rerolled as duplicates;
- duplicates have no magnitude comparison / replacement choice;
- end-of-match rewards require victory;
- defeat yields zero Echo rewards;
- multiple earned candidates are rolled and only the best is retained;
- human teammates each own isolated reward accounting when they are one fixed human team;
- magnitude-derived sampling rarity is an immutable property of the Echo identity;
- a bad-but-statistically-rare result may satisfy positive-quality gacha pity;
- the store has no batch pulls, recycling, or bad-luck protection;
- identity selection inside a selected shape still needs weighting design;
- legal magnitudes are uniformly sampled;
- dialogue lines must be unique/permanently embedded one-per-Echo from day one;
- duplicate salvage price, Gacha pull price, quality bands, or duplicate-choice UI remain wholly unspecified;
- Gacha batches have a mechanical discount/bonus in V1;
- pity protects Cheater-tier rolls;
- Gacha hard pity is 100/200 pulls or remains undecided;
- match-earned Lucky+ rolls advance or reset paid-pull pity.

The canonical replacement concepts are:

```text
12,927 fixed mechanical Echo identities
+ 50% mixed / 35% dual / 15% single shape acquisition
+ uniform identity selection within selected shape
+ magnitude rerolled on every acquisition
+ EchoScore-weighted magnitude sampling
+ rolled-quality tiers / gradient card presentation
+ one retained roll per identity
+ tier-based duplicate currency
+ Pareto automatic upgrade/downgrade
+ player choice only for surviving incomparable candidates
+ pending batch settlement
+ all accumulated match rolls become drops
+ defeat preserves earned rolls
+ fixed human teams share reward accounting
+ separate/versioned dialogue-line library and assignments
+ searchable/filterable Echoes collection and saved Echo Sets
+ Gacha Store at 10 currency single / 100 currency ten-pull
+ paid-pull-only power-12 Lucky+ pity with a 50-pull hard guarantee
+ no Cheater guarantee
```

---

## 20. Remaining provisional questions

The V1 Echo mechanical/progression model is now specified closely enough to be treated as **design-complete for V1**. Remaining work is naming, content, tuning, implementation detail, and validation rather than unresolved core Echo mechanics.

Still to be tuned or finalized:

1. final thematic name of duplicate/Gacha currency;
2. final player-facing name for saved 7-Echo configurations (`Echo Sets` is the current working term);
3. exact dialogue-line sourcing/licensing/provenance workflow and initial line-library content;
4. exact visual recipe/rendering implementation and final card motion/effect polish;
5. exact special-AI reward bonuses;
6. executable/property tests for identity distribution, EchoScore-weighted magnitude sampling, quality tiers, salvage accounting, reward accounting, duplicate Pareto resolution, Origin/Echo composition, pending settlement, and Gacha pity;
7. detailed responsive/touch accessibility behavior for hover-style Echo cards and final collection/reward layout polish.

The following are **no longer open design questions** for V1:

- identity weighting inside each shape — uniform;
- base magnitude distribution — EchoScore-weighted per §5;
- quality metric — EchoScore;
- quality bands — Trash / Questionable / Decent / Not Bad / Lucky / Cheater;
- single/ten-pull Gacha price — 10 / 100;
- batch discount/bonus — none;
- duplicate salvage values — 1 / 2 / 3 / 4 / 6 / 8 by acquired roll tier;
- pity qualification — Lucky or above (`EchoScore >= 1.00`);
- pity shape — power-12 nonlinear rescue curve;
- hard pity — the 50th consecutive non-Lucky+ paid pull is guaranteed Lucky-or-better;
- Gacha pity scope — paid pulls only; match rewards neither advance nor reset it;
- Cheater pity — none;
- batch pity behavior — sequential pulls sharing one counter;
- incomparable duplicate UI — only surviving Pareto-frontier candidates are shown;
- unresolved-result persistence — pending settlement until accepted;
- dialogue uniqueness — not required; line assignments may be shared/versioned;
- collection concept — searchable/filterable/favoritable Echo card grid with multiple saved equipped sets and no unknown silhouettes.

These are tuning/content/integration tasks rather than reasons to reopen the accepted **12,927 stable mechanical identities + rerolled score-weighted magnitudes + duplicate progression + all-earned-roll rewards + Gacha Store** architecture.