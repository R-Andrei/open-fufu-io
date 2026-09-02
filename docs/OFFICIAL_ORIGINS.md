# Open Fufu — Canonical Official Origin Roster

## Status and authority

This document is the **canonical content registry for Official Origins**.

It does not replace [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md), which remains authoritative for game mechanics and Origin-system rules, or [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md), which remains authoritative for migration/implementation direction.

The seven builds below are the accepted first Official Origin roster. Their **mechanical trait combinations are canonical provisionally for the first catalogue pass**, while their current display names are explicitly working names and are expected to be replaced later, preferably with suitable anime/JRPG-reference identities.

Official Origins obey exactly the same public builder rules and deployed trait catalogue as Custom Origins. No Official Origin receives hidden points, hidden traits, compatibility exceptions, or creator-only mechanics.

Current builder constraints for this roster:

```text
Base Origin Points:       10
Maximum selected traits:   5
Maximum drawback refund:  10
Maximum positive spend:   20
```

Point costs remain subject to catalogue balance revision. If a trait is repriced, the Official builds must remain ordinary legal builds under the same public rules or be revised openly.

---

## O01 — Last Bastion

**Display name status:** temporary.

**Strategic identity:** extreme territorial defense, defender preservation, selective counterattack, poor power projection.

Selected traits:

1. **Elastic automatic defense** — `10`: when an automatically defended population-bearing cell is captured, its automatic defender survives and remains/returns Available; the attacker still pays the ordinary defended-capture casualty and ownership/Capacity transfer normally.
2. **Improved Forts** — `5`: `+10% Fort coverage area, +9% Fort defensive pressure, -8% Fort cost`.
3. **Mountain defensive doctrine** — `4`: Mountains offer `+33% defensive pressure`.
4. **Weak Plains offense** — `-4`: `25% reduced Plains offensive pressure`.
5. **Disastrous amphibious projection** — `-7`: `50% of Transport Ship Population dies when landing`.

Accounting:

```text
positive spend: 19
raw drawbacks:   11
usable refund:   10
traits:           5
```

Design intent:

- exceptionally difficult to dislodge from prepared/high-value terrain;
- can trade territory while preserving Population;
- should reward controllers that distinguish land worth holding from land worth yielding;
- deliberately poor at broad open-terrain conquest and overseas power projection;
- retains access to Factories and Warships so its drawbacks remain about projection rather than arbitrary industrial denial.

---

## O02 — Golden City

**Display name status:** temporary.

**Strategic identity:** concentrated peaceful infrastructure, trade wealth, extremely consequential structure placement.

Selected traits:

1. **No wartime trade penalty** — `4`: ordinary wartime trade multiplier becomes `1.0` instead of `0.5`.
2. **Fast Trade Ships** — `5`: `+25% Trade Ship speed`.
3. **More trains** — `4`: `+25% amount of trains spawned`.
4. **Fully developed City purchases** — provisional `6`: purchased Cities can only be bought directly at level 5 for `95%` of the ordinary cumulative level-1 build plus level-2-through-level-5 upgrade cost.
5. **One of each structure** — `-10`: cannot own more than one of each structure type.

Accounting:

```text
positive spend: 19
usable refund:   10
traits:           5
```

Design intent:

- a rich city-state / concentrated infrastructure economy rather than broad structure spam;
- placement of the single City, Port, Factory, Fort, Silo, and SAM becomes strategically defining;
- war does not automatically destroy the trade economy;
- losing one key structure may be catastrophic;
- peaceful/economic without being strategically passive.

---

## O03 — Rail-Demographic Origin

**Display name status:** temporary and expected to change.

**Strategic identity:** Population through circulation; rail activity and utilization management replace passive demographic simplicity.

Selected traits:

1. **30–70% utilization-growth profile** — `9`: replaces the ordinary Population-utilization growth curve with the accepted wide 30–70% profile.
2. **More trains** — `4`: `+25% amount of trains spawned`.
3. **Population from City train stops** — provisional `6`: when a valid train stops at an owned City, that City owner gains the trait-defined amount of Available Population, capped by Capacity; exact Population amount remains tuning data.
4. **Weaker ordinary City Growth** — `-4`: Cities contribute `20% less Population Growth`.
5. **No Warships** — `-6`: cannot build Warships.

Accounting:

```text
positive spend: 19
usable refund:   10
traits:           5
```

Design intent:

- Population comes from a deliberately managed demographic/railway engine rather than a generic `+Population` bonus;
- the controller should value active rail circulation through Cities;
- direct train-stop Population and the wide utilization sweet spot create a distinct Population-management problem;
- ordinary passive City Growth is weaker;
- the faction is strongly continental and cannot establish conventional Warship dominance.

---

## O04 — Spoils of Empire

**Display name status:** temporary.

**Strategic identity:** conquest-fed economy, stolen industry, terrain-sensitive aggression.

Selected traits:

1. **Structure-capture FFY** — `8`: capturing enemy structures generates military/conquest FFY events.
2. **Conquered Factory amplification** — provisional `6`: Factories acquired from another faction by conquest operate at `2×` ordinary Factory effect while owned.
3. **Highland offensive doctrine** — `4`: `+33% offensive pressure on Highlands`.
4. **Cannot build Factories** — `-6`.
5. **Weak Plains offense** — `-4`: `25% reduced Plains offensive pressure`.

