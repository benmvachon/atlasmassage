CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 UUID           NOT NULL REFERENCES users (id),
  appointment_id            UUID           REFERENCES appointments (id) ON DELETE SET NULL,
  membership_id             UUID           REFERENCES memberships (id) ON DELETE SET NULL,
  amount_cents              INTEGER        NOT NULL CHECK (amount_cents >= 0),
  currency                  CHAR(3)        NOT NULL DEFAULT 'USD',
  status                    payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id  VARCHAR(255),
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client_id      ON payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments (appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status         ON payments (status);
