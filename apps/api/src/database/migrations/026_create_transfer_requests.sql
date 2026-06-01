CREATE TYPE transfer_request_status AS ENUM ('pending', 'approved', 'denied');

CREATE TABLE IF NOT EXISTS appointment_transfer_requests (
  id                UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID                    NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  from_therapist_id UUID                    NOT NULL REFERENCES users (id),
  to_therapist_id   UUID                    REFERENCES users (id),
  reason            TEXT,
  status            transfer_request_status NOT NULL DEFAULT 'pending',
  reviewed_by       UUID                    REFERENCES users (id),
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- Only one open request per appointment at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_requests_one_pending
  ON appointment_transfer_requests (appointment_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transfer_requests_from   ON appointment_transfer_requests (from_therapist_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON appointment_transfer_requests (status);
