/**
 * Completion panel builder.
 *
 * Displayed when an upload session finishes (success, partial, or cancelled).
 * Shows a beautiful summary of every metric.
 */

import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import type { UploadSession } from '../types/index.js';
import { COLORS, ICONS } from '../constants/index.js';
import { btnDone, btnNewUpload, btnViewStats } from '../components/buttons.js';
import {
  formatDuration,
  formatBytes,
  buildProgressBar,
  formatSpeed,
} from '../utils/format.js';

// ─── Completion panel ─────────────────────────────────────────────────────────

/**
 * Build the completion / summary panel.
 */
export function buildCompletionPanel(session: UploadSession): ContainerBuilder {
  const stats  = session.stats;
  const s      = session.settings;
  const total  = stats.total;
  const failed = stats.failed;

  // Overall outcome classification
  const allPassed  = failed === 0 && stats.completed > 0;
  const allFailed  = stats.completed === 0 && failed > 0;
  const cancelled  = session.status === 'cancelled';
  const dryRun     = s.dryRun;

  let headline: string;
  let accentColor: number;

  if (cancelled) {
    headline    = `${ICONS.CANCEL} Upload Cancelled`;
    accentColor = COLORS.NEUTRAL;
  } else if (dryRun) {
    headline    = `${ICONS.DRY_RUN} Dry Run Complete — No Emojis Were Created`;
    accentColor = COLORS.GOLD;
  } else if (allPassed) {
    headline    = `${ICONS.COMPLETE} All Emojis Uploaded Successfully!`;
    accentColor = COLORS.SUCCESS;
  } else if (allFailed) {
    headline    = `${ICONS.ERROR} Upload Failed — No Emojis Uploaded`;
    accentColor = COLORS.ERROR;
  } else {
    headline    = `${ICONS.WARNING} Upload Finished with Partial Success`;
    accentColor = COLORS.WARNING;
  }

  // Progress bar
  const successPct = total > 0 ? (stats.completed / total) * 100 : 0;
  const bar        = buildProgressBar(successPct);

  // Timing
  const elapsed = formatDuration(stats.elapsedMs);
  const speed   = stats.averageUploadMs ? formatSpeed(stats.averageUploadMs) : '—';

  // Duration range
  const startLabel = session.startedAt
    ? session.startedAt.toLocaleTimeString('en-US', { hour12: false })
    : '—';
  const endLabel   = session.completedAt
    ? session.completedAt.toLocaleTimeString('en-US', { hour12: false })
    : '—';

  const container = new ContainerBuilder()
    .setAccentColor(accentColor);

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${headline}`,
    ),
    new TextDisplayBuilder().setContent(
      `${bar}  **${Math.round(successPct)}%** success rate`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Results summary
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.STATS} Upload Results\n` +
      `${ICONS.SUCCESS} **Completed**         ${stats.completed}\n` +
      `${ICONS.ERROR}  **Failed**            ${stats.failed}\n` +
      `${ICONS.SKIP}  **Skipped**           ${stats.skipped}\n` +
      `${ICONS.PENCIL ?? '✏️'}  **Renamed (dedup)**   ${stats.duplicatesRenamed}\n` +
      `${ICONS.RETRY}  **Total Retries**     ${stats.retried}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  // Performance stats
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.TIMER} Performance\n` +
      `${ICONS.CLOCK}  **Start → End**      ${startLabel} → ${endLabel}\n` +
      `${ICONS.TIMER}  **Total Time**       ${elapsed}\n` +
      `${ICONS.SPEED}  **Avg Speed**        ${speed}\n` +
      `${ICONS.MEMORY}  **Data Processed**   ${formatBytes(stats.bytesProcessed)}\n` +
      `${ICONS.SPEED}  **Concurrency**      ${s.concurrency} parallel`,
    ),
  );

  // Failed emoji list (show up to 10)
  const failedResults = session.results.filter(r => r.state === 'failed');
  if (failedResults.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const failedLines = failedResults
      .slice(0, 10)
      .map(r => `${ICONS.ERROR} \`${r.finalName}\` — *${r.error?.slice(0, 60) ?? 'unknown error'}*`);

    if (failedResults.length > 10) {
      failedLines.push(`-# …and ${failedResults.length - 10} more failed emojis`);
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.ERROR} Failed Emojis\n` + failedLines.join('\n'),
      ),
    );
  }

  // Successfully uploaded emojis (show up to 15)
  const successResults = session.results.filter(r => r.state === 'completed' && r.emoji);
  if (successResults.length > 0 && !dryRun) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const emojiMentions = successResults
      .slice(0, 20)
      .map(r => r.emoji ? `<${r.emoji.animated ? 'a' : ''}:${r.emoji.name}:${r.emoji.id}>` : `\`:${r.finalName}:\``)
      .join(' ');

    const suffix = successResults.length > 20
      ? `\n-# …and ${successResults.length - 20} more`
      : '';

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.SPARKLE} Uploaded Emojis\n${emojiMentions}${suffix}`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Action buttons
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        btnDone(),
        btnNewUpload(),
      ),
  );

  // Dry run note
  if (dryRun) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${ICONS.DRY_RUN} Dry run — disable in **Settings** to upload for real.`,
      ),
    );
  }

  return container;
}
