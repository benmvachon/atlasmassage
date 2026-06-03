import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: config.cors.origin, credentials: true }));

// Static headshots (uploaded + seed images)
app.use('/headshots', express.static(path.join(__dirname, '..', 'public', 'headshots')));

// Raw body for Stripe webhooks — must precede express.json()
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(compression());

// Rate limiting
app.use(
  '/api',
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Logging
app.use(requestLogger);

// Health check (unauthenticated)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.use(`/api/${config.apiVersion}`, apiRoutes);

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

export default app;
