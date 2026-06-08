export class ClientFeedbackRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByAppointmentId(appointmentId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM client_feedback WHERE appointment_id = $1',
      [appointmentId]
    );
    return rows[0] ?? null;
  }

  async create({ appointmentId, clientId, guestEmail, rating, comments }) {
    const { rows } = await this.pool.query(
      `INSERT INTO client_feedback (appointment_id, client_id, guest_email, rating, comments)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [appointmentId, clientId ?? null, guestEmail ?? null, rating, comments ?? null]
    );
    return rows[0];
  }
}
