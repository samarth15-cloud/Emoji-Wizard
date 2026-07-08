/**
 * ZIP pre-validation.
 *
 * Performs all security and sanity checks before extraction begins.
 * Returns a structured result with errors, warnings, and statistics.
 */

import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import unzipper from 'unzipper';
import type { ZipValidationResult } from '../types/index.js';
import { ZIP_LIMITS, DISCORD_LIMITS } from '../constants/index.js';
import { getLogger } from '../logging/logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDangerousPath(entryPath: string): boolean {
  return ZIP_LIMITS.DANGEROUS_PATH_PATTERNS.some(p => p.test(entryPath));
}

function isSupportedEmojiFile(entryPath: string): boolean {
  const ext = path.extname(entryPath).toLowerCase();
  return ZIP_LIMITS.SUPPORTED_EXTENSIONS.has(ext);
}

function isHiddenFile(entryPath: string): boolean {
  const basename = path.basename(entryPath);
  return basename.startsWith('.');
}

function isMacOSMetadata(entryPath: string): boolean {
  return entryPath.includes('__MACOSX') || entryPath.includes('.DS_Store');
}

function isWindowsMetadata(entryPath: string): boolean {
  const lower = entryPath.toLowerCase();
  return lower.endsWith('thumbs.db') || lower.endsWith('desktop.ini');
}

/**
 * Check for zip-slip vulnerability:
 * An entry's resolved path must remain inside the intended extract directory.
 */
