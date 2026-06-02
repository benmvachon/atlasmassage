const APPT_DETAILS = `
  SELECT a.*,
    c.email      AS client_email,
    c.first_name AS client_first_name,
    c.last_name  AS client_last_name,
    c.phone      AS client_phone,
    s.name       AS service_name,
    s.duration_minutes,
    t.first_name AS therapist_first_name,
    t.last_name  AS therapist_last_name,
    t.id         AS therapist_user_id,
    t.email      AS therapist_email,
    t.phone      AS therapist_phone
  FROM appointments a
  LEFT JOIN users c ON c.id = a.client_id
  JOIN services s   ON s.id = a.service_id
  JOIN users t      ON t.id = a.therapist_id
`;

export class NotificationRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getOrCreatePreferences(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );
    if (rows[0]) return rows[0];

    const { rows: [prefs] } = await this.pool.query(
      `INSERT INTO notification_preferences (user_id)
       VALUES ($1) RETURNING *`,
      [userId]
    );
    return prefs;
  }

  async updatePreferences(userId, {
    emailAppointmentRemind,
    emailBookingConfirm,
    smsAppointmentRemind,
    smsBookingConfirm,
  }) {
    const { rows: [prefs] } = await this.pool.query(
      `INSERT INTO notification_preferences
         (user_id, email_appointment_remind, email_booking_confirm,
          sms_appointment_remind, sms_booking_confirm)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         email_appointment_remind = EXCLUDED.email_appointment_remind,
         email_booking_confirm    = EXCLUDED.email_booking_confirm,
         sms_appointment_remind   = EXCLUDED.sms_appointment_remind,
         sms_booking_confirm      = EXCLUDED.sms_booking_confirm,
         updated_at               = NOW()
       RETURNING *`,
      [userId, emailAppointmentRemind, emailBookingConfirm,
       smsAppointmentRemind, smsBookingConfirm]
    );
    return prefs;
  }

  async logNotification({ userId, channel, subject, body, status, errorMessage }) {
    const { rows: [notif] } = await this.pool.query(
      `INSERT INTO notifications
         (user_id, channel, subject, body, status, sent_at, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        channel,
        subject ?? null,
        body,
        status,
        status === 'sent' ? new Date() : null,
        errorMessage ?? null,
      ]
    );
    return notif;
  }

  async findByUser(userId, { limit = 50 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows;
  }

  async findAppointmentWithDetails(id) {
    const { rows } = await this.pool.query(
      `${APPT_DETAILS} WHERE a.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async findAppointmentsNeedingReminders() {
    const { rows } = await this.pool.query(
      `${APPT_DETAILS}
       WHERE a.status    = 'confirmed'
         AND a.scheduled_at >= NOW() + INTERVAL '23 hours'
         AND a.scheduled_at <  NOW() + INTERVAL '25 hours'
         AND a.reminded_at IS NULL`
    );
    return rows;
  }

  async markReminded(appointmentId) {
    await this.pool.query(
      `UPDATE appointments SET reminded_at = NOW() WHERE id = $1`,
      [appointmentId]
    );
  }

  async findAppointmentsNeedingFeedback() {
    const { rows } = await this.pool.query(
      `${APPT_DETAILS}
       WHERE a.status = 'completed'
         AND a.scheduled_at >= NOW() - INTERVAL '25 hours'
         AND a.scheduled_at <  NOW() - INTERVAL '23 hours'
         AND a.feedback_sent_at IS NULL
         AND (c.email IS NOT NULL OR a.guest_email IS NOT NULL)`
    );
    return rows;
  }

  async markFeedbackSent(appointmentId) {
    await this.pool.query(
      `UPDATE appointments SET feedback_sent_at = NOW() WHERE id = $1`,
      [appointmentId]
    );
  }

  async findAppointmentsNeedingWeekFollowup() {
    const { rows } = await this.pool.query(
      `${APPT_DETAILS}
       WHERE a.status = 'completed'
         AND a.client_id IS NOT NULL
         AND a.scheduled_at >= NOW() - INTERVAL '7 days 1 hour'
         AND a.scheduled_at <  NOW() - INTERVAL '6 days 23 hours'
         AND a.followup_1w_sent_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM appointments a2
           WHERE a2.client_id = a.client_id
             AND a2.status IN ('confirmed', 'pending')
             AND a2.scheduled_at > NOW()
         )`
    );
    return rows;
  }

  async markFollowup1wSent(appointmentId) {
    await this.pool.query(
      `UPDATE appointments SET followup_1w_sent_at = NOW() WHERE id = $1`,
      [appointmentId]
    );
  }

  async findAppointmentsNeedingMonthFollowup() {
    const { rows } = await this.pool.query(
      `${APPT_DETAILS}
       WHERE a.status = 'completed'
         AND a.client_id IS NOT NULL
         AND a.scheduled_at >= NOW() - INTERVAL '30 days 1 hour'
         AND a.scheduled_at <  NOW() - INTERVAL '29 days 23 hours'
         AND a.followup_1m_sent_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM appointments a2
           WHERE a2.client_id = a.client_id
             AND a2.status IN ('confirmed', 'pending')
             AND a2.scheduled_at > NOW()
         )`
    );
    return rows;
  }

  async markFollowup1mSent(appointmentId) {
    await this.pool.query(
      `UPDATE appointments SET followup_1m_sent_at = NOW() WHERE id = $1`,
      [appointmentId]
    );
  }
}
