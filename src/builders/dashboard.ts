/**
 * Dashboard panel builder — the main UI shown when /emoji-upload is run.
 *
 * Displays:
 *  - Server identity + icon
 *  - Active session status
 *  - Emoji slot usage (static + animated)
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
} from 'discord.js';
import type { Guild, Client } from 'discord.js';
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
import { formatSlots } from '../utils/format.js';

// ─── Dashboard builder ────────────────────────────────────────────────────────

/**
 * Build the main dashboard container.
 */
export function buildDashboard(
  guild:   Guild,
  slots:   EmojiSlots,
  _client: Client,
  session: UploadSession | undefined,
): ContainerBuilder {
  const iconUrl    = guildIconUrl(guild);
  const boostLabel = premiumTierLabel(guild.premiumTier);

  const sessionBadge = session
    ? `${ICONS.LOADING} **Active Session** — ${session.status.replace('_', ' ')}`
    : `${ICONS.SUCCESS} Ready — No active upload`;

  const staticBar   = formatSlots(slots.staticUsed, slots.staticTotal);
  const animatedBar = formatSlots(slots.animatedUsed, slots.animatedTotal);

  const dryRunNote = session?.settings.dryRun
    ? `\n${ICONS.DRY_RUN} **DRY RUN MODE** — No real uploads will occur`
    : '';

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.PRIMARY);

  // Header with server icon
  container.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## ${ICONS.ROBOT} Emoji ZIP Uploader\n` +
          `**${guild.name}**  •  ${boostLabel}`,
        ),
        new TextDisplayBuilder().setContent(sessionBadge + dryRunNote),
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Emoji slot usage (the only thing users really need to check)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.STATIC} Emoji Slots\n` +
      `${ICONS.STATIC} **Static**   ${staticBar}\n` +
      `${ICONS.ANIMATED} **Animated** ${animatedBar}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Primary actions
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btnUpload(session?.status === 'uploading'),
      btnSettings(),
      btnAdvanced(),
      btnHelp(),
    ),
  );

  if (session) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btnRefresh(),
        btnCancel(),
      ),
    );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Send a .zip of .png/.gif/.jpg/.jpeg/.webp files (max 100 MB) and press **Upload ZIP**.`,
    ),
  );

  return container;
}
