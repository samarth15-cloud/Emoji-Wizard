/**
 * Help panel builder.
 *
 * Interactive documentation — requirements, limits, troubleshooting, FAQ.
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
import { COLORS, ICONS } from '../constants/index.js';
import { btnRefresh, btnCancel } from '../components/buttons.js';

// ─── Help panel ───────────────────────────────────────────────────────────────

export function buildHelpPanel(): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.INFO);

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${ICONS.HELP} Emoji ZIP Uploader — Help`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Getting Started
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.PACKAGE} Getting Started\n` +
      `1. Prepare a ZIP file containing your emoji images\n` +
      `2. Run \`/emoji-upload\` (optionally attach the ZIP immediately)\n` +
      `3. Click **${ICONS.UPLOAD} Upload ZIP** and send your file\n` +
      `4. Watch the live progress dashboard as emojis are uploaded`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  // Supported formats
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.FILE} Supported File Formats\n` +
      `\`\`\`\n` +
      `.png   — Static, recommended for best quality\n` +
      `.gif   — Animated emojis (requires Nitro to use)\n` +
      `.jpg   — Compressed static\n` +
      `.jpeg  — Compressed static (same as .jpg)\n` +
      `.webp  — Efficient format, good quality\n` +
      `\`\`\``,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  // Discord limits
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.LOCK} Discord Limits\n` +
      `${ICONS.STAR} **Max file size**   256 KB per emoji\n` +
      `${ICONS.STAR} **Max dimensions**  128 × 128 pixels\n` +
      `${ICONS.STAR} **Name length**     2–32 characters\n` +
      `${ICONS.STAR} **Name chars**      a–z, 0–9, underscore only\n` +
      `${ICONS.STAR} **Emoji slots**     50 static / 50 animated (Level 0)\n` +
      `-# Slots increase with server boost level (Level 1: 100, Level 2: 150, Level 3: 250)`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Naming
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.PENCIL ?? '✏️'} Emoji Name Processing\n` +
      `File names are automatically normalised:\n` +
      `• Converted to lowercase\n` +
      `• Spaces and hyphens replaced with \`_\`\n` +
      `• Special characters removed\n` +
      `• Truncated to 32 characters\n` +
      `• Duplicates suffixed with \`_2\`, \`_3\`, …`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  // Troubleshooting
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.WRENCH ?? '🔧'} Troubleshooting\n` +
      `**Bot says "missing permissions"**\n` +
      `→ Grant **Manage Expressions** in Server Settings → Roles\n\n` +
      `**Server full error**\n` +
      `→ Delete unused emojis or boost the server for more slots\n\n` +
      `**Upload keeps failing**\n` +
      `→ Increase retry count in Settings; Discord may be rate-limiting\n\n` +
      `**Emoji names are wrong**\n` +
      `→ Rename files before zipping to your desired emoji names\n\n` +
      `**ZIP rejected as corrupted**\n` +
      `→ Re-compress the folder using a fresh archive tool`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // FAQ
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.BELL} FAQ\n` +
      `**Q: Will it overwrite existing emojis?**\n` +
      `A: No — duplicate names are auto-renamed or skipped (configurable).\n\n` +
      `**Q: Can I preview emojis before uploading?**\n` +
      `A: Enable **Dry Run** in Settings to simulate without uploading.\n\n` +
      `**Q: What's the ZIP size limit?**\n` +
      `A: 100 MB by default (configurable via \`MAX_ZIP_SIZE_MB\`).\n\n` +
      `**Q: How fast does it upload?**\n` +
      `A: ~2–5 emojis/second at concurrency=2, respecting Discord rate limits.`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Required permissions
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.SHIELD} Required Bot Permissions\n` +
      `\`Manage Expressions\` — Create and delete emoji\n` +
      `\`Read Messages\` — Receive file attachments\n` +
      `\`Send Messages\` — Post progress updates`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btnRefresh(),
      btnCancel(),
    ),
  );

  return container;
}
