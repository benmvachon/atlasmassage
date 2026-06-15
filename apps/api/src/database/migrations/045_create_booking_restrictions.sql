CREATE TABLE booking_restrictions (
  id               SERIAL      PRIMARY KEY,
  restrict_pregnancy BOOLEAN   NOT NULL DEFAULT TRUE,
  restrict_minors   BOOLEAN    NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO booking_restrictions (restrict_pregnancy, restrict_minors) VALUES (TRUE, TRUE);
