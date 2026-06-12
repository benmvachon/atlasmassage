export class ClientHistoryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByAppointment(appointmentId) {
    const { rows: [pivot] } = await this.pool.query(
      `SELECT a.client_id, a.guest_email, a.guest_name,
              u.first_name, u.last_name, u.email AS client_email
       FROM appointments a
       LEFT JOIN users u ON u.id = a.client_id
       WHERE a.id = $1`,
      [appointmentId]
    );
    if (!pivot) return null;
    if (!pivot.client_id && !pivot.guest_email) return null;

    const clientName = pivot.client_id
      ? `${pivot.first_name} ${pivot.last_name}`
      : pivot.guest_name;
    const clientEmail = pivot.client_email ?? pivot.guest_email;

    const { rows: sessions } = await this.pool.query(
      `SELECT
         a.id                       AS appointment_id,
         a.scheduled_at,
         a.duration_minutes,
         a.status,
         a.notes                    AS appointment_notes,
         s.name                     AS service_name,
         t.id                       AS therapist_id,
         t.first_name               AS therapist_first_name,
         t.last_name                AS therapist_last_name,
         hr.id                      AS health_record_id,
         hr.date_of_birth,
         hr.current_medications,
         hr.recent_surgeries,
         hr.pregnancy_status,
         hr.injuries,
         hr.created_at              AS health_record_created_at,
         cs.id                      AS consent_id,
         cs.signed_at               AS consent_signed_at,
         sn.id                      AS soap_note_id,
         sn.subjective,
         sn.objective,
         sn.assessment,
         sn.plan,
         sn.created_at              AS soap_created_at,
         sn.updated_at              AS soap_updated_at,
         sn_t.id                    AS soap_therapist_id,
         sn_t.first_name            AS soap_therapist_first_name,
         sn_t.last_name             AS soap_therapist_last_name,
         cf.id                      AS feedback_id,
         cf.rating                  AS feedback_rating,
         cf.comments                AS feedback_comments,
         cf.submitted_at            AS feedback_submitted_at
       FROM appointments a
       JOIN services s              ON s.id = a.service_id
       JOIN users t                 ON t.id = a.therapist_id
       LEFT JOIN health_records hr  ON hr.id = a.health_record_id
       LEFT JOIN consent_signatures cs ON cs.id = a.consent_signature_id
       LEFT JOIN soap_notes sn      ON sn.appointment_id = a.id
       LEFT JOIN users sn_t         ON sn_t.id = sn.therapist_id
       LEFT JOIN client_feedback cf ON cf.appointment_id = a.id
       WHERE ($1::uuid IS NOT NULL AND a.client_id = $1::uuid)
          OR ($2::text IS NOT NULL AND a.guest_email = $2::text)
       ORDER BY a.scheduled_at DESC`,
      [pivot.client_id ?? null, pivot.guest_email ?? null]
    );

    return { clientName, clientEmail, clientId: pivot.client_id ?? null, sessions };
  }
}
