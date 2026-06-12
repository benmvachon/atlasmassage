import { jest } from '@jest/globals';

const mockRepoInstance = {};

await jest.unstable_mockModule('../repositories/notificationRepository.js', () => ({
  NotificationRepository: jest.fn(() => mockRepoInstance),
}));

const mockSend = jest.fn();
const mockSendSms = jest.fn();

await jest.unstable_mockModule('../services/emailService.js', () => ({ send: mockSend }));
await jest.unstable_mockModule('../services/smsService.js', () => ({ sendSms: mockSendSms }));

await jest.unstable_mockModule('../config/index.js', () => ({
  config: { app: { url: 'http://localhost:5173' } },
}));

await jest.unstable_mockModule('../logging/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

const { NotificationService } = await import('../services/notificationService.js');

// Shared fixture data
const CLIENT_APPT = {
  id: 'appt-uuid',
  client_id: 'client-uuid',
  client_email: 'client@example.com',
  client_first_name: 'Jane',
  client_last_name: 'Doe',
  client_phone: '+15551234567',
  guest_name: null,
  guest_email: null,
  cancel_token: null,
  soap_token: 'soap-tok-abc',
  therapist_user_id: 'therapist-uuid',
  therapist_email: 'therapist@example.com',
  therapist_first_name: 'Alice',
  therapist_last_name: 'B',
  therapist_phone: '+15559998888',
  service_name: 'Deep Tissue',
  duration_minutes: 60,
  scheduled_at: new Date(Date.now() + 86400000).toISOString(),
};

const GUEST_APPT = {
  ...CLIENT_APPT,
  client_id: null,
  client_email: null,
  client_first_name: null,
  client_phone: null,
  guest_name: 'Guest User',
  guest_email: 'guest@example.com',
  cancel_token: 'tok123',
};

const PREFS_ALL_ON = {
  email_booking_confirm: true,
  email_appointment_remind: true,
  sms_booking_confirm: true,
  sms_appointment_remind: true,
};

const PREFS_ALL_OFF = {
  email_booking_confirm: false,
  email_appointment_remind: false,
  sms_booking_confirm: false,
  sms_appointment_remind: false,
};

let service;

beforeEach(() => {
  jest.clearAllMocks();

  Object.assign(mockRepoInstance, {
    findAppointmentWithDetails: jest.fn().mockResolvedValue(CLIENT_APPT),
    findAppointmentsNeedingReminders: jest.fn().mockResolvedValue([]),
    findAppointmentsNeedingWeekFollowup: jest.fn().mockResolvedValue([]),
    findAppointmentsNeedingMonthFollowup: jest.fn().mockResolvedValue([]),
    getOrCreatePreferences: jest.fn().mockResolvedValue(PREFS_ALL_ON),
    logNotification: jest.fn().mockResolvedValue({ id: 'notif-uuid' }),
    markReminded: jest.fn().mockResolvedValue(),
    markFeedbackSent: jest.fn().mockResolvedValue(),
    markFollowup1wSent: jest.fn().mockResolvedValue(),
    markFollowup1mSent: jest.fn().mockResolvedValue(),
  });

  mockSend.mockResolvedValue();
  mockSendSms.mockResolvedValue({ sid: 'SM123' });

  service = new NotificationService({});
});

// ── sendBookingConfirmation ───────────────────────────────────────────────────

describe('NotificationService.sendBookingConfirmation', () => {
  it('sends email and SMS to client and email to therapist when all prefs on', async () => {
    await service.sendBookingConfirmation('appt-uuid');
    // client email + therapist email = 2 send calls
    expect(mockSend).toHaveBeenCalledTimes(2);
    // client SMS
    expect(mockSendSms).toHaveBeenCalledTimes(1);
    expect(mockRepoInstance.logNotification).toHaveBeenCalled();
  });

  it('skips email/SMS when client prefs are all off', async () => {
    mockRepoInstance.getOrCreatePreferences.mockResolvedValue(PREFS_ALL_OFF);
    await service.sendBookingConfirmation('appt-uuid');
    // Only therapist email is off too (same prefs mock)
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('sends email to guest with cancel link when cancel_token is set', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(GUEST_APPT);
    await service.sendBookingConfirmation('appt-uuid');
    const emailHtml = mockSend.mock.calls[0][0].html;
    expect(emailHtml).toContain('tok123');
    // No SMS for guests
    expect(mockSendSms).not.toHaveBeenCalled();
  });

  it('sends guest email without cancel link when no cancel_token', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue({ ...GUEST_APPT, cancel_token: null });
    await service.sendBookingConfirmation('appt-uuid');
    const emailHtml = mockSend.mock.calls[0][0].html;
    expect(emailHtml).not.toContain('tok123');
  });

  it('does nothing when appointment is not found', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(null);
    await service.sendBookingConfirmation('missing-uuid');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('logs failure but does not throw when send fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('SMTP down'));
    // Should not throw
    await expect(service.sendBookingConfirmation('appt-uuid')).resolves.toBeUndefined();
    expect(mockRepoInstance.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});

// ── sendPendingReminders ──────────────────────────────────────────────────────

describe('NotificationService.sendPendingReminders', () => {
  it('does nothing when no appointments need reminders', async () => {
    mockRepoInstance.findAppointmentsNeedingReminders.mockResolvedValue([]);
    await service.sendPendingReminders();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends email reminder to client and therapist', async () => {
    mockRepoInstance.findAppointmentsNeedingReminders.mockResolvedValue([CLIENT_APPT]);
    await service.sendPendingReminders();
    // client email + therapist email
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockRepoInstance.markReminded).toHaveBeenCalledWith('appt-uuid');
  });

  it('sends SMS reminder to client and therapist when prefs on', async () => {
    mockRepoInstance.findAppointmentsNeedingReminders.mockResolvedValue([CLIENT_APPT]);
    await service.sendPendingReminders();
    // client SMS + therapist SMS
    expect(mockSendSms).toHaveBeenCalledTimes(2);
  });

  it('sends reminder to guest via email only', async () => {
    mockRepoInstance.findAppointmentsNeedingReminders.mockResolvedValue([GUEST_APPT]);
    await service.sendPendingReminders();
    // guest email + therapist email
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSendSms).toHaveBeenCalledTimes(1); // therapist SMS only
  });

  it('continues processing other appointments when one email fails', async () => {
    const appt2 = { ...CLIENT_APPT, id: 'appt-2', client_email: 'other@example.com' };
    mockRepoInstance.findAppointmentsNeedingReminders.mockResolvedValue([CLIENT_APPT, appt2]);
    // _email catches send failures internally, so _sendReminder never throws
    // Both appointments still get markReminded called
    mockSend.mockRejectedValueOnce(new Error('fail')).mockResolvedValue();
    await expect(service.sendPendingReminders()).resolves.toBeUndefined();
    expect(mockRepoInstance.markReminded).toHaveBeenCalledTimes(2);
  });

  it('skips email and SMS when client prefs are off', async () => {
    mockRepoInstance.findAppointmentsNeedingReminders.mockResolvedValue([CLIENT_APPT]);
    mockRepoInstance.getOrCreatePreferences.mockResolvedValue(PREFS_ALL_OFF);
    await service.sendPendingReminders();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockSendSms).not.toHaveBeenCalled();
  });
});

// ── sendFeedbackRequest ───────────────────────────────────────────────────────

describe('NotificationService.sendFeedbackRequest', () => {
  it('sends feedback request email to client when prefs allow', async () => {
    await service.sendFeedbackRequest('appt-uuid');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@example.com' })
    );
    expect(mockRepoInstance.markFeedbackSent).toHaveBeenCalledWith('appt-uuid');
  });

  it('sends to guest without prefs check', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(GUEST_APPT);
    await service.sendFeedbackRequest('appt-uuid');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'guest@example.com' })
    );
  });

  it('skips when appointment has no client email', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(
      { ...CLIENT_APPT, client_email: null, guest_email: null }
    );
    await service.sendFeedbackRequest('appt-uuid');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips when client prefs are off', async () => {
    mockRepoInstance.getOrCreatePreferences.mockResolvedValue(PREFS_ALL_OFF);
    await service.sendFeedbackRequest('appt-uuid');
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRepoInstance.markFeedbackSent).toHaveBeenCalledWith('appt-uuid');
  });

  it('does nothing when appointment is not found', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(null);
    await service.sendFeedbackRequest('appt-uuid');
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ── sendPendingWeekFollowups / sendPendingMonthFollowups ──────────────────────

describe('NotificationService.sendPendingWeekFollowups', () => {
  it('sends week followup email when prefs allow', async () => {
    mockRepoInstance.findAppointmentsNeedingWeekFollowup.mockResolvedValue([CLIENT_APPT]);
    await service.sendPendingWeekFollowups();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        html: expect.stringContaining('http://localhost:5173/booking'),
      })
    );
    expect(mockRepoInstance.markFollowup1wSent).toHaveBeenCalledWith('appt-uuid');
  });

  it('skips when client prefs are off', async () => {
    mockRepoInstance.findAppointmentsNeedingWeekFollowup.mockResolvedValue([CLIENT_APPT]);
    mockRepoInstance.getOrCreatePreferences.mockResolvedValue(PREFS_ALL_OFF);
    await service.sendPendingWeekFollowups();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('handles errors without crashing', async () => {
    mockRepoInstance.findAppointmentsNeedingWeekFollowup.mockResolvedValue([CLIENT_APPT]);
    mockSend.mockRejectedValueOnce(new Error('fail'));
    await expect(service.sendPendingWeekFollowups()).resolves.toBeUndefined();
  });
});

