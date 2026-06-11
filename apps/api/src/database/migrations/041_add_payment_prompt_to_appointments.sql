-- Track when the post-appointment payment-prompt email was sent to the therapist
-- so the worker never sends it twice.
ALTER TABLE appointments
  ADD COLUMN payment_prompt_sent_at TIMESTAMPTZ;
