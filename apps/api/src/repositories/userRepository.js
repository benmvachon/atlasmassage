const WITH_ROLES = `
  SELECT u.*,
    COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r       ON r.id = ur.role_id
`;

export class UserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query(
      `${WITH_ROLES} WHERE u.email = $1 GROUP BY u.id`,
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `${WITH_ROLES} WHERE u.id = $1 GROUP BY u.id`,
      [id]
    );
    return rows[0] ?? null;
  }

  async findByResetToken(tokenHash) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE password_reset_token_hash = $1',
      [tokenHash]
    );
    return rows[0] ?? null;
  }

  // Runs INSERT into users + user_roles in a single transaction
  async create({ email, passwordHash, firstName, lastName, phone }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email, passwordHash, firstName, lastName, phone ?? null]
      );

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'client'`,
        [user.id]
      );

      await client.query('COMMIT');
      return { ...user, roles: ['client'] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updatePasswordHash(id, passwordHash) {
    await this.pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );
  }

  async setResetToken(id, tokenHash, expiresAt) {
    await this.pool.query(
      `UPDATE users
       SET password_reset_token_hash = $1, password_reset_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [tokenHash, expiresAt, id]
    );
  }

  async clearResetToken(id) {
    await this.pool.query(
      `UPDATE users
       SET password_reset_token_hash = NULL, password_reset_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }
}
