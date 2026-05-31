CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  phone        VARCHAR(30),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
