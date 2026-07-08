/**
 * Button interaction handler.
 *
 * Routes every button press to the appropriate action.
 * All business logic lives in dedicated modules; this file only routes.
 */

import {
  ButtonInteraction,
  MessageFlags,
  GuildMember,
} from 'discord.js';
import { CUSTOM_IDS, ICONS, UPLOAD_COLLECT_TIMEOUT_MS, COLORS } from '../constants/index.js';
import { sessionStore, getDefaultSettings } from '../storage/session-store.js';
import { buildDashboard } from '../builders/dashboard.js';
import { buildSettingsPanel } from '../builders/settings.js';
import { buildHelpPanel } from '../builders/help.js';
import { buildErrorPanel } from '../builders/error-panel.js';
import { buildSettingsModal } from '../components/modals.js';
import { getEmojiSlots, assertManageExpressions, assertUserManageExpressions } from '../utils/discord.js';
import { runUploadEngine } from '../upload/engine.js';
import { getLogger } from '../logging/logger.js';
import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
} from 'discord.js';

// ─── Handler map ──────────────────────────────────────────────────────────────

type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

const handlers = new Map<string, ButtonHandler>();

// ─── Helper: safe defer + edit ────────────────────────────────────────────────

async function safeDefer(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }
}

// ─── Dashboard refresh ────────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.DASHBOARD_REFRESH, async (interaction) => {
  await safeDefer(interaction);
  const guild = interaction.guild!;
  const slots = await getEmojiSlots(guild);
  const session = sessionStore.getLatestForUser(guild.id, interaction.user.id);
  const panel = buildDashboard(guild, slots, interaction.client, session);
  await interaction.editReply({ components: [panel] });
});

// ─── Open settings panel ──────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.SETTINGS_OPEN, async (interaction) => {
  await safeDefer(interaction);
  const session = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);
  if (!session) {
    await interaction.editReply({
      components: [buildErrorPanel('No Active Session', 'Start an upload session first by clicking Upload ZIP.', undefined)],
    });
    return;
  }
  await interaction.editReply({ components: [buildSettingsPanel(session.settings)] });
});

// ─── Open help panel ─────────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.HELP_OPEN, async (interaction) => {
  await safeDefer(interaction);
  await interaction.editReply({ components: [buildHelpPanel()] });
});

// ─── Open advanced settings (modal) ──────────────────────────────────────────

handlers.set(CUSTOM_IDS.ADVANCED_OPEN, async (interaction) => {
  const session = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);
  const settings = session?.settings;
  if (!settings) {
    await interaction.reply({
      components: [buildErrorPanel('No Active Session', 'Run /emoji-upload first.', undefined)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }
  const modal = buildSettingsModal(settings);
  await interaction.showModal(modal);
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.CANCEL, async (interaction) => {
  await safeDefer(interaction);
  const session = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);
  if (session) {
    sessionStore.update(session.id, { status: 'cancelled' });
    await sessionStore.destroy(session.id);
  }

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.NEUTRAL)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${ICONS.CANCEL} Session Cancelled\nYour upload session has been cancelled and cleaned up.`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.DASHBOARD_REFRESH)
          .setLabel('New Session')
          .setEmoji(ICONS.REFRESH)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.editReply({ components: [container] });
});

// ─── Upload ZIP ───────────────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.UPLOAD_START, async (interaction) => {
  const logger = getLogger();
  const guild  = interaction.guild!;
  const member = interaction.member as GuildMember;

  // Permission check
  try {
    assertUserManageExpressions(member);
    assertManageExpressions(guild.members.me ?? member);
  } catch (err) {
    await interaction.reply({
      components: [buildErrorPanel('Permission Denied', err instanceof Error ? err.message : String(err), undefined)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Check for existing active session
  const existing = sessionStore.getLatestForUser(guild.id, interaction.user.id);
  if (existing && existing.status === 'uploading') {
    await interaction.reply({
      components: [buildErrorPanel(
        'Upload Already Running',
        'You already have an active upload session running. Please wait for it to complete or cancel it.',
        existing,
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Create a new session
  const session = sessionStore.create({
    guildId:          guild.id,
    userId:           interaction.user.id,
    channelId:        interaction.channelId,
    interactionToken: interaction.token,
  });

  // Show "waiting for file" panel
  const waitContainer = new ContainerBuilder()
    .setAccentColor(COLORS.INFO)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${ICONS.UPLOAD} Upload Your ZIP File\n` +
        `Please **send a message in this channel** with your ZIP file attached.\n\n` +
        `You have **${Math.round(UPLOAD_COLLECT_TIMEOUT_MS / 1000)} seconds** to upload your file.`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${ICONS.INFO} **Tips:**\n` +
        `• Drag and drop your ZIP directly into the chat\n` +
        `• Maximum size: 100 MB\n` +
        `• Supported: .png .gif .jpg .jpeg .webp inside the ZIP\n` +
        `-# Session ID: \`${session.id.slice(0, 8)}\``,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.CANCEL)
          .setLabel('Cancel')
          .setEmoji(ICONS.CANCEL)
          .setStyle(ButtonStyle.Danger),
      ),
    );

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      components: [waitContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  } else {
    await interaction.editReply({ components: [waitContainer] });
  }

  sessionStore.update(session.id, { status: 'awaiting_file' });

  // Collect the file from the channel
  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || !('awaitMessages' in channel)) {
    logger.error('Cannot collect messages from non-text channel', { channelId: interaction.channelId });
    return;
  }

  // Narrow to a channel type that has awaitMessages
  const textChannel = channel as import('discord.js').TextChannel;

  try {
    const collected = await textChannel.awaitMessages({
      filter: (msg: import('discord.js').Message) =>
        msg.author.id === interaction.user.id &&
        msg.attachments.some((a: import('discord.js').Attachment) => a.name?.toLowerCase().endsWith('.zip')),
      max:    1,
      time:   UPLOAD_COLLECT_TIMEOUT_MS,
      errors: ['time'],
    });

    const message    = collected.first();
    const attachment = message?.attachments.find((a: import('discord.js').Attachment) => a.name?.toLowerCase().endsWith('.zip'));

    if (!attachment) {
      await interaction.editReply({
        components: [buildErrorPanel('No ZIP Found', 'Could not find a ZIP attachment in your message.', session)],
      });
      return;
    }

    // Delete the user's upload message to keep the channel clean (best-effort)
    message?.delete().catch(() => undefined);

    logger.info(`Received ZIP: ${attachment.name}`, {
      sessionId: session.id,
      size:      attachment.size,
      url:       attachment.url,
    });

    // Run the upload engine asynchronously
    void runUploadEngine({
      sessionId:   session.id,
      guild,
      zipUrl:      attachment.url,
      zipFilename: attachment.name ?? 'upload.zip',
      onEdit: async (components) => {
        try {
          await interaction.editReply({ components });
        } catch {
          // Interaction token may have expired
        }
      },
    });

  } catch {
    // Timeout: user didn't upload a file
    const timeoutContainer = new ContainerBuilder()
      .setAccentColor(COLORS.WARNING)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## ${ICONS.TIMER} Upload Timed Out\n` +
          `No ZIP file was received within ${Math.round(UPLOAD_COLLECT_TIMEOUT_MS / 1000)} seconds.\n\n` +
          `Click **Upload ZIP** again when you're ready.`,
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(CUSTOM_IDS.UPLOAD_START)
            .setLabel('Try Again')
            .setEmoji(ICONS.UPLOAD)
            .setStyle(ButtonStyle.Primary),
        ),
      );

    await interaction.editReply({ components: [timeoutContainer] }).catch(() => undefined);
    await sessionStore.destroy(session.id);
  }
});

