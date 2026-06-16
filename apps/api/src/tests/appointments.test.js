import { jest } from '@jest/globals';

// Stripe key must be absent so payment block is skipped in the controller
delete process.env.STRIPE_SECRET_KEY;

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

const mockApptRepo     = {};
const mockAvailRepo    = {};
const mockBusinessRepo = {};
const mockConsentRepo  = {};
const mockHealthRepo   = {};
const mockSoapRepo     = {};
const mockFeedbackRepo = {};
const mockHistoryRepo  = {};
const mockTransferRepo = {};

const BED_ID = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';

await jest.unstable_mockModule('../repositories/appointmentRepository.js', () => ({
  AppointmentRepository: jest.fn(() => mockApptRepo),
}));
await jest.unstable_mockModule('../repositories/availabilityRepository.js', () => ({
  AvailabilityRepository: jest.fn(() => mockAvailRepo),
}));
await jest.unstable_mockModule('../repositories/businessRepository.js', () => ({
  BusinessRepository: jest.fn(() => mockBusinessRepo),
}));
await jest.unstable_mockModule('../repositories/consentRepository.js', () => ({
  ConsentRepository: jest.fn(() => mockConsentRepo),
}));
await jest.unstable_mockModule('../repositories/healthRecordRepository.js', () => ({
  HealthRecordRepository: jest.fn(() => mockHealthRepo),
}));
await jest.unstable_mockModule('../repositories/soapNoteRepository.js', () => ({
  SoapNoteRepository: jest.fn(() => mockSoapRepo),
}));
await jest.unstable_mockModule('../repositories/clientFeedbackRepository.js', () => ({
  ClientFeedbackRepository: jest.fn(() => mockFeedbackRepo),
}));
await jest.unstable_mockModule('../repositories/clientHistoryRepository.js', () => ({
  ClientHistoryRepository: jest.fn(() => mockHistoryRepo),
}));
await jest.unstable_mockModule('../repositories/transferRequestRepository.js', () => ({
  TransferRequestRepository: jest.fn(() => mockTransferRepo),
}));

await jest.unstable_mockModule('../services/notificationService.js', () => ({
  NotificationService: jest.fn(() => ({
    sendBookingConfirmation: jest.fn().mockResolvedValue(),
    sendFeedbackRequest: jest.fn().mockResolvedValue(),
    sendSoapNotesRequest: jest.fn().mockResolvedValue(),
  })),
}));

const mockMembershipSvc = {
  getMyStatus:    jest.fn().mockResolvedValue({ active: false }),
  consumeCredit:  jest.fn().mockResolvedValue(0),
};
await jest.unstable_mockModule('../services/membershipService.js', () => ({
  MembershipService: jest.fn(() => mockMembershipSvc),
}));

const mockPaymentSvc = {
  payments: { findPaymentMethodById: jest.fn().mockResolvedValue(null) },
  createBookingSetupIntent: jest.fn().mockResolvedValue({ clientSecret: 'seti_mock_secret', stripeCustomerId: null }),
};
await jest.unstable_mockModule('../services/paymentService.js', () => ({
  PaymentService: jest.fn(() => mockPaymentSvc),
}));

const mockGenerateSlots = jest.fn();
await jest.unstable_mockModule('../services/slotService.js', () => ({
  generateSlots:        mockGenerateSlots,
  availableDaysForMonth: jest.fn(() => []),
}));

const mockValidateAddress = jest.fn();
await jest.unstable_mockModule('../services/addressValidationService.js', () => ({
  validateAddress: mockValidateAddress,
}));

const { default: request }       = await import('supertest');
const { default: app }           = await import('../app.js');
const { issueAccessToken }       = await import('../services/tokenService.js');
const { NotificationService }    = await import('../services/notificationService.js');

const CLIENT_ID    = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const THERAPIST_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const OWNER_ID     = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const APPT_ID      = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
const SERVICE_ID   = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
const FEEDBACK_TOKEN = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';

