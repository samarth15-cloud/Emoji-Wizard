/**
 * Command registry.
 *
 * All slash commands are registered here and exported as a flat array
 * for both registration (deploy-commands.ts) and runtime dispatch.
 */

import type { SlashCommand } from '../types/index.js';
import { emojiUploadCommand } from './emoji-upload.js';

export const commands: SlashCommand[] = [
  emojiUploadCommand,
];

/** Map for O(1) dispatch in the interaction handler */
export const commandMap = new Map<string, SlashCommand>(
  commands.map(cmd => [cmd.data.name, cmd]),
);
