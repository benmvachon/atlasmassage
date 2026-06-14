import Stripe from 'stripe';
import { config } from '../config/index.js';
import { GiftCardRepository } from '../repositories/giftCardRepository.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendGiftCardEmail } from './emailService.js';
import { logger } from '../logging/logger.js';

function getStripe() {
  if (!config.stripe.secretKey) {
    throw new AppError('Payment processing is not configured', 503, 'STRIPE_NOT_CONFIGURED');
  }
  return new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
}

export class GiftCardService {
  constructor(pool) {
    this.pool = pool;
    this.giftCards = new GiftCardRepository(pool);
  }

  async createCheckoutSession({ purchaserEmail, purchaserName, recipientEmail, recipientName, message, amountCents }) {
    if (!amountCents || amountCents < 15000 || amountCents > 50000) {
      throw new AppError('Gift card amount must be between $150 and $500', 400, 'INVALID_AMOUNT');
    }

    const stripe = getStripe();

    const card = await this.giftCards.create({
      originalAmountCents: amountCents,
      purchaserEmail,
      purchaserName,
      recipientEmail,
      recipientName,
      message,
      stripeCheckoutSessionId: null,
    });

    const displayAmount = `$${(amountCents / 100).toFixed(0)}`;
    const recipientLabel = recipientName || recipientEmail || 'the recipient';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: purchaserEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `Atlas Bodywork Gift Card — ${displayAmount}`,
            description: `Gift card for ${recipientLabel}`,
          },
        },
      }],
      metadata: {
        type: 'gift_card',
        giftCardId: card.id,
      },
      success_url: `${config.app.url}/gift-cards/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.app.url}/gift-cards`,
    });

    await this.pool.query(
      'UPDATE gift_cards SET stripe_checkout_session_id = $1, updated_at = NOW() WHERE id = $2',
      [session.id, card.id]
    );

    return { url: session.url };
  }

  async handleCheckoutCompleted(session) {
    if (session.metadata?.type !== 'gift_card') return;
    const giftCardId = session.metadata?.giftCardId;
    if (!giftCardId) return;

    const card = await this.giftCards.findById(giftCardId);
    if (!card || card.status !== 'pending') return;

    const activated = await this.giftCards.activate(giftCardId);

    const emailTarget = activated.recipient_email || activated.purchaser_email;
    sendGiftCardEmail({
      to: emailTarget,
      purchaserName: activated.purchaser_name,
      recipientName: activated.recipient_name,
      recipientEmail: activated.recipient_email,
      code: activated.code,
      amountCents: activated.original_amount_cents,
      message: activated.message,
    }).catch(err => {
      logger.error('gift_card_email_failed', { giftCardId, message: err.message });
    });

    if (activated.recipient_email && activated.recipient_email !== activated.purchaser_email) {
      sendGiftCardPurchaseConfirmation({
        to: activated.purchaser_email,
        purchaserName: activated.purchaser_name,
        recipientName: activated.recipient_name || activated.recipient_email,
        amountCents: activated.original_amount_cents,
      }).catch(err => {
        logger.error('gift_card_confirmation_email_failed', { giftCardId, message: err.message });
      });
    }
  }

  async validateCode(code) {
    const card = await this.giftCards.findByCode(code);
    if (!card) throw new AppError('Gift card not found', 404, 'NOT_FOUND');
    if (card.status === 'pending') throw new AppError('Gift card has not been activated yet', 400, 'NOT_ACTIVE');
    if (card.status === 'exhausted') throw new AppError('This gift card has been fully used', 400, 'EXHAUSTED');
    if (card.status === 'expired') throw new AppError('This gift card has expired', 400, 'EXPIRED');
    if (card.status !== 'active') throw new AppError('Gift card is not valid', 400, 'INVALID');

    return {
      id: card.id,
      code: card.code,
      originalAmountCents: card.original_amount_cents,
      remainingBalanceCents: card.remaining_balance_cents,
    };
  }

  // Deducts a gift card and records a payment — must be called inside an open transaction.
  // Caller is responsible for BEGIN / COMMIT / ROLLBACK on the dbClient.
  async applyToAppointment(dbClient, { code, appointmentId, clientId, servicePriceCents }) {
    const card = await this.giftCards.findByCode(code);
    if (!card) throw new AppError('Gift card not found', 404, 'NOT_FOUND');
    if (card.status !== 'active') throw new AppError('Gift card is not active', 400, 'NOT_ACTIVE');

    const deductAmount = Math.min(card.remaining_balance_cents, servicePriceCents);
    if (deductAmount <= 0) throw new AppError('Gift card has no remaining balance', 400, 'EXHAUSTED');

    await this.giftCards.deductBalance(dbClient, {
      giftCardId: card.id,
      appointmentId,
      amountCents: deductAmount,
      note: `Applied to appointment ${appointmentId}`,
    });

    await dbClient.query(
      `INSERT INTO payments
         (client_id, appointment_id, amount_cents, currency, status, stripe_payment_intent_id, source)
       VALUES ($1, $2, $3, 'USD', 'succeeded', NULL, 'gift_card')`,
      [clientId ?? null, appointmentId, deductAmount]
    );

    return { giftCardId: card.id, deductedCents: deductAmount };
  }

  async listAll({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const [cards, total] = await Promise.all([
      this.giftCards.listAll({ limit, offset }),
      this.giftCards.countAll(),
    ]);
    return { cards, total, page, limit };
  }
}

async function sendGiftCardPurchaseConfirmation({ to, purchaserName, recipientName, amountCents }) {
  const { send } = await import('./emailService.js');
  const displayAmount = `$${(amountCents / 100).toFixed(0)}`;
  await send({
    to,
    subject: `Your Atlas Bodywork gift card for ${recipientName} has been sent`,
    html: `
      <p>Hi ${purchaserName || 'there'},</p>
      <p>Your ${displayAmount} Atlas Bodywork gift card for ${recipientName} has been sent. They'll receive an email with their gift card code shortly.</p>
      <p>Thank you for your purchase!</p>
      <p>— The Atlas Bodywork Team</p>
    `,
  });
}