// ─── Abort running upload ─────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.UPLOAD_ABORT, async (interaction) => {
  await safeDefer(interaction);
  const session = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);
  if (session) {
    sessionStore.update(session.id, { status: 'cancelled' });
  }

  const panel = new ContainerBuilder()
    .setAccentColor(COLORS.WARNING)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${ICONS.STOP} Upload Aborted\n` +
        `The upload has been stopped. ${session ? `${session.stats.completed} emojis were uploaded before aborting.` : ''}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_IDS.DASHBOARD_REFRESH)
          .setLabel('Back to Dashboard')
          .setEmoji(ICONS.REFRESH)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.editReply({ components: [panel] });
});

// ─── Completion done ─────────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.COMPLETION_DONE, async (interaction) => {
  await safeDefer(interaction);
  const guild  = interaction.guild!;
  const slots  = await getEmojiSlots(guild);
  const panel  = buildDashboard(guild, slots, interaction.client, undefined);
  await interaction.editReply({ components: [panel] });
});

// ─── Settings buttons ─────────────────────────────────────────────────────────

handlers.set(CUSTOM_IDS.SETTINGS_SAVE, async (interaction) => {
  await safeDefer(interaction);
  const guild  = interaction.guild!;
  const slots  = await getEmojiSlots(guild);
  const session = sessionStore.getLatestForUser(guild.id, interaction.user.id);
  const panel  = buildDashboard(guild, slots, interaction.client, session);
  await interaction.editReply({ components: [panel] });
});

handlers.set(CUSTOM_IDS.SETTINGS_RESET, async (interaction) => {
  await safeDefer(interaction);
  const defaults = getDefaultSettings();
  const session  = sessionStore.getLatestForUser(interaction.guild!.id, interaction.user.id);
  if (session) {
    sessionStore.update(session.id, { settings: defaults });
  }
  const panel = buildSettingsPanel(session ? (sessionStore.get(session.id)?.settings ?? defaults) : defaults);
  await interaction.editReply({ components: [panel] });
});

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const logger  = getLogger();
  const handler = handlers.get(interaction.customId);

  if (!handler) {
    logger.warn(`No handler for button: ${interaction.customId}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        components: [buildErrorPanel('Unknown Action', `No handler found for button: \`${interaction.customId}\``, undefined)],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
    return;
  }

  try {
    await handler(interaction);
  } catch (err) {
    logger.error(`Button handler error [${interaction.customId}]`, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    const errorPanel = buildErrorPanel(
      'Unexpected Error',
      err instanceof Error ? err.message : 'An unexpected error occurred.',
      undefined,
    );

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ components: [errorPanel] });
      } else {
        await interaction.reply({
          components: [errorPanel],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }
    } catch {
      // Interaction already expired
    }
  }
}
