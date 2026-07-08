/**
 * Discord client factory.
 *
 * Creates and configures the Discord.js client with the required
 * intents, partials, and REST settings.  Does NOT log in — that
 * happens in index.ts so the process can be torn down cleanly.
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Options,
} from 'discord.js';
import type { BotEvent } from './types/index.js';

// ─── Event loader ──────────────────────────────────────────────────────────────

import readyEvent          from './events/ready.js';
import interactionEvent    from './events/interactionCreate.js';
import errorEvents, {
  registerProcessHandlers,
} from './events/error.js';

// ─── Client factory ───────────────────────────────────────────────────────────

/**
 * Create a fully-configured Discord client ready for login.
 *
 * Intents chosen:
 *  • Guilds             — guild info, member list, roles
 *  • GuildMessages      — read messages in order to collect ZIP attachments
 *  • GuildEmojisAndStickers — receive emoji cache updates
 *
 * Note: MessageContent is intentionally excluded.  We only need
 * message.attachments (metadata), which does NOT require that privileged intent.
 */
export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildEmojisAndStickers,
    ],
    partials: [
      Partials.GuildMember,
    ],
    // Cache only what we actively use to reduce memory footprint
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 50,   // We only need the last ~50 messages
      ReactionManager: 0,
      PresenceManager: 0,
    }),
    // Exponential backoff for REST requests
    rest: {
      retries: 3,
      timeout: 15_000,
    },
  });

  registerEvents(client);
  registerProcessHandlers();

  return client;
}

// ─── Event registration ───────────────────────────────────────────────────────

function registerEvents(client: Client): void {
  // Single events
  const singleEvents: BotEvent[] = [
    readyEvent,
    interactionEvent,
  ];

  for (const event of singleEvents) {
    if (event.once) {
      client.once(event.name, (...args) => void event.execute(...args));
    } else {
      client.on(event.name, (...args) => void event.execute(...args));
    }
  }

  // Array events (error events export an array)
  for (const event of errorEvents) {
    if (event.once) {
      client.once(event.name, (...args) => void event.execute(...args));
    } else {
      client.on(event.name, (...args) => void event.execute(...args));
    }
  }
}
