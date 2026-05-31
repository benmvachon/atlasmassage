CREATE TYPE credit_transaction_type AS ENUM ('grant', 'use', 'refund', 'expire');

CREATE TABLE IF NOT EXISTS membership_credits (
  id             UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id  UUID                    NOT NULL REFERENCES memberships (id) ON DELETE CASCADE,
  type           credit_transaction_type NOT NULL,
  amount         INTEGER                 NOT NULL,
  appointment_id UUID                    REFERENCES appointments (id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_membership_credits_membership_id ON membership_credits (membership_id);
