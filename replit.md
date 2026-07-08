# Discord Emoji ZIP Uploader Bot

A production-grade Discord.js v14 bot that uploads emoji batches from ZIP archives to Discord servers, with a fully interactive Components V2 UI, upload queue, retry engine, and live progress tracking.

## Run & Operate

- `pnpm --filter @workspace/discord-bot run dev` — start the bot with hot reload (requires `.env`)
- `pnpm --filter @workspace/discord-bot run deploy` — register slash commands (guild-scoped, instant)
- `pnpm --filter @workspace/discord-bot run deploy:global` — register slash commands globally
- `pnpm --filter @workspace/discord-bot run typecheck` — type-check the bot
- `pnpm --filter @workspace/api-server run dev` — run the shared API server (port from $PORT)

## Required Environment Variables

Copy `artifacts/discord-bot/.env.example` → `artifacts/discord-bot/.env` and fill in:

- `DISCORD_TOKEN` — bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` — application ID from Developer Portal
- `DISCORD_GUILD_ID` — (optional) for guild-scoped command deployment (instant)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Discord.js v14 with Components V2 (ContainerBuilder, SectionBuilder, etc.)
- unzipper (streaming ZIP extraction)
- p-limit (upload queue concurrency)
- p-retry (exponential backoff retry engine)
- winston + winston-daily-rotate-file (structured logging)
- zod (environment config validation)

## Where things live

- `artifacts/discord-bot/src/` — all bot source code
- `artifacts/discord-bot/src/builders/` — Components V2 panel builders (dashboard, progress, etc.)
- `artifacts/discord-bot/src/handlers/` — button/modal/select interaction handlers
- `artifacts/discord-bot/src/upload/` — upload pipeline (engine + session stages)
- `artifacts/discord-bot/src/zip/` — ZIP validation and streaming extraction
- `artifacts/discord-bot/src/emoji/` — name processing, file validation, uploader
- `artifacts/discord-bot/src/queue/` — p-limit upload queue with per-item state
- `artifacts/discord-bot/src/storage/` — in-memory session store with TTL GC
- `artifacts/discord-bot/src/types/index.ts` — all TypeScript interfaces and error classes
- `artifacts/discord-bot/src/constants/index.ts` — Discord limits, custom IDs, colors, icons
- `artifacts/discord-bot/.env.example` — all configurable variables with documentation
- `artifacts/discord-bot/README.md` — full usage, architecture, and troubleshooting guide

## Architecture decisions

- **Components V2 only** — no legacy embeds; all UI built with ContainerBuilder + SectionBuilder
- **Ephemeral-first** — all bot UI is ephemeral (only visible to the initiating user)
- **Streaming extraction** — unzipper pipeline never loads the entire ZIP into memory
- **Session store** — in-memory Map with TTL GC; max 3 concurrent sessions per guild
- **ZIP-slip mitigation** — every extracted path resolved and checked against extraction root

## Product

Users run `/emoji-upload` in any server channel. A polished dashboard panel appears showing server emoji slots, bot health metrics, and action buttons. They click "Upload ZIP", send their ZIP file in the channel, and watch a live progress panel as emojis upload in parallel. On completion, a summary shows uploaded emojis rendered inline, timing stats, and any failures with recovery hints.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Bot requires **Manage Expressions** permission in the server — grant via Server Settings → Roles
- Run `pnpm deploy` after adding commands before they appear in Discord
- `MessageContent` privileged intent is NOT needed — we only read attachment metadata, not message text
- Components V2 messages must include `flags: MessageFlags.IsComponentsV2` or components won't render
- Session tokens expire after ~15 minutes; long uploads should complete within that window

## Pointers

- See `artifacts/discord-bot/README.md` for full architecture diagram and developer guide
- See the `pnpm-workspace` skill for workspace structure and cross-package conventions