Accounting:

```text
positive spend: 18
usable refund:   10
traits:           5
```

Design intent:

- cannot create its own industrial base normally and therefore wants to seize one;
- enemy infrastructure becomes an explicit strategic target rather than incidental territory;
- conquered Factories are unusually valuable and captured structures fund further conquest;
- favors Highland approaches and performs poorly in broad Plains offensives;
- should cause a controller to choose enemies partly from visible infrastructure and geography.

---

## O05 — Iron Tide

**Display name status:** temporary.

**Strategic identity:** expensive, fast, armored, self-fortifying amphibious invasion without conventional naval combat supremacy.

Selected traits:

1. **Fortified amphibious landings** — provisional `7`: Transport embarkation receives `+250 FFY`; a successful landing grants a permanent level-1 Fort at the landing location.
2. **Armored Port-launched Transports** — `6`: Transports may embark only from explicitly selected owned active Ports, but become armored/health-bearing.
3. **Fast Transports** — `6`: Transport Ships are `25% faster`.
4. **Cannot build Warships** — `-6`.
5. **Weaker ordinary City Growth** — `-4`: Cities contribute `20% less Population Growth`.

Accounting:

```text
positive spend: 19
usable refund:   10
traits:           5
```

Design intent:

- highly capable amphibious invasion apparatus with no conventional Warship screen;
- Transport launches are economically meaningful rather than disposable spam;
- successful landings immediately establish persistent Fort-backed beach positions;
- controllers must solve launch-Port selection, route/timing risk, concentration, and follow-up without owning a normal battle fleet;
- aggressive and high-risk rather than a generic naval-superiority faction.

---

## O06 — Gemini

**Display name status:** temporary.

**Strategic identity:** two starting territorial blobs, one global resource system, severe infrastructure concentration decisions.

Selected traits:

1. **Split strategic origin** — `10`: two influence areas, each `50%` of ordinary influence area; one exact origin is selected in each; final Initial Territory is split approximately equally between the two starting footprints; Starting Population remains one unchanged global pool.
2. **Larger Initial Territory** — `7`: `+15% Initial Territory`, applied once to the faction's final total before the split.
3. **One of each structure** — `-10`: cannot own more than one of each structure type.

Accounting:

```text
positive spend: 17
usable refund:   10
traits:           3
```

Design intent:

- the deliberately wonky Official Origin;
- may start in nearby regions for safety or in radically separated regions for strategic reach;
- both territorial blobs share one global Population/economy rather than local resource pools;
- having only one of each structure forces the controller to decide which geographic half receives unique infrastructure;
- showcases strategic-spawn programming and multi-region controller reasoning more directly than any other initial Official Origin.

---

## O07 — Corsair State

**Display name status:** temporary.

**Strategic identity:** piracy/trade economy whose Warships are economic raiders rather than naval battle units.

Selected traits:

1. **Pirate-Warship conversion** — `6`: Warships move `+50% faster` and piracy FFY is `3×` baseline, but Warships cannot use naval gunfire against ships; they retain Trade Ship pursuit/capture behavior.
2. **Fast Trade Ships** — `5`: `+25% Trade Ship speed`.
3. **Expanded Port repair zones** — `6`: Ports project substantially larger repair zones and Warships inside receive strong repair without docking while remaining operational.
4. **Disastrous amphibious landings** — `-7`: `50% of Transport Ship Population dies when landing`.

Accounting:

```text
positive spend: 17
usable refund:    7
traits:           4
```

Design intent:

- the sea is primarily an economic space rather than a conquest space;
- Warships hunt merchants and evade real battle fleets instead of contesting them directly;
- Ports act as raider safe-harbors/forward repair zones;
- fast Trade Ships reinforce the maritime economy;
- amphibious conquest is deliberately poor, preventing the strong naval economy from trivially converting into overseas territorial domination.

---

## Roster coverage

The first seven Official Origins intentionally demonstrate different controller problems rather than seven variants of generic stat optimization:

| Origin | Primary strategic lesson |
| --- | --- |
| O01 Last Bastion | extreme defense, selective retreat, Population preservation |
| O02 Golden City | concentrated infrastructure and peaceful/trade wealth |
| O03 Rail-Demographic Origin | Population utilization + rail circulation |
| O04 Spoils of Empire | conquest economy and stolen infrastructure |
| O05 Iron Tide | high-risk fortified amphibious invasion |
| O06 Gemini | split strategic spawning and multi-region resource allocation |
| O07 Corsair State | piracy/trade economy without conventional naval battle power |

This first roster deliberately does not require every major mechanic family to have an Official Origin. In particular, a dedicated nuclear Official Origin may be added later without displacing one of these seven merely to satisfy category symmetry.

---

## Naming pass still required

The roster mechanics are accepted; **most or all current display names are placeholders**.

A later content pass should replace them with thematic names, preferably anime/JRPG references where a reference fits the actual mechanical identity. Naming must not change the bound mechanical build or silently alter trait accounting.
