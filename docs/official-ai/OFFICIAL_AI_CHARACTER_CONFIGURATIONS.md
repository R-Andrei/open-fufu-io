# Open Fufu — Official AI Character Configuration Rationale

## Status and authority

This document is the single canonical **rationale/behavioral-intent companion** for Baseline and character `CharacterProfile` configuration.

Exact code-readable mappings live only in:

```text
design/official-ai/character-configurations.config.ts
```

That configuration file is authoritative for exact evaluator/planner tiers, Doctrine mappings, GoalGenerator rules, Arbiter settings, Persistence, Expression, Origin adaptation, Fidelity expectations, and registered bespoke rule/hook IDs.

Neighboring authorities remain separate:

- `OFFICIAL_AI_PRESETS.md` — roster, difficulty targets, and allowed-Origin pools;
- `../ECHO_CATALOGUE.md` — Echo reward accounting;
- `OFFICIAL_AI_CONFIGURATION.md` — generic `CharacterProfile` contract and shared vocabularies;
- `OFFICIAL_AI_ORIGIN_SUPPORT.md` — generic Origin-support/adaptation contract;
- `OFFICIAL_AI_ORIGIN_CONFIGURATIONS.md` — named-Origin strategic rationale;
- `OFFICIAL_AI_TRAIT_SUPPORT.md` — trait-support rationale;
- gameplay/rules documents — actual mechanics and numerical rules.

This rationale explains character intent and bespoke hook semantics. It must not become a duplicate table of exact configuration values.

---

## Signature behavior contract

A character signature is a **recognizable family of preferred legal behavior**, not a script and not a private game mechanic.

Use the existing character-owned surfaces first:

```text
Expression SIGNATURE preferences
+ bespoke character candidate-generation/ranking hooks
+ Goal/Arbiter/Persistence rules when the signature affects commitment
```

Hard rules:

- a signature never changes gameplay mechanics, costs, legality, or Origin effects;
- a signature never resurrects a non-viable candidate;
- unusual geometry must remain strategically useful enough for the character's Expression leeway;
- a low-difficulty character does not gain high-tier reasoning merely because its quirk is elaborate;
- a signature may exaggerate a sound tactic, but does not monopolize it: other rational controllers may use the same tactic when appropriate;
- signatures may be conditional on the rolled Origin or available structures and simply not fire when the required capability is absent;
- quirks are not mandatory for every character. A sufficiently distinctive Doctrine/controller identity is preferable to a forced gimmick.

---

## Difficulty-0 Baseline

Baseline is deliberately not a character. It exercises the complete ordinary game surface through low-tier evaluators/planners, simple arbitration, reactive persistence, strict planner-best Expression, and generic Origin literacy with no authored character preference.

---

# Character rationale and signatures

## Thorfinn Karlsefni — D3

Thorfinn's defining signature remains the **hard innocent-hostility prohibition** rather than an additional cosmetic quirk.

`THORFINN_AGGRESSOR_MEMORY` keeps a match-lifetime record of factions that directly attacked Thorfinn or attacked one of his teammates while allied. Innocent factions may never become voluntary hostility targets. Remembered aggressors remain legally targetable after peace, although renewed aggression after settlement is deliberately rare.

This must not make Thorfinn noncompetitive. Once a faction qualifies as an aggressor, he may conduct real offensive warfare, break through, seize territory, and if strategically justified dismantle that aggressor. His restraint is about **who he may attack**, not about refusing to use conquest after somebody has crossed that line.

**Identity test:** no innocent wars; very real wars against aggressors.

## Askeladd — D4

Askeladd is a strategic predator whose signature is **weaponized boundary geometry**.

When opportunity permits, he values captures or kill-steals that create awkward enemy holdings: thin salients, exposed strips, badly connected regions, frontage surrounded by hostile factions, or positions that force an opponent to defend territory they should never have acquired in that shape. The objective is leverage, not pretty borders.

This sits on top of his existing deception, infrastructure predation, sacrifice, and weak-target exploitation. Other advanced AIs may notice bad borders; Askeladd deliberately helps create them.

**Identity test:** he manipulates the map so somebody else inherits the uncomfortable position.

## Reinhard von Lohengramm — D5

Reinhard is the roster's **11/10 conquest/general-offensive specialist**.

Outside early game, a serious Reinhard offensive should normally be multi-front whenever multiple useful fronts exist. He may use nearly every valuable contact line on an awkward map rather than concentrating the whole war into one local corridor.

He may also stage a convincing preliminary attack, observe the defender's response, then launch the true broad offensive elsewhere. His preferred campaign state is not merely “winning”; it is **overwhelming the enemy across the strategic map**.

The multi-front signature remains conditional on force availability and strategic usefulness. It does not require feeding forces into obviously worthless fronts solely to satisfy a counter.

**Identity test:** when Reinhard finally attacks, the whole border becomes a problem.

## Yang Wen-li — D5

Yang is the roster's **11/10 defensive and strategic-survival specialist**, but this does **not** mean passive play.

