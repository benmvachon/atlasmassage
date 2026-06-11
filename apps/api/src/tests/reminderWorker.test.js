import { jest } from '@jest/globals';

const mockServiceInstance = {};

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
}));

await jest.unstable_mockModule('../services/notificationService.js', () => ({
  NotificationService: jest.fn(() => mockServiceInstance),
}));

await jest.unstable_mockModule('../logging/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const { startReminderWorker } = await import('../workers/reminderWorker.js');
const { logger } = await import('../logging/logger.js');

let interval;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockServiceInstance, {
    sendPendingReminders: jest.fn().mockResolvedValue(),
    sendPendingWeekFollowups: jest.fn().mockResolvedValue(),
    sendPendingMonthFollowups: jest.fn().mockResolvedValue(),
  });
});

afterEach(() => {
  clearInterval(interval);
});

// Flush all microtasks so async runReminders() callbacks complete
const flush = () => new Promise(r => setImmediate(r));

describe('startReminderWorker', () => {
  it('immediately calls all three send methods at startup', async () => {
    interval = startReminderWorker();
    await flush();
    expect(mockServiceInstance.sendPendingReminders).toHaveBeenCalledTimes(1);
    expect(mockServiceInstance.sendPendingWeekFollowups).toHaveBeenCalledTimes(1);
    expect(mockServiceInstance.sendPendingMonthFollowups).toHaveBeenCalledTimes(1);
  });

  it('logs a worker_run info message', async () => {
    interval = startReminderWorker();
    await flush();
    expect(logger.info).toHaveBeenCalledWith('reminder_worker_run');
  });

  it('returns an interval handle', () => {
    interval = startReminderWorker();
    expect(interval).toBeDefined();
  });

  it('continues processing when one method throws', async () => {
    mockServiceInstance.sendPendingReminders.mockRejectedValueOnce(new Error('DB error'));
    interval = startReminderWorker();
    await flush();
    // Worker catches the error and continues to the other methods
    expect(mockServiceInstance.sendPendingWeekFollowups).toHaveBeenCalled();
    expect(mockServiceInstance.sendPendingMonthFollowups).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('reminder_worker_error', expect.objectContaining({ message: 'DB error' }));
  });

  it('logs separate errors for each failing method', async () => {
    mockServiceInstance.sendPendingWeekFollowups.mockRejectedValueOnce(new Error('followup fail'));
    interval = startReminderWorker();
    await flush();
    expect(logger.error).toHaveBeenCalledWith('followup_1w_worker_error', expect.objectContaining({ message: 'followup fail' }));
  });
});
