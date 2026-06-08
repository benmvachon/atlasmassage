CREATE TABLE client_feedback (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID        NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  client_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  guest_email    TEXT,
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments       TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT client_feedback_owner_check
    CHECK (client_id IS NOT NULL OR guest_email IS NOT NULL)
);
