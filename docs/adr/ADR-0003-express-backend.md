# ADR-0003 — Express.js Backend

**Status**: Accepted

**Date**: 2026-05-31

## Context

We need a REST API server that is lightweight, well-understood, and easy to extend. The API will serve JSON, handle authentication middleware, validate requests, and connect to PostgreSQL. The team is experienced with Node.js.

## Decision

Use **Express 4** with **ES modules** (`"type": "module"` in package.json). Layered architecture:

```
routes → middleware → controllers → services → repositories → database
```

- Express: minimal, flexible, does not impose structure
- ES modules: modern syntax, no CommonJS/ESM interop issues, consistent with the rest of the stack
- Layered architecture: enables dependency injection, testability, and clear separation of concerns

Middleware stack (in order):
1. `helmet` — security headers
2. `cors` — cross-origin policy
3. `express.json` — request parsing
4. `compression` — response gzip
5. `express-rate-limit` — rate limiting on `/api/`
6. `requestLogger` — structured request logging
7. Route handlers
8. `notFound` — 404 handler
9. `errorHandler` — centralized error serialization

## Consequences

### Positive

- Minimal boilerplate; easy to add middleware
- ES modules enable top-level `await` and future compatibility
- Centralized error handler ensures consistent API error shape

### Negative / Trade-offs

- Express requires manual setup for everything (validation, serialization, etc.) — more work than opinionated frameworks
- ES modules in Node.js require `.js` extensions on imports and cannot use `require()`

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Fastify | Faster but less familiar; plugin system adds learning curve |
| NestJS | TypeScript-first, heavily opinionated; too much overhead for current scale |
| Hono | Newer, less ecosystem support at time of decision |
| Koa | Smaller ecosystem than Express; no significant advantage |
