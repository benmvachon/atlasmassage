import { AppError } from '../middleware/errorHandler.js';

// All handlers are stubs — see docs/authentication-architecture.md for implementation spec

export const register = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const login = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const logout = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const refreshToken = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const forgotPassword = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));

export const resetPassword = (_req, _res, next) =>
  next(new AppError('Not implemented', 501, 'NOT_IMPLEMENTED'));
