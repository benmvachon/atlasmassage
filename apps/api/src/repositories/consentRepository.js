export class ConsentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findByClientId(clientId) {
    const { rows } = await this.pool.query(
      `SELECT id, signed_at FROM consent_signatures
       WHERE client_id = $1
       ORDER BY signed_at DESC
       LIMIT 1`,
      [clientId]
    );
    return rows[0] ?? null;
  }

  async create({ clientId, guestEmail, signature }) {
    const { rows } = await this.pool.query(
      `INSERT INTO consent_signatures (client_id, guest_email, signature)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [clientId ?? null, guestEmail ?? null, signature]
    );
    return rows[0];
  }
}
