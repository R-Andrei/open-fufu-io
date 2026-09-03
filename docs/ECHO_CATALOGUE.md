# Open Fufu — Provisional Echo Catalogue Contract

## Status

This file is the **provisional working contract for V1 Echo generation/content**, analogous to `ORIGIN_TRAIT_CATALOGUE.md` for Origins.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical integration authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

Nothing in this file authorizes gameplay implementation.

The rules, intervals, shape probabilities, scoring curve, and generation procedure below are the **accepted provisional V1 baseline**. They are intended to be good enough for implementation/testing and may be revised through development, simulation, balance testing, or playtesting without changing the broader Echo design philosophy.

Current first-version invariants:

- Echoes are collectible anime/JRPG dialogue-line modifiers.
- Standard PvE loadout size is **7 Echoes**.
- An Echo carries **one or two deterministic numeric modifiers**.
- Echoes specialize/tune a build; they do not normally introduce Origin-scale rule transformations, hard capabilities, alternate spawn topology, structure-count rules, free structures, or similar mechanics.
- Echoes may be genuinely mediocre, awkward, or bad for a generic build. The generator is **not required to make every Echo balanced or desirable**.
- Build-specific value may differ dramatically from inherent/global rarity. A nominally mediocre mixed Echo may be excellent for a controller that ignores its drawback.
- Strong clean Echoes should feel genuinely exceptional and rare.

---

## 1. V1 allowed Echo modifier pool

The pool below is the accepted V1 candidate set after intentionally removing effects that overlap too heavily with Origins or would too easily erase defining Origin rules.

`City Growth contribution` is one stat and appears only once below; it is not duplicated as both a Population-family and City-family identifier.

Scoped definitions are selected as one stat definition first and only then resolve their scope, so adding more terrain, structure, or mobile-unit scopes does not make that stat family intrinsically more common.

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

`Industrial FFY` is the sole ordinary Echo axis for industrial/Factory-generated FFY events. The former separate `Factory FFY-event effectiveness` modifier is intentionally removed as redundant rather than allowing two overlapping Echo definitions to tune the same Factory event value.

---

## 2. Modifier identity and polarity

An Echo modifier is conceptually:

```text
stat identity
+ optional scope
+ polarity
+ mechanical signed value
```

**Polarity** is distinct from mathematical sign because lower values are beneficial for costs, construction time, and cooldowns.

Examples:

```text
+5% Population Growth
-4% Fort build cost          ← beneficial
+4% Fort build cost          ← harmful
-3% SAM recharge time        ← beneficial
+3% SAM recharge time        ← harmful
+5% Warship range            ← beneficial
-5% Warship range            ← harmful
```

Rarity scoring uses beneficial/harmful polarity. Simulation arithmetic uses the actual mechanical signed value.

### 2.1 Beneficial and harmful meanings

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

`Industrial FFY` applies to ordinary industrial FFY events, including the Factory-driven industrial/train FFY event values defined by the canonical structure registry. There is no second Factory-specific FFY Echo layer.

Factory repair-radius/rate Echoes affect the canonical Tank/Heavy-Artillery repair service provided by Factories. They do not alter simultaneous repair capacity, which remains a discrete Factory-level property rather than an Echo stat.

A Tank-scoped mobile-unit Echo applies to the faction's canonical Tank chassis **after Origin transformation**. If P43 transforms Tanks into Heavy Artillery, Tank cost/speed/range/damage/health Echoes specialize the resulting Heavy-Artillery profile; there is no separate Heavy-Artillery Echo scope.

For the Tank scope:

- `Attack range` modifies the unit's ordinary anti-armor and Population-attack range, and Train-interception range when that capability exists.
- `Damage` modifies numeric anti-armor HP damage and Population damage. It does not alter the binary Train-destruction result or P44's radioactive neutralization footprint.
- `Movement speed` modifies final Tank/Heavy-Artillery movement after the Origin-established chassis profile and terrain movement rules.
- `Maximum health` modifies the chassis health pool.
- `FFY purchase cost` modifies the final FFY cost of the purchased Tank/Heavy Artillery after the ordinary active-count curve and Origin purchase-cost transformation are established.

