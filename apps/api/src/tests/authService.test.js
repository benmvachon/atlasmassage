import { jest } from '@jest/globals';

const mockUserRepo = {};
const mockRefreshTokenRepo = {};
const mockBcrypt = { hash: jest.fn(), compare: jest.fn() };

await jest.unstable_mockModule('../repositories/userRepository.js', () => ({
  UserRepository: jest.fn(() => mockUserRepo),
}));

await jest.unstable_mockModule('../repositories/refreshTokenRepository.js', () => ({
  RefreshTokenRepository: jest.fn(() => mockRefreshTokenRepo),
}));

await jest.unstable_mockModule('bcrypt', () => ({ default: mockBcrypt }));

await jest.unstable_mockModule('../services/tokenService.js', () => ({
  issueAccessToken: jest.fn(() => 'access-token'),
  generateRefreshToken: jest.fn(() => ({ raw: 'raw-refresh', hash: 'hashed-refresh', expiresAt: new Date(Date.now() + 30 * 86400000) })),
  generateResetToken: jest.fn(() => ({ raw: 'raw-reset', hash: 'hashed-reset', expiresAt: new Date(Date.now() + 3600000) })),
  hashToken: jest.fn(t => `hash:${t}`),
}));

await jest.unstable_mockModule('../services/emailService.js', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const { AuthService } = await import('../services/authService.js');
const { sendPasswordResetEmail } = await import('../services/emailService.js');

const USER = {
  id: 'user-uuid',
  email: 'test@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  phone: null,
  is_active: true,
  roles: ['client'],
  password_hash: '$2b$12$hashed',
  password_reset_token_hash: null,
  password_reset_expires_at: null,
};

let service;

beforeEach(() => {
  jest.clearAllMocks();

  Object.assign(mockUserRepo, {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(USER),
    findByResetToken: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ ...USER }),
    setResetToken: jest.fn().mockResolvedValue(),
    clearResetToken: jest.fn().mockResolvedValue(),
    updatePasswordHash: jest.fn().mockResolvedValue(),
  });

  Object.assign(mockRefreshTokenRepo, {
    create: jest.fn().mockResolvedValue({ id: 'rt-uuid' }),
    findByHash: jest.fn().mockResolvedValue(null),
    revoke: jest.fn().mockResolvedValue(),
    revokeAllForUser: jest.fn().mockResolvedValue(),
  });

  mockBcrypt.hash.mockResolvedValue('$2b$12$newhash');
  mockBcrypt.compare.mockResolvedValue(true);

  service = new AuthService({});
});

// ── register ──────────────────────────────────────────────────────────────────

describe('AuthService.register', () => {
  it('creates user and returns tokens when email is new', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    const result = await service.register({
      email: 'new@example.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(mockUserRepo.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('raw-refresh');
    expect(result.user.password_hash).toBeUndefined();
  });

  it('throws 409 when email already exists', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(USER);
    await expect(service.register({
      email: 'test@example.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    })).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  it('returns tokens for valid credentials', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(USER);
    mockBcrypt.compare.mockResolvedValue(true);
    const result = await service.login({ email: 'test@example.com', password: 'Password1' });
    expect(result.accessToken).toBe('access-token');
  });

  it('throws 401 when user does not exist', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(service.login({ email: 'nobody@example.com', password: 'x' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when password is wrong', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(USER);
    mockBcrypt.compare.mockResolvedValue(false);
    await expect(service.login({ email: 'test@example.com', password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 403 when account is deactivated', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ ...USER, is_active: false });
    mockBcrypt.compare.mockResolvedValue(true);
    await expect(service.login({ email: 'test@example.com', password: 'Password1' }))
      .rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('AuthService.logout', () => {
  it('revokes the refresh token when it exists and is not revoked', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue({ id: 'rt-uuid', revoked_at: null });
    await service.logout('raw-refresh-token');
    expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith('rt-uuid');
  });

  it('does nothing when no refresh token is provided', async () => {
    await service.logout(null);
    expect(mockRefreshTokenRepo.findByHash).not.toHaveBeenCalled();
  });

  it('does nothing when token is already revoked', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue({ id: 'rt-uuid', revoked_at: new Date() });
    await service.logout('raw-refresh-token');
    expect(mockRefreshTokenRepo.revoke).not.toHaveBeenCalled();
  });

  it('does nothing when token is not found', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue(null);
    await service.logout('unknown-token');
    expect(mockRefreshTokenRepo.revoke).not.toHaveBeenCalled();
  });
});

// ── refresh ───────────────────────────────────────────────────────────────────

describe('AuthService.refresh', () => {
  const validToken = {
    id: 'rt-uuid',
    user_id: 'user-uuid',
    revoked_at: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };

  it('rotates the refresh token and returns a new pair', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue(validToken);
    mockUserRepo.findById.mockResolvedValue(USER);
    const result = await service.refresh('raw-refresh-token');
    expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith('rt-uuid');
    expect(mockRefreshTokenRepo.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('access-token');
  });

  it('throws 401 when token not found', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue(null);
    await expect(service.refresh('bad-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when token is revoked', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue({ ...validToken, revoked_at: new Date() });
    await expect(service.refresh('revoked-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when token is expired', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue({
      ...validToken,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(service.refresh('expired-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when user is deactivated after token refresh', async () => {
    mockRefreshTokenRepo.findByHash.mockResolvedValue(validToken);
    mockUserRepo.findById.mockResolvedValue({ ...USER, is_active: false });
    await expect(service.refresh('raw-refresh-token')).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── forgotPassword ────────────────────────────────────────────────────────────

describe('AuthService.forgotPassword', () => {
  it('sets reset token and sends email when user exists', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(USER);
    await service.forgotPassword('test@example.com');
    expect(mockUserRepo.setResetToken).toHaveBeenCalledWith('user-uuid', 'hashed-reset', expect.any(Date));
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      firstName: 'Jane',
      token: 'raw-reset',
    });
  });

  it('returns without error when user does not exist (no email enumeration)', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);
    await expect(service.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('AuthService.resetPassword', () => {
  const userWithToken = {
    ...USER,
    password_reset_expires_at: new Date(Date.now() + 3600000).toISOString(),
  };

  it('updates password hash and clears token on valid reset', async () => {
    mockUserRepo.findByResetToken.mockResolvedValue(userWithToken);
    await service.resetPassword({ token: 'raw-reset', password: 'NewPassword1' });
    expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith('user-uuid', '$2b$12$newhash');
    expect(mockUserRepo.clearResetToken).toHaveBeenCalledWith('user-uuid');
    expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-uuid');
  });

  it('throws 400 when reset token is not found', async () => {
    mockUserRepo.findByResetToken.mockResolvedValue(null);
    await expect(service.resetPassword({ token: 'bad', password: 'NewPassword1' }))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_TOKEN' });
  });

  it('throws 400 when reset token is expired', async () => {
    mockUserRepo.findByResetToken.mockResolvedValue({
      ...userWithToken,
      password_reset_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(service.resetPassword({ token: 'expired', password: 'NewPassword1' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
