ALTER TABLE appointments
  ADD COLUMN waiver_signed_at TIMESTAMPTZ,
  ADD COLUMN waiver_signature TEXT;