const FUTURE_AT = '2030-06-15T10:00:00.000Z';
const SOON_AT   = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const APPT = {
  id:             APPT_ID,
  client_id:      CLIENT_ID,
  therapist_id:   THERAPIST_ID,
  service_id:     SERVICE_ID,
  scheduled_at:   FUTURE_AT,
  status:         'pending',
  cancel_token:   'tok-cancel',
  feedback_token: FEEDBACK_TOKEN,
  soap_token:     'tok-soap',
  notes:          null,
};

const bearer = (id, roles = ['client']) =>
  `Bearer ${issueAccessToken({ id, roles })}`;

beforeEach(() => {
  jest.clearAllMocks();

  mockGenerateSlots.mockReturnValue([
    { startTime: '10:00', endTime: '11:00', availableTherapists: [{ id: THERAPIST_ID, firstName: 'Alice', lastName: 'B' }] },
  ]);
  mockMembershipSvc.getMyStatus.mockResolvedValue({ active: false });
  mockMembershipSvc.consumeCredit.mockResolvedValue(0);
  mockPaymentSvc.payments.findPaymentMethodById.mockResolvedValue(null);
  mockPaymentSvc.createBookingSetupIntent.mockResolvedValue({ clientSecret: 'seti_mock_secret', stripeCustomerId: null });
  mockValidateAddress.mockResolvedValue({ valid: true, formattedAddress: '123 Main St, Springfield, IL 62704, USA', unconfirmedComponentTypes: [] });

  const GUEST_APPT_DETAIL = {
    id: APPT_ID, status: 'pending', scheduled_at: FUTURE_AT,
    guest_name: 'Guest', cancel_token: 'tok-cancel',
    service_name: 'Deep Tissue', duration_minutes: 60,
    therapist_first_name: 'Alice', therapist_last_name: 'B',
  };

  Object.assign(mockApptRepo, {
    create:                       jest.fn().mockResolvedValue(APPT),
    findById:                     jest.fn().mockResolvedValue(APPT),
    findGuestAppointment:         jest.fn().mockResolvedValue(GUEST_APPT_DETAIL),
    findServiceById:              jest.fn().mockResolvedValue({ id: SERVICE_ID, name: 'Deep Tissue', price_cents: 9000, duration_minutes: 60 }),
    updateStatus:                 jest.fn().mockResolvedValue({ ...APPT, status: 'confirmed' }),
    updateStripePaymentMethodId:  jest.fn().mockResolvedValue({ ...APPT }),
    updateStripeCustomerId:       jest.fn().mockResolvedValue({ ...APPT }),
    setMembership:                jest.fn().mockResolvedValue({ ...APPT }),
    getByDateRange:               jest.fn().mockResolvedValue([]),
    listForTherapist:             jest.fn().mockResolvedValue([]),
    reschedule:                   jest.fn().mockResolvedValue(APPT),
  });
  Object.assign(mockAvailRepo, {
    getForDateRange: jest.fn().mockResolvedValue([]),
  });
  Object.assign(mockBusinessRepo, {
    getMassageBeds: jest.fn().mockResolvedValue([{ id: BED_ID, name: 'Table 1', is_active: true }]),
    getBookingRestrictions: jest.fn().mockResolvedValue({ restrict_pregnancy: false, restrict_minors: false }),
    getSchedulingSettings: jest.fn().mockResolvedValue({ buffer_minutes: 15 }),
  });
  Object.assign(mockConsentRepo, {
    findByClientId: jest.fn().mockResolvedValue(null),
    create:         jest.fn().mockResolvedValue({ id: 'cs-uuid', signed_at: new Date().toISOString() }),
  });
  Object.assign(mockHealthRepo, {
    findLatestByClientId: jest.fn().mockResolvedValue(null),
    create:               jest.fn().mockResolvedValue({ id: 'hr-uuid' }),
  });
  Object.assign(mockSoapRepo, {
    findByAppointmentId: jest.fn().mockResolvedValue(null),
    upsert:              jest.fn().mockResolvedValue({
      id: 'sn-uuid', appointment_id: APPT_ID, therapist_id: THERAPIST_ID,
      subjective: 'S', objective: 'O', assessment: 'A', plan: 'P',
    }),
  });
  Object.assign(mockFeedbackRepo, {
    findByAppointmentId: jest.fn().mockResolvedValue(null),
    create:              jest.fn().mockResolvedValue({ id: 'fb-uuid', appointment_id: APPT_ID, rating: 5 }),
  });
  Object.assign(mockHistoryRepo, {
    findByAppointment: jest.fn().mockResolvedValue({
      clientName: 'Test Client', clientId: CLIENT_ID, guestEmail: null, sessions: [],
    }),
  });
  Object.assign(mockTransferRepo, {
    findPendingByAppointment: jest.fn().mockResolvedValue(null),
    create:                   jest.fn().mockResolvedValue({ id: 'tr-uuid' }),
  });
});

