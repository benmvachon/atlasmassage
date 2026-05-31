import { getPool } from '../database/pool.js';
import { AuthService } from '../services/authService.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

const REFRESH_COOKIE = 'atlas_refresh';

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
});

function service() {
  return new AuthService(getPool());
}

export async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const { user, accessToken, refreshToken } = await service().register({
      email, password, firstName, lastName, phone,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    res.status(201).json({ success: true, data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await service().login({ email, password });
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
    res.json({ success: true, data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    await service().logout(rawToken);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!rawToken) {
      return next(new AppError('Refresh token required', 401, 'UNAUTHORIZED'));
    }
    const { user, accessToken, refreshToken: newRaw } = await service().refresh(rawToken);
    res.cookie(REFRESH_COOKIE, newRaw, cookieOptions());
    res.json({ success: true, data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    await service().forgotPassword(req.body.email);
    // Always 200 — don't reveal whether the email is registered
    res.json({
      success: true,
      data: { message: 'If that email is registered, a reset link has been sent.' },
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    await service().resetPassword({ token, password });
    res.json({ success: true, data: { message: 'Password updated. Please sign in.' } });
  } catch (err) {
    next(err);
  }
}
