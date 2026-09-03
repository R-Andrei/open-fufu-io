# Open Fufu — Provisional Echo Catalogue Contract

## Status

This file is the **provisional working contract for Echo identity, acquisition, rolled quality, duplicate handling, match rewards, generated naming/presentation, collection behavior, storage boundaries, and Gacha Store behavior**, analogous to `ORIGIN_TRAIT_CATALOGUE.md` for Origins.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical integration authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

Nothing in this file authorizes gameplay implementation.

The values below are provisional V1 values and may be retuned through development, simulation, balance testing, or playtesting without changing the broader Echo design philosophy.

Current invariants:

- Echoes are collectible mechanical modifiers with **deterministically generated anime-themed item names**.
- V1 Echoes do **not** carry authored anime dialogue/voice-line content. Anime dialogue/reference content is reserved for the much smaller Origin-trait / Official-Origin content surface where it is practical and meaningful; Echo dialogue may be revisited after V1 only as a future presentation expansion.
- Standard PvE equipped set size is **7 Echoes**.
- An Echo **mechanical identity** has fixed:
  - identity ID;
  - shape;
  - one or two concrete stat+scope keys;
  - polarity implied by its shape/slot.
- Modifier **magnitudes are not part of Echo identity**. They are rolled again whenever that identity is acquired.
- Generated-name character ownership and stat-word components are deterministic/stable for an identity under a naming version; magnitude descriptors vary with the currently retained roll.
- An account/player owns at most **one retained magnitude configuration per Echo identity**.
- Echoes specialize/tune a build; they do not normally introduce Origin-scale rule transformations, hard capabilities, alternate spawn topology, structure-count rules, free structures, or similar mechanics.
- Build-specific value may differ dramatically from generic rolled quality.
- Strong clean rolls should feel exceptional.
- Acquiring a duplicate Echo always produces duplicate/Gacha currency even if the newly rolled copy replaces the currently retained copy.
- The canonical duplicate/Gacha currency is **Middle Fingers** (`1 Middle Finger`, plural `Middle Fingers`).
- Scalar EchoScore is allowed for roll sampling, presentation, sorting, pity qualification, and salvage bands, but **never overrides Pareto duplicate choice**.
- Paid Gacha pity guarantees Lucky-or-better by the 50th consecutive non-Lucky+ pull using the accepted power-12 rescue curve; match drops neither advance nor reset that pity state, and Cheater rolls are never guaranteed.
- The public source repository may contain the reusable Echo mechanics, naming grammar/configuration, data contracts, and safe presentation assets/configuration. Production account/progression state and other granular live records remain runtime/private data.

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

Order does not create a new identity. `A+B` and `B+A` are the same identity. The same concrete key may not appear twice.

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

The production registry should be deterministically derivable/materializable from the versioned concrete-key catalogue and shape rules rather than maintained as 12,927 hand-authored source-code constants. The resulting identities may be materialized as ordinary runtime database rows for indexing, joins, and persistence.

Generated display names are **not** 12,927 hand-authored rows. They are derived from identity + retained roll + versioned naming configuration as defined in §7.

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

Magnitude is rolled **when an Echo identity is acquired**, not when its permanent identity is created. The same Echo identity may therefore be seen many times with different magnitude configurations.

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

The accepted magnitude increment is **1 whole percentage point**. There are no `0.5%` Echo magnitude rolls.

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

With the current 93-key/maxima registry and the accepted `50/35/15` shape mix, deterministic enumeration gives an overall natural **Lucky-or-better rate of approximately 2.50%**, or roughly one qualifying roll per 40 acquisitions before pity.

---

## 6. Acquisition shape and identity selection

The number of registered identities in a shape does **not** determine how often that shape drops.

Every ordinary acquisition first selects the Echo shape using the accepted provisional distribution:

```text
Mixed positive/harmful: 50%
Dual positive:          35%
Single positive:        15%
```

After shape selection:

> **Every registered identity inside the selected shape has equal probability.**

Therefore:

```text
single selected → uniform pick among 93 identities
dual selected   → uniform pick among 4,278 identities
mixed selected  → uniform pick among 8,556 identities
```

There is no V1 stat-family weighting, scope protection, collection-completion weighting, owned/unowned weighting, or hidden synergy weighting. Only after the identity is selected are its legal magnitudes sampled using §5.

The shape probabilities and magnitude-weight curve are versioned balance data and are not stored redundantly on each Echo identity.

