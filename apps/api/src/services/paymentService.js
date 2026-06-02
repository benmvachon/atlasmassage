import Stripe from 'stripe';
import { config } from '../config/index.js';
import { PaymentRepository } from '../repositories/paymentRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { AppointmentRepository } from '../repositories/appointmentRepository.js';
import { MembershipRepository } from '../repositories/membershipRepository.js';
import { AppError } from '../middleware/errorHandler.js';

function getStripe() {
  if (!config.stripe.secretKey) {
    throw new AppError('Payment processing is not configured', 503, 'STRIPE_NOT_CONFIGURED');
  }
  return new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
}

export class PaymentService {
  constructor(pool) {
    this.payments = new PaymentRepository(pool);
    this.users = new UserRepository(pool);
    this.appointments = new AppointmentRepository(pool);
    this.memberships = new MembershipRepository(pool);
  }

  async ensureStripeCustomer(userId) {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (user.stripe_customer_id) return user.stripe_customer_id;

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      metadata: { userId },
    });

    await this.users.updateStripeCustomerId(userId, customer.id);
    return customer.id;
  }

  async createSetupIntent(userId) {
    const customerId = await this.ensureStripeCustomer(userId);
    const stripe = getStripe();
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { clientSecret: intent.client_secret };
  }

  async addPaymentMethod(userId, stripePaymentMethodId) {
    const customerId = await this.ensureStripeCustomer(userId);
    const stripe = getStripe();

    await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: customerId });

    const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
    const card = pm.card;

    const existing = await this.payments.findPaymentMethodsByClient(userId);
    const isDefault = existing.length === 0;

    const saved = await this.payments.createPaymentMethod({
      clientId: userId,
      stripePaymentMethodId,
      brand: card.brand,
      last4: card.last4,
      expiryMonth: card.exp_month,
      expiryYear: card.exp_year,
      isDefault,
    });

    if (isDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId },
      });
    }

    return saved;
  }

  async listPaymentMethods(userId) {
    return this.payments.findPaymentMethodsByClient(userId);
  }

  async removePaymentMethod(userId, paymentMethodId) {
    const pm = await this.payments.findPaymentMethodById(paymentMethodId);
    if (!pm || pm.client_id !== userId) {
      throw new AppError('Payment method not found', 404, 'NOT_FOUND');
    }

    const stripe = getStripe();
    await stripe.paymentMethods.detach(pm.stripe_payment_method_id);
    await this.payments.deletePaymentMethod(paymentMethodId);

    if (pm.is_default) {
      const remaining = await this.payments.findPaymentMethodsByClient(userId);
      if (remaining.length > 0) {
        await this.payments.setDefault(remaining[0].id, userId);
        const customerId = await this.ensureStripeCustomer(userId);
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: remaining[0].stripe_payment_method_id },
        });
      }
    }
  }

  async setDefaultPaymentMethod(userId, paymentMethodId) {
    const pm = await this.payments.findPaymentMethodById(paymentMethodId);
    if (!pm || pm.client_id !== userId) {
      throw new AppError('Payment method not found', 404, 'NOT_FOUND');
    }

    await this.payments.setDefault(paymentMethodId, userId);

    const customerId = await this.ensureStripeCustomer(userId);
    const stripe = getStripe();
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pm.stripe_payment_method_id },
    });
  }

  async createGuestPaymentIntent({ amountCents, currency, appointmentId }) {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency ?? 'usd',
      payment_method_types: ['card'],
      metadata: { appointmentId: appointmentId ?? '' },
    });

    const payment = await this.payments.createPayment({
      clientId: null,
      appointmentId: appointmentId ?? null,
      amountCents,
      currency: (currency ?? 'usd').toUpperCase(),
      status: 'pending',
      stripePaymentIntentId: intent.id,
    });

    return { clientSecret: intent.client_secret, paymentId: payment.id };
  }

  async createPaymentIntent(userId, { amountCents, currency, paymentMethodId, appointmentId }) {
    const customerId = await this.ensureStripeCustomer(userId);

    let stripePaymentMethodId;
    if (paymentMethodId) {
      const pm = await this.payments.findPaymentMethodById(paymentMethodId);
      if (!pm || pm.client_id !== userId) {
        throw new AppError('Payment method not found', 404, 'NOT_FOUND');
      }
      stripePaymentMethodId = pm.stripe_payment_method_id;
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency ?? 'usd',
      customer: customerId,
      ...(stripePaymentMethodId && { payment_method: stripePaymentMethodId }),
      metadata: { userId, appointmentId: appointmentId ?? '' },
    });

    const payment = await this.payments.createPayment({
      clientId: userId,
      appointmentId: appointmentId ?? null,
      amountCents,
      currency: (currency ?? 'usd').toUpperCase(),
      status: 'pending',
      stripePaymentIntentId: intent.id,
    });

    return { clientSecret: intent.client_secret, paymentId: payment.id };
  }

  async handleWebhook(rawBody, signature) {
    if (!config.stripe.webhookSecret) {
      throw new AppError('Webhook secret is not configured', 503, 'STRIPE_NOT_CONFIGURED');
    }
    const stripe = getStripe();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    } catch {
      throw new AppError('Webhook signature verification failed', 400, 'WEBHOOK_INVALID');
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const payment = await this.payments.findPaymentByStripeIntentId(intent.id);
        if (payment) {
          await this.payments.updatePaymentStatus(payment.id, 'succeeded', intent.id);
          if (payment.appointment_id) {
            await this.appointments.updateStatus(payment.appointment_id, 'confirmed');
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const payment = await this.payments.findPaymentByStripeIntentId(intent.id);
        if (payment) await this.payments.updatePaymentStatus(payment.id, 'failed', intent.id);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const membership = await this.memberships.findMembershipByStripeSubscriptionId(invoice.subscription);
          if (membership && membership.status === 'active') {
            await this.memberships.updateMembership(membership.id, {
              creditsRemaining: membership.credits_per_month,
            });
            await this.memberships.addCreditTransaction({
              membershipId: membership.id,
              type: 'grant',
              amount: membership.credits_per_month,
              notes: `Monthly renewal — invoice ${invoice.id}`,
            });
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const membership = await this.memberships.findMembershipByStripeSubscriptionId(sub.id);
        if (membership && membership.status !== 'cancelled') {
          const today = new Date().toISOString().split('T')[0];
          await this.memberships.updateMembership(membership.id, {
            status: 'cancelled',
            endDate: today,
          });
        }
        break;
      }
    }

    return { received: true };
  }
}
