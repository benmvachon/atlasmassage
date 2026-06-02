import { jest } from '@jest/globals';

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

const mockAvailRepo = {};
const mockApptRepo  = {};
const mockBizRepo   = {};
const mockTherapistRepo = {};

await jest.unstable_mockModule('../repositories/availabilityRepository.js', () => ({
  AvailabilityRepository: jest.fn(() => mockAvailRepo),
}));

await jest.unstable_mockModule('../repositories/appointmentRepository.js', () => ({
  AppointmentRepository: jest.fn(() => mockApptRepo),
}));

await jest.unstable_mockModule('../repositories/businessRepository.js', () => ({
  BusinessRepository: jest.fn(() => mockBizRepo),
}));

await jest.unstable_mockModule('../repositories/therapistRepository.js', () => ({
  TherapistRepository: jest.fn(() => mockTherapistRepo),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');

const THERAPIST_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const OWNER_ID     = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

const bearer = (id, roles = ['therapist']) =>
  `Bearer ${issueAccessToken({ id, roles })}`;

const THERAPIST = {
  id: THERAPIST_ID,
  first_name: 'Alice',
  last_name: 'B',
  is_accepting_clients: true,
  is_active: true,
  specialties: ['Swedish'],
  daily_booking_limit: 4,
  weekly_booking_limit: 20,
};

const BIZ_HOURS = [
  { day_of_week: 0, open_time: '09:00:00', close_time: '17:00:00', is_closed: false },
  { day_of_week: 1, open_time: '09:00:00', close_time: '17:00:00', is_closed: false },
  { day_of_week: 2, open_time: '09:00:00', close_time: '17:00:00', is_closed: false },
  { day_of_week: 3, open_time: '09:00:00', close_time: '17:00:00', is_closed: false },
  { day_of_week: 4, open_time: '09:00:00', close_time: '17:00:00', is_closed: false },
  { day_of_week: 5, open_time: '09:00:00', close_time: '17:00:00', is_closed: false },
  { day_of_week: 6, open_time: '09:00:00', close_time: '17:00:00', is_closed: true },
];

const SERVICES = [
  { id: 'svc-1', name: 'Deep Tissue', price_cents: 9000, duration_minutes: 60, is_active: true },
];

beforeEach(() => {
  jest.clearAllMocks();

  Object.assign(mockAvailRepo, {
    getForDateRange: jest.fn().mockResolvedValue([]),
    getByTherapistAndMonth: jest.fn().mockResolvedValue([]),
    upsertMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue([]),
    updateLimits: jest.fn().mockResolvedValue({ user_id: THERAPIST_ID, daily_booking_limit: 3, weekly_booking_limit: 15 }),
  });

  Object.assign(mockApptRepo, {
    getByDateRange: jest.fn().mockResolvedValue([]),
  });

  Object.assign(mockBizRepo, {
    getBusinessHours: jest.fn().mockResolvedValue(BIZ_HOURS),
    getServices: jest.fn().mockResolvedValue(SERVICES),
  });

  Object.assign(mockTherapistRepo, {
    findAll: jest.fn().mockResolvedValue([THERAPIST]),
    findById: jest.fn().mockResolvedValue(THERAPIST),
  });
});

// ── GET /availability/booking/calendar ────────────────────────────────────────

describe('GET /api/v1/availability/booking/calendar', () => {
  it('returns available days, therapists, and services', async () => {
    const res = await request(app).get('/api/v1/availability/booking/calendar?year=2030&month=1');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('availableDays');
    expect(res.body.data).toHaveProperty('businessHours');
    expect(res.body.data).toHaveProperty('therapists');
    expect(res.body.data).toHaveProperty('services');
  });

  it('filters therapists to those accepting clients', async () => {
    mockTherapistRepo.findAll.mockResolvedValue([
      THERAPIST,
      { ...THERAPIST, id: 'other', is_accepting_clients: false },
    ]);
    const res = await request(app).get('/api/v1/availability/booking/calendar');
    expect(res.body.data.therapists).toHaveLength(1);
    expect(res.body.data.therapists[0].id).toBe(THERAPIST_ID);
  });

  it('filters services to active 60-minute ones', async () => {
    mockBizRepo.getServices.mockResolvedValue([
      ...SERVICES,
      { ...SERVICES[0], id: 'svc-2', is_active: false },
      { ...SERVICES[0], id: 'svc-3', duration_minutes: 90, is_active: true },
    ]);
    const res = await request(app).get('/api/v1/availability/booking/calendar');
    const ids = res.body.data.services.map(s => s.id);
    expect(ids).toContain('svc-1');
    expect(ids).not.toContain('svc-2');
    expect(ids).not.toContain('svc-3');
  });

  it('filters by therapistId query param', async () => {
    const res = await request(app)
      .get(`/api/v1/availability/booking/calendar?therapistId=${THERAPIST_ID}`);

    expect(mockAvailRepo.getForDateRange).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      THERAPIST_ID
    );
    expect(res.status).toBe(200);
  });
});

// ── GET /availability/booking/slots ───────────────────────────────────────────

describe('GET /api/v1/availability/booking/slots', () => {
  it('returns slots for a valid date', async () => {
    const res = await request(app)
      .get('/api/v1/availability/booking/slots?date=2030-06-15');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('slots');
  });

  it('returns 400 when date param is missing', async () => {
    const res = await request(app).get('/api/v1/availability/booking/slots');
    expect(res.status).toBe(400);
  });

  it('returns 400 when date format is invalid', async () => {
    const res = await request(app)
      .get('/api/v1/availability/booking/slots?date=not-a-date');
    expect(res.status).toBe(400);
  });
});

// ── GET /availability/therapists ──────────────────────────────────────────────

describe('GET /api/v1/availability/therapists', () => {
  it('returns therapists who are accepting clients', async () => {
    mockTherapistRepo.findAll.mockResolvedValue([
      THERAPIST,
      { ...THERAPIST, id: 'other', is_accepting_clients: false },
    ]);
    const res = await request(app).get('/api/v1/availability/therapists');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ── GET /availability/therapists/:therapistId ─────────────────────────────────

describe('GET /api/v1/availability/therapists/:therapistId', () => {
  it('returns therapist availability and business hours', async () => {
    const res = await request(app)
      .get(`/api/v1/availability/therapists/${THERAPIST_ID}?year=2030&month=6`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('availability');
    expect(res.body.data).toHaveProperty('businessHours');
    expect(res.body.data.dailyBookingLimit).toBe(4);
  });

  it('returns 404 when therapist does not exist', async () => {
    mockTherapistRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .get(`/api/v1/availability/therapists/${THERAPIST_ID}`);
    expect(res.status).toBe(404);
  });
});

// ── PUT /availability/therapists/:therapistId ─────────────────────────────────

describe('PUT /api/v1/availability/therapists/:therapistId', () => {
  const entries = [{ date: '2030-06-15', startTime: '09:00', endTime: '17:00' }];

  it('allows owner to set availability for any therapist', async () => {
    // Sunday (2030-06-15 is a Sunday? Let me compute: actually I'll use a Monday)
    // 2030-06-17 is a Monday (day_of_week = 1)
    const entriesMonday = [{ date: '2030-06-17', startTime: '09:00', endTime: '17:00' }];
    mockAvailRepo.upsertMany.mockResolvedValue(entriesMonday);

    const res = await request(app)
      .put(`/api/v1/availability/therapists/${THERAPIST_ID}`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send({ entries: entriesMonday });

    expect(res.status).toBe(200);
  });

  it('allows therapist to set their own availability', async () => {
    const entriesMonday = [{ date: '2030-06-17', startTime: '09:00', endTime: '17:00' }];
    const res = await request(app)
      .put(`/api/v1/availability/therapists/${THERAPIST_ID}`)
      .set('Authorization', bearer(THERAPIST_ID, ['therapist']))
      .send({ entries: entriesMonday });

    expect(res.status).toBe(200);
  });

  it('returns 403 when a different therapist tries to set availability', async () => {
    const res = await request(app)
      .put(`/api/v1/availability/therapists/${THERAPIST_ID}`)
      .set('Authorization', bearer('other-therapist', ['therapist']))
      .send({ entries });

    expect(res.status).toBe(403);
  });

  it('returns 404 when therapist does not exist', async () => {
    mockTherapistRepo.findById.mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/v1/availability/therapists/${THERAPIST_ID}`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send({ entries });

    expect(res.status).toBe(404);
  });

  it('returns 400 when date falls on a closed day', async () => {
    // Sunday = day_of_week 0, is_closed: false in fixture... let's use a different date
    // 2030-06-16 = Sunday (day_of_week 0), marked not closed in our fixture...
    // Actually let me mock a closed day: day 0 = Sunday, is_closed: true
    const closedHours = BIZ_HOURS.map(h =>
      h.day_of_week === 0 ? { ...h, is_closed: true } : h
    );
    mockBizRepo.getBusinessHours.mockResolvedValue(closedHours);
    // June 15 2030 is a Saturday (day_of_week=6), which is already closed
    const res = await request(app)
      .put(`/api/v1/availability/therapists/${THERAPIST_ID}`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send({ entries: [{ date: '2030-06-15', startTime: '09:00', endTime: '17:00' }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATE');
  });
});

// ── DELETE /availability/therapists/:therapistId/dates ────────────────────────

describe('DELETE /api/v1/availability/therapists/:therapistId/dates', () => {
  it('deletes availability dates for the owner', async () => {
    mockAvailRepo.deleteMany.mockResolvedValue([{ specific_date: '2030-06-17' }]);
    const res = await request(app)
      .delete(`/api/v1/availability/therapists/${THERAPIST_ID}/dates`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send({ dates: ['2030-06-17'] });

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(1);
  });

  it('returns 403 when a different therapist attempts deletion', async () => {
    const res = await request(app)
      .delete(`/api/v1/availability/therapists/${THERAPIST_ID}/dates`)
      .set('Authorization', bearer('other-therapist', ['therapist']))
      .send({ dates: ['2030-06-17'] });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /availability/therapists/:therapistId/limits ────────────────────────

describe('PATCH /api/v1/availability/therapists/:therapistId/limits', () => {
  it('updates booking limits for the owner', async () => {
    const res = await request(app)
      .patch(`/api/v1/availability/therapists/${THERAPIST_ID}/limits`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send({ dailyBookingLimit: 3, weeklyBookingLimit: 15 });

    expect(res.status).toBe(200);
    expect(res.body.data.daily_booking_limit).toBe(3);
  });

  it('returns 404 when therapist record does not exist', async () => {
    mockAvailRepo.updateLimits.mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/v1/availability/therapists/${THERAPIST_ID}/limits`)
      .set('Authorization', bearer(OWNER_ID, ['owner']))
      .send({ dailyBookingLimit: 3, weeklyBookingLimit: 15 });

    expect(res.status).toBe(404);
  });
});
