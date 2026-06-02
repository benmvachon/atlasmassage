ALTER TABLE appointments
  ADD COLUMN feedback_sent_at    TIMESTAMPTZ,
  ADD COLUMN followup_1w_sent_at TIMESTAMPTZ,
  ADD COLUMN followup_1m_sent_at TIMESTAMPTZ;

CREATE INDEX idx_appointments_feedback_pending
  ON appointments (scheduled_at)
  WHERE status = 'completed' AND feedback_sent_at IS NULL;

CREATE INDEX idx_appointments_followup_1w_pending
  ON appointments (scheduled_at)
  WHERE status = 'completed' AND client_id IS NOT NULL AND followup_1w_sent_at IS NULL;

CREATE INDEX idx_appointments_followup_1m_pending
  ON appointments (scheduled_at)
  WHERE status = 'completed' AND client_id IS NOT NULL AND followup_1m_sent_at IS NULL;
