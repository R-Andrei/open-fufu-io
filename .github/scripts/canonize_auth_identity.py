from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def replace_section(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f"{label}: start marker not found")
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f"{label}: end marker not found")
    return text[:a] + replacement.rstrip() + "\n\n" + text[b:]


# Canonical design contract.
path = Path("docs/OPEN_FUFU_DESIGN.md")
text = path.read_text()
text = replace_once(
    text,
    "Foof may own Discord-facing commands, identity handoff, lobby/match initiation, controller/Origin/Echo-loadout selection where useful, links into browser surfaces, and result/reward presentation.",
    "Foof may own Discord-facing commands, optional calls to Open Fufu's generic integration/game APIs, lobby/match initiation, controller/Origin/Echo-loadout selection where useful, links into browser surfaces, and result/reward presentation.",
    "Foof boundary wording",
)
text = replace_once(
    text,
    "Open Fufu should remain independently coherent if Foof is absent.\n",
    "Open Fufu should remain independently coherent if Foof is absent.\n\nAuthentication, local account linkage, sessions, and the external identity-provisioning boundary are defined canonically in [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md). Open Fufu authenticates identities but does **not** decide admission policy: external systems may provision/revoke provider-qualified identities through a generic integration API, while normal browser login checks only the resulting local identity mapping. Open Fufu has no runtime-login dependency on Fufubox, Fufu Control, or Foof.\n",
    "auth boundary insertion",
)
text = replace_once(
    text,
    "- exact wire protocol/session encoding and the remaining Discord/session/auth transport details;",
    "- implementation of the settled `AUTH_AND_IDENTITY.md` contract, including the Discord identity-provider adapter, opaque server-side sessions, CSRF/origin checks, generic integration provisioning endpoints/credentials, and security tests;",
    "deferred auth bullet",
)
text = replace_once(
    text,
    "SQLite schema/index/backup/retention model, and the detailed gameplay values",
    "SQLite schema/index/backup/retention model, authentication/identity/session/provisioning contract, and the detailed gameplay values",
    "closed-spec summary",
)
text = replace_once(
    text,
    "81. **Canonical archival replays are minimal compressed deterministic input/action records with no periodic full-state seek checkpoints; playback fast-forwards the deterministic simulation from match start and does not require re-executing player controllers or persisting controller memory/debug state.**",
    "81. **Canonical archival replays are minimal compressed deterministic input/action records with no periodic full-state seek checkpoints; playback fast-forwards the deterministic simulation from match start and does not require re-executing player controllers or persisting controller memory/debug state.**\n82. **Open Fufu authenticates only pre-provisioned external identities: admission policy lives outside the game behind the generic integration boundary, successful OAuth never auto-registers a player, V1 uses opaque server-side sessions, and normal login has no runtime dependency on Fufubox, Fufu Control, or Foof.**",
    "auth invariant",
)
path.write_text(text)