// ── POST /appointments ────────────────────────────────────────────────────────

describe('POST /api/v1/appointments', () => {
  const body = {
    therapistId:    THERAPIST_ID,
    serviceId:      SERVICE_ID,
    scheduledAt:    FUTURE_AT,
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

  it('creates a health record for a new authenticated client', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(body);
    expect(res.status).toBe(201);
    expect(mockHealthRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: CLIENT_ID })
    );
  });

  it('reuses the existing health record for a returning authenticated client', async () => {
    mockHealthRepo.findLatestByClientId.mockResolvedValue({ id: 'existing-hr' });
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(body);
    expect(res.status).toBe(201);
    expect(mockHealthRepo.create).not.toHaveBeenCalled();
  });

  it('creates appointment for guest with name and email', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({ ...body, guestName: 'Guest', guestEmail: 'guest@example.com' });
    expect(res.status).toBe(201);
  });

  it('creates a health record for a guest booking', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({ ...body, guestName: 'Guest', guestEmail: 'guest@example.com' });
    expect(res.status).toBe(201);
    expect(mockHealthRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ guestEmail: 'guest@example.com' })
    );
  });

  it('randomly assigns a therapist when therapistId is omitted', async () => {
    const { therapistId: _omit, ...noTherapistBody } = body;
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(noTherapistBody);
    expect(res.status).toBe(201);
    expect(mockApptRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ therapistId: THERAPIST_ID })
    );
  });

  it('returns 409 when no therapist is available for any-therapist booking', async () => {
    mockGenerateSlots.mockReturnValue([
      { startTime: '10:00', endTime: '11:00', availableTherapists: [] },
    ]);
    const { therapistId: _omit, ...noTherapistBody } = body;
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(noTherapistBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
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
    mockGenerateSlots.mockReturnValue([]);
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('returns 400 when unauthenticated guest provides no guest details', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send(body);
    expect(res.status).toBe(400);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', bearer(CLIENT_ID))
      .send({ therapistId: THERAPIST_ID, serviceId: SERVICE_ID }); // missing scheduledAt
    expect(res.status).toBe(422);
  });

  describe('configurable buffer time for bed assignment', () => {
    // Existing appointment on the only active bed ends at 09:40 — 20 minutes
    // before the new 10:00 booking starts.
    const bedAppt = {
      bed_id: BED_ID,
      scheduled_at: '2030-06-15T08:40:00.000Z',
      duration_minutes: 60,
    };

    it('assigns the bed when the gap exceeds the configured buffer', async () => {
      mockApptRepo.getByDateRange.mockResolvedValue([bedAppt]);
      mockBusinessRepo.getSchedulingSettings.mockResolvedValue({ buffer_minutes: 15 });

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', bearer(CLIENT_ID))
        .send(body);

      expect(res.status).toBe(201);
    });

    it('rejects the booking when the gap is smaller than the configured buffer', async () => {
      mockApptRepo.getByDateRange.mockResolvedValue([bedAppt]);
      mockBusinessRepo.getSchedulingSettings.mockResolvedValue({ buffer_minutes: 30 });

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', bearer(CLIENT_ID))
        .send(body);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    });

    it('falls back to a 15-minute buffer when no scheduling settings row exists', async () => {
      mockApptRepo.getByDateRange.mockResolvedValue([bedAppt]);
      mockBusinessRepo.getSchedulingSettings.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', bearer(CLIENT_ID))
        .send(body);

      expect(res.status).toBe(201);
    });
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

// ── GET /appointments/health/status ──────────────────────────────────────────

describe('GET /api/v1/appointments/health/status', () => {
  it('returns hasRecord: false when no health record exists', async () => {
    const res = await request(app)
      .get('/api/v1/appointments/health/status')
      .set('Authorization', bearer(CLIENT_ID));
    expect(res.status).toBe(200);
    expect(res.body.data.hasRecord).toBe(false);
  });

  it('returns hasRecord: true when a health record exists', async () => {
    mockHealthRepo.findLatestByClientId.mockResolvedValue({ id: 'hr-uuid' });
    const res = await request(app)
      .get('/api/v1/appointments/health/status')
      .set('Authorization', bearer(CLIENT_ID));
    expect(res.status).toBe(200);
    expect(res.body.data.hasRecord).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/appointments/health/status');
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

// ── GET /appointments/:id/soap-notes ─────────────────────────────────────────

describe('GET /api/v1/appointments/:id/soap-notes', () => {
  it('returns null when no SOAP notes exist', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns existing SOAP notes', async () => {
    mockSoapRepo.findByAppointmentId.mockResolvedValue({
      id: 'sn-uuid', subjective: 'S note', objective: 'O note',
      assessment: 'A note', plan: 'P note',
    });
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    expect(res.status).toBe(200);
    expect(res.body.data.subjective).toBe('S note');
  });

  it('returns 403 for a plain client', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(CLIENT_ID, ['client']));
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get(`/api/v1/appointments/${APPT_ID}/soap-notes`);
    expect(res.status).toBe(401);
  });
});

// ── POST /appointments/:id/soap-notes ─────────────────────────────────────────

describe('POST /api/v1/appointments/:id/soap-notes', () => {
  const soapBody = {
    subjective:  'Client reports shoulder tension.',
    objective:   'Restricted ROM in left shoulder.',
    assessment:  'Rotator cuff tension pattern.',
    plan:        'Deep tissue on upper traps. Weekly sessions recommended.',
  };

  it('creates SOAP notes for the appointment therapist', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']))
      .send(soapBody);
    expect(res.status).toBe(200);
    expect(mockSoapRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPT_ID, therapistId: THERAPIST_ID })
    );
  });

  it('allows an owner to write SOAP notes on any appointment', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send(soapBody);
    expect(res.status).toBe(200);
  });

  it('returns 403 when a different therapist tries to write notes', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer('other-therapist-id', ['therapist']))
      .send(soapBody);
    expect(res.status).toBe(403);
  });

  it('returns 404 when appointment does not exist', async () => {
    mockApptRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']))
      .send(soapBody);
    expect(res.status).toBe(404);
  });

  it('returns 422 when a required SOAP field is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/soap-notes`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']))
      .send({ subjective: 'Only one field' }); // objective, assessment, plan missing
    expect(res.status).toBe(422);
  });
});

