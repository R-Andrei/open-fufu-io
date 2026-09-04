from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


# Design contract
path = Path("docs/OPEN_FUFU_DESIGN.md")
text = path.read_text()
old = '''### 17.5 Optional water-nuke mode

Open Fufu retains the inherited **water-nukes** concept as an optional ruleset mode.

When enabled, affected land that would ordinarily become neutral fallout may instead be permanently converted to Deep Water according to the weapon/ruleset. Converted water is non-population-bearing and no longer ordinary conquerable land, so it is excluded from the current conquerable-territory denominator after conversion.

The same owned-cell Population casualty/Capacity-loss event still applies when the strike destroys the owner's population-bearing land. Segment identity remains immutable even when terrain is converted to water.

A City does not create extra Population casualties merely because it is a City; Cities modify growth, not Capacity/current-Population-per-cell semantics.

Physical units, transports, structures, fleets, and offensive forces actually affected by the weapon may take their own explicit local damage in addition to the terrain-linked Population rule.

Exact weapon radii, lethality against physical units, interception, and terrain-destruction values are tuning/translation work.'''
new = '''### 17.5 Optional water-nuke mode — Accepted V1

Open Fufu retains **Water Nukes** as an optional V1 ruleset mode. The mode is **OFF by default**.

When enabled, the **fully affected inner blast zone** of each resolved strategic-weapon explosion permanently converts eligible terrain to **Deep Water**. The irregular outer blast annulus retains the ordinary nuclear result: affected owned population-bearing land becomes neutral and receives Fallout while preserving its underlying terrain.

The canonical V1 conversion radii therefore reuse the already accepted weapon geometry rather than introducing a second water-nuke radius table:

| Weapon | Permanent Deep-Water core | Ordinary neutral/Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | `0–12` cells | `12–30` cells |
| Hydrogen Bomb | `0–80` cells | `80–100` cells |
| MIRV warhead | `0–12` cells | `12–18` cells |

A modifier that changes ordinary blast geometry changes the water-conversion geometry through that same surfaced rule. In particular, P25's `+50% Hydrogen Bomb blast area` scales the existing Hydrogen geometry; it does not receive a separate hidden water-nuke multiplier.

Inside a water-nuke core, terrain conversion is:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → Deep Water / unchanged
Impassable      → unchanged
```

Owned-cell Population casualties, Capacity loss, structure/unit destruction, and other ordinary nuclear-hit consequences resolve before the terrain conversion. A cell converted to Deep Water is unowned, non-population-bearing, non-buildable, and no longer ordinary conquerable territory. It carries no Fallout overlay after conversion.

Overlapping water-nuke explosions apply conversion to the **union of all eligible inner-core cells**; weapon/warhead processing order cannot change the final terrain result.

Conversion immediately affects ordinary topology and rules that depend on terrain: conquerable-territory denominator, Population Capacity, movement/pathing, naval connectivity, coastline/shoreline geometry, and future build/traversal legality. New Deep Water is real Deep Water; a nuclear-cut canal or newly created coast is therefore mechanically real.

Segment identity remains immutable even when a Segment's cells change terrain, and no runtime Segment regeneration occurs. Controllers observe the changed terrain through ordinary cell/Segment terrain views and may read the mode through the versioned public ruleset (`RulesView`). No separate V1 geographic-tag system is introduced.

Water Nukes intentionally receive no hidden anti-cheese exception. If a lobby enables the mode, permanently deleting land, shrinking the victory denominator, creating canals, isolating territory, or reshaping coastlines are legitimate consequences of that optional ruleset.

A City does not create extra Population casualties merely because it is a City; Cities modify growth, not Capacity/current-Population-per-cell semantics. Physical units, transports, structures, fleets, and offensive forces actually affected by the weapon may take their own explicit local damage in addition to the terrain-linked Population rule.'''
text = replace_once(text, old, new, "design water-nuke section")
text = text.replace(
    "- optional water-nuke conversion geometry and other explicitly optional ruleset minutiae not already pinned;\n",
    "",
)
text = replace_once(
    text,
    "30. **Optional water-nuke rules may convert land to non-population-bearing Deep Water and thereby remove it from the conquerable-territory denominator.**",
    "30. **Water Nukes are an optional default-OFF V1 ruleset: each weapon's fully affected inner blast zone converts eligible land/Shallow Water to permanent Deep Water, while the outer blast annulus keeps ordinary neutralization/Fallout; converted terrain immediately changes Capacity, conquest denominator, pathing/naval/coast topology while Segment identity remains immutable.**",
    "design invariant",
)
path.write_text(text)


