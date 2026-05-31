import { logger } from '../logging/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    logger.error('unhandled_error', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isOperational ? err.message : 'An unexpected error occurred',
      ...(err.details && { details: err.details }),
    },
  });
}