// ── GET /appointments/:id/client-history ─────────────────────────────────────

describe('GET /api/v1/appointments/:id/client-history', () => {
  it('returns client history for a therapist', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/client-history`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('sessions');
    expect(mockHistoryRepo.findByAppointment).toHaveBeenCalledWith(APPT_ID);
  });

  it('returns client history for an owner', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/client-history`)
      .set('Authorization', bearer(OWNER_ID, ['owner']));
    expect(res.status).toBe(200);
  });

  it('returns 404 when no matching client found', async () => {
    mockHistoryRepo.findByAppointment.mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/client-history`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    expect(res.status).toBe(404);
  });

  it('returns 403 for a plain client', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/client-history`)
      .set('Authorization', bearer(CLIENT_ID, ['client']));
    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get(`/api/v1/appointments/${APPT_ID}/client-history`);
    expect(res.status).toBe(401);
  });
});

// ── GET /appointments/:id/feedback-info ──────────────────────────────────────

describe('GET /api/v1/appointments/:id/feedback-info', () => {
  it('returns appointment info with a valid token', async () => {
    mockApptRepo.findServiceById.mockResolvedValue({ id: SERVICE_ID, name: 'Swedish Massage', price_cents: 8000 });
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/feedback-info?token=${FEEDBACK_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.serviceName).toBe('Swedish Massage');
    expect(res.body.data.alreadySubmitted).toBe(false);
  });

  it('reports alreadySubmitted: true when feedback already exists', async () => {
    mockApptRepo.findServiceById.mockResolvedValue({ id: SERVICE_ID, name: 'Massage', price_cents: 0 });
    mockFeedbackRepo.findByAppointmentId.mockResolvedValue({ id: 'fb-uuid', rating: 5 });
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/feedback-info?token=${FEEDBACK_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data.alreadySubmitted).toBe(true);
  });

  it('returns 403 with wrong token', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/feedback-info?token=wrong-token`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when appointment does not exist', async () => {
    mockApptRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/feedback-info?token=${FEEDBACK_TOKEN}`);
    expect(res.status).toBe(404);
  });
});

