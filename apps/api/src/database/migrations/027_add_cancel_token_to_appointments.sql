ALTER TABLE appointments
  ADD COLUMN cancel_token UUID NOT NULL DEFAULT gen_random_uuid();
