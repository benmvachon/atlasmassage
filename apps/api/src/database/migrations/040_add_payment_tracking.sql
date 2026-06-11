-- Track the Stripe payment method saved at booking time, and (for guests) the
-- Stripe customer created for them so we can charge no-shows later.
ALTER TABLE appointments
  ADD COLUMN stripe_payment_method_id VARCHAR(255),
  ADD COLUMN stripe_customer_id       VARCHAR(255);

-- Track how a payment was collected: via Stripe online, in-person, or via
-- membership credit (membership_credit payments are created in-memory only, but
-- this column makes the source explicit for revenue reporting).
ALTER TABLE payments
  ADD COLUMN source            VARCHAR(50) NOT NULL DEFAULT 'stripe',
  ADD COLUMN in_person_method  VARCHAR(20);
