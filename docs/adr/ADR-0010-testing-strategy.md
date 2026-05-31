# ADR-0010 — Testing Strategy

**Status**: Accepted

**Date**: 2026-05-31

## Context

We need a testing approach that gives confidence in API correctness, frontend behavior, and shared utility logic — without requiring a running database or browser for the majority of the test suite. Build time and developer feedback loop speed matter.

## Decision

Use **Jest** as the unified test runner for all packages.

### API (`apps/api`)
- **Jest** + **Supertest** for integration-style HTTP tests against the Express app
- Tests call `request(app).get(...)` — the Express app is imported directly, no server port binding needed
- Database: tests that require DB access use a test database (`NODE_ENV=test`); pure business logic tests mock repositories
- Coverage collected from `src/**/*.js` excluding `src/server.js`

### Web (`apps/web`)
- **Jest** + **React Testing Library**
- Tests import components directly and render into `jsdom`
- Style imports mocked via `styleMock.js`; image imports mocked via `fileMock.js`
- No snapshot tests — they create too much maintenance overhead

### Shared packages
- Jest for pure function unit tests

### What we test vs. what we don't

| Test type | Approach |
|-----------|---------|
| API endpoint contract (status code, response shape) | Supertest integration test |
| Business logic (conflict detection, credit calculation) | Unit test with mock repository |
| React component rendering | RTL render + assertions |
| CSS / visual regression | Not tested (no requirement) |
| E2E browser flows | Not in scope for this phase |

## Consequences

### Positive

- Single test runner (`jest`) across all packages
- Supertest tests are fast (no network) and test real Express middleware stack
- RTL tests focus on behavior (what the user sees) rather than implementation

### Negative / Trade-offs

- Supertest tests hit real Express middleware but mock the DB — gaps exist between test and production behavior for DB-layer bugs
- No E2E coverage; manual testing required for full booking flows until Playwright/Cypress is added

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Vitest | Natural fit for Vite but adds a second test runner for the API; Jest chosen for uniformity |
| Playwright (E2E) | Valuable future addition; excluded from scaffolding phase to keep CI fast |
| Mocha + Chai | More configuration; Jest's batteries-included approach preferred |
| Snapshot testing | High maintenance ratio to value; RTL behavior tests preferred |
