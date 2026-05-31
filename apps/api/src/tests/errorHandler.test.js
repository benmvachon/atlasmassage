import { AppError } from '../middleware/errorHandler.js';

describe('AppError', () => {
  it('creates an operational error with defaults', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('accepts custom statusCode and code', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('accepts validation details', () => {
    const details = { email: ['Invalid email address'] };
    const err = new AppError('Validation failed', 422, 'VALIDATION_ERROR', details);
    expect(err.details).toEqual(details);
  });
});
