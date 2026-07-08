/**
 * Emoji name normalisation and deduplication.
 *
 * Discord emoji names must:
 *  - Be 2-32 characters long
 *  - Contain only a-z, 0-9, and underscores
 *  - Be unique per server
 *
 * This module handles all transformations to reach that state.
 */

import { DISCORD_LIMITS } from '../constants/index.js';

// ─── Core normalisation ───────────────────────────────────────────────────────

/**
 * Normalise a raw filename (without extension) into a valid Discord emoji name.
 *
 * Pipeline:
 *   1. Strip file extension if accidentally included
 *   2. Trim surrounding whitespace
 *   3. Lowercase everything
 *   4. Replace Unicode emoji / special chars with an underscore
 *   5. Replace runs of spaces/hyphens/dots with underscore
 *   6. Remove all remaining disallowed characters
 *   7. Collapse consecutive underscores
 *   8. Strip leading/trailing underscores
 *   9. Enforce 2-32 character length
 *  10. Pad extremely short names with suffix
 */
export function processEmojiName(rawName: string): string {
  let name = rawName;

  // Strip extension if present
  const extMatch = name.match(/\.[a-z]{2,5}$/i);
  if (extMatch) name = name.slice(0, name.length - extMatch[0].length);

  // Trim
  name = name.trim();

  // Lowercase
  name = name.toLowerCase();

  // Replace common Unicode categories with underscores
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0100-\uFFFF\u{1F000}-\u{10FFFF}]/gu, '_');

  // Replace separators (space, hyphen, dot, slash) with underscores
  name = name.replace(/[\s\-./\\]+/g, '_');

  // Remove all characters that are not a-z, 0-9, or underscore
  name = name.replace(/[^a-z0-9_]/g, '');

  // Collapse consecutive underscores
  name = name.replace(/_+/g, '_');

  // Strip leading/trailing underscores
  name = name.replace(/^_+|_+$/g, '');

  // Truncate to max length
  if (name.length > DISCORD_LIMITS.EMOJI_NAME_MAX_LENGTH) {
    name = name.slice(0, DISCORD_LIMITS.EMOJI_NAME_MAX_LENGTH);
    // Re-strip trailing underscore that truncation may introduce
    name = name.replace(/_+$/, '');
  }

  // Pad if too short
  if (name.length < DISCORD_LIMITS.EMOJI_NAME_MIN_LENGTH) {
    name = name.padEnd(DISCORD_LIMITS.EMOJI_NAME_MIN_LENGTH, '0');
  }

  // Final fallback — should never be reached but ensures safety
  if (name.length < 2) name = 'emoji';

  return name;
}

// ─── Duplicate resolution ─────────────────────────────────────────────────────

/**
 * Given a desired emoji name and a set of already-used names,
 * return a unique name by appending an incrementing numeric suffix.
 *
 * @param desired   The normalised name we'd like to use
 * @param usedNames Set of names already claimed (will be mutated with the chosen name)
 */
export function resolveUniqueName(
  desired:   string,
  usedNames: Set<string>,
): string {
  if (!usedNames.has(desired)) {
    usedNames.add(desired);
    return desired;
  }

  // Try appending _2, _3, … up to _999
  for (let i = 2; i <= 999; i++) {
    const candidate = makeNameWithSuffix(desired, i);
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  // Ultra-fallback: use a timestamp slice
  const ts = Date.now().toString(36).slice(-4);
  const fallback = makeNameWithSuffix(desired, ts);
  usedNames.add(fallback);
  return fallback;
}

/**
 * Append a numeric or string suffix to a name while respecting the 32-char limit.
 */
function makeNameWithSuffix(base: string, suffix: number | string): string {
  const s = `_${suffix}`;
  const maxBase = DISCORD_LIMITS.EMOJI_NAME_MAX_LENGTH - s.length;
  return base.slice(0, maxBase) + s;
}

// ─── Batch deduplication ──────────────────────────────────────────────────────

/**
 * Process a batch of raw names and return a map of { rawName → uniqueName }.
 * Existing server emoji names can be passed via `existingNames` to avoid conflicts.
 */
export function deduplicateNames(
  rawNames:      string[],
  existingNames: string[] = [],
): Map<string, string> {
  const used = new Set(existingNames);
  const result = new Map<string, string>();

  for (const raw of rawNames) {
    const normalised = processEmojiName(raw);
    const unique     = resolveUniqueName(normalised, used);
    result.set(raw, unique);
  }

  return result;
}

// ─── Validation predicate ─────────────────────────────────────────────────────

/** Returns true if the name is already a valid Discord emoji name */
export function isValidEmojiName(name: string): boolean {
  return DISCORD_LIMITS.EMOJI_NAME_PATTERN.test(name);
}
