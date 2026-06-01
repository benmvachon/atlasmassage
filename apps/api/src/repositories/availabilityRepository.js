export class AvailabilityRepository {
  constructor(pool) {
    this.pool = pool;
  }

  // Used by booking calendar: joins user name, optionally filtered to one therapist.
  async getForDateRange(startDate, endDate, therapistId = null) {
    const params = [startDate, endDate];
    let where = 'a.specific_date >= $1 AND a.specific_date <= $2 AND u.is_active = TRUE';
    if (therapistId) {
      params.push(therapistId);
      where += ` AND a.therapist_id = $${params.length}`;
    } else {
      where += ' AND a.therapist_id IN (SELECT user_id FROM therapists WHERE is_accepting_clients = TRUE)';
    }
    const { rows } = await this.pool.query(
      `SELECT a.therapist_id, a.specific_date, a.start_time, a.end_time,
              u.first_name, u.last_name
       FROM availability a
       JOIN users u ON u.id = a.therapist_id
       WHERE ${where}
       ORDER BY a.specific_date, a.start_time`,
      params
    );
    return rows;
  }

  async getByTherapistAndMonth(therapistId, year, month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const { rows } = await this.pool.query(
      `SELECT id, therapist_id, specific_date, start_time, end_time, created_at, updated_at
       FROM availability
       WHERE therapist_id = $1 AND specific_date >= $2 AND specific_date <= $3
       ORDER BY specific_date`,
      [therapistId, start, end]
    );
    return rows;
  }

  async upsertMany(therapistId, entries) {
    if (entries.length === 0) return [];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const { date, startTime, endTime } of entries) {
        const { rows } = await client.query(
          `INSERT INTO availability (therapist_id, specific_date, start_time, end_time)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (therapist_id, specific_date)
           DO UPDATE SET start_time = EXCLUDED.start_time,
                         end_time   = EXCLUDED.end_time,
                         updated_at = NOW()
           RETURNING *`,
          [therapistId, date, startTime, endTime]
        );
        results.push(rows[0]);
      }
      await client.query('COMMIT');
      return results;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteMany(therapistId, dates) {
    const { rows } = await this.pool.query(
      `DELETE FROM availability
       WHERE therapist_id = $1 AND specific_date = ANY($2::date[])
       RETURNING specific_date`,
      [therapistId, dates]
    );
    return rows;
  }

  async updateLimits(therapistId, { dailyBookingLimit, weeklyBookingLimit }) {
    const { rows } = await this.pool.query(
      `UPDATE therapists
       SET daily_booking_limit = $1, weekly_booking_limit = $2, updated_at = NOW()
       WHERE user_id = $3
       RETURNING user_id, daily_booking_limit, weekly_booking_limit`,
      [dailyBookingLimit, weeklyBookingLimit, therapistId]
    );
    return rows[0] ?? null;
  }
}
