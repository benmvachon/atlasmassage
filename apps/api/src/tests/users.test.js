import { jest } from '@jest/globals';

// Shared instances captured by reference — the factory closures keep them live.
const mockUserRepoInstance = {};
const bcryptMock = {
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$2b$12$hashed'),
};

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/userRepository.js', () => ({
  UserRepository: jest.fn(() => mockUserRepoInstance),
}));

await jest.unstable_mockModule('bcrypt', () => ({
  default: bcryptMock,
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');

const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const clientBearer = () => `Bearer ${issueAccessToken({ id: CLIENT_ID, roles: ['client'] })}`;

const USER_FIXTURE = {
  id: CLIENT_ID,
  email: 'client@example.com',
  first_name: 'Jamie',
  last_name: 'Torres',
  phone: null,
  is_active: true,
  roles: ['client'],
  password_hash: '$2b$12$real_hash',
  password_reset_token_hash: null,
  password_reset_expires_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockUserRepoInstance, {
    findById: jest.fn().mockResolvedValue(USER_FIXTURE),
    update: jest.fn().mockResolvedValue({ ...USER_FIXTURE, first_name: 'Jay' }),
    updatePasswordHash: jest.fn().mockResolvedValue(),
  });
});

// ── GET /users/me ──────────────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  it('returns the authenticated user without sensitive fields', async () => {
    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', clientBearer());

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('client@example.com');
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.user.password_reset_token_hash).toBeUndefined();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});

// ── PUT /users/me ──────────────────────────────────────────────────────────────

describe('PUT /api/v1/users/me', () => {
  it('updates profile fields', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', clientBearer())
      .send({ firstName: 'Jay' });

    expect(res.status).toBe(200);
    expect(mockUserRepoInstance.update).toHaveBeenCalledWith(CLIENT_ID, expect.objectContaining({
      firstName: 'Jay',
      lastName: undefined,
      phone: undefined,
    }));
  });

  it('saves address fields when provided', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', clientBearer())
      .send({
        addressLine1: '42 Elm St',
        addressLine2: 'Apt 3',
        city: 'Newton',
        state: 'MA',
        zip: '02458',
      });

    expect(res.status).toBe(200);
    expect(mockUserRepoInstance.update).toHaveBeenCalledWith(CLIENT_ID, expect.objectContaining({
      addressLine1: '42 Elm St',
      addressLine2: 'Apt 3',
      city: 'Newton',
      state: 'MA',
      zip: '02458',
    }));
  });

  it('returns 422 when firstName is blank', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', clientBearer())
      .send({ firstName: '' });

    expect(res.status).toBe(422);
  });

  it('returns 422 when state is longer than 2 characters', async () => {
    const res = await request(app)
      .put('/api/v1/users/me')
      .set('Authorization', clientBearer())
      .send({ state: 'Massachusetts' });

    expect(res.status).toBe(422);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).put('/api/v1/users/me').send({ firstName: 'Jay' });
    expect(res.status).toBe(401);
  });
});

// ── PUT /users/me/password ─────────────────────────────────────────────────────

describe('PUT /api/v1/users/me/password', () => {
  it('changes the password when current password is correct', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/password')
      .set('Authorization', clientBearer())
      .send({ currentPassword: 'OldPass123', newPassword: 'NewPass456' });

    expect(res.status).toBe(200);
    expect(mockUserRepoInstance.updatePasswordHash).toHaveBeenCalledWith(CLIENT_ID, '$2b$12$hashed');
  });

  it('returns 400 when current password is incorrect', async () => {
    bcryptMock.compare.mockResolvedValueOnce(false);

    const res = await request(app)
      .put('/api/v1/users/me/password')
      .set('Authorization', clientBearer())
      .send({ currentPassword: 'wrong', newPassword: 'NewPass456' });

    expect(res.status).toBe(400);
  });

  it('returns 422 when newPassword is too short', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/password')
      .set('Authorization', clientBearer())
      .send({ currentPassword: 'OldPass123', newPassword: 'short' });

    expect(res.status).toBe(422);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .put('/api/v1/users/me/password')
      .send({ currentPassword: 'old', newPassword: 'NewPass456' });

    expect(res.status).toBe(401);
  });
});
