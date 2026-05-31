CREATE TABLE IF NOT EXISTS massage_beds (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
