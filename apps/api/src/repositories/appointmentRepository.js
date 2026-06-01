export class AppointmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getByDateRange(startDate, endDate) {
    const { rows } = await this.pool.query(
      `SELECT therapist_id, bed_id, scheduled_at, duration_minutes
       FROM appointments
       WHERE scheduled_at::date >= $1::date
         AND scheduled_at::date <= $2::date
         AND status NOT IN ('cancelled')
       ORDER BY scheduled_at`,
      [startDate, endDate]
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  async findServiceById(id) {
    const { rows } = await this.pool.query(
      'SELECT id, name, price_cents, duration_minutes FROM services WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  async updateStatus(id, status) {
    const { rows: [appt] } = await this.pool.query(
      `UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return appt;
  }

  async create({
    clientId, therapistId, serviceId, scheduledAt, durationMinutes,
    notes, guestName, guestEmail, guestPhone,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO appointments
         (client_id, therapist_id, service_id, scheduled_at, duration_minutes,
          notes, guest_name, guest_email, guest_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [clientId ?? null, therapistId, serviceId, scheduledAt, durationMinutes,
       notes ?? null, guestName ?? null, guestEmail ?? null, guestPhone ?? null]
    );
    return rows[0];
  }
}
