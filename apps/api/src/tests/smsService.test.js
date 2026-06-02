import { jest } from '@jest/globals';

const mockMessages = { create: jest.fn() };
const mockTwilio = jest.fn(() => ({ messages: mockMessages }));

await jest.unstable_mockModule('twilio', () => ({ default: mockTwilio }));

const mockConfig = {
  sms: { accountSid: 'ACtest123', authToken: 'token123', fromNumber: '+15550001111' },
};

await jest.unstable_mockModule('../config/index.js', () => ({ config: mockConfig }));

await jest.unstable_mockModule('../logging/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const { sendSms } = await import('../services/smsService.js');
const { logger } = await import('../logging/logger.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.sms.accountSid = 'ACtest123';
  mockConfig.sms.authToken = 'token123';
  mockMessages.create.mockResolvedValue({ sid: 'SM123' });
});

describe('smsService.sendSms', () => {
  it('sends via Twilio when credentials are configured', async () => {
    const result = await sendSms({ to: '+15559998888', body: 'Hello!' });
    expect(mockMessages.create).toHaveBeenCalledWith({
      from: '+15550001111',
      to: '+15559998888',
      body: 'Hello!',
    });
    expect(result.sid).toBe('SM123');
    expect(logger.info).toHaveBeenCalledWith('sms_sent', expect.any(Object));
  });

  it('uses dev fallback when accountSid is missing', async () => {
    mockConfig.sms.accountSid = '';
    const result = await sendSms({ to: '+15559998888', body: 'Hi' });
    expect(mockMessages.create).not.toHaveBeenCalled();
    expect(result.sid).toBeNull();
    expect(logger.info).toHaveBeenCalledWith('sms_dev_fallback', expect.any(Object));
  });

  it('uses dev fallback when accountSid starts with placeholder prefix', async () => {
    mockConfig.sms.accountSid = 'ACxxxxxxxxxx'; // starts with AC + x
    const result = await sendSms({ to: '+15559998888', body: 'Hi' });
    expect(mockMessages.create).not.toHaveBeenCalled();
    expect(result.sid).toBeNull();
  });
});
