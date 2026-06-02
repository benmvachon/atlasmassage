export class AppointmentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getByDateRange(startDate, endDate, { excludeId = null } = {}) {
    const params = [startDate, endDate];
    const excludeClause = excludeId ? `AND id != $${params.push(excludeId)}` : '';
    const { rows } = await this.pool.query(
      `SELECT therapist_id, bed_id, scheduled_at, duration_minutes
       FROM appointments
       WHERE scheduled_at::date >= $1::date
         AND scheduled_at::date <= $2::date
         AND status NOT IN ('cancelled')
         ${excludeClause}
       ORDER BY scheduled_at`,
      params
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

  async setMembership(id, membershipId) {
    const { rows: [appt] } = await this.pool.query(
      `UPDATE appointments SET membership_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [membershipId, id]
    );
    return appt;
  }

  async listForOwner({ start, end, therapistId }) {
    const params = [start, end];
    const therapistClause = therapistId
      ? `AND a.therapist_id = $${params.push(therapistId)}`
      : '';

    const { rows: appointments } = await this.pool.query(
      `SELECT
         a.id, a.status, a.scheduled_at, a.duration_minutes, a.notes,
         a.guest_name, a.guest_email, a.guest_phone,
         s.name AS service_name, s.price_cents,
         th.id AS therapist_id,
         th.first_name AS therapist_first_name,
         th.last_name  AS therapist_last_name,
         COALESCE(cl.first_name || ' ' || cl.last_name, a.guest_name) AS client_name,
         COALESCE(cl.email, a.guest_email) AS client_email,
         cl.phone AS client_phone
       FROM appointments a
       JOIN services s    ON s.id = a.service_id
       JOIN users th      ON th.id = a.therapist_id
       LEFT JOIN users cl ON cl.id = a.client_id
       WHERE a.scheduled_at::date >= $1::date
         AND a.scheduled_at::date <= $2::date
         ${therapistClause}
       ORDER BY a.scheduled_at`,
      params
    );

    const { rows: therapists } = await this.pool.query(
      `SELECT u.id, u.first_name, u.last_name
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r        ON r.id = ur.role_id
       WHERE r.name = 'therapist' AND u.is_active = TRUE
       ORDER BY u.first_name, u.last_name`
    );

    return { appointments, therapists };
  }

  async listForTherapist({ therapistId, month, clientSearch, statusFilter }) {
    const params = [therapistId];
    const conditions = ['a.therapist_id = $1'];

    if (month) {
      // month is YYYY-MM
      const [y, m] = month.split('-');
      const start = `${y}-${m}-01`;
      const end = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      params.push(start, end);
      conditions.push(`a.scheduled_at::date >= $${params.length - 1}::date`);
      conditions.push(`a.scheduled_at::date <= $${params.length}::date`);
    }

    if (clientSearch) {
      params.push(`%${clientSearch}%`);
      const n = params.length;
      conditions.push(
        `(COALESCE(cl.first_name || ' ' || cl.last_name, a.guest_name) ILIKE $${n}
          OR COALESCE(cl.email, a.guest_email) ILIKE $${n})`
      );
    }

    const statusCondition = {
      future:             `a.status IN ('pending','confirmed') AND a.scheduled_at > NOW()`,
      past:               `(a.status IN ('completed','no_show') OR (a.status NOT IN ('cancelled') AND a.scheduled_at < NOW()))`,
      cancelled:          `a.status = 'cancelled'`,
      transfer_requested: `EXISTS (SELECT 1 FROM appointment_transfer_requests tr WHERE tr.appointment_id = a.id AND tr.status = 'pending')`,
    }[statusFilter];

    if (statusCondition) conditions.push(statusCondition);

    const { rows } = await this.pool.query(
      `SELECT
         a.id, a.status, a.scheduled_at, a.duration_minutes, a.notes,
         a.guest_name, a.guest_email, a.guest_phone,
         s.name AS service_name, s.price_cents,
         COALESCE(cl.first_name || ' ' || cl.last_name, a.guest_name) AS client_name,
         COALESCE(cl.email, a.guest_email) AS client_email,
         COALESCE(cl.phone, a.guest_phone) AS client_phone,
         tr.id AS transfer_request_id,
         tr.status AS transfer_status,
         tr.reason AS transfer_reason
       FROM appointments a
       JOIN services s ON s.id = a.service_id
       LEFT JOIN users cl ON cl.id = a.client_id
       LEFT JOIN appointment_transfer_requests tr
         ON tr.appointment_id = a.id AND tr.status = 'pending'
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.scheduled_at DESC`,
      params
    );
    return rows;
  }

  async getRevenueStats({ start, end }) {
    const [dailyRows, byServiceRows, byTherapistRows, summaryRows, membershipRows] = await Promise.all([
      this.pool.query(
        `SELECT
           DATE(p.created_at AT TIME ZONE 'UTC') AS day,
           COUNT(*)::int                         AS payment_count,
           SUM(p.amount_cents)::bigint           AS total_cents
         FROM payments p
         WHERE p.status = 'succeeded'
           AND p.created_at::date >= $1::date
           AND p.created_at::date <= $2::date
         GROUP BY 1
         ORDER BY 1`,
        [start, end]
      ),
      this.pool.query(
        `SELECT
           s.name               AS service_name,
           COUNT(a.id)::int     AS appointment_count,
           SUM(s.price_cents)::bigint AS total_cents
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         WHERE a.status IN ('confirmed','completed')
           AND a.scheduled_at::date >= $1::date
           AND a.scheduled_at::date <= $2::date
         GROUP BY s.name
         ORDER BY total_cents DESC`,
        [start, end]
      ),
      this.pool.query(
        `SELECT
           th.first_name || ' ' || th.last_name AS therapist_name,
           COUNT(a.id)::int                      AS appointment_count,
           SUM(s.price_cents)::bigint            AS total_cents
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN users th   ON th.id = a.therapist_id
         WHERE a.status IN ('confirmed','completed')
           AND a.scheduled_at::date >= $1::date
           AND a.scheduled_at::date <= $2::date
         GROUP BY th.id, th.first_name, th.last_name
         ORDER BY total_cents DESC`,
        [start, end]
      ),
      this.pool.query(
        `SELECT
           COUNT(*)::int            AS total_payments,
           SUM(amount_cents)::bigint AS total_cents,
           COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded_count,
           SUM(amount_cents) FILTER (WHERE status = 'succeeded')::bigint AS succeeded_cents,
           COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_count,
           SUM(amount_cents) FILTER (WHERE status = 'refunded')::bigint AS refunded_cents
         FROM payments
         WHERE created_at::date >= $1::date
           AND created_at::date <= $2::date`,
        [start, end]
      ),
      this.pool.query(
        `SELECT
           mp.name                AS plan_name,
           COUNT(m.id)::int       AS active_count,
           SUM(mp.price_monthly_cents)::bigint AS monthly_cents
         FROM memberships m
         JOIN membership_plans mp ON mp.id = m.plan_id
         WHERE m.status = 'active'
         GROUP BY mp.name, mp.price_monthly_cents
         ORDER BY monthly_cents DESC`
      ),
    ]);

    return {
      daily:       dailyRows.rows,
      byService:   byServiceRows.rows,
      byTherapist: byTherapistRows.rows,
      summary:     summaryRows.rows[0],
      memberships: membershipRows.rows,
    };
  }

  async getDashboardStats() {
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().slice(0, 10);

    const [todayAppts, weekRevenue, monthRevenue, activeMemberships, pendingAppts] = await Promise.all([
      this.pool.query(
        `SELECT COUNT(*)::int AS count FROM appointments
         WHERE scheduled_at::date = $1 AND status NOT IN ('cancelled')`,
        [today]
      ),
      this.pool.query(
        `SELECT COALESCE(SUM(amount_cents),0)::bigint AS cents FROM payments
         WHERE status = 'succeeded' AND created_at::date >= $1`,
        [weekStart]
      ),
      this.pool.query(
        `SELECT COALESCE(SUM(amount_cents),0)::bigint AS cents FROM payments
         WHERE status = 'succeeded' AND created_at::date >= $1`,
        [monthStart]
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS count FROM memberships WHERE status = 'active'`
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS count FROM appointments WHERE status = 'pending'`
      ),
    ]);

    return {
      today_appointments:   todayAppts.rows[0].count,
      week_revenue_cents:   weekRevenue.rows[0].cents,
      month_revenue_cents:  monthRevenue.rows[0].cents,
      active_memberships:   activeMemberships.rows[0].count,
      pending_appointments: pendingAppts.rows[0].count,
    };
  }

  async reschedule(id, { scheduledAt, therapistId }) {
    const params = [id, scheduledAt, therapistId];
    const { rows } = await this.pool.query(
      `UPDATE appointments
       SET scheduled_at = $2, therapist_id = $3, reminded_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params
    );
    return rows[0] ?? null;
  }

  async create({
    clientId, therapistId, serviceId, scheduledAt, durationMinutes,
    notes, guestName, guestEmail, guestPhone, waiverSignature,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO appointments
         (client_id, therapist_id, service_id, scheduled_at, duration_minutes,
          notes, guest_name, guest_email, guest_phone,
          waiver_signature, waiver_signed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [clientId ?? null, therapistId, serviceId, scheduledAt, durationMinutes,
       notes ?? null, guestName ?? null, guestEmail ?? null, guestPhone ?? null,
       waiverSignature]
    );
    return rows[0];
  }
}
