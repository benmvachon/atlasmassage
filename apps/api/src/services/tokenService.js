import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_MS = 60 * 60 * 1000;

export function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, roles: user.roles ?? [] },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

export function generateRefreshToken() {
  const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);
  return { raw, hash, expiresAt };
}

export function generateResetToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MS);
  return { raw, hash, expiresAt };
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