# Migration / implementation plan.
path = Path("docs/OPENFRONT_INTEGRATION_PLAN.md")
text = path.read_text()
new_auth = '''## 20. Authentication, identity, sessions, and external provisioning — Accepted V1

Implement the canonical contract in [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md).

The core responsibility split is closed:

```text
external authority decides admission
        ↓ generic integration API
pre-provisioned provider-qualified identity in Open Fufu

browser proves identity through configured provider adapter
        ↓
Open Fufu checks its own linked identity
        ↓
internal user + Open Fufu session
```

Open Fufu must remain blind to **why** an identity was provisioned. Do not import Fufubox users, Fufu Control roles, Foof permissions, firewall grants, approval reasons, or another product's authorization model into game state. Fufubox/Fufu Control/Foof may be current provisioners, but Open Fufu does not call them during normal login and must remain movable to another host without them.

V1 browser identity proof uses a replaceable provider-adapter boundary with one production adapter: **Discord OAuth2 Authorization Code flow**, stable numeric Discord user ID, random `state`, PKCE/S256, server-side exchange, and short-lived transient OAuth state. A successful OAuth callback never auto-creates a player: `(provider, provider_subject)` must already exist and be active in `linked_identities` or access is denied.

V1 machine provisioning is the deliberately small generic surface:

```text
POST /api/integration/v1/identities/provision
POST /api/integration/v1/identities/revoke
```

Provision is idempotent; a first provision creates the local user/link, reprovisioning a revoked identity restores the same local account, and revoke disables that login path plus active sessions without deleting game progression/history. External systems never write Open Fufu SQLite directly.

Authenticate integration callers with one or more named Open-Fufu-owned opaque 256-bit bearer credentials supplied from private runtime secret configuration. Browser sessions cannot call the integration surface. V1 does not need a Fufu-style service-role database merely for these two endpoints.

V1 browser sessions are opaque 256-bit random tokens stored only as SHA-256 verifiers in SQLite. Use the production cookie `__Host-openfufu_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, and a **30-day absolute TTL**. Do not preserve the inherited refresh-cookie → 15-minute JWT chain, browser bearer-token storage, or `persistentID` development fallback.

Authenticated browser mutations use the session cookie plus same-origin/Origin checks and `X-Open-Fufu-CSRF`; the CSRF value may be HMAC-derived from the raw session token with a dedicated server secret. V1 exposes no credentialed cross-origin browser API.

WebSocket upgrade authenticates from the Open Fufu session cookie plus Origin validation, then binds the internal user/session identity for later message authorization. Do not put JWTs, Discord tokens, or session tokens in WebSocket query strings.

Match processes receive only internal game-facing participant identity/configuration and never Discord tokens, browser cookies, integration credentials, external roles, or admission-policy data. Existing sessions and running matches do not depend on Discord/Fufu/Foof availability after session establishment.
'''
text = replace_section(
    text,
    "## 20. Authentication and identity — Accepted V1 direction",
    "## 21. Persistence — Accepted V1 SQLite baseline",
    new_auth,
    "section 20",
)
text = replace_once(
    text,
    "The initial V1 persistence model is **16 core tables**.",
    "The initial V1 persistence model is **17 core tables**.",
    "table count",
)
text = replace_once(
    text,
    "provider_subject     TEXT NOT NULL\nuser_id              INTEGER NOT NULL REFERENCES users(id)\ncreated_at_ms        INTEGER NOT NULL\n\nPRIMARY KEY(provider, provider_subject)\n```\n\nSession-cookie transport/expiry/CSRF details remain part of the later auth pass; they are not grounds to keep the persistence schema itself open.",
    "provider_subject     TEXT NOT NULL\nuser_id              INTEGER NOT NULL REFERENCES users(id)\ncreated_at_ms        INTEGER NOT NULL\nrevoked_at_ms        INTEGER\n\nPRIMARY KEY(provider, provider_subject)\n```\n\nThe row is retained across revocation so re-provisioning the same provider/subject restores the same local Open Fufu user rather than creating a duplicate account. Active login requires `revoked_at_ms IS NULL`. Admission rationale/policy is deliberately not stored here; see `AUTH_AND_IDENTITY.md`.",
    "linked identities schema",
)
insert_after = "Do not put multi-megabyte replay/debug payloads into SQLite BLOBs merely because SQLite can store them.\n\n"
sessions = '''#### 17. `sessions`

V1 browser sessions are local Open Fufu operational state. Store only a verifier of the high-entropy cookie token:

```text
id                   INTEGER PRIMARY KEY
user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
token_sha256         BLOB NOT NULL UNIQUE CHECK(length(token_sha256) = 32)
created_at_ms        INTEGER NOT NULL
expires_at_ms        INTEGER NOT NULL
revoked_at_ms        INTEGER
```

The browser holds the raw 256-bit random token in the `__Host-openfufu_session` HttpOnly cookie. SQLite never needs the plaintext token. Expired/revoked session rows may be removed by ordinary cleanup and are not permanent account history.

Integration/provisioner bearer credentials remain private deployment secrets rather than relational user/session rows in V1.

'''
text = replace_once(text, insert_after, insert_after + sessions, "sessions table insertion")
text = replace_once(
    text,
    "replays(expires_at_ms)\n```",
    "replays(expires_at_ms)\nsessions(user_id, expires_at_ms)\nsessions(expires_at_ms)\n```",
    "session indexes",
)
text = replace_once(
    text,
    "| Open Fufu-owned SQLite persistence | **New / Adapt surrounding session infrastructure** |",
    "| Open Fufu-owned SQLite persistence | **New; include pre-provisioned external identities and opaque server-side sessions** |",
    "classification persistence row",
)
text = replace_once(
    text,
    "12. SQLITE / DISCORD AUTH / ECHO OWNED-ROLL+ECHO-SET\n    + MIDDLE-FINGERS+PAID-PITY+PENDING-SETTLEMENT STATE / FOOF API",
    "12. SQLITE / EXTERNAL-IDENTITY PROVISIONING API / DISCORD PROVIDER ADAPTER / OPAQUE SESSIONS\n    + ECHO OWNED-ROLL+ECHO-SET / MIDDLE-FINGERS+PAID-PITY+PENDING-SETTLEMENT STATE / GAME API",
    "migration spine auth stage",
)
text = replace_once(
    text,
    "8. **Persistence implementation and migration coverage** — implement `node:sqlite`, migration `0001_initial.sql`, the accepted 16-table schema/index set, idempotent transactional settlements, online backups, replay/log cleanup, and persistence tests. The database architecture/schema/retention choices themselves are closed.",
    "8. **Persistence implementation and migration coverage** — implement `node:sqlite`, migration `0001_initial.sql`, the accepted 17-table schema/index set, idempotent transactional settlements, opaque-session persistence/cleanup, online backups, replay/log cleanup, and persistence tests. The database architecture/schema/retention choices themselves are closed.",
    "remaining persistence",
)
text = replace_once(
    text,
    "9. **Exact Discord/session/auth transport details** including cookies/expiry/CSRF and optional later Fufubox credential linking.",
    "9. **Authentication/integration implementation** — implement the closed `AUTH_AND_IDENTITY.md` contract: generic provision/revoke endpoints and integration credentials, Discord provider adapter, pre-provisioned identity lookup/revocation, opaque 30-day sessions, CSRF/Origin enforcement, WebSocket session binding, and security/integration tests. Admission policy and Fufubox/Fufu/Foof coupling are explicitly outside Open Fufu.",
    "remaining auth",
)
text = replace_once(
    text,
    "the controller-memory codec/lifecycle (`CONTROLLER_MEMORY.md`), strategic Segment generation/representation (`SEGMENTS.md`), minimal fast-forward replay model,",
    "the controller-memory codec/lifecycle (`CONTROLLER_MEMORY.md`), strategic Segment generation/representation (`SEGMENTS.md`), authentication/identity/session/provisioning contract (`AUTH_AND_IDENTITY.md`), minimal fast-forward replay model,",
    "closed questions summary",
)
path.write_text(text)


