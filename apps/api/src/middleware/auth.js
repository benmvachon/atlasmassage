import { AppError } from './errorHandler.js';

// Placeholder middleware — JWT verification to be implemented
export function authenticate(req, _res, next) {
  // TODO: Implement JWT verification (see docs/authentication-architecture.md)
  next(new AppError('Authentication not yet implemented', 501, 'NOT_IMPLEMENTED'));
}

// Sets req.user if a valid token is present; passes through without error if no token is provided.
// Used for guest-accessible endpoints that behave differently for authenticated users (e.g. booking).
export function optionalAuthenticate(req, _res, next) {
  // TODO: Implement optional JWT verification (see docs/authentication-architecture.md and ADR-0011)
  req.user = null;
  next();
}

export function authorize(...roles) {
  return (req, _res, next) => {
    // TODO: Implement role-based authorization (see docs/authentication-architecture.md and ADR-0005)
    next(new AppError('Authorization not yet implemented', 501, 'NOT_IMPLEMENTED'));
  };
}
