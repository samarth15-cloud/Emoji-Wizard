/**
 * Bot entry point.
 *
 * Startup sequence:
 *  1. Load and validate configuration
 *  2. Initialise logger with log rotation
 *  3. Ensure temp and log directories exist
 *  4. Create Discord client with all events registered
 *  5. Login to Discord gateway
 *
 * Any failure before login is treated as fatal and exits with code 1.
 */

import { mkdir } from 'fs/promises';
import ora from 'ora';
import PrettyError from 'pretty-error';
import { loadConfig } from './config/index.js';
import { createLogger, getLogger } from './logging/logger.js';
import { createClient } from './bot.js';

// ─── Pretty error formatting ──────────────────────────────────────────────────

const pe = new PrettyError();
pe.start();

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const spinner = ora({
    text:    'Starting Emoji ZIP Uploader Bot…',
    spinner: 'dots2',
  }).start();

  // ── 1. Load config ───────────────────────────────────────────────────────
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
    spinner.text = 'Configuration validated ✓';
  } catch (err) {
    spinner.fail('Configuration failed');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // ── 2. Initialise logger ──────────────────────────────────────────────────
  try {
    await mkdir(config.logDir,  { recursive: true });
    await mkdir(config.tempDir, { recursive: true });
  } catch {
    // Directories may already exist
  }

  createLogger(config.logLevel, config.logDir);
  const logger = getLogger();
  spinner.text = 'Logger initialised ✓';

  // ── 3. Create client ───────────────────────────────────────────────────────
  const client = createClient();
  spinner.text = 'Discord client created ✓';

  // ── 4. Login ───────────────────────────────────────────────────────────────
  try {
    spinner.text = 'Connecting to Discord gateway…';
    await client.login(config.token);
    spinner.succeed('Bot is online!');
  } catch (err) {
    spinner.fail('Failed to connect to Discord');
    logger.error('Login failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
