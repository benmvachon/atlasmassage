CREATE TABLE IF NOT EXISTS availability (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME     NOT NULL,
  end_time     TIME     NOT NULL,
  is_recurring BOOLEAN  NOT NULL DEFAULT TRUE,
  effective_date DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_availability_times CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_therapist_id ON availability (therapist_id);
CREATE INDEX IF NOT EXISTS idx_availability_day         ON availability (day_of_week);
