/**
 * Upload Engine
 *
 * Drives the full upload pipeline:
 *  1. Download ZIP from Discord CDN
 *  2. Validate → Extract → Process emojis
 *  3. Run the upload queue with live progress updates
 *  4. Build and push the completion panel
 *
 * Designed to be called from the button handler and run asynchronously
 * while the UI is updated via periodic message edits.
 */

import { createWriteStream } from 'fs';
import { mkdir, rm, unlink } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { setTimeout as sleep } from 'timers/promises';
import type { Guild, ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import type {
  UploadSession,
  EmojiUploadResult,
  EmojiFile,
} from '../types/index.js';
import { sessionStore } from '../storage/session-store.js';
import { createQueue, UploadQueue } from '../queue/manager.js';
import { uploadEmoji } from '../emoji/uploader.js';
import { stageValidate, stageExtract } from './session.js';
import { buildProgressPanel } from '../builders/progress.js';
import { buildCompletionPanel } from '../builders/completion.js';
import { buildErrorPanel } from '../builders/error-panel.js';
import { getLogger } from '../logging/logger.js';
import { getConfig } from '../config/index.js';

// ─── ZIP download ─────────────────────────────────────────────────────────────

/**
 * Stream-download a ZIP from a Discord CDN URL to a temp file.
 */
const DOWNLOAD_TIMEOUT_MS = 30_000;

async function downloadZip(url: string, destPath: string): Promise<void> {
  const logger = getLogger();
  logger.info(`Downloading ZIP: ${url}`);

  await mkdir(path.dirname(destPath), { recursive: true });

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(`ZIP download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Failed to download ZIP: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error('No response body for ZIP download');
  }

  logger.info(`ZIP response received, streaming to disk`, { destPath });

  // Wrap the WHATWG ReadableStream in a Node Readable explicitly rather than
  // relying on an unsafe cast to AsyncIterable — the cast previously used
  // could silently fail to iterate on some runtimes, hanging forever with
  // no error and no further log output.
  const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  const writer = createWriteStream(destPath);

  await pipeline(nodeStream, writer);
  logger.info(`ZIP downloaded to ${destPath}`);
}

// ─── Progress loop ────────────────────────────────────────────────────────────

interface ProgressLoopOptions {
  sessionId: string;
  queue:     UploadQueue;
  editFn:    (panel: ReturnType<typeof buildProgressPanel>) => Promise<void>;
  intervalMs: number;
}

function startProgressLoop({
  sessionId,
  queue,
  editFn,
  intervalMs,
}: ProgressLoopOptions): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    const session = sessionStore.get(sessionId);
    if (!session || session.status !== 'uploading') return;

    const panel = buildProgressPanel(session, queue.allItems());
    editFn(panel).catch(() => undefined); // best-effort
  }, intervalMs);

  timer.unref?.();
  return timer;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export interface EngineRunOptions {
  sessionId:   string;
  guild:       Guild;
  zipUrl:      string;
  zipFilename: string;
  /** Called to edit the live progress message */
  onEdit: (components: import('discord.js').ContainerBuilder[]) => Promise<void>;
}

/**
 * Execute the full upload pipeline for a session.
 * This function is intentionally async and runs in the background.
 */
export async function runUploadEngine(opts: EngineRunOptions): Promise<void> {
  const { sessionId, guild, zipUrl, zipFilename, onEdit } = opts;
  const logger = getLogger();
  const cfg    = getConfig();

  const session = sessionStore.get(sessionId);
  if (!session) {
    logger.error('Engine: session not found', { sessionId });
    return;
  }

  const tempZipPath = path.join(cfg.tempDir, `${sessionId}.zip`);
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let queue: UploadQueue | null = null;

  try {
    // ── Download ──────────────────────────────────────────────────────────────
    await downloadZip(zipUrl, tempZipPath);

    // ── Validate ──────────────────────────────────────────────────────────────
    await stageValidate(sessionId, tempZipPath, zipUrl, zipFilename);

    // ── Extract + process ─────────────────────────────────────────────────────
    const emojis = await stageExtract(sessionId, tempZipPath, guild);

    if (emojis.length === 0) {
      sessionStore.update(sessionId, {
        status: 'completed',
        completedAt: new Date(),
      });
      const finalSession = sessionStore.get(sessionId)!;
      await onEdit([buildCompletionPanel(finalSession)]);
      return;
    }

    // ── Upload queue ──────────────────────────────────────────────────────────
    sessionStore.update(sessionId, { status: 'uploading', startedAt: new Date() });

    queue = createQueue(session.settings.concurrency);

    // Live progress loop
    progressTimer = startProgressLoop({
      sessionId,
      queue,
      intervalMs: session.settings.progressIntervalMs,
      editFn: async (panel) => {
        await onEdit([panel]);
      },
    });

    const results: EmojiUploadResult[] = [];

    await queue.run(emojis, async (file: EmojiFile) => {
      const s = sessionStore.get(sessionId);
      if (!s || s.status === 'cancelled') {
        throw new Error('Session cancelled');
      }

      sessionStore.update(sessionId, { currentEmoji: file.name });

      const result = await uploadEmoji(guild, file, s.settings);

      // Update running stats
      const latest = sessionStore.get(sessionId);
      if (latest) {
        const stats = { ...latest.stats };
        stats.completed      += result.state === 'completed' ? 1 : 0;
        stats.failed         += result.state === 'failed'    ? 1 : 0;
        stats.skipped        += result.state === 'skipped'   ? 1 : 0;
        stats.retried        += result.retries;
        stats.bytesProcessed += file.sizeBytes;
        stats.elapsedMs       = Date.now() - (latest.startedAt?.getTime() ?? Date.now());

        // ETA
        const done = stats.completed + stats.failed + stats.skipped;
        if (done > 0 && stats.elapsedMs > 0) {
          stats.averageUploadMs = stats.elapsedMs / done;
          const remaining = stats.total - done;
          stats.estimatedRemainingMs = remaining * stats.averageUploadMs;
        }

        sessionStore.update(sessionId, {
          stats,
          results:      [...latest.results, result],
          currentIndex: (latest.currentIndex ?? 0) + 1,
        });
      }

      results.push(result);
      return result;
    });

    // ── Finalise — only mark completed if not already cancelled ─────────────
    const finalSession = sessionStore.get(sessionId);
    if (!finalSession) return;

    // Respect cancellation: if the session was cancelled during the queue run
    // do not overwrite the terminal state with 'completed'.
    if (finalSession.status === 'cancelled') {
      logger.info(`Session was cancelled; skipping completed transition`, { sessionId });
      return;
    }

    const stats = { ...finalSession.stats };
    stats.elapsedMs = Date.now() - (finalSession.startedAt?.getTime() ?? Date.now());

    sessionStore.update(sessionId, {
      status:      'completed',
      completedAt: new Date(),
      stats,
    });

    const completed = sessionStore.get(sessionId)!;
    await onEdit([buildCompletionPanel(completed)]);

    logger.info(`Upload session complete`, {
      sessionId,
      completed: stats.completed,
      failed:    stats.failed,
      skipped:   stats.skipped,
      elapsedMs: stats.elapsedMs,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Upload engine error`, { sessionId, error: message });

    sessionStore.update(sessionId, {
      status:      'failed',
      error:       message,
      completedAt: new Date(),
    });

    const failedSession = sessionStore.get(sessionId);
    const errorPanel = buildErrorPanel(
      'Upload Failed',
      message,
      failedSession ?? undefined,
    );
    await onEdit([errorPanel]).catch(() => undefined);

  } finally {
    if (progressTimer) clearInterval(progressTimer);
    if (queue) queue.abort();

    // Clean up temp ZIP file (extracted dir cleaned by session GC)
    await unlink(tempZipPath).catch(() => undefined);
  }
}
