ALTER TABLE appointments
  ADD COLUMN guest_address_line1 TEXT,
  ADD COLUMN guest_address_line2 TEXT,
  ADD COLUMN guest_city          TEXT,
  ADD COLUMN guest_state         TEXT,
  ADD COLUMN guest_zip           TEXT;
