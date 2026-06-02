# ADR-0005 — Role-Based Access Control

**Status**: Accepted

**Date**: 2026-05-31

## Context

Atlas Bodywork has three user roles — Client, Therapist, and Owner — with distinct permissions across all API endpoints. A user may hold multiple roles (e.g., an owner who also performs massages is both `owner` and `therapist`). We need a simple, auditable authorization model.

## Decision

Use a **flat role-based access control (RBAC)** model stored in the `user_roles` junction table and encoded in the JWT payload.

Roles:
- `client` — book appointments, manage their profile and payment methods, subscribe to memberships
- `therapist` — manage their own availability, view/confirm/complete their appointments
- `owner` — full access to all resources; can also perform therapist actions

`authorize(...roles)` middleware accepts a list of allowed roles and checks `req.user.roles` (from the decoded JWT) against it. If any role matches, access is granted.

Roles are included in the JWT payload to avoid a DB lookup on every request. Role changes take effect on the next token refresh.

## Consequences

### Positive

- Simple to reason about; no complex permission tables
- Multi-role support handles the owner-as-therapist case naturally
- Role check is O(n) on the small roles array — negligible cost

### Negative / Trade-offs

- Role changes (granting or revoking) do not take effect until the current access token expires (max 15 minutes)
- Does not support resource-level permissions (e.g., "therapist can only view their own appointments") — these checks are implemented in service layer logic, not middleware
- Not suitable for attribute-based access control (ABAC) if requirements evolve significantly

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Permission-based ACL | Over-engineered for three roles; adds table complexity without benefit at this scale |
| ABAC | Powerful but complex; overkill for the current permission model |
| Role hierarchy (owner > therapist > client) | Hierarchy breaks down when a therapist should NOT have client-facing booking abilities |
