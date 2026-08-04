export class AuditLogRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ userId, action, entity, entityId, oldData, newData, ipAddress }) {
    const { rows } = await this.pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId ?? null,
        action,
        entity,
        entityId ?? null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress ?? null,
      ]
    );
    return rows[0];
  }

  // Filters are all optional and AND-composed. Returns a page of entries plus
  // the unpaginated total so the caller can render "showing X of Y".
  async list({ action, entity, userId, start, end, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = [];

    if (action) {
      params.push(action);
      where.push(`al.action = $${params.length}`);
    }
    if (entity) {
      params.push(entity);
      where.push(`al.entity = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      where.push(`al.user_id = $${params.length}`);
    }
    if (start) {
      params.push(start);
      where.push(`al.created_at >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      where.push(`al.created_at < $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows: [{ count }] } = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs al ${whereSql}`,
      params
    );

    const { rows } = await this.pool.query(
      `SELECT al.id,
              al.user_id,
              al.action,
              al.entity,
              al.entity_id,
              al.old_data,
              al.new_data,
              al.ip_address,
              al.created_at,
              u.first_name,
              u.last_name,
              u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereSql}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return { entries: rows, total: count };
  }

  // Powers the filter dropdowns — only values actually present in the log.
  async distinctActions() {
    const { rows } = await this.pool.query(
      'SELECT DISTINCT action FROM audit_logs ORDER BY action'
    );
    return rows.map(r => r.action);
  }
}
