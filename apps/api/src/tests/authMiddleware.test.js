import { jest } from '@jest/globals';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth.js';
import { issueAccessToken } from '../services/tokenService.js';
import { AppError } from '../middleware/errorHandler.js';

function mockReq(authHeader) {
  return { headers: { authorization: authHeader } };
}
const mockRes = {};
let next;

beforeEach(() => { next = jest.fn(); });

describe('authenticate', () => {
  it('sets req.user from a valid token', () => {
    const token = issueAccessToken({ id: 'u1', roles: ['client'] });
    const req = mockReq(`Bearer ${token}`);
    authenticate(req, mockRes, next);
    expect(next).toHaveBeenCalledWith(); // no error arg
    expect(req.user.sub).toBe('u1');
  });

  it('calls next with 401 when no token', () => {
    const req = mockReq(undefined);
    authenticate(req, mockRes, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it('calls next with 401 for an expired/invalid token', () => {
    const req = mockReq('Bearer invalid.token.here');
    authenticate(req, mockRes, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});

describe('optionalAuthenticate', () => {
  it('sets req.user from a valid token', () => {
    const token = issueAccessToken({ id: 'u2', roles: ['therapist'] });
    const req = mockReq(`Bearer ${token}`);
    optionalAuthenticate(req, mockRes, next);
    expect(req.user.sub).toBe('u2');
    expect(next).toHaveBeenCalledWith();
  });

  it('sets req.user = null and continues when no token', () => {
    const req = mockReq(undefined);
    optionalAuthenticate(req, mockRes, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });

  it('sets req.user = null and continues for an invalid token', () => {
    const req = mockReq('Bearer bad.token');
    optionalAuthenticate(req, mockRes, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledWith();
  });
});

describe('authorize', () => {
  it('passes through when user has an allowed role', () => {
    const req = { user: { roles: ['therapist'] } };
    authorize('therapist', 'owner')(req, mockRes, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with 403 when user lacks required role', () => {
    const req = { user: { roles: ['client'] } };
    authorize('therapist')(req, mockRes, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('calls next with 401 when req.user is null', () => {
    const req = { user: null };
    authorize('owner')(req, mockRes, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});
