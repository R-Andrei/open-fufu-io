from pathlib import Path
import re

TRAITS = Path("docs/ORIGIN_TRAIT_CATALOGUE.md")
ORIGINS = Path("docs/OFFICIAL_ORIGINS.md")
AI = Path("docs/OFFICIAL_AI_PRESETS.md")
DESIGN = Path("docs/OPEN_FUFU_DESIGN.md")
INTEGRATION = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")

trait_names = {
    "P01": "Domain Expansion",
    "P02": "The Era of Humans",
    "P03": "Imagine Breaker",
    "P04": "Level 0",
    "P05": "Big Shot",
    "P06": "See You, Space Cowboy",
    "P07": "Galaxy Express 999",
    "P08": "Tea Time",
    "P09": "Wall Maria",
    "P10": "Scorpion's Tail",
    "P11": "Level Upper",
    "P12": "Somewhere Not Here",
    "P13": "Mountain Training Arc",
    "P14": "60 Billion Double Dollars",
    "P15": "The High Ground",
    "P16": "Poison Taster",
    "P17": "Ten Billion Percent",
    "P18": "The Best Defense",
    "P19": "The Weak Die First",
    "P20": "A Miracle Is Merely a Miscalculation",
    "P21": "Fun Things Are Fun",
    "P22": "Limit Break",
    "P23": "Space Battleship Yamato",
    "P24": "A King's Price",
    "P25": "EXPLOSION!",
    "P26": "Serious Punch",
    "P27": "Only My Railgun",
    "P28": "Blood Devil",
    "P29": "The Kaiser",
    "P30": "The Conman",
    "P31": "Heart-Under-Blade",
    "P32": "Armored Titan",
    "P33": "Misaka Network",
    "P34": "Spoils of the Empire",
    "P35": "It's a Matter of Visualization",
    "P36": "Half-Priced Bento",
    "P37": "The City Mouse",
    "P38": "Return by Death",
    "P39": "Stereo Separation",
    "P40": "Barrier Magic",
    "P41": "Level 5",
    "P42": "The Price of Empire",
    "P43": "The Devil of the Rhine",
    "P44": "Nobel Prize",
    "P45": "Hidden Leaf Village",
    "P46": "Northern Lands",
    "P47": "This Is Poison",
    "P48": "Aqua's Blessing",
    "P49": "Laughing Man",
    "P50": "Iserlohn Fortress",
    "P51": "One Flag Beneath the Stars",
    "P52": "Humanity Has Declined",
    "P53": "Money Is Everything",
    "P54": "Starlight Breaker",
    "N01": "The Lost Decade",
    "N02": "Flat Is Justice",
    "N03": "I Hate Sand",
    "N04": "Northern Expedition",
    "N05": "Curse of the Abyss",
    "N06": "No Second Season",
    "N07": "One Piece",
    "N08": "It's Just Decoration",
    "N09": "Medieval Isekai",
    "N10": "Domain Contraction",
    "N11": "Absolute Territory",
    "N12": "Panzer Vor!",
    "N13": "Beach Episode Gone Wrong",
    "N14": "To Them Words Are Merely a Means to Deceive",
    "N15": "King's Ransom",
    "N16": "Insurance Fraud",
    "N17": "I Can Cut It",
    "N18": "I Have No Enemies",
}

