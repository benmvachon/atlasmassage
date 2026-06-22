-- Marketing attribution: capture the UTM source/medium/campaign that drove each
-- booking, for both first-touch (origin) and last-touch (converting visit).
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS first_utm_source   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS first_utm_medium   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS first_utm_campaign VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_utm_source    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_utm_medium    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_utm_campaign  VARCHAR(255);

-- Support GROUP BY source on the marketing dashboard.
CREATE INDEX IF NOT EXISTS idx_appointments_first_utm_source ON appointments (first_utm_source);
CREATE INDEX IF NOT EXISTS idx_appointments_last_utm_source  ON appointments (last_utm_source);
