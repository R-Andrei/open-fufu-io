# Open Fufu — Canonical Official AI Preset Roster

## Status and authority

This document is the **canonical owner for the V1 Official PvE AI preset roster, character identities, provisional difficulty targets, allowed-Origin pools, and seeded Origin-selection/reveal rules**.

Official-AI work starts at [`README.md`](./README.md). Broad subsystem architecture is owned by [`OFFICIAL_AI_ARCHITECTURE.md`](./OFFICIAL_AI_ARCHITECTURE.md).

Neighboring owners:

- shared AI configuration contract: [`OFFICIAL_AI_CONFIGURATION.md`](./OFFICIAL_AI_CONFIGURATION.md);
- Origin support/adaptation: [`OFFICIAL_AI_ORIGIN_SUPPORT.md`](./OFFICIAL_AI_ORIGIN_SUPPORT.md);
- exact trait-support rationale/configuration: [`OFFICIAL_AI_TRAIT_SUPPORT.md`](./OFFICIAL_AI_TRAIT_SUPPORT.md);
- named-Origin AI rationale: [`OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md`](./OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md);
- Baseline/character behavioral rationale: [`OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md`](./OFFICIAL_AI_CHARACTER_CONFIGURATIONS.md);
- Official Origin roster: [`../OFFICIAL_ORIGINS.md`](../OFFICIAL_ORIGINS.md);
- Origin trait mechanics/costs: [`../ORIGIN_TRAIT_CATALOGUE.md`](../ORIGIN_TRAIT_CATALOGUE.md);
- Echo reward accounting, including how bound AI difficulty affects rewards: [`../ECHO_CATALOGUE.md`](../ECHO_CATALOGUE.md).

Exact code-readable AI mappings live under `design/official-ai/` and are not duplicated here.

Difficulty values below are creator-authored competence targets, not claims that an implementation already achieves those ratings.

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

The AI profile defines how the character thinks. Its randomly selected allowed Official Origin defines the faction's mechanical toolbox for that match.

This separation is intentional:

- one character retains a recognizable controller/personality across matches;
- the character does not always expose one predictable Origin that humans can counter-build before the match;
- multiple characters may share Origins;
- one Origin may fit unrelated characters for different thematic/mechanical reasons;
- the controller must exploit every Origin in its pool coherently without becoming a different character.

Official AI obeys ordinary game rules and uses ordinary legal Origins from the same public Origin system as humans. Difficulty is controller competence, not a hidden simulation bonus or privileged Origin mechanic.

### Difficulty-0 Baseline AI

Open Fufu also has one generic **Difficulty 0 Baseline AI**.

It is not a character preset and is not part of the 20-character roster or its Origin-pool table. Baseline is the default first-match opponent and initial capability-benchmark reference. Its configuration uses the same shared AI architecture but is intentionally generic and substantially less sophisticated than the character presets.

The exact Baseline `CharacterProfile` is canonical in `design/official-ai/character-configurations.config.ts`.

---

## Origin selection and reveal timing

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
- selected Origin does not change the preset's bound difficulty.

After selection, the controller uses the canonical support/adaptation architecture to understand and exploit the rolled Origin.

---

## Difficulty targets

| Difficulty | Target controller behavior |
| ---: | --- |
| **1 — Easy** | Intentionally simple and exploitable but characterful; broadly sensible and slightly above Baseline, with obvious weaknesses. |
| **2 — Moderate** | Competent at preferred game plans but predictable, limited in adaptation, and readily punishable by experienced players. |
| **3 — Hard** | Solid/coherent all-around opposition. Recognizes ordinary threats and uses its doctrine competently enough that the player must actually play well. |
| **4 — Expert** | Strong adaptive controller with good prioritization, timing, economy, geography, and exploitation. |
| **5 — Extreme** | V1 showcase/benchmark AI: long-horizon, multi-front, highly adaptive, difficult to exploit, and intended to challenge strong player controllers. |

Difficulty describes controller competence and difficulty to defeat, not lore power, morality, visual harmlessness, age, or canonical combat strength.

Difficulty is a versioned preset field consumed by other systems. **Reward arithmetic is not owned here**; `ECHO_CATALOGUE.md` defines how the bound difficulty participates in Echo reward accounting. No independent per-character reward-bonus field/table exists in this roster.

