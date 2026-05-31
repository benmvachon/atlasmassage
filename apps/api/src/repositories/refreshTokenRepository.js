export class RefreshTokenRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ userId, tokenHash, expiresAt }) {
    const { rows: [token] } = await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, tokenHash, expiresAt]
    );
    return token;
  }

  async findByHash(hash) {
    const { rows } = await this.pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1',
      [hash]
    );
    return rows[0] ?? null;
  }

  async revoke(id) {
    await this.pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [id]
    );
  }

  async revokeAllForUser(userId) {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }
}
