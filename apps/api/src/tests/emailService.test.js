import { jest } from '@jest/globals';

const mockTransport = { sendMail: jest.fn() };
const mockCreateTransport = jest.fn(() => mockTransport);

await jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

// Use a mutable config object so individual tests can toggle the host
const mockConfig = {
  email: { host: 'smtp.test.com', port: 587, user: 'u', password: 'p', from: 'noreply@test.com' },
  app: { url: 'http://localhost:5173' },
};

await jest.unstable_mockModule('../config/index.js', () => ({ config: mockConfig }));

await jest.unstable_mockModule('../logging/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const { send, sendPasswordResetEmail } = await import('../services/emailService.js');
const { logger } = await import('../logging/logger.js');

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.email.host = 'smtp.test.com';
  mockTransport.sendMail.mockResolvedValue({ messageId: 'msg-1' });
  mockCreateTransport.mockReturnValue(mockTransport);
});

// ── send ──────────────────────────────────────────────────────────────────────

describe('emailService.send', () => {
  it('calls transport.sendMail with the right args when host is configured', async () => {
    await send({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' });
    expect(mockTransport.sendMail).toHaveBeenCalledWith({
      from: 'noreply@test.com',
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });
    expect(logger.info).toHaveBeenCalledWith('email_sent', expect.any(Object));
  });

  it('uses dev fallback (logger) when no host is configured', async () => {
    mockConfig.email.host = '';
    mockCreateTransport.mockReturnValue(null);
    await send({ to: 'dev@example.com', subject: 'Test', html: '' });
    expect(mockTransport.sendMail).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('email_dev_fallback', expect.any(Object));
  });

  it('logs error and rethrows when sendMail fails', async () => {
    mockTransport.sendMail.mockRejectedValue(new Error('SMTP timeout'));
    await expect(send({ to: 'fail@example.com', subject: 'Oops', html: '' }))
      .rejects.toThrow('SMTP timeout');
    expect(logger.error).toHaveBeenCalledWith('email_failed', expect.objectContaining({ message: 'SMTP timeout' }));
  });
});

// ── sendPasswordResetEmail ────────────────────────────────────────────────────

describe('emailService.sendPasswordResetEmail', () => {
  it('sends an email with the reset URL embedded', async () => {
    await sendPasswordResetEmail({ to: 'user@example.com', firstName: 'Jane', token: 'tok123' });
    expect(mockTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your Atlas Massage password',
        html: expect.stringContaining('tok123'),
      })
    );
  });
});
