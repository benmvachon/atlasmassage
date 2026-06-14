import { jest } from '@jest/globals';

process.env.STRIPE_SECRET_KEY    = 'sk_test_fake_for_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_for_tests';

// Pool mock — exposes a query stub so service methods that call pool.query directly work.
const mockPool = { query: jest.fn().mockResolvedValue({ rows: [] }) };

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => mockPool),
  closePool: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/giftCardRepository.js', () => ({
  GiftCardRepository: jest.fn(),
}));

// PaymentService dependencies — not under test here, but required for the webhook path.
await jest.unstable_mockModule('../repositories/paymentRepository.js', () => ({
  PaymentRepository: jest.fn(),
}));
await jest.unstable_mockModule('../repositories/userRepository.js', () => ({
  UserRepository: jest.fn(),
}));
await jest.unstable_mockModule('../repositories/appointmentRepository.js', () => ({
  AppointmentRepository: jest.fn(),
}));
await jest.unstable_mockModule('../repositories/membershipRepository.js', () => ({
  MembershipRepository: jest.fn(),
}));

// Stripe mock
const mockStripe = {
  checkout: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
  setupIntents: { create: jest.fn() },
  paymentIntents: { create: jest.fn() },
  paymentMethods: { attach: jest.fn(), retrieve: jest.fn(), detach: jest.fn() },
  customers: { create: jest.fn(), update: jest.fn() },
};
await jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => mockStripe),
}));

// Email service — suppress real sends in tests
await jest.unstable_mockModule('../services/emailService.js', () => ({
  sendGiftCardEmail: jest.fn().mockResolvedValue(),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(),
  send: jest.fn().mockResolvedValue(),
}));

