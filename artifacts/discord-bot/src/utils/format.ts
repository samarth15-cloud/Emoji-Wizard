/**
 * Formatting utilities for UI text, durations, sizes, and progress bars.
 */

import { PROGRESS_BAR } from '../constants/index.js';

// ─── Duration ─────────────────────────────────────────────────────────────────

/**
 * Format milliseconds into a human-readable duration string.
 * @example formatDuration(3661000) → "1h 1m 1s"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0s';
  if (ms < 1_000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format seconds into a clock-style string.
 * @example formatClock(125) → "2:05"
 */
export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── File size ────────────────────────────────────────────────────────────────

/** Format bytes to a human-readable size string. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

/**
 * Build an ASCII progress bar string.
 * @param percentage  0–100
 * @param width       Total bar character width (default: 20)
 */
export function buildProgressBar(percentage: number, width: number = PROGRESS_BAR.WIDTH): string {
  const pct     = Math.min(100, Math.max(0, percentage));
  const filled  = Math.round((pct / 100) * width);
  const empty   = width - filled;
  return PROGRESS_BAR.FILLED.repeat(filled) + PROGRESS_BAR.EMPTY.repeat(empty);
}

/**
 * Build a richer progress display line.
 * @example "█████████░░░░░░░░░░░  45%  (45/100)"
 */
export function formatProgress(
  done:    number,
  total:   number,
  width  = PROGRESS_BAR.WIDTH,
): string {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const bar = buildProgressBar(pct, width);
  return `${bar}  **${Math.round(pct)}%**  (${done}/${total})`;
}

// ─── Speed ────────────────────────────────────────────────────────────────────

/** Format an upload speed in emojis-per-second */
export function formatSpeed(avgMs: number): string {
  if (avgMs <= 0) return '—';
  const perSec = 1_000 / avgMs;
  if (perSec >= 1) return `${perSec.toFixed(1)}/s`;
  return `1 per ${(avgMs / 1_000).toFixed(1)}s`;
}

// ─── Percentage ───────────────────────────────────────────────────────────────

/** Format a ratio as a percentage string. */
export function pct(done: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((done / total) * 100)}%`;
}

// ─── Slot display ─────────────────────────────────────────────────────────────

/** Visual slot usage indicator */
export function formatSlots(used: number, total: number): string {
  const available = total - used;
  const bar = buildProgressBar((used / total) * 100, 10);
  const emoji = available === 0 ? '🔴' : available < total * 0.1 ? '🟡' : '🟢';
  return `${emoji} ${bar} ${used}/${total} (${available} free)`;
}

// ─── Timestamp ────────────────────────────────────────────────────────────────

/** Format a date as HH:MM:SS */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Relative time from now */
export function formatRelative(ms: number): string {
  if (ms < 0) return 'just now';
  return `${formatDuration(ms)} ago`;
}

// ─── Memory ───────────────────────────────────────────────────────────────────

/** Format Node.js process memory usage */
export function getMemoryUsage(): string {
  const mem  = process.memoryUsage();
  const used = mem.heapUsed;
  const total = mem.heapTotal;
  return `${formatBytes(used)} / ${formatBytes(total)}`;
}

// ─── Latency colour ───────────────────────────────────────────────────────────

/** Return an emoji indicator for a given ping value */
export function latencyIcon(ms: number): string {
  if (ms < 100) return '🟢';
  if (ms < 250) return '🟡';
  return '🔴';
}
