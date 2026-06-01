ALTER TABLE therapists
  ADD COLUMN daily_booking_limit  INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN weekly_booking_limit INTEGER NOT NULL DEFAULT 25;

ALTER TABLE therapists
  ADD CONSTRAINT chk_daily_booking_limit  CHECK (daily_booking_limit  >= 1),
  ADD CONSTRAINT chk_weekly_booking_limit CHECK (weekly_booking_limit >= 1);
