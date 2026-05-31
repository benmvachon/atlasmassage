CREATE TABLE IF NOT EXISTS services (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  duration_minutes INTEGER      NOT NULL CHECK (duration_minutes > 0),
  price_cents      INTEGER      NOT NULL CHECK (price_cents >= 0),
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
