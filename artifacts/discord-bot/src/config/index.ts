/**
 * Configuration loader.
 *
 * Reads .env, validates against the Zod schema, and exposes a typed config
 * singleton.  Call loadConfig() once at startup; thereafter use getConfig().
 */

import { config as dotenvLoad } from 'dotenv';
import { envSchema } from './schema.js';
import type { BotConfig } from '../types/index.js';

dotenvLoad();

let _config: BotConfig | null = null;

/**
 * Parse and validate all environment variables.
 * Throws a detailed error if any required value is missing or invalid.
 */
export function loadConfig(): BotConfig {
  if (_config !== null) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const lines = result.error.issues
      .map(i => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`❌  Configuration validation failed:\n${lines}\n\nCopy .env.example → .env and fill in the required values.`);
  }

  const env = result.data;

  _config = {
    token:               env.DISCORD_TOKEN,
    clientId:            env.DISCORD_CLIENT_ID,
    guildId:             env.DISCORD_GUILD_ID || undefined,
    maxZipSizeMb:        env.MAX_ZIP_SIZE_MB,
    tempDir:             env.TEMP_DIR,
    logLevel:            env.LOG_LEVEL,
    logDir:              env.LOG_DIR,
    defaultConcurrency:  env.DEFAULT_CONCURRENCY,
    defaultMaxRetries:   env.DEFAULT_MAX_RETRIES,
    progressIntervalMs:  env.PROGRESS_INTERVAL_MS,
  };

  return _config;
}

/**
 * Get the already-loaded configuration.
 * Will call loadConfig() if not yet initialised.
 */
export function getConfig(): BotConfig {
  return _config ?? loadConfig();
}

/** Reset the config singleton (useful in tests) */
export function resetConfig(): void {
  _config = null;
}
