/**
 * Global error event handlers for the Discord client and Node.js process.
 *
 * Prevents unhandled promise rejections and client errors from crashing the bot.
 * Logs all errors with full context for post-mortem analysis.
 */

import type { BotEvent } from '../types/index.js';
import { getLogger } from '../logging/logger.js';

// ─── Discord client error ─────────────────────────────────────────────────────

const clientErrorEvent: BotEvent = {
  name: 'error',
  execute(error: Error) {
    getLogger().error('Discord client error', {
      message: error.message,
      stack:   error.stack,
    });
  },
};

// ─── Discord client warn ──────────────────────────────────────────────────────

const clientWarnEvent: BotEvent = {
  name: 'warn',
  execute(message: string) {
    getLogger().warn(`Discord client warning: ${message}`);
  },
};

// ─── Discord shard disconnect ─────────────────────────────────────────────────

const shardDisconnectEvent: BotEvent = {
  name: 'shardDisconnect',
  execute(event: CloseEvent, shardId: number) {
    getLogger().warn(`Shard ${shardId} disconnected`, {
      code:   event.code,
      reason: event.reason,
    });
  },
};

// ─── Discord shard reconnecting ───────────────────────────────────────────────

const shardReconnectingEvent: BotEvent = {
  name: 'shardReconnecting',
  execute(shardId: number) {
    getLogger().info(`Shard ${shardId} reconnecting…`);
  },
};

// ─── Discord shard resume ─────────────────────────────────────────────────────

const shardResumeEvent: BotEvent = {
  name: 'shardResume',
  execute(shardId: number, replayedEvents: number) {
    getLogger().info(`Shard ${shardId} resumed (${replayedEvents} events replayed)`);
  },
};

// ─── Process-level handlers (registered in index.ts) ─────────────────────────

export function registerProcessHandlers(): void {
  const logger = getLogger();

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack:  reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      message: error.message,
      stack:   error.stack,
    });
    // Give logger time to flush before exiting
    setTimeout(() => process.exit(1), 1_000).unref();
  });

  process.on('SIGINT', () => {
    logger.info('Received SIGINT — shutting down gracefully…');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM — shutting down gracefully…');
    process.exit(0);
  });
}

export default [
  clientErrorEvent,
  clientWarnEvent,
  shardDisconnectEvent,
  shardReconnectingEvent,
  shardResumeEvent,
];
