-- Audit attribution has to outlive the user record it points at. The original
-- foreign key (migration 018) used ON DELETE SET NULL, which erased "who did
-- this" the moment an account was removed — precisely when the trail matters
-- most. Drop the constraint and keep the raw UUID; the read path LEFT JOINs
-- users for a display name and falls back to the bare id when the user is gone.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- The owner-facing log viewer filters by action; the existing indexes only
-- cover user_id, (entity, entity_id), and created_at.
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