Tank/Heavy-Artillery firing cooldown/reload is deliberately **not** an Echo stat. In particular, Echoes cannot shorten P43 Heavy Artillery's 12-second reload or thereby erase its intended vulnerability window. P44 radioactive footprint radius/cell count is likewise not an Echo stat.

Observation-radius Echoes modify the Observation Post's effective completed-level radius. Under P49, where Observation Posts become counterintelligence blackout structures, that same numeric radius modifier naturally specializes the blackout radius rather than restoring ordinary observation.

Fort-pressure Echoes specialize the Fort's effective pressure magnitude. Under P50, the Fort's mirrored offensive field uses that same effective Fort-pressure magnitude. Command-Post-pressure Echoes similarly specialize the Command Post's effective pressure magnitude; under P51, the mirrored defensive field uses that same effective magnitude. Cross-type Fort/Command overlap still follows the Origin catalogue's diminishing field-composition rule.

If an Origin makes an underlying stat irrelevant, an Echo may become partially or wholly inert. This is legal and does not create hidden compatibility rules. For example, a Warship-FFY-cost Echo is irrelevant to an Origin whose Warships cost `0 FFY` and consume Population instead.

---

## 3. Provisional single-Echo maximum magnitudes

Beneficial and harmful variants use the **same absolute maximum interval** for a given stat. If a stat may roll `+M` beneficially, it may also roll the equivalent full-strength harmful magnitude `-M` (or `+M` for inverse stats such as costs/cooldowns).

The values below are accepted provisional V1 maxima.

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

### 3.1 Quantization

The provisional V1 display/mechanical increment is **0.5 percentage points**.

A modifier never displays or stores a meaningless `0%` roll. The lowest nonzero generated magnitude is one quantization step.

Examples for a stat with `M = 5%`:

```text
0.5%, 1.0%, 1.5%, ... 5.0%
```

---

## 4. Echo shapes

Exactly three mechanical Echo shapes exist in the provisional V1 generator.

### 4.1 Single positive

One beneficial modifier.

```text
+X% A
```

Its modifier may use the full `100%` single-Echo maximum `M` for that stat.

Single-positive Echoes are the strongest hyper-specialization pieces because one stat can reach its full clean maximum.

### 4.2 Dual positive

Two beneficial modifiers.

```text
+X% A
+Y% B
```

Each modifier is capped at approximately **55% of that stat's ordinary single-Echo maximum**.

The intended normalized package ceiling is therefore approximately:

```text
0.55 + 0.55 = 1.10
```

This gives dual-positive Echoes a small total-power premium over a perfect single-positive Echo while preventing them from always dominating single-stat specialization.

The two magnitudes are rolled independently inside their reduced intervals.

### 4.3 Mixed positive / harmful

One beneficial modifier and one harmful modifier.

```text
+X% A
-Y% B
```

**Both modifiers may roll at the full `100%` single-Echo maximum for their respective stats.**

The drawback is already the price of the package. Mixed Echoes do not receive the dual-positive intensity reduction.

Valid mixed examples include:

```text
+4% / -7-equivalent normalized magnitude
+1% / -full-max
+full-max / -1%
+full-max / -full-max
```

subject to each stat's actual own maximum.

A mixed Echo may therefore be excellent, neutral, mediocre, or spectacularly bad in generic power terms.

### 4.4 No negative-only shapes

The V1 generator does **not** create:

- single harmful Echoes;
- dual-harmful Echoes.

Harmful modifiers exist only as the second side of a mixed Echo.

### 4.5 Provisional shape probabilities

The accepted provisional generation mix is:

```text
Single positive: 40%
Dual positive:   25%
Mixed + / -:     35%
```

