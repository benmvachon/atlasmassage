CREATE TABLE IF NOT EXISTS membership_plans (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  price_monthly_cents INTEGER      NOT NULL CHECK (price_monthly_cents > 0),
  credits_per_month   INTEGER      NOT NULL CHECK (credits_per_month > 0),
  stripe_price_id     VARCHAR(255),
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
