import { jest } from '@jest/globals';

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

const mockRepoInstance = {};

await jest.unstable_mockModule('../repositories/notificationRepository.js', () => ({
  NotificationRepository: jest.fn(() => mockRepoInstance),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');

const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const bearer = (id = CLIENT_ID, roles = ['client']) =>
  `Bearer ${issueAccessToken({ id, roles })}`;

const PREFS = {
  user_id: CLIENT_ID,
  email_appointment_remind: true,
  email_booking_confirm: true,
  sms_appointment_remind: false,
  sms_booking_confirm: false,
};

const NOTIFICATIONS = [
  { id: 'n1', user_id: CLIENT_ID, channel: 'email', subject: 'Booking confirmed', status: 'sent', created_at: '2024-01-01T00:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockRepoInstance, {
    getOrCreatePreferences: jest.fn().mockResolvedValue(PREFS),
    updatePreferences: jest.fn().mockResolvedValue({ ...PREFS, sms_appointment_remind: true }),
    findByUser: jest.fn().mockResolvedValue(NOTIFICATIONS),
  });
});

// ── GET /notifications/preferences ────────────────────────────────────────────

describe('GET /api/v1/notifications/preferences', () => {
  it('returns current notification preferences', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body.data.preferences.email_booking_confirm).toBe(true);
    expect(mockRepoInstance.getOrCreatePreferences).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/notifications/preferences');
    expect(res.status).toBe(401);
  });
});

// ── PUT /notifications/preferences ────────────────────────────────────────────

describe('PUT /api/v1/notifications/preferences', () => {
  const update = {
    emailAppointmentRemind: true,
    emailBookingConfirm: true,
    smsAppointmentRemind: true,
    smsBookingConfirm: false,
  };

  it('updates preferences and returns the new values', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', bearer())
      .send(update);

    expect(res.status).toBe(200);
    expect(mockRepoInstance.updatePreferences).toHaveBeenCalledWith(CLIENT_ID, update);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .send(update);

    expect(res.status).toBe(401);
  });

  it('returns 422 when boolean fields are missing', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', bearer())
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── GET /notifications ────────────────────────────────────────────────────────

describe('GET /api/v1/notifications', () => {
  it('returns notification history for the user', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', bearer());

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.notifications[0].channel).toBe('email');
    expect(mockRepoInstance.findByUser).toHaveBeenCalledWith(CLIENT_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });
});
