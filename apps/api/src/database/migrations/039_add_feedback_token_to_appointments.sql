ALTER TABLE appointments ADD COLUMN feedback_token UUID;
UPDATE appointments SET feedback_token = gen_random_uuid();
ALTER TABLE appointments ALTER COLUMN feedback_token SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN feedback_token SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX ON appointments (feedback_token);
