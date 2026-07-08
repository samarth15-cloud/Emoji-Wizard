/**
 * Dashboard panel builder — the main UI shown when /emoji-upload is run.
 *
 * Displays:
 *  - Server identity + icon
 *  - Emoji slot usage (static + animated)
 *  - Bot status metrics (latency, memory, versions)
 *  - Current session information
 *  - Action buttons
 */

import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
  Client,
} from 'discord.js';
import type { Guild } from 'discord.js';
import type { EmojiSlots, UploadSession } from '../types/index.js';
import { COLORS, ICONS } from '../constants/index.js';
import {
  btnUpload,
  btnSettings,
  btnHelp,
  btnRefresh,
  btnCancel,
  btnAdvanced,
} from '../components/buttons.js';
import { guildIconUrl, premiumTierLabel } from '../utils/discord.js';
import { formatSlots, formatBytes, getMemoryUsage, latencyIcon, formatDuration } from '../utils/format.js';

// ─── Dashboard builder ────────────────────────────────────────────────────────

/**
 * Build the main dashboard container.
 *
 * @param guild       The target guild
 * @param slots       Pre-fetched emoji slot data
 * @param client      The Discord client (for latency / version info)
 * @param session     Active session (if any)
 */
export function buildDashboard(
  guild:   Guild,
  slots:   EmojiSlots,
  client:  Client,
  session: UploadSession | undefined,
): ContainerBuilder {
  const iconUrl    = guildIconUrl(guild);
  const latencyMs  = Math.round(client.ws.ping);
  const memUsage   = getMemoryUsage();
  const nodeVer    = process.version;
  const djsVer     = client.options.rest?.version ?? '10';
  const boostLabel = premiumTierLabel(guild.premiumTier);
  const memberCount = guild.memberCount.toLocaleString();

  // ── Session status badge ─────────────────────────────────────────────────
  const sessionBadge = session
    ? `${ICONS.LOADING} **Active Session** — ${session.status.replace('_', ' ')}`
    : `${ICONS.SUCCESS} Ready — No active upload`;

  // ── Slot availability ─────────────────────────────────────────────────────
  const staticBar   = formatSlots(slots.staticUsed,   slots.staticTotal);
  const animatedBar = formatSlots(slots.animatedUsed, slots.animatedTotal);

  // ── Dry-run indicator ─────────────────────────────────────────────────────
  const dryRunNote = session?.settings.dryRun
    ? `\n${ICONS.DRY_RUN} **DRY RUN MODE** — No real uploads will occur`
    : '';

  // ── Build container ───────────────────────────────────────────────────────
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.PRIMARY);

  // Header section with server icon
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## ${ICONS.ROBOT} Emoji ZIP Uploader\n` +
          `**${guild.name}**  •  ${memberCount} members  •  ${boostLabel}`,
        ),
        new TextDisplayBuilder().setContent(sessionBadge + dryRunNote),
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder().setURL(iconUrl),
      ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Emoji slot section
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.STATIC} Emoji Slots\n` +
      `${ICONS.STATIC} **Static**   ${staticBar}\n` +
      `${ICONS.ANIMATED} **Animated** ${animatedBar}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  // Bot health metrics
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### ${ICONS.STATS} Bot Metrics\n` +
          `${latencyIcon(latencyMs)} **Latency**   ${latencyMs}ms\n` +
          `${ICONS.MEMORY} **Memory**    ${memUsage}\n` +
          `${ICONS.ROBOT} **Node.js**   ${nodeVer}\n` +
          `${ICONS.LINK} **djs API**    v${djsVer}`,
        ),
      ),
  );

  // Session info (if active)
  if (session) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    );

    const s = session.settings;
    const queueSize = session.emojis.length;
    const elapsed   = session.startedAt
      ? formatDuration(Date.now() - session.startedAt.getTime())
      : '—';

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.QUEUE} Current Session\n` +
        `${ICONS.FILE} **Queue**          ${queueSize} emojis\n` +
        `${ICONS.SPEED} **Concurrency**   ${s.concurrency} parallel\n` +
        `${ICONS.RETRY} **Max Retries**   ${s.maxRetries}\n` +
        `${ICONS.TIMER} **Elapsed**       ${elapsed}\n` +
        `${ICONS.SHIELD} **Mode**         ${s.dryRun ? 'DRY RUN' : 'Live Upload'}`,
      ),
    );
  }

  // Configuration summary
  if (!session) {
    const cfg = session === undefined
      ? undefined
      : session;

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.SETTINGS} Quick Config\n` +
        `-# Use the **Settings** button to customise upload behaviour.\n` +
        `-# Supports .png  .gif  .jpg  .jpeg  .webp  •  Max ZIP: 100 MB  •  Max Emoji: 256 KB`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Action buttons
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      btnUpload(session?.status === 'uploading'),
      btnSettings(),
      btnAdvanced(),
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      btnHelp(),
      btnRefresh(),
      ...(session ? [btnCancel()] : []),
    );

  container.addActionRowComponents(row1);
  if (row2.components.length > 0) {
    container.addActionRowComponents(row2);
  }

  // Footer
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${ICONS.INFO} Upload a ZIP containing .png/.gif/.jpg/.jpeg/.webp files  •  ` +
      `Session auto-expires in 30 minutes`,
    ),
  );

  return container;
}
