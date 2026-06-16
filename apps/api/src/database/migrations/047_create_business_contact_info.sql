CREATE TABLE business_contact_info (
  id              SERIAL       PRIMARY KEY,
  address_line1   VARCHAR(200) NOT NULL DEFAULT '',
  address_line2   VARCHAR(200) NOT NULL DEFAULT '',
  city            VARCHAR(100) NOT NULL DEFAULT '',
  state           VARCHAR(100) NOT NULL DEFAULT '',
  zip             VARCHAR(20)  NOT NULL DEFAULT '',
  phone           VARCHAR(30)  NOT NULL DEFAULT '',
  email           VARCHAR(255) NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO business_contact_info (address_line1, address_line2, city, state, zip, phone, email)
VALUES ('123 Boylston Street', '', 'Boston', 'MA', '02116', '(617) 555-0100', 'hello@atlasmassage.com');
