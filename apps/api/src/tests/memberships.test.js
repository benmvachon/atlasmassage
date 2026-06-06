import { jest } from '@jest/globals';

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/membershipRepository.js', () => ({
  MembershipRepository: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/userRepository.js', () => ({
  UserRepository: jest.fn(),
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
const { MembershipRepository } = await import('../repositories/membershipRepository.js');
const { UserRepository } = await import('../repositories/userRepository.js');

const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER_ID  = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const PLAN_ID   = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const MEM_ID    = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

const clientBearer = () => `Bearer ${issueAccessToken({ id: CLIENT_ID, roles: ['client'] })}`;
const ownerBearer  = () => `Bearer ${issueAccessToken({ id: OWNER_ID,  roles: ['owner'] })}`;

const PLAN_FIXTURE = {
  id: PLAN_ID,
  name: 'Wellness',
  description: 'Two massages per month.',
  price_monthly_cents: 13900,
  credits_per_month: 2,
  stripe_price_id: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const MEMBERSHIP_FIXTURE = {
  id: MEM_ID,
  client_id: CLIENT_ID,
  plan_id: PLAN_ID,
  plan_name: 'Wellness',
  price_monthly_cents: 13900,
  credits_per_month: 2,
  status: 'active',
  start_date: '2024-01-01',
  end_date: null,
  credits_remaining: 2,
  stripe_subscription_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

let mockMembershipRepo, mockUserRepo;

beforeEach(() => {
  jest.clearAllMocks();

  mockMembershipRepo = {
    findActivePlans: jest.fn().mockResolvedValue([PLAN_FIXTURE]),
    findPlanById: jest.fn().mockResolvedValue(PLAN_FIXTURE),
    createPlan: jest.fn().mockResolvedValue(PLAN_FIXTURE),
    updatePlan: jest.fn().mockResolvedValue({ ...PLAN_FIXTURE, is_active: false }),
    findMembershipsByClient: jest.fn().mockResolvedValue([MEMBERSHIP_FIXTURE]),
    findActiveMembershipByClient: jest.fn().mockResolvedValue(null),
    findMembershipById: jest.fn().mockResolvedValue(MEMBERSHIP_FIXTURE),
    createMembership: jest.fn().mockResolvedValue(MEMBERSHIP_FIXTURE),
    updateMembership: jest.fn().mockResolvedValue({ ...MEMBERSHIP_FIXTURE, status: 'cancelled' }),
  };

  mockUserRepo = {
    findById: jest.fn().mockResolvedValue({ id: 'client-uuid', stripe_customer_id: null }),
    updateStripeCustomerId: jest.fn().mockResolvedValue(),
  };

  MembershipRepository.mockImplementation(() => mockMembershipRepo);
  UserRepository.mockImplementation(() => mockUserRepo);
});

// ── Plans ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/memberships/plans', () => {
  it('returns active plans publicly', async () => {
    const res = await request(app).get('/api/v1/memberships/plans');
    expect(res.status).toBe(200);
    expect(res.body.data.plans).toHaveLength(1);
    expect(res.body.data.plans[0].name).toBe('Wellness');
  });
});

describe('GET /api/v1/memberships/plans/:id', () => {
  it('returns a single plan', async () => {
    const res = await request(app).get(`/api/v1/memberships/plans/${PLAN_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.plan.id).toBe(PLAN_ID);
  });

  it('returns 404 for a missing plan', async () => {
    mockMembershipRepo.findPlanById.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/memberships/plans/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/memberships/plans', () => {
  it('allows owner to create a plan', async () => {
    const res = await request(app)
      .post('/api/v1/memberships/plans')
      .set('Authorization', ownerBearer())
      .send({ name: 'New Plan', priceMonthlyCents: 9900, creditsPerMonth: 1 });

    expect(res.status).toBe(201);
    expect(mockMembershipRepo.createPlan).toHaveBeenCalled();
  });

  it('returns 403 for non-owner', async () => {
    const res = await request(app)
      .post('/api/v1/memberships/plans')
      .set('Authorization', clientBearer())
      .send({ name: 'Plan', priceMonthlyCents: 9900, creditsPerMonth: 1 });

    expect(res.status).toBe(403);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/memberships/plans')
      .set('Authorization', ownerBearer())
      .send({ name: 'No Price' });

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/v1/memberships/plans/:id', () => {
  it('allows owner to update a plan', async () => {
    const res = await request(app)
      .put(`/api/v1/memberships/plans/${PLAN_ID}`)
      .set('Authorization', ownerBearer())
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(mockMembershipRepo.updatePlan).toHaveBeenCalled();
  });
});

// ── Memberships ────────────────────────────────────────────────────────────────

describe('GET /api/v1/memberships', () => {
  it('returns memberships for authenticated client', async () => {
    const res = await request(app)
      .get('/api/v1/memberships')
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.memberships).toHaveLength(1);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/memberships');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/memberships', () => {
  it('subscribes an authenticated client to a plan', async () => {
    const res = await request(app)
      .post('/api/v1/memberships')
      .set('Authorization', clientBearer())
      .send({ planId: PLAN_ID });

    expect(res.status).toBe(201);
    expect(mockMembershipRepo.createMembership).toHaveBeenCalled();
  });

  it('returns 409 when client already has an active membership', async () => {
    mockMembershipRepo.findActiveMembershipByClient.mockResolvedValue(MEMBERSHIP_FIXTURE);

    const res = await request(app)
      .post('/api/v1/memberships')
      .set('Authorization', clientBearer())
      .send({ planId: PLAN_ID });

    expect(res.status).toBe(409);
  });

  it('returns 422 when planId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/memberships')
      .set('Authorization', clientBearer())
      .send({});

    expect(res.status).toBe(422);
  });

  it('returns 403 for non-client roles', async () => {
    const res = await request(app)
      .post('/api/v1/memberships')
      .set('Authorization', ownerBearer())
      .send({ planId: PLAN_ID });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/memberships/:id', () => {
  it('returns a membership by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/memberships/${MEM_ID}`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.membership.id).toBe(MEM_ID);
  });
});

describe('POST /api/v1/memberships/:id/cancel', () => {
  it('cancels an active membership', async () => {
    const res = await request(app)
      .post(`/api/v1/memberships/${MEM_ID}/cancel`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(mockMembershipRepo.updateMembership).toHaveBeenCalledWith(MEM_ID, {
      status: 'cancelled',
      endDate: expect.any(String),
    });
  });

  it('returns 400 when membership is already cancelled', async () => {
    mockMembershipRepo.findMembershipById.mockResolvedValue({ ...MEMBERSHIP_FIXTURE, status: 'cancelled' });

    const res = await request(app)
      .post(`/api/v1/memberships/${MEM_ID}/cancel`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(400);
  });

  it('returns 403 when user does not own the membership', async () => {
    mockMembershipRepo.findMembershipById.mockResolvedValue({ ...MEMBERSHIP_FIXTURE, client_id: 'other-user' });

    const res = await request(app)
      .post(`/api/v1/memberships/${MEM_ID}/cancel`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/memberships/:id/pause', () => {
  it('allows owner to pause a membership', async () => {
    mockMembershipRepo.updateMembership.mockResolvedValue({ ...MEMBERSHIP_FIXTURE, status: 'paused' });

    const res = await request(app)
      .post(`/api/v1/memberships/${MEM_ID}/pause`)
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
  });

  it('returns 403 for non-owner', async () => {
    const res = await request(app)
      .post(`/api/v1/memberships/${MEM_ID}/pause`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(403);
  });
});
