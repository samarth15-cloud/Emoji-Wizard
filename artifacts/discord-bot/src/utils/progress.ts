/**
 * Progress calculation utilities for upload sessions.
 */

import type { UploadSession } from '../types/index.js';
import type { QueueItem } from '../types/index.js';
import { formatDuration, formatSpeed, pct } from './format.js';

// ─── Progress snapshot ────────────────────────────────────────────────────────

export interface ProgressSnapshot {
  percentage:        number;
  done:              number;
  total:             number;
  completed:         number;
  failed:            number;
  skipped:           number;
  pending:           number;
  uploading:         number;
  elapsedMs:         number;
  etaMs:             number | undefined;
  etaLabel:          string;
  elapsedLabel:      string;
  speedLabel:        string;
  percentageLabel:   string;
  currentEmoji:      string | undefined;
}

/**
 * Compute a real-time progress snapshot from a session and its queue items.
 */
export function computeProgress(
  session: UploadSession,
  items:   QueueItem[],
): ProgressSnapshot {
  const total     = session.stats.total || 1;
  const completed = session.stats.completed;
  const failed    = session.stats.failed;
  const skipped   = session.stats.skipped;
  const done      = completed + failed + skipped;
  const pending   = items.filter(i => i.state === 'pending').length;
  const uploading = items.filter(i => i.state === 'uploading' || i.state === 'retrying').length;
  const percentage = Math.min(100, Math.round((done / total) * 100));

  const elapsedMs = session.startedAt
    ? Date.now() - session.startedAt.getTime()
    : 0;

  const avgMs = session.stats.averageUploadMs;
  const etaMs = avgMs && done > 0
    ? (total - done) * avgMs
    : undefined;

  return {
    percentage,
    done,
    total,
    completed,
    failed,
    skipped,
    pending,
    uploading,
    elapsedMs,
    etaMs,
    etaLabel:        etaMs !== undefined ? `~${formatDuration(etaMs)}` : '—',
    elapsedLabel:    formatDuration(elapsedMs),
    speedLabel:      avgMs ? formatSpeed(avgMs) : '—',
    percentageLabel: pct(done, total),
    currentEmoji:    session.currentEmoji,
  };
}
