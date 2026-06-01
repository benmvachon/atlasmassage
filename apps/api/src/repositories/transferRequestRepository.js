export class TransferRequestRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(appointmentId, fromTherapistId, reason) {
    const { rows } = await this.pool.query(
      `INSERT INTO appointment_transfer_requests
         (appointment_id, from_therapist_id, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [appointmentId, fromTherapistId, reason ?? null]
    );
    return rows[0];
  }

  async findPendingByAppointment(appointmentId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM appointment_transfer_requests
       WHERE appointment_id = $1 AND status = 'pending'`,
      [appointmentId]
    );
    return rows[0] ?? null;
  }

  async listPending() {
    const { rows } = await this.pool.query(
      `SELECT
         tr.id, tr.appointment_id, tr.reason, tr.created_at, tr.status,
         tr.from_therapist_id, tr.to_therapist_id,
         fr.first_name AS from_first_name, fr.last_name AS from_last_name,
         a.scheduled_at, a.duration_minutes,
         s.name AS service_name,
         COALESCE(cl.first_name || ' ' || cl.last_name, a.guest_name) AS client_name
       FROM appointment_transfer_requests tr
       JOIN appointments a ON a.id = tr.appointment_id
       JOIN services s     ON s.id = a.service_id
       JOIN users fr       ON fr.id = tr.from_therapist_id
       LEFT JOIN users cl  ON cl.id = a.client_id
       WHERE tr.status = 'pending'
         AND a.status NOT IN ('cancelled', 'completed', 'no_show')
         AND a.scheduled_at > NOW()
       ORDER BY a.scheduled_at`
    );
    return rows;
  }

  async approve(id, toTherapistId, reviewedBy) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [tr] } = await client.query(
        `UPDATE appointment_transfer_requests
         SET status = 'approved', to_therapist_id = $1, reviewed_by = $2, updated_at = NOW()
         WHERE id = $3 AND status = 'pending'
         RETURNING *`,
        [toTherapistId, reviewedBy, id]
      );
      if (!tr) throw new Error('Transfer request not found or already resolved');

      await client.query(
        `UPDATE appointments
         SET therapist_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [toTherapistId, tr.appointment_id]
      );

      await client.query('COMMIT');
      return tr;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deny(id, reviewedBy) {
    const { rows } = await this.pool.query(
      `UPDATE appointment_transfer_requests
       SET status = 'denied', reviewed_by = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [reviewedBy, id]
    );
    return rows[0] ?? null;
  }
}