---

## Provisional V1 character roster

| AI preset | Source | Difficulty target | Provisional controller fantasy | Allowed Official Origins |
| --- | --- | ---: | --- | --- |
| **Thorfinn Karlsefni** | Vinland Saga | **3** | Never initiates hostility against an innocent faction; remembers self/ally aggressors; may competitively conquer aggressors; strong de-escalation after conflict; Population preservation. | **A True Warrior Needs No Sword** · **What Is a True Warrior?** · **A War Worth Avoiding** · **The Art of Surviving** · **Gemini** |
| **Askeladd** | Vinland Saga | **4** | Opportunistic predator; infrastructure/economic targeting; sacrificial leverage; weaponizes awkward enemy boundary geometry. | **Survival of the Fittest** · **Right of Conquest** · **Woolong Hustle** · **The Fake Is of Far Greater Value** · **The Art of Surviving** · **What Is a True Warrior?** |
| **Reinhard von Lohengramm** | Legend of the Galactic Heroes | **5** | Global conquest optimizer; post-earlygame multi-front general offensives; feints and overwhelming campaign-wide force. | **The Stars Are Within My Grasp** · **A Rational War** · **Right of Conquest** · **Efficiency Above All** · **Survival of the Fittest** |
| **Yang Wen-li** | Legend of the Galactic Heroes | **5** | Roster-best defensive macro; preserves options and punishes overextension, but aggressively exploits momentary weakness and expands for security/position/advantage. | **The Magician** · **A War Worth Avoiding** · **A True Warrior Needs No Sword** · **The Art of Surviving** · **I Don't Know Everything** |
| **Frieren** | Frieren | **4** | Patient long-horizon accumulation; acquires low-cost useful capabilities “just in case”; little panic; overwhelming late commitments. | **A Mere Ten Years** · **Ordinary Offensive Magic** · **The Height of Magic** · **Section 9** |
| **Übel** | Frieren | **4** | Ruthless high-upside intuition; prefers advantageous thin/straight territorial cuts that sever enemy connectivity. | **If I Can Imagine It** · **Everything Will Turn to Ash** · **Survival of the Fittest** · **Serious Series** · **The Dose Makes the Poison** |
| **Tanya Degurechaff** | The Saga of Tanya the Evil / Youjo Senki | **4** | Quantitative war machine; concentrated breakthroughs, deep strikes, artillery/strategic weapons, unconventional operations when expected value supports them. | **A Rational War** · **203rd Mage Battalion** · **Being X** · **Survival of the Fittest** · **Serious Series** · **Bomb Girl** |
| **Kiss-Shot Acerola-Orion Heart-Under-Blade** | Monogatari | **3** | Dominant/snowballing; resilient; extravagant overwhelming force; protects uniquely powerful assets. | **Iron-Blooded Vampire** · **King of Apparitions** · **One Punch** · **The Height of Magic** · **Operation Super-Smart** |
| **Hanekawa Tsubasa** | Monogatari | **4** | Information-heavy analytical controller; unusually complete observation coverage when affordable; efficient balanced responses. | **I Don't Know Everything** · **Kessoku Band** · **Hacker's Paradise** · **There Is No Time to Waste** · **Section 9** |
| **Kaiki Deishuu** | Monogatari | **3** | Avoids fair fights; economy first; opportunism/deception; makes wars profitable and exits when the margin disappears. | **Section 9** · **Woolong Hustle** · **The Fake Is of Far Greater Value** · **Hacker's Paradise** · **The Art of Surviving** |
| **Misaka Mikoto** | A Certain Scientific Railgun | **3** | Direct force and ranged pressure; builds a supported “Railgun corridor” and hammers a wider offensive axis open. | **Railgun** · **Tokiwadai Ace** · **Watchtower** · **Ordinary Offensive Magic** |
| **Edward Wong Hau Pepelu Tivrusky IV** | Cowboy Bebop | **2** | Weird geography/exploration; prefers arcane but useful territorial shapes and becomes oddly good at preserving/extending them. | **Radical Edward** · **Hacker's Paradise** · **Light Music Club** · **Gemini** |
| **Shaula** | Re:Zero | **3** | Long-range guardian; designates a protected core; Fort/SAM/mixed Pleiades-watchtower geometry when viable; fights extraordinarily hard for that core. | **Hell's Snipe** · **Watchtower** · **Ordinary Offensive Magic** · **Serious Series** · **The Height of Magic** |
| **Hirasawa Yui** | K-On! | **1** | Simple friendly heuristics and low urgency; prefers useful cute infrastructure geometry such as hearts, stars, bunny/face-like patterns when viable. | **Light Music Club** · **Fuwa Fuwa Time** · **Kessoku Band** · **Hero for Fun** |
| **Saitama** | One-Punch Man | **2** | Minimum-complexity strategic logic; low urgency until something matters; then attacks with deliberately disproportionate localized force. | **One Punch** · **Serious Series** · **Hero for Fun** · **Light Music Club** · **King of Apparitions** |
| **Ferdinand** | Ascendance of a Bookworm | **5** | Roster-best economy/infrastructure optimizer; extreme density, compounding, rail/factory/city packing, and minimal system waste. | **Efficiency Above All** · **There Is No Time to Waste** · **A Mere Ten Years** · **Kessoku Band** · **The Stars Are Within My Grasp** · **A Rational War** |
| **Power** | Chainsaw Man | **2** | Coherently reckless aggression, greed, bravado, spectacle, opportunistic violence, and excessive commitment. | **1000 IQ** · **Operation Super-Smart** · **If I Can Imagine It** · **Survival of the Fittest** · **Hero for Fun** |
| **Reze** | Chainsaw Man | **3** | Deceptive positioning/infiltration followed by sudden explosive breakthrough or amphibious escalation. | **Bomb Girl** · **The Country Mouse** · **Serious Series** · **Section 9** · **The Dose Makes the Poison** |
| **Hitori Gotou** | Bocchi the Rock! | **2** | Exceptional D2 defense: Fort-heavy perimeter, layered fallback positions, optional Fallout safety barriers, poor proactive offense/economy, pressure-triggered panic. | **Bocchi Time** · **Kessoku Band** · **Section 9** · **Everything Will Turn to Ash** |
| **Maomao** | The Apothecary Diaries | **4** | Causal-mechanics diagnosis, experimentation, terrain/status exploitation, and efficient response to confirmed mechanisms. | **The Dose Makes the Poison** · **I Don't Know Everything** · **There Is No Time to Waste** · **The Art of Surviving** |

