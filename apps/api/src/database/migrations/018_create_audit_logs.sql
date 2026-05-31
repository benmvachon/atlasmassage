CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID        REFERENCES users (id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(100) NOT NULL,
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id   ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
