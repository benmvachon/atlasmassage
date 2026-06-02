import { jest } from '@jest/globals';

// Stripe key must be absent so payment block is skipped in the controller
delete process.env.STRIPE_SECRET_KEY;

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

const mockApptRepo = {};
const mockAvailRepo = {};
const mockTransferRepo = {};

await jest.unstable_mockModule('../repositories/appointmentRepository.js', () => ({
  AppointmentRepository: jest.fn(() => mockApptRepo),
}));

await jest.unstable_mockModule('../repositories/availabilityRepository.js', () => ({
  AvailabilityRepository: jest.fn(() => mockAvailRepo),
}));

await jest.unstable_mockModule('../repositories/transferRequestRepository.js', () => ({
  TransferRequestRepository: jest.fn(() => mockTransferRepo),
}));

await jest.unstable_mockModule('../services/notificationService.js', () => ({
  NotificationService: jest.fn(() => ({
    sendBookingConfirmation: jest.fn().mockResolvedValue(),
  })),
}));

// Mock slotService so we control which slots are valid
const mockGenerateSlots = jest.fn();
await jest.unstable_mockModule('../services/slotService.js', () => ({
  generateSlots: mockGenerateSlots,
  availableDaysForMonth: jest.fn(() => []),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');

const CLIENT_ID    = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const THERAPIST_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const OWNER_ID     = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const APPT_ID      = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
const SERVICE_ID   = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';

// Far future date so the 24h guard passes
const FUTURE_AT = '2030-06-15T10:00:00.000Z';
const SOON_AT   = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now

const APPT = {
  id: APPT_ID,
  client_id: CLIENT_ID,
  therapist_id: THERAPIST_ID,
  service_id: SERVICE_ID,
  scheduled_at: FUTURE_AT,
  status: 'pending',
  cancel_token: 'tok-cancel',
  notes: null,
};

const bearer = (id, roles = ['client']) =>
  `Bearer ${issueAccessToken({ id, roles })}`;

beforeEach(() => {
  jest.clearAllMocks();

  mockGenerateSlots.mockReturnValue([
    { startTime: '10:00', endTime: '11:00', availableTherapists: [{ id: THERAPIST_ID, firstName: 'Alice', lastName: 'B' }] },
  ]);

  Object.assign(mockApptRepo, {
    create: jest.fn().mockResolvedValue(APPT),
    findById: jest.fn().mockResolvedValue(APPT),
    findServiceById: jest.fn().mockResolvedValue({ id: SERVICE_ID, name: 'Deep Tissue', price_cents: 0, duration_minutes: 60 }),
    updateStatus: jest.fn().mockResolvedValue({ ...APPT, status: 'confirmed' }),
    getByDateRange: jest.fn().mockResolvedValue([]),
    listForTherapist: jest.fn().mockResolvedValue([]),
    reschedule: jest.fn().mockResolvedValue(APPT),
  });

  Object.assign(mockAvailRepo, {
    getForDateRange: jest.fn().mockResolvedValue([]),
  });

  Object.assign(mockTransferRepo, {
    findPendingByAppointment: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'tr-uuid' }),
  });
});

// ── POST /appointments ────────────────────────────────────────────────────────

describe('POST /api/v1/appointments', () => {
  // waiverSignature is required by the validator
  const body = {
    therapistId: THERAPIST_ID,
    serviceId: SERVICE_ID,
    scheduledAt: FUTURE_AT,
    waiverSignature: 'data:image/png;base64,iVBORw0KGgo=',
  };

  it('creates appointment for authenticated client', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.id).toBe(APPT_ID);
    expect(mockApptRepo.create).toHaveBeenCalled();
  });

  it('creates appointment for guest with name and email', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({ ...body, guestName: 'Guest', guestEmail: 'guest@example.com' });

    expect(res.status).toBe(201);
  });

  it('returns 400 when appointment is less than 24 hours away', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send({ ...body, scheduledAt: SOON_AT });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_SOON');
  });

  it('returns 409 when the slot is not available', async () => {
    mockGenerateSlots.mockReturnValue([]); // No slots available
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('returns 400 when unauthenticated guest provides no guest details', async () => {
    // No auth + no guestName + no guestEmail → controller returns 400 (after validation passes)
    const res = await request(app)
      .post('/api/v1/appointments')
      .send(body); // waiverSignature present, but no guest fields

    expect(res.status).toBe(400);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send({ therapistId: THERAPIST_ID, serviceId: SERVICE_ID }); // missing scheduledAt + waiverSignature

    expect(res.status).toBe(422);
  });
});

// ── GET /appointments ─────────────────────────────────────────────────────────

describe('GET /api/v1/appointments', () => {
  it('returns appointments list for a therapist', async () => {
    mockApptRepo.listForTherapist.mockResolvedValue([APPT]);
    const res = await request(app)
      .get('/api/v1/appointments')
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([APPT]);
  });

  it('returns 403 for a plain client', async () => {
    const res = await request(app)
      .get('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID, ['client']));

    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/appointments');
    expect(res.status).toBe(401);
  });
});

// ── GET /appointments/:id ─────────────────────────────────────────────────────

describe('GET /api/v1/appointments/:id', () => {
  it('returns appointment to the owning client', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(APPT_ID);
  });

  it('returns appointment to the therapist', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));

    expect(res.status).toBe(200);
  });

  it('returns appointment to an owner', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}`)
      .set('Authorization', bearer(OWNER_ID, ['owner']));

    expect(res.status).toBe(200);
  });

  it('returns 404 when appointment does not exist', async () => {
    mockApptRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(404);
  });

  it('returns 403 when authenticated user is unrelated to the appointment', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}`)
      .set('Authorization', bearer('other-uuid'));

    expect(res.status).toBe(403);
  });
});