# Integration plan
path = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")
text = path.read_text()
old = '''### 15.4 Optional water-nuke mode

Retain OpenFront's `waterNukes` concept as an optional ruleset mode.

When enabled, affected land may be converted to **Deep Water** rather than ordinary Fallout. Converted Deep Water is non-population-bearing and no longer ordinary conquerable territory, so the current victory denominator shrinks accordingly. Segment identity remains unchanged.'''
new = '''### 15.4 Optional water-nuke mode — Accepted V1

Retain Water Nukes as a **default-OFF optional V1 ruleset** and implement the canonical geometry from `NAVAL_AND_STRATEGIC_WEAPONS.md` / `OPEN_FUFU_DESIGN.md` rather than inheriting unspecified OpenFront terrain destruction.

For every Atom, Hydrogen, or individual MIRV-warhead explosion, the ordinary **fully affected inner blast zone** is also the permanent Deep-Water conversion core. The irregular outer blast annulus keeps standard neutralization + Fallout behavior. The accepted core/fringe radii are therefore Atom `12 / 30`, Hydrogen `80 / 100`, and MIRV warhead `12 / 18`, with ordinary surfaced blast-geometry modifiers (including P25) applying consistently.

Eligible land and Shallow Water in the core become Deep Water after ordinary nuclear casualty/destruction resolution; existing Deep Water remains Deep Water and Impassable terrain is unchanged. Converted cells are unowned, non-population-bearing, non-buildable, excluded from ordinary conquerable territory, and carry no Fallout overlay. Overlapping cores resolve as a deterministic union.

The terrain mutation must immediately update authoritative traversal/pathing, naval connectivity, coast/shore classification, Capacity, and victory-denominator behavior. Segment IDs remain immutable and the runtime does not regenerate Segments. `RulesView` exposes the versioned ruleset flag/value needed for controllers to know Water Nukes are enabled.

There is no hidden anti-cheese exception: with the option enabled, canal-cutting, coastline reshaping, land deletion, isolation, and denominator reduction are legitimate ruleset consequences.'''
text = replace_once(text, old, new, "integration water-nuke section")
text = replace_once(
    text,
    "16. **Optional ruleset minutiae not yet pinned**, especially water-nuke conversion geometry.\n\n",
    "",
    "integration backlog water-nuke item",
)
text = replace_once(
    text,
    "the complete Strategic Spawn resolver/geometry/versioning contract (`STRATEGIC_SPAWN.md`), terrain/structures/Tank/Heavy-Artillery data (`TERRAIN_AND_STRUCTURES.md`), Warship/Transport/Port-repair and Atom/Hydrogen/MIRV data (`NAVAL_AND_STRATEGIC_WEAPONS.md`), Minor-Faction/Goon semantics",
    "the complete Strategic Spawn resolver/geometry/versioning contract (`STRATEGIC_SPAWN.md`), terrain/structures/Tank/Heavy-Artillery data (`TERRAIN_AND_STRUCTURES.md`), Warship/Transport/Port-repair and Atom/Hydrogen/MIRV plus default-OFF Water-Nuke geometry (`NAVAL_AND_STRATEGIC_WEAPONS.md`), Minor-Faction/Goon semantics",
    "integration closed-list water nukes",
)
path.write_text(text)


# Naval/strategic-weapons numeric appendix
path = Path("docs/NAVAL_AND_STRATEGIC_WEAPONS.md")
text = path.read_text()
old = '''Optional water-nuke rules remain a separate ruleset mode and may permanently convert affected land to Deep Water under their existing explicit semantics.'''
new = '''## 1.6 Optional Water Nukes — Accepted V1

Water Nukes are a **default-OFF optional V1 ruleset**. When enabled, the fully affected inner blast zone of every resolved strategic-weapon explosion is also a permanent Deep-Water conversion core; the irregular outer annulus keeps ordinary neutralization + Fallout.

| Weapon | Deep-Water core | Ordinary Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | **0–12** | **12–30** |
| Hydrogen Bomb | **0–80** | **80–100** |
| MIRV warhead | **0–12** | **12–18** |

These are the ordinary accepted blast radii reused directly. Water Nukes do not define a second hidden radius. Any surfaced modifier to blast geometry therefore changes both ordinary and water-nuke geometry consistently; P25's Hydrogen `+50% blast area` is the canonical example.

For each eligible cell inside the resolved core, apply ordinary nuclear ownership/Population/Capacity/unit/structure consequences first, then convert terrain:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → unchanged Deep Water
Impassable      → unchanged
```

A converted cell is unowned, non-population-bearing, non-buildable, removed from the ordinary conquerable-territory denominator, and has no Fallout overlay. Overlapping explosion cores use the deterministic union of eligible core cells; warhead order cannot alter the result.

The resulting Deep Water participates immediately in ordinary naval connectivity, pathing/traversal, coast/shore derivation, Capacity and victory calculations. Nuclear-created canals and coasts are therefore real gameplay geography. Segment membership remains the map-compiled immutable Segment identity even if terrain inside that Segment changes.

The ruleset intentionally provides no anti-cheese protection against terrain destruction. If enabled by the lobby, using strategic weapons to erase land, cut canals, isolate territory, reshape coasts, or reduce the remaining conquerable-land denominator is legal behavior under that ruleset.'''
text = replace_once(text, old, new, "naval water-nuke section")
path.write_text(text)


# Guard against known stale formulations.
checks = {
    "docs/OPEN_FUFU_DESIGN.md": [
        "optional water-nuke conversion geometry and other explicitly optional ruleset minutiae not already pinned",
        "may instead be permanently converted to Deep Water according to the weapon/ruleset",
    ],
    "docs/OPENFRONT_INTEGRATION_PLAN.md": [
        "Optional ruleset minutiae not yet pinned",
        "affected land may be converted to **Deep Water** rather than ordinary Fallout",
    ],
    "docs/NAVAL_AND_STRATEGIC_WEAPONS.md": [
        "may permanently convert affected land to Deep Water under their existing explicit semantics",
    ],
}
for filename, stale in checks.items():
    body = Path(filename).read_text()
    for phrase in stale:
        if phrase in body:
            raise RuntimeError(f"stale water-nuke wording survived in {filename}: {phrase}")