---

## 7. Generated names, flavor, and visual identity

V1 Echoes use a **deterministic generated-name grammar** rather than authored dialogue-line assignments.

The system is intentionally small enough to author and maintain directly: a modest character pool, a stat-token dictionary for the existing concrete Echo keys, twelve universal magnitude descriptors, and a few fixed grammar templates can name the entire 12,927-identity space and every retained magnitude roll.

The generated name is flavor/presentation. The card still shows the exact mechanical modifier text and percentages; players never need to infer mechanics from a joke phrase.

### 7.1 Character-owner token

Every Echo identity deterministically receives one stable anime-character possessive token such as conceptually:

```text
Bocchi's
Frieren's
Senjougahara's
Kaiki's
...
```

Character tokens come from **shape-specific pools** so the character can provide a soft flavor/readability cue for single-positive, dual-positive, or mixed identities. Exact V1 character pools remain a naming-content pass rather than a mechanical rule.

Selection must be deterministic and stable for an identity under a naming version, conceptually equivalent to a stable identity-derived hash/index into that shape's character pool. Reacquiring the same Echo identity must not randomly change the possessive character.

The character token is a presentation identity, not a claim that the character canonically owns, said, or is lore-related to the resulting phrase.

### 7.2 Stat tokens

Every concrete Echo stat+scope key maps to one stable **name token / noun phrase**. The token is a memorable flavor handle for the mechanical key, not required to be a literal English description of the stat.

The exact V1 token dictionary is intentionally **not yet assigned**. Examples discussed during design such as `Guitar Solo` were illustrative only and are not canonized to a particular stat by this contract.

Authoring direction:

- prefer one natural, memorable phrase for each concrete key;
- funny/arbitrary associations are allowed when they remain easy to recognize;
- avoid mechanical-sounding scope-prefix assembly such as `Amazing Naval Guitar Solo` merely because a key happens to be Warship-scoped;
- shared helper vocabulary may be used internally where it produces a good phrase, but final player-facing tokens should read like deliberately authored phrases rather than concatenated schema labels;
- per-concrete-key overrides are always allowed and are preferred over awkward generic composition.

The card's exact mechanical stat text remains authoritative regardless of token wording.

### 7.3 Universal magnitude descriptors

Magnitude descriptors are universal across all Echo stats and are based on **beneficial/harmful polarity plus absolute rolled magnitude**, not blindly on the arithmetic sign printed by the underlying stat.

This distinction matters because lower build cost/cooldown/time is beneficial. A beneficial `-4% build cost` therefore uses the **+4 naming descriptor `Amazing`**, while a harmful `+4% build cost` uses the **-4 descriptor `Wretched`**.

Accepted V1 descriptor table:

| Naming magnitude | Descriptor |
| ---: | --- |
| **-6** | **Catastrophic** |
| **-5** | **Cursed** |
| **-4** | **Wretched** |
| **-3** | **Dreadful** |
| **-2** | **Shoddy** |
| **-1** | **Questionable** |
| **+1** | **Decent** |
| **+2** | **Good** |
| **+3** | **Great** |
| **+4** | **Amazing** |
| **+5** | **Fantastic** |
| **+6** | **Absurd** |

These words describe the individual rolled modifier magnitude for naming. They are **not EchoScore tiers** and do not replace Trash / Questionable / Decent / Not Bad / Lucky / Cheater quality classification.

### 7.4 Shape grammars

Accepted V1 naming templates:

**Single positive**

```text
<Character>'s <positive descriptor> <stat token>
```

Example form:

```text
Bocchi's Fantastic Guitar Solo
```

**Dual positive**

```text
<Character>'s <descriptor1> <stat token1> of <descriptor2> <stat token2>
```

Example form:

```text
Senjougahara's Amazing Beat Saber Highscore of Fantastic Height
```

Because dual-positive mechanical identity is unordered, presentation order must be deterministic (for example stable concrete-key order) so the same identity does not flip between `A of B` and `B of A`.

**Mixed positive / harmful**

```text
<Character>'s <positive descriptor> <positive stat token> with a side of <negative descriptor> <harmful stat token>
```

Example form:

```text
Kaiki's Fantastic Guitar Solo with a side of Wretched Flower Field
```

The positive component always appears first and the harmful component second.

### 7.5 Stable identity components versus roll-dependent name

The separation is:

