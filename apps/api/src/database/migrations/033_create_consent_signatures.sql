CREATE TABLE consent_signatures (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  guest_email TEXT,
  signature   TEXT         NOT NULL,
  signed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_consent_has_identifier
    CHECK (client_id IS NOT NULL OR guest_email IS NOT NULL)
);

CREATE INDEX idx_consent_signatures_client_id ON consent_signatures(client_id);

ALTER TABLE appointments
  ADD COLUMN consent_signature_id UUID REFERENCES consent_signatures(id) ON DELETE SET NULL;

-- Migrate existing waiver data: create one consent_signature record per appointment
DO $$
DECLARE
  r      RECORD;
  sig_id UUID;
BEGIN
  FOR r IN
    SELECT id, client_id, guest_email, waiver_signature, waiver_signed_at, created_at
    FROM   appointments
    WHERE  waiver_signature IS NOT NULL
  LOOP
    INSERT INTO consent_signatures (client_id, guest_email, signature, signed_at)
    VALUES (
      r.client_id,
      CASE WHEN r.client_id IS NULL THEN r.guest_email ELSE NULL END,
      r.waiver_signature,
      COALESCE(r.waiver_signed_at, r.created_at)
    )
    RETURNING id INTO sig_id;

    UPDATE appointments SET consent_signature_id = sig_id WHERE id = r.id;
  END LOOP;
END $$;
