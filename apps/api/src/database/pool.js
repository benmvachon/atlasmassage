import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      min: config.db.poolMin,
      max: config.db.poolMax,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      logger.error('pg_pool_error', { message: err.message });
    });
  }

  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('pg_pool_closed');
  }
}
