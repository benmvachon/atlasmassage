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

  async findServiceById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM services WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  async createService({ name, description, durationMinutes, priceCents, stripeProductId, stripePriceId }) {
    const { rows } = await this.pool.query(
      `INSERT INTO services (name, description, duration_minutes, price_cents, stripe_product_id, stripe_price_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description ?? null, durationMinutes, priceCents, stripeProductId ?? null, stripePriceId ?? null]
    );
    return rows[0];
  }

  async updateService(id, { name, description, durationMinutes, priceCents, isActive, stripeProductId, stripePriceId }) {
    const sets = ['name = $1', 'description = $2', 'duration_minutes = $3', 'price_cents = $4', 'is_active = $5', 'updated_at = NOW()'];
    const vals = [name, description ?? null, durationMinutes, priceCents, isActive];
    let i = 6;
    if (stripeProductId !== undefined) { sets.push(`stripe_product_id = $${i++}`); vals.push(stripeProductId); }
    if (stripePriceId !== undefined)   { sets.push(`stripe_price_id = $${i++}`);   vals.push(stripePriceId); }
    vals.push(id);

    const { rows } = await this.pool.query(
      `UPDATE services SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
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

  async getBookingRestrictions() {
    const { rows } = await this.pool.query(
      'SELECT * FROM booking_restrictions LIMIT 1'
    );
    return rows[0] ?? null;
  }

  async updateBookingRestrictions({ restrictPregnancy, restrictMinors }) {
    const { rows } = await this.pool.query(
      `UPDATE booking_restrictions
       SET restrict_pregnancy = $1, restrict_minors = $2, updated_at = NOW()
       RETURNING *`,
      [restrictPregnancy, restrictMinors]
    );
    return rows[0];
  }
}
