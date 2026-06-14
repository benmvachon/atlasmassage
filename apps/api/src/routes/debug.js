/**
 * Dev/test-only routes — never mounted in production.
 * Used by Playwright E2E tests to set up state that would otherwise
 * require out-of-band mechanisms (e.g. reading email to get a reset token,
 * attaching a Stripe test card, or triggering a webhook event).
 */
import crypto from 'crypto';
import Stripe from 'stripe';
import { Router } from 'express';
import { config } from '../config/index.js';
import { getPool } from '../database/pool.js';
import { generateResetToken } from '../services/tokenService.js';
import { PaymentService } from '../services/paymentService.js';
import { NotificationService } from '../services/notificationService.js';
import { GiftCardRepository } from '../repositories/giftCardRepository.js';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/debug/issue-reset-token
 * Body: { email }
 * Response: { data: { token } }
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
    if (!rows.length) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

    const { raw, hash, expiresAt } = generateResetToken();
    await pool.query(
      `UPDATE users SET password_reset_token_hash = $1, password_reset_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [hash, expiresAt, rows[0].id]
    );

    res.json({ success: true, data: { token: raw } });
  } catch (err) {
    next(err);
  }
});

// ── Payments ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/debug/attach-test-card
 * Body: { userId }
 * Response: { data: { method } }
 *
 * Creates a Stripe test Visa card via SetupIntent and saves it to the
 * payment_methods table. Lets tests start with a pre-existing saved card
 * without driving the full add-card UI.
 */
router.post('/attach-test-card', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

    const svc = new PaymentService(getPool());
    const customerId = await svc.ensureStripeCustomer(userId);

    const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });

    // Create and confirm a SetupIntent with pm_card_visa (Stripe test token)
    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    const confirmed = await stripe.setupIntents.confirm(si.id, {
      payment_method: 'pm_card_visa',
    });

    const method = await svc.addPaymentMethod(userId, confirmed.payment_method);
    res.json({ success: true, data: { method } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/debug/payment-methods/:userId
 * Removes all saved payment methods for a user from both Stripe and the DB.
 * Used by test beforeAll to start from a clean state.
 */
router.delete('/payment-methods/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const svc = new PaymentService(getPool());
    const methods = await svc.listPaymentMethods(userId);
    for (const m of methods) {
      await svc.removePaymentMethod(userId, m.id);
    }
    res.json({ success: true, data: { removed: methods.length } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/debug/stripe-event
 * Body: { event }  (a Stripe event object)
 * Response: { data: { received: true } }
 *
 * Signs the event with the webhook secret and passes it to the real webhook
 * handler so the full pipeline (including signature verification) is exercised.
 */
router.post('/stripe-event', async (req, res, next) => {
  try {
    const { event } = req.body;
    if (!event) return res.status(400).json({ success: false, error: 'event required' });

    const payload = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const hmac = crypto
      .createHmac('sha256', config.stripe.webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    const stripeSignature = `t=${timestamp},v1=${hmac}`;

    const svc = new PaymentService(getPool());
    const data = await svc.handleWebhook(Buffer.from(payload), stripeSignature);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/debug/appointments/:therapistId/:date
 * Hard-deletes all appointments for a therapist on a given date.
 * Used by test beforeAll/afterAll to ensure a clean daily slate.
 * FK dependents (soap_notes, client_feedback, transfer_requests) cascade;
 * payments and membership_credits nullify their appointment_id reference.
 */
router.delete('/appointments/:therapistId/:date', async (req, res, next) => {
  try {
    const { therapistId, date } = req.params;
    const pool = getPool();
    const { rows } = await pool.query(
      `DELETE FROM appointments
        WHERE therapist_id = $1
          AND scheduled_at::date = $2::date
        RETURNING id`,
      [therapistId, date]
    );
    res.json({ success: true, data: { deleted: rows.length } });
  } catch (err) {
    next(err);
  }
});

// ── Memberships ───────────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/debug/memberships/:userId
 * Cancels all active/paused memberships for a user.
 * Used by payments E2E beforeAll to prevent stale memberships from
 * causing membershipCoversBooking=true during payment flow tests.
 */
router.delete('/memberships/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE memberships SET status = 'cancelled', updated_at = NOW()
       WHERE client_id = $1 AND status IN ('active', 'paused')
       RETURNING id`,
      [userId]
    );
    res.json({ success: true, data: { cancelled: rows.length } });
  } catch (err) {
    next(err);
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/debug/send-booking-confirmation/:appointmentId
 * Triggers the booking-confirmation notification for an existing appointment.
 * Used to test the confirmation flow without going through the full booking UI.
 */
router.post('/send-booking-confirmation/:appointmentId', async (req, res, next) => {
  try {
    const svc = new NotificationService(getPool());
    await svc.sendBookingConfirmation(req.params.appointmentId);
    res.json({ success: true, data: { sent: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/debug/trigger-notifications
 * Runs all four cron notification jobs synchronously.
 * Used by E2E tests to exercise the reminder worker without waiting an hour.
 */
router.post('/trigger-notifications', async (req, res, next) => {
  try {
    const svc = new NotificationService(getPool());
    await svc.sendPendingReminders();
    await svc.sendPendingFeedbackRequests();
    await svc.sendPendingWeekFollowups();
    await svc.sendPendingMonthFollowups();
    res.json({ success: true, data: { ran: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/debug/appointments/backdated
 * Body: { therapistId, serviceId, clientId?, scheduledAt, status? }
 * Inserts an appointment directly with an arbitrary scheduledAt timestamp,
 * bypassing booking validations and availability checks.
 */
router.post('/appointments/backdated', async (req, res, next) => {
  try {
    const { therapistId, serviceId, clientId, scheduledAt, status = 'confirmed' } = req.body;
    if (!therapistId || !serviceId || !scheduledAt) {
      return res.status(400).json({ success: false, error: 'therapistId, serviceId, scheduledAt required' });
    }
    const pool = getPool();
    const { rows: [service] } = await pool.query(
      'SELECT duration_minutes FROM services WHERE id = $1',
      [serviceId]
    );
    if (!service) return res.status(404).json({ success: false, error: 'service not found' });
    const { rows: [appt] } = await pool.query(
      `INSERT INTO appointments
         (therapist_id, service_id, client_id, scheduled_at, status, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [therapistId, serviceId, clientId ?? null, scheduledAt, status, service.duration_minutes]
    );
    res.json({ success: true, data: { appointment: appt } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/debug/appointments/client/:clientId/future
 * Cancels all future non-cancelled appointments for a client.
 * Used by notification E2E tests to ensure no pending appointments suppress followup emails.
 */
router.delete('/appointments/client/:clientId/future', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
       WHERE client_id = $1
         AND scheduled_at > NOW()
         AND status NOT IN ('cancelled', 'completed')
       RETURNING id`,
      [clientId]
    );
    res.json({ success: true, data: { cancelled: rows.length } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/debug/appointments/:appointmentId
 * Cancels a single appointment by ID, bypassing business-logic guards.
 * Handles backdated test appointments that the normal cancel endpoint rejects.
 */
router.delete('/appointments/:appointmentId', async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const pool = getPool();
    await pool.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [appointmentId]
    );
    res.json({ success: true, data: { cancelled: true } });
  } catch (err) {
    next(err);
  }
});

// ── Gift Cards ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/debug/gift-cards
 * Body: { amountCents?, purchaserEmail? }
 * Creates an active gift card directly in the DB for E2E test setup.
 */
router.post('/gift-cards', async (req, res, next) => {
  try {
    const { amountCents = 15000, purchaserEmail = 'test@example.com' } = req.body;
    const pool = getPool();
    const repo = new GiftCardRepository(pool);
    const card = await repo.create({ originalAmountCents: amountCents, purchaserEmail });
    const activated = await repo.activate(card.id);
    res.json({ success: true, data: { giftCard: activated } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/debug/gift-cards/:code
 * Hard-deletes a gift card by code (cascades to transactions).
 */
router.delete('/gift-cards/:code', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rowCount } = await pool.query(
      'DELETE FROM gift_cards WHERE code = $1',
      [req.params.code.toUpperCase()]
    );
    res.json({ success: true, data: { deleted: rowCount } });
  } catch (err) {
    next(err);
  }
});

export default router;
