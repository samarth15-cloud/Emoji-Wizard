/**
 * Discord-specific utility helpers.
 *
 * Guild emoji slot calculation, permission checks, and message helpers.
 */

import {
  Guild,
  GuildPremiumTier,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import type { EmojiSlots } from '../types/index.js';
import { PermissionError } from '../types/index.js';
import { getEmojiSlotsByBoostLevel } from '../constants/index.js';

// ─── Emoji slot calculation ───────────────────────────────────────────────────

/**
 * Compute current emoji slot usage for a guild.
 * Discord gives equal static + animated slots per boost level.
 */
export async function getEmojiSlots(guild: Guild): Promise<EmojiSlots> {
  // Ensure emoji cache is populated
  const emojis = guild.emojis.cache.size > 0
    ? guild.emojis.cache
    : (await guild.emojis.fetch());

  // GuildPremiumTier enum values are 0 | 1 | 2 | 3 — safe to index as number
  const boostLevel = guild.premiumTier satisfies GuildPremiumTier as number;
  const slotsPerType = getEmojiSlotsByBoostLevel(boostLevel);

  let animatedUsed = 0;
  let staticUsed   = 0;

  for (const emoji of emojis.values()) {
    if (emoji.animated) animatedUsed++;
    else staticUsed++;
  }

  return {
    total:              slotsPerType * 2,
    used:               animatedUsed + staticUsed,
    available:          (slotsPerType - staticUsed) + (slotsPerType - animatedUsed),
    animatedTotal:      slotsPerType,
    animatedUsed,
    animatedAvailable:  Math.max(0, slotsPerType - animatedUsed),
    staticTotal:        slotsPerType,
    staticUsed,
    staticAvailable:    Math.max(0, slotsPerType - staticUsed),
  };
}

// ─── Permission checks ────────────────────────────────────────────────────────

/**
 * Verify that the bot member has Manage Expressions permission in the guild.
 * Throws PermissionError if not.
 */
export function assertManageExpressions(member: GuildMember): void {
  if (!member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
    throw new PermissionError(
      'The bot requires the **Manage Expressions** permission to upload emojis. ' +
      'Please ask a server administrator to grant this permission.',
    );
  }
}

/**
 * Verify that the initiating user has Manage Expressions permission.
 * Throws PermissionError if not.
 */
export function assertUserManageExpressions(member: GuildMember): void {
  if (!member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
    throw new PermissionError(
      'You need the **Manage Expressions** permission to upload emojis.',
    );
  }
}

// ─── Server info ──────────────────────────────────────────────────────────────

/** Return a human-readable premium tier label */
export function premiumTierLabel(tier: GuildPremiumTier): string {
  switch (tier) {
    case GuildPremiumTier.None:    return 'None (Level 0)';
    case GuildPremiumTier.Tier1:   return 'Level 1';
    case GuildPremiumTier.Tier2:   return 'Level 2';
    case GuildPremiumTier.Tier3:   return 'Level 3';
    default: return 'Unknown';
  }
}

/** Safe guild icon URL (falls back to a generic placeholder) */
export function guildIconUrl(guild: Guild): string {
  return guild.iconURL({ size: 64 }) ??
    'https://cdn.discordapp.com/embed/avatars/0.png';
}

// ─── String helpers ───────────────────────────────────────────────────────────

/** Truncate a string to maxLength, appending '…' if needed */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '…';
}

/** Escape markdown special characters */
export function escapeMarkdown(str: string): string {
  return str.replace(/[*_`~\\[\]()#+\-!|{}]/g, '\\$&');
}
