export class HealthRecordRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findLatestByClientId(clientId) {
    const { rows } = await this.pool.query(
      `SELECT id FROM health_records
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [clientId]
    );
    return rows[0] ?? null;
  }

  async create({ clientId, guestEmail, currentMedications, recentSurgeries, pregnancyStatus, injuries, dateOfBirth }) {
    const { rows } = await this.pool.query(
      `INSERT INTO health_records
         (client_id, guest_email, current_medications, recent_surgeries, pregnancy_status, injuries, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        clientId ?? null,
        guestEmail ?? null,
        currentMedications || null,
        recentSurgeries || null,
        pregnancyStatus || null,
        injuries || null,
        dateOfBirth || null,
      ]
    );
    return rows[0];
  }
}
