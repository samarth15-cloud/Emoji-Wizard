/**
 * StringSelectMenu builders for the settings panel.
 */

import {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { CUSTOM_IDS } from '../constants/index.js';
import type { UploadSettings } from '../types/index.js';

// ─── Concurrency select ───────────────────────────────────────────────────────

export function buildConcurrencySelect(current: number): StringSelectMenuBuilder {
  const options = [1, 2, 3, 4, 5, 6, 8, 10].map(n =>
    new StringSelectMenuOptionBuilder()
      .setValue(String(n))
      .setLabel(`${n} simultaneous upload${n > 1 ? 's' : ''}`)
      .setDescription(n <= 2 ? 'Safe – respects rate limits' : n <= 5 ? 'Moderate' : 'Aggressive (may hit limits)')
      .setEmoji(n === 2 ? '✅' : n <= 4 ? '⚡' : '🔥')
      .setDefault(n === current),
  );

  return new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.SELECT_CONCURRENCY)
    .setPlaceholder('Select upload concurrency…')
    .addOptions(options);
}

// ─── Retry count select ───────────────────────────────────────────────────────

export function buildRetrySelect(current: number): StringSelectMenuBuilder {
  const options = [0, 1, 2, 3, 5, 7, 10].map(n =>
    new StringSelectMenuOptionBuilder()
      .setValue(String(n))
      .setLabel(`${n} retr${n === 1 ? 'y' : 'ies'} per emoji`)
      .setDescription(n === 0 ? 'No retries' : n <= 3 ? 'Recommended' : 'High – slow but resilient')
      .setDefault(n === current),
  );

  return new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.SELECT_RETRIES)
    .setPlaceholder('Select max retries…')
    .addOptions(options);
}

// ─── Log verbosity select ─────────────────────────────────────────────────────

export function buildLogLevelSelect(
  current: UploadSettings['logVerbosity'],
): StringSelectMenuBuilder {
  const options: Array<{ value: UploadSettings['logVerbosity']; label: string; desc: string }> = [
    { value: 'quiet',   label: 'Quiet',   desc: 'Errors only' },
    { value: 'normal',  label: 'Normal',  desc: 'Progress + key events (recommended)' },
    { value: 'verbose', label: 'Verbose', desc: 'All events including retries + skips' },
  ];

  return new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_IDS.SELECT_LOG_LEVEL)
    .setPlaceholder('Select log verbosity…')
    .addOptions(
      options.map(o =>
        new StringSelectMenuOptionBuilder()
          .setValue(o.value)
          .setLabel(o.label)
          .setDescription(o.desc)
          .setDefault(o.value === current),
      ),
    );
}
