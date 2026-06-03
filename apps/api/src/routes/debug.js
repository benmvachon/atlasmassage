/**
 * Dev/test-only routes — never mounted in production.
 * Used by Playwright E2E tests to set up state that would otherwise
 * require out-of-band mechanisms (e.g. reading email to get a reset token).
 */
import { Router } from 'express';
import { getPool } from '../database/pool.js';
import { generateResetToken } from '../services/tokenService.js';

const router = Router();

/**
 * POST /api/v1/debug/issue-reset-token
 * Body: { email }
 * Response: { data: { token } }
 *
 * Writes a fresh password-reset token to the DB and returns the raw value.
 * Replaces the forgot-password email delivery step for E2E tests.
 */
router.post('/issue-reset-token', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'email required' });

    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    }

    const { raw, hash, expiresAt } = generateResetToken();
    await pool.query(
      `UPDATE users
         SET password_reset_token_hash = $1, password_reset_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [hash, expiresAt, rows[0].id]
    );

    res.json({ success: true, data: { token: raw } });
  } catch (err) {
    next(err);
  }
});

export default router;
