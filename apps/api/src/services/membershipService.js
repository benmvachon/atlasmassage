import Stripe from 'stripe';
import { config } from '../config/index.js';
import { MembershipRepository } from '../repositories/membershipRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { AppError } from '../middleware/errorHandler.js';

function getStripe() {
  if (!config.stripe.secretKey) return null;
  return new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
}

export class MembershipService {
  constructor(pool) {
    this.memberships = new MembershipRepository(pool);
    this.users = new UserRepository(pool);
  }

  async listPlans() {
    return this.memberships.findActivePlans();
  }

  async getPlan(id) {
    const plan = await this.memberships.findPlanById(id);
    if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');
    return plan;
  }

  async createPlan({ name, description, priceMonthlyCents, creditsPerMonth }) {
    return this.memberships.createPlan({ name, description, priceMonthlyCents, creditsPerMonth });
  }

  async updatePlan(id, data) {
    const plan = await this.memberships.findPlanById(id);
    if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');
    return this.memberships.updatePlan(id, {
      name: data.name,
      description: data.description,
      isActive: data.isActive,
    });
  }

  async subscribe(userId, { planId, stripePaymentMethodId }) {
    const plan = await this.memberships.findPlanById(planId);
    if (!plan || !plan.is_active) {
      throw new AppError('Plan not found or unavailable', 404, 'NOT_FOUND');
    }

    const existing = await this.memberships.findActiveMembershipByClient(userId);
    if (existing) {
      throw new AppError('Client already has an active membership', 409, 'CONFLICT');
    }

    const today = new Date().toISOString().split('T')[0];
    let stripeSubscriptionId = null;

    const stripe = getStripe();
    if (stripe && stripePaymentMethodId && plan.stripe_price_id) {
      const user = await this.users.findById(userId);
      let customerId = user.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          metadata: { userId },
        });
        customerId = customer.id;
        await this.users.updateStripeCustomerId(userId, customerId);
      }

      try {
        await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: customerId });
      } catch { /* already attached */ }

      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId },
      });

      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: plan.stripe_price_id }],
        default_payment_method: stripePaymentMethodId,
      });
      stripeSubscriptionId = sub.id;
    }

    const membership = await this.memberships.createMembership({
      clientId: userId,
      planId,
      startDate: today,
      stripeSubscriptionId,
      creditsRemaining: plan.credits_per_month,
    });

    return {
      ...membership,
      plan_name: plan.name,
      price_monthly_cents: plan.price_monthly_cents,
      credits_per_month: plan.credits_per_month,
    };
  }

  async listMemberships(userId) {
    return this.memberships.findMembershipsByClient(userId);
  }

  async getMembership(id) {
    const membership = await this.memberships.findMembershipById(id);
    if (!membership) throw new AppError('Membership not found', 404, 'NOT_FOUND');
    return membership;
  }

  async cancelMembership(membershipId, userId, isOwner) {
    const membership = await this.memberships.findMembershipById(membershipId);
    if (!membership) throw new AppError('Membership not found', 404, 'NOT_FOUND');

    if (!isOwner && membership.client_id !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (membership.status !== 'active') {
      throw new AppError('Membership is not active', 400, 'INVALID_STATUS');
    }

    if (membership.stripe_subscription_id) {
      const stripe = getStripe();
      if (stripe) {
        await stripe.subscriptions.cancel(membership.stripe_subscription_id);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    return this.memberships.updateMembership(membershipId, {
      status: 'cancelled',
      endDate: today,
    });
  }

  async pauseMembership(membershipId) {
    const membership = await this.memberships.findMembershipById(membershipId);
    if (!membership) throw new AppError('Membership not found', 404, 'NOT_FOUND');

    if (membership.status !== 'active') {
      throw new AppError('Membership is not active', 400, 'INVALID_STATUS');
    }

    return this.memberships.updateMembership(membershipId, { status: 'paused' });
  }
}
