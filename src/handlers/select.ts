/**
 * StringSelectMenu interaction handler.
 *
 * Routes select menu interactions to the appropriate settings update.
 */

import { StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { CUSTOM_IDS } from '../constants/index.js';
import { sessionStore } from '../storage/session-store.js';
import { buildSettingsPanel } from '../builders/settings.js';
import { buildErrorPanel } from '../builders/error-panel.js';
import { getLogger } from '../logging/logger.js';
import type { UploadSettings } from '../types/index.js';

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const logger  = getLogger();
  const session = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);

  if (!session) {
    await interaction.reply({
      components: [buildErrorPanel('No Session', 'No active upload session found. Run /emoji-upload first.', undefined)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  let partial: Partial<UploadSettings> = {};

  switch (interaction.customId) {
    case CUSTOM_IDS.SELECT_CONCURRENCY: {
      const value = parseInt(interaction.values[0] ?? '2', 10);
      partial = { concurrency: Number.isFinite(value) ? value : session.settings.concurrency };
      break;
    }

    case CUSTOM_IDS.SELECT_RETRIES: {
      const value = parseInt(interaction.values[0] ?? '3', 10);
      partial = { maxRetries: Number.isFinite(value) ? value : session.settings.maxRetries };
      break;
    }

    case CUSTOM_IDS.SELECT_LOG_LEVEL: {
      const value = interaction.values[0] as UploadSettings['logVerbosity'];
      partial = { logVerbosity: value ?? session.settings.logVerbosity };
      break;
    }

    default:
      logger.warn(`Unknown select menu: ${interaction.customId}`);
      return;
  }

  const updated = sessionStore.update(session.id, {
    settings: { ...session.settings, ...partial },
  });

  if (!updated) {
    await interaction.reply({
      components: [buildErrorPanel('Update Failed', 'Could not update session settings.', session)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  logger.debug('Settings updated via select', { sessionId: session.id, partial });

  // Update the settings panel in-place
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }
  await interaction.editReply({ components: [buildSettingsPanel(updated.settings)] });
}
