import { randomBytes } from 'crypto';

// Base32 alphabet — no 0/O/I/1/L to avoid visual ambiguity
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, b => ALPHABET[b % 32]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export class GiftCardRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ originalAmountCents, purchaserEmail, purchaserName, recipientEmail, recipientName, message, stripeCheckoutSessionId }) {
    const code = generateCode();
    const { rows: [card] } = await this.pool.query(
      `INSERT INTO gift_cards
         (code, original_amount_cents, remaining_balance_cents,
          purchaser_email, purchaser_name, recipient_email, recipient_name,
          message, stripe_checkout_session_id, status)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [code, originalAmountCents, purchaserEmail, purchaserName ?? null,
       recipientEmail ?? null, recipientName ?? null, message ?? null, stripeCheckoutSessionId ?? null]
    );
    return card;
  }

  async activate(id) {
    const { rows: [card] } = await this.pool.query(
      `UPDATE gift_cards
       SET status = 'active', purchased_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return card;
  }

  async findByCode(code) {
    const { rows } = await this.pool.query(
      'SELECT * FROM gift_cards WHERE code = $1',
      [code.toUpperCase()]
    );
    return rows[0] ?? null;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM gift_cards WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async findByCheckoutSessionId(sessionId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM gift_cards WHERE stripe_checkout_session_id = $1',
      [sessionId]
    );
    return rows[0] ?? null;
  }

  // Deducts amountCents from the card balance inside the provided pg client (for transactions).
  // Locks the row with SELECT FOR UPDATE to prevent race conditions.
  async deductBalance(client, { giftCardId, appointmentId, amountCents, note }) {
    const { rows: [locked] } = await client.query(
      'SELECT * FROM gift_cards WHERE id = $1 FOR UPDATE',
      [giftCardId]
    );
    if (!locked) throw new Error('Gift card not found');
    if (locked.status !== 'active') throw new Error('Gift card is not active');
    if (locked.remaining_balance_cents < amountCents) throw new Error('Insufficient gift card balance');

    const newBalance = locked.remaining_balance_cents - amountCents;
    const newStatus = newBalance === 0 ? 'exhausted' : 'active';

    await client.query(
      `UPDATE gift_cards
       SET remaining_balance_cents = $1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [newBalance, newStatus, giftCardId]
    );

    const { rows: [tx] } = await client.query(
      `INSERT INTO gift_card_transactions (gift_card_id, appointment_id, type, amount_cents, note)
       VALUES ($1, $2, 'debit', $3, $4) RETURNING *`,
      [giftCardId, appointmentId ?? null, amountCents, note ?? null]
    );

    return { updatedCard: { ...locked, remaining_balance_cents: newBalance, status: newStatus }, transaction: tx };
  }

  // Restores balance for a cancelled appointment. Returns total cents restored.
  async restoreForAppointment(appointmentId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: debits } = await client.query(
        `SELECT * FROM gift_card_transactions
         WHERE appointment_id = $1 AND type = 'debit'`,
        [appointmentId]
      );

      let totalRestored = 0;
      for (const debit of debits) {
        await client.query(
          `UPDATE gift_cards
           SET remaining_balance_cents = remaining_balance_cents + $1,
               status = CASE WHEN status = 'exhausted' THEN 'active' ELSE status END,
               updated_at = NOW()
           WHERE id = $2`,
          [debit.amount_cents, debit.gift_card_id]
        );
        await client.query(
          `INSERT INTO gift_card_transactions (gift_card_id, appointment_id, type, amount_cents, note)
           VALUES ($1, $2, 'credit', $3, 'Appointment cancelled — balance restored')`,
          [debit.gift_card_id, appointmentId, debit.amount_cents]
        );
        totalRestored += debit.amount_cents;
      }

      await client.query('COMMIT');
      return totalRestored;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listAll({ limit = 50, offset = 0 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT * FROM gift_cards ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async countAll() {
    const { rows: [{ count }] } = await this.pool.query('SELECT COUNT(*) FROM gift_cards');
    return parseInt(count, 10);
  }
}
