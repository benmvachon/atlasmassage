# ADR-0004 — PostgreSQL Database

**Status**: Accepted

**Date**: 2026-05-31

## Context

Atlas Massage requires reliable storage for relational data: users, appointments, memberships, payments, and audit logs. The data model is highly relational with foreign key constraints and transactional requirements (especially for scheduling conflict prevention). We need ACID guarantees.

## Decision

Use **PostgreSQL** accessed via the `pg` npm package with a connection pool. Run a lightweight SQL migration runner (custom, using ordered `.sql` files tracked in a `schema_migrations` table) rather than a heavy ORM.

Money values are stored as **integer cents** to avoid floating-point precision errors.
All timestamps use `TIMESTAMPTZ` (UTC-aware).
UUIDs (`gen_random_uuid()`) are used as primary keys to avoid enumerable IDs in URLs.

## Consequences

### Positive

- ACID transactions — critical for conflict-free appointment booking
- Native UUID support, JSONB for audit log payloads, `TEXT[]` for arrays
- `pg_advisory_xact_lock` enables row-level scheduling locks without application-layer locks
- PostgreSQL ENUM types enforce valid status values at the DB layer
- Simple migration runner avoids ORM lock-in and keeps SQL visible and reviewable

### Negative / Trade-offs

- Raw SQL means more verbose data access code (mitigated by the repository pattern — see ADR-0007)
- No auto-generated migrations from schema diffing; developer must write SQL
- Self-hosted PostgreSQL requires backup discipline

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| MySQL / MariaDB | Weaker support for JSONB, arrays, advisory locks; PostgreSQL preferred for feature parity |
| MongoDB | Document model is a poor fit for highly relational scheduling data |
| SQLite | Not suitable for production multi-process access (PM2 cluster mode) |
| Prisma ORM | Adds migration tooling but introduces generated client abstraction layer; raw SQL preferred for transparency |
| Sequelize | Heavy, inconsistent API, generates inefficient queries |