function hasZipSlip(entryPath: string, extractBase: string): boolean {
  const resolved = path.resolve(extractBase, entryPath);
  return !resolved.startsWith(path.resolve(extractBase) + path.sep) &&
         resolved !== path.resolve(extractBase);
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate a ZIP file without extracting it.
 *
 * @param zipPath   Absolute path to the ZIP on disk
 * @param maxBytes  Maximum allowed ZIP size (from config)
 */
export async function validateZip(
  zipPath: string,
  maxBytes: number,
): Promise<ZipValidationResult> {
  const logger = getLogger();

  const result: ZipValidationResult = {
    valid:          false,
    errors:         [],
    warnings:       [],
    fileCount:      0,
    totalSize:      0,
    emojiCount:     0,
    animatedCount:  0,
    staticCount:    0,
    nestedFolders:  false,
    duplicateNames: [],
    unsupportedFiles: [],
  };

  // ── 1. File existence and size ─────────────────────────────────────────────
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(zipPath);
  } catch {
    result.errors.push('ZIP file not found or inaccessible.');
    return result;
  }

  if (!fileStat.isFile()) {
    result.errors.push('Provided path is not a file.');
    return result;
  }

  if (fileStat.size === 0) {
    result.errors.push('ZIP file is empty (0 bytes).');
    return result;
  }

  if (fileStat.size > maxBytes) {
    result.errors.push(
      `ZIP file is too large: ${(fileStat.size / 1024 / 1024).toFixed(1)} MB ` +
      `(limit: ${(maxBytes / 1024 / 1024).toFixed(0)} MB).`,
    );
    return result;
  }

  // ── 2. Parse central directory ─────────────────────────────────────────────
  let entries: Array<{ path: string; type: string; compressedSize: number; uncompressedSize: number }>;

  try {
    const stream = createReadStream(zipPath);
    const zip = stream.pipe(unzipper.Parse({ forceStream: true }));

    entries = await new Promise((resolve, reject) => {
      const collected: typeof entries = [];
      zip.on('entry', entry => {
        collected.push({
          path:             entry.path as string,
          type:             entry.type as string,
          compressedSize:   Number((entry.extra as { compressedSize?: number }).compressedSize ?? 0),
          uncompressedSize: Number(entry.vars?.uncompressedSize ?? 0),
        });
        entry.autodrain(); // Don't hold buffers in memory
      });
      zip.on('finish', () => resolve(collected));
      zip.on('error', reject);
      stream.on('error', reject);
    });
  } catch (err) {
    result.errors.push(
      `Cannot read ZIP: ${err instanceof Error ? err.message : 'unknown error'}. ` +
      'The file may be corrupted or not a valid ZIP archive.',
    );
    return result;
  }

  if (entries.length === 0) {
    result.errors.push('ZIP archive contains no entries.');
    return result;
  }

  if (entries.length > ZIP_LIMITS.MAX_FILES) {
    result.errors.push(
      `ZIP contains ${entries.length} entries, exceeding the limit of ${ZIP_LIMITS.MAX_FILES}.`,
    );
    return result;
  }

  // ── 3. Entry-level checks ──────────────────────────────────────────────────
  const emojiNamesFound = new Map<string, number>(); // normalised name → count
  const extractBase = '/safe_extract_check'; // Dummy for zip-slip detection

  for (const entry of entries) {
    const entryPath = entry.path;

    // Directories
    if (entry.type === 'Directory') {
      const depth = entryPath.split('/').filter(Boolean).length;
      if (depth > 1) result.nestedFolders = true;
      continue;
    }

    result.fileCount++;
    result.totalSize += entry.uncompressedSize;

    // Security: zip-slip
    if (hasZipSlip(entryPath, extractBase)) {
      result.errors.push(`Dangerous path detected (zip-slip): "${entryPath}"`);
      continue;
    }

    // Security: dangerous path patterns
    if (isDangerousPath(entryPath)) {
      // Skip macOS/Windows metadata silently
      if (isMacOSMetadata(entryPath) || isWindowsMetadata(entryPath)) continue;
      if (isHiddenFile(entryPath)) continue;
      result.warnings.push(`Skipping suspicious entry: "${entryPath}"`);
      continue;
    }

    if (isHiddenFile(path.basename(entryPath))) continue;
    if (isMacOSMetadata(entryPath) || isWindowsMetadata(entryPath)) continue;

    // Check extension
    if (!isSupportedEmojiFile(entryPath)) {
      result.unsupportedFiles.push(path.basename(entryPath));
      continue;
    }

    // Count emojis
    result.emojiCount++;
    const ext = path.extname(entryPath).toLowerCase();
    if (ext === '.gif') {
      result.animatedCount++;
    } else {
      result.staticCount++;
    }

    // Track for duplicates
    const baseName = path.basename(entryPath, ext).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    emojiNamesFound.set(baseName, (emojiNamesFound.get(baseName) ?? 0) + 1);
  }

  // ── 4. Duplicate detection ─────────────────────────────────────────────────
  for (const [name, count] of emojiNamesFound) {
    if (count > 1) {
      result.duplicateNames.push(name);
    }
  }

  // ── 5. Summary warnings ────────────────────────────────────────────────────
  if (result.emojiCount === 0) {
    result.errors.push(
      'No supported image files found in the ZIP. ' +
      'Supported formats: .png, .gif, .jpg, .jpeg, .webp',
    );
    return result;
  }

  if (result.unsupportedFiles.length > 0) {
    result.warnings.push(
      `Skipping ${result.unsupportedFiles.length} unsupported file(s): ` +
      result.unsupportedFiles.slice(0, 5).join(', ') +
      (result.unsupportedFiles.length > 5 ? ` …+${result.unsupportedFiles.length - 5} more` : ''),
    );
  }

  if (result.duplicateNames.length > 0) {
    result.warnings.push(
      `${result.duplicateNames.length} duplicate emoji name(s) detected inside the ZIP.`,
    );
  }

  if (result.nestedFolders) {
    result.warnings.push('ZIP contains nested folders. All emoji files will be flattened.');
  }

  logger.debug('ZIP validation complete', {
    emojiCount:  result.emojiCount,
    errors:      result.errors.length,
    warnings:    result.warnings.length,
  });

  result.valid = result.errors.length === 0;
  return result;
}
