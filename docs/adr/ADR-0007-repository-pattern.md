# ADR-0007 — Repository Pattern

**Status**: Accepted

**Date**: 2026-05-31

## Context

The backend interacts with PostgreSQL via raw SQL using the `pg` pool. Without an ORM, we need a consistent pattern for database access that keeps SQL out of controllers, enables unit testing with mock repositories, and follows the dependency-inversion principle.

## Decision

Use the **Repository Pattern** to encapsulate all database access.

Layer responsibilities:

| Layer | Responsibility |
|-------|---------------|
| `controllers/` | Parse request, call service, return response |
| `services/` | Business logic, orchestrate repositories, enforce rules |
| `repositories/` | All SQL queries; returns plain objects |
| `database/pool.js` | pg Pool singleton |

Rules:
- Controllers never import from `repositories/` directly
- Services never call `pool` directly
- Repositories never contain business logic — only CRUD + query methods
- Each repository receives the `pool` (or a `client` for transactions) as a constructor argument, enabling injection of a test double

Example:
```js
// repositories/appointmentRepository.js
export class AppointmentRepository {
  constructor(pool) { this.pool = pool; }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM appointments WHERE id = $1', [id]
    );
    return rows[0] ?? null;
  }
}
```

## Consequences

### Positive

- SQL is isolated and easy to audit
- Services can be unit-tested by injecting a mock repository
- Database migrations and query changes don't ripple into business logic
- Consistent interface for future ORM migration if needed

### Negative / Trade-offs

- More boilerplate than calling `pool.query()` directly in services
- N-ary dependencies (service receives multiple repositories) must be managed carefully to avoid circular imports

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Active Record (e.g., Sequelize) | ORM abstraction obscures generated SQL; harder to debug |
| Direct pool.query() in services | Mixes SQL with business logic; untestable without a real DB |
| Data Mapper (TypeORM) | TypeScript-first; overkill for JS-based API |
