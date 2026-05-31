CREATE TABLE IF NOT EXISTS clients (
  user_id                UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  notes                  TEXT,
  preferred_therapist_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
