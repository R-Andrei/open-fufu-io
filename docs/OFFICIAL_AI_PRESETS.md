# Open Fufu — Provisional Official AI Preset Roster

## Status and authority

This document is the **canonical content registry for the provisional V1 Official PvE AI preset roster**.

The canonical game-design authority remains [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). The canonical migration/implementation authority remains [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md). Official Origin mechanics are maintained in [`OFFICIAL_ORIGINS.md`](./OFFICIAL_ORIGINS.md), and Echo reward semantics are maintained in [`ECHO_CATALOGUE.md`](./ECHO_CATALOGUE.md).

Nothing in this file authorizes gameplay implementation. Controller logic, final difficulty ratings, and exact Echo reward bonuses remain future AI implementation/design work.

---

## Preset model

For V1, an **Official AI preset is a character**, not an anime-title bundle.

Each preset owns:

```text
presetId
character/display identity
source work metadata
controller/personality identity
intended difficulty: 1..5        // provisional field; exact rating TBD
Echo reward bonus                // exact value TBD after difficulty/controller design
allowedOriginIds[]
```

The AI preset defines **how that controller thinks**. Its randomly selected Official Origin defines the mechanical faction doctrine available to it in that match.

This separation is intentional:

- one character should retain a recognizable controller/personality across matches;
- the character should not always expose one perfectly predictable Origin that humans can hard-counter in the lobby;
- multiple AI presets may share the same Origin;
- an Origin may be thematically appropriate for a character even when the character never said the Origin's title and has no literal lore relationship to its source phrase;
- the same shared Origin may suit characters from unrelated works for different thematic reasons.

Official AI still obeys all ordinary game rules and uses ordinary legal Origins from the same public Origin catalogue as humans. Difficulty comes from controller quality/strategy, **not simulation cheats or privileged Origin mechanics**.

---

## Origin selection and reveal timing

To prevent deterministic pre-match counter-picking while preserving Open Fufu's transparent-mechanics rules, use this V1 order:

```text
1. lobby selects Official AI presets
2. human players lock their controller / Origin / Echo Set
3. match seed selects one Origin from each AI preset's allowed Origin pool
4. selected AI Origins become mechanically public
5. Strategic Spawn Phase 1 begins
```

The selected AI Origin is therefore **not hidden during play**. It is revealed before Strategic Spawn exactly like other strategically relevant Origin information. The only protected uncertainty is which allowed Origin the preset will receive before human loadouts are locked.

The AI's configured difficulty/reward identity belongs to the **preset**, not the randomly selected Origin. Rolling a more convenient or inconvenient Origin must not silently change that preset's difficulty label or Echo reward value.

Origin selection should be deterministic from the match seed/versioned preset definition for replayability. V1 may use uniform selection within a preset's allowed pool unless a later explicit content decision introduces authored weights.

---

## Difficulty and Echo rewards

Every Official AI preset will eventually receive a creator-authored difficulty rating on a **1–5 scale**:

```text
1 = easy / introductory
2 = moderate
3 = hard
4 = expert
5 = extreme / highest intended V1 challenge
```

The number describes the **implemented controller's strategic competence and difficulty to defeat**, not canonical character power level, visual harmlessness, or anime lore strength.

Exact ratings are deliberately **not assigned yet**. They should be assigned after each controller's behavior and competence targets are defined well enough to justify the label.

Each preset also carries an individually authored Echo reward bonus on top of the ordinary opponent-defeat roll. The bonus should broadly track intended/observed difficulty, but the exact mapping from difficulty 1–5 to bonus rolls remains provisional until the controller roster is designed and later playtested.

---

## Provisional V1 character roster

The following characters are the accepted provisional V1 preset roster. Controller fantasies are directional design briefs, not executable behavior specifications yet.

