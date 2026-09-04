from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "docs/OPEN_FUFU_DESIGN.md",
    "The accepted ordinary influence radius, exact-origin spacing, deterministic collision fallback, simultaneous quota-limited footprint construction, five-second spawn immunity, and P54 star-footprint transformation are specified in [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md). Low-level queue/hash/data-structure choices remain implementation/versioning details; these gameplay geometry rules are no longer open design questions.",
    "The accepted ordinary influence radius, exact-origin spacing, deterministic hook fallbacks, stable tie-hash domains/orderings, conflict resolution, simultaneous quota-limited multi-frontier footprint construction, fixed-point P54 star rasterization, diagnostics/replay binding, five-second spawn immunity, and resolver-version semantics are specified in [`STRATEGIC_SPAWN.md`](./STRATEGIC_SPAWN.md). Implementation may choose equivalent internal data structures only where they preserve that canonical observable ordering and output; the resolver algorithm is no longer an open design question.",
)

p = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")
text = p.read_text()
start = text.index("## 28. Remaining implementation/content/validation work")
end = text.index("\nThe following are no longer open design questions", start)
section = text[start:end]

# Make room for an explicit Official AI implementation item after Origin content.
for n in range(15, 2, -1):
    section = re.sub(rf"(?m)^{n}\. \*\*", f"{n + 1}. **", section)

origin_line = "2. **Origin content maintenance** — future additions/revisions and playtest repricing remain possible under the same builder/catalogue rules; the V1 trait/Official-Origin naming pass and duplicate cleanup are complete."
ai_line = "3. **Official AI controller implementation/benchmarking** — implement the actual character-specific strategic controllers described by `OFFICIAL_AI_PRESETS.md`, verify every preset operates coherently across its allowed Origin pool, then benchmark/playtest against the provisional difficulty targets and retune controller strength or target labels without adding simulation cheats."
if section.count(origin_line) != 1:
    raise RuntimeError("remaining-work Origin item not found exactly once")
section = section.replace(origin_line, origin_line + "\n" + ai_line, 1)
text = text[:start] + section + text[end:]
p.write_text(text)

# Final targeted contradiction assertions.
design = Path("docs/OPEN_FUFU_DESIGN.md").read_text()
integration = Path("docs/OPENFRONT_INTEGRATION_PLAN.md").read_text()
for stale in [
    "Low-level queue/hash/data-structure choices remain implementation/versioning details",
    "memory/directive/action changes commit together",
]:
    if stale in design or stale in integration:
        raise RuntimeError(f"stale wording survived: {stale}")
if "Official AI controller implementation/benchmarking" not in integration:
    raise RuntimeError("Official AI implementation missing from remaining-work list")
