CREATE TYPE membership_status AS ENUM ('active', 'paused', 'cancelled', 'expired');

CREATE TABLE IF NOT EXISTS memberships (
  id                      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_id                 UUID              NOT NULL REFERENCES membership_plans (id),
  status                  membership_status NOT NULL DEFAULT 'active',
  start_date              DATE              NOT NULL,
  end_date                DATE,
  credits_remaining       INTEGER           NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  stripe_subscription_id  VARCHAR(255),
  created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memberships_client_id ON memberships (client_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status    ON memberships (status);
