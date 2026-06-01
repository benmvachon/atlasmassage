import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

function createTransport() {
  if (!config.email.host) return null;
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

export async function sendPasswordResetEmail({ to, firstName, token }) {
  const resetUrl = `${config.app.url}/reset-password?token=${token}`;
  await send({
    to,
    subject: 'Reset your Atlas Massage password',
    html: `
      <p>Hi ${firstName},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>— The Atlas Massage Team</p>
    `,
  });
}
