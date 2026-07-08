/**
 * /emoji-upload command.
 *
 * Entry point for the entire emoji upload workflow.
 * Shows the main dashboard or immediately starts an upload
 * if a ZIP attachment was provided.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  GuildMember,
} from 'discord.js';
import type { SlashCommand } from '../types/index.js';
import { sessionStore } from '../storage/session-store.js';
import { buildDashboard } from '../builders/dashboard.js';
import { buildErrorPanel } from '../builders/error-panel.js';
import { getEmojiSlots, assertManageExpressions, assertUserManageExpressions } from '../utils/discord.js';
import { runUploadEngine } from '../upload/engine.js';
import { getLogger } from '../logging/logger.js';

// ─── Command definition ───────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('emoji-upload')
  .setDescription('Upload emojis from a ZIP file to this server')
  .addAttachmentOption(option =>
    option
      .setName('zip')
      .setDescription('ZIP file containing emoji images (.png, .gif, .jpg, .jpeg, .webp)')
      .setRequired(false),
  )
  .addBooleanOption(option =>
    option
      .setName('dry_run')
      .setDescription('Simulate the upload without making real changes')
      .setRequired(false),
  )
  .setDefaultMemberPermissions(null) // Allow everyone; we check ManageExpressions manually
  .setDMPermission(false);

// ─── Execute ──────────────────────────────────────────────────────────────────

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const logger = getLogger();
  const guild  = interaction.guild!;
  const member = interaction.member as GuildMember;

  // ── Permission guard ───────────────────────────────────────────────────────
  try {
    assertUserManageExpressions(member);
    assertManageExpressions(guild.members.me!);
  } catch (err) {
    await interaction.reply({
      components: [buildErrorPanel(
        'Permission Denied',
        err instanceof Error ? err.message : String(err),
        undefined,
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // ── Read options ───────────────────────────────────────────────────────────
  const zipAttachment = interaction.options.getAttachment('zip', false);
  const dryRun        = interaction.options.getBoolean('dry_run', false) ?? false;

  // ── Fetch emoji slots ──────────────────────────────────────────────────────
  let slots: Awaited<ReturnType<typeof getEmojiSlots>>;
  try {
    slots = await getEmojiSlots(guild);
  } catch (err) {
    await interaction.reply({
      components: [buildErrorPanel(
        'Could Not Fetch Emoji Data',
        err instanceof Error ? err.message : 'Failed to retrieve emoji slot information.',
        undefined,
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // ── Create session ─────────────────────────────────────────────────────────
  let session = sessionStore.getLatestForUser(guild.id, interaction.user.id);
  const isNewSession = !session || ['completed', 'failed', 'cancelled'].includes(session.status);

  if (isNewSession) {
    try {
      session = sessionStore.create({
        guildId:          guild.id,
        userId:           interaction.user.id,
        channelId:        interaction.channelId,
        interactionToken: interaction.token,
      });
    } catch (err) {
      await interaction.reply({
        components: [buildErrorPanel(
          'Session Error',
          err instanceof Error ? err.message : 'Could not create upload session.',
          undefined,
        )],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // Apply dry-run flag
  if (dryRun && session) {
    sessionStore.update(session.id, {
      settings: { ...session.settings, dryRun: true },
    });
  }

  // ── Show dashboard ─────────────────────────────────────────────────────────
  const latestSession = sessionStore.get(session!.id);
  const dashboard = buildDashboard(guild, slots, interaction.client, latestSession);

  await interaction.reply({
    components: [dashboard],
    flags:      MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });

  // ── If ZIP was attached, start upload immediately ─────────────────────────
  if (zipAttachment) {
    if (!zipAttachment.name?.toLowerCase().endsWith('.zip')) {
      await interaction.editReply({
        components: [buildErrorPanel(
          'Invalid File',
          `"${zipAttachment.name}" does not appear to be a ZIP file. Please attach a .zip file.`,
          latestSession ?? undefined,
        )],
      });
      return;
    }

    logger.info(`Starting immediate upload from command attachment`, {
      sessionId: session!.id,
      filename:  zipAttachment.name,
      size:      zipAttachment.size,
    });

    void runUploadEngine({
      sessionId:   session!.id,
      guild,
      zipUrl:      zipAttachment.url,
      zipFilename: zipAttachment.name,
      onEdit: async (components) => {
        try {
          await interaction.editReply({ components });
        } catch {
          // Token expired
        }
      },
    });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const emojiUploadCommand: SlashCommand = {
  data: data.toJSON(),
  execute,
};
