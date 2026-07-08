/**
 * Upload queue manager.
 *
 * Uses p-limit for concurrency control.
 * Tracks per-item state for live progress reporting.
 * Emits events so the progress panel can react without polling.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import type { EmojiFile, UploadSession, QueueItem, EmojiUploadResult, EmojiUploadState } from '../types/index.js';
import { getLogger } from '../logging/logger.js';

// ─── Queue Events ─────────────────────────────────────────────────────────────

export interface QueueEvents {
  'item:start':    (item: QueueItem) => void;
  'item:complete': (item: QueueItem, result: EmojiUploadResult) => void;
  'item:fail':     (item: QueueItem, error: Error) => void;
  'item:skip':     (item: QueueItem, reason: string) => void;
  'queue:drain':   () => void;
  'queue:abort':   () => void;
}

// ─── Queue class ──────────────────────────────────────────────────────────────

export class UploadQueue extends EventEmitter {
  private readonly items     = new Map<string, QueueItem>();
  private readonly limiter:  ReturnType<typeof pLimit>;
  private aborted            = false;
  private _activeCount       = 0;
  private _completedCount    = 0;

  constructor(concurrency: number) {
    super();
    this.limiter = pLimit(concurrency);
  }

  /** Current number of actively-running upload tasks */
  get activeCount(): number { return this._activeCount; }

  /** Total items currently in the queue (all states) */
  get totalCount(): number  { return this.items.size; }

  /** Items that finished (completed, failed, skipped) */
  get completedCount(): number { return this._completedCount; }

  /** True if abort() was called */
  get isAborted(): boolean { return this.aborted; }

  /** All queue items sorted by enqueue time */
  allItems(): QueueItem[] {
    return Array.from(this.items.values()).sort(
      (a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime(),
    );
  }

  /** Items in a specific state */
  itemsByState(state: EmojiUploadState): QueueItem[] {
    return this.allItems().filter(i => i.state === state);
  }

  /**
   * Enqueue a list of emoji files and run them with the configured concurrency.
   *
   * The provided `uploadFn` is called for each emoji.
   * Returns once all items have settled (fulfilled or rejected).
   */
  async run(
    files:    EmojiFile[],
    uploadFn: (file: EmojiFile) => Promise<EmojiUploadResult>,
  ): Promise<void> {
    const logger = getLogger();
    this.aborted = false;

    // Populate queue
    for (const file of files) {
      const item: QueueItem = {
        id:          randomUUID(),
        sessionId:   '', // set by UploadEngine
        file,
        attempt:     0,
        enqueuedAt:  new Date(),
        state:       'pending',
      };
      this.items.set(item.id, item);
    }

    // Dispatch with concurrency limit
    const tasks = Array.from(this.items.values()).map(item =>
      this.limiter(async () => {
        if (this.aborted) {
          this.setItemState(item.id, 'cancelled');
          return;
        }

        this.setItemState(item.id, 'uploading');
        item.startedAt = new Date();
        item.attempt++;
        this._activeCount++;
        this.emit('item:start', { ...item });

        try {
          const result = await uploadFn(item.file);

          item.completedAt = new Date();
          item.state       = result.state;
          this.setItemState(item.id, result.state);
          this._activeCount--;
          this._completedCount++;
          this.emit('item:complete', { ...item }, result);
          logger.debug(`Queue item complete: ${item.file.name}`, { state: result.state });

        } catch (err) {
          item.completedAt = new Date();
          item.state       = 'failed';
          item.error       = err instanceof Error ? err.message : String(err);
          this.setItemState(item.id, 'failed');
          this._activeCount--;
          this._completedCount++;
          this.emit('item:fail', { ...item }, err instanceof Error ? err : new Error(String(err)));
          logger.warn(`Queue item failed: ${item.file.name}`, { error: item.error });
        }
      }),
    );

    await Promise.allSettled(tasks);
    this.emit('queue:drain');
  }

  /** Skip a queued item before it starts */
  skip(fileId: string, reason: string): void {
    const item = this.findByFileId(fileId);
    if (!item || item.state !== 'pending') return;

    this.setItemState(item.id, 'skipped');
    this._completedCount++;
    this.emit('item:skip', { ...item }, reason);
  }

  /** Abort the queue – pending tasks will be marked cancelled */
  abort(): void {
    this.aborted = true;
    this.limiter.clearQueue();
    this.emit('queue:abort');
    getLogger().info('Queue aborted');
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private setItemState(id: string, state: EmojiUploadState): void {
    const item = this.items.get(id);
    if (item) item.state = state;
  }

  private findByFileId(fileId: string): QueueItem | undefined {
    for (const item of this.items.values()) {
      if (item.file.path === fileId) return item;
    }
    return undefined;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createQueue(concurrency: number): UploadQueue {
  return new UploadQueue(concurrency);
}