origin_renames = {
    "O01": ("I Have No Enemies", "A True Warrior Needs No Sword"),
    "O02": ("Tea Time", "Fuwa Fuwa Time"),
    "O04": ("Spoils of Empire", "Right of Conquest"),
    "O05": ("The Country Mouse and the City Mouse", "The Country Mouse"),
    "O06": ("Somewhere Not Here", "Gemini"),
    "O07": ("The Conman", "The Fake Is of Far Greater Value"),
    "O11": ("Fun Things Are Fun", "Light Music Club"),
    "O17": ("To Them Words Are Merely a Means to Deceive", "Section 9"),
    "O21": ("Heart-Under-Blade", "Iron-Blooded Vampire"),
    "O22": ("The Weak Die First", "Survival of the Fittest"),
    "O23": ("Money Is Everything", "Woolong Hustle"),
    "O24": ("The Devil of the Rhine", "203rd Mage Battalion"),
    "O25": ("I Can Cut It", "If I Can Imagine It"),
    "O30": ("A Miracle Is Merely a Miscalculation", "Being X"),
    "O33": ("It's a Matter of Visualization", "Everything Will Turn to Ash"),
    "O34": ("This Is Poison", "The Dose Makes the Poison"),
    "O45": ("Level 5", "Tokiwadai Ace"),
    "O46": ("Nobel Prize", "1000 IQ"),
    "O47": ("Blood Devil", "Operation Super-Smart"),
    "O48": ("Humanity Has Declined", "Girls' Last Tour"),
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing expected text: {label}: {old!r}")
    return text.replace(old, new, 1)


traits = TRAITS.read_text()
for trait_id, name in trait_names.items():
    pattern = re.compile(rf"(\| {re.escape(trait_id)} \| )\*\*X\*\*( \|)")
    traits, count = pattern.subn(rf"\1**{name}**\2", traits, count=1)
    if count != 1:
        raise SystemExit(f"expected one X row for {trait_id}, got {count}")

traits = replace_once(
    traits,
    "Trait names are intentionally left as `X` until the final anime/JRPG-reference naming pass. Temporary IDs (`Pxx` and `Nxx`) exist only so candidates can be discussed unambiguously.",
    "Trait names below are the accepted V1 player-facing naming baseline. Stable mechanical IDs (`Pxx` and `Nxx`) remain canonical identifiers for rules, saves/replays, tests, and future content maintenance even when display wording is later polished.",
    "trait naming status",
)
TRAITS.write_text(traits)

origins = ORIGINS.read_text()
origins = origins.replace(
    "Display names are also provisional thematic names and may receive a later wording/reference cleanup without silently changing mechanics.",
    "Display names below are the accepted V1 naming baseline and remain separable from the stable Oxx mechanical/content IDs.",
)
origins = origins.replace(
    "- Duplicate mechanical builds under different presentation names are generally undesirable; **O35/O36 are currently a known provisional duplicate pair** and should be differentiated or consolidated before implementation if a good distinction is found.\n",
    "- Duplicate mechanical builds under different presentation names are generally undesirable; the former O35 duplicate was retired rather than preserving two names for the same build.\n",
)
for origin_id, (old, new) in origin_renames.items():
    origins = replace_once(origins, f"**{origin_id} — {old}**", f"**{origin_id} — {new}**", f"origin row {origin_id}")

# Retire O35 without renumbering later stable IDs.
lines = origins.splitlines()
filtered = [line for line in lines if not line.startswith("| **O35 — Curiosity Killed the Cat** |")]
if len(filtered) != len(lines) - 1:
    raise SystemExit("expected exactly one O35 roster row to retire")
origins = "\n".join(filtered) + ("\n" if origins.endswith("\n") else "")
origins = origins.replace(
    "Bizarre-terrain settlement doctrine; currently mechanically identical to Curiosity Killed the Cat pending later differentiation.",
    "Bizarre-terrain settlement doctrine that treats Tundra, Shallow Water, Fallout, and cheap neutral settlement as opportunities.",
)

# Keep the migration table synchronized with renamed O01-O07 identities.
for old, new in [
    ("**O01 — I Have No Enemies**", "**O01 — A True Warrior Needs No Sword**"),
    ("**O02 — Tea Time**", "**O02 — Fuwa Fuwa Time**"),
    ("**O04 — Spoils of Empire**", "**O04 — Right of Conquest**"),
    ("**O05 — The Country Mouse and the City Mouse**", "**O05 — The Country Mouse**"),
    ("**O07 — The Conman**", "**O07 — The Fake Is of Far Greater Value**"),
]:
    origins = origins.replace(old, new)

origins = origins.replace(
    "### Existing seven-origin roster migration\n\nThe original seven Official Origin builds remain present mechanically, but have been absorbed into the expanded thematic library:",
    "### Existing seven-origin roster migration\n\nThe original seven Official Origin builds remain present mechanically, but have been absorbed into the expanded thematic library; display titles below reflect the accepted naming pass:",
)
origins = origins.replace(
    "1. final display-name/reference cleanup;\n2. differentiation or consolidation of the current O35/O36 duplicate build;\n3. playtest repricing/revision if trait costs change;\n4. UI art/presentation for Official Origins;\n5. runtime data schema/import representation;\n6. exhaustive legality/invariant validation against the deployed trait catalogue;\n7. future additions where an AI preset or player-facing fantasy genuinely needs another build.",
    "1. playtest repricing/revision if trait costs change;\n2. UI art/presentation for Official Origins;\n3. runtime data schema/import representation;\n4. exhaustive legality/invariant validation against the deployed trait catalogue;\n5. future additions where an AI preset or player-facing fantasy genuinely needs another build.",
)
ORIGINS.write_text(origins)

ai = AI.read_text()
# Rename every Origin title used in character pools.
for _, (old, new) in origin_renames.items():
    ai = ai.replace(f"**{old}**", f"**{new}**")
# Retire O35 from Frieren/Edward/Maomao pools rather than redirecting the duplicate.
ai = ai.replace(" · **Curiosity Killed the Cat**", "")
ai = ai.replace("**Curiosity Killed the Cat** · ", "")
if "Curiosity Killed the Cat" in ai:
    raise SystemExit("retired O35 still appears in Official AI presets")
AI.write_text(ai)

# Remove stale naming/duplicate cleanup from high-level open-work ledgers.
design = DESIGN.read_text()
design = design.replace(
    "- final player-facing Origin trait names/IDs, Official-Origin wording/reference cleanup, and later playtest repricing of provisional trait costs without reopening accepted mechanics;",
    "- later playtest repricing of provisional Origin-trait costs or future catalogue additions without reopening accepted mechanics;",
)
DESIGN.write_text(design)

integration = INTEGRATION.read_text()
integration = integration.replace(
    "2. **Origin content cleanup** — final player-facing trait names/IDs and anime/JRPG/reference presentation, plus consolidation/differentiation of any remaining duplicate Official Origin content such as the current O35/O36 pair. Catalogue costs remain playtest-repriceable without reopening accepted mechanics.",
    "2. **Origin content maintenance** — future additions/revisions and playtest repricing remain possible under the same builder/catalogue rules; the V1 trait/Official-Origin naming pass and former O35/O36 duplicate cleanup are complete.",
)
INTEGRATION.write_text(integration)

# ---- Validation ----
trait_text = TRAITS.read_text()
if "| **X** |" in trait_text:
    raise SystemExit("unnamed trait remains")

trait_rows = re.findall(r"^\| ((?:P|N)\d{2}) \| \*\*(.*?)\*\* \|", trait_text, re.MULTILINE)
if len(trait_rows) != 72:
    raise SystemExit(f"expected 72 trait rows, got {len(trait_rows)}")
trait_name_values = [name for _, name in trait_rows]
if len(set(trait_name_values)) != len(trait_name_values):
    dupes = sorted({n for n in trait_name_values if trait_name_values.count(n) > 1})
    raise SystemExit(f"duplicate trait display names: {dupes}")

origin_text = ORIGINS.read_text()
origin_rows = re.findall(r"^\| \*\*(O\d{2}) — (.*?)\*\* \|", origin_text, re.MULTILINE)
if len(origin_rows) != 49:
    raise SystemExit(f"expected 49 active Official Origin rows after retiring O35, got {len(origin_rows)}")
if any(oid == "O35" for oid, _ in origin_rows) or "Curiosity Killed the Cat" in origin_text:
    raise SystemExit("O35 retirement incomplete")
origin_names = [name for _, name in origin_rows]
if len(set(origin_names)) != len(origin_names):
    dupes = sorted({n for n in origin_names if origin_names.count(n) > 1})
    raise SystemExit(f"duplicate Official Origin display names: {dupes}")
collisions = sorted(set(origin_names) & set(trait_name_values))
if collisions:
    raise SystemExit(f"trait/Official-Origin exact-name collisions remain: {collisions}")

if "O35/O36" in DESIGN.read_text() or "O35/O36" in INTEGRATION.read_text():
    raise SystemExit("stale O35/O36 cleanup wording remains in high-level ledgers")

print("Final naming validation passed")
print(f"traits: {len(trait_rows)} ({sum(1 for i,_ in trait_rows if i.startswith('P'))} positive, {sum(1 for i,_ in trait_rows if i.startswith('N'))} negative)")
print(f"official origins: {len(origin_rows)} active; O35 retired")
print("exact trait/origin name collisions: 0")
