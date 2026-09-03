# Open Fufu — Provisional Echo Catalogue Contract

## Status

This file is the **provisional working contract for Echo identity, acquisition, duplicate handling, match rewards, and gacha-store behavior**, analogous to `ORIGIN_TRAIT_CATALOGUE.md` for Origins.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical integration authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

Nothing in this file authorizes gameplay implementation.

The values below are provisional test values and may be retuned through development, simulation, balance testing, or playtesting without changing the broader Echo design philosophy.

Current invariants:

- Echoes are collectible anime/JRPG dialogue-line modifiers.
- Standard PvE loadout size is **7 Echoes**.
- An Echo **identity** has fixed:
  - shape;
  - one or two concrete stat+scope keys;
  - dialogue/flavor identity;
  - visual identity or deterministic visual-generation recipe.
- Modifier **magnitudes are not part of Echo identity**. They are rolled again whenever that identity is acquired.
- An account/player owns at most **one retained magnitude configuration per Echo identity**.
- Echoes specialize/tune a build; they do not normally introduce Origin-scale rule transformations, hard capabilities, alternate spawn topology, structure-count rules, free structures, or similar mechanics.
- Build-specific value may differ dramatically from generic rolled quality.
- Strong clean rolls should feel exceptional.
- Acquiring a duplicate Echo always produces duplicate/salvage currency even if the newly rolled copy replaces the currently retained copy.

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

These **12,927 identities are the actual collectible item table**.

Magnitude permutations do **not** create additional Echo identities.

Each registered identity is linked to its own dialogue/flavor content and visual identity or visual-generation recipe.

---

## 3. Modifier identity, polarity, and semantics

A retained or newly acquired Echo instance is conceptually:

```text
echoIdentityId
+ rolled magnitude for modifier #1
+ optional rolled magnitude for modifier #2
```

The identity already fixes:

```text
shape
stat key(s)
polarity
dialogue/flavor identity
visual identity/recipe
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

## 5. Magnitude rolls

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

### 5.3 Base magnitude distribution

The exact production distribution over allowed integer magnitudes remains a balance parameter.

Unless separately tuned, generation should treat every legal magnitude in the applicable interval as an ordinary eligible result. Gacha pity may bias or guarantee qualifying high-quality outcomes as specified later without changing Echo identity.

---

## 6. Acquisition shape distribution

The number of registered identities in a shape does **not** determine how often that shape drops.

Every acquisition first selects the Echo shape using the accepted provisional distribution:

```text
Mixed positive/harmful: 50%
Dual positive:          35%
Single positive:        15%
```

Then it selects one registered identity from that shape according to the identity-selection rule, and finally rolls its magnitude(s).

This deliberately keeps:

- mixed Echoes most common;
- dual-positive Echoes next;
- clean single-positive Echoes rarest;

without allowing the raw `8,556 / 4,278 / 93` identity counts to force approximately `66% / 33% / <1%` acquisition rates.

The shape probabilities are versioned balance data and are not stored redundantly on each Echo identity.

---

## 7. Dialogue, flavor, and visual identity

Every one of the **12,927 registered Echo identities** is linked to persistent presentation content.

At minimum an identity should have:

```text
echoIdentityId
shape + concrete stat keys
dialogue/flavor line
visual identity or visual-generation recipe
```

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

Magnitude is intentionally **not** part of dialogue or visual identity. A stronger or weaker duplicate remains recognizably the same Echo.

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

This remains true even if some global scalar quality metric considers one copy numerically superior. Build preference belongs to the player.

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

This allows very large reward batches without turning duplicate resolution into excessive UI friction.

---

## 9. Rolled quality and rarity terminology

Echo **identity** and Echo **rolled instance quality** are separate concepts.

An identity's dialogue, visual, shape, and stat keys are stable.

Its acquired magnitudes vary.

The old model in which every finalized magnitude-specific mechanical signature behaved as a separately weighted collectible item is retired.

### 9.1 Normalized diagnostic quality

For balance, comparison, presentation, or rarity-label derivation, a rolled modifier may still be normalized against its ordinary full single-positive maximum `M`:

```text
normalizedMagnitude = x / M
```

A beneficial modifier contributes positive generic power and a harmful modifier contributes negative generic power.

Such a scalar may be useful for:

- diagnostics;
- broad quality presentation;
- statistical analysis;
- optional cosmetic labels.

It must **not** override the Pareto duplicate-choice rules in §8.

### 9.2 Pity cannot reward merely unusual bad rolls

Statistical rarity and positive desirability are not the same thing.

A gacha pity guarantee must never be satisfied merely because a roll is extremely unusual or extremely bad.

For example, a highly harmful mixed result must not consume a high-quality guarantee simply because its magnitude combination would otherwise be rare.

The pity system therefore uses a separately defined **qualifying positive-quality threshold**. The exact threshold/label remains a balance parameter.

A naturally rolled item that meets or exceeds the active pity threshold may satisfy/reset pity.

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

## 15. Gacha Store

The Echo store is intentionally framed in-game as a **Gacha Store**.

It supports:

- single pulls;
- batch purchasing;
- duplicate recycling;
- soft bad-luck protection;
- a hard qualifying guarantee.

### 15.1 Purchase sizing

The provisional economy target may use a simple ratio such as:

```text
1 pull  ≈ 10 currency
10 pulls ≈ 100 currency
```

Exact currency values remain balance parameters.

Batch purchase must not be mechanically worse than buying the same number of single pulls.

### 15.2 Duplicate salvage and economy safety

Every duplicate grants Echo/gacha currency.

However, ordinary duplicate salvage must not create a deterministic infinite-money loop.

In particular, if one store pull costs `C`, an ordinary store-generated duplicate must not universally refund `>= C` in a way that allows:

```text
buy pull
→ guaranteed duplicate
→ recover full or greater pull cost
→ repeat forever
```

Exact salvage values remain to be tuned, but the economy must preserve a real sink.

Match-earned duplicates may be generous while still obeying the global economy's anti-loop constraints.

### 15.3 Pity / bad-luck protection

Paid gacha spending advances a bad-luck-protection state.

The intended provisional structure is:

- a soft-pity modifier that rises gradually with qualifying spend/pulls without a qualifying high-quality result;
- a hard guarantee after a configured threshold;
- a natural qualifying result satisfies/resets the relevant pity state;
- after a guaranteed qualifying result, pity resets and begins again from zero.

A provisional target equivalent to roughly **100 ordinary single pulls / 1000 currency at a 10-currency pull price** may be used for initial tuning, but both the threshold and qualifying quality/rarity level remain provisional.

Pity modifies **rolled positive quality**, not Echo identity count and not mere statistical unusualness.

The exact implementation may bias magnitude rolls, guarantee one qualifying result in a batch, or use another deterministic/simulatable method, provided it preserves the published guarantee and does not allow a catastrophically bad-but-rare roll to consume the guarantee.

---

## 16. Generation / acquisition procedure

A normal Echo acquisition conceptually proceeds as follows:

1. determine acquisition source (`match`, `gacha`, future source);
2. select Echo **shape** using the current `50% mixed / 35% dual-positive / 15% single-positive` distribution unless the source explicitly defines another approved table;
3. select one registered Echo identity within that shape;
4. roll legal integer magnitude(s) for that identity;
5. apply any source-specific quality modifier or active gacha pity rule;
6. finalize the rolled instance;
7. if the identity is not owned, add it to the collection;
8. if the identity is already owned, award duplicate currency and resolve the retained copy using §8;
9. for a batch, group repeated identities and resolve them together rather than sequentially.

Identity selection and magnitude selection must be deterministic from the authoritative acquisition RNG/state where deterministic replay/audit is required.

Flavor-generation changes must never silently alter an existing identity's mechanical stat keys.

---

## 17. Data/storage model

The intended persistent separation is:

### Echo definition / identity

One of 12,927 rows:

```text
echoIdentityId
shape
statKey1
optional statKey2
polarity implied by shape/slot
dialogue/flavor reference or text
visual recipe/reference
content/generator version
```

### Owned Echo

One retained roll per owned identity:

```text
account/player id
echoIdentityId
magnitude1
optional magnitude2
```

### Acquisition event

Transient/auditable event as needed:

```text
source
echoIdentityId
rolled magnitude(s)
duplicate?
salvage awarded
retained/rejected/chosen result
```

The game should **not** materialize the roughly hundreds of thousands of legal magnitude permutations as separate permanent collectible definitions.

---

## 18. Required stale-document migration

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
- the store has no batch pulls, recycling, or bad-luck protection.

The canonical replacement concepts are:

```text
12,927 fixed Echo identities
+ magnitude rerolled on every acquisition
+ 50% mixed / 35% dual / 15% single shape acquisition
+ one retained roll per identity
+ duplicate currency
+ Pareto automatic upgrade/downgrade
+ player choice for incomparable duplicates
+ all accumulated match rolls become drops
+ defeat preserves earned rolls
+ fixed human teams share reward accounting
+ Gacha Store with batches and positive-quality pity
```

---

## 19. Remaining provisional questions

The core identity/acquisition model is now specified.

Still to be tuned or finalized:

1. exact identity-selection weighting inside each shape;
2. exact base magnitude distribution within each legal integer interval;
3. dialogue/flavor authoring or generation pipeline for all 12,927 identities;
4. exact visual recipe/rendering system;
5. duplicate/salvage currency values;
6. single-pull and batch-pull prices;
7. exact soft-pity curve;
8. exact hard-pity spend/pull threshold;
9. exact positive-quality qualification metric and rarity/presentation labels;
10. whether pity guarantees one qualifying item within the triggering batch or transforms the triggering roll directly;
11. exact special-AI reward bonuses;
12. executable/property tests for reward accounting, duplicate Pareto resolution, Origin/Echo composition, and gacha pity;
13. exact UI flow for choosing among incomparable duplicate Pareto-frontier rolls.

These are tuning/integration tasks rather than reasons to reopen the accepted **12,927 stable identities + rerolled magnitudes + duplicate progression + all-earned-roll rewards + gacha** architecture.