```text
Echo mechanical identity + naming version
→ stable character-owner token
→ stable stat token(s)
→ stable shape grammar/order

retained magnitude roll
→ magnitude descriptor(s)
→ final generated display name
```

Therefore the **same Echo identity may legitimately have a different full display name after a duplicate upgrade** because its magnitude adjectives changed.

Example conceptually:

```text
same identity: Kaiki + Tank Damage / harmful Population Growth

old retained roll:
Kaiki's Good <Tank-Damage Token> with a side of Wretched <Population-Growth Token>

new retained roll:
Kaiki's Fantastic <Tank-Damage Token> with a side of Questionable <Population-Growth Token>
```

The stable character/stat words make the underlying duplicate recognizable while the adjectives visibly reflect the retained roll.

### 7.6 Naming version and storage

Names should be generated on demand from a versioned naming configuration rather than stored as 12,927 hand-authored strings.

Conceptually:

```text
EchoNamingConfig
- namingVersion
- shapeCharacterPools
- statTokens / concrete-key overrides
- magnitudeDescriptors
- grammar templates / ordering rules
```

Historical presentation/replays need only bind the naming version when reproducing the historical wording matters.

### 7.7 Visual identity and rolled-quality treatment

An Echo identity may also have a stable/versioned **base visual recipe** suitable for card presentation, preferably deterministic/shared rather than requiring 12,927 bespoke artworks.

The key separation is:

```text
mechanical Echo identity + naming/visual version
→ determines the recognizable item components

retained magnitude roll
→ changes magnitude descriptors in the generated name
→ determines EchoScore / quality family / visual intensity
```

A Questionable and Cheater acquisition of the same Echo remain the same mechanical identity and retain the same character/stat-token identity, while both the magnitude adjectives and quality treatment may differ.

---

## 8. Owned Echoes and duplicate acquisition

An account/player retains at most **one magnitude configuration for each Echo identity**. Receiving an identity already owned is a **duplicate acquisition**.

A duplicate always grants the configured Middle Fingers regardless of whether the new copy replaces the old copy, the old copy is retained, or the new copy is an exact mechanical tie.

### 8.1 Strict automatic upgrade

A new copy is an automatic upgrade when it is at least as good on **every modifier axis** and strictly better on at least one. For harmful modifiers, a smaller harmful magnitude is better.

### 8.2 Strict automatic downgrade

A new copy is automatically rejected/salvaged when it is no better on every axis and strictly worse on at least one. The duplicate Middle Fingers are still awarded.

### 8.3 Incomparable / player-choice duplicate

If one relevant axis improves while another worsens, the game does **not** collapse the comparison into one aggregate score. The player chooses which copy to retain even if EchoScore considers one copy numerically superior.

### 8.4 Multiple duplicates in one reward batch

For several copies of the same identity:

1. group all newly acquired copies by Echo identity;
2. include the currently retained copy when one exists;
3. eliminate all copies strictly dominated by another candidate;
4. compute the remaining Pareto frontier;
5. if exactly one candidate remains, retain it automatically;
6. if multiple incomparable candidates remain, ask the player to choose one;
7. award Middle Fingers for every duplicate acquisition independently of which candidate is retained.

The player-facing choice UI must show **only candidates that survive this automatic filtering**.

### 8.5 Default selection and reward-settlement UI

Reward settlement is presented as a batch rather than one modal per drop.

For a picker group:

- the current owned copy is first and selected by default whenever it remains on the Pareto frontier;
- strictly dominated current/new copies are not shown as selectable alternatives;
- if the current copy is dominated and multiple incomparable new candidates remain, default to the surviving candidate with highest EchoScore, using a stable deterministic tie-break for exact-score ties;
- this default is a convenience only and does **not** redefine Pareto superiority.

Reward results are persisted as a **pending settlement** until accepted. Closing/reconnecting must not lose the reward batch.

V1 should not allow another reward-bearing match or additional Gacha Store pulls while an unresolved pending settlement exists.

---

## 9. EchoScore quality tiers and card presentation

Echo **identity** and Echo **rolled instance quality** are separate concepts.

The same identity may therefore be Questionable on one acquisition and Cheater on a later acquisition while remaining mechanically the same item. Its generated magnitude adjectives may also change with the retained roll as described in §7.

### 9.1 Accepted V1 quality tiers

