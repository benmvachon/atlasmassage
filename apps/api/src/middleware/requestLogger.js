import { logger } from '../logging/logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('http_request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
      user_agent: req.get('user-agent'),
    });
  });

  next();
}
