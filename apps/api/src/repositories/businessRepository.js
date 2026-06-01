export class BusinessRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getBusinessHours() {
    const { rows } = await this.pool.query(
      'SELECT * FROM business_hours ORDER BY day_of_week'
    );
    return rows;
  }

  async upsertBusinessHours(dayOfWeek, { openTime, closeTime, isClosed }) {
    const { rows } = await this.pool.query(
      `INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (day_of_week)
       DO UPDATE SET open_time = EXCLUDED.open_time,
                     close_time = EXCLUDED.close_time,
                     is_closed = EXCLUDED.is_closed
       RETURNING *`,
      [dayOfWeek, openTime, closeTime, isClosed]
    );
    return rows[0];
  }

  async getMassageBeds() {
    const { rows } = await this.pool.query(
      'SELECT * FROM massage_beds ORDER BY created_at'
    );
    return rows;
  }

  async createMassageBed(name) {
    const { rows } = await this.pool.query(
      'INSERT INTO massage_beds (name) VALUES ($1) RETURNING *',
      [name]
    );
    return rows[0];
  }

  async updateMassageBed(id, { name, isActive }) {
    const { rows } = await this.pool.query(
      'UPDATE massage_beds SET name = $1, is_active = $2 WHERE id = $3 RETURNING *',
      [name, isActive, id]
    );
    return rows[0] ?? null;
  }

  async deleteMassageBed(id) {
    const { rows } = await this.pool.query(
      'DELETE FROM massage_beds WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] ?? null;
  }

  async getServices() {
    const { rows } = await this.pool.query(
      'SELECT * FROM services ORDER BY name'
    );
    return rows;
  }

  async createService({ name, description, durationMinutes, priceCents }) {
    const { rows } = await this.pool.query(
      `INSERT INTO services (name, description, duration_minutes, price_cents)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description ?? null, durationMinutes, priceCents]
    );
    return rows[0];
  }

  async updateService(id, { name, description, durationMinutes, priceCents, isActive }) {
    const { rows } = await this.pool.query(
      `UPDATE services
       SET name = $1, description = $2, duration_minutes = $3, price_cents = $4,
           is_active = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description ?? null, durationMinutes, priceCents, isActive, id]
    );
    return rows[0] ?? null;
  }

  async deactivateService(id) {
    const { rows } = await this.pool.query(
      'UPDATE services SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0] ?? null;
  }
}
