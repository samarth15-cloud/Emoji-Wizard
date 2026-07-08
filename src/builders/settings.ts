/**
 * Settings panel builder.
 *
 * Shows the current upload configuration and provides controls
 * to modify it interactively.
 */

import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  SeparatorSpacingSize,
} from 'discord.js';
import type { UploadSettings } from '../types/index.js';
import { COLORS, ICONS } from '../constants/index.js';
import { btnSettings, btnRefresh, btnCancel } from '../components/buttons.js';
import { buildConcurrencySelect, buildRetrySelect, buildLogLevelSelect } from '../components/selects.js';

// ─── Settings panel ───────────────────────────────────────────────────────────

/**
 * Build the interactive settings panel.
 */
export function buildSettingsPanel(settings: UploadSettings): ContainerBuilder {
  const on  = (v: boolean) => v ? `${ICONS.SUCCESS} On`  : `${ICONS.ERROR} Off`;
  const dr  = settings.dryRun ? ` ${ICONS.DRY_RUN} **DRY RUN ACTIVE**` : '';

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.PURPLE);

  // Header
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${ICONS.SETTINGS} Upload Settings${dr}\n` +
      `Adjust how the bot handles uploads, retries, and naming.`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Current values
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${ICONS.STATS} Current Configuration\n` +
      `${ICONS.SPEED}  **Concurrency**          ${settings.concurrency} parallel uploads\n` +
      `${ICONS.RETRY}  **Max Retries**          ${settings.maxRetries} per emoji\n` +
      `${ICONS.TIMER}  **Progress Interval**    ${settings.progressIntervalMs}ms\n` +
      `${ICONS.PENCIL ?? '✏️'}  **Auto Rename**         ${on(settings.autoRename)}\n` +
      `${ICONS.SKIP}  **Skip Duplicates**      ${on(settings.skipDuplicates)}\n` +
      `${ICONS.ANIMATED}  **Animated First**       ${on(settings.animatedPriority)}\n` +
      `${ICONS.FOLDER}  **Recursive ZIP**        ${on(settings.recursive)}\n` +
      `${ICONS.SHIELD}  **Strict Validation**    ${on(settings.strictValidation)}\n` +
      `${ICONS.DRY_RUN}  **Dry Run**              ${on(settings.dryRun)}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Concurrency select
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${ICONS.SPEED} Upload Concurrency**`),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      buildConcurrencySelect(settings.concurrency),
    ),
  );

  // Retry select
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${ICONS.RETRY} Max Retries**`),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      buildRetrySelect(settings.maxRetries),
    ),
  );

  // Log level select
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${ICONS.STATS} Log Verbosity**`),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      buildLogLevelSelect(settings.logVerbosity),
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Action buttons row
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        btnSettings(),   // Back to dashboard (reuse as "back")
        btnRefresh(),
        btnCancel(),
      ),
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# ${ICONS.INFO} Changes apply to the current session only.  ` +
      `Use the modal (Settings button again) for concurrency / retry count.`,
    ),
  );

  return container;
}
