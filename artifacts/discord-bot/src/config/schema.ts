/**
 * Zod schema for environment variable validation.
 * All configuration must pass this schema before the bot starts.
 */

import { z } from 'zod';

export const envSchema = z.object({
  // ── Discord credentials (required)
  DISCORD_TOKEN: z
    .string()
    .min(1, 'DISCORD_TOKEN is required')
    .regex(/^[A-Za-z0-9._-]+$/, 'DISCORD_TOKEN contains invalid characters'),

  DISCORD_CLIENT_ID: z
    .string()
    .min(1, 'DISCORD_CLIENT_ID is required')
    .regex(/^\d+$/, 'DISCORD_CLIENT_ID must be a snowflake (numeric string)'),

  DISCORD_GUILD_ID: z
    .string()
    .regex(/^\d+$/, 'DISCORD_GUILD_ID must be a snowflake')
    .optional()
    .or(z.literal('')),

  // ── Upload limits
  MAX_ZIP_SIZE_MB: z.coerce
    .number()
    .positive('MAX_ZIP_SIZE_MB must be positive')
    .max(500, 'MAX_ZIP_SIZE_MB must be ≤ 500')
    .default(100),

  // ── Storage
  TEMP_DIR: z.string().min(1).default('./tmp'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug', 'silly'])
    .default('info'),
  LOG_DIR: z.string().min(1).default('./logs'),

  // ── Queue defaults
  DEFAULT_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(2),

  DEFAULT_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .max(10)
    .default(3),

  PROGRESS_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(10_000)
    .default(2_000),

  // ── Runtime
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;
