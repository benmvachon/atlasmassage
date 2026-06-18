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

  // Runs INSERT into users + user_roles + guest record linking in a single transaction.
  // Any appointments/payments previously made as a guest with this email are
  // retroactively associated with the new account.
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

      // Link any guest appointments booked with this email.
      // guest_email must be nulled out to satisfy the CHECK constraint
      // (client_id IS NOT NULL AND guest_email IS NULL). guest_name/guest_phone
      // are kept on the row as a historical record of the original booking.
      const { rows: linked } = await client.query(
        `UPDATE appointments
         SET client_id = $1, guest_email = NULL
         WHERE guest_email = $2 AND client_id IS NULL
         RETURNING id`,
        [user.id, email]
      );

      if (linked.length > 0) {
        const appointmentIds = linked.map(r => r.id);
        await client.query(
          `UPDATE payments
           SET client_id = $1
           WHERE client_id IS NULL AND appointment_id = ANY($2)`,
          [user.id, appointmentIds]
        );
      }

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

  async update(id, { firstName, lastName, phone, addressLine1, addressLine2, city, state, zip }) {
    const sets = ['updated_at = NOW()'];
    const vals = [];
    let i = 1;
    if (firstName    !== undefined) { sets.push(`first_name    = $${i++}`); vals.push(firstName); }
    if (lastName     !== undefined) { sets.push(`last_name     = $${i++}`); vals.push(lastName); }
    if (phone        !== undefined) { sets.push(`phone         = $${i++}`); vals.push(phone || null); }
    if (addressLine1 !== undefined) { sets.push(`address_line1 = $${i++}`); vals.push(addressLine1 || null); }
    if (addressLine2 !== undefined) { sets.push(`address_line2 = $${i++}`); vals.push(addressLine2 || null); }
    if (city         !== undefined) { sets.push(`city          = $${i++}`); vals.push(city || null); }
    if (state        !== undefined) { sets.push(`state         = $${i++}`); vals.push(state || null); }
    if (zip          !== undefined) { sets.push(`zip           = $${i++}`); vals.push(zip || null); }
    vals.push(id);
    await this.pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`,
      vals
    );
    return this.findById(id);
  }

  async updateStripeCustomerId(id, stripeCustomerId) {
    await this.pool.query(
      'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
      [stripeCustomerId, id]
    );
  }
}
