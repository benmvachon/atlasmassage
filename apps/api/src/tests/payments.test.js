import { jest } from '@jest/globals';

// Set fake Stripe keys so getStripe() proceeds past the config guard.
// The Stripe module itself is mocked below so no real API calls are made.
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_for_tests';

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/paymentRepository.js', () => ({
  PaymentRepository: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/userRepository.js', () => ({
  UserRepository: jest.fn(),
}));

// Mock Stripe to avoid real API calls in tests
const mockStripe = {
  setupIntents: { create: jest.fn() },
  paymentIntents: { create: jest.fn() },
  paymentMethods: { attach: jest.fn(), retrieve: jest.fn(), detach: jest.fn() },
  customers: { create: jest.fn(), update: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

await jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => mockStripe),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');
const { PaymentRepository } = await import('../repositories/paymentRepository.js');
const { UserRepository } = await import('../repositories/userRepository.js');

const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PM_DB_ID  = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';

const clientBearer = (id = CLIENT_ID) =>
  `Bearer ${issueAccessToken({ id, roles: ['client'] })}`;

const PM_FIXTURE = {
  id: PM_DB_ID,
  client_id: CLIENT_ID,
  stripe_payment_method_id: 'pm_test_123',
  brand: 'visa',
  last4: '4242',
  expiry_month: 12,
  expiry_year: 2027,
  is_default: true,
  created_at: '2024-01-01T00:00:00Z',
};

const USER_FIXTURE = {
  id: CLIENT_ID,
  email: 'client@example.com',
  first_name: 'Jamie',
  last_name: 'Torres',
  stripe_customer_id: 'cus_test_123',
  roles: ['client'],
};

let mockPaymentRepo, mockUserRepo;

beforeEach(() => {
  jest.clearAllMocks();

  mockPaymentRepo = {
    findPaymentMethodsByClient: jest.fn().mockResolvedValue([PM_FIXTURE]),
    findPaymentMethodById: jest.fn().mockResolvedValue(PM_FIXTURE),
    createPaymentMethod: jest.fn().mockResolvedValue(PM_FIXTURE),
    setDefault: jest.fn().mockResolvedValue(),
    deletePaymentMethod: jest.fn().mockResolvedValue(),
    createPayment: jest.fn().mockResolvedValue({ id: 'pay-uuid', status: 'pending' }),
    updatePaymentStatus: jest.fn().mockResolvedValue({ id: 'pay-uuid', status: 'succeeded' }),
    findPaymentByStripeIntentId: jest.fn().mockResolvedValue(null),
  };

  mockUserRepo = {
    findById: jest.fn().mockResolvedValue(USER_FIXTURE),
    updateStripeCustomerId: jest.fn().mockResolvedValue(),
  };

  PaymentRepository.mockImplementation(() => mockPaymentRepo);
  UserRepository.mockImplementation(() => mockUserRepo);

  mockStripe.setupIntents.create.mockResolvedValue({ client_secret: 'seti_secret_xyz' });
  mockStripe.paymentIntents.create.mockResolvedValue({
    id: 'pi_test_123',
    client_secret: 'pi_secret_xyz',
  });
  mockStripe.paymentMethods.attach.mockResolvedValue({});
  mockStripe.paymentMethods.retrieve.mockResolvedValue({
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027 },
  });
  mockStripe.paymentMethods.detach.mockResolvedValue({});
  mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
  mockStripe.customers.update.mockResolvedValue({});
});

// ── Setup Intent ───────────────────────────────────────────────────────────────

describe('POST /api/v1/payments/setup-intent', () => {
  it('returns a client secret for authenticated users', async () => {
    const res = await request(app)
      .post('/api/v1/payments/setup-intent')
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.clientSecret).toBe('seti_secret_xyz');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/payments/setup-intent');
    expect(res.status).toBe(401);
  });
});

// ── Payment Methods ────────────────────────────────────────────────────────────

describe('GET /api/v1/payments/methods', () => {
  it('returns payment methods for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/payments/methods')
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.methods).toHaveLength(1);
    expect(res.body.data.methods[0].last4).toBe('4242');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/payments/methods');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/payments/methods', () => {
  it('adds a payment method and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/payments/methods')
      .set('Authorization', clientBearer())
      .send({ stripePaymentMethodId: 'pm_test_new' });

    expect(res.status).toBe(201);
    expect(res.body.data.method.last4).toBe('4242');
  });

  it('returns 422 when stripePaymentMethodId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payments/methods')
      .set('Authorization', clientBearer())
      .send({});

    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/payments/methods/:id', () => {
  it('removes a payment method', async () => {
    const res = await request(app)
      .delete(`/api/v1/payments/methods/${PM_DB_ID}`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(mockPaymentRepo.deletePaymentMethod).toHaveBeenCalledWith(PM_DB_ID);
  });

  it('returns 404 for a method belonging to another user', async () => {
    mockPaymentRepo.findPaymentMethodById.mockResolvedValue({ ...PM_FIXTURE, client_id: 'other-user' });

    const res = await request(app)
      .delete(`/api/v1/payments/methods/${PM_DB_ID}`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/payments/methods/:id/default', () => {
  it('sets a payment method as default', async () => {
    const res = await request(app)
      .put(`/api/v1/payments/methods/${PM_DB_ID}/default`)
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(mockPaymentRepo.setDefault).toHaveBeenCalledWith(PM_DB_ID, CLIENT_ID);
  });
});

// ── Payment Intents ────────────────────────────────────────────────────────────

describe('POST /api/v1/payments/intents', () => {
  it('creates a payment intent', async () => {
    const res = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', clientBearer())
      .send({ amountCents: 9000, currency: 'usd', paymentMethodId: PM_DB_ID });

    expect(res.status).toBe(200);
    expect(res.body.data.clientSecret).toBe('pi_secret_xyz');
  });

  it('returns 422 when amountCents is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', clientBearer())
      .send({ currency: 'usd' });

    expect(res.status).toBe(422);
  });
});

// ── Webhook ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/payments/webhook', () => {
  it('returns 400 when webhook signature is invalid', async () => {
    mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error('Webhook signature verification failed');
    });

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'bad_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
  });

  it('returns 200 for a valid payment_intent.succeeded event', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_123' } },
    });

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'payment_intent.succeeded' })));

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
  });
});
