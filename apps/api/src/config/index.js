import 'dotenv/config';

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optional = (key, defaultValue = undefined) => process.env[key] ?? defaultValue;

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001'), 10),
  apiVersion: 'v1',

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: parseInt(optional('DB_PORT', '5432'), 10),
    name: optional('DB_NAME', 'atlasmassage'),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', ''),
    poolMin: parseInt(optional('DB_POOL_MIN', '2'), 10),
    poolMax: parseInt(optional('DB_POOL_MAX', '10'), 10),
    ssl: optional('DB_SSL', 'false') === 'true',
  },

  jwt: {
    accessSecret: optional('JWT_ACCESS_SECRET', 'dev-access-secret-change-in-production'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  cors: {
    origin: optional('CORS_ORIGIN', 'http://localhost:5173'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
  },

  stripe: {
    secretKey: optional('STRIPE_SECRET_KEY', ''),
    webhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
  },

  email: {
    host: optional('EMAIL_HOST', ''),
    port: parseInt(optional('EMAIL_PORT', '587'), 10),
    user: optional('EMAIL_USER', ''),
    password: optional('EMAIL_PASSWORD', ''),
    from: optional('EMAIL_FROM', 'noreply@atlasmassage.com'),
  },

  sms: {
    accountSid: optional('TWILIO_ACCOUNT_SID', ''),
    authToken: optional('TWILIO_AUTH_TOKEN', ''),
    fromNumber: optional('TWILIO_FROM_NUMBER', ''),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
  },
};