Drop frequency is subsequently reshaped substantially by the rarity-weight system; these are catalogue-generation shape probabilities, not final player-visible drop percentages.

---

## 5. Combination rules

V1 intentionally uses **almost no semantic pairing restrictions**.

Any allowed stat may appear with any other allowed stat, including:

- strongly synergistic stats;
- partially overlapping stats;
- global + scoped versions of related mechanics;
- contradictory stats;
- completely unrelated / strategically awkward stats.

Examples that are all legal:

```text
+Population Growth
+City Growth contribution

+Warship Range
+Warship Damage

+All FFY
+Industrial FFY

+Global Offensive Pressure
+Highland Offensive Pressure

+Population Growth
-Warship Speed

+Population Growth
-City Growth contribution

+Hydrogen Bomb projectile speed
-Factory repair rate
```

The generator does not try to understand whether a pair is good for a particular build.

### 5.1 Only exact duplicate keys are forbidden on one Echo

One Echo may not contain the **exact same stat + exact same scope** twice, because that is mechanically just one larger modifier and should be normalized as such.

For example, this is not generated:

```text
+2% Warship Range
+1% Warship Range
```

But these are legal:

```text
+All-structure build-cost reduction
+Fort build-cost reduction
```

and:

```text
+Global offense
+Highland offense
```

No wider compatibility matrix exists.

---

## 6. Modifier generation

### 6.1 Deterministic identity

Mechanical generation is deterministic from identities equivalent to:

```text
EchoGeneratorVersion
EchoSeed
```

Use keyed/independent deterministic RNG streams for at least:

- mechanical package;
- rarity/derived presentation where randomization is needed;
- dialogue/flavor/visual identity.

Changing flavor-generation logic must never silently change the mechanical modifiers of an existing Echo identity/version.

### 6.2 Stat selection

Select a **stat definition first**, then select a scope if that stat is scoped.

This prevents a stat with many scopes from becoming more common merely because it expands to more concrete keys.

Provisional V1 selection uses equal weight among the allowed stat definitions in §1, then equal weight among that stat's legal scopes unless later playtesting gives a reason to author explicit weights.

For modifier #2, repeat selection independently. If the resulting exact stat+scope key equals modifier #1's exact key, deterministically reroll modifier #2 until it differs.

No other pairing reroll is performed.

### 6.3 Magnitude generation

For **single-positive** and **mixed** modifiers, independently roll one allowed quantized magnitude between the minimum nonzero step and the stat's full maximum `M`.

For **dual-positive** modifiers, independently roll one allowed quantized magnitude between the minimum nonzero step and approximately `0.55 × M`, quantized to the V1 increment.

The reduced dual-positive interval is the mechanism by which two beneficial modifiers pay for sharing one Echo slot. The generator does not first roll two full-strength stats and grant both unchanged.

### 6.4 Polarity assignment

- single-positive: modifier is beneficial;
- dual-positive: both modifiers are beneficial;
- mixed: one modifier is beneficial and one is harmful.

Mechanical sign is then derived from the stat's semantics in §2.1.

---

## 7. Normalized Echo power score

Each finalized modifier is normalized against its **single-positive full maximum**, regardless of Echo shape.

For a stat with maximum `M` and finalized absolute magnitude `x`:

```text
normalizedMagnitude = x / M
```

Then:

```text
beneficial modifier → +normalizedMagnitude
harmful modifier    → -normalizedMagnitude
```

Echo score is the sum of its signed normalized modifier powers:

```text
EchoScore = Σ signedNormalizedModifierPower
```

Examples:

```text
+5% Population Growth, M=5%
→ score +1.00

+2.5% Population Growth, M=5%
→ score +0.50

-3% Warship Range, M=3%
→ score -1.00

+5% Population Growth
-4% Fort Coverage
(both full maxima)
→ +1.00 - 1.00 = 0.00
```

A perfect dual-positive Echo has an intended ceiling around `+1.10` because each side can reach about `0.55` normalized power.

