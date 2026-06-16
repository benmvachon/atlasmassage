import { jest } from '@jest/globals';

// Must mock modules before any dynamic imports that load them
await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

// Closure-captured mock instances — implementation set in the factory so it
// survives jest.clearAllMocks() between tests (mockClear does not reset the
// default implementation set via jest.fn(impl)).
const mockBusiness = {};
const mockTherapistRepo = {};
const mockUserRepo = {};

await jest.unstable_mockModule('../repositories/businessRepository.js', () => ({
  BusinessRepository: jest.fn(() => mockBusiness),
}));

await jest.unstable_mockModule('../repositories/therapistRepository.js', () => ({
  TherapistRepository: jest.fn(() => mockTherapistRepo),
}));

await jest.unstable_mockModule('../repositories/userRepository.js', () => ({
  UserRepository: jest.fn(() => mockUserRepo),
}));

await jest.unstable_mockModule('bcrypt', () => ({
  default: { hash: jest.fn().mockResolvedValue('$2b$12$hashed') },
}));

await jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => ({
    products: {
      create: jest.fn().mockResolvedValue({ id: 'prod_test' }),
      update: jest.fn().mockResolvedValue({}),
    },
    prices: {
      create: jest.fn().mockResolvedValue({ id: 'price_test' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'price_old', product: 'prod_test' }),
      update: jest.fn().mockResolvedValue({}),
    },
  })),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');
// ── Helpers ───────────────────────────────────────────────────────────────────

const ownerBearer = () =>
  `Bearer ${issueAccessToken({ id: 'owner-uuid', roles: ['owner', 'therapist'] })}`;

const clientBearer = () =>
  `Bearer ${issueAccessToken({ id: 'client-uuid', roles: ['client'] })}`;

const therapistBearer = () =>
  `Bearer ${issueAccessToken({ id: 'therapist-only-uuid', roles: ['therapist'] })}`;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HOURS = [
  { id: 1, day_of_week: 0, open_time: '10:00:00', close_time: '17:00:00', is_closed: true },
  { id: 2, day_of_week: 1, open_time: '09:00:00', close_time: '19:00:00', is_closed: false },
];

const BEDS = [
  { id: 'bed-1', name: 'Table 1', is_active: true, created_at: '2024-01-01T00:00:00Z' },
  { id: 'bed-2', name: 'Table 2', is_active: false, created_at: '2024-01-01T00:00:00Z' },
];

const SERVICES = [
  {
    id: 'svc-1', name: 'Swedish Massage', description: 'Relaxing',
    duration_minutes: 60, price_cents: 9000, is_active: true,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  },
];

const THERAPIST = {
  id: 'therapist-1', email: 'sarah@example.com',
  first_name: 'Sarah', last_name: 'Chen',
  phone: null, is_active: true,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  bio: 'Expert therapist', specialties: ['swedish'], is_accepting_clients: true,
  roles: ['therapist'],
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  Object.assign(mockBusiness, {
    getBusinessHours: jest.fn().mockResolvedValue(HOURS),
    getMassageBeds: jest.fn().mockResolvedValue(BEDS),
    getServices: jest.fn().mockResolvedValue(SERVICES),
    upsertBusinessHours: jest.fn(),
    createMassageBed: jest.fn(),
    updateMassageBed: jest.fn(),
    deleteMassageBed: jest.fn(),
    createService: jest.fn(),
    findServiceById: jest.fn().mockResolvedValue(SERVICES[0]),
    updateService: jest.fn(),
    deactivateService: jest.fn(),
    getSchedulingSettings: jest.fn().mockResolvedValue({ id: 1, buffer_minutes: 15 }),
    updateSchedulingSettings: jest.fn(),
    getBusinessContactInfo: jest.fn().mockResolvedValue({
      id: 1, address_line1: '123 Boylston Street', address_line2: '', city: 'Boston',
      state: 'MA', zip: '02116', phone: '(617) 555-0100', email: 'hello@atlasmassage.com',
    }),
    updateBusinessContactInfo: jest.fn(),
  });

  Object.assign(mockTherapistRepo, {
    findAll: jest.fn().mockResolvedValue([THERAPIST]),
    findById: jest.fn().mockResolvedValue(THERAPIST),
    create: jest.fn().mockResolvedValue('therapist-1'),
    updateProfile: jest.fn().mockResolvedValue({ user_id: 'therapist-1' }),
    deactivate: jest.fn().mockResolvedValue({ id: 'therapist-1' }),
  });

  Object.assign(mockUserRepo, {
    findByEmail: jest.fn().mockResolvedValue(null),
  });
});

// ── Authorization (all admin routes require owner role) ───────────────────────

