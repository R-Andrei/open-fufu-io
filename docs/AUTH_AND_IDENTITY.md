# Open Fufu — Authentication, Identity, Sessions, and External Provisioning

## Status

This document is the canonical V1 appendix for Open Fufu authentication, external identity linkage, browser sessions, and the machine-to-machine identity-provisioning boundary.

It is subordinate to [`OPEN_FUFU_DESIGN.md`](./OPEN_FUFU_DESIGN.md) and is implemented through the migration direction in [`OPENFRONT_INTEGRATION_PLAN.md`](./OPENFRONT_INTEGRATION_PLAN.md).

The central architectural rule is:

> **Open Fufu authenticates external identities and recognizes identities that have already been provisioned to it. Open Fufu does not decide who should be admitted and does not reproduce the policy by which an external system chose to provision or revoke an identity.**

Open Fufu must remain a standalone service. Fufubox, Fufu Control, Foof, a future identity/administration service, or a manual operator tool may provision identities, but none of those systems is a runtime dependency of normal Open Fufu login, sessions, matches, persistence, or replay.

---

## 1. Trust and responsibility split

Open Fufu separates four concerns:

```text
network reachability
    deployment/firewall concern

external admission policy
    external-system concern

proof of browser identity
    configured Open Fufu identity-provider adapter

local game account/session
    Open Fufu concern
```

Open Fufu intentionally does **not** model concepts such as:

- Fufubox users or Unix users;
- Fufu Control roles;
- Foof permissions;
- firewall/network grants;
- why a person was approved;
- who approved a person;
- an `isApproved` game-account field whose value recreates an external authorization policy.

The only local admission fact Open Fufu needs is whether a successfully authenticated external identity currently maps to an active local `linked_identities` record.

---

## 2. Canonical external identity

External identities use the provider-qualified pair:

```text
(provider, provider_subject)
```

Conceptually:

```ts
interface ExternalIdentity {
    provider: string;
    subject: string;
}
```

For V1 ordinary browser login:

```text
provider = "discord"
subject  = stable Discord numeric user ID as a decimal string
```

Mutable usernames, display names, server nicknames, emails, avatars, or other presentation fields are never authentication identifiers.

The provisioner is **not** the identity provider. Fufu Control, Foof, or another external system may provision `discord:123...`, but Open Fufu still authenticates that browser as `discord:123...` through its own Discord OAuth adapter.

---

## 3. External provisioning boundary

### 3.1 Admission policy stays outside the game

An external authority decides whether an identity should exist in Open Fufu.

Today that decision may be informed by Fufubox/Fufu Control/Foof state. A future deployment may use a completely different system. Open Fufu neither knows nor cares.

The dependency direction is one-way:

```text
Fufu Control ───────┐
Foof ───────────────┤
future admin/SSO ───┼──> generic Open Fufu integration API
manual admin tool ──┘

Open Fufu does not call those systems during login.
```

Open Fufu never reads an external system's database directly and external systems never write Open Fufu's SQLite database directly.

### 3.2 V1 integration endpoints

V1 exposes a deliberately small machine-to-machine provisioning surface:

```text
POST /api/integration/v1/identities/provision
POST /api/integration/v1/identities/revoke
```

These endpoints are separate from ordinary browser/user APIs.

A provisioning request contains only identity data plus an optional non-authoritative display-name hint:

```json
{
  "provider": "discord",
  "subject": "123456789012345678",
  "display_name_hint": "Ski"
}
```

The display-name hint is used only when creating a new local user and is never an authorization fact. Open Fufu owns its game-facing display name thereafter.

### 3.3 Provision semantics

Provision is idempotent.

If the identity has never existed:

```text
create Open Fufu user
create linked identity
return existing/new user public ID
```

If the identity already exists and is active:

```text
return the existing Open Fufu user
```

If the identity exists but was revoked:

```text
reactivate the same linked identity
retain the same Open Fufu user/progression
return that existing user
```

A successful browser OAuth callback **never** creates an Open Fufu user. Account creation occurs only through this external provisioning boundary.

### 3.4 Revoke semantics

