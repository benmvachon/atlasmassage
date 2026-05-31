import { AppError } from './errorHandler.js';

// Placeholder middleware — JWT verification to be implemented
export function authenticate(req, _res, next) {
  // TODO: Implement JWT verification (see docs/authentication-architecture.md)
  next(new AppError('Authentication not yet implemented', 501, 'NOT_IMPLEMENTED'));
}

export function authorize(...roles) {
  return (req, _res, next) => {
    // TODO: Implement role-based authorization (see docs/authentication-architecture.md and ADR-0005)
    next(new AppError('Authorization not yet implemented', 501, 'NOT_IMPLEMENTED'));
  };
}
