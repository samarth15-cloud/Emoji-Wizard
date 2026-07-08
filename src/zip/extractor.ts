/**
 * Streaming ZIP extractor.
 *
 * Extracts only supported image files from the archive.
 * Uses Node.js streams throughout to avoid loading the entire ZIP into memory.
 * Performs zip-slip mitigation on every entry before writing.
 */

import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm, stat } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import unzipper from 'unzipper';
import type { EmojiFile, EmojiFormat } from '../types/index.js';
import { ZIP_LIMITS, DISCORD_LIMITS } from '../constants/index.js';
import { getLogger } from '../logging/logger.js';
import { processEmojiName } from '../emoji/processor.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHiddenOrMeta(entryPath: string): boolean {
  const base = path.basename(entryPath);
  if (base.startsWith('.')) return true;
  if (base.toLowerCase() === 'thumbs.db') return true;
  if (base.toLowerCase() === 'desktop.ini') return true;
  if (entryPath.includes('__MACOSX')) return true;
  return false;
}

function isSupportedEmoji(entryPath: string): boolean {
  const ext = path.extname(entryPath).toLowerCase();
  return ZIP_LIMITS.SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Resolve an entry path and confirm it stays within the extract root.
 * Returns undefined if the path would escape (zip-slip).
 */
function safeResolvePath(extractRoot: string, entryRelativePath: string): string | undefined {
  const resolved = path.resolve(extractRoot, entryRelativePath);
  const root = path.resolve(extractRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return undefined; // zip-slip detected
  }
  return resolved;
}

/**
 * Dangerous path patterns that should always be rejected.
 */
function hasDangerousPath(entryPath: string): boolean {
  return ZIP_LIMITS.DANGEROUS_PATH_PATTERNS.some(re => re.test(entryPath));
}

// ─── ExtractionResult ─────────────────────────────────────────────────────────

export interface ExtractionResult {
  /** Extracted emoji files ready for upload */
  emojis: EmojiFile[];
  /** Directory on disk containing extracted files */
  extractDir: string;
  /** Number of entries skipped due to security/format rules */
  skippedCount: number;
  /** Names of any files skipped */
  skippedNames: string[];
}

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Stream-extract a ZIP file and return a list of ready EmojiFile objects.
 *
 * @param zipPath       Absolute path to the ZIP on disk
 * @param baseTempDir   Parent temp directory (a sub-folder is created per session)
 * @param recursive     Whether to search nested folders (default: true)
 */
export async function extractZip(
  zipPath:     string,
  baseTempDir: string,
  recursive    = true,
): Promise<ExtractionResult> {
  const logger = getLogger();

  // Create a unique extraction directory
  const extractDir = path.join(baseTempDir, `emoji_${randomUUID()}`);
  await mkdir(extractDir, { recursive: true });

  const emojis: EmojiFile[] = [];
  const skippedNames: string[] = [];
  let skippedCount = 0;

  try {
    const readStream = createReadStream(zipPath);
    const zip = readStream.pipe(unzipper.Parse({ forceStream: true }));

    for await (const entry of zip) {
      const typedEntry = entry as unzipper.Entry;
      const entryPath: string = typedEntry.path;
      const entryType: string = typedEntry.type;

      // Skip directories
      if (entryType === 'Directory') {
        typedEntry.autodrain();
        continue;
      }

      // Apply security filters
      if (hasDangerousPath(entryPath) || isHiddenOrMeta(entryPath)) {
        typedEntry.autodrain();
        skippedCount++;
        continue;
      }

      // Skip non-image files
      if (!isSupportedEmoji(entryPath)) {
        typedEntry.autodrain();
        skippedCount++;
        skippedNames.push(path.basename(entryPath));
        continue;
      }

      // If not recursive, skip entries in sub-directories
      if (!recursive) {
        const parts = entryPath.split('/').filter(Boolean);
        if (parts.length > 1) {
          typedEntry.autodrain();
          skippedCount++;
          continue;
        }
      }

      // Flatten to a single output directory (no nested folders in output)
      const flatName = path.basename(entryPath);
      const destPath = safeResolvePath(extractDir, flatName);

      if (!destPath) {
        logger.warn(`Zip-slip attempt blocked: "${entryPath}"`);
        typedEntry.autodrain();
        skippedCount++;
        continue;
      }

      // Stream to disk
      const writeStream = createWriteStream(destPath);
      await pipeline(typedEntry, writeStream);

      // Verify the extracted file is non-empty
      let fileStat: Awaited<ReturnType<typeof stat>>;
      try {
        fileStat = await stat(destPath);
      } catch {
        skippedCount++;
        continue;
      }

      if (fileStat.size === 0) {
        skippedCount++;
        continue;
      }

      // Determine format and animated flag
      const ext = path.extname(flatName).toLowerCase().slice(1) as EmojiFormat;
      const isAnimated = ext === 'gif';

      // Normalise name
      const originalName = path.basename(flatName, path.extname(flatName));
      const processedName = processEmojiName(originalName);

      emojis.push({
        name:         processedName,
        originalName: flatName,
        path:         destPath,
        format:       ext,
        isAnimated,
        sizeBytes:    fileStat.size,
      });
    }

    logger.info(`Extraction complete`, {
      total:   emojis.length,
      skipped: skippedCount,
      dir:     extractDir,
    });

    return { emojis, extractDir, skippedCount, skippedNames };

  } catch (err) {
    // Clean up on failure
    await rm(extractDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(
      `ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
