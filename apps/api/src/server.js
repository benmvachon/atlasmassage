import app from './app.js';
import { config } from './config/index.js';
import { logger } from './logging/logger.js';
import { closePool } from './database/pool.js';
import { startReminderWorker } from './workers/reminderWorker.js';

const server = app.listen(config.port, () => {
  logger.info('server_started', { port: config.port, env: config.env });
});

const reminderInterval = startReminderWorker();

async function shutdown(signal) {
  logger.info('shutdown_signal', { signal });
  clearInterval(reminderInterval);
  server.close(async () => {
    await closePool();
    logger.info('server_stopped');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('shutdown_timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { reason: String(reason) });
  process.exit(1);
});

export default server;