| Quality tier | EchoScore |
| --- | ---: |
| **Trash** | `< -0.50` |
| **Questionable** | `-0.50 ≤ S < 0.50` |
| **Decent** | `0.50 ≤ S < 0.75` |
| **Not Bad** | `0.75 ≤ S < 1.00` |
| **Lucky** | `1.00 ≤ S < 1.25` |
| **Cheater** | `S ≥ 1.25` |

These are **rolled-quality tiers**, not permanent identity rarity classes. Under the current shape/maxima rules, Cheater rolls emerge only from sufficiently strong dual-positive rolls as a consequence of the score/magnitude system.

### 9.2 Border gradient and quality treatment

Target direction:

```text
Trash         → dark gray
Questionable  → bright gray through common white
Decent        → pale through stronger yellow
Not Bad       → yellow-green through green
Lucky         → light blue through stronger blue
Cheater       → violet through intense pink/purple
```

Questionable should deliberately feel dull and ordinary: muted gray/white border, no colored aura, no particles, no special glow.

Lucky cards receive a restrained animated blue glow/light effect.

Cheater should be the opposite extreme: bright pink/violet plus intentionally excessive premium presentation, potentially including animated rainbow/radiant/sunray/lens-ray-like beams outside the card on hover/focus.

### 9.3 Card interaction

Collapsed/unhovered cards should prioritize:

- visual/icon;
- generated Echo name;
- quality border;
- compact stat preview.

Hover/focus may enlarge the card and use subtle cursor-driven tilt/parallax/rotation. Expanded presentation should expose:

- full modifier stats;
- exact EchoScore;
- quality-tier tag;
- generated-name components where useful;
- larger visual/icon;
- animated tier effects.

Presentation must remain usable without hover on touch/non-pointer interfaces. No mechanically necessary information may exist only behind pointer hover.

### 9.4 EchoScore never decides incomparable ownership

Score tiers, color, sorting, pity, and Middle Fingers salvage are allowed to use EchoScore. Duplicate retention still follows §8.

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

Exact same-calculation percentages follow the canonical additive-percentage rule unless a specific mechanic defines otherwise.

For P43, the Heavy-Artillery transformation establishes the Tank chassis first; Tank-scoped Echo percentages then specialize that transformed profile. Nothing in the Echo layer changes the authored P43 reload cadence or P44 footprint unless a future separately accepted rule explicitly says so.

---

## 11. Provisional 75%-optimal stress test

The working balance rule for Echo maxima remains:

> When evaluating one Echo stat, assume a highly optimized player can fill all 7 slots with retained Echoes averaging **75% of that stat's single-Echo maximum**, then combine that loadout with the strongest relevant legal Origin effects. This is not the expected ordinary loadout; it is a safety/stress target.

For a stat maximum `M`:

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

Echoes may partially improve or worsen a numeric stat that an Origin also modifies, but the Origin rule remains the underlying faction identity.

For V1 content scope, **authored anime dialogue/reference lines belong to Origin traits and Official Origins rather than Echoes**. This is a content-production boundary, not a mechanical incompatibility rule.

---

## 13. Match reward roll pool

End-of-match Echo rewards use an accumulated **reward roll pool** beginning at `0`.

### 13.1 Qualifying opponent elimination

Every qualifying opponent defeated while the player's reward entity remains active contributes:

```text
+1 Echo roll
```

The roll is granted regardless of who actually defeated that opponent. Fixed teammates/allies never count as qualifying opponents.

### 13.2 AI difficulty bonuses

A special higher-difficulty AI preset may grant:

```text
+1 ordinary opponent-defeat roll
+ that preset's individually authored difficulty bonus
```

The Echo system does **not** define a universal difficulty multiplier. Exact special-AI bonuses are assigned by the Official-AI preset design and stored as versioned preset/reward data.

### 13.3 Victory bonus

Victory contributes:

```text
+5 Echo rolls
```

### 13.4 Defeat does not erase earned rewards

At match end, the player/reward entity receives every roll accumulated before its run ended. Victory is not required to receive already-earned Echoes.

### 13.5 All rolls become actual item drops

Every accumulated roll produces an Echo acquisition. There is no keep-best filter.

---

## 14. Reward entities and human teams

### 14.1 Solo

In solo play, the human player is the reward entity. Opponent eliminations count while that player remains active; later unrelated eliminations after solo elimination do not grow that pool.

### 14.2 Fixed human team

When multiple humans begin on the same fixed team, the **human team is the reward entity**.

