from pathlib import Path


def replace_section(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"{label}: start marker missing")
    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f"{label}: end marker missing")
    return text[:a] + replacement.rstrip() + "\n\n" + text[b:]


design_path = Path("docs/OPEN_FUFU_DESIGN.md")
design = design_path.read_text()
design_section = '''### 17.5 Optional water-nuke mode — Accepted V1

Open Fufu retains **Water Nukes** as an optional V1 ruleset mode. The mode is **OFF by default**.

When enabled, the **fully affected inner blast zone** of each resolved strategic-weapon explosion permanently converts eligible terrain to **Deep Water**. The irregular outer blast annulus retains the ordinary nuclear result: affected owned population-bearing land becomes neutral and receives Fallout while preserving its underlying terrain.

| Weapon | Permanent Deep-Water core | Ordinary neutral/Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | `0–12` cells | `12–30` cells |
| Hydrogen Bomb | `0–80` cells | `80–100` cells |
| MIRV warhead | `0–12` cells | `12–18` cells |

These radii reuse the already accepted ordinary weapon geometry. A surfaced modifier that changes ordinary blast geometry changes the water-conversion geometry through that same rule; P25's Hydrogen `+50% blast area` receives no separate hidden water-nuke multiplier.

Inside a water-nuke core:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → Deep Water / unchanged
Impassable      → unchanged
```

Ordinary nuclear ownership/Population/Capacity/unit/structure consequences resolve before terrain conversion. Converted cells are unowned, non-population-bearing, non-buildable, removed from ordinary conquerable territory, and carry no Fallout overlay.

Overlapping water-nuke explosions convert the **union of eligible inner-core cells**; processing order cannot change the final terrain result.

Converted Deep Water immediately changes ordinary movement/pathing, naval connectivity, coast/shore geometry, Population Capacity, future build/traversal legality, and the conquerable-territory denominator. Nuclear-created canals and coasts are real gameplay geography.

Segment identity remains immutable and Segments are not regenerated at runtime. Controllers observe changed terrain normally and may read the enabled mode through versioned `RulesView` values. V1 adds no separate geographic-tag system.

Water Nukes intentionally receive no hidden anti-cheese exception. If enabled by the lobby, erasing land, shrinking the victory denominator, cutting canals, isolating territory, and reshaping coastlines are legitimate consequences.

A City does not create extra Population casualties merely because it is a City. Physical units, transports, structures, fleets, and offensive forces actually affected by the weapon may take their own explicit local damage in addition to the terrain-linked Population rule.'''
design = replace_section(design, "### 17.5 Optional water-nuke mode", "---\n\n## 18. Terrain and structures", design_section, "design")
design = design.replace("- optional water-nuke conversion geometry and other explicitly optional ruleset minutiae not already pinned;\n", "")
design = design.replace(
    "30. **Optional water-nuke rules may convert land to non-population-bearing Deep Water and thereby remove it from the conquerable-territory denominator.**",
    "30. **Water Nukes are an optional default-OFF V1 ruleset: each weapon's fully affected inner blast zone converts eligible land/Shallow Water to permanent Deep Water, while the outer blast annulus keeps ordinary neutralization/Fallout; converted terrain immediately changes Capacity, conquest denominator, pathing/naval/coast topology while Segment identity remains immutable.**",
)
if "### 17.5 Optional water-nuke mode — Accepted V1" not in design:
    raise RuntimeError("design accepted Water Nukes section missing")
design_path.write_text(design)

