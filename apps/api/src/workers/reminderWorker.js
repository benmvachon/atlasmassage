import { getPool } from '../database/pool.js';
import { NotificationService } from '../services/notificationService.js';
import { logger } from '../logging/logger.js';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runReminders() {
  logger.info('reminder_worker_run');
  try {
    await new NotificationService(getPool()).sendPendingReminders();
  } catch (err) {
    logger.error('reminder_worker_error', { message: err.message });
  }
}

export function startReminderWorker() {
  runReminders(); // run once at startup to catch any missed during downtime
  return setInterval(runReminders, INTERVAL_MS);
}
