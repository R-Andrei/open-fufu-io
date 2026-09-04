from pathlib import Path

path = Path("docs/OFFICIAL_ORIGINS.md")
text = path.read_text()
old = "| Gemini | **O06 — Somewhere Not Here** |"
new = "| Gemini | **O06 — Gemini** |"
if text.count(old) != 1:
    raise SystemExit(f"expected one stale Gemini migration row, got {text.count(old)}")
text = text.replace(old, new)
path.write_text(text)
print("Origin migration table synchronized")