describe('admin route authorization', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/admin/business');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for a client token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/business')
      .set('Authorization', clientBearer());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for a therapist-only token', async () => {
    const res = await request(app)
      .get('/api/v1/admin/therapists')
      .set('Authorization', therapistBearer());
    expect(res.status).toBe(403);
  });
});

// ── GET /admin/business ───────────────────────────────────────────────────────

describe('GET /api/v1/admin/business', () => {
  it('returns hours, beds, and services for an owner', async () => {
    const res = await request(app)
      .get('/api/v1/admin/business')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hours).toHaveLength(2);
    expect(res.body.data.beds).toHaveLength(2);
    expect(res.body.data.services).toHaveLength(1);
    expect(mockBusiness.getBusinessHours).toHaveBeenCalledTimes(1);
    expect(mockBusiness.getMassageBeds).toHaveBeenCalledTimes(1);
    expect(mockBusiness.getServices).toHaveBeenCalledTimes(1);
  });
});

// ── PUT /admin/business/hours/:dayOfWeek ──────────────────────────────────────

describe('PUT /api/v1/admin/business/hours/:dayOfWeek', () => {
  const valid = { openTime: '09:00', closeTime: '17:00', isClosed: false };
  const updated = { id: 2, day_of_week: 1, open_time: '09:00:00', close_time: '17:00:00', is_closed: false };

  it('upserts business hours and returns the updated row', async () => {
    mockBusiness.upsertBusinessHours.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/admin/business/hours/1')
      .set('Authorization', ownerBearer())
      .send(valid);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ day_of_week: 1, is_closed: false });
    expect(mockBusiness.upsertBusinessHours).toHaveBeenCalledWith(1, valid);
  });

  it('returns 422 when openTime is missing', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/hours/1')
      .set('Authorization', ownerBearer())
      .send({ closeTime: '17:00', isClosed: false });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('openTime');
  });

  it('returns 422 when dayOfWeek is out of range', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/hours/9')
      .set('Authorization', ownerBearer())
      .send(valid);

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('dayOfWeek');
  });
});

// ── Scheduling settings ─────────────────────────────────────────────────────

describe('GET /api/v1/admin/business/scheduling-settings', () => {
  it('returns the current buffer setting for an owner', async () => {
    const res = await request(app)
      .get('/api/v1/admin/business/scheduling-settings')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 1, buffer_minutes: 15 });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/admin/business/scheduling-settings');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/admin/business/scheduling-settings', () => {
  it('updates the buffer setting and returns the updated row', async () => {
    mockBusiness.updateSchedulingSettings.mockResolvedValue({ id: 1, buffer_minutes: 30 });

    const res = await request(app)
      .put('/api/v1/admin/business/scheduling-settings')
      .set('Authorization', ownerBearer())
      .send({ bufferMinutes: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ buffer_minutes: 30 });
    expect(mockBusiness.updateSchedulingSettings).toHaveBeenCalledWith({ bufferMinutes: 30 });
  });

  it('returns 422 when bufferMinutes is missing', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/scheduling-settings')
      .set('Authorization', ownerBearer())
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('bufferMinutes');
  });

  it('returns 422 when bufferMinutes is out of range', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/scheduling-settings')
      .set('Authorization', ownerBearer())
      .send({ bufferMinutes: 200 });

    expect(res.status).toBe(422);
  });

  it('returns 403 for a non-owner', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/scheduling-settings')
      .set('Authorization', therapistBearer())
      .send({ bufferMinutes: 30 });

    expect(res.status).toBe(403);
  });
});

// ── Business contact info ──────────────────────────────────────────────────

describe('GET /api/v1/admin/business/contact-info', () => {
  it('returns the current contact info for an owner', async () => {
    const res = await request(app)
      .get('/api/v1/admin/business/contact-info')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ address_line1: '123 Boylston Street', phone: '(617) 555-0100', email: 'hello@atlasmassage.com' });
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/admin/business/contact-info');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/admin/business/contact-info', () => {
  const valid = {
    addressLine1: '456 Newbury St',
    addressLine2: 'Suite 2',
    city: 'Boston',
    state: 'MA',
    zip: '02115',
    phone: '(617) 555-9999',
    email: 'contact@atlasmassage.com',
  };

  it('updates the contact info and returns the updated row', async () => {
    mockBusiness.updateBusinessContactInfo.mockResolvedValue({ id: 1, address_line1: '456 Newbury St' });

    const res = await request(app)
      .put('/api/v1/admin/business/contact-info')
      .set('Authorization', ownerBearer())
      .send(valid);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ address_line1: '456 Newbury St' });
    expect(mockBusiness.updateBusinessContactInfo).toHaveBeenCalledWith(valid);
  });

  it('returns 422 when addressLine1 is missing', async () => {
    const { addressLine1: _omit, ...rest } = valid;
    const res = await request(app)
      .put('/api/v1/admin/business/contact-info')
      .set('Authorization', ownerBearer())
      .send(rest);

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('addressLine1');
  });

  it('returns 422 when email is invalid', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/contact-info')
      .set('Authorization', ownerBearer())
      .send({ ...valid, email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('returns 422 when phone is invalid', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/contact-info')
      .set('Authorization', ownerBearer())
      .send({ ...valid, phone: 'not-a-phone' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('phone');
  });

  it('returns 403 for a non-owner', async () => {
    const res = await request(app)
      .put('/api/v1/admin/business/contact-info')
      .set('Authorization', therapistBearer())
      .send(valid);

    expect(res.status).toBe(403);
  });
});

// ── Massage beds ──────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/business/beds', () => {
  it('returns list of massage beds', async () => {
    const res = await request(app)
      .get('/api/v1/admin/business/beds')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].name).toBe('Table 1');
  });
});