A mixed Echo spans approximately `-1.0 .. +1.0` depending on its independently rolled sides.

### 7.1 No synergy score

The rarity system does **not** attempt to score synergy, anti-synergy, conditional build value, or whether the player's Origin/controller ignores a drawback.

For example:

```text
+5% Population Growth
-4% Warship FFY cost (harmful direction example omitted here)
```

is scored from its generic modifier powers, not from whether the current player ever builds Warships.

This deliberate gap between inherent/global score and build-specific usefulness is part of the collectible design.

---

## 8. Rarity / sampling-weight curve

Rarity is **derived automatically from the generated mechanical package**. It is not manually authored for every Echo.

The most common point is **EchoScore = 0**.

Increasingly good Echoes become progressively rarer. Increasingly bad Echoes also become rarer, so the loot pool does not collapse into mostly terrible items.

Provisional V1 anchor curve:

| EchoScore | Relative sampling weight |
| ---: | ---: |
| `-1.00` | **0.03×** |
| `-0.75` | **0.05×** |
| `-0.50` | **0.10×** |
| `-0.25` | **0.50×** |
| `0.00` | **1.00×** |
| `+0.25` | **0.316×** |
| `+0.50` | **0.10×** |
| `+0.75` | **0.0316×** |
| `+1.00` | **0.010×** |
| `+1.10` | **0.0063×** |

For scores between anchors, interpolate **logarithmically in weight space**.

This makes:

- score-0 packages the modal/common center;
- mildly bad packages common but not dominant;
- spectacularly bad packages unusual curiosities rather than constant trash;
- perfect clean single-positive Echoes roughly 100× lower-weight than score-0 Echoes;
- perfect dual-positive Echoes rarer still.

### 8.1 Inherent drop probability

For a finished eligible catalogue:

```text
P(Echo_i)
= weight_i / Σ eligibleCatalogueWeights
```

This normalized full-catalogue probability is the Echo's **inherent rarity**.

If a store excludes already-owned Echoes and renormalizes the remaining table, the Echo's displayed inherent rarity remains based on the normal full eligible catalogue rather than the temporary filtered store probability.

Conventional labels such as Common/Rare/Legendary may later be derived from probability bands for presentation, but they are not manually authored mechanical rarity tiers.

---

## 9. Catalogue-generation procedure

For each deterministic candidate seed under one `EchoGeneratorVersion`:

1. derive the mechanical RNG stream;
2. roll Echo shape using the provisional 40/25/35 shape distribution;
3. select modifier #1 stat definition;
4. select modifier #1 scope if applicable;
5. roll modifier #1 magnitude from the interval appropriate to the shape;
6. assign modifier #1 polarity required by the shape;
7. if the shape has two modifiers, independently select modifier #2 stat + scope;
8. reroll modifier #2 only if it exactly duplicates modifier #1's stat+scope key;
9. independently roll modifier #2 magnitude from the interval appropriate to the shape;
10. assign modifier #2 polarity required by the shape;
11. convert polarity to actual mechanical signed values according to each stat's semantics;
12. canonicalize modifier ordering;
13. compute normalized modifier powers and `EchoScore`;
14. derive the Echo's relative sampling weight from the versioned score→weight curve;
15. compute the canonical mechanical signature from finalized stat/scope/polarity/value pairs;
16. reject an **exact duplicate mechanical signature** already admitted to this catalogue version and continue deterministic catalogue generation;
17. after the mechanical package is fixed, derive/assign dialogue, character/flavor, and visual identity from separate versioned/keyed generation data.

Two Echoes with the same stat types but different values are not duplicates. Exact finalized mechanical packages are duplicates regardless of flavor text.

The final catalogue size remains a content/deployment parameter and does not change the algorithm above.

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

Example: the Population-funded Warship Origin gives Warships approximately `0.67×` ordinary attack range. Seven 75%-quality Warship-range Echoes under the provisional `3%` maximum provide `+15.75%` total Echo range specialization:

