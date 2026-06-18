import bcrypt from 'bcrypt';
import { getPool } from '../database/pool.js';
import { UserRepository } from '../repositories/userRepository.js';
import { AppError } from '../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 12;

function sanitize(user) {
  const { password_hash, password_reset_token_hash, password_reset_expires_at, ...safe } = user;
  return safe;
}

function repo() {
  return new UserRepository(getPool());
}

export async function getMe(req, res, next) {
  try {
    const user = await repo().findById(req.user.sub);
    if (!user) return next(new AppError('User not found', 404, 'NOT_FOUND'));
    res.json({ success: true, data: { user: sanitize(user) } });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const { firstName, lastName, phone, addressLine1, addressLine2, city, state, zip } = req.body;
    const user = await repo().update(req.user.sub, { firstName, lastName, phone, addressLine1, addressLine2, city, state, zip });
    res.json({ success: true, data: { user: sanitize(user) } });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const r = repo();
    const user = await r.findById(req.user.sub);
    if (!user) return next(new AppError('User not found', 404, 'NOT_FOUND'));

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await r.updatePasswordHash(user.id, hash);
    res.json({ success: true, data: { message: 'Password updated' } });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(_req, res, next) {
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));
}

export async function getUser(_req, res, next) {
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));
}

export async function updateUser(_req, res, next) {
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));
}

export async function deleteUser(_req, res, next) {
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));
}