# Inherited OpenFront auth doc: keep the body as historical evidence, but make the banner current.
path = Path("docs/Auth.md")
text = path.read_text()
old_banner = "> **Open Fufu status:** This documents the inherited/current OpenFront authentication flow only. It is **not** the target Open Fufu auth design. Open Fufu's accepted V1 direction is Discord OAuth2 → internal Open Fufu user → Open Fufu session, as recorded in [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md). The target game contract is [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md). If this file conflicts with the canonical Open Fufu documents, the canonical documents win."
new_banner = "> **Open Fufu status:** This documents the inherited/current OpenFront authentication flow only. It is **not** the target Open Fufu auth design. The accepted target is [`AUTH_AND_IDENTITY.md`](./AUTH_AND_IDENTITY.md): external systems provision/revoke provider-qualified identities through a generic integration boundary; V1 browser login proves Discord identity and accepts it only when that local identity is already active; Open Fufu then uses an opaque server-side session. Open Fufu does not reproduce external admission policy and has no normal-login dependency on Fufubox, Fufu Control, or Foof. The canonical design and integration plan take precedence over the inherited flow below."
text = replace_once(text, old_banner, new_banner, "Auth.md banner")
path.write_text(text)


# Sanity checks for known stale statements.
checks = {
    Path("docs/OPEN_FUFU_DESIGN.md"): [
        "exact wire protocol/session encoding and the remaining Discord/session/auth transport details",
        "Foof may own Discord-facing commands, identity handoff",
    ],
    Path("docs/OPENFRONT_INTEGRATION_PLAN.md"): [
        "The initial V1 persistence model is **16 core tables**.",
        "Session-cookie transport/expiry/CSRF details remain part of the later auth pass",
        "Exact Discord/session/auth transport details",
        "optional later Fufubox linking mechanics remain implementation work",
    ],
}
for p, stale in checks.items():
    current = p.read_text()
    for phrase in stale:
        if phrase in current:
            raise RuntimeError(f"stale phrase survived in {p}: {phrase}")
