/**
 * Ready event handler.
 *
 * Fires once when the bot successfully connects to Discord's gateway.
 * Logs startup metrics and sets the bot's presence.
 */

import { Client, ActivityType } from 'discord.js';
import type { BotEvent } from '../types/index.js';
import { getLogger } from '../logging/logger.js';
import chalk from 'chalk';

const event: BotEvent = {
  name:  'ready',
  once:  true,
  async execute(client: Client<true>) {
    const logger = getLogger();

    const guildCount = client.guilds.cache.size;
    const userTag    = client.user.tag;
    const ping       = client.ws.ping;
    const mem        = process.memoryUsage();
    const memMb      = (mem.heapUsed / 1024 / 1024).toFixed(1);

    // Set bot presence
    client.user.setPresence({
      status: 'online',
      activities: [{
        name:  'emoji uploads 📦',
        type:  ActivityType.Watching,
      }],
    });

    // Console banner
    console.log('');
    console.log(chalk.bold.cyan('  ╔══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('  ║') + chalk.bold.white('   🤖 Emoji ZIP Uploader Bot — Online  ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('  ╠══════════════════════════════════════╣'));
    console.log(chalk.bold.cyan('  ║') + chalk.white(`   Tag:     ${userTag.padEnd(29)}`) + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('  ║') + chalk.white(`   Guilds:  ${String(guildCount).padEnd(29)}`) + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('  ║') + chalk.white(`   Latency: ${ping}ms`.padEnd(30)) + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('  ║') + chalk.white(`   Memory:  ${memMb} MB`.padEnd(30)) + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('  ║') + chalk.white(`   Node:    ${process.version.padEnd(29)}`) + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('  ╚══════════════════════════════════════╝'));
    console.log('');

    logger.info(`Bot online`, {
      tag:        userTag,
      guilds:     guildCount,
      latencyMs:  ping,
      memoryMb:   memMb,
      nodeVersion: process.version,
    });
  },
};

export default event;
