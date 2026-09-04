from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "docs/OPEN_FUFU_DESIGN.md",
    "A complete invalid controller decision, such as simultaneous commitments exceeding legal Available Population, is rejected as a whole. The engine does not silently normalize or partially apply it.",
    "A complete invalid **game-facing mutation set**, such as simultaneous commitments exceeding legal Available Population, is rejected as a whole. The engine does not silently normalize or partially apply that mutation set. This does not roll back separately validated controller memory: valid memory from the same structurally valid callback remains committed under `CONTROLLER_MEMORY.md`.",
)

replace_once(
    "docs/OPENFRONT_INTEGRATION_PLAN.md",
    "A normal controller invocation operates transactionally against one immutable legal observation. On success, memory/directive/action changes commit together. On failure, temporary output is discarded.",
    "A normal controller invocation operates against one immutable legal observation. Callback/output/memory validity is resolved first: valid controller memory may commit independently. Game-facing directive/action mutations then retain their transactional final-desired-set validation. Ordinary gameplay rejection does not roll back valid memory; a runtime/malformed-output fault discards all newly proposed output.",
)

for path in ["docs/OPEN_FUFU_DESIGN.md", "docs/OPENFRONT_INTEGRATION_PLAN.md"]:
    body = Path(path).read_text()
    if "memory/directive/action changes commit together" in body:
        raise RuntimeError(f"{path}: stale commit-together wording survived")
