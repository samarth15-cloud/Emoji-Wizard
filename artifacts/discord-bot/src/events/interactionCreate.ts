/**
 * Interaction router.
 *
 * Routes all incoming Discord interactions to the correct handler:
 *  - ChatInputCommand  → commands/index.ts
 *  - ButtonInteraction → handlers/button.ts
 *  - StringSelectMenu  → handlers/select.ts
 *  - ModalSubmit       → handlers/modal.ts
 */

import {
  Interaction,
  MessageFlags,
  InteractionType,
} from 'discord.js';
import type { BotEvent } from '../types/index.js';
import { commandMap } from '../commands/index.js';
import { handleButton } from '../handlers/button.js';
import { handleSelect } from '../handlers/select.js';
import { handleModal  } from '../handlers/modal.js';
import { buildErrorPanel } from '../builders/error-panel.js';
import { getLogger } from '../logging/logger.js';

const event: BotEvent = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    const logger = getLogger();

    // ── Slash commands ─────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);

      if (!cmd) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        await interaction.reply({
          content: `Unknown command: \`/${interaction.commandName}\``,
          flags:   MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        await cmd.execute(interaction);
      } catch (err) {
        logger.error(`Command error [/${interaction.commandName}]`, {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          userId: interaction.user.id,
          guildId: interaction.guild?.id,
        });

        const errorPanel = buildErrorPanel(
          'Command Error',
          err instanceof Error ? err.message : 'An unexpected error occurred.',
          undefined,
        );

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ components: [errorPanel] });
          } else {
            await interaction.reply({
              components: [errorPanel],
              flags:      MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }
        } catch {
          // Interaction already expired
        }
      }
      return;
    }

    // ── Button interactions ────────────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // ── String select menus ───────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction);
      return;
    }

    // ── Modal submits ──────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }

    // Log unhandled interaction types for diagnostics
    logger.debug(`Unhandled interaction type: ${interaction.type}`, {
      type: InteractionType[interaction.type],
    });
  },
};

export default event;