- reward accumulation remains active until the human team as a whole is eliminated or the match ends;
- early human elimination does not end that human's eventual team reward;
- every human teammate receives the **full** final pool, not a divided share;
- victory adds the +5 pool bonus for every human teammate's identical final pool.

Fixed allied AI do not become additional human reward recipients.

---

## 15. Gacha Store and duplicate economy

The Echo store is intentionally framed as a **Gacha Store**. Its currency is **Middle Fingers**.

### 15.1 Accepted V1 purchase sizing

```text
1 pull   = 10 Middle Fingers
10 pulls = 100 Middle Fingers
```

There is no V1 batch discount or bonus roll. A 10-pull is mechanically ten sequential singles sharing the same pity state.

### 15.2 Duplicate salvage values

| Duplicate roll tier | Middle Fingers |
| --- | ---: |
| Trash | **1** |
| Questionable | **2** |
| Decent | **3** |
| Not Bad | **4** |
| Lucky | **6** |
| Cheater | **8** |

The same salvage table applies regardless of whether the duplicate came from a match reward or Gacha.

### 15.3 Lucky-or-better qualification

```text
Lucky-or-better ⇔ EchoScore >= 1.00
```

There is **no Cheater pity**, no minimum Cheater frequency, and no mechanic that progressively guarantees `EchoScore >= 1.25`.

### 15.4 One shared sequential pity counter

Pity belongs only to **paid Gacha Store pulls**. Singles and 10-pull batches use the same sequential pity state. Match reward acquisitions neither advance nor reset Gacha pity.

### 15.5 Accepted power-12 soft pity

Let:

```text
H = 50
n = consecutive non-Lucky+ paid pulls already suffered since the last reset
P0 = natural Lucky+ probability under the ordinary acquisition generator
```

Use:

```text
r(n) = (n / 49)^12
P_lucky+(n) = P0 + (1 - P0) × r(n)
```

for `0 <= n <= 49`.

One clean implementation performs the normal roll first, then applies only the additional rescue probability needed to reach the target chance; rescue samples from the ordinary acquisition distribution conditioned on `EchoScore >= 1.00`.

Representative next-pull Lucky+ chances under the current `P0 ≈ 2.50%`:

| Consecutive misses before next pull | Lucky+ chance on next pull |
| ---: | ---: |
| 0 | **2.50%** |
| 20 | **~2.50%** |
| 30 | **~2.77%** |
| 35 | **~4.22%** |
| 40 | **~11.04%** |
| 45 | **~37.59%** |
| 47 | **~61.63%** |
| 48 | **~78.63%** |
| 49 | **100% on the 50th pull** |

### 15.6 Accepted 50-pull hard guarantee

A player can never complete 50 consecutive paid Gacha pulls without receiving at least one Lucky-or-better result. Any natural or rescued Lucky/Cheater result resets the paid-pull pity counter to zero.

The guarantee is Lucky-or-better only and does not guarantee Cheater.

---

## 16. Generation / acquisition procedure

A normal Echo acquisition conceptually proceeds as follows:

1. determine acquisition source (`match`, `gacha`, future source);
2. select Echo shape using `50% mixed / 35% dual / 15% single` unless the source explicitly defines another approved table;
3. select one registered Echo identity uniformly within that shape;
4. enumerate and EchoScore-weight the legal integer magnitude configuration(s) for that identity;
5. sample the ordinary rolled instance;
6. for a paid Gacha pull, apply the current Lucky+ pity state;
7. finalize EchoScore, quality tier, and generated display name from the naming version + retained/acquired magnitudes;
8. if the identity is not owned, add it to the collection;
9. if already owned, award tier-based Middle Fingers and resolve the retained copy using §8;
10. for a batch, group repeated identities and resolve them together;
11. persist unresolved player-choice frontiers as one pending settlement until accepted.

Identity selection and magnitude selection must be deterministic from authoritative acquisition RNG/state where deterministic replay/audit is required. Naming is deterministic presentation and must never alter an identity's mechanical stat keys or owned magnitude roll.

---

## 17. Collection surface and equipped Echo sets

The player-facing collection surface should be named **Echoes**, not `Inventory`.

### 17.1 Collection grid

The Echoes screen supports:

- grid/card presentation;
- search by generated Echo name, character-owner token, or stat-token text where useful;
- search/filter by mechanical effect/stat key;
- multi-select mechanical filters;
- favorites;
- quality/EchoScore sorting;
- ordinary identity search/debug visibility where appropriate.

