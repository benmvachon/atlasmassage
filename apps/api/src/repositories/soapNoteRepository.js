export class SoapNoteRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByAppointmentId(appointmentId) {
    const { rows } = await this.pool.query(
      `SELECT sn.*,
              u.first_name AS therapist_first_name,
              u.last_name  AS therapist_last_name
       FROM soap_notes sn
       JOIN users u ON u.id = sn.therapist_id
       WHERE sn.appointment_id = $1`,
      [appointmentId]
    );
    return rows[0] ?? null;
  }

  async upsert({ appointmentId, therapistId, subjective, objective, assessment, plan }) {
    const { rows } = await this.pool.query(
      `INSERT INTO soap_notes (appointment_id, therapist_id, subjective, objective, assessment, plan)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (appointment_id) DO UPDATE SET
         therapist_id = EXCLUDED.therapist_id,
         subjective   = EXCLUDED.subjective,
         objective    = EXCLUDED.objective,
         assessment   = EXCLUDED.assessment,
         plan         = EXCLUDED.plan,
         updated_at   = NOW()
       RETURNING *`,
      [appointmentId, therapistId, subjective, objective, assessment, plan]
    );
    return rows[0];
  }
}