// ── POST /appointments/:id/cancel ─────────────────────────────────────────────

describe('POST /api/v1/appointments/:id/cancel', () => {
  it('cancels appointment for the owning client', async () => {
    mockApptRepo.updateStatus.mockResolvedValue({ ...APPT, status: 'cancelled' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(200);
    expect(mockApptRepo.updateStatus).toHaveBeenCalledWith(APPT_ID, 'cancelled');
  });

  it('cancels appointment via cancel token for guests', async () => {
    const guestAppt = { ...APPT, client_id: null, cancel_token: 'tok-cancel' };
    mockApptRepo.findById.mockResolvedValue(guestAppt);

    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .send({ cancelToken: 'tok-cancel' });

    expect(res.status).toBe(200);
  });

  it('returns 403 when neither client nor owner nor valid cancel token', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer('stranger-uuid'));

    expect(res.status).toBe(403);
  });

  it('returns 400 when appointment is within 24 hours', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, scheduled_at: SOON_AT });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MODIFICATION_WINDOW_CLOSED');
  });

  it('returns 400 when appointment is already cancelled', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'cancelled' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(400);
  });

  it('returns 404 when appointment does not exist', async () => {
    mockApptRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(404);
  });
});

// ── POST /appointments/:id/confirm ────────────────────────────────────────────

describe('POST /api/v1/appointments/:id/confirm', () => {
  it('confirms appointment for the owning client', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(200);
    expect(mockApptRepo.updateStatus).toHaveBeenCalledWith(APPT_ID, 'confirmed');
  });

  it('owner can confirm any appointment', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`)
      .set('Authorization', bearer(OWNER_ID, ['owner']));

    expect(res.status).toBe(200);
  });

  it('returns 403 when an unrelated user tries to confirm', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`)
      .set('Authorization', bearer('stranger-uuid'));

    expect(res.status).toBe(403);
  });

  it('returns 404 when appointment does not exist', async () => {
    mockApptRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`)
      .set('Authorization', bearer(CLIENT_ID));

    expect(res.status).toBe(404);
  });
});

// ── POST /appointments/:id/complete ───────────────────────────────────────────

describe('POST /api/v1/appointments/:id/complete', () => {
  it('completes appointment for the assigned therapist', async () => {
    mockApptRepo.updateStatus.mockResolvedValue({ ...APPT, status: 'completed' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/complete`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));

    expect(res.status).toBe(200);
  });

  it('owner can complete any appointment', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/complete`)
      .set('Authorization', bearer(OWNER_ID, ['owner']));

    expect(res.status).toBe(200);
  });

  it('returns 403 when a different therapist tries to complete', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/complete`)
      .set('Authorization', bearer('other-therapist', ['therapist']));

    expect(res.status).toBe(403);
  });
});

// ── POST /appointments/:id/transfer-request ───────────────────────────────────

describe('POST /api/v1/appointments/:id/transfer-request', () => {
  it('creates a transfer request for the assigned therapist', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/transfer-request`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']))
      .send({ reason: 'Scheduling conflict' });

    expect(res.status).toBe(201);
    expect(mockTransferRepo.create).toHaveBeenCalled();
  });

  it('returns 403 when a different therapist makes the request', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/transfer-request`)
      .set('Authorization', bearer('other-therapist', ['therapist']))
      .send({ reason: 'x' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when a transfer request already exists', async () => {
    mockTransferRepo.findPendingByAppointment.mockResolvedValue({ id: 'existing' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/transfer-request`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']))
      .send({ reason: 'x' });

    expect(res.status).toBe(409);
  });
});

// ── POST /appointments/:id/reschedule ─────────────────────────────────────────

describe('POST /api/v1/appointments/:id/reschedule', () => {
  const newAt = '2030-06-20T10:00:00.000Z';

  it('reschedules appointment for the owning client', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/reschedule`)
      .set('Authorization', bearer(CLIENT_ID))
      .send({ scheduledAt: newAt, therapistId: THERAPIST_ID });

    expect(res.status).toBe(200);
    expect(mockApptRepo.reschedule).toHaveBeenCalled();
  });

  it('returns 409 when new slot is not available', async () => {
    mockGenerateSlots.mockReturnValue([]);
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/reschedule`)
      .set('Authorization', bearer(CLIENT_ID))
      .send({ scheduledAt: newAt, therapistId: THERAPIST_ID });

    expect(res.status).toBe(409);
  });

  it('returns 400 when new time is too soon', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/reschedule`)
      .set('Authorization', bearer(CLIENT_ID))
      .send({ scheduledAt: SOON_AT, therapistId: THERAPIST_ID });

    expect(res.status).toBe(400);
  });
});
