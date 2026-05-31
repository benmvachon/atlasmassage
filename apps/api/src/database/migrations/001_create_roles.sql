-- Roles lookup table
CREATE TABLE IF NOT EXISTS roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES ('client'), ('therapist'), ('owner')
  ON CONFLICT (name) DO NOTHING;
