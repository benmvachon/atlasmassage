import { jest } from '@jest/globals';

// unstable_mockModule must come before any dynamic imports of the modules under test
await jest.unstable_mockModule('../services/authService.js', () => ({
  AuthService: jest.fn(),
}));

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { AuthService } = await import('../services/authService.js');
const { AppError } = await import('../middleware/errorHandler.js');

const MOCK_USER = {
  id: 'uuid-1',
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  roles: ['client'],
};
const MOCK_ACCESS = 'mock.access.token';
const MOCK_REFRESH = 'mock-raw-refresh-token';

let mockService;

beforeEach(() => {
  jest.clearAllMocks();
  mockService = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };
  AuthService.mockImplementation(() => mockService);
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with user and access token on success', async () => {
    mockService.register.mockResolvedValue({
      user: MOCK_USER,
      accessToken: MOCK_ACCESS,
      refreshToken: MOCK_REFRESH,
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'jane@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe(MOCK_ACCESS);
    expect(res.body.data.user.email).toBe('jane@example.com');
    // Refresh token must not be in the response body — it lives in the HttpOnly cookie
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 422 when required fields are missing or invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });

  it('returns 409 when email already exists', async () => {
    mockService.register.mockRejectedValue(new AppError('Email already exists', 409, 'CONFLICT'));

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'jane@example.com', password: 'password123', firstName: 'Jane', lastName: 'Doe' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with access token on valid credentials', async () => {
    mockService.login.mockResolvedValue({
      user: MOCK_USER,
      accessToken: MOCK_ACCESS,
      refreshToken: MOCK_REFRESH,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe(MOCK_ACCESS);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on invalid credentials', async () => {
    mockService.login.mockRejectedValue(
      new AppError('Invalid email or password', 401, 'UNAUTHORIZED')
    );

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'jane@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 for a malformed email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(422);
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 and clears the refresh cookie', async () => {
    mockService.logout.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'atlas_refresh=some-token');

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('Logged out');
    const cookies = res.headers['set-cookie'] ?? [];
    expect(
      cookies.some(c => c.includes('atlas_refresh=;') || c.includes('Expires=Thu, 01 Jan 1970'))
    ).toBe(true);
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('returns 200 with a new access token when the refresh cookie is valid', async () => {
    mockService.refresh.mockResolvedValue({
      user: MOCK_USER,
      accessToken: 'new.access.token',
      refreshToken: 'new-refresh-token',
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'atlas_refresh=old-token');

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new.access.token');
  });

  it('returns 401 when no refresh token is provided', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 401 when refresh token is expired or invalid', async () => {
    mockService.refresh.mockRejectedValue(
      new AppError('Refresh token is invalid or has expired', 401, 'UNAUTHORIZED')
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'atlas_refresh=bad-token');

    expect(res.status).toBe(401);
  });
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  it('always returns 200 regardless of whether the email exists', async () => {
    mockService.forgotPassword.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'anyone@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/reset link/i);
  });

  it('returns 422 for an invalid email address', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

describe('POST /api/v1/auth/reset-password', () => {
  it('returns 200 on a valid token and password', async () => {
    mockService.resetPassword.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'valid-token-abc', password: 'newpassword1' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/password updated/i);
  });

  it('returns 400 on an expired or invalid reset token', async () => {
    mockService.resetPassword.mockRejectedValue(
      new AppError('Password reset token is invalid or has expired', 400, 'INVALID_TOKEN')
    );

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'expired-token', password: 'newpassword1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 422 when the new password is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'valid-token', password: 'short' });
    expect(res.status).toBe(422);
  });
});
