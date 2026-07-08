/**
 * In-memory session store with TTL-based garbage collection.
 *
 * Stores all active UploadSession objects keyed by session ID.
 * Automatically purges expired sessions every minute.
 */

import { randomUUID } from 'crypto';
import { rm } from 'fs/promises';
import type { UploadSession, UploadSettings, UploadStats } from '../types/index.js';
import { SESSION_TIMEOUT_MS, MAX_ACTIVE_SESSIONS_PER_GUILD, QUEUE_DEFAULTS } from '../constants/index.js';
import { getLogger } from '../logging/logger.js';
import { getConfig } from '../config/index.js';

// ─── Default session values ───────────────────────────────────────────────────

/** Pure helper — returns default settings without touching the store */
export function getDefaultSettings(): UploadSettings {
  return defaultSettings();
}

function defaultSettings(): UploadSettings {
  const cfg = getConfig();
  return {
    concurrency:      cfg.defaultConcurrency,
    maxRetries:       cfg.defaultMaxRetries,
    retryDelayBaseMs: QUEUE_DEFAULTS.RETRY_DELAY_BASE_MS,
    autoRename:       true,
    skipDuplicates:   false,
    progressIntervalMs: cfg.progressIntervalMs,
    animatedPriority: true,
    recursive:        true,
    strictValidation: true,
    logVerbosity:     'normal',
    dryRun:           false,
  };
}

function defaultStats(): UploadStats {
  return {
    total:              0,
    completed:          0,
    failed:             0,
    skipped:            0,
    retried:            0,
    duplicatesRenamed:  0,
    bytesProcessed:     0,
    elapsedMs:          0,
    estimatedRemainingMs: undefined,
    averageUploadMs:    undefined,
  };
}

// ─── SessionStore class ───────────────────────────────────────────────────────

class SessionStore {
  private readonly sessions = new Map<string, UploadSession>();
  /** guild → Set<sessionId> for slot counting */
  private readonly guildSessions = new Map<string, Set<string>>();
  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startGC();
  }

  /** Create a fresh upload session for the given guild/user/channel */
  create(params: {
    guildId:           string;
    userId:            string;
    channelId:         string;
    interactionToken:  string;
  }): UploadSession {
    const logger = getLogger();
    const guildCount = this.getActiveCountForGuild(params.guildId);

    if (guildCount >= MAX_ACTIVE_SESSIONS_PER_GUILD) {
      throw new Error(
        `This server already has ${guildCount} active upload sessions. ` +
        `Please wait for an existing session to finish before starting a new one.`,
      );
    }

    const id = randomUUID();
    const now = new Date();

    const session: UploadSession = {
      id,
      guildId:          params.guildId,
      userId:           params.userId,
      channelId:        params.channelId,
      interactionToken: params.interactionToken,
      status:           'idle',
      emojis:           [],
      results:          [],
      settings:         defaultSettings(),
      stats:            defaultStats(),
      createdAt:        now,
      updatedAt:        now,
      currentIndex:     0,
    };

    this.sessions.set(id, session);

    if (!this.guildSessions.has(params.guildId)) {
      this.guildSessions.set(params.guildId, new Set());
    }
    this.guildSessions.get(params.guildId)!.add(id);

    logger.info(`Session created`, { sessionId: id, guildId: params.guildId });
    return session;
  }

  /** Retrieve a session by ID */
  get(id: string): UploadSession | undefined {
    return this.sessions.get(id);
  }

  /** Get the most recent session for a user in a guild */
  getLatestForUser(guildId: string, userId: string): UploadSession | undefined {
    let latest: UploadSession | undefined;
    for (const session of this.sessions.values()) {
      if (session.guildId === guildId && session.userId === userId) {
        if (!latest || session.createdAt > latest.createdAt) {
          latest = session;
        }
      }
    }
    return latest;
  }

  /** Persist an updated session */
  update(id: string, partial: Partial<UploadSession>): UploadSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated: UploadSession = {
      ...session,
      ...partial,
      updatedAt: new Date(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  /** Mark a session as cancelled and clean up temp files */
  async destroy(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    this.sessions.delete(id);
    this.guildSessions.get(session.guildId)?.delete(id);

    if (session.extractDir) {
      try {
        await rm(session.extractDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }

    getLogger().info(`Session destroyed`, { sessionId: id });
  }

  /** Number of non-completed sessions active for a guild */
  getActiveCountForGuild(guildId: string): number {
    let count = 0;
    const ids = this.guildSessions.get(guildId);
    if (!ids) return 0;
    for (const id of ids) {
      const s = this.sessions.get(id);
      if (s && s.status !== 'completed' && s.status !== 'failed' && s.status !== 'cancelled') {
        count++;
      }
    }
    return count;
  }

  /** All sessions (for diagnostics) */
  all(): UploadSession[] {
    return Array.from(this.sessions.values());
  }

  /** Total number of sessions in memory */
  get size(): number {
    return this.sessions.size;
  }

  // ── GC ──────────────────────────────────────────────────────────────────────

  private startGC(): void {
    this.gcTimer = setInterval(() => {
      void this.runGC();
    }, 60_000);
    // Don't prevent process exit
    this.gcTimer.unref?.();
  }

  private async runGC(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      const age = now - session.updatedAt.getTime();
      if (age > SESSION_TIMEOUT_MS) {
        getLogger().debug(`GC: purging stale session`, { sessionId: id, ageMs: age });
        await this.destroy(id);
      }
    }
  }

  shutdown(): void {
    if (this.gcTimer) clearInterval(this.gcTimer);
  }
}

// ─── Export singleton ─────────────────────────────────────────────────────────

export const sessionStore = new SessionStore();
