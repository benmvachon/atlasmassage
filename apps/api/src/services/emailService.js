import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

function createTransport() {
  if (!config.email.host || process.env.EMAIL_DISABLED === 'true') return null;
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: { user: config.email.user, pass: config.email.password },
  });
}

export async function send({ to, subject, html }) {
  const transport = createTransport();
  if (!transport) {
    // No SMTP configured — log the email so developers can see reset links locally
    logger.info('email_dev_fallback', { to, subject, html });
    return;
  }
  try {
    await transport.sendMail({ from: config.email.from, to, subject, html });
    logger.info('email_sent', { to, subject });
  } catch (err) {
    logger.error('email_failed', { to, subject, message: err.message });
    throw err;
  }
}

export async function sendGiftCardEmail({ to, purchaserName, recipientName, recipientEmail, code, amountCents, message }) {
  const displayAmount = `$${(amountCents / 100).toFixed(0)}`;
  const isRecipient = !!recipientEmail;
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';
  const fromLine = purchaserName ? `<p>This gift card was sent to you by ${purchaserName}.</p>` : '';
  const messageHtml = message ? `<blockquote style="border-left:3px solid #ccc;padding:8px 16px;margin:16px 0;color:#555">${message}</blockquote>` : '';

  await send({
    to,
    subject: `Your ${displayAmount} Atlas Bodywork Gift Card`,
    html: `
      <p>${isRecipient ? greeting : `Hi ${purchaserName || 'there'},`}</p>
      ${isRecipient ? fromLine : ''}
      ${messageHtml}
      <p>You have received a <strong>${displayAmount} Atlas Bodywork gift card</strong>. Use the code below when booking your massage:</p>
      <p style="font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;padding:16px;background:#f5f5f5;border-radius:8px">${code}</p>
      <p>To redeem, enter this code in the "Have a gift card?" section during checkout at <a href="${config.app.url}/booking">${config.app.url}/booking</a>.</p>
      <p>This gift card does not expire.</p>
      <p>— The Atlas Bodywork Team</p>
    `,
  });
}

export async function sendPasswordResetEmail({ to, firstName, token }) {
  const resetUrl = `${config.app.url}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your Atlas Bodywork password',
    html: `
      <p>Hi ${firstName},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>— The Atlas Bodywork Team</p>
    `,
  });
}
