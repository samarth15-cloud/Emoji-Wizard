/**
 * Slash command deployment script.
 *
 * Registers /emoji-upload with Discord's API.
 *
 * Usage:
 *   pnpm run deploy          # Guild-scoped (instant)
 *   pnpm run deploy:global   # Global (up to 1h propagation)
 *
 * Guild-scoped is strongly recommended during development.
 * Set DISCORD_GUILD_ID in .env for guild-scoped registration.
 */

import { REST, Routes } from 'discord.js';
import { loadConfig } from '../src/config/index.js';
import { commands } from '../src/commands/index.js';
import chalk from 'chalk';
import ora from 'ora';

async function deploy(): Promise<void> {
  const spinner = ora('Loading configuration…').start();

  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch (err) {
    spinner.fail('Configuration failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }

  const isGlobal = process.argv.includes('--global');
  const commandJsons = commands.map(c => c.data);

  spinner.text = `Deploying ${commandJsons.length} command(s) ${isGlobal ? 'globally' : `to guild ${config.guildId ?? '(no guild ID set)'}`}…`;

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    let data: unknown;

    if (isGlobal) {
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commandJsons },
      );
    } else {
      if (!config.guildId) {
        spinner.fail('DISCORD_GUILD_ID is not set in .env — required for guild-scoped deployment');
        console.error(chalk.yellow('Set DISCORD_GUILD_ID or use --global flag for global deployment'));
        process.exit(1);
      }

      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commandJsons },
      );
    }

    const count = Array.isArray(data) ? data.length : '?';
    spinner.succeed(
      chalk.green(`✅ Successfully deployed ${count} command(s) `) +
      (isGlobal
        ? chalk.cyan('globally (propagation may take up to 1 hour)')
        : chalk.cyan(`to guild ${config.guildId}`)),
    );

    console.log('');
    console.log(chalk.bold('Registered commands:'));
    for (const cmd of commandJsons) {
      console.log(chalk.white(`  /${cmd.name}`) + chalk.gray(` — ${cmd.description}`));
    }
    console.log('');

  } catch (err) {
    spinner.fail('Deployment failed');
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

deploy();
