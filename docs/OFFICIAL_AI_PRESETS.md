# Open Fufu — Provisional Official AI Preset Roster

## Status and authority

This document is the **canonical content registry for the provisional V1 Official PvE AI preset roster**.

Related canonical documents:

- [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) — game-design authority;
- [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md) — migration/implementation authority;
- [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md) — Official-AI architecture;
- [`OFFICIAL_AI_CONFIGURATION.md`](./OFFICIAL_AI_CONFIGURATION.md) — shared AI configuration contract;
- [`OFFICIAL_AI_ORIGIN_SUPPORT.md`](./OFFICIAL_AI_ORIGIN_SUPPORT.md) — generic Origin support/adaptation contract;
- [`OFFICIAL_AI_TRAIT_SUPPORT.md`](./OFFICIAL_AI_TRAIT_SUPPORT.md) — trait-support rationale;
- [`OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md`](./OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md) — named-Origin AI rationale;
- [`OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md`](./OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md) — Baseline/character behavioral rationale;
- [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md) — Official Origin content/mechanics;
- [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md) — generic Echo reward semantics.

Exact code-readable AI mappings live under `design/official-ai/` and are not duplicated here.

Nothing in this file authorizes gameplay implementation.

Current content status:

```text
shared AI architecture/configuration contracts: closed
Origin trait AI support:                    72 / 72 complete
Official Origin AI configuration:            49 / 49 complete
Baseline/character CharacterProfiles:         21 / 21 complete
```

The `21` profile count is the Difficulty-0 Baseline plus the 20 character presets. The first full CharacterProfile pass is complete. A fastfire character quirk/signature-move review remains intentionally open before final benchmarking/validation.

Difficulty values below are creator-authored competence targets, not claims that unfinished implementations already achieve those ratings.

---

## Preset model

For V1, an **Official AI preset is a character**, not an anime-title bundle.

Each character preset owns conceptually:

```text
presetId
character/display identity
source work metadata
controllerProfileId
difficulty: 1..5
allowedOriginIds[]
```

The AI profile defines **how the character thinks**. Its randomly selected allowed Official Origin defines the faction's mechanical toolbox for that match.

This separation is intentional:

- one character retains a recognizable controller/personality across matches;
- the character does not always expose one predictable Origin that humans can hard-counter before the match;
- multiple characters may share Origins;
- one Origin may fit unrelated characters for different thematic/mechanical reasons;
- the controller must be able to exploit every Origin in the character's pool coherently without becoming a different character.

Official AI obeys all ordinary game rules and uses ordinary legal Origins from the same public Origin system as humans. Difficulty comes from controller competence, not hidden simulation bonuses or privileged Origin mechanics.

### Difficulty-0 Baseline AI

Open Fufu also has one generic **Difficulty 0 Baseline AI**.

It is not a character preset and is not part of the 20-character roster or its Origin-pool table.

Baseline is the default first-match opponent and the initial capability-benchmark reference. Its configuration uses the same shared AI architecture but is intentionally generic and substantially less sophisticated than the character presets.

The exact Baseline `CharacterProfile` is canonical in `design/official-ai/character-configurations.config.ts`.

---

## Origin selection and reveal timing — hard V1 rule

Use this order:

```text
1. lobby selects Official AI presets
2. human players lock controller / Origin / Echo Set
3. match seed selects one Origin uniformly from each AI preset's allowed Origin set
4. selected AI Origins become mechanically public
5. Strategic Spawn Phase 1 begins
```

Selection rules:

- selection is **uniform** across the preset's allowed Origin set;
- no Origin weights exist;
- no map-conditioned Origin selector exists;
- no character/controller logic chooses which allowed Origin it receives;
- selection is deterministic from versioned match state for replayability;
- the selected Origin does not change preset difficulty/reward identity.

This prevents deterministic pre-match counter-picking while preserving transparent mechanics during actual play.

After selection, the controller uses the canonical support/adaptation architecture from `OFFICIAL_AI_ORIGIN_SUPPORT.md` to understand and exploit the rolled Origin.

---

## Difficulty targets and Echo rewards

| Difficulty | Target controller behavior |
| ---: | --- |
| **1 — Easy** | Intentionally simple and exploitable but characterful; broadly sensible and slightly above Baseline, with obvious weaknesses. |
| **2 — Moderate** | Competent at preferred game plans but predictable, limited in adaptation, and readily punishable by experienced players. |
| **3 — Hard** | Solid/coherent all-around opposition. Recognizes ordinary threats and uses its doctrine competently enough that the player must actually play well. |
| **4 — Expert** | Strong adaptive controller with good prioritization, timing, economy, geography, and exploitation. |
| **5 — Extreme** | V1 showcase/benchmark AI: long-horizon, multi-front, highly adaptive, difficult to exploit, and intended to challenge strong player controllers. |