describe('POST /api/v1/admin/business/beds', () => {
  const newBed = { id: 'bed-3', name: 'Table 3', is_active: true, created_at: '2024-01-01T00:00:00Z' };

  it('creates a massage bed and returns 201', async () => {
    mockBusiness.createMassageBed.mockResolvedValue(newBed);

    const res = await request(app)
      .post('/api/v1/admin/business/beds')
      .set('Authorization', ownerBearer())
      .send({ name: 'Table 3' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Table 3');
    expect(mockBusiness.createMassageBed).toHaveBeenCalledWith('Table 3');
  });

  it('returns 422 when name is empty', async () => {
    const res = await request(app)
      .post('/api/v1/admin/business/beds')
      .set('Authorization', ownerBearer())
      .send({ name: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('name');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/admin/business/beds')
      .set('Authorization', ownerBearer())
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/v1/admin/business/beds/:id', () => {
  const payload = { name: 'Renamed Table', isActive: false };

  it('updates the bed and returns the updated record', async () => {
    const updated = { ...BEDS[0], name: 'Renamed Table', is_active: false };
    mockBusiness.updateMassageBed.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/admin/business/beds/bed-1')
      .set('Authorization', ownerBearer())
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Table');
    expect(mockBusiness.updateMassageBed).toHaveBeenCalledWith('bed-1', payload);
  });

  it('returns 404 when the bed does not exist', async () => {
    mockBusiness.updateMassageBed.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/admin/business/beds/nonexistent')
      .set('Authorization', ownerBearer())
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('DELETE /api/v1/admin/business/beds/:id', () => {
  it('deletes the bed and returns 200', async () => {
    mockBusiness.deleteMassageBed.mockResolvedValue({ id: 'bed-1' });

    const res = await request(app)
      .delete('/api/v1/admin/business/beds/bed-1')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when the bed does not exist', async () => {
    mockBusiness.deleteMassageBed.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/admin/business/beds/nonexistent')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(404);
  });
});

// ── Services ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/services', () => {
  it('returns list of services', async () => {
    const res = await request(app)
      .get('/api/v1/admin/services')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Swedish Massage');
  });
});

describe('POST /api/v1/admin/services', () => {
  const valid = { name: 'Deep Tissue', description: 'Intense', durationMinutes: 60, priceCents: 10500 };

  it('creates a service and returns 201', async () => {
    const created = { id: 'svc-2', ...valid, is_active: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' };
    mockBusiness.createService.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/v1/admin/services')
      .set('Authorization', ownerBearer())
      .send(valid);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Deep Tissue');
  });

  it('returns 422 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/admin/services')
      .set('Authorization', ownerBearer())
      .send({ durationMinutes: 60, priceCents: 10000 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('name');
  });

  it('returns 422 when priceCents is negative', async () => {
    const res = await request(app)
      .post('/api/v1/admin/services')
      .set('Authorization', ownerBearer())
      .send({ ...valid, priceCents: -1 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('priceCents');
  });

  it('returns 422 when durationMinutes is zero', async () => {
    const res = await request(app)
      .post('/api/v1/admin/services')
      .set('Authorization', ownerBearer())
      .send({ ...valid, durationMinutes: 0 });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('durationMinutes');
  });
});

describe('PUT /api/v1/admin/services/:id', () => {
  const payload = { name: 'Updated', description: null, durationMinutes: 90, priceCents: 12000, isActive: true };

  it('updates service and returns updated record', async () => {
    const updated = { ...SERVICES[0], name: 'Updated', duration_minutes: 90 };
    mockBusiness.updateService.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/admin/services/svc-1')
      .set('Authorization', ownerBearer())
      .send(payload);

    expect(res.status).toBe(200);
    expect(mockBusiness.updateService).toHaveBeenCalledWith('svc-1', expect.objectContaining(payload));
  });

  it('returns 404 when the service does not exist', async () => {
    mockBusiness.findServiceById.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/admin/services/nonexistent')
      .set('Authorization', ownerBearer())
      .send(payload);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/admin/services/:id', () => {
  it('soft-deactivates service and returns 200', async () => {
    mockBusiness.deactivateService.mockResolvedValue({ ...SERVICES[0], is_active: false });

    const res = await request(app)
      .delete('/api/v1/admin/services/svc-1')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when the service does not exist', async () => {
    mockBusiness.deactivateService.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/admin/services/nonexistent')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(404);
  });
});

// ── Therapist management ──────────────────────────────────────────────────────

describe('GET /api/v1/admin/therapists', () => {
  it('returns list of all therapists', async () => {
    const res = await request(app)
      .get('/api/v1/admin/therapists')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe('sarah@example.com');
    expect(res.body.data[0].specialties).toContain('swedish');
  });
});

describe('GET /api/v1/admin/therapists/:id', () => {
  it('returns a single therapist', async () => {
    const res = await request(app)
      .get('/api/v1/admin/therapists/therapist-1')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('therapist-1');
  });

  it('returns 404 when therapist does not exist', async () => {
    mockTherapistRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/admin/therapists/nonexistent')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/v1/admin/therapists', () => {
  const valid = {
    email: 'new@example.com', password: 'securepass', firstName: 'Jordan',
    lastName: 'Park', bio: 'Great therapist', specialties: ['hot stone'], isAcceptingClients: true,
  };

  it('creates a therapist account and returns 201 with full profile', async () => {
    const created = { ...THERAPIST, id: 'therapist-2', email: 'new@example.com', first_name: 'Jordan', last_name: 'Park' };
    mockTherapistRepo.create.mockResolvedValue('therapist-2');
    mockTherapistRepo.findById.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/v1/admin/therapists')
      .set('Authorization', ownerBearer())
      .send(valid);

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('new@example.com');
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('new@example.com');
  });

  it('returns 409 when email already exists', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: 'existing', email: 'new@example.com' });

    const res = await request(app)
      .post('/api/v1/admin/therapists')
      .set('Authorization', ownerBearer())
      .send(valid);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 422 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/admin/therapists')
      .set('Authorization', ownerBearer())
      .send({ ...valid, email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('email');
  });

  it('returns 422 when password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/admin/therapists')
      .set('Authorization', ownerBearer())
      .send({ ...valid, password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('returns 422 when required name fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/admin/therapists')
      .set('Authorization', ownerBearer())
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('firstName');
    expect(res.body.error.details).toHaveProperty('lastName');
  });
});

describe('PUT /api/v1/admin/therapists/:id', () => {
  const payload = { bio: 'Updated bio', specialties: ['swedish', 'prenatal'], isAcceptingClients: false };

  it('updates therapist profile and returns updated record', async () => {
    const updated = { ...THERAPIST, bio: 'Updated bio', specialties: ['swedish', 'prenatal'], is_accepting_clients: false };
    mockTherapistRepo.updateProfile.mockResolvedValue({ user_id: 'therapist-1' });
    mockTherapistRepo.findById.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/admin/therapists/therapist-1')
      .set('Authorization', ownerBearer())
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('Updated bio');
    expect(res.body.data.is_accepting_clients).toBe(false);
  });

  it('returns 404 when therapist does not exist', async () => {
    mockTherapistRepo.updateProfile.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/admin/therapists/nonexistent')
      .set('Authorization', ownerBearer())
      .send(payload);

    expect(res.status).toBe(404);
  });

  it('returns 422 when isAcceptingClients is missing', async () => {
    const res = await request(app)
      .put('/api/v1/admin/therapists/therapist-1')
      .set('Authorization', ownerBearer())
      .send({ bio: 'Some bio' });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toHaveProperty('isAcceptingClients');
  });
});

describe('DELETE /api/v1/admin/therapists/:id', () => {
  it('deactivates a therapist and returns 200', async () => {
    const res = await request(app)
      .delete('/api/v1/admin/therapists/therapist-1')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockTherapistRepo.deactivate).toHaveBeenCalledWith('therapist-1');
  });

  it('returns 400 when the owner attempts to deactivate their own account', async () => {
    const token = `Bearer ${issueAccessToken({ id: 'therapist-1', roles: ['owner'] })}`;

    const res = await request(app)
      .delete('/api/v1/admin/therapists/therapist-1')
      .set('Authorization', token);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(mockTherapistRepo.deactivate).not.toHaveBeenCalled();
  });

  it('returns 404 when therapist does not exist', async () => {
    mockTherapistRepo.deactivate.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/admin/therapists/nonexistent')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(404);
  });
});