const { default: request } = await import('supertest');
const { default: app }     = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');
const { GiftCardRepository } = await import('../repositories/giftCardRepository.js');
const { PaymentRepository }   = await import('../repositories/paymentRepository.js');
const { UserRepository }      = await import('../repositories/userRepository.js');
const { AppointmentRepository } = await import('../repositories/appointmentRepository.js');
const { MembershipRepository }  = await import('../repositories/membershipRepository.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_ID  = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const CARD_ID   = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

const ownerBearer  = () => `Bearer ${issueAccessToken({ id: OWNER_ID,  roles: ['owner'] })}`;
const clientBearer = () => `Bearer ${issueAccessToken({ id: CLIENT_ID, roles: ['client'] })}`;

const CARD_FIXTURE = {
  id: CARD_ID,
  code: 'ABCD-EFGH-JKLM',
  original_amount_cents: 15000,
  remaining_balance_cents: 15000,
  purchaser_email: 'buyer@example.com',
  purchaser_name: 'Jane Buyer',
  recipient_email: null,
  recipient_name: null,
  message: null,
  stripe_checkout_session_id: null,
  status: 'active',
  expires_at: null,
  purchased_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

let mockGiftCardRepo;
let mockPaymentRepo;
let mockUserRepo;
let mockApptRepo;
let mockMembershipRepo;

beforeEach(() => {
  jest.clearAllMocks();

  mockGiftCardRepo = {
    create:                jest.fn().mockResolvedValue(CARD_FIXTURE),
    activate:              jest.fn().mockResolvedValue({ ...CARD_FIXTURE, status: 'active', purchased_at: new Date().toISOString() }),
    findByCode:            jest.fn().mockResolvedValue(CARD_FIXTURE),
    findById:              jest.fn().mockResolvedValue(CARD_FIXTURE),
    findByCheckoutSessionId: jest.fn().mockResolvedValue(CARD_FIXTURE),
    deductBalance:         jest.fn().mockResolvedValue({ updatedCard: CARD_FIXTURE, transaction: {} }),
    restoreForAppointment: jest.fn().mockResolvedValue(0),
    listAll:               jest.fn().mockResolvedValue([CARD_FIXTURE]),
    countAll:              jest.fn().mockResolvedValue(1),
  };

  mockPaymentRepo = {
    findPaymentMethodsByClient: jest.fn().mockResolvedValue([]),
    findPaymentMethodById:      jest.fn().mockResolvedValue(null),
    createPaymentMethod:        jest.fn().mockResolvedValue({}),
    setDefault:                 jest.fn().mockResolvedValue(),
    deletePaymentMethod:        jest.fn().mockResolvedValue(),
    createPayment:              jest.fn().mockResolvedValue({ id: 'pay-uuid', status: 'succeeded' }),
    updatePaymentStatus:        jest.fn().mockResolvedValue({}),
    findPaymentByStripeIntentId: jest.fn().mockResolvedValue(null),
    findPaymentsByAppointmentId: jest.fn().mockResolvedValue([]),
  };

  mockUserRepo = {
    findById:             jest.fn().mockResolvedValue({ id: CLIENT_ID, stripe_customer_id: null }),
    updateStripeCustomerId: jest.fn().mockResolvedValue(),
  };

  mockApptRepo = {
    findById:      jest.fn().mockResolvedValue(null),
    updateStatus:  jest.fn().mockResolvedValue({}),
  };

  mockMembershipRepo = {
    findMembershipByStripeSubscriptionId: jest.fn().mockResolvedValue(null),
  };

  GiftCardRepository.mockImplementation(() => mockGiftCardRepo);
  PaymentRepository.mockImplementation(() => mockPaymentRepo);
  UserRepository.mockImplementation(() => mockUserRepo);
  AppointmentRepository.mockImplementation(() => mockApptRepo);
  MembershipRepository.mockImplementation(() => mockMembershipRepo);

  mockPool.query.mockResolvedValue({ rows: [] });

  mockStripe.checkout.sessions.create.mockResolvedValue({
    id: 'cs_test_abc123',
    url: 'https://checkout.stripe.com/pay/cs_test_abc123',
  });
});

// ── POST /api/v1/gift-cards/purchase ─────────────────────────────────────────

describe('POST /api/v1/gift-cards/purchase', () => {
  it('returns 200 with a Stripe checkout URL for a valid request', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', purchaserName: 'Jane', amountCents: 15000 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBe('https://checkout.stripe.com/pay/cs_test_abc123');
    expect(mockGiftCardRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ purchaserEmail: 'buyer@example.com', originalAmountCents: 15000 })
    );
  });

  it('stores the checkout session ID after creating the Stripe session', async () => {
    await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', amountCents: 20000 });

    // The service calls pool.query to update stripe_checkout_session_id
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('stripe_checkout_session_id'),
      expect.arrayContaining(['cs_test_abc123'])
    );
  });

  it('supports optional recipient fields', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({
        purchaserEmail: 'buyer@example.com',
        amountCents: 20000,
        recipientEmail: 'friend@example.com',
        recipientName: 'Gift Friend',
        message: 'Enjoy your massage!',
      });

    expect(res.status).toBe(200);
    expect(mockGiftCardRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'friend@example.com',
        recipientName: 'Gift Friend',
        message: 'Enjoy your massage!',
      })
    );
  });

  it('returns 400 when purchaserEmail is missing', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ amountCents: 15000 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed purchaser email', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'not-an-email', amountCents: 15000 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed recipient email', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', amountCents: 15000, recipientEmail: 'nope' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amountCents is missing', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amountCents is below the $150 minimum', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', amountCents: 14999 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when amountCents exceeds the $500 maximum', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', amountCents: 50001 });

    expect(res.status).toBe(400);
  });

  it('accepts the minimum valid amount of $150 (15000 cents)', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', amountCents: 15000 });

    expect(res.status).toBe(200);
  });

  it('accepts the maximum valid amount of $500 (50000 cents)', async () => {
    const res = await request(app)
      .post('/api/v1/gift-cards/purchase')
      .send({ purchaserEmail: 'buyer@example.com', amountCents: 50000 });

    expect(res.status).toBe(200);
  });
});

// ── GET /api/v1/gift-cards/:code/validate ────────────────────────────────────

