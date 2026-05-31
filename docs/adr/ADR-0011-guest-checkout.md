# ADR-0011 — Guest Checkout for Appointment Booking

**Status**: Accepted

**Date**: 2026-05-31

## Context

Clients should not be required to create an account or log in to book a massage appointment. Requiring registration creates friction that reduces conversion and is unnecessary for a practice management tool where the business books on behalf of clients as often as clients book themselves.

## Decision

The `POST /appointments` endpoint accepts unauthenticated requests. Authentication is **optional**, not required.

**Behavior:**
- If a valid JWT access token is present in the `Authorization` header, `clientId` is resolved from the token and guest fields are ignored.
- If no token is present, `guestName` and `guestEmail` are required in the request body; `guestPhone` is optional.

**Database:**
- `appointments.client_id` is nullable (migration 019).
- Guest fields `guest_name`, `guest_email`, `guest_phone` are added to the `appointments` table.
- A CHECK constraint enforces that exactly one of `(client_id)` or `(guest_email + guest_name)` is populated — never both, never neither.

**Middleware:**
- A new `optionalAuthenticate` middleware sets `req.user` from the JWT if present, or sets `req.user = null` and continues if absent. It never returns 401.

**Frontend:**
- `/booking` is served under `PublicLayout` (with `Header` and `Footer`), not `DashboardLayout`.

**Confirmation token:**
- Guest bookings return a short-lived `confirmationToken` in the response so guests can look up their appointment status without an account. This token is separate from JWT auth.

## Consequences

### Positive

- No sign-up friction for first-time clients
- Consistent with how many booking platforms (salons, spas) operate
- Authenticated clients get the same endpoint — no separate guest route to maintain
- The CHECK constraint prevents orphaned appointments with neither a client nor a guest

### Negative / Trade-offs

- Guest bookings cannot be associated with a loyalty/membership account until the guest later registers
- Cancellation and modification by guests requires the `confirmationToken` — losing it means contacting the practice
- Marketing opt-in (email/SMS notifications) must be handled explicitly for guests at booking time

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Require account creation | Adds sign-up friction; not required by business |
| Auto-create a shadow user account | Creates orphaned accounts; confusing if guest later registers with the same email |
| Separate guest endpoint (`POST /appointments/guest`) | Duplicates logic; a single endpoint with optional auth is cleaner |
