# ADR-0001 — Monorepo Structure with npm Workspaces

**Status**: Accepted

**Date**: 2026-05-31

## Context

Atlas Bodywork has three distinct software concerns — a React frontend, a Node.js API, and shared type/utility code. These will be developed by the same team and deployed together. We need a repository structure that minimizes friction when sharing code between packages while keeping each app independently buildable and testable.

## Decision

Use a **monorepo** with **npm workspaces**. Structure:

```
/
├── apps/
│   ├── web/     (React SPA)
│   └── api/     (Express API)
└── packages/
    ├── shared-types/
    ├── shared-constants/
    └── shared-utils/
```

A single `package.json` at root defines the `workspaces` field. All `npm install` commands run from the root and hoist shared dependencies.

## Consequences

### Positive

- Shared TypeScript types are a single source of truth — no type drift between frontend and backend
- Atomic commits spanning frontend + backend + shared code
- One CI run validates the entire system
- Simple local setup: `npm install` at root installs everything

### Negative / Trade-offs

- `npm ci` is slower than installing a single package (hoisting + all workspaces)
- Developers must be careful not to introduce circular dependencies between packages
- Deployment must cherry-pick only the affected app(s)

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Separate repositories | Type sharing requires publishing packages to a registry; slower iteration |
| Nx / Turborepo | Adds toolchain complexity; npm workspaces sufficient for this project size |
| Yarn workspaces | No reason to prefer Yarn over npm for this project |
