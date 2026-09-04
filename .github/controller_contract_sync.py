from pathlib import Path

path = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")
text = path.read_text()

replacements = {
    "## 6A. Public controller API contract — Accepted direction":
        "## 6A. Public controller API contract — Accepted",
    "Exact final TypeScript names/types remain prototype work, but the public context should cover concepts equivalent to:":
        "The V1 TypeScript controller surface is defined in `src/core/controller/ControllerApi.ts`; the public context covers:",
    "1. **Exact final TypeScript API names/types and ergonomic naming** after prototype pressure-testing of the accepted controller contract, including pre-match spawn hooks and public Origin/effective-modifier views.":
        "1. **Controller API runtime wiring/certification** — the V1 TypeScript contract is now defined in `src/core/controller/ControllerApi.ts`; remaining work is implementing the immutable observation projection, validated directive/command adapter, sandbox bridge, certification harness, and later non-semantic ergonomic polish.",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"missing expected integration text: {old}")
    text = text.replace(old, new, 1)

path.write_text(text)
