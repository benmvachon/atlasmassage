CREATE TABLE soap_notes (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID        NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  therapist_id   UUID        NOT NULL REFERENCES users(id),
  subjective     TEXT        NOT NULL,
  objective      TEXT        NOT NULL,
  assessment     TEXT        NOT NULL,
  plan           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON soap_notes (therapist_id);
