import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/userRepository.js';
import { RefreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import {
  issueAccessToken,
  generateRefreshToken,
  generateResetToken,
  hashToken,
} from './tokenService.js';
import { sendPasswordResetEmail } from './emailService.js';
import { AppError } from '../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 12;

// Used in login to prevent timing-based email enumeration.
// bcrypt.compare returns false (not throws) for a malformed hash.
const DUMMY_HASH = '$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export class AuthService {
  constructor(pool) {
    this.users = new UserRepository(pool);
    this.refreshTokens = new RefreshTokenRepository(pool);
  }

  async register({ email, password, firstName, lastName, phone }) {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone,
    });

    return this._buildTokenPair(user);
  }

  async login({ email, password }) {
    const user = await this.users.findByEmail(email);

    // Always run bcrypt regardless of whether the user exists — prevents timing attacks
    const hash = user?.password_hash ?? DUMMY_HASH;
    const passwordValid = await bcrypt.compare(password, hash);

    if (!user || !passwordValid) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED');
    }
    if (!user.is_active) {
      throw new AppError('Account is deactivated', 403, 'FORBIDDEN');
    }

    return this._buildTokenPair(user);
  }

  // Logout identifies the session by the refresh token, not the access token,
  // so it works even after the access token has expired.
  async logout(rawRefreshToken) {
    if (!rawRefreshToken) return;
    const hash = hashToken(rawRefreshToken);
    const stored = await this.refreshTokens.findByHash(hash);
    if (stored && !stored.revoked_at) {
      await this.refreshTokens.revoke(stored.id);
    }
  }

  async refresh(rawRefreshToken) {
    const hash = hashToken(rawRefreshToken);
    const stored = await this.refreshTokens.findByHash(hash);

    const isValid =
      stored && !stored.revoked_at && new Date(stored.expires_at) > new Date();

    if (!isValid) {
      throw new AppError('Refresh token is invalid or has expired', 401, 'UNAUTHORIZED');
    }

    // Rotate: revoke the used token and issue a fresh pair
    await this.refreshTokens.revoke(stored.id);
    const user = await this.users.findById(stored.user_id);

    if (!user || !user.is_active) {
      throw new AppError('Account not found or deactivated', 401, 'UNAUTHORIZED');
    }

    return this._buildTokenPair(user);
  }

  async forgotPassword(email) {
    const user = await this.users.findByEmail(email);
    // Always return success — don't reveal whether the email exists
    if (!user) return;

    const { raw, hash, expiresAt } = generateResetToken();
    await this.users.setResetToken(user.id, hash, expiresAt);
    await sendPasswordResetEmail({ to: user.email, firstName: user.first_name, token: raw });
  }

  async resetPassword({ token: rawToken, password }) {
    const hash = hashToken(rawToken);
    const user = await this.users.findByResetToken(hash);

    const tokenValid =
      user &&
      user.password_reset_expires_at &&
      new Date(user.password_reset_expires_at) > new Date();

    if (!tokenValid) {
      throw new AppError('Password reset token is invalid or has expired', 400, 'INVALID_TOKEN');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.users.updatePasswordHash(user.id, passwordHash);
    await this.users.clearResetToken(user.id);
    // Force all existing sessions to re-authenticate
    await this.refreshTokens.revokeAllForUser(user.id);
  }

  async _buildTokenPair(user) {
    const accessToken = issueAccessToken(user);
    const { raw: refreshToken, hash, expiresAt } = generateRefreshToken();

    await this.refreshTokens.create({ userId: user.id, tokenHash: hash, expiresAt });

    return { user: sanitizeUser(user), accessToken, refreshToken };
  }
}

function sanitizeUser(user) {
  const {
    password_hash,
    password_reset_token_hash,
    password_reset_expires_at,
    ...safe
  } = user;
  return safe;
}
