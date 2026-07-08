/**
 * UploadSessionManager
 *
 * High-level orchestration between:
 *  - SessionStore (state persistence)
 *  - ZIP validator + extractor
 *  - Emoji processor
 *  - UploadEngine (queue + API calls)
 *  - UI builders (progress + completion panels)
 *
 * The manager is responsible for the full lifecycle of a single upload session.
 */

import { mkdir } from 'fs/promises';
import path from 'path';
import type {
  UploadSession,
  EmojiFile,
  UploadSettings,
} from '../types/index.js';
import { ZipValidationError, PermissionError, NoSlotsError } from '../types/index.js';
import { sessionStore } from '../storage/session-store.js';
import { validateZip } from '../zip/validator.js';
import { extractZip } from '../zip/extractor.js';
import { validateEmojiFile } from '../emoji/validator.js';
import { resolveUniqueName, processEmojiName } from '../emoji/processor.js';
import { getConfig } from '../config/index.js';
import { getLogger } from '../logging/logger.js';
import { getEmojiSlots } from '../utils/discord.js';
import type { Guild } from 'discord.js';

// ─── Pre-upload preparation ───────────────────────────────────────────────────

/**
 * Stage 1: Validate the ZIP before doing any heavy work.
 * Updates session status to 'validating', returns the validation result.
 */
export async function stageValidate(
  sessionId: string,
  zipPath:   string,
  zipUrl:    string,
  zipFilename: string,
): Promise<void> {
  const logger = getLogger();
  const cfg    = getConfig();

  sessionStore.update(sessionId, { status: 'validating', zipUrl, zipFilename });

  const validation = await validateZip(zipPath, cfg.maxZipSizeMb * 1024 * 1024);

  if (!validation.valid) {
    sessionStore.update(sessionId, {
      status: 'failed',
      error:  validation.errors.join('; '),
    });
    throw new ZipValidationError(
      `ZIP validation failed: ${validation.errors[0]}`,
      validation.errors,
    );
  }

  logger.info(`ZIP validated: ${validation.emojiCount} emojis found`, {
    sessionId, animated: validation.animatedCount, static: validation.staticCount,
  });
}

/**
 * Stage 2: Extract the ZIP and populate session.emojis.
 * Returns list of EmojiFile ready for processing.
 */
export async function stageExtract(
  sessionId: string,
  zipPath:   string,
  guild:     Guild,
): Promise<EmojiFile[]> {
  const logger = getLogger();
  const cfg    = getConfig();

  sessionStore.update(sessionId, { status: 'extracting' });

  // Ensure temp dir exists
  await mkdir(cfg.tempDir, { recursive: true });

  const session = sessionStore.get(sessionId);
  if (!session) throw new Error('Session not found during extraction');

  const result = await extractZip(zipPath, cfg.tempDir, session.settings.recursive);

  sessionStore.update(sessionId, {
    extractDir: result.extractDir,
    status:     'processing',
  });

  // Check emoji slots — fail fast before any uploads begin
  const slots          = await getEmojiSlots(guild);
  const neededStatic   = result.emojis.filter(e => !e.isAnimated).length;
  const neededAnimated = result.emojis.filter(e => e.isAnimated).length;

  if (slots.staticAvailable < neededStatic) {
    throw new NoSlotsError(neededStatic);
  }
  if (slots.animatedAvailable < neededAnimated) {
    throw new NoSlotsError(neededAnimated);
  }

  // Resolve unique names against existing server emojis
  const existingNames = guild.emojis.cache.map(e => e.name ?? '').filter(Boolean);
  const usedNames = new Set(existingNames);

  // Animate-first priority if enabled
  let orderedEmojis = result.emojis;
  if (session.settings.animatedPriority) {
    orderedEmojis = [
      ...result.emojis.filter(e => e.isAnimated),
      ...result.emojis.filter(e => !e.isAnimated),
    ];
  }

  // Run per-file validation and resolve names
  const processed: EmojiFile[] = [];

  for (const emoji of orderedEmojis) {
    const validation = await validateEmojiFile(emoji, session.settings.strictValidation);

    if (!validation.valid) {
      logger.warn(`Skipping invalid emoji "${emoji.name}"`, { errors: validation.errors });
      continue;
    }

    // Resolve unique name
    if (session.settings.autoRename) {
      emoji.name = resolveUniqueName(emoji.name, usedNames);
    } else if (usedNames.has(emoji.name) && session.settings.skipDuplicates) {
      logger.debug(`Skipping duplicate "${emoji.name}"`);
      continue;
    } else {
      usedNames.add(emoji.name);
    }

    processed.push(emoji);
  }

  // Update session with prepared emoji list
  sessionStore.update(sessionId, {
    emojis: processed,
    stats: {
      ...session.stats,
      total: processed.length,
    },
  });

  logger.info(`Prepared ${processed.length} emojis for upload`, { sessionId });
  return processed;
}