Revocation marks that external identity inactive and invalidates all currently active Open Fufu sessions for the linked user.

Revocation does **not** delete the user, controller versions, Origins, Echoes, progression, match history, or other game records. Re-provisioning the same provider/subject restores access to the same local account.

If future accounts may have multiple active login identities, revoking one identity removes that login path; session invalidation remains conservative and may close all sessions for the user.

### 3.5 Integration-client authentication

The provisioning API requires an Open-Fufu-owned machine credential; browser sessions cannot invoke it.

V1 uses one or more named **opaque 256-bit bearer credentials** supplied through private runtime secret configuration. Credentials are:

- independent from Discord OAuth credentials;
- independent from browser session tokens;
- independent from Fufu/Foof service credentials;
- never committed to Git;
- individually replaceable by deployment configuration;
- used only for the narrow integration surface.

Open Fufu may log the integration-client label that performed provision/revoke for operational audit, but it does not receive or persist the external system's approval rationale, role model, or policy state.

V1 does not need an Open-Fufu service-principal/role database merely to authenticate this tiny provisioning API. If broader machine-to-machine APIs later justify first-class service principals, that can be added without changing the identity model.

---

## 4. Identity-provider adapter boundary

Open Fufu keeps browser identity proof behind a small provider adapter rather than making the rest of the application Discord-specific.

Conceptually:

```ts
interface IdentityProvider {
    beginLogin(...): Promise<LoginStart>;
    completeLogin(...): Promise<ExternalIdentity>;
}
```

The rest of the application sees only `ExternalIdentity`.

V1 ships one production adapter:

```text
Discord OAuth2
→ { provider: "discord", subject: "<stable Discord user ID>" }
```

A future OIDC/Entra/custom provider may add another adapter without changing account, controller, match, progression, or session tables.

Provision requests must name a provider that the deployed Open Fufu build/configuration recognizes. V1 therefore provisions ordinary login identities under `discord` only.

---

## 5. Discord OAuth2 login — Accepted V1

Use a server-side Authorization Code flow with:

- minimum identity scope required to retrieve the stable Discord user ID;
- cryptographically random OAuth `state`;
- PKCE/S256;
- server-side code exchange;
- a validated local-relative return path only;
- short-lived transient OAuth state/verifier storage, maximum 10 minutes.

OAuth transient cookies/state are not account sessions and need no database table.

After the callback:

```text
Discord proves external identity
        ↓
Open Fufu looks up active linked_identities(provider, subject)
        ↓
found      → issue Open Fufu session
not found  → deny access
revoked    → deny access
```

Discord access/refresh credentials are not retained as long-term Open Fufu credentials. Open Fufu uses the provider result to establish the external identity, then relies on its own local session.

A Discord outage may prevent establishing a new Discord-backed login but must not interrupt an already established Open Fufu session or a running match.

---

## 6. Local account linkage

Open Fufu game data uses its own internal `users.id` and externally surfaced random `users.public_id`.

Do not use the Discord ID as a universal game-data primary key.

The mapping is:

```text
(provider, subject)
        ↓
linked_identities
        ↓
users.id
        ↓
controllers / Origins / Echoes / progression / matches
```

Why the identity was provisioned is not represented in this chain.

---

## 7. Browser session model — Accepted V1

V1 does not carry forward the inherited refresh-cookie → short-JWT browser architecture.

Use one opaque Open Fufu session token:

```text
256-bit cryptographically random token
    ↓
HttpOnly cookie in browser
    ↓
SHA-256 verifier in SQLite sessions table
    ↓
internal users.id
```

There is:

- no Open Fufu JWT requirement;
- no Open Fufu refresh-token hierarchy;
- no bearer token in `localStorage`;
- no need to expose the raw session token to JavaScript.

### 7.1 Production cookie

```text
__Host-openfufu_session=<opaque token>

Secure
HttpOnly
SameSite=Lax
Path=/
no Domain attribute
Max-Age=2592000
```

The V1 lifetime is a **30-day absolute TTL**. It does not slide on every request and therefore does not require `last_seen` writes.

Multiple browsers/devices may hold independent sessions.

