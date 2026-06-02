ALTER TABLE appointments ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES memberships (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_membership_id ON appointments (membership_id);