```text
0.67 × 1.1575 ≈ 0.7755
```

The highly specialized fleet still has about **22.4% less attack range than ordinary Warships**.

For P43, the Heavy-Artillery transformation establishes the Tank chassis first; Tank-scoped Echo percentages then specialize that transformed profile. Nothing in the Echo layer changes the authored P43 reload cadence or P44 footprint unless a future separately accepted rule explicitly says so.

---

## 11. Provisional 75%-optimal stress test

The working balance rule for Echo maxima is:

> When evaluating one Echo stat, assume a highly optimized player can fill all 7 slots with Echoes averaging **75% of that stat's single-Echo maximum**, then combine that loadout with the strongest relevant legal Origin effects. This is not the expected ordinary loadout; it is a safety/stress target.

For a stat maximum `M`, the seven-slot 75%-quality single-axis contribution is:

```text
7 × 0.75 × M = 5.25M
```

Provisional stress magnitudes therefore include:

| Stat maximum | 7 slots × 75% |
| ---: | ---: |
| 3% | 15.75% |
| 4% | 21.00% |
| 5% | 26.25% |
| 6% | 31.50% |

### 11.1 Checked high-risk interactions

The following checks use simple published modifier composition as a conservative design sanity test. Some final mechanics, especially pressure-field composition and implemented FFY formulas, still require exact executable tests.

| Stress case | Approximate result | Assessment |
| --- | ---: | --- |
| `P01 + 7×75% Starting Population` | about **+39.1% absolute starting Population vs ordinary**, if Starting Population is fraction-of-final-Capacity | Strong opening specialization, but consumes all seven Echo slots and P01; provisional value retained for testing |
| `P15 + 7×75% Highland offense` | about **+67.9% Highland offense** | Large but terrain-specific and seven-slot specialized; retained |
| `P18 + P15 + 7×75% Highland offense` | rough **3.36×** baseline pressure on a Fort-supported Highland lane | Extreme, but primarily created by the already-extreme legal Origin combination (`+100%` Fort-supported offense + `+33%` Highland offense); Echoes add only bounded specialization. Flag for playtesting rather than lowering Echo maxima now |
| `P09 + P13 + 7×75% Mountain defense` | rough upper-bound around **1.83×** relevant baseline before exact Fort baseline semantics | Appropriate stress case for an intentionally hyper-defensive build; exact Fort formula must be tested later |
| `P40 + 7×75% SAM range` | about **1.736×** ordinary SAM range | Very large umbrella but requires giant-shield Origin + all seven range Echoes; still one charge under P40 |
| `P40 + 7×75% SAM cooldown reduction` | about **1.58× ordinary cooldown** | P40's doubled cooldown remains a real drawback even under extreme Echo mitigation |
| `P42 + 7×75% Warship range` | about **0.776× ordinary Warship range** | P42's defining `-33%` range weakness remains clearly intact |
| `P23 + 7×75% Warship range` | about **1.389× ordinary range** | Powerful but applies to the one-super-Warship Origin constraint; retained |
| `P30 + 7×75% Warship speed` | about **1.815× ordinary Warship speed** | Extreme pirate mobility, but P30 Warships cannot fight ships with gunfire; retained |
| `P43 + 7×75% Tank range` | Heavy-Artillery range about **52.1 cells / 1.736× ordinary Tank range** | Strong artillery specialization, but reload remains 12s and terrain barriers remain unchanged |
| `P43 + 7×75% Tank speed` | Heavy-Artillery movement remains about **0.605×** the corresponding ordinary Tank movement | Echo specialization cannot erase the defining half-speed doctrine |
| `P43 + 7×75% Tank health` | Heavy Artillery reaches about **1,262.5 HP** | A surviving baseline Tank needs six 250-damage shots rather than four, but still kills it well before the 12s artillery reload; vulnerability remains real |
| `P44 + 7×75% Tank damage` | numeric Population/anti-armor damage rises by at most **26.25%** | Radioactive 10/50-cell neutralization footprint and firing cadence remain unchanged; Echoes cannot scale the territorial erosion mechanic itself |
| `P49 + 7×75% Observation radius` | effective Observation/blackout radius about **1.21×** its Origin-established value | Strong recon/counterintel specialization, but no new visibility capability is created |
| `P25 + 7×75% Hydrogen blast area` | about **1.736×** ordinary H-bomb area | Large but weapon-specific; P25 forbids Atom/MIRV and raises H-bomb price |
| `P25 + 7×75% strategic-weapon cost reduction` | about **1.185× ordinary H-bomb cost** | Even maximum stress mitigation does not erase P25's +50% H-bomb cost |
| `P10 + 7×75% specific-warhead speed` | about **2.63× ordinary projectile speed** | High but affects delivery/interception timing rather than blast damage; retained for testing |
| `P09 + 7×75% Fort build-cost reduction` | roughly **32% cheaper** than ordinary under multiplicative composition | Safely away from free structures |
| `P41 + 7×75% City build-cost reduction` | direct-L5 City about **70% of ordinary cumulative L1→L5 cost** | Very strong dedicated City economy but still substantial cost; retained |
| `P34 + 7×75% Industrial FFY` | rough upper-bound around **2.63×** ordinary conquered-Factory event effectiveness | P34 already doubles conquered Factories; the single Industrial-FFY Echo axis adds bounded specialization without a redundant Factory-specific modifier |

