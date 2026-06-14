import { getPool } from '../database/pool.js';
import { GiftCardService } from '../services/giftCardService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function purchaseGiftCard(req, res, next) {
  try {
    const { purchaserEmail, purchaserName, recipientEmail, recipientName, message, amountCents } = req.body;

    if (!purchaserEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail)) {
      throw new AppError('A valid purchaser email is required', 400, 'BAD_REQUEST');
    }
    if (!amountCents || typeof amountCents !== 'number') {
      throw new AppError('amountCents must be a number', 400, 'BAD_REQUEST');
    }
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      throw new AppError('Recipient email is not valid', 400, 'BAD_REQUEST');
    }

    const svc = new GiftCardService(getPool());
    const { url } = await svc.createCheckoutSession({
      purchaserEmail,
      purchaserName: purchaserName ?? null,
      recipientEmail: recipientEmail ?? null,
      recipientName: recipientName ?? null,
      message: message ?? null,
      amountCents,
    });

    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

export async function validateGiftCard(req, res, next) {
  try {
    const code = (req.params.code ?? '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      throw new AppError('Invalid gift card code format', 400, 'BAD_REQUEST');
    }

    const svc = new GiftCardService(getPool());
    const card = await svc.validateCode(code);
    res.json({ success: true, data: card });
  } catch (err) {
    next(err);
  }
}

export async function listGiftCards(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const svc = new GiftCardService(getPool());
    const result = await svc.listAll({ page, limit });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
