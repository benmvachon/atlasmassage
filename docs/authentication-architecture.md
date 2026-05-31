# Authentication Architecture

> See [ADR-0005](adr/ADR-0005-role-based-access-control.md) and [ADR-0006](adr/ADR-0006-jwt-authentication-strategy.md).

## Strategy Overview

Atlas Massage uses a stateless JWT access token combined with a database-tracked refresh token. This balances statelessness (no session store required for normal requests) with revocability (refresh tokens can be individually invalidated).

## Token Lifecycle

```
┌────────────┐   POST /auth/login   ┌─────────────────────────────┐
│   Client   │ ──────────────────►  │  API                        │
│            │                      │  1. Verify credentials       │
│            │ ◄────────────────── │  2. Issue access token (15m) │
│            │  { accessToken,      │  3. Issue refresh token      │
│            │    refreshToken }     │  4. Store refresh_tokens row │
└────────────┘                      └─────────────────────────────┘

Normal request:
  Authorization: Bearer <accessToken>
  → Validated client-side (JWT signature + expiry only)
  → No DB lookup needed

Token refresh (when access token expires):
  POST /auth/refresh { refreshToken }
  → Hash token → lookup in refresh_tokens table
  → Verify not expired, not revoked
  → Issue new access token + new refresh token (rotation)
  → Revoke old refresh token row

Logout:
  POST /auth/logout { refreshToken }
  → Mark refresh token row as revoked
```

## Access Token

- Algorithm: `HS256` (symmetric; single-server deployment)
- Lifetime: 15 minutes
- Payload:
  ```json
  {
    "sub": "<userId>",
    "roles": ["client"],
    "iat": 1234567890,
    "exp": 1234568790
  }
  ```
- Secret: `JWT_ACCESS_SECRET` (min 64 chars in production)

## Refresh Token

- Format: cryptographically random bytes (128-bit), base64url-encoded
- Stored as: SHA-256 hash in `refresh_tokens.token_hash` (never raw)
- Lifetime: 30 days
- Rotation: new token issued on every refresh; old token revoked
- Family tracking (future): detect reuse of revoked tokens → revoke entire family

## Role-Based Access Control

See [ADR-0005](adr/ADR-0005-role-based-access-control.md).

Roles are stored in the `user_roles` junction table and included in the JWT payload. Middleware:

```js
// Unauthenticated
GET /availability/slots

// Authenticated (any role)
GET /appointments

// Specific roles
router.post('/:id/confirm', authenticate, authorize('therapist', 'owner'), ...)
```

`authorize(...roles)` checks `req.user.roles` against the allowed set.

## Password Storage

- Algorithm: `bcrypt` with cost factor 12
- Passwords are never logged or returned in responses

## Password Reset Flow

```
1. POST /auth/forgot-password { email }
   → Generate secure random token (cryptographically safe)
   → Store hash + expiry (1 hour) in users table
   → Send email with reset link: APP_URL/reset-password?token=<raw_token>

2. POST /auth/reset-password { token, password }
   → Hash token → lookup in DB → verify not expired
   → Update password_hash, clear reset token
   → Revoke all refresh tokens for user (force re-login)
```

## Session Management

- Access tokens: stored in memory (never localStorage) on the frontend
- Refresh tokens: stored in `HttpOnly; Secure; SameSite=Strict` cookie
- CSRF mitigation: SameSite cookie attribute + custom `X-Requested-With` header check

## Implementation References

- `apps/api/src/middleware/auth.js` — `authenticate` and `authorize` stubs
- `apps/api/src/routes/auth.js` — route declarations
- `apps/api/src/controllers/authController.js` — controller stubs
- `apps/api/src/database/migrations/006_create_refresh_tokens.sql`
