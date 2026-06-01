# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start everything (Docker Postgres + migrate + seed + both servers)
npm run dev

# Individual servers
npm run dev:web        # React on http://localhost:5173
npm run dev:api        # Express on http://localhost:3001

# Tests
npm test                                      # all workspaces
npm test --workspace=apps/api                 # API only
npm test --workspace=apps/web                 # web only
npm run test:coverage --workspace=apps/api    # with coverage

# Single test file (API)
node --experimental-vm-modules node_modules/.bin/jest --runInBand apps/api/src/tests/auth.test.js

# Lint / format
npm run lint
npm run format

# Database
npm run migrate --workspace=apps/api          # run pending migrations
npm run migrate:rollback --workspace=apps/api # rollback last migration
npm run seed --workspace=apps/api             # re-seed dev data

# Health check
curl http://localhost:3001/health
```

## Architecture

### Monorepo layout (npm workspaces)

```
apps/
  web/   React 18 + Vite SPA        (port 5173)
  api/   Express 4 REST API         (port 3001)
packages/
  shared-types/      TypeScript interfaces used by both apps
  shared-constants/  Role names, status enums, route paths, pagination defaults
  shared-utils/      Pure utility functions
```

Vite proxies `/api` to port 3001 in development — no CORS config needed locally.

### API: Controller → Service → Repository

All API modules (`auth`, `users`, `appointments`, `availability`, `payments`, `memberships`, `notifications`, `admin`) follow this layer pattern:

- **routes/** — Express router, validation rules, middleware wiring
- **controllers/** — parse request, call service, send response
- **services/** — business logic (currently: `authService`, `tokenService`, `emailService`)
- **repositories/** — all SQL lives here (currently: `userRepository`, `refreshTokenRepository`)

Endpoints are versioned: `/api/v1/*`.

### Authentication

Access tokens (15 min, in-memory on client) + rotating refresh tokens (30 days, `HttpOnly` cookie). See `docs/authentication-architecture.md` for the full flow.

Key middleware in `apps/api/src/middleware/auth.js`:
- `authenticate` — validates JWT, sets `req.user`
- `authorize(...roles)` — checks `req.user.roles` against allowed set
- `optionalAuthenticate` — decodes JWT if present, sets `req.user = null` if absent (used for guest checkout on `POST /appointments`)

### Frontend routing (three layout tiers)

- **PublicLayout** — marketing pages (`/`, `/services`, `/team`, etc.) + `/booking`
- **AuthLayout** — `/login`, `/signup`
- **DashboardLayout** — protected pages (`/settings`, `/therapist/*`, `/owner/*`)

`AuthContext` (wraps the whole app via `AuthProvider`) holds `user`, `loading`, `login`, `register`, `logout`. On mount it silently calls `POST /auth/refresh` to restore session from the cookie. Access token is kept in module-level state in `apps/web/src/services/api.js` via `setAccessToken` — never in localStorage.

### Database

PostgreSQL via `pg` pool. Sequential SQL migration files in `apps/api/src/database/migrations/` (currently `001`–`020`). The migration runner tracks applied files in a `schema_migrations` table. Monetary values are stored as integer cents; primary keys are UUIDs.

### Sass

7-1 partial architecture. Design tokens (colors, spacing, typography) live in `apps/web/src/styles/abstracts/_variables.scss`. Import via `main.scss` — don't import partials directly into components.

### Jest (API — ESM)

The API uses native ES modules. Tests run with `node --experimental-vm-modules`. Any test file that uses `jest.fn()` or other `jest.*` globals must import them explicitly:

```js
import { jest } from '@jest/globals';
```

## ADRs

`docs/adr/` contains the authoritative record of every major architectural decision. Before changing the tech stack, a design pattern used across modules, or any trade-off a future developer would question, read the relevant ADR and create a new one if your change supersedes it. The next ADR number is **ADR-0012**. Never reuse or renumber; supersede with a new ADR instead.

## Scaffolding origin

The entire repository structure was generated in a single scaffolding-only session from this prompt (condensed):

> You are a senior software architect and staff-level full-stack engineer. Generate the initial project architecture and repository scaffolding for a production web application called Atlas Massage.
>
> **This phase is architecture and scaffolding only.** Do NOT implement business features yet. Do NOT implement appointment booking logic, payment processing, notification delivery, or authentication flows beyond the minimum scaffolding required to support future development. The goal is to establish a clean, scalable, production-ready foundation.
>
> Create: (1) monorepo structure with npm workspaces; (2) React + Vite frontend with placeholder routes and Sass 7-1 architecture; (3) Express backend with Controller → Service → Repository pattern, health endpoint, error/logging middleware, and stubbed route handlers for `/api/v1/{auth,users,appointments,availability,payments,memberships,notifications,admin}`; (4) PostgreSQL migration files for all domain tables; (5) API contract documentation; (6) authentication and scheduling architecture docs; (7) Winston structured logging; (8) Jest + React Testing Library + Supertest framework with sample passing tests; (9) PM2 config + graceful shutdown; (10) `.env.example`; (11) GitHub Actions (lint/test/build, no deploy); (12) ADRs ADR-0001 through ADR-0010.

What this means in practice: **most controllers, services, and repositories are stubs.** Only `auth`, `token`, `email`, and the admin business/therapist repositories have real implementations. All other route handlers return placeholder responses. The full implementation roadmap is:

1. ~~Phase 1: Scaffolding~~ ✓ complete
2. ~~Phase 2: Authentication flows (JWT, refresh tokens, password reset)~~ ✓ complete
   - JWT access tokens (15 min) + rotating refresh tokens (30 days, HttpOnly cookie)
   - Register, login, logout, refresh with timing-safe bcrypt and token rotation
   - Forgot password (`/forgot-password`) + reset password (`/reset-password?token=…`) — end-to-end
   - Email service: Nodemailer with dev console fallback (leave `EMAIL_HOST` empty in `.env` to use it)
   - Login page, signup page, forgot-password page, reset-password page, `AuthContext`, `ProtectedRoute`, `OwnerRoute`
3. Phase 3: Appointment booking + availability engine
4. Phase 4: Stripe payments + membership subscriptions
5. Phase 5: Email + SMS notifications + cron jobs
6. Phase 6: Owner admin dashboard — **in progress**
   - ✅ `BusinessDetailsPage` (`/owner/business`) — operating hours, massage tables, services
   - ✅ `TherapistManagementPage` (`/owner/therapists`) — add, edit, deactivate therapists
   - ✅ Owner sidebar layout, role-aware redirect on login, "Admin" header link
   - ✅ 38 integration tests covering all admin endpoints
   - ❌ Remaining dashboards (appointments, revenue, audit logs) — stubs only

## Environment variables

All config lives in `apps/api/src/config/index.js`. Copy `.env.example` to `apps/api/.env` for local development. Key vars: `DB_*`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `STRIPE_SECRET_KEY`, `TWILIO_*`, `EMAIL_*`.