He should be one of the hardest factions in the game to attack cleanly: strong economy, reserves, observation, geometry, withdrawals, bait recognition, counterattack timing, and option preservation. An expert player looking at Yang should rarely see an obviously safe invasion route except one Yang may be deliberately willing to expose.

At the same time, Yang remains D5 and understands that territory is power. If a neighbor exposes a momentary weakness, Yang should aggressively exploit it. He expands for security, position, buffer depth, removal of dangerous enemy footholds, ally protection, or simply because a low-risk opportunity materially strengthens his long-term position.

The distinction from Reinhard is motive and campaign shape:

```text
Reinhard: expand to dominate and impose strategic supremacy.
Yang:     expand because the position becomes safer/stronger and the opportunity is good.
```

Yang may therefore become very large. Defensive specialization changes **why and how** he conquers, not whether he is allowed to conquer.

**Identity test:** an apparently impassable object that immediately punishes the weakness you thought he would politely ignore.

## Frieren — D4

Frieren's signature is **just-in-case accumulation**.

If a useful capability can be acquired at low opportunity cost, she disproportionately likes owning it even without an immediate need: a nearby Port, observation capability, niche infrastructure, spare strategic option, or other useful tool. The behavior evokes collecting strange spells without turning into economic self-harm.

Her long-horizon controller remains willing to wait, accumulate, and then commit decisively once the advantage matures.

**Identity test:** she keeps acquiring harmlessly useful things until one of them unexpectedly matters.

## Übel — D4

Übel's visual offensive signature is **The Cut**.

When strategically advantageous, she prefers narrow and often nearly straight penetrations into enemy territory whose purpose is to sever connectivity, split regions, isolate a section, or carve a line toward something important. The cut may be a thin segment or occasionally nearly cell-wide rather than a broad conventional front.

The cut must create actual positional value. It is not permission to draw lines through enemy territory for aesthetics.

**Identity test:** her attacks leave surgical scars through the map.

## Tanya Degurechaff — D4

No forced signature gimmick is added. Tanya is already differentiated by quantified military operations: concentration, artillery preparation, strategic weapons, deep strikes, unexpected amphibious vectors, and cancellation of operations whose expected value collapses.

Other advanced controllers may use these tactics too. Tanya's distinction is how consistently she selects them when the arithmetic says they are correct.

**Identity test:** ruthless military sophistication without ornamental doctrine.

## Kiss-Shot Acerola-Orion Heart-Under-Blade — D3

No additional quirk is forced. Her existing identity remains dominance, overwhelming commitments, snowballing power, and unusual protection of truly exceptional/irreplaceable assets.

A more specific visual signature should be introduced only through a deliberate content change rather than filling the slot with generic vampire imagery.

## Hanekawa Tsubasa — D4

Hanekawa's signature is **No Blind Spots**.

She prefers unusually complete, overlapping observation/information coverage and is more willing than peer controllers to close material coverage holes. This remains budget-aware: information completeness is valuable, but she does not bankrupt the economy building Observation Posts for geometric neatness.

This complements her broader identity of continuously updating her model when evidence changes.

**Identity test:** the map around Hanekawa feels methodically observed.

## Kaiki Deishuu — D3

No extra gimmick is needed. His existing profitability model already creates a strong signature: avoid fair expensive contests, attack exposed value, use deception, and exit when the economic case disappears.

He still holds valuable captured Cities/Factories/Ports when doing so is worthwhile. “Take the money and leave” must never become abandoning the very asset that makes the conquest profitable.

## Misaka Mikoto — D3

Misaka's signature is the **Railgun Corridor**.

She prefers a supported offensive axis that can be hammered open with ranged pressure, artillery/armor where available, observation, and other useful supporting assets. It is intentionally broader and more sustained than Übel's surgical cut.

```text
Übel:  slice connectivity with a thin advantageous cut.
Misaka: build a supported lane and blast the lane open.
```

**Identity test:** a direct technically supported corridor of force rather than elaborate deception.

## Edward Wong Hau Pepelu Tivrusky IV — D2

Ed's signature is **Arcane Borders**.

Among similarly useful expansion choices, Ed prefers bizarre but legal territorial shapes: tendrils, loops, asymmetric branches, odd terrain-following curves, and boundaries that make another player wonder why the faction looks like that. Territory remains real territory, so the quirk need not be strategically useless.

Ed is also unusually willing to preserve or extend an existing weird geometry rather than immediately regularizing it.

**Identity test:** “what the hell am I looking at, and why is it somehow still working?”

## Shaula — D3

Shaula's signature is the **Pleiades Watchtower family** around a designated protected core.

When legal and useful, candidate generation may prefer recognizable arrangements such as:

```text
FORT ---- CORE ---- FORT
SAM  ---- CORE ---- SAM
FORT ---- CORE ---- SAM
```

or closely related symmetric/near-symmetric defensive tower patterns. The exact structure types depend on what the ordinary mechanics and selected Origin permit.

Other infrastructure should prefer useful exterior/peripheral positions where practical so it does not destroy the readable core motif. Once established, threats to the designated core receive extraordinary defensive priority.

**Identity test:** a recognizable protected tower/core she will fight disproportionately hard to preserve.

