-- day_of_week: 0=Sunday, 6=Saturday
CREATE TABLE IF NOT EXISTS business_hours (
  id           SERIAL      PRIMARY KEY,
  day_of_week  SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TIME        NOT NULL,
  close_time   TIME        NOT NULL,
  is_closed    BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (day_of_week)
);