Logout revokes the current session and clears the cookie. A logout-all operation revokes all sessions belonging to the user.

### 7.2 Session persistence

SQLite stores only the SHA-256 digest/verifier of the high-entropy raw session token.

Expired or revoked session rows are operational state rather than permanent account history and may be removed by routine cleanup.

---

## 8. CSRF and browser-origin rules

Authenticated browser mutations require defense in depth:

```text
valid session cookie
+
allowed same-origin request
+
Origin validation
+
X-Open-Fufu-CSRF header
```

The browser-visible CSRF token may be derived from the raw session token with a dedicated server-side HMAC key:

```text
base64url(HMAC-SHA256(csrfHmacKey, rawSessionToken))
```

A session/bootstrap endpoint may return that CSRF token to the authenticated frontend, which keeps it in memory and sends it as `X-Open-Fufu-CSRF` for state-changing HTTP requests.

`GET`, `HEAD`, and `OPTIONS` remain non-mutating.

V1 does not expose a credentialed cross-origin browser API. SameSite is defense in depth, not the sole CSRF control.

---

## 9. WebSocket authentication

Do not put JWTs, Discord credentials, or session tokens into WebSocket query strings.

On WebSocket upgrade:

```text
browser sends Open Fufu session cookie
        ↓
gateway validates Origin
        ↓
gateway resolves session verifier locally
        ↓
socket binds internal user/session identity
```

SQLite is not queried for every WebSocket message. After upgrade, ordinary authorization uses the established internal identity plus lobby/match/resource ownership state.

Revoking a known session should close any live sockets bound to it where the gateway can do so.

---

## 10. Authorization inside Open Fufu

A client-supplied user/resource ID never proves authority.

The server derives the actor from the authenticated session and separately checks ownership/membership:

```text
session → users.id
resource.user_id / match membership → authorization
```

Request bodies cannot assert a canonical actor or role.

Match child processes receive only internal game-facing participant identity/configuration. They never receive Discord tokens, OAuth transient state, browser session cookies, integration credentials, or external-system policy data.

---

## 11. Portability and deployment independence

Normal Open Fufu operation requires only Open Fufu's own runtime dependencies:

```text
application build
SQLite database
map/rules/content data
Discord OAuth credentials for the V1 login adapter
Open Fufu private secrets/configuration
```

Moving Open Fufu from Fufubox to another host must not require moving Fufu Control or Foof with it.

External provisioners only need the new Open Fufu integration endpoint and an Open Fufu integration credential. A different administrative system can replace the previous provisioner without migrating game logic or account data.

Network/firewall restrictions remain deployment defense in depth and are deliberately outside this application-level identity contract.

---

## 12. Development/testing

Development may use an explicit test/local identity-provider adapter or fixture provisioning path, but it must be unmistakably non-production and must not recreate the inherited insecure rule that possession of a `persistentID` alone is authentication.

Production startup must not silently enable development authentication fallbacks.

---

## 13. Canonical V1 invariants

1. **Authentication is not admission policy.** Open Fufu proves an external identity; an external system decides whether that identity was provisioned.
2. **Successful OAuth never auto-registers a player.** An active linked identity must already exist.
3. **Open Fufu has no runtime login dependency on Fufubox, Fufu Control, or Foof.**
4. **External systems provision through the generic Open Fufu API, never by writing Open Fufu SQLite directly.**
5. **Open Fufu does not ingest external roles, network grants, approval reasons, or authorization models.**
6. **Provider-qualified stable subjects are the external identity key; mutable presentation fields are not.**
7. **Internal Open Fufu user IDs own game data; provider subjects do not become universal primary keys.**
8. **Revocation removes login ability and active sessions without deleting game history/progression.**
9. **V1 browser sessions are opaque server-side sessions, not JWT/refresh-token chains.**
10. **Discord/Fufu/Foof credentials never enter match processes or controller sandboxes.**
11. **The identity-provider adapter is replaceable; Discord is the V1 provider, not a permanent architectural dependency.**
12. **Moving Open Fufu to another host must not require moving its former provisioning authority with it.**
