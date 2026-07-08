/**
 * Modal builders for the emoji uploader.
 *
 * Discord modals contain TextInputs only – file attachments
 * are not supported.  This module provides the settings modal.
 */

import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { CUSTOM_IDS } from '../constants/index.js';
import type { UploadSettings } from '../types/index.js';

/**
 * Build the settings configuration modal.
 * Pre-fills inputs with the current session settings.
 */
export function buildSettingsModal(current: UploadSettings): ModalBuilder {
  const concurrencyInput = new TextInputBuilder()
    .setCustomId('setting_concurrency')
    .setLabel('Upload Concurrency (1–10)')
    .setStyle(TextInputStyle.Short)
    .setValue(String(current.concurrency))
    .setMinLength(1)
    .setMaxLength(2)
    .setPlaceholder('2')
    .setRequired(true);

  const retriesInput = new TextInputBuilder()
    .setCustomId('setting_retries')
    .setLabel('Max Retries per Emoji (0–10)')
    .setStyle(TextInputStyle.Short)
    .setValue(String(current.maxRetries))
    .setMinLength(1)
    .setMaxLength(2)
    .setPlaceholder('3')
    .setRequired(true);

  const intervalInput = new TextInputBuilder()
    .setCustomId('setting_interval')
    .setLabel('Progress Update Interval (ms, 500–10000)')
    .setStyle(TextInputStyle.Short)
    .setValue(String(current.progressIntervalMs))
    .setMinLength(3)
    .setMaxLength(5)
    .setPlaceholder('2000')
    .setRequired(true);

  const flagsInput = new TextInputBuilder()
    .setCustomId('setting_flags')
    .setLabel('Flags (auto_rename, skip_dup, animated_first, dry_run)')
    .setStyle(TextInputStyle.Short)
    .setValue(buildFlagsString(current))
    .setMinLength(0)
    .setMaxLength(80)
    .setPlaceholder('auto_rename animated_first')
    .setRequired(false);

  return new ModalBuilder()
    .setCustomId(CUSTOM_IDS.SETTINGS_MODAL)
    .setTitle('⚙️ Upload Settings')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(concurrencyInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(retriesInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(intervalInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(flagsInput),
    );
}

/**
 * Parse the flags field from the modal submission back into settings.
 */
export function parseModalSettings(
  concurrencyStr: string,
  retriesStr:     string,
  intervalStr:    string,
  flagsStr:       string,
  current:        UploadSettings,
): Partial<UploadSettings> {
  const flags = flagsStr.toLowerCase().split(/[\s,]+/).filter(Boolean);

  const concurrency = parseInt(concurrencyStr, 10);
  const maxRetries  = parseInt(retriesStr, 10);
  const intervalMs  = parseInt(intervalStr, 10);

  return {
    concurrency:       Number.isFinite(concurrency) ? Math.min(10, Math.max(1, concurrency)) : current.concurrency,
    maxRetries:        Number.isFinite(maxRetries)  ? Math.min(10, Math.max(0, maxRetries))  : current.maxRetries,
    progressIntervalMs: Number.isFinite(intervalMs) ? Math.min(10_000, Math.max(500, intervalMs)) : current.progressIntervalMs,
    autoRename:         flags.includes('auto_rename')    || (!flags.includes('no_auto_rename') && current.autoRename),
    skipDuplicates:     flags.includes('skip_dup')       || (!flags.includes('no_skip_dup') && current.skipDuplicates),
    animatedPriority:   flags.includes('animated_first') || (!flags.includes('no_animated_first') && current.animatedPriority),
    dryRun:             flags.includes('dry_run'),
    strictValidation:   !flags.includes('lenient'),
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildFlagsString(s: UploadSettings): string {
  const flags: string[] = [];
  if (s.autoRename)       flags.push('auto_rename');
  if (s.skipDuplicates)   flags.push('skip_dup');
  if (s.animatedPriority) flags.push('animated_first');
  if (s.dryRun)           flags.push('dry_run');
  if (!s.strictValidation) flags.push('lenient');
  return flags.join(' ');
}
