import { verifyAccessToken } from '../services/tokenService.js';
import { AppError } from './errorHandler.js';

export function authenticate(req, _res, next) {
  const token = extractBearer(req);
  if (!token) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError('Invalid or expired access token', 401, 'UNAUTHORIZED'));
  }
}

// Sets req.user from JWT if present and valid; passes through as guest (req.user = null) otherwise.
// See ADR-0011 for the guest checkout decision.
export function optionalAuthenticate(req, _res, next) {
  const token = extractBearer(req);
  req.user = null;
  if (!token) return next();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Invalid token on an optional route — treat as unauthenticated
  }
  next();
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    const userRoles = req.user.roles ?? [];
    if (!roles.some(r => userRoles.includes(r))) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}

function extractBearer(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}
