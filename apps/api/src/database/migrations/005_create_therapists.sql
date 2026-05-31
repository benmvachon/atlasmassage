CREATE TABLE IF NOT EXISTS therapists (
  user_id               UUID    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  bio                   TEXT,
  specialties           TEXT[],
  is_accepting_clients  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
