/**
 * Single-emoji upload engine.
 *
 * Wraps guild.emojis.create() with p-retry + exponential back-off.
 * Respects Discord's Retry-After header on 429 responses.
 * Dry-run mode simulates the API call without making a real request.
 */

import { setTimeout as sleep } from 'timers/promises';
import pRetry, { AbortError } from 'p-retry';
import {
  DiscordAPIError,
  GuildEmoji,
  Guild,
  RESTJSONErrorCodes,
} from 'discord.js';
import type { EmojiFile, UploadSettings, EmojiUploadResult } from '../types/index.js';
import { RateLimitError, EmojiUploadError, PermissionError, NoSlotsError } from '../types/index.js';
import { QUEUE_DEFAULTS } from '../constants/index.js';
import { getLogger } from '../logging/logger.js';

// ─── Error classification ──────────────────────────────────────────────────────

/**
 * Determines whether a Discord API error should be retried.
 */
function classifyDiscordError(err: DiscordAPIError): {
  retryable:   boolean;
  retryAfterMs: number;
  message:     string;
} {
  switch (err.code) {
    case RESTJSONErrorCodes.MaximumNumberOfEmojisReached:
    case RESTJSONErrorCodes.MaximumNumberOfAnimatedEmojisReached:
      return { retryable: false, retryAfterMs: 0, message: 'No emoji slots available on this server.' };

    case RESTJSONErrorCodes.MissingPermissions:
    case RESTJSONErrorCodes.MissingAccess:
      return { retryable: false, retryAfterMs: 0, message: 'Bot lacks Manage Expressions permission.' };

    case 50035: // InvalidFormBody
      return { retryable: false, retryAfterMs: 0, message: `Invalid emoji: ${err.message}` };

    default:
      break;
  }

  // HTTP 429 – rate limit
  if (err.status === 429) {
    const retryAfter = Number(
      ((err.rawError as unknown) as Record<string, unknown>)['retry_after'] ?? 1,
    ) * 1_000;
    return { retryable: true, retryAfterMs: retryAfter, message: `Rate limited for ${(retryAfter / 1000).toFixed(1)}s.` };
  }

  // HTTP 5xx – server error, retry
  if (err.status >= 500) {
    return { retryable: true, retryAfterMs: 2_000, message: `Discord server error (${err.status}).` };
  }

  return { retryable: false, retryAfterMs: 0, message: err.message };
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload a single emoji to Discord.
 *
 * @param guild     The target guild
 * @param file      The EmojiFile to upload
 * @param settings  Upload settings (concurrency, retries, …)
 * @param dryRun    When true, skip the actual API call
 */
export async function uploadEmoji(
  guild:    Guild,
  file:     EmojiFile,
  settings: Pick<UploadSettings, 'maxRetries' | 'retryDelayBaseMs' | 'dryRun'>,
): Promise<EmojiUploadResult> {
  const logger = getLogger();
  const startedAt = Date.now();
  let retries = 0;

  const result = await pRetry(
    async (attemptNumber) => {
      if (attemptNumber > 1) {
        retries++;
        logger.debug(`Retry attempt ${attemptNumber} for "${file.name}"`, {
          emoji: file.name,
        });
      }

      // ── Dry run ─────────────────────────────────────────────────────────────
      if (settings.dryRun) {
        await sleep(100 + Math.random() * 200); // Simulate upload latency
        return {
          file,
          state:     'completed' as const,
          emoji:     undefined,
          retries:   0,
          durationMs: Date.now() - startedAt,
          finalName: file.name,
        } satisfies EmojiUploadResult;
      }

      // ── Real upload ──────────────────────────────────────────────────────────
      try {
        const emoji: GuildEmoji = await guild.emojis.create({
          attachment: file.path,
          name:       file.name,
        });

        logger.info(`✅ Uploaded: :${emoji.name}:`, {
          id:       emoji.id,
          animated: emoji.animated,
        });

        return {
          file,
          state:     'completed' as const,
          emoji,
          retries,
          durationMs: Date.now() - startedAt,
          finalName: emoji.name ?? file.name,
        } satisfies EmojiUploadResult;

      } catch (err) {
        if (!(err instanceof DiscordAPIError)) {
          // Network error – always retryable
          throw new EmojiUploadError(
            `Network error: ${err instanceof Error ? err.message : String(err)}`,
            true,
          );
        }

        const classification = classifyDiscordError(err);

        if (!classification.retryable) {
          // Non-retryable: abort p-retry immediately
          throw new AbortError(classification.message);
        }

        // Respect Retry-After before the next attempt
        if (classification.retryAfterMs > 0) {
          logger.warn(`Rate limited on "${file.name}", waiting ${(classification.retryAfterMs / 1000).toFixed(1)}s…`);
          await sleep(classification.retryAfterMs);
        }

        throw new EmojiUploadError(classification.message, true);
      }
    },
    {
      retries:   settings.maxRetries,
      minTimeout: settings.retryDelayBaseMs,
      maxTimeout: QUEUE_DEFAULTS.RETRY_DELAY_MAX_MS,
      factor:    QUEUE_DEFAULTS.RETRY_FACTOR,
      onFailedAttempt(error) {
        logger.warn(`Upload attempt ${error.attemptNumber}/${settings.maxRetries + 1} failed for "${file.name}": ${error.message}`);
      },
    },
  );

  return result;
}
