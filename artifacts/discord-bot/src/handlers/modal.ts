/**
 * Modal submit interaction handler.
 */

import { ModalSubmitInteraction, MessageFlags } from 'discord.js';
import { CUSTOM_IDS } from '../constants/index.js';
import { sessionStore } from '../storage/session-store.js';
import { parseModalSettings } from '../components/modals.js';
import { buildSettingsPanel } from '../builders/settings.js';
import { buildErrorPanel } from '../builders/error-panel.js';
import { getLogger } from '../logging/logger.js';

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const logger = getLogger();

  if (interaction.customId === CUSTOM_IDS.SETTINGS_MODAL) {
    await handleSettingsModal(interaction);
    return;
  }

  logger.warn(`Unknown modal: ${interaction.customId}`);
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      components: [buildErrorPanel('Unknown Modal', `No handler for modal: ${interaction.customId}`, undefined)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }
}

// ─── Settings modal ───────────────────────────────────────────────────────────

async function handleSettingsModal(interaction: ModalSubmitInteraction): Promise<void> {
  const logger  = getLogger();
  const session = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);

  if (!session) {
    await interaction.reply({
      components: [buildErrorPanel('No Session', 'No active upload session found.', undefined)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const concurrencyStr = interaction.fields.getTextInputValue('setting_concurrency');
    const retriesStr     = interaction.fields.getTextInputValue('setting_retries');
    const intervalStr    = interaction.fields.getTextInputValue('setting_interval');
    const flagsStr       = interaction.fields.getTextInputValue('setting_flags');

    const partialSettings = parseModalSettings(
      concurrencyStr,
      retriesStr,
      intervalStr,
      flagsStr,
      session.settings,
    );

    const updated = sessionStore.update(session.id, {
      settings: { ...session.settings, ...partialSettings },
    });

    if (!updated) {
      throw new Error('Failed to update session settings.');
    }

    logger.info('Settings updated via modal', { sessionId: session.id, settings: partialSettings });

    await interaction.reply({
      components: [buildSettingsPanel(updated.settings)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });

  } catch (err) {
    logger.error('Settings modal error', {
      error: err instanceof Error ? err.message : String(err),
    });
    await interaction.reply({
      components: [buildErrorPanel(
        'Settings Error',
        err instanceof Error ? err.message : 'Failed to update settings.',
        session,
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }
}
