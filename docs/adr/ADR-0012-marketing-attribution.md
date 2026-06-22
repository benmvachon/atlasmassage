# ADR-0012 — Marketing Attribution on Appointments

**Status**: Accepted

**Date**: 2026-06-21

## Context

The practice spends effort on marketing channels (email newsletters, social, paid search) but has no way to tell which channels actually produce bookings. We want to capture the origin of traffic from inbound links and carry it through to the appointment so the owner can judge channel effectiveness.

Inbound links already carry standard UTM parameters when built with common tools (Google/Meta ad builders, Mailchimp, etc.), e.g. `?utm_source=newsletter&utm_medium=email&utm_campaign=june_digest`.

## Decision

Capture marketing attribution from URL parameters on the client, persist it **onto each appointment**, and surface an owner dashboard.

**Scope — appointments only.** We do **not** log raw site visits to a separate table. Attribution is recorded only when a booking is created. Dashboards therefore report bookings and revenue per channel, not visit volume or visit→booking conversion rate. This keeps the surface small and avoids a write-heavy tracking endpoint; full-funnel visit tracking can be layered on later if needed.

**Attribution model — both first-touch and last-touch.** Each appointment stores two sets of UTM values:
- **First-touch** ("where did this person originally discover us?") — captured once and persisted in `localStorage`, surviving across sessions.
- **Last-touch** ("what brought them back to book?") — overwritten in `sessionStorage` each time a UTM-tagged link is followed within the session.

When no last-touch exists, it falls back to first-touch so a single-visit booking still attributes on both.

**Parameters — the three channel-defining UTM fields**: `utm_source`, `utm_medium`, `utm_campaign`. `utm_term`/`utm_content` (keyword / ad-variant level) are out of scope for a channel-effectiveness view and can be added later.

**Database** (migration `050`): six nullable `VARCHAR(255)` columns on `appointments` — `first_utm_{source,medium,campaign}` and `last_utm_{source,medium,campaign}` — with indexes on the two source columns for dashboard `GROUP BY`. Flat columns (rather than JSONB) match the existing denormalized style of the table (guest/health fields) and keep aggregation SQL simple.

**Capture (frontend):** `apps/web/src/services/attribution.js` reads UTM params and manages first/last-touch storage; an invisible `<AttributionTracker />` mounted in `App.jsx` runs it on every navigation. `BookingModal` spreads `getAttribution()` into the create-appointment payload. All storage access is guarded so private mode never breaks booking.

**Persistence (API):** `createAppointmentRules` validates the six optional fields. The controller trims/caps them and **lowercases `source` and `medium`** (so "Google" and "google" group together), leaving `campaign` as-entered. Applies to both guest and authenticated bookings.

**Reporting:** `GET /admin/marketing-sources?start&end&touch=first|last` (owner-only) returns `bySource`, `byCampaign`, and a summary via `AppointmentRepository.getSourceAttributionStats`, counting confirmed/completed appointments and summing service `price_cents` as attributed revenue. NULL source is bucketed as "Direct / Organic". The `/owner/sources` page (recharts) visualizes it with a first/last-touch toggle.

## Consequences

### Positive

- Owner can see which channels drive bookings and revenue, with both discovery (first-touch) and conversion (last-touch) views.
- Small footprint: no new high-volume tracking table or endpoint; reuses the existing booking write and admin dashboard patterns.
- Standard UTM scheme works out of the box with common link builders.

### Negative / Trade-offs

- No visit-level data, so visit→booking conversion rate cannot be computed (only bookings per channel).
- Attribution depends on client-side storage; users who clear storage or book in a fresh private session lose first-touch history.
- Revenue is approximated from service list price at booking, not actual collected payment (consistent with the existing Revenue dashboard's by-service/by-therapist breakdowns).

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Full-funnel visit tracking (visits table + beacon endpoint) | Larger build and write-heavy; not needed for the stated goal of channel effectiveness on bookings |
| Single freeform `?source=` tag | Loses medium/campaign breakdowns; requires hand-building every link |
| First-touch only or last-touch only | Each answers half the question; storing both is cheap and more flexible |
| JSONB attribution column | Less ergonomic for the dashboard's `GROUP BY`; flat columns match the table's existing style |
