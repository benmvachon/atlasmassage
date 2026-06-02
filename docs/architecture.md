# Atlas Bodywork — Architecture Overview

> See `docs/adr/` for the Architecture Decision Records that underpin every major decision documented here.

## System Overview

Atlas Bodywork is a full-stack practice management platform built as a monorepo. It serves three user roles — Client, Therapist, and Owner — across a React single-page application backed by a Node.js/Express REST API and a PostgreSQL database.

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare CDN / DNS                  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────┐
│                      Nginx (reverse proxy)               │
│   /             → static frontend (dist/)               │
│   /api/v1/*     → PM2-managed Node.js cluster           │
│   /health       → Node.js health endpoint               │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼──────┐        ┌──────────▼──────────────────┐
│   React SPA     │        │   Express API (PM2 cluster)  │
│   (Vite build)  │        │   apps/api                   │
│   apps/web      │        └──────────┬───────────────────┘
└─────────────────┘                   │
                           ┌──────────▼───────────────────┐
                           │   PostgreSQL (pg pool)        │
                           └──────────────────────────────┘
```

## Monorepo Structure

See [ADR-0001](adr/ADR-0001-monorepo-structure.md).

```
atlasmassage/
├── apps/
│   ├── web/          React + Vite SPA
│   └── api/          Express REST API
├── packages/
│   ├── shared-types/     TypeScript type definitions
│   ├── shared-constants/ Shared application constants
│   └── shared-utils/     Shared pure utility functions
├── docs/             Architecture docs and ADRs
├── infrastructure/   Nginx config, deployment scripts
├── scripts/          Dev setup and maintenance scripts
└── .github/          CI/CD workflows
```

## Frontend Architecture

See [ADR-0002](adr/ADR-0002-react-vite-frontend.md).

- **Framework**: React 18 with React Router v6
- **Build**: Vite with SPA proxy to API in development
- **Styling**: Sass with 7-1 partial architecture; centralized theme variables
- **State**: React Context (local state first; global state added as needed)
- **API layer**: Thin `fetch` wrapper in `src/services/api.js`
- **Testing**: Jest + React Testing Library

## Backend Architecture

See [ADR-0003](adr/ADR-0003-express-backend.md).

- **Framework**: Express 4 with ES modules
- **Pattern**: Controller → Service → Repository (see [ADR-0007](adr/ADR-0007-repository-pattern.md))
- **API**: REST, versioned under `/api/v1/`
- **Logging**: Winston structured JSON in production (see [ADR-0008](adr/ADR-0008-winston-logging.md))
- **Process**: PM2 cluster mode (see [ADR-0009](adr/ADR-0009-pm2-process-management.md))

## Database

See [ADR-0004](adr/ADR-0004-postgresql-database.md) and [database-schema.md](database-schema.md).

- **Engine**: PostgreSQL with `pg` connection pooling
- **Migrations**: Sequential SQL files, tracked in `schema_migrations` table
- **Naming**: `snake_case` tables and columns; UUIDs as primary keys; monetary values stored in integer cents

## Authentication & Authorization

See [ADR-0005](adr/ADR-0005-role-based-access-control.md), [ADR-0006](adr/ADR-0006-jwt-authentication-strategy.md), and [authentication-architecture.md](authentication-architecture.md).

- JWT access tokens (15-minute lifetime) + rotating refresh tokens (30-day lifetime)
- Roles: `client`, `therapist`, `owner` (multi-role supported)
- Role enforcement via `authorize(...roles)` middleware

## Scheduling

See [scheduling-architecture.md](scheduling-architecture.md).

## Payments

Stripe integration (future). See [api-contracts.md](api-contracts.md) for payment endpoint contracts.

## Reliability

- PM2 cluster mode with max instances
- Graceful shutdown with 10-second hard timeout
- Unhandled exception / rejection handlers
- Structured error responses with `isOperational` flag

## Future Implementation Phases

1. **Phase 2**: Authentication flows (JWT, refresh tokens, password reset)
2. **Phase 3**: Appointment booking + availability engine
3. **Phase 4**: Stripe payments + membership subscriptions
4. **Phase 5**: Email + SMS notifications + cron jobs
5. **Phase 6**: Owner admin dashboard