Difficulty describes controller competence and difficulty to defeat, not lore power, morality, visual harmlessness, age, or canonical combat strength.

### Difficulty bonus is separate from ordinary opponent loot

Every qualifying defeated opponent contributes:

```text
ordinary opponent defeat = +1 Echo roll
```

An Official/Baseline AI additionally contributes:

```text
AI difficulty bonus = +difficulty Echo rolls
```

Therefore:

```text
Baseline D0 → +1 ordinary +0 bonus = 1 total
D1          → +1 ordinary +1 bonus = 2 total
D2          → +1 ordinary +2 bonus = 3 total
D3          → +1 ordinary +3 bonus = 4 total
D4          → +1 ordinary +4 bonus = 5 total
D5          → +1 ordinary +5 bonus = 6 total
```

Difficulty controls only the extra AI bonus. Do not maintain an independent per-character Echo-bonus table.

---

## Provisional V1 character roster

| AI preset | Source | Difficulty target | Provisional controller fantasy | Allowed Official Origins |
| --- | --- | ---: | --- | --- |
| **Thorfinn Karlsefni** | Vinland Saga | **3** | Peaceful expansion; never initiates hostility against an innocent faction; remembers factions that attacked him or his allies; extremely committed retaliation with strong post-conflict de-escalation; Population preservation. | **A True Warrior Needs No Sword** · **What Is a True Warrior?** · **A War Worth Avoiding** · **The Art of Surviving** · **Gemini** |
| **Askeladd** | Vinland Saga | **4** | Opportunistic predator; infrastructure/economic targeting; willingly sacrifices position; attacks weakness. | **Survival of the Fittest** · **Right of Conquest** · **Woolong Hustle** · **The Fake Is of Far Greater Value** · **The Art of Surviving** · **What Is a True Warrior?** |
| **Reinhard von Lohengramm** | Legend of the Galactic Heroes | **5** | Global optimization; expansion; decisive wars; thinks several fronts ahead. | **The Stars Are Within My Grasp** · **A Rational War** · **Right of Conquest** · **Efficiency Above All** · **Survival of the Fittest** |
| **Yang Wen-li** | Legend of the Galactic Heroes | **5** | Defensive macro; preserves options; punishes overextension; wins wars he would rather not fight. | **The Magician** · **A War Worth Avoiding** · **A True Warrior Needs No Sword** · **The Art of Surviving** · **I Don't Know Everything** |
| **Frieren** | Frieren | **4** | Patient long-horizon planning; accumulation; little panic; overwhelming late commitments. | **A Mere Ten Years** · **Ordinary Offensive Magic** · **The Height of Magic** · **Section 9** |
| **Übel** | Frieren | **4** | Ruthless exploitation; aggressive intuition; happy taking strange high-risk lines. | **If I Can Imagine It** · **Everything Will Turn to Ash** · **Survival of the Fittest** · **Serious Series** · **The Dose Makes the Poison** |
| **Tanya Degurechaff** | The Saga of Tanya the Evil / Youjo Senki | **4** | Quantitative war machine; concentrated breakthrough; artillery/strategic weapons; ruthless efficiency. | **A Rational War** · **203rd Mage Battalion** · **Being X** · **Survival of the Fittest** · **Serious Series** · **Bomb Girl** |
| **Kiss-Shot Acerola-Orion Heart-Under-Blade** | Monogatari | **3** | Dominant/snowballing; resilient; extravagant commitment of overwhelming force. | **Iron-Blooded Vampire** · **King of Apparitions** · **One Punch** · **The Height of Magic** · **Operation Super-Smart** |
| **Hanekawa Tsubasa** | Monogatari | **4** | Information-heavy, analytical, efficient, balanced responses. | **I Don't Know Everything** · **Kessoku Band** · **Hacker's Paradise** · **There Is No Time to Waste** · **Section 9** |
| **Kaiki Deishuu** | Monogatari | **3** | Avoids fair fights; economy first; opportunism; deception; makes wars profitable. | **Section 9** · **Woolong Hustle** · **The Fake Is of Far Greater Value** · **Hacker's Paradise** · **The Art of Surviving** |
| **Misaka Mikoto** | A Certain Scientific Railgun | **3** | Direct force, infrastructure, ranged/area denial, fairly straightforward strategic reasoning. | **Railgun** · **Tokiwadai Ace** · **Watchtower** · **Ordinary Offensive Magic** |
| **Edward Wong Hau Pepelu Tivrusky IV** | Cowboy Bebop | **2** | Weird geography, exploration, unconventional infrastructure, unpredictable priorities without literal randomness. | **Radical Edward** · **Hacker's Paradise** · **Light Music Club** · **Gemini** |
| **Shaula** | Re:Zero | **3** | Long-range guardian; designates a protected core; signature tower/SAM geometry when viable; fights extraordinarily hard for that core. | **Hell's Snipe** · **Watchtower** · **Ordinary Offensive Magic** · **Serious Series** · **The Height of Magic** |
| **Hirasawa Yui** | K-On! | **1** | Simple heuristics, economic comfort, teamwork/support structures, low urgency; heart-like infrastructure/rail layouts when viable. | **Light Music Club** · **Fuwa Fuwa Time** · **Kessoku Band** · **Hero for Fun** |
| **Saitama** | One-Punch Man | **2** | Minimum-complexity strategic logic; low urgency until something matters; attacks with overwhelming concentrated force once committed. | **One Punch** · **Serious Series** · **Hero for Fun** · **Light Music Club** · **King of Apparitions** |
| **Ferdinand** | Ascendance of a Bookworm | **5** | Infrastructure/system optimizer; ruthless efficiency; plans everything; hates waste. | **Efficiency Above All** · **There Is No Time to Waste** · **A Mere Ten Years** · **Kessoku Band** · **The Stars Are Within My Grasp** · **A Rational War** |
| **Power** | Chainsaw Man | **2** | Coherently reckless aggression, greed, bravado, spectacle, and opportunistic violence. | **1000 IQ** · **Operation Super-Smart** · **If I Can Imagine It** · **Survival of the Fittest** · **Hero for Fun** |
| **Reze** | Chainsaw Man | **3** | Deceptive positioning/infiltration followed by sudden explosive breakthrough or amphibious escalation. | **Bomb Girl** · **The Country Mouse** · **Serious Series** · **Section 9** · **The Dose Makes the Poison** |
| **Hitori Gotou** | Bocchi the Rock! | **2** | Extreme risk aversion, concealment/isolation, unusually dense useful border Fort coverage, defensive buildup, occasional pressure-triggered panicked overcommit. | **Bocchi Time** · **Section 9** · **Kessoku Band** · **Gemini** · **Light Music Club** |
| **Maomao** | The Apothecary Diaries | **4** | Causal-mechanics diagnosis, experimentation, terrain/status exploitation, and efficient response to confirmed mechanisms. | **The Dose Makes the Poison** · **I Don't Know Everything** · **There Is No Time to Waste** · **The Art of Surviving** |

