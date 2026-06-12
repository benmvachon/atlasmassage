ALTER TABLE appointments ADD COLUMN soap_token UUID;
UPDATE appointments SET soap_token = gen_random_uuid();
ALTER TABLE appointments ALTER COLUMN soap_token SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN soap_token SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX ON appointments (soap_token);

ALTER TABLE appointments ADD COLUMN soap_notes_prompt_sent_at TIMESTAMPTZ;
