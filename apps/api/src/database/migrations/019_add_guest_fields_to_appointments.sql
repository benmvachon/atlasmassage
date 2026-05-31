-- Support guest checkout: client_id becomes optional when guest fields are provided.
-- Exactly one of (client_id) or (guest_email) must be present — enforced by CHECK constraint.

ALTER TABLE appointments
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN guest_name  VARCHAR(200),
  ADD COLUMN guest_email VARCHAR(255),
  ADD COLUMN guest_phone VARCHAR(30),
  ADD CONSTRAINT chk_appointments_booker CHECK (
    (client_id IS NOT NULL AND guest_email IS NULL)
    OR
    (client_id IS NULL AND guest_email IS NOT NULL AND guest_name IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_appointments_guest_email ON appointments (guest_email)
  WHERE guest_email IS NOT NULL;
