-- Make the travel service-area radius owner-configurable and cache the derived
-- list of towns we serve. The town list is expensive to compute (geocoding +
-- Distance Matrix + reverse geocoding), so it is persisted here and only
-- recomputed when its inputs change — the origin address or max_drive_minutes.
-- That input fingerprint is stored in service_area_signature.

ALTER TABLE travel_settings
  ADD COLUMN max_drive_minutes      INTEGER     NOT NULL DEFAULT 20,
  ADD COLUMN service_area_towns     JSONB,
  ADD COLUMN service_area_signature TEXT,
  ADD COLUMN service_area_computed_at TIMESTAMPTZ;