describe('NotificationService.sendPendingMonthFollowups', () => {
  it('sends month followup email', async () => {
    mockRepoInstance.findAppointmentsNeedingMonthFollowup.mockResolvedValue([CLIENT_APPT]);
    await service.sendPendingMonthFollowups();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: expect.stringContaining('month'),
      })
    );
    expect(mockRepoInstance.markFollowup1mSent).toHaveBeenCalledWith('appt-uuid');
  });

  it('skips when no client email on followup appt', async () => {
    const noEmail = { ...CLIENT_APPT, client_email: null };
    mockRepoInstance.findAppointmentsNeedingMonthFollowup.mockResolvedValue([noEmail]);
    await service.sendPendingMonthFollowups();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ── sendSoapNotesRequest ──────────────────────────────────────────────────────

describe('NotificationService.sendSoapNotesRequest', () => {
  it('sends SOAP notes email to therapist with correct subject and tokenized URL', async () => {
    await service.sendSoapNotesRequest('appt-uuid');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'therapist@example.com',
        subject: expect.stringContaining('SOAP notes required'),
        html: expect.stringContaining('soap-tok-abc'),
      })
    );
  });

  it('email HTML links to therapist bookings page with appt id and soap token', async () => {
    await service.sendSoapNotesRequest('appt-uuid');
    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain('/therapist/bookings?appt=appt-uuid&token=soap-tok-abc');
  });

  it('email subject includes client name and service name', async () => {
    await service.sendSoapNotesRequest('appt-uuid');
    const { subject } = mockSend.mock.calls[0][0];
    expect(subject).toContain('Jane');
    expect(subject).toContain('Deep Tissue');
  });

  it('does nothing when appointment is not found', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(null);
    await service.sendSoapNotesRequest('missing-uuid');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does nothing when therapist has no email', async () => {
    mockRepoInstance.findAppointmentWithDetails.mockResolvedValue(
      { ...CLIENT_APPT, therapist_email: null }
    );
    await service.sendSoapNotesRequest('appt-uuid');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('logs failure but does not throw when send fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.sendSoapNotesRequest('appt-uuid')).resolves.toBeUndefined();
    expect(mockRepoInstance.logNotification).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
  });
});
