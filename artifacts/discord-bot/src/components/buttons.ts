/**
 * Button factory functions.
 *
 * Centralises all ButtonBuilder construction so custom IDs
 * and styles are never duplicated across handlers.
 */

import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { CUSTOM_IDS, ICONS } from '../constants/index.js';

// ─── Dashboard buttons ────────────────────────────────────────────────────────

export function btnUpload(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.UPLOAD_START)
    .setLabel('Upload ZIP')
    .setEmoji(ICONS.UPLOAD)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(disabled);
}

export function btnSettings(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETTINGS_OPEN)
    .setLabel('Settings')
    .setEmoji(ICONS.SETTINGS)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
}

export function btnAdvanced(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.ADVANCED_OPEN)
    .setLabel('Advanced')
    .setEmoji(ICONS.WRENCH ?? '🔧')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
}

export function btnHelp(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.HELP_OPEN)
    .setLabel('Help')
    .setEmoji(ICONS.HELP)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
}

export function btnRefresh(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DASHBOARD_REFRESH)
    .setLabel('Refresh')
    .setEmoji(ICONS.REFRESH)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
}

export function btnCancel(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.CANCEL)
    .setLabel('Cancel')
    .setEmoji(ICONS.CANCEL)
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled);
}

// ─── Upload control buttons ───────────────────────────────────────────────────

export function btnPause(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.UPLOAD_PAUSE)
    .setLabel('Pause')
    .setEmoji(ICONS.PAUSE)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
}

export function btnResume(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.UPLOAD_RESUME)
    .setLabel('Resume')
    .setEmoji(ICONS.PLAY)
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);
}

export function btnAbort(disabled = false): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.UPLOAD_ABORT)
    .setLabel('Stop Upload')
    .setEmoji(ICONS.STOP)
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled);
}

// ─── Duplicate handling buttons ───────────────────────────────────────────────

export function btnDupSkip(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DUP_SKIP)
    .setLabel('Skip Duplicates')
    .setEmoji(ICONS.SKIP)
    .setStyle(ButtonStyle.Secondary);
}

export function btnDupRename(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DUP_RENAME)
    .setLabel('Auto Rename')
    .setEmoji(ICONS.PENCIL ?? '✏️')
    .setStyle(ButtonStyle.Primary);
}

export function btnDupOverwrite(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DUP_OVERWRITE)
    .setLabel('Overwrite')
    .setEmoji(ICONS.WARNING)
    .setStyle(ButtonStyle.Danger);
}

export function btnDupCancel(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.DUP_CANCEL)
    .setLabel('Cancel Upload')
    .setEmoji(ICONS.CANCEL)
    .setStyle(ButtonStyle.Secondary);
}

// ─── Settings buttons ─────────────────────────────────────────────────────────

export function btnSettingsSave(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETTINGS_SAVE)
    .setLabel('Save Settings')
    .setEmoji(ICONS.SUCCESS)
    .setStyle(ButtonStyle.Success);
}

export function btnSettingsReset(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.SETTINGS_RESET)
    .setLabel('Reset to Default')
    .setEmoji(ICONS.REFRESH)
    .setStyle(ButtonStyle.Danger);
}

// ─── Completion buttons ───────────────────────────────────────────────────────

export function btnDone(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.COMPLETION_DONE)
    .setLabel('Done')
    .setEmoji(ICONS.COMPLETE)
    .setStyle(ButtonStyle.Success);
}

export function btnViewStats(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.COMPLETION_STATS)
    .setLabel('View Stats')
    .setEmoji(ICONS.STATS)
    .setStyle(ButtonStyle.Secondary);
}

export function btnNewUpload(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(CUSTOM_IDS.UPLOAD_START)
    .setLabel('Upload More')
    .setEmoji(ICONS.UPLOAD)
    .setStyle(ButtonStyle.Primary);
}
