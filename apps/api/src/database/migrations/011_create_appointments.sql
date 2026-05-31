CREATE TYPE appointment_status AS ENUM (
  'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
);

CREATE TABLE IF NOT EXISTS appointments (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID               NOT NULL REFERENCES users (id),
  therapist_id     UUID               NOT NULL REFERENCES users (id),
  service_id       UUID               NOT NULL REFERENCES services (id),
  bed_id           UUID               REFERENCES massage_beds (id) ON DELETE SET NULL,
  status           appointment_status NOT NULL DEFAULT 'pending',
  scheduled_at     TIMESTAMPTZ        NOT NULL,
  duration_minutes INTEGER            NOT NULL CHECK (duration_minutes > 0),
  notes            TEXT,
  cancelled_reason TEXT,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_client_id    ON appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_id ON appointments (therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status       ON appointments (status);
