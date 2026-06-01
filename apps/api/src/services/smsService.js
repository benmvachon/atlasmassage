import twilio from 'twilio';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

function getClient() {
  const { accountSid, authToken } = config.sms;
  if (!accountSid || !authToken || accountSid.startsWith('AC' + 'x')) return null;
  return twilio(accountSid, authToken);
}

export async function sendSms({ to, body }) {
  const client = getClient();
  if (!client) {
    logger.info('sms_dev_fallback', { to, body });
    return { sid: null };
  }
  const message = await client.messages.create({
    from: config.sms.fromNumber,
    to,
    body,
  });
  logger.info('sms_sent', { to, sid: message.sid });
  return { sid: message.sid };
}
