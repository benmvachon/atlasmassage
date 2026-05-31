# ADR-0002 — React + Vite Frontend

**Status**: Accepted

**Date**: 2026-05-31

## Context

We need a modern, component-based frontend framework that supports a multi-page SPA with role-specific views. The development experience (HMR speed, build time) matters for a small team. We also need a CSS solution that supports design tokens and component-scoped styles without a heavy runtime.

## Decision

Use **React 18** with **React Router v6** for the SPA, **Vite** as the build tool, and **Sass** for styling.

- React: industry-standard, large ecosystem, no special framework lock-in
- React Router v6: nested routes via `<Outlet>` align naturally with the layout hierarchy (PublicLayout, AuthLayout, DashboardLayout)
- Vite: sub-second HMR, native ES module dev server, fast production builds via Rollup
- Sass: 7-1 partial architecture gives structured CSS without a CSS-in-JS runtime; centralized `_variables.scss` acts as the design token layer

## Consequences

### Positive

- Fast iteration with instant HMR
- Vite proxy forwards `/api` requests to the local API server — no CORS issues in development
- Sass `@use` with namespacing prevents global variable leakage
- No TypeScript required in frontend (JS + JSDoc is sufficient for this scale)

### Negative / Trade-offs

- Sass adds a compilation step (negligible with Vite)
- React Router v6 nested routes require understanding of `<Outlet>` — slightly more setup than flat routes
- No SSR; SEO for public pages is limited to static content (acceptable for a booking platform)

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Next.js | SSR/SSG overhead unnecessary; adds complexity without benefit for this use case |
| Vue 3 | Team familiarity with React; ecosystem parity |
| CSS Modules | Less expressive for a design system; Sass variables are simpler to maintain |
| Tailwind CSS | Utility-first approach conflicts with the desire for semantic, component-scoped styles |
| Create React App | Deprecated; Vite is the modern replacement |
