const SELECT_THERAPIST = `
  SELECT
    u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
    u.created_at, u.updated_at,
    t.bio, t.specialties, t.is_accepting_clients,
    t.headshot_url, t.display_order,
    t.daily_booking_limit, t.weekly_booking_limit,
    COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
  FROM users u
  JOIN therapists t ON t.user_id = u.id
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

export class TherapistRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      `${SELECT_THERAPIST}
       GROUP BY u.id, t.user_id
       ORDER BY t.display_order ASC, u.last_name, u.first_name`
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `${SELECT_THERAPIST}
       WHERE u.id = $1
       GROUP BY u.id, t.user_id`,
      [id]
    );
    return rows[0] ?? null;
  }

  async create({ email, passwordHash, firstName, lastName, phone, bio, specialties, isAcceptingClients }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [email.toLowerCase(), passwordHash, firstName, lastName, phone ?? null]
      );

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'therapist'`,
        [user.id]
      );

      await client.query(
        `INSERT INTO therapists (user_id, bio, specialties, is_accepting_clients)
         VALUES ($1, $2, $3, $4)`,
        [user.id, bio ?? null, specialties ?? [], isAcceptingClients ?? true]
      );

      await client.query('COMMIT');
      return user.id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateProfile(id, { bio, specialties, isAcceptingClients, displayOrder }) {
    const { rows } = await this.pool.query(
      `UPDATE therapists
       SET bio = $1, specialties = $2, is_accepting_clients = $3,
           display_order = $4, updated_at = NOW()
       WHERE user_id = $5 RETURNING user_id`,
      [bio ?? null, specialties ?? [], isAcceptingClients, displayOrder ?? 0, id]
    );
    return rows[0] ?? null;
  }

  async updateHeadshot(id, headshotUrl) {
    const { rows } = await this.pool.query(
      'UPDATE therapists SET headshot_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id',
      [headshotUrl, id]
    );
    return rows[0] ?? null;
  }

  async deactivate(id) {
    const { rows } = await this.pool.query(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] ?? null;
  }
}
