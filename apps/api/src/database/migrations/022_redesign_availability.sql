-- Replace the day_of_week/is_recurring recurring pattern with date-specific calendar entries.
-- One row per therapist per calendar date; business hours constrain valid times.
DROP TABLE IF EXISTS availability;

CREATE TABLE availability (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specific_date DATE        NOT NULL,
  start_time    TIME        NOT NULL,
  end_time      TIME        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (therapist_id, specific_date),
  CONSTRAINT chk_availability_times CHECK (start_time < end_time)
);

CREATE INDEX idx_availability_therapist_id ON availability(therapist_id);
CREATE INDEX idx_availability_date         ON availability(specific_date);
