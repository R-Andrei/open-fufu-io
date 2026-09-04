from pathlib import Path
import re
import subprocess

path = Path('docs/OPEN_FUFU_DESIGN.md')
current = path.read_text()
base = subprocess.check_output(['git', 'show', 'origin/main:docs/OPEN_FUFU_DESIGN.md'], text=True)

section_pattern = re.compile(
    r'^## 20\. FFY economy and trade\n.*?(?=^---\n\n^## 21\. Teams, hostility, defeat, capitulation, and victory\n)',
    re.MULTILINE | re.DOTALL,
)
match = section_pattern.search(base)
if not match:
    raise SystemExit('could not extract main section 20')
section = match.group(0)

old_intro = '''FFY is the primary in-match currency and is **not** passive `Population → money per second` income.

It is generated through explicit world/economic events such as trade ship success/capture, trains/station economics, configured territorial/objective captures, piracy/capture, hostile structure capture, faction elimination, and future explicit economic events.

Population committed to warfare does not secretly reduce FFY through an unstated labor penalty.

Trade with enemies remains possible. Default wartime economic penalty direction is **50%**, subject to explicit modifiers.'''
new_intro = '''FFY is the primary in-match currency. Ordinary V1 begins with **25,000 FFY** and has a flat, non-spatial universal income floor of **1,000 FFY/s**. This baseline is independent of Population, territory, Cities, Factories, and explicit worker allocation: Open Fufu does not use passive `Population → money` taxation/assignment.

Developed FFY income comes primarily from explicit physical/economic events such as Train station service, Trade Ship voyages, piracy/captured cargo, and surfaced conquest/economy mechanics. Population committed to warfare does not secretly reduce FFY through an unstated labor penalty.

Detailed FFY/Trade/Train values and event semantics are canonical in [`FFY_ECONOMY.md`](./FFY_ECONOMY.md). Trade with enemies remains mechanically possible where route/relationship legality otherwise permits it; wartime external trade uses the accepted **0.50×** earning-side multiplier unless an explicit modifier such as P08 overrides it.'''
if old_intro not in section:
    raise SystemExit('missing old FFY intro')
section = section.replace(old_intro, new_intro, 1)

old_family = '''For modifier design, FFY should expose a **small set of broad economic source families** rather than turning every individual FFY event into a separate build-stat axis. Exact final naming belongs to implementation, but the intended shape is roughly:'''
new_family = '''For modifier design, FFY exposes a **small set of broad economic source families** rather than turning every individual FFY event into a separate build-stat axis. The accepted V1 family shape is roughly:'''
if old_family not in section:
    raise SystemExit('missing broad-family wording')
section = section.replace(old_family, new_family, 1)

needle = '''Individual events still retain their precise event identity internally for simulation, replay, and debugging. Origin/Echo modifiers normally target the broad economic family relevant to that event rather than a large catalogue of hyper-granular event-specific multipliers.'''
replacement = needle + '''\n\nThe universal `1,000 FFY/s` floor and explicit global passive Origin-income sources are non-spatial. Spatial FFY modifiers do not apply merely because the faction owns qualifying geography somewhere.'''
if needle not in section:
    raise SystemExit('missing event-identity paragraph')
section = section.replace(needle, replacement, 1)

old_factory = '''Factory level does **not** increase ordinary Train count. It scales the configured industrial/train FFY event value through the canonical `100/110/120/130/140%` L1→L5 progression in `TERRAIN_AND_STRUCTURES.md`.

The exact ordinary **FFY amount/formula** for City/Port Train events remains part of the broader FFY-economy pass alongside Trade Ship and other event payouts. Train route mechanics, stop/event semantics, speed, dwell, occupancy, turnaround, P07 quantity behavior, and P33 Population behavior are no longer blocked on that payout value.'''
new_factory = '''Factory level does **not** increase ordinary Train count. The accepted provisional L1→L5 ordinary Train-event base values are:

```text
10,000 / 11,250 / 12,500 / 13,750 / 15,000 FFY
```

The physical service rules, payout ownership/modifier semantics, and broader FFY economy are specified in `FFY_ECONOMY.md`; the route mechanics, stop/event semantics, speed, dwell, occupancy, turnaround, P07 quantity behavior, P33 Population behavior, and level-specific base payouts are no longer open design questions.'''
if old_factory not in section:
    raise SystemExit('missing stale Factory payout paragraphs')
section = section.replace(old_factory, new_factory, 1)

updated, count = section_pattern.subn(section.rstrip() + '\n\n', current, count=1)
if count != 1:
    raise SystemExit(f'expected one current section-20 match, got {count}')
path.write_text(updated)
