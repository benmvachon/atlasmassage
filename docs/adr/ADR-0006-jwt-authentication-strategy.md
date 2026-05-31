# ADR-0006 — JWT Authentication Strategy

**Status**: Accepted

**Date**: 2026-05-31

## Context

We need a stateless authentication mechanism that scales across PM2 cluster workers without a shared session store, while still supporting token revocation (logout, security breach). The application runs on a single server; no distributed environment is planned in the near term.

## Decision

Use **short-lived JWT access tokens (15 minutes) combined with database-tracked rotating refresh tokens (30 days)**.

- Access tokens: `HS256` symmetric signing with `JWT_ACCESS_SECRET`. Validated statelessly on every request — no DB lookup.
- Refresh tokens: cryptographically random, stored as SHA-256 hash in `refresh_tokens` table. Revoked on logout and rotated on every use.
- Refresh tokens delivered via `HttpOnly; Secure; SameSite=Strict` cookie to prevent XSS theft.
- Access tokens stored in memory (JavaScript variable) on the frontend — never in localStorage.

See [authentication-architecture.md](../authentication-architecture.md) for full lifecycle diagrams.

## Consequences

### Positive

- No shared session store required — works with PM2 cluster mode
- Refresh token rotation means stolen tokens are detected on next legitimate use
- Short access token lifetime (15 min) limits exposure window if a token is leaked
- `HttpOnly` cookie prevents JS access to refresh token

### Negative / Trade-offs

- Access tokens cannot be individually revoked before expiry (15-min window)
- Symmetric signing (`HS256`) is fine for single-server but must be replaced with `RS256` if tokens are ever verified by a third party
- Refresh token DB lookup adds latency at the `/auth/refresh` endpoint (acceptable — infrequent)

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Server-side sessions (Redis) | Requires session store infrastructure; adds operational complexity |
| Opaque tokens only | Every request requires a DB lookup; does not scale to cluster without shared store |
| RS256 asymmetric JWT | Overkill for single-server deployment; adds key management complexity |
| Long-lived JWT (no refresh) | Cannot revoke tokens; unacceptable security trade-off |
