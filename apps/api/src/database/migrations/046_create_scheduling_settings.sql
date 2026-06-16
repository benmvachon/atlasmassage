CREATE TABLE scheduling_settings (
  id              SERIAL      PRIMARY KEY,
  buffer_minutes  INTEGER     NOT NULL DEFAULT 15,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scheduling_settings (buffer_minutes) VALUES (15);