### Bocchi pool rationale

Bocchi intentionally uses a small four-Origin pool rather than a broad generic one:

- **Bocchi Time (O14)** — split-start identity fitting defensive split-front anxiety;
- **Kessoku Band (O15)** — infrastructure-support identity fitting her defensive construction behavior;
- **Section 9 (O17)** — concealment/information-denial identity fitting low exposure and prepared defense;
- **Everything Will Turn to Ash (O33)** — scorched-earth/Fallout-capable fallback identity fitting her defensive adaptation.

Origin selection is uniform, so each of those four roster entries has the same selection probability. The actual Origin mechanics remain owned by the Origin documents rather than this rationale.

Target distribution:

```text
Difficulty 1: 1 preset
Difficulty 2: 4 presets
Difficulty 3: 6 presets
Difficulty 4: 6 presets
Difficulty 5: 3 presets
```

The Difficulty-0 Baseline is not counted.

---

## Pool rules

- A preset must have at least one legal active Official Origin.
- Allowed-Origin IDs are a set: no duplicates.
- Pools should normally contain several mechanically meaningful alternatives so the preset cannot be perfectly counter-built before Origin selection.
- Pool sizes need not be equal across characters.
- Origins may be shared across any number of presets.
- Do not pad pools with mechanically hostile Origins merely to increase randomness.
- The preset personality must remain recognizable across every allowed Origin.
- Human players may use the same Official Origins independently of AI-preset pools.

This document owns the roster, Difficulty-0 Baseline role, current allowed-Origin sets, uniform seeded Origin-selection rule, and provisional difficulty targets. Echo reward behavior is owned exclusively by `ECHO_CATALOGUE.md`.
