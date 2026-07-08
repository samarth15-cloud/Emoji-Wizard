/**
 * Application-wide constants.
 *
 * All magic numbers, string literals, and configuration defaults live here.
 * Never scatter hard-coded values across modules.
 */

// ─── Discord API Limits ───────────────────────────────────────────────────────

export const DISCORD_LIMITS = {
  EMOJI_NAME_MIN_LENGTH: 2,
  EMOJI_NAME_MAX_LENGTH: 32,
  /** Maximum raw file size Discord accepts for an emoji upload */
  EMOJI_MAX_SIZE_BYTES: 256 * 1024,
  /** Discord renders emojis at 128×128 maximum */
  EMOJI_MAX_DIMENSION: 128,
  /** Allowed characters in an emoji name */
  EMOJI_NAME_PATTERN: /^[a-z0-9_]{2,32}$/,
  /** Emoji slots per server boost level */
  EMOJI_SLOTS_PER_LEVEL: {
    0: 50,
    1: 100,
    2: 150,
    3: 250,
  } as Record<number, number>,
} as const;

// ─── ZIP Limits ───────────────────────────────────────────────────────────────

export const ZIP_LIMITS = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024,
  MAX_FILES: 2000,
  SUPPORTED_EXTENSIONS: new Set(['.png', '.gif', '.jpg', '.jpeg', '.webp']),
  /** Regexp patterns whose matches are always rejected (security & junk) */
  DANGEROUS_PATH_PATTERNS: [
    /\.\./,           // Directory traversal
    /^\/|^\\/,        // Absolute paths
    /^__MACOSX/i,     // macOS resource fork directories
    /\.DS_Store$/i,   // macOS Finder metadata
    /^Thumbs\.db$/i,  // Windows thumbnail cache
    /^desktop\.ini$/i,// Windows folder config
    /[<>:"|?*\x00-\x1f]/, // Illegal filename characters
  ] as RegExp[],
} as const;

// ─── Queue Defaults ───────────────────────────────────────────────────────────

export const QUEUE_DEFAULTS = {
  CONCURRENCY: 2,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE_MS: 1_000,
  RETRY_DELAY_MAX_MS: 30_000,
  RETRY_FACTOR: 2,
  PROGRESS_INTERVAL_MS: 2_000,
} as const;

// ─── Timeouts ─────────────────────────────────────────────────────────────────

/** How long an upload session lives before being garbage-collected */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1_000;

/** How long the bot waits for the user to send their ZIP file */
export const UPLOAD_COLLECT_TIMEOUT_MS = 90 * 1_000;

/** Grace period after which we stop editing a deferred message (Discord token expires) */
export const INTERACTION_TOKEN_LIFETIME_MS = 14 * 60 * 1_000;

/** Max concurrent active sessions per guild */
export const MAX_ACTIVE_SESSIONS_PER_GUILD = 3;

// ─── UI Colors (Hex for ContainerBuilder accent) ─────────────────────────────

export const COLORS = {
  PRIMARY:  0x5865F2,
  SUCCESS:  0x57F287,
  WARNING:  0xFEE75C,
  ERROR:    0xED4245,
  INFO:     0x5865F2,
  NEUTRAL:  0x99AAB5,
  PURPLE:   0x9B59B6,
  GOLD:     0xF1C40F,
  DARK:     0x2F3136,
} as const;

// ─── Button & Select Custom IDs ───────────────────────────────────────────────

/**
 * All component custom IDs used in the bot.
 * Keep them short (Discord limit: 100 chars) and consistent.
 */
export const CUSTOM_IDS = {
  // ── Main dashboard navigation
  UPLOAD_START:       'eu:upload',
  SETTINGS_OPEN:      'eu:settings',
  ADVANCED_OPEN:      'eu:advanced',
  HELP_OPEN:          'eu:help',
  DASHBOARD_REFRESH:  'eu:refresh',
  CANCEL:             'eu:cancel',

  // ── Duplicate-handling choices
  DUP_SKIP:           'eu:dup:skip',
  DUP_RENAME:         'eu:dup:rename',
  DUP_OVERWRITE:      'eu:dup:overwrite',
  DUP_CANCEL:         'eu:dup:cancel',

  // ── Upload runtime controls
  UPLOAD_PAUSE:       'eu:ctrl:pause',
  UPLOAD_RESUME:      'eu:ctrl:resume',
  UPLOAD_ABORT:       'eu:ctrl:abort',

  // ── Settings modal & selects
  SETTINGS_MODAL:     'eu:modal:settings',
  SETTINGS_SAVE:      'eu:settings:save',
  SETTINGS_RESET:     'eu:settings:reset',
  SELECT_CONCURRENCY: 'eu:sel:conc',
  SELECT_RETRIES:     'eu:sel:retry',
  SELECT_LOG_LEVEL:   'eu:sel:log',

  // ── Completion actions
  COMPLETION_DONE:    'eu:done',
  COMPLETION_LOG:     'eu:done:log',
  COMPLETION_STATS:   'eu:done:stats',
} as const;

// ─── Emoji Icons for UI ───────────────────────────────────────────────────────

export const ICONS = {
  UPLOAD:    '📤',
  SUCCESS:   '✅',
  ERROR:     '❌',
  WARNING:   '⚠️',
  INFO:      'ℹ️',
  LOADING:   '⏳',
  SETTINGS:  '⚙️',
  HELP:      '❓',
  REFRESH:   '🔄',
  CANCEL:    '🚫',
  QUEUE:     '📋',
  SERVER:    '🏠',
  STATS:     '📊',
  TIMER:     '⏱️',
  MEMORY:    '💾',
  SPEED:     '⚡',
  RETRY:     '🔁',
  SKIP:      '⏭️',
  COMPLETE:  '🎉',
  ANIMATED:  '🎬',
  STATIC:    '🖼️',
  ZIP:       '🗜️',
  LOCK:      '🔒',
  SHIELD:    '🛡️',
  ROBOT:     '🤖',
  SPARKLE:   '✨',
  FIRE:      '🔥',
  STAR:      '⭐',
  DRY_RUN:   '🧪',
  PAUSE:     '⏸️',
  PLAY:      '▶️',
  STOP:      '⏹️',
  CHART:     '📈',
  FOLDER:    '📁',
  FILE:      '📄',
  PENCIL:    '✏️',
  LINK:      '🔗',
  BELL:      '🔔',
  CLOCK:     '🕐',
  WAVE:      '👋',
  PACKAGE:   '📦',
  WRENCH:    '🔧',
  EMOJI:     '😀',
} as const;

// ─── Progress Bar ─────────────────────────────────────────────────────────────

export const PROGRESS_BAR = {
  FILLED:  '█',
  PARTIAL: '▓',
  EMPTY:   '░',
  WIDTH:   20,
} as const;

// ─── Boost-Level Emoji Slot Map ───────────────────────────────────────────────

export function getEmojiSlotsByBoostLevel(boostLevel: number): number {
  const slots = DISCORD_LIMITS.EMOJI_SLOTS_PER_LEVEL;
  return slots[boostLevel] ?? slots[0];
}
