/**
 * Structured, coloured Winston logger with daily log rotation.
 *
 * Console output:  human-readable coloured lines with icons.
 * File output:     JSON for log aggregation / analysis.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import chalk from 'chalk';
import { ICONS } from '../constants/index.js';

// ─── Icon + colour maps ────────────────────────────────────────────────────────

const LEVEL_ICONS: Record<string, string> = {
  error: ICONS.ERROR,
  warn:  ICONS.WARNING,
  info:  ICONS.INFO,
  debug: '🔬',
  silly: '🪲',
};

type ChalkFn = (text: string) => string;

const LEVEL_CHALK: Record<string, ChalkFn> = {
  error: chalk.bold.red,
  warn:  chalk.bold.yellow,
  info:  chalk.cyan,
  debug: chalk.magenta,
  silly: chalk.gray,
};

// ─── Custom console format ────────────────────────────────────────────────────

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const icon   = LEVEL_ICONS[level] ?? '•';
    const colour = LEVEL_CHALK[level] ?? ((s: string) => s);
    const ts     = chalk.gray(`[${String(timestamp)}]`);
    const lvl    = colour(`[${level.toUpperCase().padEnd(5)}]`);
    const msg    = colour(String(message));

    // Print any extra metadata fields compactly
    const keys = Object.keys(meta).filter(k => k !== 'service');
    const extra = keys.length > 0
      ? chalk.gray(` ${JSON.stringify(Object.fromEntries(keys.map(k => [k, meta[k]])), null, 0)}`)
      : '';

    return `${ts} ${icon}  ${lvl} ${msg}${extra}`;
  }),
);

// ─── JSON file format ─────────────────────────────────────────────────────────

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// ─── Singleton ────────────────────────────────────────────────────────────────

let _logger: winston.Logger | null = null;

/**
 * Initialise the global logger.  Call once at startup with the config values.
 */
export function createLogger(level: string, logDir: string): winston.Logger {
  if (_logger !== null) return _logger;

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env['NODE_ENV'] === 'test',
    }),
  ];

  // Rotating combined log
  transports.push(
    new DailyRotateFile({
      filename:    `${logDir}/bot-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize:     '20m',
      maxFiles:    '14d',
      format:      fileFormat,
    }),
  );

  // Rotating error-only log
  transports.push(
    new DailyRotateFile({
      filename:    `${logDir}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level:       'error',
      maxSize:     '20m',
      maxFiles:    '30d',
      format:      fileFormat,
    }),
  );

  _logger = winston.createLogger({
    level,
    transports,
    exitOnError: false,
    defaultMeta: { service: 'emoji-bot' },
  });

  return _logger;
}

/**
 * Return the already-initialised logger.
 * Throws if createLogger() has not yet been called.
 */
export function getLogger(): winston.Logger {
  if (_logger === null) {
    throw new Error('Logger not initialised.  Call createLogger() first.');
  }
  return _logger;
}

/** Reset the singleton (for tests) */
export function resetLogger(): void {
  _logger = null;
}