### 11.2 Upgrade-cost asymptote note

P17's `0.99^S` structure-upgrade Origin trait naturally approaches very low costs at very high owned-structure counts even without Echoes. Seven 75%-quality specific-structure-upgrade Echoes add at most a `26.25%` reduction layer.

Illustrative combined factors:

```text
S = 50 structures  → ~0.446× ordinary upgrade cost
S = 100            → ~0.270×
S = 200            → ~0.099×
```

This is primarily a **P17 late-game balance question**, not evidence that the provisional Echo maximum itself is unsafe. Keep it explicitly on the playtest watch list.

### 11.3 Multi-axis conclusion

No provisional Echo maximum currently creates an obvious standalone invariant break under the 75%-optimal stress rule:

- no structure-cost stack reaches free/negative cost;
- P40's cooldown drawback remains meaningful under full mitigation;
- P42's range drawback remains meaningful under full mitigation;
- P43's half-speed/long-reload artillery identity remains meaningful because reload is not Echo-modifiable;
- P44's radioactive territorial footprint remains fixed rather than Echo-scalable;
- Starting Population is substantially increased but not multiplied into a several-fold opening advantage;
- extreme local offense/defense cases are driven mainly by deliberate Origin rule combinations and highly conditional geography rather than Echoes alone;
- the strongest economic multipliers remain scope-dependent and/or rely on already-specialized Origin mechanics.

Therefore the maxima in §3 are retained as the accepted **provisional V1 test values**.

This stress pass must be converted into executable/property tests once the exact baseline formulas for structures, FFY, terrain combat, mobile units, and strategic weapons exist.

---

## 12. Echo / Origin boundary

The following are intentionally **not** part of the normal V1 Echo pool at this stage:

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

## 13. Remaining provisional content questions

The mechanical V1 generator is now sufficiently specified for implementation/prototyping, subject to playtest tuning.

Remaining content/presentation parameters include:

1. final target catalogue size;
2. whether stat-definition/scope selection should remain fully uniform or receive small authored frequency weights after observing generated catalogues;
3. final dialogue/flavor/visual generation or curation system;
4. optional derived cosmetic rarity labels/probability bands;
5. numerical retuning of maxima, shape probabilities, or rarity anchors after simulation/playtesting;
6. final validation against exact implemented structure, FFY, terrain, combat, mobile-unit, and weapon formulas.

These are tuning/content questions rather than reasons to reopen the accepted three-shape, unrestricted-pairing, normalized-score, score-centered-rarity design.