CREATE TABLE health_records (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id            UUID        REFERENCES users(id) ON DELETE SET NULL,
  guest_email          TEXT,
  current_medications  TEXT,
  recent_surgeries     TEXT,
  pregnancy_status     TEXT        CHECK (pregnancy_status IN (
                                     'not_pregnant', 'pregnant',
                                     'recently_pregnant', 'prefer_not_to_say'
                                   )),
  injuries             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT health_records_owner_check
    CHECK (client_id IS NOT NULL OR guest_email IS NOT NULL)
);

CREATE INDEX ON health_records (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX ON health_records (guest_email) WHERE guest_email IS NOT NULL;

ALTER TABLE appointments
  ADD COLUMN health_record_id UUID REFERENCES health_records(id) ON DELETE SET NULL;
