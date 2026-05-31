CREATE TYPE notification_channel AS ENUM ('email', 'sms');
CREATE TYPE notification_status  AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID                  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel        notification_channel  NOT NULL,
  status         notification_status   NOT NULL DEFAULT 'pending',
  subject        VARCHAR(255),
  body           TEXT                  NOT NULL,
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status  ON notifications (status);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                  UUID    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  email_appointment_remind BOOLEAN NOT NULL DEFAULT TRUE,
  email_booking_confirm    BOOLEAN NOT NULL DEFAULT TRUE,
  sms_appointment_remind   BOOLEAN NOT NULL DEFAULT FALSE,
  sms_booking_confirm      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