Unknown Echo silhouettes/completion-grid placeholders are **not** required. The collection shows what the player actually owns rather than a Pokédex of hidden empty slots.

A favorited Echo is pinned/promoted ahead of ordinary results unless the active search/filter explicitly excludes it.

### 17.2 Multiple saved equipped configurations

Players may maintain multiple named saved 7-Echo configurations. The accepted provisional V1 player-facing term is **Echo Sets**.

Each Echo Set references Echo **identity IDs**, not frozen copies of historical magnitude rolls. When duplicate resolution replaces the retained roll for an identity, every Echo Set containing that identity automatically uses the newly retained roll.

Standard PvE uses one selected seven-Echo set for the match. PvP progression/loadout standardization remains deliberately deferred.

---

## 18. Data/storage model

### 18.1 Public code/config versus private/runtime data

The public repository defines **how Echoes work** and may directly contain the small reusable/versioned generated-naming configuration. It does not serve as the production account database.

Public source may contain:

```text
semantic stat/type definitions
data schemas and migrations
deterministic identity-generation/materialization logic
EchoScore and acquisition algorithms
Pareto/duplicate/reward/Gacha/pity algorithms
Echo naming grammar + magnitude descriptor table
versioned character pools / stat-token configuration
validation tooling
UI/rendering implementation
synthetic/sample test fixtures
```

Runtime/private data supplies granular live/account state such as active balance/config rows where deployment chooses data-driven tuning, materialized Echo identities where useful, owned Echo rolls, Echo Sets, Middle Fingers balances, pity state, pending settlements, and acquisition/progression records.

V1 has **no production Echo anime-dialogue corpus or Echo-to-line assignment table**.

### 18.2 Intended persistent/configuration concepts

#### Echo mechanical identity

One of 12,927 rows or deterministic equivalent:

```text
echoIdentityId
shape
statKey1
optional statKey2
polarity implied by shape/slot
identity/catalogue version
```

#### Echo naming configuration

```text
namingVersion
shapeCharacterPools
concrete stat-key → stat token mapping
magnitude descriptor table
grammar templates / deterministic ordering rules
```

This configuration is small enough to be ordinary versioned game data rather than 12,927 authored names.

#### Echo visual recipe/configuration

A deterministic/versioned visual seed/recipe may be derived from the identity or stored compactly where needed. It must not require one bespoke artwork row per magnitude permutation.

#### Owned Echo

```text
account/player id
echoIdentityId
magnitude1
optional magnitude2
favorite flag where stored here or separately
```

#### Saved Echo Set

```text
account/player id
set id/name
ordered or slotted echoIdentityIds (maximum 7 equipped)
```

#### Gacha state

```text
account/player id
Middle Fingers balance
consecutive non-Lucky+ paid-pull pity counter
pity/acquisition-rules version
```

#### Pending reward settlement

```text
account/player id
settlement id
source
new identities
per-identity surviving Pareto frontier candidates
default selected candidate
Middle Fingers already/atomically attributable
status
```

#### Acquisition event

```text
source
echoIdentityId
rolled magnitude(s)
EchoScore / tier
duplicate?
Middle Fingers awarded
retained/rejected/chosen result
pity state before/after where applicable
```

The game should **not** materialize the roughly hundreds of thousands of legal magnitude permutations as separate permanent collectible definitions, nor persist generated display-name strings when they can be reproduced from identity + retained roll + naming version.

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
- legal magnitudes are uniformly sampled;
- Echoes require anime dialogue-line assignments, MAL harvesting, quote/subtitle import, or one unique authored content line per identity;
- generated Echo names are stored as 12,927 manually authored strings;
- generated stat names are formed by mechanically prefixing schema scopes into awkward phrases by default;
- duplicate/Gacha currency still needs a final name;
- saved seven-Echo configurations still need a V1 name.

The canonical replacement concepts are:

