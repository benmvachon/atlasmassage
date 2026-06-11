export class PaymentRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findPaymentMethodsByClient(clientId) {
    const { rows } = await this.pool.query(
      `SELECT * FROM payment_methods WHERE client_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [clientId]
    );
    return rows;
  }

  async findPaymentMethodById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM payment_methods WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  async createPaymentMethod({ clientId, stripePaymentMethodId, brand, last4, expiryMonth, expiryYear, isDefault }) {
    const { rows: [pm] } = await this.pool.query(
      `INSERT INTO payment_methods
         (client_id, stripe_payment_method_id, brand, last4, expiry_month, expiry_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [clientId, stripePaymentMethodId, brand, last4, expiryMonth, expiryYear, isDefault]
    );
    return pm;
  }

  async setDefault(id, clientId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE payment_methods SET is_default = FALSE WHERE client_id = $1',
        [clientId]
      );
      await client.query(
        'UPDATE payment_methods SET is_default = TRUE WHERE id = $1',
        [id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deletePaymentMethod(id) {
    await this.pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
  }

  async createPayment({ clientId, appointmentId, membershipId, amountCents, currency, status, stripePaymentIntentId, source, inPersonMethod }) {
    const { rows: [payment] } = await this.pool.query(
      `INSERT INTO payments
         (client_id, appointment_id, membership_id, amount_cents, currency, status, stripe_payment_intent_id, source, in_person_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        clientId ?? null,
        appointmentId ?? null,
        membershipId ?? null,
        amountCents,
        currency ?? 'USD',
        status ?? 'pending',
        stripePaymentIntentId ?? null,
        source ?? 'stripe',
        inPersonMethod ?? null,
      ]
    );
    return payment;
  }

  async updatePaymentStatus(id, status, stripePaymentIntentId) {
    const { rows: [payment] } = await this.pool.query(
      `UPDATE payments
       SET status = $1, stripe_payment_intent_id = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, stripePaymentIntentId, id]
    );
    return payment;
  }

  async findPaymentByStripeIntentId(stripePaymentIntentId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
      [stripePaymentIntentId]
    );
    return rows[0] ?? null;
  }

  async findPaymentsByClient(clientId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM payments WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    return rows;
  }

  async findPaymentsByAppointmentId(appointmentId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM payments WHERE appointment_id = $1 ORDER BY created_at DESC',
      [appointmentId]
    );
    return rows;
  }
}