describe('GET /api/v1/gift-cards/:code/validate', () => {
  it('returns 200 with card data for a valid active code', async () => {
    const res = await request(app).get('/api/v1/gift-cards/ABCD-EFGH-JKLM/validate');

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe('ABCD-EFGH-JKLM');
    expect(res.body.data.remainingBalanceCents).toBe(15000);
    expect(res.body.data.originalAmountCents).toBe(15000);
  });

  it('returns 404 when the code does not exist', async () => {
    mockGiftCardRepo.findByCode.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/gift-cards/XXXX-XXXX-XXXX/validate');
    expect(res.status).toBe(404);
  });

  it('returns 400 for an exhausted gift card', async () => {
    mockGiftCardRepo.findByCode.mockResolvedValue({ ...CARD_FIXTURE, status: 'exhausted', remaining_balance_cents: 0 });

    const res = await request(app).get('/api/v1/gift-cards/ABCD-EFGH-JKLM/validate');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXHAUSTED');
  });

  it('returns 400 for a pending (not yet activated) card', async () => {
    mockGiftCardRepo.findByCode.mockResolvedValue({ ...CARD_FIXTURE, status: 'pending' });

    const res = await request(app).get('/api/v1/gift-cards/ABCD-EFGH-JKLM/validate');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_ACTIVE');
  });

  it('returns 400 for an expired gift card', async () => {
    mockGiftCardRepo.findByCode.mockResolvedValue({ ...CARD_FIXTURE, status: 'expired' });

    const res = await request(app).get('/api/v1/gift-cards/ABCD-EFGH-JKLM/validate');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXPIRED');
  });

  it('returns 400 for a code that does not match the XXXX-XXXX-XXXX format', async () => {
    const res = await request(app).get('/api/v1/gift-cards/BADCODE/validate');
    expect(res.status).toBe(400);
  });

  it('normalises the code to uppercase before lookup', async () => {
    await request(app).get('/api/v1/gift-cards/abcd-efgh-jklm/validate');
    expect(mockGiftCardRepo.findByCode).toHaveBeenCalledWith('ABCD-EFGH-JKLM');
  });
});

// ── GET /api/v1/gift-cards (owner list) ──────────────────────────────────────

describe('GET /api/v1/gift-cards', () => {
  it('returns 200 with card list for an owner', async () => {
    const res = await request(app)
      .get('/api/v1/gift-cards')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.cards).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.page).toBe(1);
  });

  it('returns 403 for a non-owner authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/gift-cards')
      .set('Authorization', clientBearer());

    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/gift-cards');
    expect(res.status).toBe(401);
  });

  it('respects page and limit query params', async () => {
    mockGiftCardRepo.countAll.mockResolvedValue(30);
    mockGiftCardRepo.listAll.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/gift-cards?page=3&limit=10')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(3);
    expect(res.body.data.limit).toBe(10);
    expect(res.body.data.total).toBe(30);
    expect(mockGiftCardRepo.listAll).toHaveBeenCalledWith({ limit: 10, offset: 20 });
  });

  it('clamps limit to 100 when a larger value is requested', async () => {
    await request(app)
      .get('/api/v1/gift-cards?limit=999')
      .set('Authorization', ownerBearer());

    expect(mockGiftCardRepo.listAll).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });
});

// ── Webhook: checkout.session.completed ──────────────────────────────────────

describe('POST /api/v1/payments/webhook (gift card checkout.session.completed)', () => {
  it('activates a pending gift card when payment_status is paid', async () => {
    const pendingCard = { ...CARD_FIXTURE, status: 'pending' };
    mockGiftCardRepo.findById.mockResolvedValue(pendingCard);
    mockGiftCardRepo.activate.mockResolvedValue({ ...CARD_FIXTURE, status: 'active', purchased_at: new Date().toISOString() });

    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          metadata: { type: 'gift_card', giftCardId: CARD_ID },
        },
      },
    });

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(res.body.data.received).toBe(true);
    expect(mockGiftCardRepo.activate).toHaveBeenCalledWith(CARD_ID);
  });

  it('skips activation when payment_status is not paid', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'unpaid',
          metadata: { type: 'gift_card', giftCardId: CARD_ID },
        },
      },
    });

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(mockGiftCardRepo.activate).not.toHaveBeenCalled();
  });

  it('ignores checkout sessions without gift_card metadata type', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          metadata: { type: 'other_product' },
        },
      },
    });

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(mockGiftCardRepo.activate).not.toHaveBeenCalled();
  });

  it('is idempotent — skips re-activation for an already active card', async () => {
    // Card is already active (not pending)
    mockGiftCardRepo.findById.mockResolvedValue({ ...CARD_FIXTURE, status: 'active' });

    mockStripe.webhooks.constructEvent.mockReturnValueOnce({
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          metadata: { type: 'gift_card', giftCardId: CARD_ID },
        },
      },
    });

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'valid_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));

    expect(res.status).toBe(200);
    expect(mockGiftCardRepo.activate).not.toHaveBeenCalled();
  });

  it('returns 400 when the webhook signature is invalid', async () => {
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
});