integration_path = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")
integration = integration_path.read_text()
integration_section = '''### 15.4 Optional water-nuke mode — Accepted V1

Retain Water Nukes as a **default-OFF optional V1 ruleset** and implement the canonical geometry from `NAVAL_AND_STRATEGIC_WEAPONS.md` / `OPEN_FUFU_DESIGN.md` rather than inheriting unspecified OpenFront terrain destruction.

For every Atom, Hydrogen, or individual MIRV-warhead explosion, the ordinary **fully affected inner blast zone** is also the permanent Deep-Water conversion core. The irregular outer blast annulus keeps standard neutralization + Fallout behavior. Accepted core/fringe radii are Atom `12 / 30`, Hydrogen `80 / 100`, and MIRV warhead `12 / 18`, with surfaced blast-geometry modifiers applying consistently.

Eligible land and Shallow Water in the core become Deep Water after ordinary nuclear casualty/destruction resolution; existing Deep Water remains Deep Water and Impassable terrain is unchanged. Converted cells are unowned, non-population-bearing, non-buildable, excluded from ordinary conquerable territory, and carry no Fallout overlay. Overlapping cores resolve as a deterministic union.

Terrain mutation immediately updates traversal/pathing, naval connectivity, coast/shore classification, Capacity, and victory-denominator behavior. Segment IDs remain immutable and the runtime does not regenerate Segments. `RulesView` exposes the versioned ruleset value needed for controllers to know Water Nukes are enabled.

There is no hidden anti-cheese exception: canal-cutting, coastline reshaping, land deletion, isolation, and denominator reduction are legitimate consequences when the option is enabled.'''
integration = replace_section(integration, "### 15.4 Optional water-nuke mode", "---\n\n## 16. Teams, diplomacy, `atWar`, defeat, capitulation, and victory — Accepted", integration_section, "integration")
integration = integration.replace("16. **Optional ruleset minutiae not yet pinned**, especially water-nuke conversion geometry.\n\n", "")
integration = integration.replace(
    "Warship/Transport/Port-repair and Atom/Hydrogen/MIRV data (`NAVAL_AND_STRATEGIC_WEAPONS.md`)",
    "Warship/Transport/Port-repair and Atom/Hydrogen/MIRV plus default-OFF Water-Nuke geometry (`NAVAL_AND_STRATEGIC_WEAPONS.md`)",
)
if "### 15.4 Optional water-nuke mode — Accepted V1" not in integration:
    raise RuntimeError("integration accepted Water Nukes section missing")
integration_path.write_text(integration)

naval_path = Path("docs/NAVAL_AND_STRATEGIC_WEAPONS.md")
naval = naval_path.read_text()
water = '''## 1.6 Optional Water Nukes — Accepted V1

Water Nukes are a **default-OFF optional V1 ruleset**. When enabled, the fully affected inner blast zone of every resolved strategic-weapon explosion is also a permanent Deep-Water conversion core; the irregular outer annulus keeps ordinary neutralization + Fallout.

| Weapon | Deep-Water core | Ordinary Fallout fringe |
| --- | ---: | ---: |
| Atom Bomb | **0–12** | **12–30** |
| Hydrogen Bomb | **0–80** | **80–100** |
| MIRV warhead | **0–12** | **12–18** |

These are the ordinary accepted blast radii reused directly. Water Nukes define no second hidden radius. Surfaced blast-geometry modifiers therefore apply consistently, including P25's Hydrogen `+50% blast area`.

For each eligible core cell, ordinary nuclear ownership/Population/Capacity/unit/structure consequences resolve first, then terrain converts:

```text
ordinary land   → Deep Water
Shallow Water   → Deep Water
Deep Water      → unchanged Deep Water
Impassable      → unchanged
```

Converted cells are unowned, non-population-bearing, non-buildable, removed from ordinary conquerable territory, and have no Fallout overlay. Overlapping explosion cores convert the deterministic union of eligible cells; warhead order cannot alter the result.

The resulting Deep Water immediately participates in naval connectivity, pathing/traversal, coast/shore derivation, Capacity and victory calculations. Nuclear-created canals and coasts are real gameplay geography. Segment membership remains the immutable map-compiled Segment identity.

There is no hidden anti-cheese protection. If the lobby enables Water Nukes, erasing land, cutting canals, isolating territory, reshaping coasts, or reducing the conquerable-land denominator is legal.'''
old_sentence = "Optional water-nuke rules remain a separate ruleset mode and may permanently convert affected land to Deep Water under their existing explicit semantics."
if "## 1.6 Optional Water Nukes — Accepted V1" not in naval:
    if old_sentence in naval:
        naval = naval.replace(old_sentence, water, 1)
    else:
        marker = "\n---\n\n# 2. MIRV"
        pos = naval.find(marker)
        if pos < 0:
            raise RuntimeError("naval MIRV section marker missing")
        naval = naval[:pos] + "\n\n" + water + naval[pos:]
if "## 1.6 Optional Water Nukes — Accepted V1" not in naval:
    raise RuntimeError("naval accepted Water Nukes section missing")
naval_path.write_text(naval)
