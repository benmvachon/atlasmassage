CREATE TABLE travel_settings (
  id                  SERIAL      PRIMARY KEY,
  travel_mode_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO travel_settings (travel_mode_enabled) VALUES (TRUE);

-- The business is launching as a travel massage service centered on this
-- address; it is also the origin point for the service-area map and the
-- booking drive-time check.
UPDATE business_contact_info
SET address_line1 = '101 Bellevue Street',
    address_line2 = '',
    city = 'Newton',
    state = 'MA',
    zip = '02458',
    updated_at = NOW();