// ── POST /appointments/:id/feedback ──────────────────────────────────────────

describe('POST /api/v1/appointments/:id/feedback', () => {
  it('submits feedback for a completed appointment', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'completed' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/feedback`)
      .send({ feedbackToken: FEEDBACK_TOKEN, rating: 5, comments: 'Great session!' });
    expect(res.status).toBe(201);
    expect(mockFeedbackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPT_ID, rating: 5 })
    );
  });

  it('returns 403 when the feedback token is wrong', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'completed' });
    // Valid UUID format but wrong value
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/feedback`)
      .send({ feedbackToken: 'a0000000-0000-4000-8000-000000000001', rating: 4 });
    expect(res.status).toBe(403);
  });

  it('returns 400 when appointment is not completed', async () => {
    // Default APPT has status 'pending'
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/feedback`)
      .send({ feedbackToken: FEEDBACK_TOKEN, rating: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 409 when feedback was already submitted', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'completed' });
    mockFeedbackRepo.findByAppointmentId.mockResolvedValue({ id: 'existing-fb' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/feedback`)
      .send({ feedbackToken: FEEDBACK_TOKEN, rating: 4 });
    expect(res.status).toBe(409);
  });

  it('returns 422 when rating is out of range', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'completed' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/feedback`)
      .send({ feedbackToken: FEEDBACK_TOKEN, rating: 6 });
    expect(res.status).toBe(422);
  });

  it('returns 422 when feedbackToken is not a valid UUID', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/feedback`)
      .send({ feedbackToken: 'not-a-uuid', rating: 4 });
    expect(res.status).toBe(422);
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

  it('returns 400 when confirmed appointment is within 24 hours', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'confirmed', scheduled_at: SOON_AT });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer(CLIENT_ID));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MODIFICATION_WINDOW_CLOSED');
  });

  it('allows cancellation of pending appointments within 24 hours', async () => {
    mockApptRepo.findById.mockResolvedValue({ ...APPT, status: 'pending', scheduled_at: SOON_AT });
    mockApptRepo.updateStatus.mockResolvedValue({ ...APPT, status: 'cancelled' });
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/cancel`)
      .set('Authorization', bearer(CLIENT_ID));
    expect(res.status).toBe(200);
    expect(mockApptRepo.updateStatus).toHaveBeenCalledWith(APPT_ID, 'cancelled');
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

  it('guest confirms via cancel token', async () => {
    const guestAppt = { ...APPT, client_id: null, cancel_token: 'tok-cancel' };
    mockApptRepo.findById.mockResolvedValue(guestAppt);
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`)
      .send({ cancelToken: 'tok-cancel' });
    expect(res.status).toBe(200);
    expect(mockApptRepo.updateStatus).toHaveBeenCalledWith(APPT_ID, 'confirmed');
  });

  it('returns 403 when guest provides wrong cancel token', async () => {
    const guestAppt = { ...APPT, client_id: null, cancel_token: 'tok-cancel' };
    mockApptRepo.findById.mockResolvedValue(guestAppt);
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`)
      .send({ cancelToken: 'wrong-token' });
    expect(res.status).toBe(403);
  });

  it('returns 403 with no auth and no cancel token', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/confirm`);
    expect(res.status).toBe(403);
  });
});

