# Database Schema

> See [ADR-0004](adr/ADR-0004-postgresql-database.md) for the decision to use PostgreSQL.

All migrations live in `apps/api/src/database/migrations/` and are applied in filename order by the migration runner.

## Conventions

- Primary keys: `UUID` generated via `gen_random_uuid()`
- Timestamps: `TIMESTAMPTZ` (always UTC)
- Money: `INTEGER` cents (e.g., `price_cents`)
- Soft deletes: Not used; records are marked inactive or cancelled via status columns
- Naming: `snake_case` throughout

---

## Tables

### `roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `SERIAL PK` | |
| `name` | `VARCHAR(50) UNIQUE` | `client`, `therapist`, `owner` |

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID PK` | |
| `email` | `VARCHAR(255) UNIQUE NOT NULL` | Indexed |
| `password_hash` | `VARCHAR(255) NOT NULL` | bcrypt |
| `first_name` | `VARCHAR(100) NOT NULL` | |
| `last_name` | `VARCHAR(100) NOT NULL` | |
| `phone` | `VARCHAR(30)` | E.164 format |
| `is_active` | `BOOLEAN DEFAULT TRUE` | |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | |

### `user_roles`
Junction table. `(user_id, role_id)` composite PK.

### `clients`
Extends `users` 1:1 (user_id FK → PK).

| Column | Notes |
|--------|-------|
| `preferred_therapist_id` | FK → `users.id`, nullable |
| `notes` | Internal staff notes |

### `therapists`
Extends `users` 1:1.

| Column | Notes |
|--------|-------|
| `bio` | Public-facing bio |
| `specialties` | `TEXT[]` |
| `is_accepting_clients` | Booking availability flag |

### `refresh_tokens`
| Column | Notes |
|--------|-------|
| `token_hash` | SHA-256 of the raw token |
| `expires_at` | Hard expiry |
| `revoked_at` | Nullable; set on logout or rotation |

### `services`
Massage service catalog. Prices in `price_cents`.

### `massage_beds`
Physical treatment rooms / beds. Resource constraints for scheduling.

### `business_hours`
One row per day of week (0=Sun … 6=Sat). Unique constraint on `day_of_week`.

### `availability`
Therapist working hours. Supports recurring weekly schedules (`is_recurring=true`) and one-off overrides (`effective_date`).

Index: `(therapist_id)`, `(day_of_week)`.

### `appointments`
| Column | Notes |
|--------|-------|
| `status` | ENUM: `pending`, `confirmed`, `cancelled`, `completed`, `no_show` |
| `scheduled_at` | UTC |
| `duration_minutes` | Derived from service but stored for immutability |
| `bed_id` | Nullable; assigned at confirmation |

Indexes: `(client_id)`, `(therapist_id)`, `(scheduled_at)`, `(status)`.

### `membership_plans`
Subscription tier definitions. Contains `stripe_price_id` for Stripe integration.

### `memberships`
Active client subscriptions.

| Column | Notes |
|--------|-------|
| `status` | ENUM: `active`, `paused`, `cancelled`, `expired` |
| `credits_remaining` | Rolling balance |
| `stripe_subscription_id` | Stripe reference |

### `membership_credits`
Ledger of credit transactions (grant on renewal, use on booking, refund on cancel).

### `payment_methods`
Tokenized card data from Stripe. `stripe_payment_method_id` is the Stripe reference; no raw card data stored.

### `payments`
Payment records. Amount in `amount_cents`. Status ENUM: `pending`, `succeeded`, `failed`, `refunded`.

### `notifications`
Outbound message log. Channel: `email` | `sms`. Status: `pending` | `sent` | `failed`.

### `notification_preferences`
Per-user opt-in flags. 1:1 with `users`.

### `audit_logs`
Append-only event log. `old_data` / `new_data` stored as JSONB. `BIGSERIAL` PK for insertion order. Indexed on `(user_id)`, `(entity, entity_id)`, `(created_at DESC)`.

---

## Indexes Summary

| Table | Index | Reason |
|-------|-------|--------|
| `users` | `email` | Login lookup |
| `user_roles` | `user_id` | Role resolution |
| `refresh_tokens` | `user_id`, `token_hash` | Token validation |
| `availability` | `therapist_id`, `day_of_week` | Slot calculation |
| `appointments` | `client_id`, `therapist_id`, `scheduled_at`, `status` | Scheduling queries |
| `memberships` | `client_id`, `status` | Subscription lookup |
| `membership_credits` | `membership_id` | Balance calculation |
| `payment_methods` | `client_id` | Checkout |
| `payments` | `client_id`, `appointment_id`, `status` | Payment history |
| `notifications` | `user_id`, `status` | Delivery queue |
| `audit_logs` | `user_id`, `entity+entity_id`, `created_at DESC` | Audit queries |
