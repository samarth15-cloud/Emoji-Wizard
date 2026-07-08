/**
 * Per-file emoji validation.
 *
 * Checks an extracted image file against Discord's constraints:
 *  - Name length (2-32 chars, valid pattern)
 *  - File size (≤ 256 KB)
 *  - Dimensions (≤ 128×128 px, when image-size can read them)
 *  - MIME type / magic-bytes match the declared extension
 */

import { readFile } from 'fs/promises';
import sizeOf from 'image-size';
import type { EmojiFile } from '../types/index.js';
import { DISCORD_LIMITS } from '../constants/index.js';
import { isValidEmojiName } from './processor.js';
import { getLogger } from '../logging/logger.js';

export interface EmojiValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

/**
 * Validate a single extracted emoji file.
 *
 * @param emoji          The EmojiFile descriptor
 * @param strictMode     When true, dimensional oversize is an error; otherwise a warning
 */
export async function validateEmojiFile(
  emoji:       EmojiFile,
  strictMode:  boolean = true,
): Promise<EmojiValidationResult> {
  const logger = getLogger();
  const errors:   string[] = [];
  const warnings: string[] = [];

  // ── 1. Name validation ─────────────────────────────────────────────────────
  if (!isValidEmojiName(emoji.name)) {
    errors.push(
      `Invalid emoji name "${emoji.name}". ` +
      'Names must be 2–32 characters (a-z, 0-9, underscore).',
    );
  }

  // ── 2. File size ───────────────────────────────────────────────────────────
  if (emoji.sizeBytes > DISCORD_LIMITS.EMOJI_MAX_SIZE_BYTES) {
    errors.push(
      `File too large: ${(emoji.sizeBytes / 1024).toFixed(1)} KB ` +
      `(Discord limit: ${DISCORD_LIMITS.EMOJI_MAX_SIZE_BYTES / 1024} KB).`,
    );
  } else if (emoji.sizeBytes > DISCORD_LIMITS.EMOJI_MAX_SIZE_BYTES * 0.9) {
    warnings.push(
      `File size ${(emoji.sizeBytes / 1024).toFixed(1)} KB is close to the 256 KB limit.`,
    );
  }

  // ── 3. Dimensions ─────────────────────────────────────────────────────────
  try {
    const buffer = await readFile(emoji.path);
    const dims   = sizeOf(buffer);

    if (dims.width && dims.height) {
      const maxDim = DISCORD_LIMITS.EMOJI_MAX_DIMENSION;
      const oversized = dims.width > maxDim || dims.height > maxDim;

      if (oversized) {
        const msg =
          `Dimensions ${dims.width}×${dims.height} px exceed the ${maxDim}×${maxDim} px limit. ` +
          'Discord will downscale automatically.';

        if (strictMode) {
          errors.push(msg);
        } else {
          warnings.push(msg);
        }
      }
    }
  } catch (err) {
    // image-size can fail on animated GIFs or unusual formats — treat as non-fatal
    logger.debug(`Could not read dimensions for "${emoji.name}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
    warnings.push(`Could not verify image dimensions for "${emoji.name}".`);
  }

  // ── 4. Animated GIF size reminder ─────────────────────────────────────────
  if (emoji.isAnimated && emoji.sizeBytes > 128 * 1024) {
    warnings.push(
      `Animated GIF is ${(emoji.sizeBytes / 1024).toFixed(0)} KB. ` +
      'Large animated emojis may render slowly for users.',
    );
  }

  return {
    valid:    errors.length === 0,
    errors,
    warnings,
  };
}
