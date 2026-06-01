ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_reminded_at ON appointments (reminded_at)
  WHERE reminded_at IS NULL;
