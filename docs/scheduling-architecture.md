# Scheduling Architecture

## Overview

The scheduling system must prevent double-booking of both therapists and massage beds while supporting flexible therapist availability, business hour constraints, and membership credit consumption.

## Core Entities

| Entity | Table | Purpose |
|--------|-------|---------|
| Therapist Availability | `availability` | When a therapist works |
| Business Hours | `business_hours` | When the practice is open |
| Appointments | `appointments` | Booked time blocks |
| Massage Beds | `massage_beds` | Physical room/bed resources |
| Services | `services` | Duration and pricing |

## Therapist Availability Model

Availability is stored as **time windows per day of week**. A therapist may have multiple windows per day (e.g., 9am–12pm and 2pm–6pm).

Two modes:
1. **Recurring** (`is_recurring=true`, `effective_date=NULL`): Applies every week
2. **One-off override** (`is_recurring=false`, `effective_date=<date>`): Overrides recurring for that specific date

Resolution order (highest priority first):
1. One-off override for the specific date
2. Recurring weekly schedule

## Slot Calculation Algorithm

```
Input: therapistId, date, serviceDurationMinutes

1. Determine therapist windows for date:
   a. Check for one-off overrides on this date
   b. Fall back to recurring schedule for day_of_week
2. Intersect with business_hours for that day
3. Generate candidate slots every N minutes (configurable, e.g., 30)
4. For each candidate slot [start, end]:
   a. Check no confirmed/pending appointment for therapist overlaps [start, end]
   b. Check an available bed exists (no confirmed/pending appointment on bed)
5. Return available slots
```

## Conflict Prevention Strategy

All appointment creation and modification happens inside a **PostgreSQL transaction with advisory locks** to prevent race conditions:

```sql
BEGIN;
  SELECT pg_advisory_xact_lock(therapist_id_as_bigint);
  -- Check for overlapping appointment
  SELECT 1 FROM appointments
  WHERE therapist_id = $1
    AND status IN ('pending', 'confirmed')
    AND tsrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute')
    && tsrange($2, $3);
  -- If no conflict, insert
  INSERT INTO appointments ...;
COMMIT;
```

## Resource Allocation (Bed Assignment)

- Beds are assigned at **confirmation time**, not booking time
- At booking: system checks that at least one bed will be free
- At confirmation: owner/therapist assigns a specific bed
- Bed conflicts are checked the same way as therapist conflicts

## Business Hours Constraints

- Slot calculation always intersects with `business_hours`
- Closed days (`is_closed=true`) return zero slots
- Appointments cannot start before `open_time` or end after `close_time`

## Buffer Time (Future)

A configurable buffer between appointments (e.g., 15 minutes for room turnover) will be subtracted from the end of each appointment window before calculating the next available slot. This field is not yet in the schema but should be added to `services` or a settings table.

## Cancellation and Rebooking

- Cancellation releases the therapist slot and bed (if assigned)
- Credits are refunded to membership balance (if applicable)
- No-show status does not release the slot retroactively (historical record)

## Future Considerations

- **Waitlist**: Queue clients for a slot if their preferred time is full
- **Recurring appointments**: `recurring_appointments` table with RRULE support
- **Multi-service bookings**: Sequential appointments with automatic gap calculation
- **Therapist-initiated blocks**: Mark unavailable periods without an availability record

## Implementation References

- `apps/api/src/database/migrations/010_create_availability.sql`
- `apps/api/src/database/migrations/011_create_appointments.sql`
- `apps/api/src/routes/availability.js`
- `apps/api/src/controllers/availabilityController.js` (stub)
