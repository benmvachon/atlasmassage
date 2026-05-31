CREATE TABLE IF NOT EXISTS payment_methods (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  stripe_payment_method_id  VARCHAR(255) NOT NULL,
  brand                     VARCHAR(50)  NOT NULL,
  last4                     CHAR(4)      NOT NULL,
  expiry_month              SMALLINT     NOT NULL,
  expiry_year               SMALLINT     NOT NULL,
  is_default                BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_client_id ON payment_methods (client_id);