```text
12,927 fixed mechanical Echo identities
+ 50% mixed / 35% dual / 15% single shape acquisition
+ uniform identity selection within selected shape
+ magnitude rerolled on every acquisition
+ EchoScore-weighted magnitude sampling
+ rolled-quality tiers / gradient card presentation
+ one retained roll per identity
+ deterministic generated names from character + stat token(s) + magnitude descriptor(s)
+ stable identity-level character/stat words; roll-dependent adjectives
+ universal -6..+6 descriptor table
+ Single / Dual / Mixed grammar templates, including "with a side of" for Mixed
+ no V1 authored anime dialogue/voice-line content on Echoes
+ Middle Fingers duplicate/Gacha currency
+ tier-based Middle Fingers salvage
+ Pareto automatic upgrade/downgrade
+ player choice only for surviving incomparable candidates
+ pending batch settlement
+ all accumulated match rolls become drops
+ defeat preserves earned rolls
+ fixed human teams share reward accounting
+ searchable/filterable Echoes collection and provisional Echo Sets
+ Gacha Store at 10 Middle Fingers single / 100 Middle Fingers ten-pull
+ paid-pull-only power-12 Lucky+ pity with a 50-pull hard guarantee
+ no Cheater guarantee
```

---

## 20. Remaining work / design closure

The V1 Echo **mechanical and generated-naming architecture is design-complete**. Remaining Echo work is implementation, naming-content authoring, validation, visual production, and later playtest tuning.

Deferred implementation/content work includes:

1. author the exact shape-specific character pools and concrete-key stat-token dictionary; examples used during design such as `Guitar Solo` remain illustrative until deliberately assigned;
2. implement/version the deterministic naming generator and tests for stable identity components, polarity-aware descriptors, deterministic dual ordering, and roll-dependent adjective changes;
3. implement the concrete SQLite/account schema/indexes/migrations for owned rolls, Echo Sets, Middle Fingers, pity, settlements, and audit events;
4. implement the exact visual recipe renderer, card motion, quality effects, and responsive/touch behavior consistent with the accepted presentation rules;
5. implement executable/property tests for identity generation/distribution, EchoScore-weighted magnitude sampling, quality tiers, Middle Fingers accounting, reward accounting, duplicate Pareto resolution, Origin/Echo composition, pending settlement, saved-set propagation, generated naming, and Gacha pity;
6. assign exact special-AI Echo reward bonuses when those AI presets are designed; this is an AI-system/preset decision, not an unresolved Echo mechanic;
7. later playtest-retune versioned numerical values if real play provides a reason.

The following are no longer open design questions for V1:

- identity weighting inside each shape — uniform;
- base magnitude distribution — EchoScore-weighted per §5;
- quality metric — EchoScore;
- quality bands — Trash / Questionable / Decent / Not Bad / Lucky / Cheater;
- single/ten-pull Gacha price — 10 / 100 Middle Fingers;
- batch discount/bonus — none;
- duplicate salvage values — 1 / 2 / 3 / 4 / 6 / 8 Middle Fingers by acquired roll tier;
- pity qualification — Lucky or above (`EchoScore >= 1.00`);
- pity shape — power-12 nonlinear rescue curve;
- hard pity — the 50th consecutive non-Lucky+ paid pull is guaranteed Lucky-or-better;
- Gacha pity scope — paid pulls only; match rewards neither advance nor reset it;
- Cheater pity — none;
- batch pity behavior — sequential pulls sharing one counter;
- incomparable duplicate UI — only surviving Pareto-frontier candidates are shown;
- unresolved-result persistence — pending settlement until accepted;
- V1 Echo authored dialogue/voice-line content — none; anime-line/reference effort is reserved for Origin traits/Official Origins and may be revisited for Echoes after V1;
- generated naming grammar — character possessive + magnitude descriptor(s) + stat token(s), with shape-specific templates;
- Mixed connector — `with a side of`;
- magnitude descriptor vocabulary — Catastrophic / Cursed / Wretched / Dreadful / Shoddy / Questionable / Decent / Good / Great / Amazing / Fantastic / Absurd for naming magnitudes `-6..-1/+1..+6`;
- descriptor semantics — beneficial/harmful polarity, not naive arithmetic sign;
- duplicate/Gacha currency name — Middle Fingers;
- saved configuration name — Echo Sets provisionally;
- visual identity rule — stable identity components plus roll-dependent naming adjectives and quality treatment;
- collection concept — searchable/filterable/favoritable Echo card grid with multiple saved equipped sets and no unknown silhouettes.

These implementation/content tasks are not reasons to reopen the accepted **12,927 stable mechanical identities + rerolled score-weighted magnitudes + deterministic generated naming + duplicate progression + all-earned-roll rewards + Middle Fingers Gacha Store** architecture.