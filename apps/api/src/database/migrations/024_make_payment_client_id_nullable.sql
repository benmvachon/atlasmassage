-- Guest bookings require payment but have no user account, so client_id must be nullable.
ALTER TABLE payments ALTER COLUMN client_id DROP NOT NULL;
