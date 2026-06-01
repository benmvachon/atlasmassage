import { getPool } from '../database/pool.js';
import { PaymentService } from '../services/paymentService.js';

function service() {
  return new PaymentService(getPool());
}

export async function createSetupIntent(req, res, next) {
  try {
    const data = await service().createSetupIntent(req.user.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listPaymentMethods(req, res, next) {
  try {
    const methods = await service().listPaymentMethods(req.user.sub);
    res.json({ success: true, data: { methods } });
  } catch (err) {
    next(err);
  }
}

export async function addPaymentMethod(req, res, next) {
  try {
    const { stripePaymentMethodId } = req.body;
    const method = await service().addPaymentMethod(req.user.sub, stripePaymentMethodId);
    res.status(201).json({ success: true, data: { method } });
  } catch (err) {
    next(err);
  }
}

export async function removePaymentMethod(req, res, next) {
  try {
    await service().removePaymentMethod(req.user.sub, req.params.id);
    res.json({ success: true, data: { message: 'Payment method removed' } });
  } catch (err) {
    next(err);
  }
}

export async function setDefaultPaymentMethod(req, res, next) {
  try {
    await service().setDefaultPaymentMethod(req.user.sub, req.params.id);
    res.json({ success: true, data: { message: 'Default payment method updated' } });
  } catch (err) {
    next(err);
  }
}

export async function createPaymentIntent(req, res, next) {
  try {
    const { amountCents, currency, paymentMethodId, appointmentId } = req.body;
    const data = await service().createPaymentIntent(req.user.sub, {
      amountCents,
      currency,
      paymentMethodId,
      appointmentId,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['stripe-signature'];
    const data = await service().handleWebhook(req.body, signature);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
