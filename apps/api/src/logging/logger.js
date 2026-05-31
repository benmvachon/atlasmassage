import { createLogger, format, transports } from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, errors, json, colorize, printf } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${stack || message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = createLogger({
  level: config.logging.level,
  format: config.env === 'production' ? prodFormat : devFormat,
  transports: [new transports.Console()],
  exitOnError: false,
});