## Hirasawa Yui — D1

Yui's signature is generalized from one heart to **Cute Infrastructure**.

Her pattern library may propose hearts, stars, bunny/ear shapes, simple faces or `:3`-like motifs, flowers, bows, and other simple recognizable geometry using rail/infrastructure placements that remain viable within her large Expression leeway.

Cute geometry is a preference among usable plans, never permission for disconnected or catastrophically inefficient construction.

**Identity test:** useful infrastructure that periodically looks suspiciously adorable.

## Saitama — D2

Saitama's signature remains **One Punch**.

His strategic reasoning is deliberately simple. When something does not matter, urgency is low. Once he decides an attack matters, however, he prefers a simple plan with **disproportionate localized overmatch** and is willing to commit considerably more force than the minimum needed to turn likely victory into immediate decisive collapse.

This is not fear of a fair fight. Fairness is irrelevant; the fantasy is ending the selected fight in one overwhelming commitment.

**Identity test:** few clever layers, one enormous punch.

## Ferdinand — D5

Ferdinand is the roster's **11/10 economy/infrastructure specialist**.

He remains D5 elsewhere—excellent defense and conquest—but Reinhard should beat him at conquest specialization and Yang at defensive specialization. Ferdinand's exceptional domain is making the internal machine absurdly efficient.

His signature prefers dense, compact, network-integrated development: Factory/rail loops, City packing, infrastructure sequencing, minimal dead coverage, high compounding return, and continued expansion that preserves network coherence. If the mechanics permit fifteen Cities to fit productively into a loop where a human expected six, Ferdinand is the controller most likely to find it.

**Identity test:** inspect his territory and discover that every meter somehow participates in a spreadsheet.

## Power — D2

No exclusive quirk is added. Opportunistic kill-stealing, greed, visible gains, bragging-force overcommitment, spectacle, and refusal to back down already emerge across her entire playstyle.

Other deceptive or rational characters must remain free to exploit weakened enemies too; Power does not own that tactic.

## Reze — D3

No exclusive new gimmick is required. Her existing signature rhythm remains useful and recognizable:

```text
quiet/deceptive positioning
→ attack window
→ sudden breakthrough / landing / multi-domain escalation
```

Higher-difficulty controllers may use synchronized overwhelming attacks too. Reze is distinguished by how often her preferred plan follows this concealment-to-detonation rhythm, especially through infiltration/amphibious angles.

## Hitori Gotou — D2

Bocchi is an intentionally **exceptional defender for D2** while remaining weak at proactive offense and mediocre/poor at economic optimization.

Her signature family is **Fortress Bocchi**:

- unusually dense but still useful Fort coverage along exposed borders;
- layered fallback positions and natural defensive terrain;
- generous buffers around important territory;
- strong preference for retreating toward prepared safety rather than improvising offense;
- pressure-triggered panic overcommitment remains a separate volatile behavior.

When her selected allowed Origin exposes a legal scorched-earth/Fallout fallback capability, her Origin adaptation may use that capability defensively during planned withdrawal. The actual allowed-Origin pool is owned by `OFFICIAL_AI_PRESETS.md`; the Origin mechanic and reusable support remain owned by their respective Origin owners.

**Identity test:** far harder to invade than her D2 economy/offense would suggest.

## Maomao — D4

No additional exclusive gimmick is forced. Her existing causal-mechanics diagnosis is already characterful: form a hypothesis about the specific terrain/status/rule interaction causing an outcome, probe cheaply where useful, update from evidence, then exploit the mechanism.

Other analytical controllers may probe too. Maomao's distinction is her fascination with the mechanism itself rather than ownership of “testing” as a tactic.

---

# D5 specialist triangle

The three D5 controllers must remain excellent across the whole game while each having one deliberately exceptional specialty:

```text
Reinhard  — 11/10 conquest / general offensive
Yang      — 11/10 defense / strategic survival
Ferdinand — 11/10 economy / infrastructure
```

This is comparative emphasis, not hidden numerical bonuses. All three use the same legal mechanics and D5 architecture.

Reinhard may still defend brilliantly. Yang may still conquer aggressively. Ferdinand may still win wars and hold fronts exceptionally well. Their specialties describe where each controller should feel uniquely terrifying relative to another D5.

---

## Character differentiation constraints

These contrasts are durable fidelity boundaries rather than implementation-status results:

- Reinhard vs Yang vs Ferdinand — conquest vs defense vs economy specialization;
- Askeladd vs Kaiki — strategic leverage manipulation vs profitable avoidance;
- Frieren vs Hanekawa vs Maomao — long-horizon collection vs information completeness vs causal-mechanics diagnosis;
- Übel vs Misaka — thin surgical connectivity cut vs wider supported offensive corridor;
- Tanya vs Reze — expected-value military operations vs concealment-to-detonation rhythm;
- Power vs Saitama — reckless loud overcommitment vs deliberate localized overmatch;
- Shaula vs Bocchi — sacred designated core vs generalized paranoid layered defense;
- Yui vs Edward — cute useful construction geometry vs arcane useful territorial geometry.
