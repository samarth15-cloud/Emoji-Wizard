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

  // Fetch emoji slot availability so we can cap the batch to what fits
  const slots = await getEmojiSlots(guild);

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

  // Cap to available server slots — upload what fits, skip the overflow
  // instead of aborting the entire batch when the server is near capacity.
  const finalEmojis: EmojiFile[] = [];
  const overflow: string[] = [];
  let staticKept = 0;
  let animatedKept = 0;

  for (const e of processed) {
    if (e.isAnimated) {
      if (animatedKept < slots.animatedAvailable) {
        finalEmojis.push(e);
        animatedKept++;
      } else {
        overflow.push(e.name);
      }
    } else {
      if (staticKept < slots.staticAvailable) {
        finalEmojis.push(e);
        staticKept++;
      } else {
        overflow.push(e.name);
      }
    }
  }

  if (processed.length > 0 && finalEmojis.length === 0) {
    throw new NoSlotsError(processed.length);
  }

  if (overflow.length > 0) {
    logger.warn(`Skipping ${overflow.length} emoji(s): not enough server slots`, {
      sessionId,
      overflow: overflow.slice(0, 20),
    });
  }

  // Update session with prepared emoji list
  sessionStore.update(sessionId, {
    emojis: finalEmojis,
    stats: {
      ...session.stats,
      total: finalEmojis.length,
    },
  });

  logger.info(`Prepared ${finalEmojis.length} emojis for upload` +
    (overflow.length ? ` (${overflow.length} skipped — no slots)` : ''), { sessionId });
  return finalEmojis;
}