| AI preset | Source | Provisional controller fantasy | Allowed Official Origins |
| --- | --- | --- | --- |
| **Thorfinn Karlsefni** | Vinland Saga | Peaceful expansion; avoids initiating wars; extremely committed retaliation; Population preservation. | **I Have No Enemies** · **What Is a True Warrior?** · **A War Worth Avoiding** · **The Art of Surviving** · **Somewhere Not Here** |
| **Askeladd** | Vinland Saga | Opportunistic predator; infrastructure/economic targeting; willingly sacrifices position; attacks weakness. | **The Weak Die First** · **Spoils of Empire** · **Money Is Everything** · **The Conman** · **The Art of Surviving** · **What Is a True Warrior?** |
| **Reinhard von Lohengramm** | Legend of the Galactic Heroes | Global optimization; expansion; decisive wars; thinks several fronts ahead. | **The Stars Are Within My Grasp** · **A Rational War** · **Spoils of Empire** · **Efficiency Above All** · **The Weak Die First** |
| **Yang Wen-li** | Legend of the Galactic Heroes | Defensive macro; preserves options; punishes overextension; wins wars he would rather not fight. | **The Magician** · **A War Worth Avoiding** · **I Have No Enemies** · **The Art of Surviving** · **I Don't Know Everything** |
| **Frieren** | Frieren | Patient long-horizon planning; accumulation; little panic; overwhelming late commitments. | **A Mere Ten Years** · **Ordinary Offensive Magic** · **The Height of Magic** · **To Them Words Are Merely a Means to Deceive** · **Curiosity Killed the Cat** |
| **Übel** | Frieren | Ruthless exploitation; aggressive intuition; happy taking strange high-risk lines. | **I Can Cut It** · **It's a Matter of Visualization** · **The Weak Die First** · **Serious Series** · **This Is Poison** |
| **Tanya Degurechaff** | The Saga of Tanya the Evil / Youjo Senki | Quantitative war machine; concentrated breakthrough; artillery/strategic weapons; ruthless efficiency. | **A Rational War** · **The Devil of the Rhine** · **A Miracle Is Merely a Miscalculation** · **The Weak Die First** · **Serious Series** · **Bomb Girl** |
| **Kiss-Shot Acerola-Orion Heart-Under-Blade** | Monogatari | Dominant/snowballing; resilient; extravagant commitment of overwhelming force. | **Heart-Under-Blade** · **King of Apparitions** · **One Punch** · **The Height of Magic** · **Blood Devil** |
| **Hanekawa Tsubasa** | Monogatari | Information-heavy, analytical, efficient, balanced responses. | **I Don't Know Everything** · **Kessoku Band** · **Hacker's Paradise** · **There Is No Time to Waste** · **To Them Words Are Merely a Means to Deceive** |
| **Kaiki Deishuu** | Monogatari | Avoids fair fights; economy first; opportunism; deception; makes wars profitable. | **To Them Words Are Merely a Means to Deceive** · **Money Is Everything** · **The Conman** · **Hacker's Paradise** · **The Art of Surviving** |
| **Misaka Mikoto** | A Certain Scientific Railgun | Direct force, infrastructure, ranged/area denial, fairly straightforward strategic reasoning. | **Railgun** · **Level 5** · **Watchtower** · **Ordinary Offensive Magic** |
| **Edward Wong Hau Pepelu Tivrusky IV** | Cowboy Bebop | Weird geography, exploration, unconventional infrastructure, unpredictable priorities without literal randomness. | **Radical Edward** · **Hacker's Paradise** · **Fun Things Are Fun** · **Curiosity Killed the Cat** · **Somewhere Not Here** |
| **Shaula** | Re:Zero | Long-range killing, defensive anchoring, exclusion zones, protects a chosen core. | **Hell's Snipe** · **Watchtower** · **Ordinary Offensive Magic** · **Serious Series** · **The Height of Magic** |
| **Hirasawa Yui** | K-On! | Simple heuristics, economic comfort, teamwork/support structures, low urgency. | **Fun Things Are Fun** · **Tea Time** · **Kessoku Band** · **Hero for Fun** |
| **Saitama** | One-Punch Man | Almost insultingly simple strategic logic, but decisive commitment once he decides something matters. | **One Punch** · **Serious Series** · **Hero for Fun** · **Fun Things Are Fun** · **King of Apparitions** |
| **Ferdinand** | Ascendance of a Bookworm | Infrastructure optimizer; ruthless efficiency; plans everything; hates waste. | **Efficiency Above All** · **There Is No Time to Waste** · **A Mere Ten Years** · **Kessoku Band** · **The Stars Are Within My Grasp** · **A Rational War** |
| **Power** | Chainsaw Man | Chaotic aggression, greed, bravado, opportunistic violence. | **Nobel Prize** · **Blood Devil** · **I Can Cut It** · **The Weak Die First** · **Hero for Fun** |
| **Reze** | Chainsaw Man | Deceptive positioning; explosive breakthroughs; amphibious/infiltration logic; sudden escalation. | **Bomb Girl** · **The Country Mouse and the City Mouse** · **Serious Series** · **To Them Words Are Merely a Means to Deceive** · **This Is Poison** |
| **Hitori Gotou** | Bocchi the Rock! | Extreme risk aversion, concealment/isolation, defensive buildup, occasional panicked overcommit. | **Bocchi Time** · **To Them Words Are Merely a Means to Deceive** · **Kessoku Band** · **Somewhere Not Here** · **Fun Things Are Fun** |
| **Maomao** | The Apothecary Diaries | Analysis, experimentation, terrain/status exploitation, efficient response to observed problems. | **This Is Poison** · **I Don't Know Everything** · **Curiosity Killed the Cat** · **There Is No Time to Waste** · **The Art of Surviving** |

This gives V1 **20 provisional character presets**.

---

## Pool rules

- A preset must have at least one legal active Official Origin.
- V1 pools should normally contain several mechanically meaningfully different Origins so the preset cannot be counter-built with certainty before the match.
- Pool size does **not** need to be equal across characters.
- Origins may be shared across any number of presets.
- The selected Origin must be something the preset controller can use coherently; do not pad pools with mechanically hostile builds merely to increase randomness.
- The preset's controller personality should remain recognizable across all of its allowed Origins.
- Origin names/references are allowed to cross source works freely when the mechanical/fantasy fit is good.
- Human players may use the same Official Origins independently of AI-preset pools.

---

## Implementation/design work still open

Before the AI/reward subsystem can be considered content-complete, future work must:

1. define each character controller's actual strategic logic/heuristics/behavior modules;
2. assign a justified difficulty rating `1..5` to each implemented preset;
3. assign each preset's provisional Echo reward bonus and later validate it through playtesting;
4. decide whether any allowed Origin pools need weights rather than uniform seeded selection;
5. verify every preset can operate coherently under every Origin in its pool;
6. define final presentation metadata/art/flavor for the preset-selection UI;
7. version/hash preset definitions and selected Origin identity for replay/match records.

The **character roster, character-based preset model, global shared Origin pools, current allowed Origin pools, and post-human-lock/pre-Strategic-Spawn Origin-selection timing are provisionally accepted V1 content direction**.