// ── GET /appointments/:id/guest ───────────────────────────────────────────────

describe('GET /api/v1/appointments/:id/guest', () => {
  it('returns appointment details for valid id and token', async () => {
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/guest?token=tok-cancel`);
    expect(res.status).toBe(200);
    expect(mockApptRepo.findGuestAppointment).toHaveBeenCalledWith(APPT_ID, 'tok-cancel');
    expect(res.body.data).toMatchObject({
      id: APPT_ID,
      status: 'pending',
      serviceName: 'Deep Tissue',
      therapistFirstName: 'Alice',
    });
  });

  it('returns 404 when token does not match', async () => {
    mockApptRepo.findGuestAppointment.mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/guest?token=wrong`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when appointment does not exist', async () => {
    mockApptRepo.findGuestAppointment.mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/v1/appointments/${APPT_ID}/guest`);
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

  it('fires sendFeedbackRequest after completion', async () => {
    mockApptRepo.updateStatus.mockResolvedValue({ ...APPT, status: 'completed' });
    await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/complete`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    const instance = NotificationService.mock.results.at(-1).value;
    expect(instance.sendFeedbackRequest).toHaveBeenCalledWith(APPT_ID);
  });

  it('fires sendSoapNotesRequest after completion', async () => {
    mockApptRepo.updateStatus.mockResolvedValue({ ...APPT, status: 'completed' });
    await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/complete`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    const instance = NotificationService.mock.results.at(-1).value;
    expect(instance.sendSoapNotesRequest).toHaveBeenCalledWith(APPT_ID);
  });

  it('fires both sendFeedbackRequest and sendSoapNotesRequest on the same service instance', async () => {
    mockApptRepo.updateStatus.mockResolvedValue({ ...APPT, status: 'completed' });
    await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/complete`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']));
    const instance = NotificationService.mock.results.at(-1).value;
    expect(instance.sendFeedbackRequest).toHaveBeenCalledTimes(1);
    expect(instance.sendSoapNotesRequest).toHaveBeenCalledTimes(1);
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

// ── POST /appointments/validate-address ───────────────────────────────────────

describe('POST /api/v1/appointments/validate-address', () => {
  const VALID_BODY = { addressLine1: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704' };

  it('returns valid for a confirmed address, with no auth required', async () => {
    const res = await request(app)
      .post('/api/v1/appointments/validate-address')
      .send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(mockValidateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ addressLine1: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704' })
    );
  });

  it('returns valid: false when the provider cannot confirm the address', async () => {
    mockValidateAddress.mockResolvedValue({ valid: false, formattedAddress: null, unconfirmedComponentTypes: ['locality'] });
    const res = await request(app)
      .post('/api/v1/appointments/validate-address')
      .send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/appointments/validate-address')
      .send({ addressLine1: '123 Main St' });
    expect(res.status).toBe(422);
  });

  it('propagates a 502 when the validation provider is unavailable', async () => {
    mockValidateAddress.mockRejectedValue(
      Object.assign(new Error('Address verification service is unavailable. Please try again.'), { statusCode: 502, code: 'ADDRESS_VALIDATION_UNAVAILABLE' })
    );
    const res = await request(app)
      .post('/api/v1/appointments/validate-address')
      .send(VALID_BODY);
    expect(res.status).toBe(502);
  });
});
