/**
 * Core type definitions for the Discord Emoji ZIP Uploader Bot.
 *
 * All shared interfaces, enums, and error classes live here.
 * Modules should import from this file rather than re-declaring types.
 */

import type {
  GuildEmoji,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

// ─── Emoji File ───────────────────────────────────────────────────────────────

/** Supported image formats for Discord emojis */
export type EmojiFormat = 'png' | 'gif' | 'jpg' | 'jpeg' | 'webp';

/** A single emoji candidate extracted from a ZIP archive */
export interface EmojiFile {
  /** Normalized name suitable for Discord (lowercase, underscores, 2-32 chars) */
  name: string;
  /** Original filename as found in the ZIP */
  originalName: string;
  /** Absolute path to the extracted file on disk */
  path: string;
  /** Detected image format */
  format: EmojiFormat;
  /** True if the file is an animated GIF */
  isAnimated: boolean;
  /** File size in bytes */
  sizeBytes: number;
  /** Image width in pixels (if determinable) */
  width?: number;
  /** Image height in pixels (if determinable) */
  height?: number;
}

// ─── Upload Session ───────────────────────────────────────────────────────────

/** Lifecycle status of an upload session */
export type UploadStatus =
  | 'idle'
  | 'validating'
  | 'extracting'
  | 'processing'
  | 'awaiting_file'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** State of a single emoji within the upload pipeline */
export type EmojiUploadState =
  | 'pending'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying'
  | 'cancelled';

/** Result record for a single emoji upload attempt */
export interface EmojiUploadResult {
  file: EmojiFile;
  state: EmojiUploadState;
  emoji?: GuildEmoji;
  error?: string;
  retries: number;
  durationMs: number;
  finalName: string;
}

/** Per-session configurable upload behaviour */
export interface UploadSettings {
  /** Number of parallel uploads (1–10) */
  concurrency: number;
  /** Max retry attempts per emoji (0–10) */
  maxRetries: number;
  /** Base delay in ms for exponential backoff */
  retryDelayBaseMs: number;
  /** Automatically rename duplicate emoji names */
  autoRename: boolean;
  /** Skip emojis whose names already exist on the server */
  skipDuplicates: boolean;
  /** How often (ms) to update the progress panel */
  progressIntervalMs: number;
  /** Upload animated emojis before static ones */
  animatedPriority: boolean;
  /** Recursively search nested folders in the ZIP */
  recursive: boolean;
  /** Reject emojis exceeding dimension/size limits */
  strictValidation: boolean;
  /** Console log verbosity */
  logVerbosity: 'quiet' | 'normal' | 'verbose';
  /** Simulate upload without making API calls */
  dryRun: boolean;
}

/** Aggregate statistics for an upload session */
export interface UploadStats {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  retried: number;
  duplicatesRenamed: number;
  bytesProcessed: number;
  elapsedMs: number;
  estimatedRemainingMs?: number;
  averageUploadMs?: number;
}

/** Full upload session state – stored in SessionStore */
export interface UploadSession {
  id: string;
  guildId: string;
  userId: string;
  channelId: string;
  /** Discord interaction token (valid for 15 min; used for deferred edits) */
  interactionToken: string;
  /** ID of the live progress message to edit */
  messageId?: string;
  status: UploadStatus;
  /** Local path to the extracted ZIP temp directory */
  extractDir?: string;
  /** Original attachment URL from Discord CDN */
  zipUrl?: string;
  /** Original ZIP filename */
  zipFilename?: string;
  /** All discovered emoji files */
  emojis: EmojiFile[];
  /** Completed result records */
  results: EmojiUploadResult[];
  settings: UploadSettings;
  stats: UploadStats;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Fatal error message */
  error?: string;
  /** Index of current item in the queue for UI display */
  currentIndex: number;
  /** Currently uploading emoji name */
  currentEmoji?: string;
}

// ─── ZIP Validation ───────────────────────────────────────────────────────────

/** Structured result from ZIP pre-validation */
export interface ZipValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileCount: number;
  totalSize: number;
  emojiCount: number;
  animatedCount: number;
  staticCount: number;
  nestedFolders: boolean;
  duplicateNames: string[];
  unsupportedFiles: string[];
}

// ─── Command & Event Interfaces ───────────────────────────────────────────────

/** A registered slash command with its execution handler */
export interface SlashCommand {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

/** A Discord.js event listener */
export interface BotEvent {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<void> | void;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

/** An item in the emoji upload queue */
export interface QueueItem {
  id: string;
  sessionId: string;
  file: EmojiFile;
  attempt: number;
  enqueuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  state: EmojiUploadState;
  error?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Resolved bot configuration (from environment variables) */
export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  maxZipSizeMb: number;
  tempDir: string;
  logLevel: string;
  logDir: string;
  defaultConcurrency: number;
  defaultMaxRetries: number;
  progressIntervalMs: number;
}

// ─── Emoji Slots ──────────────────────────────────────────────────────────────

/** Server emoji capacity breakdown */
export interface EmojiSlots {
  total: number;
  used: number;
  available: number;
  animatedTotal: number;
  animatedUsed: number;
  animatedAvailable: number;
  staticTotal: number;
  staticUsed: number;
  staticAvailable: number;
}

// ─── Interaction Aliases ──────────────────────────────────────────────────────

export type AnyButtonInteraction = ButtonInteraction;
export type AnySelectMenuInteraction = StringSelectMenuInteraction;
export type AnyModalInteraction = ModalSubmitInteraction;

// ─── Custom Error Classes ─────────────────────────────────────────────────────

/** Base error class for all bot-specific errors */
export class BotError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;

  constructor(message: string, code: string, recoverable = true) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

/** Thrown when ZIP pre-validation fails */
export class ZipValidationError extends BotError {
  public readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message, 'ZIP_VALIDATION_ERROR', false);
    this.name = 'ZipValidationError';
    this.details = details;
  }
}

/** Thrown when an individual emoji upload fails */
export class EmojiUploadError extends BotError {
  public readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message, 'EMOJI_UPLOAD_ERROR', retryable);
    this.name = 'EmojiUploadError';
    this.retryable = retryable;
  }
}

/** Thrown when Discord responds with 429 Too Many Requests */
export class RateLimitError extends BotError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`, 'RATE_LIMIT', true);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown when the bot lacks required Discord permissions */
export class PermissionError extends BotError {
  constructor(message: string) {
    super(message, 'PERMISSION_ERROR', false);
    this.name = 'PermissionError';
  }
}

/** Thrown when the server has no remaining emoji slots */
export class NoSlotsError extends BotError {
  constructor(public readonly slotsNeeded: number) {
    super(
      `Server has no available emoji slots. ${slotsNeeded} slots needed.`,
      'NO_SLOTS',
      false,
    );
    this.name = 'NoSlotsError';
  }
}