Target distribution:

```text
Difficulty 1: 1 preset
Difficulty 2: 4 presets
Difficulty 3: 6 presets
Difficulty 4: 6 presets
Difficulty 5: 3 presets
```

The Difficulty-0 Baseline AI is not counted.

---

## Pool rules

- A preset must have at least one legal active Official Origin.
- Allowed-Origin IDs are a **set**: no duplicates.
- Pools should normally contain several mechanically meaningful alternatives so the preset cannot be perfectly counter-built before Origin selection.
- Pool sizes need not be equal across characters.
- Origins may be shared across any number of presets.
- Do not pad pools with mechanically hostile Origins merely to increase randomness.
- The preset personality must remain recognizable across every allowed Origin.
- Human players may use the same Official Origins independently of AI-preset pools.

---

## Concrete content work still open

The generic architecture/configuration contracts, complete 72-trait support catalogue, complete 49-Origin AI configuration, Difficulty-0 Baseline, and all 20 first-pass character `CharacterProfile`s are closed for the current V1 design.

Remaining content work proceeds in this order:

1. run the fastfire **character quirk/signature-move pass** across all 20 characters, adding quirks only where they materially improve identity;
2. run the complete 20-character cross-profile and character × allowed-Origin consistency audit;
3. benchmark each character against its authored capability target;
4. benchmark thematic/fidelity behavior separately;
5. version/hash final preset/controller/Origin configuration for match/replay/reward records.

The quirk pass must use existing character-owned Expression/Goal/Arbiter/Persistence surfaces where possible. It must not create gameplay mechanics, Origin semantics, or a new shared subsystem merely to support cosmetic personality unless the existing architecture genuinely cannot represent a reusable requirement.

The roster, Difficulty-0 Baseline role, current allowed-Origin sets, uniform seeded Origin-selection rule, provisional difficulty targets, additive difficulty-bonus reward rule, and generic Official-AI architecture/configuration are accepted V1 direction.
