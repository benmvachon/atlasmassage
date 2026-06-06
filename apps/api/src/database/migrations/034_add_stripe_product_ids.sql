ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(255);
ALTER TABLE services ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255);
