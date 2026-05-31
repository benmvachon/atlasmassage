# Atlas Massage

A full-stack practice management platform for massage therapy practices. Built with React, Node.js/Express, and PostgreSQL.

## Project Overview

Atlas Massage serves three user roles:

| Role | Capabilities |
|------|-------------|
| **Client** | Book appointments, manage memberships, handle payments |
| **Therapist** | Manage availability, view/confirm/complete appointments |
| **Owner** | Full administrative access, revenue reporting, settings |

Core features (in development):
- Appointment scheduling with conflict prevention
- Therapist availability management
- Membership subscriptions with credit rollover
- Stripe payment processing
- Email and SMS notifications
- Owner admin dashboard

## Architecture Summary

```
atlasmassage/               ← npm workspaces monorepo
├── apps/
│   ├── web/               ← React 18 + Vite + Sass SPA
│   └── api/               ← Node.js + Express REST API
├── packages/
│   ├── shared-types/      ← TypeScript type definitions
│   ├── shared-constants/  ← App-wide constants and route paths
│   └── shared-utils/      ← Pure utility functions
├── docs/                  ← Architecture documentation and ADRs
├── infrastructure/        ← Nginx config
└── scripts/               ← Dev setup scripts
```

**Frontend**: React Router v6 with three layout tiers (Public, Auth, Dashboard). Sass 7-1 partial architecture with centralized design tokens.

**Backend**: Express with Controller → Service → Repository layers. JWT authentication + rotating refresh tokens. Winston structured logging. PM2 cluster mode for production.

**Database**: PostgreSQL with sequential SQL migrations. UUIDs as primary keys. Integer cents for monetary values.

See [docs/architecture.md](docs/architecture.md) for the full system diagram and technology decisions.

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 15+

### Setup

```bash
# Clone the repository
git clone git@github.com:benmvachon/atlasmassage.git
cd atlasmassage

# Install all workspace dependencies
npm install

# Copy and configure environment variables
cp .env.example apps/api/.env
# Edit apps/api/.env with your database credentials and secrets

# Create the database
createdb atlasmassage

# Run migrations
npm run migrate --workspace=apps/api
```

### Running Locally

```bash
# Start both servers concurrently
npm run dev

# Or individually:
npm run dev:web   # React app on http://localhost:5173
npm run dev:api   # API server on http://localhost:3001
```

The Vite dev server proxies `/api` requests to the API — no CORS configuration needed in development.

### Testing

```bash
# Run all tests
npm test

# Run API tests only
npm test --workspace=apps/api

# Run web tests only
npm test --workspace=apps/web

# Coverage
npm run test:coverage --workspace=apps/api
```

### Linting

```bash
npm run lint
```

### API Health Check

```bash
curl http://localhost:3001/health
```

## Workspace Structure

| Package | Description |
|---------|-------------|
| `apps/web` | React SPA — `npm run dev` starts Vite on port 5173 |
| `apps/api` | Express API — `npm run dev` starts nodemon on port 3001 |
| `packages/shared-types` | TypeScript interfaces shared between web and API |
| `packages/shared-constants` | Role names, status enums, route paths, pagination defaults |
| `packages/shared-utils` | Pure functions: formatting, validation |

## Architecture Decision Records (ADRs)

ADRs are the authoritative record of every major architectural decision in this project. Before making a significant change to the technology stack, project structure, or design patterns, read the relevant ADRs and create a new one if your change supersedes an existing decision.

**Location**: [`docs/adr/`](docs/adr/)

**Template**: [`docs/adr/adr-template.md`](docs/adr/adr-template.md)

### Numbering Convention

ADRs are numbered sequentially: `ADR-XXXX-short-title.md`. The next ADR should be `ADR-0012`. Never reuse or renumber an existing ADR — if a decision is reversed, create a new ADR that supersedes the old one and mark the old one as `Superseded by ADR-XXXX`.

### Current ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](docs/adr/ADR-0001-monorepo-structure.md) | Monorepo Structure with npm Workspaces | Accepted |
| [ADR-0002](docs/adr/ADR-0002-react-vite-frontend.md) | React + Vite Frontend | Accepted |
| [ADR-0003](docs/adr/ADR-0003-express-backend.md) | Express.js Backend | Accepted |
| [ADR-0004](docs/adr/ADR-0004-postgresql-database.md) | PostgreSQL Database | Accepted |
| [ADR-0005](docs/adr/ADR-0005-role-based-access-control.md) | Role-Based Access Control | Accepted |
| [ADR-0006](docs/adr/ADR-0006-jwt-authentication-strategy.md) | JWT Authentication Strategy | Accepted |
| [ADR-0007](docs/adr/ADR-0007-repository-pattern.md) | Repository Pattern | Accepted |
| [ADR-0008](docs/adr/ADR-0008-winston-logging.md) | Winston Structured Logging | Accepted |
| [ADR-0009](docs/adr/ADR-0009-pm2-process-management.md) | PM2 Process Management | Accepted |
| [ADR-0010](docs/adr/ADR-0010-testing-strategy.md) | Testing Strategy | Accepted |
| [ADR-0011](docs/adr/ADR-0011-guest-checkout.md) | Guest Checkout for Appointment Booking | Accepted |

### When to Create an ADR

Create an ADR when:
- Adding or replacing a dependency that affects the architecture
- Changing a design pattern used across multiple modules
- Making a trade-off that a future developer would question without context
- Reversing or superseding an existing decision

You do not need an ADR for:
- Bug fixes
- Adding new API endpoints that follow established patterns
- UI component additions
- Configuration changes

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System architecture and component overview |
| [docs/database-schema.md](docs/database-schema.md) | Table definitions, indexes, conventions |
| [docs/api-contracts.md](docs/api-contracts.md) | All endpoint request/response contracts |
| [docs/authentication-architecture.md](docs/authentication-architecture.md) | JWT + refresh token strategy |
| [docs/scheduling-architecture.md](docs/scheduling-architecture.md) | Availability model and conflict prevention |
| [docs/deployment-plan.md](docs/deployment-plan.md) | Production deployment runbook |
