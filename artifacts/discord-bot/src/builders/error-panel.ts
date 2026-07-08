/**
 * Error panel builder.
 *
 * Displayed on fatal errors, validation failures, and permission issues.
 * Provides clear, actionable error messages with recovery hints.
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
import { btnRefresh, btnHelp, btnCancel } from '../components/buttons.js';

// ─── Error type hints ─────────────────────────────────────────────────────────

const ERROR_HINTS: Record<string, string> = {
  PERMISSION_ERROR:    'Ask a server admin to grant the bot **Manage Expressions** permission.',
  NO_SLOTS:            'The server is full. Delete unused emojis or boost the server for more slots.',
  ZIP_VALIDATION_ERROR:'Check that the file is a valid ZIP archive with supported image types inside.',
  RATE_LIMIT:          'Discord is rate-limiting uploads. The bot will retry automatically next time.',
  NETWORK:             'A temporary network issue occurred. Try again in a moment.',
};

function getHint(errorMessage: string): string | undefined {
  for (const [key, hint] of Object.entries(ERROR_HINTS)) {
    if (errorMessage.toUpperCase().includes(key)) return hint;
  }
  if (errorMessage.toLowerCase().includes('permission')) return ERROR_HINTS['PERMISSION_ERROR'];
  if (errorMessage.toLowerCase().includes('slot'))       return ERROR_HINTS['NO_SLOTS'];
  if (errorMessage.toLowerCase().includes('zip'))        return ERROR_HINTS['ZIP_VALIDATION_ERROR'];
  return undefined;
}

// ─── Error panel builder ──────────────────────────────────────────────────────

/**
 * Build an error panel.
 *
 * @param title    Short title (e.g. "Upload Failed", "Validation Error")
 * @param message  The error message to display
 * @param session  Optional session context for additional metadata
 */
export function buildErrorPanel(
  title:   string,
  message: string,
  session: UploadSession | undefined,
): ContainerBuilder {
  const hint = getHint(message);

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.ERROR);

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${ICONS.ERROR} ${title}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Error message
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### What happened\n${message}`,
    ),
  );

  // Hint
  if (hint) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.INFO} How to fix this\n${hint}`,
      ),
    );
  }

  // Session summary (if available)
  if (session) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    );

    const stats = session.stats;
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${ICONS.STATS} Session Summary\n` +
        `${ICONS.SUCCESS} Uploaded before error: **${stats.completed}**\n` +
        `${ICONS.ERROR}  Failed: **${stats.failed}**\n` +
        `${ICONS.SKIP}  Skipped: **${stats.skipped}**`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Recovery actions
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        btnRefresh(),
        btnHelp(),
        btnCancel(),
      ),
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${ICONS.INFO} Click **Help** for troubleshooting guides. ` +
      `Click **Refresh** to reload the dashboard and try again.`,
    ),
  );

  return container;
}

/**
 * Build a simple inline warning panel (for validation warnings, not fatal errors).
 */
export function buildWarningPanel(
  title:    string,
  warnings: string[],
  session:  UploadSession | undefined,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.WARNING);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${ICONS.WARNING} ${title}`),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const warningLines = warnings.map(w => `${ICONS.WARNING} ${w}`).join('\n');
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(warningLines),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(btnRefresh(), btnCancel()),
  );

  return container;
}
