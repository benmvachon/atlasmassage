import { getPool } from '../database/pool.js';
import { NotificationService } from '../services/notificationService.js';
import { logger } from '../logging/logger.js';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runReminders() {
  logger.info('reminder_worker_run');
  const svc = new NotificationService(getPool());

  try {
    await svc.sendPendingReminders();
  } catch (err) {
    logger.error('reminder_worker_error', { message: err.message });
  }
  try {
    await svc.sendPendingPaymentPrompts();
  } catch (err) {
    logger.error('payment_prompt_worker_error', { message: err.message });
  }
  try {
    await svc.sendPendingFeedbackRequests();
  } catch (err) {
    logger.error('feedback_worker_error', { message: err.message });
  }
  try {
    await svc.sendPendingWeekFollowups();
  } catch (err) {
    logger.error('followup_1w_worker_error', { message: err.message });
  }
  try {
    await svc.sendPendingMonthFollowups();
  } catch (err) {
    logger.error('followup_1m_worker_error', { message: err.message });
  }
}

export function startReminderWorker() {
  runReminders(); // run once at startup to catch any missed during downtime
  return setInterval(runReminders, INTERVAL_MS);
}
