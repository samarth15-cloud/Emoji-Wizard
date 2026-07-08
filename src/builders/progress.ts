/**
 * Live progress panel builder.
 *
 * Continuously edited (not new messages) to show real-time upload status.
 * Keeps the UI clean by replacing the previous panel in-place.
 */

import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import type { UploadSession } from '../types/index.js';
import type { QueueItem } from '../types/index.js';
import { COLORS, ICONS } from '../constants/index.js';
import { btnAbort } from '../components/buttons.js';
import { computeProgress } from '../utils/progress.js';
import { formatProgress, formatDuration, formatBytes } from '../utils/format.js';

// ─── State → colour map ───────────────────────────────────────────────────────

function stateIcon(state: QueueItem['state']): string {
  switch (state) {
    case 'pending':   return '⬜';
    case 'uploading': return '🔵';
    case 'retrying':  return '🟡';
    case 'completed': return '🟢';
    case 'failed':    return '🔴';
    case 'skipped':   return '⚪';
    case 'cancelled': return '⛔';
  }
}

// ─── Progress panel ───────────────────────────────────────────────────────────

/**
 * Build the live progress panel container.
 *
 * @param session   Current upload session
 * @param items     All queue items (for per-item status listing)
 */
export function buildProgressPanel(
  session: UploadSession,
  items:   QueueItem[],
): ContainerBuilder {
  const snap = computeProgress(session, items);
  const s    = session.settings;

  const isDryRun = s.dryRun
    ? ` ${ICONS.DRY_RUN} **DRY RUN**`
    : '';

  // ── Recent items (last 8 or so)
  const recentItems = items
    .filter(i => i.state !== 'pending')
    .slice(-8)
    .reverse();

  const recentLines = recentItems.map(item =>
    `${stateIcon(item.state)} \`${item.file.name}\`` +
    (item.error ? `  ↳ *${item.error.slice(0, 50)}*` : ''),
  );

  // ── Queue summary strip
  const pendingCount   = snap.pending;
  const uploadingCount = snap.uploading;

  const container = new ContainerBuilder()
    .setAccentColor(snap.percentage === 100 ? COLORS.SUCCESS : COLORS.PRIMARY);

  // Header
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## ${ICONS.UPLOAD} Uploading Emojis${isDryRun}\n` +
          `**${session.zipFilename ?? 'ZIP file'}**  •  ${snap.total} emojis`,
        ),
        new TextDisplayBuilder().setContent(
          formatProgress(snap.done, snap.total),
        ),
      ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Stats row
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${ICONS.SUCCESS} **Done**       ${snap.completed}\n` +
      `${ICONS.ERROR}   **Failed**     ${snap.failed}\n` +
      `${ICONS.SKIP}  **Skipped**    ${snap.skipped}\n` +
      `${ICONS.LOADING}  **Pending**    ${pendingCount}\n` +
      `${ICONS.SPEED}  **Uploading**  ${uploadingCount} / ${s.concurrency}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  // Timing row
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${ICONS.TIMER}  **Elapsed**   ${snap.elapsedLabel}\n` +
      `${ICONS.CLOCK}  **ETA**       ${snap.etaLabel}\n` +
      `${ICONS.CHART}  **Speed**     ${snap.speedLabel}\n` +
      (snap.currentEmoji
        ? `${ICONS.EMOJI}  **Current**   \`:${snap.currentEmoji}:\``
        : ''),
    ),
  );

  // Recent items list
  if (recentLines.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.QUEUE} Recent Activity\n` +
        recentLines.join('\n'),
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Abort button
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(btnAbort()),
  );

  // Retry info
  if (session.stats.retried > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${ICONS.RETRY} ${session.stats.retried} retry attempt(s) so far`,
      ),
    );
  }

  return container;
}
